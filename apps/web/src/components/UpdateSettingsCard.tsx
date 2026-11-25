import { useId, useState, type ReactNode } from "react";
import type { DesktopUpdaterBridge, DesktopUpdateState } from "@quarry/shared";
import { getDesktopUpdater, useDesktopUpdateState } from "../lib/desktop-updater.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Progress } from "./ui/progress.js";
import { Switch } from "./ui/switch.js";

const releasesUrl = "https://github.com/Zojekin/Quarry/releases";
const latestReleaseApi = "https://api.github.com/repos/Zojekin/Quarry/releases/latest";

function UpdateCard({ version, children }: { version: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>应用更新</CardTitle>
          <CardDescription>当前版本 {version}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function desktopStatus(state: DesktopUpdateState | null | undefined) {
  if (state === undefined) return "正在读取更新设置…";
  if (state === null) return "无法读取更新设置，请重启题匣后重试。";
  if (!state.supported) return "自动更新适用于 Windows 正式发布的桌面版。";
  switch (state.status) {
    case "checking": return "正在检查更新…";
    case "available": return `发现新版本 ${state.version}`;
    case "downloading": return `正在下载 ${state.version}（${state.percent}%）`;
    case "downloaded": return `版本 ${state.version} 已下载，将在重启或退出时安装。`;
    case "up-to-date": return "已是最新版本。";
    case "error": return "更新失败，请重试。";
    case "idle": return "";
  }
}

function DesktopUpdateCard({ updater }: { updater: DesktopUpdaterBridge }) {
  const state = useDesktopUpdateState(updater);
  const autoUpdateId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, failure: string) {
    setPending(true);
    setError("");
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setPending(false);
    }
  }

  return (
    <UpdateCard version={state?.supported ? state.currentVersion : __PRODUCT__.version}>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={autoUpdateId} className="text-sm font-medium">
          自动检查并静默下载更新
        </label>
        <Switch
          id={autoUpdateId}
          checked={state?.autoUpdate ?? true}
          disabled={!state?.supported || pending}
          onCheckedChange={(enabled) => void run(() => updater.setAutoUpdate(enabled), "无法保存自动更新设置，请重试。")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="outline"
          disabled={!state?.supported || pending || ["checking", "downloading", "downloaded"].includes(state.status)}
          onClick={() => void run(updater.checkForUpdates, "无法检查更新，请重试。")}
        >
          检查更新
        </Button>
        {state?.status === "available" && (
          <Button disabled={pending} onClick={() => void run(updater.downloadUpdate, "无法下载更新，请重试。")}>
            下载更新
          </Button>
        )}
        {state?.status === "downloaded" && (
          <Button disabled={pending} onClick={() => void run(updater.quitAndInstall, "无法启动更新安装，请重试。")}>
            立即重启并更新
          </Button>
        )}
      </div>
      <p role="status" className="m-0 text-sm text-muted-foreground empty:hidden">{desktopStatus(state)}</p>
      {state?.status === "downloading" && <Progress aria-label="更新下载进度" value={state.percent} />}
      {error && <p role="alert" className="m-0 text-sm text-destructive">{error}</p>}
    </UpdateCard>
  );
}

type Release = { version: string; download: string; hasInstaller: boolean };

async function fetchLatestRelease(): Promise<Release> {
  const response = await fetch(latestReleaseApi, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Could not fetch the latest release");
  const release: { tag_name?: string; assets?: { name?: string }[] } = await response.json();
  const version = release.tag_name?.match(/^v?(\d+\.\d+\.\d+)$/)?.[1];
  if (!version) throw new Error("Invalid release version");
  const tag = release.tag_name;
  const installer = `Quarry-Setup-${version}-x64.exe`;
  const hasInstaller = release.assets?.some((asset) => asset.name === installer) ?? false;
  return {
    version,
    download: hasInstaller ? `${releasesUrl}/download/${tag}/${installer}` : `${releasesUrl}/tag/${tag}`,
    hasInstaller,
  };
}

function WebUpdateCard() {
  const [release, setRelease] = useState<Release>();
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const currentVersion = __PRODUCT__.version;
  const hasUpdate = release && release.version.localeCompare(currentVersion, "en", { numeric: true }) > 0;

  async function check() {
    setChecking(true);
    setFailed(false);
    try {
      setRelease(await fetchLatestRelease());
    } catch {
      setRelease(undefined);
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <UpdateCard version={currentVersion}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="outline" disabled={checking} onClick={() => void check()}>检查更新</Button>
        {!checking && release && (
          <Button asChild variant={hasUpdate ? "default" : "outline"}>
            <a href={release.download} target="_blank" rel="noreferrer">
              {release.hasInstaller ? "下载 Windows 安装包" : "查看发布页面"}
            </a>
          </Button>
        )}
      </div>
      <p role="status" className="m-0 text-sm text-muted-foreground empty:hidden">
        {checking ? "正在检查更新…" : failed ? "无法获取最新版本，请稍后重试。" : release && (
          hasUpdate ? `发现新版本 ${release.version}` : `已是最新版本（GitHub 发布版 ${release.version}）。`
        )}
      </p>
    </UpdateCard>
  );
}

export function UpdateSettingsCard() {
  const updater = getDesktopUpdater();
  return updater ? <DesktopUpdateCard updater={updater} /> : <WebUpdateCard />;
}

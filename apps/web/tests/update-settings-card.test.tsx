// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { DesktopUpdaterBridge, DesktopUpdateState } from "@quarry/shared";
import { UpdateSettingsCard } from "../src/components/UpdateSettingsCard.js";

afterEach(() => {
  cleanup();
  delete window.__QUARRY_DESKTOP__;
  vi.unstubAllGlobals();
});

function setupDesktop() {
  const base = { currentVersion: "1.0.0", supported: true, autoUpdate: true };
  let listener: (state: DesktopUpdateState) => void;
  const unsubscribe = vi.fn();
  const updater = {
    getState: vi.fn(async (): Promise<DesktopUpdateState> => ({ ...base, status: "idle" })),
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(async () => undefined),
    setAutoUpdate: vi.fn(async () => undefined),
    onStateChange: vi.fn((callback) => { listener = callback; return unsubscribe; }),
  } satisfies DesktopUpdaterBridge;
  window.__QUARRY_DESKTOP__ = { updater };
  return { updater, base, unsubscribe, emit: (state: DesktopUpdateState) => act(() => listener(state)) };
}

it("shows desktop update states and binds the check, switch, download and restart actions", async () => {
  const { updater, base, unsubscribe, emit } = setupDesktop();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { unmount } = render(<UpdateSettingsCard />);
  await screen.findByText("当前版本 1.0.0");
  const automatic = screen.getByRole("switch", { name: "自动检查并静默下载更新" });
  expect(automatic.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(automatic);
  expect(updater.setAutoUpdate).toHaveBeenCalledExactlyOnceWith(false);
  const manual = { ...base, autoUpdate: false };
  emit({ ...manual, status: "idle" });
  const check = screen.getByRole<HTMLButtonElement>("button", { name: "检查更新" });
  await waitFor(() => expect(check.disabled).toBe(false));
  fireEvent.click(check);
  expect(updater.checkForUpdates).toHaveBeenCalledOnce();
  emit({ ...manual, status: "checking" });
  expect(screen.getByRole("status").textContent).toContain("正在检查更新");
  expect(check.disabled).toBe(true);
  emit({ ...manual, status: "up-to-date" });
  expect(screen.getByRole("status").textContent).toContain("已是最新版本");
  emit({ ...manual, status: "error" });
  expect(screen.getByRole("status").textContent).toContain("更新失败");
  emit({ ...manual, status: "available", version: "1.1.0" });
  expect(screen.getByRole("status").textContent).toContain("发现新版本 1.1.0");
  const download = screen.getByRole<HTMLButtonElement>("button", { name: "下载更新" });
  await waitFor(() => expect(download.disabled).toBe(false));
  fireEvent.click(download);
  expect(updater.downloadUpdate).toHaveBeenCalledOnce();
  emit({ ...manual, status: "downloading", version: "1.1.0", percent: 43 });
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("43");
  expect(screen.getByRole("status").textContent).toContain("43%");
  emit({ ...manual, status: "downloaded", version: "1.1.0" });
  const restart = screen.getByRole<HTMLButtonElement>("button", { name: "立即重启并更新" });
  await waitFor(() => expect(restart.disabled).toBe(false));
  await act(() => fireEvent.click(restart));
  expect(updater.quitAndInstall).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
  unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("keeps a delivered desktop update event when the initial snapshot resolves later", async () => {
  const { updater, base, emit } = setupDesktop();
  let resolveState: (state: DesktopUpdateState) => void;
  updater.getState.mockImplementationOnce(() => new Promise((resolve) => { resolveState = resolve; }));
  render(<UpdateSettingsCard />);
  emit({ ...base, status: "downloaded", version: "1.1.0" });
  await act(() => resolveState({ ...base, status: "idle" }));
  expect(screen.getByRole("button", { name: "立即重启并更新" })).toBeTruthy();
});

it("checks GitHub on request in a pure browser and links to the Windows installer", async () => {
  const fetch = vi.fn(async () => Response.json({ tag_name: "v10.0.0", assets: [{ name: "Quarry-Setup-10.0.0-x64.exe" }] }));
  vi.stubGlobal("fetch", fetch);
  render(<UpdateSettingsCard />);
  expect(screen.queryByRole("switch")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "检查更新" }));
  expect(screen.getByRole("status").textContent).toContain("正在检查更新");
  const link = await screen.findByRole("link", { name: "下载 Windows 安装包" });
  expect(link.getAttribute("href")).toBe("https://github.com/Zojekin/Quarry/releases/download/v10.0.0/Quarry-Setup-10.0.0-x64.exe");
  expect(screen.getByRole("status").textContent).toContain("发现新版本 10.0.0");
  expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/Zojekin/Quarry/releases/latest", expect.any(Object));
});

it("offers a release page before CI uploads the installer and handles failed or current releases", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ tag_name: "10.0.0", assets: [] }))
    .mockResolvedValueOnce(Response.json({
      tag_name: __PRODUCT__.version,
      assets: [{ name: `Quarry-Setup-${__PRODUCT__.version}-x64.exe` }],
    }));
  vi.stubGlobal("fetch", fetch);
  render(<UpdateSettingsCard />);
  const check = screen.getByRole("button", { name: "检查更新" });
  fireEvent.click(check);
  await screen.findByText("无法获取最新版本，请稍后重试。");
  fireEvent.click(check);
  expect((await screen.findByRole("link", { name: "查看发布页面" })).getAttribute("href"))
    .toBe("https://github.com/Zojekin/Quarry/releases/tag/10.0.0");
  fireEvent.click(check);
  await screen.findByText(/已是最新版本/);
  expect(screen.getByRole("link", { name: "下载 Windows 安装包" })).toBeTruthy();
});

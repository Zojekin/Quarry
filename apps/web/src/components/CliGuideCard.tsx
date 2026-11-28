import { useEffect, useId, useState } from "react";
import { Copy } from "lucide-react";
import type { DesktopCliToolsBridge, DesktopCliToolsInfo, SkillPreset } from "@quarry/shared";
import skill from "../../../../skills/question-converter/SKILL.md?raw";
import { updatePreferences, usePreferences } from "../lib/preferences.js";
import { Button } from "./ui.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.js";
import { Switch } from "./ui/switch.js";

const commands = [
  ["spec", "查看语法和示例"],
  ["validate draft.md", "校验草稿"],
  ["convert draft.md -o questions.json", "生成题匣导入文件"],
] as const;

const template = `---
entity: bank
name: 基础练习
tags: [示例]
---

## [单选] 2 + 2 等于多少？
- [x] 4
- [ ] 5
> 解析：两个 2 相加得 4。
`;

export function CliGuideCard() {
  const { cliEnabled } = usePreferences();
  const id = useId();

  return (
    <Card>
      <CardHeader className="items-center pb-4">
        <div className="space-y-1">
          <CardTitle id={id}>题目转换 CLI 与 AI Skill</CardTitle>
          <CardDescription>用 AI 助手把现有题目整理成题匣导入文件。</CardDescription>
        </div>
        <Switch
          aria-labelledby={id}
          checked={cliEnabled}
          onCheckedChange={(checked) => updatePreferences({ cliEnabled: checked })}
        />
      </CardHeader>
      {cliEnabled && <CliGuideContent />}
    </Card>
  );
}

function CliGuideContent() {
  const bridge = window.__QUARRY_DESKTOP__?.cliTools;
  const id = useId();
  const [info, setInfo] = useState<DesktopCliToolsInfo>();
  const [infoError, setInfoError] = useState(false);
  const [target, setTarget] = useState<SkillPreset | "custom">();
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<{ text: string; error?: boolean }>();
  const [copyStatus, setCopyStatus] = useState<{ text: string; manual?: string }>();

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    void bridge.getInfo().then(
      (result) => { if (active) setInfo(result); },
      () => { if (active) setInfoError(true); },
    );
    return () => { active = false; };
  }, [bridge]);

  const loading = Boolean(bridge && !info && !infoError);
  const command = info?.cli?.command ?? "pnpm quarry";
  const selected = target ?? info?.targets[0]?.id ?? "custom";
  const selectedPath = info?.targets.find((entry) => entry.id === selected)?.path;
  const prompt = [
    "请按 question-converter Skill（SKILL.md）整理我提供的题目，生成可导入题匣的文件。",
    "保留原有题干、选项、答案、解析和公式。请勿解题或补写答案，缺失信息先向我确认。",
    info?.cli
      ? "在安装了 Node.js 22.14+ 的终端运行下列命令。"
      : "在题匣源码仓库执行 pnpm install 和 pnpm build，再运行下列命令。",
    `先用 \`${command} spec\` 查阅语法，整理为 draft.md。`,
    `运行 \`${command} validate draft.md\`，修正格式错误直到校验通过。`,
    `运行 \`${command} convert draft.md -o questions.json\`，校验并交付 questions.json 供我导入题匣。`,
  ].join("\n");

  async function copy(content: string, label: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus({ text: `已复制${label}` });
    } catch {
      setCopyStatus({ text: "复制失败，可从下方手动复制。", manual: content });
    }
  }

  async function install(cliTools: DesktopCliToolsBridge) {
    setInstalling(true);
    setInstallStatus(undefined);
    try {
      const result = await cliTools.installSkill(selected);
      if (result.status === "installed") setInstallStatus({ text: `已安装至 ${result.path}` });
    } catch (error) {
      setInstallStatus({ text: `安装失败。 ${error instanceof Error ? error.message : ""}`, error: true });
    } finally {
      setInstalling(false);
    }
  }

  return (
    <CardContent className="space-y-4 text-sm">
      <div className="space-y-2">
        <h3 className="font-medium">交给 AI 助手</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void copy(prompt, "提示词")}>
            <Copy aria-hidden="true" /> 复制 Agent 提示词
          </Button>
          {(!bridge || infoError) && (
            <>
              <Button variant="outline" size="sm" onClick={() => void copy(skill, "Skill 内容")}>复制 Skill 内容</Button>
              <Button asChild variant="outline" size="sm">
                <a href={`data:text/markdown;charset=utf-8,${encodeURIComponent(skill)}`} download="SKILL.md">下载 SKILL.md</a>
              </Button>
            </>
          )}
        </div>
        {loading && <p role="status" className="text-muted-foreground">正在读取桌面工具…</p>}
        {infoError && <p role="alert" className="text-destructive">无法读取桌面工具，可手动下载 Skill。</p>}
        {bridge && info && (
          <div className="space-y-2">
            <label htmlFor={id} className="block font-medium">Skill 安装位置</label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selected}
                disabled={installing}
                onValueChange={(value) => {
                  setTarget(value as SkillPreset | "custom");
                  setInstallStatus(undefined);
                }}
              >
                <SelectTrigger id={id} className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {info.targets.map(({ id, label }) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                  <SelectItem value="custom">自选目录…</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={installing} onClick={() => void install(bridge)}>
                {installing ? "安装中…" : selected === "custom" ? "选择目录并安装" : "安装 Skill"}
              </Button>
            </div>
            <p className="break-all text-xs text-muted-foreground">
              {selectedPath ?? "在所选目录下创建 question-converter 文件夹。"}
            </p>
            {installStatus && (
              <p role={installStatus.error ? "alert" : "status"} className={`break-words ${installStatus.error ? "text-destructive" : "text-muted-foreground"}`}>{installStatus.text}</p>
            )}
          </div>
        )}
      </div>
      {copyStatus && (
        <div className="space-y-2">
          <p role="status" className="text-muted-foreground">{copyStatus.text}</p>
          {copyStatus.manual && <textarea className="w-full rounded-md border border-input p-2 font-mono text-xs" aria-label="手动复制内容" rows={4} readOnly value={copyStatus.manual} onFocus={(event) => event.currentTarget.select()} />}
        </div>
      )}
      {!loading && (
        <div className="space-y-2">
          <h3 className="font-medium">命令速查</h3>
          <p className="text-muted-foreground">
            {info?.cli ? "终端需安装 Node.js 22.14+。" : "在题匣源码仓库运行 pnpm install 和 pnpm build 后使用。"}
            {info && !info.cli && " 当前桌面 CLI 文件缺失。"}
          </p>
          <dl className="space-y-2">
            {commands.map(([args, detail]) => (
              <div key={args} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <dt className="min-w-0"><code className="break-all rounded bg-muted px-1.5 py-0.5">{command} {args}</code></dt>
                <dd className="text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">Markdown 草稿模板</h3>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => void copy(template, "模板")}>
            <Copy aria-hidden="true" /> 复制模板
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed"><code>{template}</code></pre>
      </div>
    </CardContent>
  );
}

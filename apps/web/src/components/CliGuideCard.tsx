import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "./ui.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";

const commands = [
  ["quarry spec", "查看题目 Markdown 语法和示例"],
  ["quarry validate draft.md", "校验草稿并定位错误"],
  ["quarry convert draft.md -o questions.json", "生成可导入题匣的 JSON"],
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
  const [copyStatus, setCopyStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(template);
      setCopyStatus("已复制模板");
    } catch {
      setCopyStatus("复制失败，可选中下方模板手动复制。");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>题目转换 CLI 与 AI Skill</CardTitle>
          <CardDescription>在题匣源码仓库运行 <code>pnpm install</code> 和 <code>pnpm build</code>，再用 <code>pnpm quarry</code> 执行下列子命令。</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="space-y-2">
          {commands.map(([command, detail]) => (
            <div key={command} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <dt><code className="break-all rounded bg-muted px-1.5 py-0.5">{command}</code></dt>
              <dd className="text-muted-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">Markdown 草稿模板</h3>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => void copy()}>
              <Copy aria-hidden="true" /> 复制模板
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed"><code>{template}</code></pre>
          {copyStatus && <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>}
        </div>
        <p className="text-muted-foreground">
          将仓库中的 <code>skills/question-converter/SKILL.md</code> 和题目材料交给 AI 助手，让它按指南生成、校验并转换草稿。在资料库中导入生成的文件。
        </p>
      </CardContent>
    </Card>
  );
}

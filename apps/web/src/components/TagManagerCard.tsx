import { useRef, useState } from "react";
import { client, type Tag } from "../api/client.js";
import { cn } from "../lib/utils.js";
import { Button, Notice, errorMessage, tagBackground, tagColorStyle, useConfirmation, useLoad } from "./ui.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Input } from "./ui/input.js";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs.js";

type ManagedTag = Awaited<ReturnType<typeof client.tags.listWithUsage>>[number];

const colorSwatches = ["#2d5c48", "#4d7c5f", "#2b5c86", "#8c5c16", "#b23a31", "#7a5377", "#e4eade", "#eee7da"];

function TagRow({
  tag,
  busy,
  onSaved,
  onDelete,
}: {
  tag: ManagedTag;
  busy: boolean;
  onSaved: (tag: Tag) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [renaming, setRenaming] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const chain = useRef(Promise.resolve());
  const revision = useRef(0);
  const colorDisabled = busy || renaming;

  function saveColor(next: Tag["color"]) {
    setColor(next);
    setStatus("saving");
    setError("");
    const current = ++revision.current;
    // Serialize color picker events so a slow request cannot overwrite a newer color.
    chain.current = chain.current.then(async () => {
      try {
        const updated = await client.tags.update(tag.id, { color: next });
        onSaved(updated);
        if (revision.current === current) setStatus("saved");
      } catch (e) {
        if (revision.current !== current) return;
        setError(errorMessage(e));
        setStatus("error");
      }
    });
  }

  async function rename() {
    const next = name.trim();
    if (!next || next === tag.name || busy || renaming || status === "saving") return;
    setRenaming(true);
    setError("");
    try {
      const updated = await client.tags.update(tag.id, { name: next });
      setName(updated.name);
      onSaved(updated);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div role="group" aria-label={tag.name} className="space-y-2.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tag-color max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs font-medium" style={tagColorStyle(color)}>
          {tag.name}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">已用于 {tag.usage_count} 项</span>
        <Button
          type="button"
          variant="destructiveGhost"
          size="sm"
          aria-label={`删除 ${tag.name}`}
          disabled={busy || renaming || status === "saving"}
          onClick={onDelete}
          className="ml-auto"
        >
          删除
        </Button>
      </div>
      <form className="flex items-center gap-2" onSubmit={(event) => {
        event.preventDefault();
        void rename();
      }}>
        <Input aria-label={`${tag.name}的新名称`} value={name} disabled={busy || renaming} onChange={(event) => setName(event.target.value)} />
        <Button variant="outline" size="sm" type="submit" disabled={!name.trim() || name.trim() === tag.name || busy || renaming || status === "saving"}>
          重命名
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-1.5">
        {colorSwatches.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={`${tag.name} 设为 ${hex}`}
            aria-pressed={color?.toLowerCase() === hex.toLowerCase()}
            disabled={colorDisabled}
            onClick={() => saveColor(hex)}
            className={cn(
              "size-5 rounded-full border border-control-edge/15 transition-transform enabled:hover:scale-110 disabled:opacity-50",
              color?.toLowerCase() === hex.toLowerCase() && "ring-2 ring-primary ring-offset-1 ring-offset-card",
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
        <input
          type="color"
          aria-label={`${tag.name}颜色`}
          value={tagBackground(color)}
          disabled={colorDisabled}
          onChange={(event) => saveColor(event.target.value)}
          className="ml-1 h-7 w-9 cursor-pointer rounded border border-border bg-card p-0.5"
        />
        <Button size="sm" variant="ghost" disabled={colorDisabled || color === null} onClick={() => saveColor(null)}>
          系统默认
        </Button>
        {status === "error" && (
          <Button size="sm" variant="destructiveGhost" disabled={colorDisabled} onClick={() => saveColor(color)}>
            重试颜色保存
          </Button>
        )}
        <span role="status" className="text-xs text-muted-foreground">
          {status === "saving" ? "保存中…" : status === "saved" ? "已保存" : ""}
        </span>
      </div>
      <Notice error={error} loading={false} />
    </div>
  );
}

export function TagManagerCard() {
  const [namespace, setNamespace] = useState<Tag["target_type"]>("file");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { data, setData, error, reload } = useLoad(() => client.tags.listWithUsage(), []);
  const confirm = useConfirmation();
  const tags = data?.filter((tag) => tag.target_type === namespace);

  async function create() {
    if (!name.trim() || busy || !data) return;
    setBusy(true);
    setMessage("");
    try {
      const tag = await client.tags.create({ name: name.trim(), target_type: namespace });
      setData((list) => list?.concat({ ...tag, usage_count: 0 }));
      setName("");
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await client.tags.delete(id);
      setData((list) => list?.filter((tag) => tag.id !== id));
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>标签管理</CardTitle>
          <CardDescription>使用次数包含回收站中的项目。</CardDescription>
        </div>
        <Tabs value={namespace} onValueChange={(value) => {
          setNamespace(value as Tag["target_type"]);
          setName("");
          setMessage("");
        }}>
          <TabsList aria-label="标签类型">
            <TabsTrigger value="file" disabled={busy}>文件标签</TabsTrigger>
            <TabsTrigger value="question" disabled={busy}>题目标签</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-3">
        <form className="flex items-center gap-2" onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}>
          <Input aria-label="新标签名称" placeholder="新标签名称" value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" disabled={!name.trim() || busy || !data}>添加标签</Button>
        </form>
        <Notice error={error || message} loading={!data && !error} />
        {error && <Button variant="outline" size="sm" onClick={reload}>重新加载标签</Button>}
        {tags?.length === 0 && <p className="text-sm text-muted-foreground">此分类暂无标签。</p>}
        {(["file", "question"] as const).map((type) => (
          <div key={type} hidden={type !== namespace} className="max-h-72 divide-y divide-border overflow-y-auto px-0.5">
            {data?.filter((tag) => tag.target_type === type).map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                busy={busy}
                onSaved={(updated) => setData((list) =>
                  list?.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry),
                )}
                onDelete={() => confirm.ask(
                  `删除「${tag.name}」？该标签已用于 ${tag.usage_count} 项，删除后会解除这些关联。`,
                  () => void remove(tag.id),
                )}
              />
            ))}
          </div>
        ))}
      </CardContent>
      {confirm.dialog}
    </Card>
  );
}

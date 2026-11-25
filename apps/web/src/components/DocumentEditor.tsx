import { useState } from "react";
import { client } from "../api/client.js";
import type { Document, Paper, Tag } from "../api/client.js";
import { Button, Modal, Notice, types } from "./ui.js";
import { Input, Textarea } from "./ui/input.js";
import { Switch } from "./ui/switch.js";

export function DocumentEditor({
  kind,
  document,
  parent,
  tags,
  onClose,
  onSaved,
}: {
  kind: "folders" | "banks" | "papers";
  document?: Document;
  parent?: string;
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(document?.name ?? "");
  const [description, setDescription] = useState(document?.description ?? "");
  const [names, setNames] = useState(
    tags
      .filter((t) => document?.tag_ids.includes(t.id))
      .map((t) => t.name)
      .join(", "),
  );
  const [minutes, setMinutes] = useState(
    (document as Paper | undefined)?.time_limit_seconds
      ? String((document as Paper).time_limit_seconds! / 60)
      : "",
  );
  const [shuffleOptions, setShuffleOptions] = useState(
    (document as Paper | undefined)?.shuffle_options ?? false,
  );
  const [shuffleSections, setShuffleSections] = useState(
    (document as Paper | undefined)?.shuffle_sections ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    try {
      const tag_ids: string[] = [];
      for (const tagName of names
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        const tag =
          tags.find((t) => t.name === tagName) ??
          (await client.tags.create({ name: tagName, target_type: "file" }));
        if (!tag_ids.includes(tag.id)) tag_ids.push(tag.id);
      }
      const input = {
        name,
        tag_ids,
        ...(kind === "folders"
          ? { parent_id: document?.parent_id ?? parent ?? null }
          : { description, folder_id: document?.folder_id ?? parent ?? null }),
        ...(kind === "papers"
          ? {
              time_limit_seconds: minutes ? Number(minutes) * 60 : null,
              shuffle_options: shuffleOptions,
              shuffle_sections: shuffleSections,
            }
          : {}),
      };
      if (document) await client[kind].update(document.id, input);
      else await client[kind].create(input);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={
        document
          ? "编辑属性"
          : "新建" + { folders: "文件夹", banks: "题库", papers: "套题" }[kind]
      }
      onClose={onClose}
      onSubmit={() => {
        if (!busy && name.trim()) void save();
      }}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="default"
            type="submit"
            disabled={busy || !name.trim()}
          >
            保存
          </Button>
        </>
      }
    >
      <label className="block space-y-1.5 text-[13px] font-medium">
        <span>名称</span>
        <Input
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {kind !== "folders" && (
        <label className="block space-y-1.5 text-[13px] font-medium">
          <span>简介</span>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      )}
      <label className="block space-y-1.5 text-[13px] font-medium">
        <span>文件标签（英文逗号分隔）</span>
        <Input value={names} onChange={(e) => setNames(e.target.value)} />
      </label>
      {kind === "papers" && (
        <div className="space-y-3 pt-1">
          <label className="block space-y-1.5 text-[13px] font-medium">
            <span>考试时间（分钟，空白为不限时）</span>
            <Input
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5">
            <span className="text-[13px] font-medium">打乱选项</span>
            <Switch
              aria-label="打乱选项"
              checked={shuffleOptions}
              onCheckedChange={setShuffleOptions}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5">
            <span className="text-[13px] font-medium">打乱分区</span>
            <Switch
              aria-label="打乱分区"
              checked={shuffleSections}
              onCheckedChange={setShuffleSections}
            />
          </div>
        </div>
      )}
      <Notice error={error} loading={busy} />
    </Modal>
  );
}

export function ComposerEditor({
  paper,
  onClose,
  onSaved,
}: {
  paper: Paper;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sections, setSections] = useState(paper.sections);
  const [merged, setMerged] = useState(
    paper.merged_shuffle_sections
      .map((group) =>
        group
          .map((id) => paper.sections.findIndex((s) => s.id === id) + 1)
          .join(","),
      )
      .join(";"),
  );
  const [materials, setMaterials] = useState(paper.shuffle_materials);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await client.papers.update(paper.id, {
        sections: sections.map((s) => ({
          ...s,
          items: s.items.map((i) => ({ id: i.id })),
        })),
        shuffle_materials: materials,
        merged_shuffle_sections: merged.trim()
          ? merged.split(";").map((g) =>
              g.split(",").map((n) => {
                const s = sections[Number(n) - 1];
                if (!s) throw new Error("合并分区编号无效");
                return s.id;
              }),
            )
          : [],
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="套题编排"
      onClose={onClose}
      className="w-[min(640px,calc(100vw-2rem))]"
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="default"
            disabled={busy || !!error}
            onClick={() => void save()}
          >
            保存编排
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {sections.map((section, i) => (
          <section
            key={section.id}
            className="space-y-3 rounded-lg border border-border bg-muted/30 p-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-[14px] font-semibold">
                {i + 1}.{" "}
                {section.title === section.question_type
                  ? (types.find((type) => type.id === section.question_type)
                      ?.name ?? section.title)
                  : section.title}
              </h3>
              <label className="flex items-center gap-2 text-[12.5px] font-medium">
                <span>分区内打乱</span>
                <Switch
                  aria-label="分区内打乱"
                  checked={section.shuffle_questions}
                  onCheckedChange={(checked) =>
                    setSections(
                      sections.map((s) =>
                        s.id === section.id
                          ? { ...s, shuffle_questions: checked }
                          : s,
                      ),
                    )
                  }
                />
              </label>
            </div>
            <div className="space-y-1.5">
              {section.items.map((item, n) => (
                <div
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-[13px]"
                  key={item.id}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {n + 1}. {item.question.content}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={n === 0}
                    onClick={() =>
                      setSections(
                        sections.map((s) => {
                          if (s.id !== section.id) return s;
                          const items = [...s.items];
                          [items[n - 1], items[n]] = [items[n]!, items[n - 1]!];
                          return { ...s, items };
                        }),
                      )
                    }
                  >
                    上移
                  </Button>
                </div>
              ))}
            </div>
            <label className="block space-y-1 text-[12.5px] font-medium text-muted-foreground">
              <span>固定组（题号用逗号，组间用分号）</span>
              <Input
                defaultValue={section.fixed_groups
                  .map((g) =>
                    g
                      .map(
                        (id) => section.items.findIndex((i) => i.id === id) + 1,
                      )
                      .join(","),
                  )
                  .join(";")}
                onBlur={(e) => {
                  try {
                    const groups = e.target.value.trim()
                      ? e.target.value.split(";").map((g) =>
                          g.split(",").map((n) => {
                            const item = section.items[Number(n) - 1];
                            if (!item) throw new Error("固定组题号无效");
                            return item.id;
                          }),
                        )
                      : [];
                    setSections(
                      sections.map((s) =>
                        s.id === section.id ? { ...s, fixed_groups: groups } : s,
                      ),
                    );
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </label>
          </section>
        ))}

        <label className="block space-y-1.5 text-[13px] font-medium">
          <span>合并打乱分区（编号用逗号，组间用分号）</span>
          <Input value={merged} onChange={(e) => setMerged(e.target.value)} />
        </label>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2.5">
          <span className="text-[13px] font-medium">共用材料组间打乱</span>
          <Switch
            aria-label="共用材料组间打乱"
            checked={materials}
            onCheckedChange={setMaterials}
          />
        </div>
        <Notice error={error} loading={busy} />
      </div>
    </Modal>
  );
}

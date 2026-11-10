import { useState } from "react";
import { client } from "../api/client.js";
import type { Document, Paper, Tag } from "../api/client.js";
import { Button, Notice } from "./ui.js";
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
      for (const name of names
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        const tag =
          tags.find((t) => t.name === name) ??
          (await client.tags.create({ name, target_type: "file" }));
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
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="文件属性"
        className="card editor"
      >
        <h2>
          {document
            ? "编辑属性"
            : "新建" +
              { folders: "文件夹", banks: "题库", papers: "套题" }[kind]}
        </h2>
        <label>
          名称
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {kind !== "folders" && (
          <label>
            简介
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        )}
        <label>
          文件标签（英文逗号分隔）
          <input value={names} onChange={(e) => setNames(e.target.value)} />
        </label>
        {kind === "papers" && (
          <>
            <label>
              考试时间（分钟，空白为不限时）
              <input
                type="number"
                min="1"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
              />
              打乱选项
            </label>
            <label>
              <input
                type="checkbox"
                checked={shuffleSections}
                onChange={(e) => setShuffleSections(e.target.checked)}
              />
              打乱分区
            </label>
          </>
        )}
        <Notice error={error} loading={busy} />
        <div className="toolbar">
          <Button onClick={onClose}>取消</Button>
          <Button
            primary
            disabled={busy || !name.trim()}
            onClick={() => void save()}
          >
            保存
          </Button>
        </div>
      </section>
    </div>
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
    <div className="modal-backdrop">
      <section
        className="card editor"
        role="dialog"
        aria-modal="true"
        aria-label="套题编排"
      >
        <h2>套题编排</h2>
        {sections.map((section, i) => (
          <section key={section.id}>
            <h3>
              {i + 1}. {section.title}
            </h3>
            <label>
              <input
                type="checkbox"
                checked={section.shuffle_questions}
                onChange={(e) =>
                  setSections(
                    sections.map((s) =>
                      s.id === section.id
                        ? { ...s, shuffle_questions: e.target.checked }
                        : s,
                    ),
                  )
                }
              />
              分区内打乱
            </label>
            {section.items.map((item, n) => (
              <div className="toolbar" key={item.id}>
                <span className="grow">
                  {n + 1}. {item.question.content}
                </span>
                <Button
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
            <label>
              固定组（题号用逗号，组间用分号）
              <input
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
                        s.id === section.id
                          ? { ...s, fixed_groups: groups }
                          : s,
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
        <label>
          合并打乱分区（编号用逗号，组间用分号）
          <input value={merged} onChange={(e) => setMerged(e.target.value)} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={materials}
            onChange={(e) => setMaterials(e.target.checked)}
          />
          共用材料组间打乱
        </label>
        <Notice error={error} loading={busy} />
        <div className="toolbar">
          <Button onClick={onClose}>取消</Button>
          <Button
            primary
            disabled={busy || !!error}
            onClick={() => void save()}
          >
            保存编排
          </Button>
        </div>
      </section>
    </div>
  );
}

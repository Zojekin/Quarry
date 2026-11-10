import { useState } from "react";
import { client } from "../api/client.js";
import type { Paper, Tag, ComposerSection } from "../api/client.js";
import { Button, Facet, Notice, types, useLoad } from "./ui.js";
import { Markdown } from "./Markdown.js";
export function QuestionPicker({
  paperId,
  onClose,
  onSaved,
}: {
  paperId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bank, setBank] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string[]>();
  const [selected, setSelected] = useState<string[]>([]);
  const { data, error } = useLoad(
    () =>
      Promise.all([
        client.banks.list(),
        bank ? client.questions.list({ bank_id: bank }) : Promise.resolve([]),
      ]),
    [bank],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rows =
    data?.[1].filter(
      (q) =>
        q.content.includes(search) &&
        (filter === undefined || filter.includes(q.type)),
    ) ?? [];
  const ids = selected.filter((id) => rows.some((q) => q.id === id));
  async function save() {
    setBusy(true);
    try {
      const paper = await client.papers.get(paperId);
      const sections: ComposerSection[] = paper.sections.map(
        ({ items, ...section }) => ({
          ...section,
          items: items.map((item) => ({ id: item.id })),
        }),
      );
      for (const id of ids) {
        const question = rows.find((q) => q.id === id)!;
        let section = sections.find((s) => s.question_type === question.type);
        if (!section) {
          section = {
            id: crypto.randomUUID(),
            title:
              types.find((t) => t.id === question.type)?.name ?? question.type,
            question_type: question.type,
            shuffle_questions: false,
            fixed_groups: [],
            items: [],
          };
          sections.push(section);
        }
        section.items.push({ source_question_id: id });
      }
      await client.papers.compose(paperId, sections);
      onSaved();
      onClose();
    } catch (e) {
      setMessage((e as Error).message);
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
        aria-label="从题库选题"
      >
        <h2>从题库选题</h2>
        <div className="toolbar">
          <select
            aria-label="题库"
            value={bank}
            onChange={(e) => {
              setBank(e.target.value);
              setSelected([]);
            }}
          >
            <option value="">选择题库</option>
            {data?.[0].map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Facet
            label="题型"
            options={types}
            value={filter}
            onChange={setFilter}
          />
          <input
            className="search"
            aria-label="搜索选题"
            placeholder="搜索题目"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Notice error={error || message} loading={!data} />
        <label>
          <input
            type="checkbox"
            checked={rows.length > 0 && ids.length === rows.length}
            onChange={(e) =>
              setSelected(e.target.checked ? rows.map((q) => q.id) : [])
            }
          />
          全选当前结果
        </label>
        {rows.map((q) => (
          <label className="picker-question" key={q.id}>
            <input
              type="checkbox"
              checked={ids.includes(q.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...ids, q.id]
                    : ids.filter((id) => id !== q.id),
                )
              }
            />
            <Markdown text={q.content} />
          </label>
        ))}
        <div className="toolbar">
          <Button onClick={onClose}>取消</Button>
          <Button
            primary
            disabled={busy || !ids.length}
            onClick={() => void save()}
          >
            加入 {ids.length} 道题目
          </Button>
        </div>
      </section>
    </div>
  );
}
export function FollowDialog({
  paper,
  tags,
  onClose,
  onSaved,
}: {
  paper: Paper;
  tags: Tag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, error } = useLoad(
    () => client.papers.followDiff(paper.id),
    [paper.id],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fields: Record<string, string> = {
    type: "题型",
    stem: "题干",
    options: "选项",
    answers: "参考答案",
    analysis: "解析",
    material: "共用材料",
    tags: "题目标签",
  };
  function value(raw: unknown): string {
    if (raw === null || raw === undefined) return "无";
    if (Array.isArray(raw)) return raw.map(value).join("；");
    if (typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      return value(o.content ?? o.valid_answers ?? "内容已更新");
    }
    const text = String(raw);
    return (
      tags.find((t) => t.id === text)?.name ??
      paper.sections
        .flatMap((s) => s.items)
        .flatMap((i) => i.question.options ?? [])
        .find((o) => o.id === text)?.content ??
      types.find((t) => t.id === text)?.name ??
      text
    );
  }
  async function apply() {
    setBusy(true);
    try {
      if (!paper.follow_source)
        await client.papers.update(paper.id, { follow_source: true });
      await client.papers.applyFollow(paper.id);
      onSaved();
      onClose();
    } catch (e) {
      setMessage((e as Error).message);
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
        aria-label="来源差异预览"
      >
        <h2>来源差异预览</h2>
        <Notice error={error || message} loading={!data} />
        {data?.length === 0 && <p>来源内容没有变化。</p>}
        {data?.map((diff, i) => (
          <section key={diff.item_id}>
            <h3>
              变更题目 {i + 1}
              {diff.source_invalid ? " · 来源已失效" : ""}
            </h3>
            {Object.entries(diff.changes).map(([key, change]) => (
              <div key={key}>
                <h3>{fields[key] ?? key}</h3>
                <div className="diff-columns">
                  <div>
                    <p>当前内容</p>
                    <Markdown text={value(change.before)} />
                  </div>
                  <div>
                    <p>来源内容</p>
                    <Markdown text={value(change.after)} />
                  </div>
                </div>
              </div>
            ))}
          </section>
        ))}
        <div className="toolbar">
          <Button onClick={onClose}>取消</Button>
          <Button primary disabled={busy || !data} onClick={() => void apply()}>
            {paper.follow_source ? "应用更新" : "开启跟随并应用"}
          </Button>
        </div>
      </section>
    </div>
  );
}
export function ImportDialog({
  file,
  onClose,
  onSaved,
}: {
  file: File;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data, error } = useLoad(
    () => client.backup.importPreview(file),
    [file],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="modal-backdrop">
      <section
        className="card editor"
        role="dialog"
        aria-modal="true"
        aria-label="导入预览"
      >
        <h2>导入预览</h2>
        <Notice error={error || message} loading={!data && !error} />
        {data && (
          <>
            <h3>{data.name}</h3>
            <p>
              {data.entity === "bank" ? "题库" : "套题"} ·{" "}
              {data.questions.length} 道题目 · {data.attachments.length} 个附件
            </p>
            <Markdown text={data.description} />
            {data.questions.map((q) => (
              <article key={q.id}>
                <Markdown text={q.content} />
              </article>
            ))}
          </>
        )}
        <div className="toolbar">
          <Button onClick={onClose}>取消</Button>
          <Button
            primary
            disabled={!data || busy || !!error}
            onClick={() => {
              setBusy(true);
              void client.backup
                .importCommit(file)
                .then(() => {
                  onSaved();
                  onClose();
                })
                .catch((e) => setMessage(e.message))
                .finally(() => setBusy(false));
            }}
          >
            确认导入为新文件
          </Button>
        </div>
      </section>
    </div>
  );
}

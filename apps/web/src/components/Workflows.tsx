import { useState } from "react";
import { client } from "../api/client.js";
import type { Paper, Tag, ComposerSection } from "../api/client.js";
import {
  Button,
  Facet,
  Modal,
  Notice,
  SearchField,
  types,
  useLoad,
} from "./ui.js";
import { Checkbox } from "./ui/checkbox.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select.js";
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
    <Modal
      title="从题库选题"
      onClose={onClose}
      className="w-[min(640px,calc(100vw-2rem))]"
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="default"
            disabled={busy || !ids.length}
            onClick={() => void save()}
          >
            加入 {ids.length} 道题目
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={bank || "__empty"}
          onValueChange={(value) => {
            setBank(value === "__empty" ? "" : value);
            setSelected([]);
          }}
        >
          <SelectTrigger aria-label="题库" className="min-w-[140px]">
            <SelectValue placeholder="选择题库" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty">选择题库</SelectItem>
            {data?.[0].map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Facet
          label="题型"
          options={types}
          value={filter}
          onChange={setFilter}
        />
        <SearchField
          label="搜索选题"
          placeholder="搜索题目"
          value={search}
          onChange={setSearch}
          className="ml-auto"
        />
      </div>
      <Notice error={error || message} loading={!data} />
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
        <Checkbox
          aria-label="全选当前结果"
          checked={rows.length > 0 && ids.length === rows.length}
          onCheckedChange={(checked) =>
            setSelected(checked ? rows.map((q) => q.id) : [])
          }
        />
        <span>全选当前结果</span>
      </label>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {rows.map((q) => (
          <label
            key={q.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-[13.5px] hover:bg-muted/50"
          >
            <Checkbox
              className="mt-0.5"
              checked={ids.includes(q.id)}
              onCheckedChange={(checked) =>
                setSelected(
                  checked
                    ? [...ids, q.id]
                    : ids.filter((id) => id !== q.id),
                )
              }
            />
            <div className="min-w-0 flex-1">
              <Markdown text={q.content} />
            </div>
          </label>
        ))}
      </div>
    </Modal>
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
    <Modal
      title="来源差异预览"
      onClose={onClose}
      className="w-[min(640px,calc(100vw-2rem))]"
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="default"
            disabled={busy || !data}
            onClick={() => void apply()}
          >
            {paper.follow_source ? "应用更新" : "开启跟随并应用"}
          </Button>
        </>
      }
    >
      <Notice error={error || message} loading={!data} />
      {data?.length === 0 && (
        <p className="text-[13.5px] text-muted-foreground">来源内容没有变化。</p>
      )}
      {data?.map((diff, i) => (
        <section
          key={diff.item_id}
          className="space-y-3 rounded-lg border border-border bg-muted/30 p-3.5"
        >
          <h3 className="m-0 text-[14px] font-semibold">
            变更题目 {i + 1}
            {diff.source_invalid ? " · 来源已失效" : ""}
          </h3>
          {Object.entries(diff.changes).map(([key, change]) => (
            <div key={key} className="space-y-1.5">
              <div className="text-[12.5px] font-semibold text-muted-foreground">
                {fields[key] ?? key}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-card p-2.5 text-[13px]">
                  <p className="mb-1 text-[11.5px] font-medium text-muted-foreground">
                    当前内容
                  </p>
                  <Markdown text={value(change.before)} />
                </div>
                <div className="rounded-md border border-border bg-card p-2.5 text-[13px]">
                  <p className="mb-1 text-[11.5px] font-medium text-primary">
                    来源内容
                  </p>
                  <Markdown text={value(change.after)} />
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
    </Modal>
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
    <Modal
      title="导入预览"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="default"
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
        </>
      }
    >
      <Notice error={error || message} loading={!data && !error} />
      {data && (
        <div className="space-y-3">
          <h3 className="m-0 font-serif text-[18px] font-semibold">{data.name}</h3>
          {data.entity === "folder" ? (
            <p className="text-[13.5px] text-muted-foreground">
              {data.summary.folders} 个文件夹 · {data.summary.banks} 个题库 ·{" "}
              {data.summary.papers} 份套题 · {data.summary.questions} 道题目 ·{" "}
              {data.summary.attachments} 个附件
            </p>
          ) : (
            <>
              <p className="text-[13.5px] text-muted-foreground">
                {data.entity === "bank" ? "题库" : "套题"} ·{" "}
                {data.questions.length} 道题目 · {data.attachments.length}{" "}
                个附件
              </p>
              {data.description && <Markdown text={data.description} preview />}
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {data.questions.map((q) => (
                  <article
                    key={q.id}
                    className="rounded-md border border-border bg-muted/35 px-3 py-2 text-[13px]"
                  >
                    <Markdown text={q.content} preview />
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

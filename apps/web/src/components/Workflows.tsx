import { useEffect, useRef, useState } from "react";
import { client } from "../api/client.js";
import type { Paper, Tag, ComposerSection, ImportResult } from "../api/client.js";
import {
  Button,
  errorMessage,
  Facet,
  Modal,
  Notice,
  SearchField,
  types,
  useLoad,
} from "./ui.js";
import { Badge } from "./ui/badge.js";
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
      <div className="quarry-dialog-list max-h-72 space-y-1.5 overflow-y-auto">
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

type ImportState =
  | { status: "pending" | "importing" }
  | { status: "success"; result: ImportResult }
  | { status: "failure"; error: string };

const importStatuses = {
  pending: { label: "等待导入", variant: "secondary" },
  importing: { label: "校验并导入中", variant: "info" },
  success: { label: "导入成功", variant: "success" },
  failure: { label: "导入失败", variant: "destructive" },
} as const;

const importEntityNames = { bank: "题库", paper: "套题", folder: "文件夹" };

export function ImportDialog({
  files,
  folderId,
  onClose,
  onSaved,
}: {
  files: File[];
  folderId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [states, setStates] = useState<ImportState[]>(() => files.map(() => ({ status: "pending" })));
  const started = useRef(false);
  useEffect(() => {
    // A repeated effect must not write the same files again.
    if (started.current) return;
    started.current = true;

    function update(index: number, state: ImportState) {
      setStates((current) => current.map((entry, i) => i === index ? state : entry));
    }

    async function importFiles() {
      for (const [index, file] of files.entries()) {
        update(index, { status: "importing" });
        try {
          const result = await client.backup.importCommit(file, folderId);
          update(index, { status: "success", result });
        } catch (error) {
          update(index, { status: "failure", error: errorMessage(error) });
        }
      }
    }

    void importFiles();
  }, [files, folderId]);

  const finished = states.every(({ status }) => status === "success" || status === "failure");
  return (
    <Modal
      title="导入文件"
      onClose={onClose}
      dismissible={false}
      actions={
        <Button disabled={!finished} onClick={() => {
          onSaved();
          onClose();
        }}>
          完成
        </Button>
      }
    >
      <ul className="quarry-dialog-list max-h-80 space-y-2 overflow-y-auto" aria-live="polite">
        {states.map((state, index) => {
          const { name } = files[index]!;
          const { label, variant } = importStatuses[state.status];
          return (
            <li key={index} className="space-y-2 rounded-md border border-border px-3 py-2.5 wrap-anywhere">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-medium">{name}</span>
                <Badge variant={variant}>{label}</Badge>
              </div>
              {state.status === "success" && (
                <p className="m-0 text-muted-foreground">
                  {state.result.name} · {importEntityNames[state.result.entity]} · {state.result.imported_count} 道题目
                </p>
              )}
              {state.status === "failure" && <Notice error={state.error} loading={false} />}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

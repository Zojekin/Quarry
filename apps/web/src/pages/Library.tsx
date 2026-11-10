import { useState } from "react";
import { client } from "../api/client.js";
import type { Document, Paper, QuestionView } from "../api/client.js";
import type { Route } from "../state.js";
import {
  Button,
  Facet,
  Notice,
  types,
  useLoad,
  useViewState,
} from "../components/ui.js";
import { QuestionEditor, TagPills } from "../components/QuestionEditor.js";
import {
  DocumentEditor,
  ComposerEditor,
} from "../components/DocumentEditor.js";
import {
  FollowDialog,
  QuestionPicker,
  ImportDialog,
} from "../components/Workflows.js";
import { Markdown } from "../components/Markdown.js";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Library({
  folder,
  navigate,
  search,
  setSearch,
}: {
  folder?: string;
  navigate: (r: Route) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        client.folders.list(),
        client.banks.list(),
        client.papers.list(),
        client.tags.list("file"),
      ]),
    [folder],
  );
  const [kinds, setKinds] = useViewState<string[] | undefined>(
    "kinds",
    undefined,
  );
  const [tags, setTags] = useViewState<string[] | undefined>("tags", undefined);
  const [grid, setGrid] = useViewState("grid", false);
  const [importFile, setImportFile] = useState<File>();
  const [message, setMessage] = useState("");
  async function action(task: () => Promise<unknown>) {
    try {
      await task();
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const [fileEditor, setFileEditor] = useState<{
    kind: "folders" | "banks" | "papers";
    document?: Document;
  }>();
  function create(kind: "folders" | "banks" | "papers") {
    setFileEditor({ kind });
  }
  const rows = data
    ? [
        ...data[0]
          .filter((d) => d.parent_id === (folder ?? null))
          .map((d) => ({ ...d, kind: "folders" as const })),
        ...data[1]
          .filter((d) => d.folder_id === (folder ?? null))
          .map((d) => ({ ...d, kind: "banks" as const })),
        ...data[2]
          .filter((d) => d.folder_id === (folder ?? null))
          .map((d) => ({ ...d, kind: "papers" as const })),
      ].filter(
        (d) =>
          d.name.includes(search) &&
          (d.kind === "folders" ||
            kinds === undefined ||
            kinds.includes(d.kind)) &&
          (tags === undefined || tags.some((t) => d.tag_ids.includes(t))),
      )
    : [];
  return (
    <>
      {importFile && (
        <ImportDialog
          file={importFile}
          onClose={() => setImportFile(undefined)}
          onSaved={reload}
        />
      )}
      <h1>资料库 {folder && data?.[0].find((f) => f.id === folder)?.name}</h1>
      <div className="toolbar">
        <Button onClick={() => navigate({ page: "library" })}>根目录</Button>
        {folder && (
          <Button
            onClick={() => {
              const parent = data?.[0].find((f) => f.id === folder)?.parent_id;
              navigate(
                parent ? { page: "library", id: parent } : { page: "library" },
              );
            }}
          >
            上级
          </Button>
        )}
        <Facet
          label="类型"
          options={[
            { id: "banks", name: "题库" },
            { id: "papers", name: "套题" },
          ]}
          value={kinds}
          onChange={setKinds}
        />
        <Facet
          label="文件标签"
          options={data?.[3] ?? []}
          value={tags}
          onChange={setTags}
        />
        <input
          className="search"
          aria-label="搜索资料库"
          placeholder="搜索名称"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={() => setGrid(!grid)}>{grid ? "列表" : "卡片"}</Button>
      </div>
      <div className="toolbar">
        {(["folders", "banks", "papers"] as const).map((kind, i) => (
          <Button key={kind} onClick={() => void create(kind)}>
            新建{["文件夹", "题库", "套题"][i]}
          </Button>
        ))}
        <label className="button">
          导入
          <input
            hidden
            type="file"
            accept=".json,.md,.quarry"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setImportFile(file);
            }}
          />
        </label>
      </div>
      <Notice error={error || message} loading={!data} />
      <div className={grid ? "document-grid" : "card"}>
        {rows.map((row) => (
          <article className="document-row" key={row.id}>
            <button
              className="document-title"
              onClick={() =>
                navigate({
                  page:
                    row.kind === "folders"
                      ? "library"
                      : row.kind === "banks"
                        ? "bank"
                        : "paper",
                  id: row.id,
                })
              }
            >
              {row.kind === "folders" ? "▱" : row.kind === "banks" ? "▤" : "▥"}{" "}
              {row.name}
            </button>
            <TagPills ids={row.tag_ids} tags={data?.[3] ?? []} />
            <Button
              onClick={() =>
                void action(async () =>
                  download(
                    await client.backup.export(
                      row.kind === "folders"
                        ? "folder"
                        : row.kind === "banks"
                          ? "bank"
                          : "paper",
                      row.id,
                    ),
                    `${row.name}.quarry`,
                  ),
                )
              }
            >
              导出
            </Button>
            <Button
              onClick={() => {
                setFileEditor({ kind: row.kind, document: row });
              }}
            >
              编辑属性
            </Button>
            <Button
              onClick={() => {
                if (
                  confirm(
                    row.kind === "folders"
                      ? "删除文件夹及其所有内容到回收站？"
                      : "移到回收站？",
                  )
                )
                  void action(() => client[row.kind].delete(row.id));
              }}
            >
              删除
            </Button>
          </article>
        ))}
        {data && !rows.length && <p>暂无内容</p>}
      </div>
      {fileEditor && (
        <DocumentEditor
          {...fileEditor}
          {...(folder ? { parent: folder } : {})}
          tags={data?.[3] ?? []}
          onClose={() => setFileEditor(undefined)}
          onSaved={reload}
        />
      )}
    </>
  );
}
export function Detail({
  id,
  paper,
  navigate,
}: {
  id: string;
  paper: boolean;
  navigate: (r: Route) => void;
}) {
  const { data, error, reload } = useLoad(async () => {
    const doc = paper
      ? await client.papers.get(id)
      : await client.banks.get(id);
    return {
      doc,
      questions: paper
        ? (doc as Paper).sections.flatMap((s) => s.items.map((i) => i.question))
        : await client.questions.list({ bank_id: id }),
      tags: await client.tags.list(),
    };
  }, [id, paper]);
  const [search, setSearch] = useViewState("search", "");
  const [filter, setFilter] = useViewState<string[] | undefined>(
    "filter",
    undefined,
  );
  const [tagFilter, setTagFilter] = useViewState<string[] | undefined>(
    "tagFilter",
    undefined,
  );
  const [editor, setEditor] = useState<QuestionView | null | undefined>();
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [reveal, setReveal] = useState(false);
  async function act(task: () => Promise<unknown>) {
    try {
      await task();
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const [fileEditor, setFileEditor] = useState(false);
  const [composer, setComposer] = useState(false);
  const [follow, setFollow] = useState(false);
  const [picker, setPicker] = useState(false);
  const questions =
    data?.questions.filter(
      (q) =>
        (filter === undefined || filter.includes(q.type)) &&
        (tagFilter === undefined ||
          tagFilter.some((t) => q.tag_ids.includes(t))) &&
        `${q.content} ${q.explanation}`.includes(search),
    ) ?? [];
  return (
    <>
      <Button
        onClick={() =>
          navigate({
            page: "library",
            ...(data?.doc.folder_id ? { id: data.doc.folder_id } : {}),
          })
        }
      >
        返回资料库
      </Button>
      <Notice error={error || message} loading={!data} />
      {data && (
        <>
          <h1>{data.doc.name}</h1>
          {follow && (
            <FollowDialog
              paper={data.doc as Paper}
              tags={data.tags}
              onClose={() => setFollow(false)}
              onSaved={reload}
            />
          )}
          {picker && (
            <QuestionPicker
              paperId={id}
              onClose={() => setPicker(false)}
              onSaved={reload}
            />
          )}
          {fileEditor && (
            <DocumentEditor
              kind={paper ? "papers" : "banks"}
              document={data.doc}
              tags={data.tags.filter((t) => t.target_type === "file")}
              onClose={() => setFileEditor(false)}
              onSaved={reload}
            />
          )}
          {composer && (
            <ComposerEditor
              paper={data.doc as Paper}
              onClose={() => setComposer(false)}
              onSaved={reload}
            />
          )}
          <Markdown text={data.doc.description} />
          {paper && (
            <dl className="properties">
              <dt>题数</dt>
              <dd>{data.questions.length}</dd>
              <dt>总分</dt>
              <dd>
                {data.questions.reduce(
                  (total, q) => total + (q.max_score ?? 0),
                  0,
                )}
              </dd>
              <dt>考试时间</dt>
              <dd>
                {(data.doc as Paper).time_limit_seconds
                  ? `${(data.doc as Paper).time_limit_seconds! / 60} 分钟`
                  : "不限时"}
              </dd>
              <dt>跟随状态</dt>
              <dd>
                {(data.doc as Paper).follow_source ? "跟随来源" : "独立副本"}
              </dd>
              <dt>最后修改</dt>
              <dd>{data.doc.updated_at}</dd>
            </dl>
          )}
          <TagPills ids={data.doc.tag_ids} tags={data.tags} />
          <div className="toolbar">
            <Button onClick={() => setFileEditor(true)}>编辑属性</Button>
            {paper && (
              <>
                <Button onClick={() => setComposer(true)}>编排与打乱</Button>
                <Button onClick={() => setPreview(!preview)}>预览</Button>
                {preview && (
                  <Button onClick={() => setReveal(!reveal)}>
                    {reveal ? "隐藏答案" : "显示答案"}
                  </Button>
                )}
                <Button
                  primary
                  onClick={() =>
                    void act(async () =>
                      navigate({
                        page: "study",
                        id: (await client.sessions.start(id, "practice")).id,
                      }),
                    )
                  }
                >
                  开始练习
                </Button>
                <Button
                  onClick={() =>
                    void act(async () =>
                      navigate({
                        page: "study",
                        id: (await client.sessions.start(id, "exam")).id,
                      }),
                    )
                  }
                >
                  开始考试
                </Button>
                <Button onClick={() => setFollow(true)}>
                  来源差异 / 开启跟随
                </Button>
                <Button
                  onClick={() =>
                    void act(() =>
                      client.papers.update(id, { follow_source: false }),
                    )
                  }
                >
                  停止跟随
                </Button>
                <Button onClick={() => setPicker(true)}>从题库选题</Button>
              </>
            )}
            <Button onClick={() => setEditor(null)}>＋ 新建题目</Button>
          </div>
          <div className="toolbar">
            <Facet
              label="题型"
              options={types}
              value={filter}
              onChange={setFilter}
            />
            <Facet
              label="题目标签"
              options={data.tags.filter((t) => t.target_type === "question")}
              value={tagFilter}
              onChange={setTagFilter}
            />
            <input
              className="search"
              placeholder="搜索题目"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {types.map((t) => {
            const qs = questions.filter((q) => q.type === t.id);
            return (
              qs.length > 0 && (
                <section key={t.id}>
                  <h2>
                    {t.name}（共{qs.length}题，
                    {qs.reduce((sum, q) => sum + (q.max_score ?? 0), 0)}分）
                  </h2>
                  {qs.map((q) => (
                    <article className="card question-preview" key={q.id}>
                      <Markdown text={q.content} />
                      <TagPills ids={q.tag_ids} tags={data.tags} />
                      {preview &&
                        q.options?.map((o) => (
                          <Markdown key={o.id} text={o.content} />
                        ))}
                      {(!preview || reveal) && (
                        <>
                          <Markdown
                            text={
                              q.reference_answer ??
                              q.options
                                ?.filter((o) => o.is_correct)
                                .map((o) => o.content)
                                .join("、") ??
                              q.blanks
                                ?.map((b) => b.valid_answers?.join(" / "))
                                .join("；") ??
                              ""
                            }
                          />
                          <Markdown text={q.explanation ?? ""} />
                        </>
                      )}
                      <div className="toolbar">
                        <Button onClick={() => setEditor(q)}>编辑</Button>
                        <Button
                          onClick={() => {
                            if (confirm("删除题目？"))
                              void act(() => client.questions.delete(q.id));
                          }}
                        >
                          删除
                        </Button>
                      </div>
                    </article>
                  ))}
                </section>
              )
            );
          })}
          {editor !== undefined && (
            <QuestionEditor
              availableTags={data.tags.filter(
                (t) => t.target_type === "question",
              )}
              {...(editor ? { question: editor } : {})}
              ownerId={id}
              paper={paper}
              onSaved={reload}
              onClose={() => setEditor(undefined)}
            />
          )}
        </>
      )}
    </>
  );
}

import { useState } from "react";
import { client } from "../api/client.js";
import type { Document, Folder, Paper, QuestionView } from "../api/client.js";
import type { Route } from "../state.js";
import {
  Breadcrumb,
  Button,
  EmptyState,
  IconButton,
  Modal,
  NavigationControls,
  type NavigationProps,
  SearchField,
  StatusPill,
  Facet,
  Notice,
  types,
  useLoad,
  useConfirmation,
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
import { Icon } from "../components/Icons.js";
import { QuestionPreview } from "../components/QuestionPreview.js";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileKinds = {
  folders: {
    label: "文件夹",
    icon: "folder",
    entity: "folder",
    page: "library",
  },
  banks: { label: "题库", icon: "library", entity: "bank", page: "bank" },
  papers: { label: "套题", icon: "paper", entity: "paper", page: "paper" },
} as const;

function folderTrail(
  folders: Folder[],
  id: string | null | undefined,
  navigate: (r: Route) => void,
) {
  const seen = new Set<string>();
  const trail = [];
  let folder = folders.find((item) => item.id === id);
  while (folder && !seen.has(folder.id)) {
    const { id, name, parent_id } = folder;
    seen.add(id);
    trail.unshift({
      label: name,
      onClick: () => navigate({ page: "library", id }),
    });
    folder = folders.find((item) => item.id === parent_id);
  }
  return [
    { label: "资料库", onClick: () => navigate({ page: "library" }) },
    ...trail,
  ];
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("zh-CN");
}

export function Library({
  folder,
  navigate,
  navigation,
  search,
  setSearch,
}: {
  folder?: string;
  navigation: NavigationProps;
  navigate: (r: Route) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const confirmation = useConfirmation();
  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        client.folders.list(),
        client.banks.list(),
        client.papers.list(),
        client.tags.list("file"),
        client.questions.list(),
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
  const bankCounts = new Map<string, number>();
  for (const question of data?.[4] ?? []) {
    if (question.owner_type === "question_bank") {
      bankCounts.set(
        question.owner_id,
        (bankCounts.get(question.owner_id) ?? 0) + 1,
      );
    }
  }
  const rows = data
    ? [
        ...data[0]
          .filter((d) => d.parent_id === (folder ?? null))
          .map((d) => ({ ...d, kind: "folders" as const, count: null })),
        ...data[1]
          .filter((d) => d.folder_id === (folder ?? null))
          .map((d) => ({
            ...d,
            kind: "banks" as const,
            count: bankCounts.get(d.id) ?? 0,
          })),
        ...data[2]
          .filter((d) => d.folder_id === (folder ?? null))
          .map((d) => ({
            ...d,
            kind: "papers" as const,
            count: d.sections.reduce(
              (sum, section) => sum + section.items.length,
              0,
            ),
          })),
      ].filter(
        (d) =>
          d.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
          (kinds === undefined || kinds.includes(d.kind)) &&
          (tags === undefined || tags.some((t) => d.tag_ids.includes(t))),
      )
    : [];
  const currentFolder = data?.[0].find((item) => item.id === folder);
  const trail = folderTrail(data?.[0] ?? [], folder, navigate);
  const breadcrumb = [...trail.slice(0, -1), { label: trail.at(-1)!.label }];
  function rowActions(row: (typeof rows)[number]) {
    const { entity } = fileKinds[row.kind];
    return (
      <div className="row-actions">
        <IconButton
          icon="pencil"
          label={`编辑${row.name}属性`}
          onClick={() => setFileEditor({ kind: row.kind, document: row })}
        />
        <IconButton
          icon="export"
          label={`导出${row.name}`}
          onClick={() =>
            void action(async () =>
              download(
                await client.backup.export(entity, row.id),
                `${row.name}.quarry`,
              ),
            )
          }
        />
        <IconButton
          icon="trash"
          className="danger"
          label={`删除${row.name}`}
          onClick={() =>
            confirmation.ask(
              row.kind === "folders"
                ? "删除文件夹及其所有内容到回收站？"
                : "移到回收站？",
              () => void action(() => client[row.kind].delete(row.id)),
            )
          }
        />
      </div>
    );
  }
  function openFile(row: (typeof rows)[number]) {
    navigate({ page: fileKinds[row.kind].page, id: row.id });
  }
  return (
    <>
      <div className="detail-navigation">
        <NavigationControls {...navigation} />
        <Breadcrumb items={breadcrumb} />
      </div>
      <div className="page-heading library-heading">
        <h1>{currentFolder?.name ?? "所有资料"}</h1>
        <div className="actions">
          <label className="button file-input-button">
            导入文件
            <input
              type="file"
              accept=".json,.md,.quarry"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) setImportFile(file);
              }}
            />
          </label>
          <details className="menu-wrap">
            <summary className="button primary">＋ 新建</summary>
            <div
              className="menu"
              onClick={(event) => {
                const menu = event.currentTarget.closest("details");
                if (menu) menu.open = false;
              }}
            >
              {(["folders", "banks", "papers"] as const).map((kind) => (
                <Button key={kind} onClick={() => create(kind)}>
                  新建{fileKinds[kind].label}
                </Button>
              ))}
            </div>
          </details>
        </div>
      </div>
      <section className="library-content">
        <div className="toolbar library-toolbar">
          <div className="library-filter-cards">
            <Facet
              label="类型"
              options={[
                { id: "folders", name: "文件夹" },
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
          </div>
          <div className="actions">
            <SearchField
              label="搜索资料库"
              placeholder="搜索名称"
              value={search}
              onChange={setSearch}
            />
            <IconButton
              icon={grid ? "list" : "grid"}
              label={grid ? "列表视图" : "图标视图"}
              className="hover-only"
              onClick={() => setGrid(!grid)}
            />
          </div>
        </div>
        <Notice error={error || message} loading={!data} />
        {data &&
          (rows.length === 0 ? (
            <EmptyState
              title="没有符合条件的资料"
              detail="更换标签或搜索条件，或新建资料。"
            />
          ) : grid ? (
            <div className="document-grid">
              {rows.map((row) => (
                <article className="card document-card" key={row.id}>
                  <button
                    type="button"
                    className="document-open"
                    aria-label={row.name}
                    onClick={() => openFile(row)}
                  >
                    <span className="file-symbol">
                      <Icon name={fileKinds[row.kind].icon} />
                    </span>
                    <h3>{row.name}</h3>
                    <div className="meta">
                      <span>{fileKinds[row.kind].label}</span>
                      {row.count !== null && <span>{row.count} 题</span>}
                    </div>
                  </button>
                  <TagPills ids={row.tag_ids} tags={data[3]} chips />
                  {rowActions(row)}
                </article>
              ))}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>题目</th>
                  <th className="optional">文件标签</th>
                  <th className="optional">修改日期</th>
                  <th className="file-action-column">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="file-name"
                        onClick={() => openFile(row)}
                      >
                        <span className="file-symbol">
                          <Icon name={fileKinds[row.kind].icon} />
                        </span>
                        <strong>{row.name}</strong>
                      </button>
                    </td>
                    <td className="muted">{fileKinds[row.kind].label}</td>
                    <td>{row.count ?? "—"}</td>
                    <td className="optional">
                      <TagPills ids={row.tag_ids} tags={data[3]} chips />
                    </td>
                    <td className="optional muted">
                      {dateLabel(row.updated_at)}
                    </td>
                    <td>{rowActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        {data && <div className="table-footer">{rows.length} 个项目</div>}
      </section>
      {importFile && (
        <ImportDialog
          file={importFile}
          onClose={() => setImportFile(undefined)}
          onSaved={reload}
        />
      )}
      {fileEditor && (
        <DocumentEditor
          {...fileEditor}
          {...(folder ? { parent: folder } : {})}
          tags={data?.[3] ?? []}
          onClose={() => setFileEditor(undefined)}
          onSaved={reload}
        />
      )}
      {confirmation.dialog}
    </>
  );
}

export function Detail({
  id,
  paper,
  navigate,
  navigation,
}: {
  id: string;
  paper: boolean;
  navigate: (r: Route) => void;
  navigation: NavigationProps;
}) {
  const confirmation = useConfirmation();
  const { data, error, reload } = useLoad(async () => {
    const [doc, folders, tags, sessions] = await Promise.all([
      paper ? client.papers.get(id) : client.banks.get(id),
      client.folders.list(),
      client.tags.list(),
      paper ? client.sessions.list() : [],
    ]);
    return {
      doc,
      folders,
      tags,
      ongoing: sessions.find(
        (session) => session.paper_id === id && session.status !== "completed",
      ),
      questions: paper
        ? (doc as Paper).sections.flatMap((section) =>
            section.items.map((item) => item.question),
          )
        : await client.questions.list({ bank_id: id }),
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
  const [preview, setPreview] = useState<QuestionView[]>();
  const [reveal, setReveal] = useState(false);
  const [fileEditor, setFileEditor] = useState(false);
  const [composer, setComposer] = useState(false);
  const [follow, setFollow] = useState(false);
  const [picker, setPicker] = useState(false);
  async function act(task: () => Promise<unknown>) {
    try {
      await task();
      reload();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  const questionTags =
    data?.tags.filter((tag) => tag.target_type === "question") ?? [];
  const questions =
    data?.questions.filter(
      (question) =>
        (paper || filter === undefined || filter.includes(question.type)) &&
        (paper ||
          tagFilter === undefined ||
          tagFilter.some((tag) => question.tag_ids.includes(tag))) &&
        `${question.content} ${question.explanation ?? ""}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ) ?? [];
  const paperDocument = paper ? (data?.doc as Paper | undefined) : undefined;
  const questionNumbers = new Map(
    data?.questions.map((question, index) => [question.id, index + 1]),
  );
  const visibleQuestions = new Set(questions.map((question) => question.id));
  function showPreview(items: QuestionView[]) {
    setReveal(false);
    setPreview(items);
  }
  function rowActions(question: QuestionView) {
    return (
      <>
        <IconButton
          icon="eye"
          label="预览题目"
          onClick={() => showPreview([question])}
        />
        <IconButton
          icon="pencil"
          label="编辑题目"
          onClick={() => setEditor(question)}
        />
        <IconButton
          icon="trash"
          label="删除题目"
          className="danger"
          onClick={() =>
            confirmation.ask(
              "删除题目？",
              () => void act(() => client.questions.delete(question.id)),
            )
          }
        />
      </>
    );
  }
  function start(mode: "practice" | "exam") {
    void act(async () =>
      navigate({
        page: "study",
        id: (await client.sessions.start(id, mode)).id,
      }),
    );
  }
  return (
    <>
      <div className="detail-navigation">
        <NavigationControls {...navigation} />
        <Breadcrumb
          items={[
            ...folderTrail(data?.folders ?? [], data?.doc.folder_id, navigate),
            ...(data ? [{ label: data.doc.name }] : []),
          ]}
        />
        {paperDocument && (
          <div className="actions">
            <Button onClick={() => showPreview(data!.questions)}>
              预览题目
            </Button>
            <Button onClick={() => setComposer(true)}>编排与打乱</Button>
            <Button onClick={() => setFileEditor(true)}>编辑属性</Button>
          </div>
        )}
      </div>
      <Notice error={error || message} loading={!data} />
      {data &&
        (paperDocument ? (
          <section className="paper-detail">
            <div className="paper-title-row">
              <h1 className="detail-title">{data.doc.name}</h1>
            </div>
            <div className="description">
              <Markdown text={data.doc.description} />
            </div>
            <dl className="paper-property-list">
              <div>
                <dt>题目数量</dt>
                <dd>{data.questions.length} 题</dd>
              </div>
              <div>
                <dt>总分</dt>
                <dd>
                  {data.questions.reduce(
                    (sum, question) => sum + (question.max_score ?? 0),
                    0,
                  )}{" "}
                  分
                </dd>
              </div>
              <div>
                <dt>考试时间</dt>
                <dd>
                  {paperDocument.time_limit_seconds
                    ? `${paperDocument.time_limit_seconds / 60} 分钟`
                    : "不限时"}
                </dd>
              </div>
              <div>
                <dt>跟随来源题库</dt>
                <dd>
                  <StatusPill
                    state={paperDocument.follow_source ? "enabled" : "disabled"}
                  >
                    {paperDocument.follow_source ? "已开启" : "未开启"}
                  </StatusPill>
                </dd>
              </div>
              <div>
                <dt>最后修改</dt>
                <dd>{dateLabel(data.doc.updated_at)}</dd>
              </div>
              <div>
                <dt>标签</dt>
                <dd className="actions">
                  {data.doc.tag_ids.length ? (
                    <TagPills ids={data.doc.tag_ids} tags={data.tags} />
                  ) : (
                    <span className="muted">暂无标签</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="study-start-row">
              <div className="actions">
                <Button primary onClick={() => start("practice")}>
                  开始练习
                </Button>
                <Button onClick={() => start("exam")}>开始考试</Button>
                {data.ongoing && (
                  <Button
                    className="quiet"
                    onClick={() =>
                      navigate({ page: "study", id: data.ongoing!.id })
                    }
                  >
                    继续未完成答题 <Icon name="forward" />
                  </Button>
                )}
                <Button className="quiet" onClick={() => setFollow(true)}>
                  来源差异 / 开启跟随
                </Button>
                {paperDocument.follow_source && (
                  <Button
                    className="quiet"
                    onClick={() =>
                      void act(() =>
                        client.papers.update(id, { follow_source: false }),
                      )
                    }
                  >
                    停止跟随
                  </Button>
                )}
              </div>
              <p className="muted small">
                练习确认后查看解析，考试交卷前可修改答案。
              </p>
            </div>
            <div className="section-head paper-question-heading">
              <h2>题目组成</h2>
              <div className="actions paper-question-tools">
                <SearchField
                  label="搜索题目"
                  value={search}
                  onChange={setSearch}
                />
                <details className="menu-wrap">
                  <summary
                    className="button paper-new-question"
                    aria-label="添加题目"
                  >
                    ＋
                  </summary>
                  <div
                    className="menu"
                    onClick={(event) => {
                      const menu = event.currentTarget.closest("details");
                      if (menu) menu.open = false;
                    }}
                  >
                    <Button onClick={() => setEditor(null)}>新建题目</Button>
                    <Button onClick={() => setPicker(true)}>从题库选题</Button>
                  </div>
                </details>
              </div>
            </div>
            {paperDocument.sections.map((section) => {
              const items = section.items.filter((item) =>
                visibleQuestions.has(item.question.id),
              );
              if (!items.length) return null;
              const title =
                section.title && section.title !== section.question_type
                  ? section.title
                  : (types.find((type) => type.id === section.question_type)
                      ?.name ?? section.question_type);
              return (
                <section className="paper-question-group" key={section.id}>
                  <h3 className="question-group-heading">
                    {title}（共{items.length}题，
                    {items.reduce(
                      (sum, item) => sum + (item.question.max_score ?? 0),
                      0,
                    )}
                    分）
                  </h3>
                  {items.map(({ id, question }) => (
                    <div className="question-item" key={id}>
                      <span className="question-number">
                        {String(questionNumbers.get(question.id)).padStart(
                          2,
                          "0",
                        )}
                      </span>
                      <div>
                        <Markdown text={question.content} />
                        <div className="small muted">
                          {
                            types.find((type) => type.id === question.type)
                              ?.name
                          }{" "}
                          ·{" "}
                          {question.max_score
                            ? `${question.max_score}分`
                            : "不自动判分"}
                        </div>
                        <TagPills ids={question.tag_ids} tags={questionTags} />
                      </div>
                      <div className="actions question-item-actions">
                        {rowActions(question)}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
            {!questions.length && (
              <EmptyState
                title="没有符合条件的题目"
                detail="更换搜索关键词，或点击加号新建题目。"
              />
            )}
          </section>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <h1>{data.doc.name}</h1>
                <Markdown text={data.doc.description} />
                <TagPills ids={data.doc.tag_ids} tags={data.tags} />
              </div>
              <div className="actions">
                <Button
                  onClick={() =>
                    void act(async () =>
                      download(
                        await client.backup.export("bank", id),
                        `${data.doc.name}.quarry`,
                      ),
                    )
                  }
                >
                  导出
                </Button>
                <Button onClick={() => setFileEditor(true)}>编辑属性</Button>
                <Button primary onClick={() => setEditor(null)}>
                  新增题目
                </Button>
              </div>
            </div>
            <div className="toolbar bank-filter-toolbar">
              <div className="library-filter-cards">
                <Facet
                  label="题型"
                  options={types}
                  value={filter}
                  onChange={setFilter}
                />
                <Facet
                  label="题目标签"
                  options={questionTags}
                  value={tagFilter}
                  onChange={setTagFilter}
                />
              </div>
              <SearchField
                label="搜索题目"
                placeholder="搜索题干"
                value={search}
                onChange={setSearch}
              />
            </div>
            {questions.length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>题目</th>
                    <th>题型</th>
                    <th className="optional">题目标签</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question) => (
                    <tr key={question.id}>
                      <td>
                        <div className="question-row-title">
                          <Markdown text={question.content} />
                        </div>
                      </td>
                      <td className="muted">
                        {types.find((type) => type.id === question.type)?.name}
                      </td>
                      <td className="optional">
                        <TagPills ids={question.tag_ids} tags={questionTags} />
                      </td>
                      <td>
                        <div className="row-actions">
                          {rowActions(question)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="没有符合条件的题目"
                detail="调整筛选条件或新增题目。"
              />
            )}
            <div className="table-footer">共 {questions.length} 道题目</div>
          </>
        ))}
      {preview && (
        <Modal
          title="题目预览"
          onClose={() => setPreview(undefined)}
          actions={
            <Button onClick={() => setReveal(!reveal)}>
              {reveal ? "隐藏答案" : "显示答案"}
            </Button>
          }
        >
          {preview.map((question) => (
            <section className="preview-question" key={question.id}>
              <QuestionPreview question={question} reveal={reveal} />
            </section>
          ))}
        </Modal>
      )}
      {data && fileEditor && (
        <DocumentEditor
          kind={paper ? "papers" : "banks"}
          document={data.doc}
          tags={data.tags.filter((tag) => tag.target_type === "file")}
          onClose={() => setFileEditor(false)}
          onSaved={reload}
        />
      )}
      {paperDocument && composer && (
        <ComposerEditor
          paper={paperDocument}
          onClose={() => setComposer(false)}
          onSaved={reload}
        />
      )}
      {paperDocument && follow && (
        <FollowDialog
          paper={paperDocument}
          tags={data!.tags}
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
      {editor !== undefined && (
        <QuestionEditor
          availableTags={questionTags}
          {...(editor ? { question: editor } : {})}
          ownerId={id}
          paper={paper}
          onSaved={reload}
          onClose={() => setEditor(undefined)}
        />
      )}
      {confirmation.dialog}
    </>
  );
}

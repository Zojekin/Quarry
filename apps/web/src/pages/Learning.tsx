import { useEffect, useRef, useState, type CSSProperties } from "react";
import { client } from "../api/client.js";
import type {
  Query,
  QuestionView,
  Session,
  StudyAnswer,
  Tag,
} from "../api/client.js";
import type { Route } from "../state.js";
import { formatTime } from "../state.js";
import logoUrl from "../assets/logo.svg";
import {
  Button,
  EmptyState,
  SearchField,
  StatusPill,
  tagBackground,
  tagColorStyle,
  Facet,
  Notice,
  PromptDialog,
  types,
  useLoad,
  useViewState,
  useConfirmation,
} from "../components/ui.js";
import { Markdown } from "../components/Markdown.js";
import { hasAnswer } from "./Study.js";
import { QuestionPreview } from "../components/QuestionPreview.js";
import { TagPills } from "../components/QuestionEditor.js";
import { Icon } from "../components/Icons.js";
import { download } from "./Library.js";

function compareSessions(a: Session, b: Session) {
  return (
    b.start_time.localeCompare(a.start_time) ||
    a.mode.localeCompare(b.mode) ||
    a.id.localeCompare(b.id)
  );
}

function sessionProgress(session: Session) {
  return new Set([
    ...session.records.map((record) => record.question_id),
    ...Object.entries(session.draft_answers)
      .filter(([, answer]) => hasAnswer(answer))
      .map(([id]) => id),
  ]).size;
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="tabs segmented" role="group" aria-label={label}>
      {options.map(([key, name]) => (
        <button
          type="button"
          className={`button tab ${key === value ? "active" : ""}`}
          key={key}
          aria-pressed={key === value}
          onClick={() => onChange(key)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

export function Home({ navigate }: { navigate: (r: Route) => void }) {
  const { data, error } = useLoad(
    () =>
      Promise.all([
        client.analytics.getDashboard(),
        client.sessions.list(),
        client.papers.list(),
        client.mistakes.list(),
      ]),
    [],
  );
  const [metric, setMetric] = useViewState("metric", "count");
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useViewState("year", currentYear);
  const seconds = data?.[0].total_duration_seconds ?? 0;
  const pending =
    data?.[1]
      .filter((session) => session.status !== "completed")
      .sort(compareSessions) ?? [];
  const reviewing =
    data?.[3].filter((mistake) => mistake.mastery_status === "reviewing") ?? [];
  const entries = new Map(
    data?.[0].daily_heatmap.map((entry) => [entry.date, entry]),
  );
  const metricKey =
    metric === "duration_seconds" ? "duration_seconds" : "count";
  const peak = Math.max(
    1,
    ...(data?.[0].daily_heatmap
      .filter((entry) => entry.date.startsWith(`${year}-`))
      .map((entry) => entry[metricKey]) ?? []),
  );
  const today = new Date();
  const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const firstDay = (new Date(Date.UTC(year, 0, 1)).getUTCDay() + 6) % 7;
  const yearLength =
    (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
  const offset = Math.min(firstDay, 371 - yearLength);
  return (
    <>
      <div className="home-title-row">
        <h1 className="home-heading">学习概览</h1>
      </div>
      <Notice error={error} loading={!data} />
      {data && (
        <>
          <div className="metric-row">
            <div className="metric">
              <span className="label">累计用时</span>
              <div className="big-number" data-dynamic-date="duration">
                {Math.floor(seconds / 3600)}
                <span className="unit">时</span>
                {Math.floor((seconds % 3600) / 60)}
                <span className="unit">分</span>
              </div>
            </div>
            <div className="metric">
              <span className="label">累计答题</span>
              <div className="big-number">
                {data[0].total_questions_answered.toLocaleString()}
                <span className="unit">次</span>
              </div>
            </div>
            <div className="metric">
              <span className="label">去重题数</span>
              <div className="big-number">
                {data[0].deduplicated_questions_count.toLocaleString()}
                <span className="unit">题</span>
              </div>
            </div>
          </div>
          <div className="home-middle">
            <section>
              <div className="section-head">
                <h2>接着上次的学习</h2>
                <span className="muted small">
                  {pending.length} 份未完成套题
                </span>
              </div>
              <div className="paper-grid">
                {pending.map((session) => {
                  const count = sessionProgress(session);
                  const progress = session.items.length
                    ? Math.round((count / session.items.length) * 100)
                    : 0;
                  return (
                    <article className="card paper-card" key={session.id}>
                      <div className="card-meta">
                        <span>{session.mode === "exam" ? "考试" : "练习"}</span>
                        <span>
                          {session.status === "paused" ? "已暂停" : "进行中"}
                        </span>
                      </div>
                      <h3>
                        {session.paper_name ??
                          data[2].find((paper) => paper.id === session.paper_id)
                            ?.name ??
                          "历史套题"}
                      </h3>
                      <div className="paper-progress">
                        <span>
                          <strong>{count}</strong> / {session.items.length} 题
                        </span>
                        <span>已答 {progress}%</span>
                      </div>
                      <div className="progress" aria-hidden="true">
                        <i
                          style={
                            { "--progress": progress + "%" } as CSSProperties
                          }
                        />
                      </div>
                      <div className="card-bottom">
                        <span data-dynamic-date="duration">
                          已用时{" "}
                          {formatTime(session.effective_duration_seconds)}
                        </span>
                        <Button
                          primary
                          onClick={() =>
                            navigate({ page: "study", id: session.id })
                          }
                        >
                          继续作答
                        </Button>
                      </div>
                    </article>
                  );
                })}
                {!pending.length && (
                  <article className="card">
                    <h3>准备好新的练习</h3>
                    <p className="muted space-y-6">
                      从资料库挑选一份套题，开始学习。
                    </p>
                    <Button
                      primary
                      onClick={() => navigate({ page: "library" })}
                    >
                      打开资料库
                    </Button>
                  </article>
                )}
              </div>
            </section>
            <section className="home-review">
              <h2>复习错题</h2>
              <div className="big-number">
                {reviewing.length}
                <span className="unit">题待复习</span>
              </div>
              {types.map(({ id, name }) => {
                const count = reviewing.filter(
                  (mistake) => mistake.question_snapshot.type === id,
                ).length;
                return count ? (
                  <div className="subject-row" key={id}>
                    <span>{name}</span>
                    <span className="serif">{count}</span>
                  </div>
                ) : null;
              })}
              <button
                type="button"
                className="review-action"
                onClick={() => navigate({ page: "mistakes" })}
              >
                去错题本选题 <Icon name="forward" />
              </button>
            </section>
          </div>
          <section className="activity">
            <div className="section-head">
              <div className="activity-title">
                <h2>日积月累</h2>
                <select
                  className="filter"
                  aria-label="年份"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                >
                  {Array.from(
                    new Set([
                      year,
                      ...Array.from(
                        { length: 8 },
                        (_, index) => currentYear - index,
                      ),
                    ]),
                  )
                    .sort((a, b) => b - a)
                    .map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                </select>
              </div>
              <Segmented
                label="活动统计口径"
                options={[
                  ["count", "作答量"],
                  ["duration_seconds", "用时"],
                ]}
                value={metric}
                onChange={setMetric}
              />
            </div>
            <div className="heat-months">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index}>{index + 1}月</span>
              ))}
            </div>
            <div className="heat-grid" aria-label="全年学习活动">
              {Array.from({ length: 371 }, (_, index) => {
                const day = new Date(Date.UTC(year, 0, 1 - offset + index));
                const date = day.toISOString().slice(0, 10);
                const entry = entries.get(date);
                const future = date > todayLabel;
                const outside = day.getUTCFullYear() !== year;
                const level = Math.min(
                  4,
                  Math.ceil(((entry?.[metricKey] ?? 0) / peak) * 4),
                );
                return (
                  <i
                    key={date}
                    className={future ? "future" : `lv${level}`}
                    data-outside-year={outside ? "" : undefined}
                    title={
                      future
                        ? `${date} · 尚未到来`
                        : `${date} · ${entry?.count ?? 0} 题 · ${formatTime(entry?.duration_seconds ?? 0)}`
                    }
                  />
                );
              })}
            </div>
            <div className="legend">
              <span>少</span>
              <i className="legend-level-1" />
              <i className="legend-level-2" />
              <i className="legend-level-3" />
              <i />
              <span>
                多　{metric === "count" ? "按作答量着色" : "按用时着色"}
                　未到日期为空心格
              </span>
            </div>
            <div className="align-end space-top-6">
              <Button
                className="quiet"
                onClick={() => navigate({ page: "records" })}
              >
                学习记录 ↗
              </Button>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function Records({ navigate }: { navigate: (r: Route) => void }) {
  const { data, error } = useLoad(
    () => Promise.all([client.sessions.list(), client.papers.list()]),
    [],
  );
  const [status, setStatus] = useViewState("status", "all");
  const [mode, setMode] = useViewState<string[] | undefined>("mode", undefined);
  const [search, setSearch] = useViewState("search", "");
  const rows =
    data?.[0]
      .map((session) => ({
        session,
        name:
          session.paper_name ??
          data[1].find((paper) => paper.id === session.paper_id)?.name ??
          "历史套题",
      }))
      .filter(
        ({ session, name }) =>
          (status === "all" ||
            (status === "completed"
              ? session.status === "completed"
              : session.status !== "completed")) &&
          (mode === undefined || mode.includes(session.mode)) &&
          name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      )
      .sort((a, b) => compareSessions(a.session, b.session)) ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>学习记录</h1>
          <p>每一次作答，都留下清晰的记录。</p>
        </div>
      </div>
      <div className="toolbar learning-toolbar">
        <Segmented
          label="记录筛选"
          options={[
            ["all", "全部记录"],
            ["pending", "未完成"],
            ["completed", "已完成"],
          ]}
          value={status}
          onChange={setStatus}
        />
        <div className="actions">
          <Facet
            label="答题模式"
            options={[
              { id: "practice", name: "练习" },
              { id: "exam", name: "考试" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <SearchField
            label="搜索记录"
            placeholder="搜索套题名称"
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>
      <Notice error={error} loading={!data} />
      {data &&
        (rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>套题</th>
                <th>模式</th>
                <th>作答进度</th>
                <th>状态</th>
                <th className="optional">用时</th>
                <th className="optional">开始日期</th>
                <th className="file-action-column">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ session, name }) => (
                <tr key={session.id}>
                  <td className="text-medium">{name}</td>
                  <td>
                    <span className="pill mode-pill">
                      {session.mode === "exam" ? "考试" : "练习"}
                    </span>
                  </td>
                  <td>
                    {sessionProgress(session)} / {session.items.length}
                  </td>
                  <td>
                    <StatusPill state={session.status}>
                      {session.status === "completed"
                        ? "已完成"
                        : session.status === "paused"
                          ? "已暂停"
                          : "进行中"}
                    </StatusPill>
                  </td>
                  <td className="optional muted">
                    <span data-dynamic-date="duration">
                      {formatTime(session.effective_duration_seconds)}
                    </span>
                  </td>
                  <td className="optional muted">
                    <time dateTime={session.start_time} data-dynamic-date="date">
                      {new Date(session.start_time).toLocaleDateString("zh-CN")}
                    </time>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button
                        className="quiet"
                        onClick={() =>
                          navigate({
                            page:
                              session.status === "completed" ? "result" : "study",
                            id: session.id,
                          })
                        }
                      >
                        {session.status === "completed" ? "查看结果" : "继续作答"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="暂无符合条件的记录"
            detail="从资料库选择套题开始一次练习。"
          />
        ))}
    </>
  );
}
function answerLabel(answer: StudyAnswer, question: QuestionView) {
  if (answer.kind === "choice") {
    return question.options
      ?.filter((option) => answer.option_ids.includes(option.id))
      .map((option) => option.content)
      .join("；");
  }
  return answer.kind === "blanks" ? answer.values.join("；") : answer.value;
}

export function Mistakes({
  navigate,
  onMasteryChanged,
}: {
  navigate: (r: Route) => void;
  onMasteryChanged?: () => void;
}) {
  const [namingPaper, setNamingPaper] = useState(false);
  const [query, setQuery] = useViewState<Query>("query", {
    mastery_status: "reviewing",
  });
  const {
    data: visible,
    error,
    reload,
  } = useLoad(() => client.mistakes.list(query), [JSON.stringify(query)]);
  const catalog = useLoad(
    () =>
      Promise.all([
        client.papers.list(),
        client.folders.list(),
        client.tags.list("question"),
        client.mistakes.list(),
      ]),
    [],
  );
  const [selected, setSelected] = useViewState<string[]>("selected", []);
  const [inspectId, setInspectId] = useViewState<string | undefined>(
    "inspected-mistake",
    undefined,
  );
  const [message, setMessage] = useState("");
  const [dateFrom, setDateFrom] = useState(String(query.date_from ?? ""));
  const [dateTo, setDateTo] = useState(String(query.date_to ?? ""));
  const [dateError, setDateError] = useState("");
  const dateFilter = useRef<HTMLDetailsElement>(null);
  const inspect =
    visible?.find((item) => item.id === inspectId) ?? visible?.[0];
  useEffect(() => {
    if (visible)
      setSelected((ids) =>
        ids.filter((id) => visible.some((item) => item.id === id)),
      );
  }, [visible]);
  function facet(
    key: string,
    label: string,
    options: { id: string; name: string }[],
  ) {
    return (
      <Facet
        label={label}
        options={options}
        value={query[key] as string[] | undefined}
        onChange={(value) => setQuery({ ...query, [key]: value })}
      />
    );
  }
  function applyDate(start: string, end: string) {
    if (start && end && start > end) {
      setDateError("开始日期不能晚于结束日期。");
      return;
    }
    setQuery({
      ...query,
      date_from: start || undefined,
      date_to: end || undefined,
    });
    setDateFrom(start);
    setDateTo(end);
    setDateError("");
    if (dateFilter.current) dateFilter.current.open = false;
  }
  async function act(task: () => Promise<unknown>) {
    try {
      await task();
      reload();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  const [papers = [], folders = [], tags = [], all = []] = catalog.data ?? [];
  return (
    <>
      <div className="mistake-page-heading">
        <div>
          <h1>错题本</h1>
          <p className="muted small">查看错题、错误历史与掌握状态。</p>
        </div>
        <div className="mistake-summary">
          <span>
            <b>
              {all.filter((item) => item.mastery_status === "reviewing").length}
            </b>
            待复习
          </span>
          <span>
            <b>
              {all.filter((item) => item.mastery_status === "mastered").length}
            </b>
            已掌握
          </span>
          <span>
            <b>{all.length}</b>累计收录
          </span>
        </div>
        <div className="actions">
          <Button
            primary
            disabled={!visible || !selected.length}
            onClick={() => setNamingPaper(true)}
          >
            创建复习套题
          </Button>
        </div>
      </div>
      <div className="mistake-mastery-row">
        <Segmented
          label="掌握状态"
          options={[
            ["reviewing", "待复习"],
            ["mastered", "已掌握"],
            ["all", "全部"],
          ]}
          value={String(query.mastery_status ?? "all")}
          onChange={(value) => setQuery({ ...query, mastery_status: value })}
        />
      </div>
      <div className="mistake-filter-row">
        <div className="filter-card-list">
          {facet("source_paper_ids", "来源套题", [
            ...new Map(
              [
                ...papers,
                ...all
                  .flatMap((item) => [item, ...item.history])
                  .filter((item) => item.source_paper_id)
                  .map((item) => ({
                    id: item.source_paper_id!,
                    name: item.source_paper_name ?? "历史套题",
                  })),
              ].map((paper) => [paper.id, paper]),
            ).values(),
          ])}
          {facet("folder_ids", "文件夹", folders)}
          {facet("tag_ids", "题目标签", tags)}
          {facet("types", "题型", types)}
          <details
            ref={dateFilter}
            className={`date-filter-card ${query.date_from || query.date_to ? "is-filtered" : ""}`}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }}
          >
            <summary className="select-trigger" aria-label="日期">
              <span className="filter-value">
                <span data-select-value>
                  {query.date_from || query.date_to
                    ? `${query.date_from ?? "不限"} 至 ${query.date_to ?? "不限"}`
                    : "日期"}
                </span>
              </span>
              <Icon name="chevron" />
            </summary>
            <div className="date-filter-popover">
              <label className="field">
                <span>开始日期</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="field">
                <span>结束日期</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
              {dateError && (
                <p className="date-filter-error" role="alert">
                  {dateError}
                </p>
              )}
              <div className="actions">
                <Button className="quiet" onClick={() => applyDate("", "")}>
                  清除
                </Button>
                <Button primary onClick={() => applyDate(dateFrom, dateTo)}>
                  应用
                </Button>
              </div>
            </div>
          </details>
        </div>
        <SearchField
          label="搜索题干或来源"
          value={String(query.search ?? "")}
          onChange={(search) => setQuery({ ...query, search })}
        />
      </div>
      <Notice
        error={error || catalog.error || message}
        loading={!visible || !catalog.data}
      />
      {visible &&
        (inspect ? (
          <div className="mistake-layout">
            <section className="mistake-list">
              <div className="actions space-bottom-3">
                <label className="small muted">
                  <input
                    type="checkbox"
                    checked={selected.length === visible.length}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? visible.map((item) => item.id)
                          : [],
                      )
                    }
                  />
                  全选当前筛选
                </label>
                <span className="small muted">共 {visible.length} 题</span>
              </div>
              {visible.map((item) => (
                <article
                  className={`card mistake-row ${item.id === inspect.id ? "active" : ""}`}
                  key={item.id}
                >
                  <input
                    aria-label="选择错题"
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, item.id]
                          : selected.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <div>
                    <div className="mistake-origin">
                      <span>{item.source_paper_name ?? "历史套题"}</span>
                      <span>
                        {
                          types.find(
                            (type) => type.id === item.question_snapshot.type,
                          )?.name
                        }
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mistake-question-title"
                      aria-pressed={item.id === inspect.id}
                      onClick={() => setInspectId(item.id)}
                    >
                      <Markdown text={item.question_snapshot.content} />
                    </button>
                    <TagPills
                      ids={item.question_snapshot.tag_ids}
                      tags={tags}
                    />
                    <p className="small muted">
                      错误 {item.wrong_count} 次 ·{" "}
                      <time dateTime={item.created_at} data-dynamic-date="date">
                        {item.created_at.slice(0, 10)}
                      </time>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button slay-button"
                    aria-label={
                      item.mastery_status === "mastered"
                        ? "标记待复习"
                        : "标记已掌握"
                    }
                    onClick={() =>
                      void act(async () => {
                        await client.mistakes.mastery(
                          item.id,
                          item.mastery_status === "mastered"
                            ? "reviewing"
                            : "mastered",
                        );
                        catalog.reload();
                        onMasteryChanged?.();
                      })
                    }
                  >
                    {item.mastery_status === "mastered" ? "复" : "斩"}
                  </button>
                </article>
              ))}
              {selected.length > 0 && (
                <div className="selection-bar">
                  <span>已选 {selected.length} 道错题</span>
                  <Button primary onClick={() => setNamingPaper(true)}>
                    保存复习套题
                  </Button>
                </div>
              )}
            </section>
            <aside
              className="card inspector mistake-preview"
              aria-label="题目预览"
            >
              <div className="section-head preview-heading">
                <h2>
                  <Icon name="eye" />
                  题目预览
                </h2>
                <StatusPill state={inspect.mastery_status}>
                  {inspect.mastery_status === "mastered" ? "已掌握" : "待复习"}
                </StatusPill>
              </div>
              <div className="preview-source">{inspect.source_paper_name}</div>
              <div className="preview-type">
                {
                  types.find(
                    (type) => type.id === inspect.question_snapshot.type,
                  )?.name
                }
              </div>
              <QuestionPreview question={inspect.question_snapshot} reveal />
              <h2 className="preview-history-heading">错误历史</h2>
              {inspect.history.map((item, index) => (
                <div className="history-item" key={index}>
                  <time dateTime={item.answered_at} data-dynamic-date="timestamp">
                    {new Date(item.answered_at).toLocaleString("zh-CN")}
                  </time>
                  <div>
                    当时作答：
                    {answerLabel(item.answer, inspect.question_snapshot) ||
                      "未作答"}
                  </div>
                  <div>
                    来源：
                    {item.source_paper_name ??
                      inspect.source_paper_name ??
                      "历史套题"}
                  </div>
                </div>
              ))}
            </aside>
          </div>
        ) : (
          <EmptyState
            title="没有找到符合条件的错题"
            detail="换一个筛选条件，或完成练习后再来看看。"
          />
        ))}
      {namingPaper && (
        <PromptDialog
          title="保存复习套题"
          label="复习套题名称"
          initialValue="错题复习"
          onClose={() => setNamingPaper(false)}
          onAccept={(name) => {
            setNamingPaper(false);
            void act(async () => {
              const paper = await client.mistakes.createPaper(selected, name);
              navigate({ page: "paper", id: paper.id });
            });
          }}
        />
      )}
    </>
  );
}

function ColorRow({ tag }: { tag: Tag }) {
  const [color, setColor] = useState(tagBackground(tag.color, tag.name));
  const [message, setMessage] = useState("");
  const chain = useRef(Promise.resolve());
  const revision = useRef(0);
  function save(value: string) {
    setColor(value);
    setMessage("保存中…");
    const current = ++revision.current;
    chain.current = chain.current.then(async () => {
      try {
        await client.tags.updateColor(tag.id, value);
        if (current === revision.current) setMessage("已保存");
      } catch (error) {
        if (current === revision.current)
          setMessage(`保存失败，请重试：${(error as Error).message}`);
      }
    });
  }
  return (
    <div className="tag-color-row">
      <span className="pill tag-color" style={tagColorStyle(color, tag.name)}>
        {tag.name}
      </span>
      <span
        className="color-save-status small"
        role="status"
        data-state={
          message.startsWith("保存失败")
            ? "error"
            : message === "已保存"
              ? "saved"
              : undefined
        }
      >
        {message}
      </span>
      {message.startsWith("保存失败") && (
        <Button className="compact" onClick={() => save(color)}>
          重试
        </Button>
      )}
      <label className="tag-color-picker">
        <span className="small muted">颜色</span>
        <input
          aria-label={`${tag.name}颜色`}
          type="color"
          value={color}
          onChange={(event) => save(event.target.value)}
        />
      </label>
    </div>
  );
}

function safeLink(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export function Settings() {
  const confirmation = useConfirmation();
  const { data, error, reload } = useLoad(() => client.tags.list(), []);
  const [namespace, setNamespace] = useViewState("tag-namespace", "file");
  const [message, setMessage] = useState("");
  const linkNames: Record<string, string> = {
    project: "项目主页",
    contact: "联系作者",
  };
  const authorUrl = safeLink(__PRODUCT__.author.url);
  return (
    <>
      <div className="page-heading">
        <h1>设置</h1>
      </div>
      <div className="settings-page">
        <section
          className="settings-section tag-color-settings"
          aria-labelledby="settings-tags-heading"
        >
          <div className="section-head">
            <div className="settings-section-heading">
              <h2 id="settings-tags-heading">标签颜色</h2>
              <p className="muted small">
                文件标签与题目标签分别管理，修改后自动保存。
              </p>
            </div>
            <select
              className="filter"
              aria-label="标签类型"
              value={namespace}
              onChange={(event) => setNamespace(event.target.value)}
            >
              <option value="file">文件标签</option>
              <option value="question">题目标签</option>
            </select>
          </div>
          <Notice error={error} loading={!data} />
          {["file", "question"].map((kind) => (
            <div key={kind} hidden={namespace !== kind}>
              {data
                ?.filter((tag) => tag.target_type === kind)
                .map((tag) => (
                  <ColorRow key={tag.id} tag={tag} />
                ))}
              {data && !data.some((tag) => tag.target_type === kind) && (
                <EmptyState
                  title="暂无标签"
                  detail="在资料或题目属性中添加标签后，可在此设置颜色。"
                />
              )}
            </div>
          ))}
        </section>
        <section
          className="settings-section about-product"
          aria-labelledby="settings-about-heading"
        >
          <h2 id="settings-about-heading">关于</h2>
          <div className="about-identity">
            <img src={logoUrl} alt="题匣标志" />
            <div>
              <h3 className="about-name">
                {__PRODUCT__.name}
                <span>{__PRODUCT__.englishName}</span>
              </h3>
              <p className="about-version">版本 {__PRODUCT__.version}</p>
            </div>
          </div>
          <p className="about-description">{__PRODUCT__.description}</p>
          {__PRODUCT__.author.name && (
            <dl className="about-details">
              <div>
                <dt>作者</dt>
                <dd>
                  {authorUrl ? (
                    <a href={authorUrl} target="_blank" rel="noreferrer">
                      {__PRODUCT__.author.name}
                    </a>
                  ) : (
                    __PRODUCT__.author.name
                  )}
                </dd>
              </div>
            </dl>
          )}
          <div className="about-links">
            {Object.entries(__PRODUCT__.links)
              .filter(([, value]) => safeLink(value))
              .map(([key, value]) => (
                <a
                  className="button quiet"
                  key={key}
                  href={safeLink(value)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {linkNames[key] ?? key}
                  <Icon name="export" />
                </a>
              ))}
          </div>
          <div className="actions space-top-6">
            <Button
              onClick={() =>
                void client.backup
                  .backupCreate()
                  .then((blob) => download(blob, "quarry.quarry-backup"))
                  .catch((error) => setMessage(error.message))
              }
            >
              完整备份
            </Button>
            <label className="button file-input-button">
              恢复备份
              <input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file)
                    confirmation.ask(
                      "完整恢复将整体替换当前数据，后端会保留恢复点。继续？",
                      () =>
                        void client.backup
                          .backupRestore(file)
                          .then(() => {
                            setMessage("恢复完成，请刷新页面");
                            reload();
                          })
                          .catch((error) => setMessage(error.message)),
                    );
                }}
              />
            </label>
          </div>
          <p role="status">{message}</p>
        </section>
      </div>
      {confirmation.dialog}
    </>
  );
}

const trashTypes = {
  folders: "文件夹",
  question_banks: "题库",
  papers: "套题",
  questions: "题目",
};
export function Trash() {
  const confirmation = useConfirmation();
  const { data, error, reload } = useLoad(() => client.trash.list(), []);
  const [message, setMessage] = useState("");
  async function action(task: () => Promise<unknown>) {
    try {
      await task();
      reload();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>回收站</h1>
          <p>已删除资料可以恢复，学习记录与错题快照独立保留。</p>
        </div>
      </div>
      <Notice error={error || message} loading={!data} />
      {data &&
        (data.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th className="file-action-column">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>{item.name ?? item.stem}</td>
                  <td className="muted">{trashTypes[item.entity]}</td>
                  <td>
                    <div className="row-actions">
                      <Button
                        className="quiet"
                        onClick={() =>
                          void action(() =>
                            client.trash.restore(item.entity, item.id),
                          )
                        }
                      >
                        恢复
                      </Button>
                      <Button
                        className="quiet danger"
                        onClick={() =>
                          confirmation.ask("永久删除？此操作不可撤销。", () =>
                            void action(() =>
                              client.trash.purge(item.entity, item.id),
                            ),
                          )
                        }
                      >
                        永久删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="回收站为空"
            detail="删除的资料与题目会出现在这里。"
          />
        ))}
      {confirmation.dialog}
    </>
  );
}

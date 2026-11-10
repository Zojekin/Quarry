import { useEffect, useRef, useState } from "react";
import { client } from "../api/client.js";
import type { Mistake, Query, Tag } from "../api/client.js";
import type { Route } from "../state.js";
import { formatTime } from "../state.js";
import {
  Button,
  Facet,
  Notice,
  types,
  useLoad,
  useViewState,
} from "../components/ui.js";
import { Markdown } from "../components/Markdown.js";
import { Answer, emptyAnswer } from "./Study.js";
import { TagPills } from "../components/QuestionEditor.js";
import { download } from "./Library.js";
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
  const [metric, setMetric] = useViewState<"count" | "duration_seconds">(
    "metric",
    "count",
  );
  const [year, setYear] = useViewState("year", new Date().getFullYear());
  const days = Array.from({ length: 366 }, (_, i) => {
    const date = new Date(Date.UTC(year, 0, i + 1));
    return date.getUTCFullYear() === year
      ? date.toISOString().slice(0, 10)
      : null;
  }).filter((d): d is string => !!d);
  return (
    <>
      <h1>学习概览</h1>
      <Notice error={error} loading={!data} />
      {data && (
        <>
          <div className="metrics">
            {[
              ["累计用时", formatTime(data[0].total_duration_seconds)],
              ["累计答题", data[0].total_questions_answered],
              ["去重题数", data[0].deduplicated_questions_count],
            ].map(([name, value]) => (
              <section className="card" key={name}>
                <p>{name}</p>
                <div className="display-number">{value}</div>
              </section>
            ))}
          </div>
          <div className="dashboard-columns">
            <section className="card">
              <h2>继续答题</h2>
              {data[1]
                .filter((s) => s.status !== "completed")
                .map((s) => (
                  <div className="document-row" key={s.id}>
                    <span>
                      {data[2].find((p) => p.id === s.paper_id)?.name ??
                        "历史套题"}
                    </span>
                    <Button
                      onClick={() => navigate({ page: "study", id: s.id })}
                    >
                      继续
                    </Button>
                  </div>
                ))}
            </section>
            <section className="card">
              <h2>复习错题</h2>
              <p>
                待复习{" "}
                {data[3].filter((m) => m.mastery_status === "reviewing").length}{" "}
                · 已掌握{" "}
                {data[3].filter((m) => m.mastery_status === "mastered").length}
              </p>
              <Button onClick={() => navigate({ page: "mistakes" })}>
                打开错题本
              </Button>
            </section>
          </div>
          <section className="card">
            <div className="toolbar">
              <h2>日积月累</h2>
              <select
                aria-label="年份"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i}>{new Date().getFullYear() - i}</option>
                ))}
              </select>
              <span className="grow" />
              <Button
                onClick={() =>
                  setMetric(metric === "count" ? "duration_seconds" : "count")
                }
              >
                {metric === "count" ? "作答量" : "用时"}
              </Button>
            </div>
            <div className="year-heatmap">
              {days.map((date) => {
                const entry = data[0].daily_heatmap.find(
                  (d) => d.date === date,
                );
                const future = date > new Date().toISOString().slice(0, 10);
                return (
                  <div
                    className={`heat-cell level-${future ? 0 : Math.min(4, Math.ceil((entry?.[metric] ?? 0) / (metric === "count" ? 5 : 600)))}`}
                    key={date}
                    title={`${date} · ${entry?.count ?? 0} 题 · ${formatTime(entry?.duration_seconds ?? 0)}`}
                  />
                );
              })}
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
  return (
    <>
      <h1>学习记录</h1>
      <div className="toolbar">
        <select
          aria-label="状态"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全部</option>
          <option value="pending">未完成</option>
          <option value="completed">已完成</option>
        </select>
        <Facet
          label="模式"
          options={[
            { id: "practice", name: "练习" },
            { id: "exam", name: "考试" },
          ]}
          value={mode}
          onChange={setMode}
        />
        <input
          className="search"
          aria-label="搜索记录"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索套题名称"
        />
      </div>
      <Notice error={error} loading={!data} />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>套题</th>
              <th>进度</th>
              <th>模式</th>
              <th>状态</th>
              <th>用时</th>
              <th>日期</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.[0]
              .filter(
                (s) =>
                  (status === "all" ||
                    (status === "completed"
                      ? s.status === "completed"
                      : s.status !== "completed")) &&
                  (mode === undefined || mode.includes(s.mode)) &&
                  (
                    data[1].find((p) => p.id === s.paper_id)?.name ?? "历史套题"
                  ).includes(search),
              )
              .map((s) => (
                <tr key={s.id}>
                  <td>
                    {data[1].find((p) => p.id === s.paper_id)?.name ??
                      "历史套题"}
                  </td>
                  <td>
                    {
                      new Set([
                        ...s.records.map((r) => r.question_id),
                        ...Object.keys(s.draft_answers).filter((id) => {
                          const a = s.draft_answers[id]!;
                          return a.kind === "choice"
                            ? a.option_ids.length > 0
                            : a.kind === "blanks"
                              ? a.values.some(Boolean)
                              : a.value.length > 0;
                        }),
                      ]).size
                    }
                    /{s.items.length}
                  </td>
                  <td>
                    <span className="pill">
                      {s.mode === "exam" ? "考试" : "练习"}
                    </span>
                  </td>
                  <td>
                    <span className="pill">
                      <svg aria-hidden="true" width="16" height="16">
                        <circle
                          cx="8"
                          cy="8"
                          r="5"
                          fill="none"
                          stroke="currentColor"
                        />
                      </svg>
                      {s.status === "completed"
                        ? "已完成"
                        : s.status === "paused"
                          ? "已暂停"
                          : "进行中"}
                    </span>
                  </td>
                  <td>{formatTime(s.effective_duration_seconds)}</td>
                  <td>{new Date(s.start_time).toLocaleDateString()}</td>
                  <td>
                    <Button
                      onClick={() =>
                        navigate({
                          page: s.status === "completed" ? "result" : "study",
                          id: s.id,
                        })
                      }
                    >
                      {s.status === "completed" ? "结果" : "继续"}
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function Mistakes({ navigate }: { navigate: (r: Route) => void }) {
  const [query, setQuery] = useViewState<Query>("query", {
    mastery_status: "reviewing",
  });
  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        client.mistakes.list(query),
        client.papers.list(),
        client.folders.list(),
        client.tags.list("question"),
        client.mistakes.list(),
      ]),
    [JSON.stringify(query)],
  );
  const [selected, setSelected] = useViewState<string[]>("selected", []);
  const [inspect, setInspect] = useState<Mistake>();
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!data) return;
    setSelected((ids) =>
      ids.filter((id) => data?.[0].some((m) => m.id === id)),
    );
  }, [data]);
  const facet = (
    key: string,
    label: string,
    options: { id: string; name: string }[],
  ) => (
    <Facet
      label={label}
      options={options}
      value={query[key] as string[] | undefined}
      onChange={(value) => setQuery({ ...query, [key]: value })}
    />
  );
  async function act(task: () => Promise<unknown>) {
    try {
      await task();
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <div className="toolbar">
        <h1>错题本</h1>
        <p>
          待复习{" "}
          {data?.[4].filter((m) => m.mastery_status === "reviewing").length ??
            0}{" "}
          · 已掌握{" "}
          {data?.[4].filter((m) => m.mastery_status === "mastered").length ?? 0}{" "}
          · 累计收录 {data?.[4].length ?? 0}
        </p>
      </div>
      <div className="toolbar">
        {[
          ["reviewing", "待复习"],
          ["mastered", "已掌握"],
          ["all", "全部"],
        ].map(([id, name]) => (
          <Button
            primary={query.mastery_status === id}
            key={id}
            onClick={() => setQuery({ ...query, mastery_status: id! })}
          >
            {name}
          </Button>
        ))}
        <input
          className="search"
          placeholder="搜索题干或来源"
          value={String(query.search ?? "")}
          onChange={(e) => setQuery({ ...query, search: e.target.value })}
        />
      </div>
      <div className="toolbar">
        {facet("source_paper_ids", "来源套题", [
          ...new Map(
            [
              ...(data?.[1] ?? []),
              ...(data?.[4] ?? [])
                .flatMap((m) => [m, ...m.history])
                .filter((m) => m.source_paper_id)
                .map((m) => ({
                  id: m.source_paper_id!,
                  name: m.source_paper_name ?? "历史套题",
                })),
            ].map((p) => [p.id, p]),
          ).values(),
        ])}
        {facet("folder_ids", "文件夹", data?.[2] ?? [])}
        {facet("tag_ids", "题目标签", data?.[3] ?? [])}
        {facet("types", "题型", types)}
        <label>
          开始日期
          <input
            type="date"
            value={String(query.date_from ?? "")}
            onChange={(e) =>
              setQuery({ ...query, date_from: e.target.value || undefined })
            }
          />
        </label>
        <label>
          结束日期
          <input
            type="date"
            value={String(query.date_to ?? "")}
            onChange={(e) =>
              setQuery({ ...query, date_to: e.target.value || undefined })
            }
          />
        </label>
      </div>
      <Notice error={error || message} loading={!data} />
      <div className="mistake-columns">
        <section>
          <label>
            <input
              type="checkbox"
              checked={!!data?.[0].length && selected.length === data[0].length}
              onChange={(e) =>
                setSelected(
                  e.target.checked ? (data?.[0].map((m) => m.id) ?? []) : [],
                )
              }
            />
            全选
          </label>
          {data?.[0].map((m) => (
            <article className="card mistake-row" key={m.id}>
              <input
                aria-label="选择错题"
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, m.id]
                      : selected.filter((id) => id !== m.id),
                  )
                }
              />
              <div className="grow">
                <button
                  className="document-title"
                  onClick={() => setInspect(m)}
                >
                  {m.source_paper_name ?? "历史套题"}
                </button>
                <Markdown text={m.question_snapshot.content} />
                <TagPills
                  ids={m.question_snapshot.tag_ids}
                  tags={data?.[3] ?? []}
                />
                <p>
                  {types.find((t) => t.id === m.question_snapshot.type)?.name}
                </p>
              </div>
              <div>
                <p>错误 {m.wrong_count} 次</p>
                <p>{m.created_at.slice(0, 10)}</p>
                <button
                  className="button mastery"
                  onClick={() =>
                    void act(() =>
                      client.mistakes.mastery(
                        m.id,
                        m.mastery_status === "mastered"
                          ? "reviewing"
                          : "mastered",
                      ),
                    )
                  }
                >
                  {m.mastery_status === "mastered" ? "复" : "斩"}
                </button>
              </div>
            </article>
          ))}
        </section>
        {inspect && (
          <aside className="card question-preview">
            <h2>题目预览</h2>
            <p>{inspect.source_paper_name}</p>
            <Markdown text={inspect.question_snapshot.content} />
            <Answer
              q={inspect.question_snapshot}
              answer={emptyAnswer(inspect.question_snapshot)}
              locked
              reveal
              onChange={() => {}}
            />
            <h3>错误历史</h3>
            {inspect.history.map((h, i) => (
              <p key={i}>
                {h.source_paper_name} ·{" "}
                {new Date(h.answered_at).toLocaleString()}
              </p>
            ))}
          </aside>
        )}
      </div>
      {selected.length > 0 && (
        <div className="selection-bar">
          已选择 {selected.length} 题
          <Button
            primary
            onClick={() => {
              const name = prompt("复习套题名称", "错题复习");
              if (name)
                void act(async () => {
                  const paper = await client.mistakes.createPaper(
                    selected,
                    name,
                  );
                  navigate({ page: "paper", id: paper.id });
                });
            }}
          >
            保存复习套题
          </Button>
        </div>
      )}
    </>
  );
}
function ColorRow({ tag, onSaved }: { tag: Tag; onSaved: () => void }) {
  const [color, setColor] = useState(tag.color ?? "#386450");
  const [message, setMessage] = useState("");
  const chain = useRef(Promise.resolve());
  const revision = useRef(0);
  function save(value: string) {
    setColor(value);
    setMessage("保存中…");
    const current = ++revision.current;
    chain.current = chain.current
      .catch(() => {})
      .then(async () => {
        try {
          await client.tags.updateColor(tag.id, value);
          if (current === revision.current) {
            setMessage("已保存");
            onSaved();
          }
        } catch (e) {
          if (current === revision.current)
            setMessage(`保存失败，请重试：${(e as Error).message}`);
        }
      });
  }
  return (
    <div className="tag-color-row">
      <span>{tag.name}</span>
      <input
        aria-label={`${tag.name}颜色`}
        type="color"
        value={color}
        onChange={(e) => save(e.target.value)}
      />
      <span role="status">{message}</span>
      {message.startsWith("保存失败") && (
        <Button onClick={() => save(color)}>重试</Button>
      )}
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
  const { data, error } = useLoad(() => client.tags.list(), []);
  const [message, setMessage] = useState("");
  return (
    <>
      <h1>设置</h1>
      <section className="settings-section">
        <h2>标签颜色</h2>
        <p>文件标签与题目标签分别管理，修改后自动保存。</p>
        <Notice error={error} loading={!data} />
        {(["file", "question"] as const).map((namespace) => (
          <div key={namespace}>
            <h3>{namespace === "file" ? "文件标签" : "题目标签"}</h3>
            {data
              ?.filter((t) => t.target_type === namespace)
              .map((t) => (
                <ColorRow key={t.id} tag={t} onSaved={() => {}} />
              ))}
          </div>
        ))}
      </section>
      <section className="settings-section">
        <h2>关于</h2>
        <img className="about-logo" src="/assets/logo.svg" alt="题匣标志" />
        <h3>
          {__PRODUCT__.name} {__PRODUCT__.englishName}
        </h3>
        <p>版本 {__PRODUCT__.version}</p>
        <p>{__PRODUCT__.description}</p>
        {__PRODUCT__.author.name && <p>{__PRODUCT__.author.name}</p>}
        {Object.entries(__PRODUCT__.links)
          .filter(([, v]) => safeLink(v))
          .map(([key, value]) => (
            <p key={key}>
              <a href={safeLink(value)} target="_blank" rel="noreferrer">
                {key}
              </a>
            </p>
          ))}
        <div className="toolbar">
          <Button
            onClick={() =>
              void client.backup
                .backupCreate()
                .then((b) => download(b, "quarry.quarry-backup"))
                .catch((e) => setMessage(e.message))
            }
          >
            完整备份
          </Button>
          <label className="button">
            恢复备份
            <input
              hidden
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (
                  file &&
                  confirm(
                    "完整恢复将整体替换当前数据，后端会保留恢复点。继续？",
                  )
                )
                  void client.backup
                    .backupRestore(file)
                    .then(() => setMessage("恢复完成，请刷新页面"))
                    .catch((e) => setMessage(e.message));
              }}
            />
          </label>
        </div>
        <p role="status">{message}</p>
      </section>
    </>
  );
}
export function Trash() {
  const { data, error, reload } = useLoad(() => client.trash.list(), []);
  const [message, setMessage] = useState("");
  async function action(task: () => Promise<unknown>) {
    try {
      await task();
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <h1>回收站</h1>
      <Notice error={error || message} loading={!data} />
      <div className="card">
        {data?.map((item) => (
          <div className="document-row" key={item.id}>
            <span className="grow">{item.name ?? item.stem}</span>
            <Button
              onClick={() =>
                void action(() => client.trash.restore(item.entity, item.id))
              }
            >
              恢复
            </Button>
            <Button
              onClick={() => {
                if (confirm("永久删除？此操作不可撤销。"))
                  void action(() => client.trash.purge(item.entity, item.id));
              }}
            >
              永久删除
            </Button>
          </div>
        ))}
        {data?.length === 0 && <p>回收站为空</p>}
      </div>
    </>
  );
}

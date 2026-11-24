import { useEffect, useRef, useState } from "react";
import { client } from "../api/client.js";
import type { Session, QuestionView, StudyAnswer } from "../api/client.js";
import { formatTime } from "../state.js";
import type { Route } from "../state.js";
import {
  Button,
  EmptyState,
  Notice,
  types,
  useLoad,
  useConfirmation,
  useViewState,
} from "../components/ui.js";
import { Icon } from "../components/Icons.js";
import { Markdown } from "../components/Markdown.js";
export function emptyAnswer(q: QuestionView): StudyAnswer {
  return q.options
    ? { kind: "choice", option_ids: [] }
    : q.blanks
      ? { kind: "blanks", values: q.blanks.map(() => "") }
      : { kind: "text", value: "" };
}
export function hasAnswer(answer: StudyAnswer | undefined) {
  if (!answer) return false;
  if (answer.kind === "choice") return answer.option_ids.length > 0;
  if (answer.kind === "blanks")
    return answer.values.some((value) => value.length > 0);
  return answer.value.length > 0;
}

export function Answer({
  q,
  answer,
  locked,
  onChange,
  reveal = false,
}: {
  q: QuestionView;
  answer: StudyAnswer;
  locked: boolean;
  onChange: (a: StudyAnswer) => void;
  reveal?: boolean;
}) {
  return (
    <>
      {q.options && answer.kind === "choice" ? (
        <div className="answer-options">
          {q.options.map((o, i) => {
            const chosen = answer.option_ids.includes(o.id);
            return (
              <button
                type="button"
                aria-pressed={chosen}
                key={o.id}
                disabled={locked}
                className={`answer-option ${chosen ? "chosen" : ""} ${reveal && o.is_correct ? "answer-correct" : reveal && chosen ? "answer-incorrect" : ""}`}
                onClick={() =>
                  onChange({
                    kind: "choice",
                    option_ids:
                      q.type === "single_choice"
                        ? [o.id]
                        : chosen
                          ? answer.option_ids.filter((id) => id !== o.id)
                          : [...answer.option_ids, o.id],
                  })
                }
              >
                <span className="option-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="option-text">
                  <Markdown text={o.content} />
                </span>
                {reveal && (o.is_correct || chosen) && (
                  <span
                    className="option-feedback"
                    role="img"
                    aria-label={
                      o.is_correct ? (chosen ? "正确" : "漏选") : "选错"
                    }
                  >
                    <Icon name={o.is_correct ? "check" : "close"} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : answer.kind === "blanks" ? (
        <div className="answer-inputs">
          {answer.values.map((v, i) => (
            <input
              key={i}
              aria-label={`第 ${i + 1} 空`}
              disabled={locked}
              value={v}
              onChange={(e) =>
                onChange({
                  kind: "blanks",
                  values: answer.values.map((old, n) =>
                    n === i ? e.target.value : old,
                  ),
                })
              }
            />
          ))}
        </div>
      ) : answer.kind === "text" ? (
        <div className="answer-inputs">
          <textarea
            aria-label="作答"
            disabled={locked}
            value={answer.value}
            onChange={(e) => onChange({ kind: "text", value: e.target.value })}
          />
        </div>
      ) : null}
      {reveal && (
        <div className="solution-panels">
          {!q.options && (
            <section className="analysis solution-panel reference-panel">
              <h3>参考答案</h3>
              <Markdown
                text={
                  q.reference_answer ??
                  q.blanks
                    ?.map((b) => b.valid_answers?.join(" / "))
                    .join("；") ??
                  ""
                }
              />
            </section>
          )}
          <section className="analysis solution-panel explanation-panel">
            <h3>解析</h3>
            <Markdown text={q.explanation ?? ""} />
          </section>
        </div>
      )}
    </>
  );
}
export function Study({
  id,
  navigate,
  onRail,
}: {
  id: string;
  navigate: (r: Route) => void;
  onRail: (rail: React.ReactNode) => void;
}) {
  const confirmation = useConfirmation();
  const { data, error } = useLoad(() => client.sessions.get(id), [id]);
  const [session, setSession] = useState<Session>();
  const [drafts, setDrafts] = useViewState<Record<string, StudyAnswer>>(
    "attempt-drafts",
    {},
  );
  const [index, setIndex] = useState(0);
  const [redo, setRedo] = useViewState<string[]>("redo", []);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const queue = useRef(Promise.resolve());
  const submitRef = useRef(false);
  const latestSession = useRef(session);
  latestSession.current = session;
  useEffect(() => {
    const leave = () => {
      if (latestSession.current?.status === "in_progress")
        void client
          .transport(client.url(`sessions/${id}/pause`), {
            method: "POST",
            keepalive: true,
          })
          .catch(() => {});
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      void queue.current.catch(() => {}).then(leave);
    };
  }, [id]);
  useEffect(() => {
    if (data?.status === "completed") {
      navigate({ page: "result", id });
      return;
    }
    if (data) {
      setSession(data);
      setDrafts((local) => ({
        ...data.draft_answers,
        ...Object.fromEntries(
          redo.filter((id) => local[id]).map((id) => [id, local[id]!]),
        ),
      }));
      setIndex(data.current_index);
    }
  }, [data]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  function enqueue(task: () => Promise<unknown>) {
    queue.current = queue.current.then(task).then(
      () => {},
      (e) => {
        setMessage((e as Error).message);
        throw e;
      },
    );
    queue.current.catch(() => {});
  }
  async function act(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await queue.current;
      await task();
    } catch (e) {
      setMessage((e as Error).message);
      queue.current = Promise.resolve();
    } finally {
      setBusy(false);
    }
  }
  const deadline =
    session && session.time_limit_seconds
      ? Date.parse(session.start_time) + session.time_limit_seconds * 1000
      : undefined;
  async function finish() {
    if (!session || submitRef.current) return;
    submitRef.current = true;
    try {
      if (session.mode === "exam") {
        if (session.status === "paused") await client.sessions.resume(id);
        await client.sessions.submitExam(
          id,
          session.items.map((i) => ({
            question_id: i.question.id,
            answer: drafts[i.question.id] ?? emptyAnswer(i.question),
          })),
        );
      } else await client.sessions.finishPractice(id);
      latestSession.current = { ...session, status: "completed" };
      navigate({ page: "result", id });
    } catch (error) {
      // Recover a committed submission when its HTTP response was lost.
      const recovered = await client.sessions.get(id);
      if (recovered.status !== "completed") throw error;
      latestSession.current = recovered;
      navigate({ page: "result", id });
    } finally {
      submitRef.current = false;
    }
  }
  useEffect(() => {
    if (
      session?.mode === "exam" &&
      session.status !== "completed" &&
      deadline &&
      now >= deadline &&
      !submitRef.current
    )
      void act(finish);
  }, [now, deadline, session?.status]);
  function change(q: QuestionView, a: StudyAnswer) {
    setDrafts((current) => ({ ...current, [q.id]: a }));
    if (!redo.includes(q.id))
      enqueue(() =>
        client.sessions.saveDraft(id, {
          question_id: q.id,
          user_answer: a,
          current_index: index,
        }),
      );
  }
  function move(next: number) {
    if (!session) return;
    enqueue(() => client.sessions.saveDraft(id, { current_index: next }));
    setIndex(next);
    if (session.mode === "practice") {
      window.scrollTo(0, 0);
    } else
      document
        .getElementById(`question-${next}`)
        ?.scrollIntoView({ behavior: "smooth" });
  }
  const elapsed = session
    ? session.status === "completed"
      ? session.effective_duration_seconds
      : Math.max(
          0,
          ((session.status === "paused" && session.paused_at
            ? Date.parse(session.paused_at)
            : now) -
            Date.parse(session.start_time)) /
            1000 -
            session.paused_duration_seconds,
        )
    : 0;
  useEffect(() => {
    onRail(
      session ? (
        <div className="study-side">
          <Button
            className="quiet small study-exit"
            onClick={() => navigate({ page: "records" })}
          >
            <Icon name="back" />
            退出答题
          </Button>
          <h2 className="study-name">{session.paper_name ?? "套题"}</h2>
          <p className="study-mode">
            {session.mode === "exam" ? "考试模式" : "练习模式"}
          </p>
          <div className="study-session-controls">
            <span className="small muted">
              {session.mode === "exam" && deadline ? "剩余时间" : "已用时"}
            </span>
            <span className="study-timer" data-dynamic-date="duration">
              {formatTime(
                session.mode === "exam" && deadline
                  ? (deadline - now) / 1000
                  : elapsed,
              )}
            </span>
            <div className="actions">
              <Button
                className="compact"
                disabled={busy}
                onClick={() =>
                  void act(async () =>
                    setSession(await client.sessions.pause(id)),
                  )
                }
              >
                暂停
              </Button>
              <Button
                className="compact"
                primary={session.mode === "exam"}
                disabled={busy}
                onClick={() => {
                  confirmation.ask(
                    session.mode === "exam"
                      ? "确认交卷？"
                      : "结束本次练习？未提交的题目不计入作答量。",
                    () => void act(finish),
                  );
                }}
              >
                {session.mode === "exam" ? "交卷" : "结束练习"}
              </Button>
            </div>
          </div>
          <p className="small muted nav-status-label">题目导航</p>
          <div className="nav-state-legend">
            <span>
              <i className="current" />
              当前
            </span>
            <span>
              <i className="filled" />
              {session.mode === "exam" ? "已填" : "已答"}
            </span>
            <span>
              <i />
              {session.mode === "exam" ? "未填" : "未答"}
            </span>
          </div>
          <div className="question-nav">
            {session.items.map((item, i) => {
              const question = item.question;
              const filled =
                session.mode === "exam"
                  ? hasAnswer(drafts[question.id])
                  : !redo.includes(question.id) &&
                    session.records.some(
                      (record) => record.question_id === question.id,
                    );
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`${i === index ? "current" : ""} ${filled ? "filled" : ""}`}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`第${i + 1}题 ${filled ? "已答" : "未答"}`}
                  onClick={() => move(i)}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
              );
            })}
          </div>
        </div>
      ) : null,
    );
    return () => onRail(null);
  }, [session, index, drafts, now, busy, redo]);
  return (
    <>
      {confirmation.dialog}
      <Notice error={error || message} loading={!session} />
      {message && (
        <Button
          onClick={() => {
            queue.current = Promise.resolve();
            void act(async () => {
              if (!session) return;
              for (const [question_id, user_answer] of Object.entries(drafts)) {
                if (
                  session.mode === "practice" &&
                  session.records.some((r) => r.question_id === question_id)
                )
                  continue;
                await client.sessions.saveDraft(id, {
                  question_id,
                  user_answer,
                  current_index: index,
                });
              }
              setMessage("草稿已保存");
            });
          }}
        >
          重试保存草稿
        </Button>
      )}
      {session && session.status !== "paused" && (
        <div className="study-content">
          {session.mode === "exam" && (
            <p className="muted small space-bottom-6">
              交卷前可以修改答案，提交后查看答案与解析。
            </p>
          )}
          <div className={session.mode === "exam" ? "exam-list" : undefined}>
            {session.items
              .filter((_, i) => session.mode === "exam" || i === index)
              .map((item) => {
                const q = item.question;
                const record = session.records
                  .filter((r) => r.question_id === q.id)
                  .sort((a, b) => b.attempt_index - a.attempt_index)[0];
                const locked = !!record && !redo.includes(q.id);
                return (
                  <article
                    id={`question-${session.items.indexOf(item)}`}
                    className={`card question-card study-question-card ${session.mode === "exam" ? "exam-question-card" : ""}`}
                    key={q.id}
                  >
                    <header className="study-info">
                      <span>
                        第 {session.items.indexOf(item) + 1} /{" "}
                        {session.items.length} 题
                      </span>
                      <span className="question-meta">
                        <span>
                          {types.find((type) => type.id === q.type)?.name} ·{" "}
                          {q.max_score ? `${q.max_score}分` : "不自动判分"}
                        </span>
                        {locked && (
                          <span
                            className={`result-status ${record.is_correct === 0 ? "incorrect" : ""}`}
                          >
                            {record.score === null
                              ? "已查看"
                              : `${record.score} / ${q.max_score} 分`}
                          </span>
                        )}
                      </span>
                    </header>
                    <div className="question-stem">
                      {q.material && <Markdown text={q.material} />}
                      <div className="question-text">
                        <Markdown text={q.content} />
                      </div>
                    </div>
                    <div className="question-response">
                      {!q.options && (
                        <div className="response-label">填写答案</div>
                      )}
                      <Answer
                        q={q}
                        answer={
                          locked
                            ? record.answer
                            : (drafts[q.id] ?? emptyAnswer(q))
                        }
                        locked={locked || busy}
                        reveal={locked}
                        onChange={(a) => change(q, a)}
                      />
                      {session.mode === "practice" && (
                        <div className="study-actions">
                          <Button
                            disabled={busy}
                            onClick={() => {
                              if (locked) {
                                setRedo([...redo, q.id]);
                                setDrafts({
                                  ...drafts,
                                  [q.id]: emptyAnswer(q),
                                });
                              } else
                                void act(async () => {
                                  try {
                                    await client.sessions.submitQuestion(id, {
                                      question_id: q.id,
                                      answer: drafts[q.id] ?? emptyAnswer(q),
                                      attempt_index:
                                        (record?.attempt_index ?? 0) + 1,
                                    });
                                  } catch (error) {
                                    const recovered =
                                      await client.sessions.get(id);
                                    if (
                                      !recovered.records.some(
                                        (r) =>
                                          r.question_id === q.id &&
                                          r.attempt_index ===
                                            (record?.attempt_index ?? 0) + 1,
                                      )
                                    )
                                      throw error;
                                  }
                                  setSession(await client.sessions.get(id));
                                  setRedo(redo.filter((v) => v !== q.id));
                                });
                            }}
                          >
                            {locked ? "重新作答" : "查看答案"}
                          </Button>
                          <div className="actions study-navigation">
                            <Button
                              disabled={index === 0 || busy}
                              onClick={() => move(index - 1)}
                            >
                              上一题
                            </Button>
                            <Button
                              primary
                              disabled={
                                index === session.items.length - 1 || busy
                              }
                              onClick={() => move(index + 1)}
                            >
                              下一题
                            </Button>
                          </div>
                        </div>
                      )}
                      {locked &&
                        ["subjective", "free_fill_in_blank"].includes(
                          q.type,
                        ) && (
                          <Button
                            onClick={() =>
                              void act(async () => {
                                await client.mistakes.manual(id, record.id);
                                setMessage("已加入错题本");
                              })
                            }
                          >
                            加入错题本
                          </Button>
                        )}
                    </div>
                  </article>
                );
              })}
          </div>
        </div>
      )}
      {session?.status === "paused" && (
        <PauseScreen
          resume={() =>
            void act(async () => setSession(await client.sessions.resume(id)))
          }
          exit={() => navigate({ page: "records" })}
          busy={busy}
        />
      )}
    </>
  );
}

function PauseScreen({
  resume,
  exit,
  busy,
}: {
  resume: () => void;
  exit: () => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    return () => {
      if (typeof element.close === "function") element.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="pause-screen"
      aria-modal="true"
      aria-label="答题已暂停"
      onCancel={(event) => event.preventDefault()}
    >
      <div>
        <div className="pause-mark">
          <Icon name="pause" />
        </div>
        <div className="serif">休息一下，再继续。</div>
        <p>计时已暂停，答题内容已遮挡。</p>
        <Button primary disabled={busy} onClick={resume}>
          继续答题
        </Button>
        <div className="space-top-4">
          <Button className="quiet" onClick={exit}>
            返回学习记录
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function Result({
  id,
  navigate = () => {},
}: {
  id: string;
  navigate?: (r: Route) => void;
}) {
  const { data, error } = useLoad(() => client.sessions.get(id), [id]);
  const [filter, setFilter] = useViewState("result-filter", "all");
  if (data && data.status !== "completed") {
    return (
      <section className="empty">
        <h1>答题尚未结束</h1>
        <Button onClick={() => navigate({ page: "study", id })}>
          继续答题
        </Button>
      </section>
    );
  }
  const entries =
    data?.items.map(({ id, question }, index) => ({
      id,
      question,
      index,
      record: data.records
        .filter((entry) => entry.question_id === question.id)
        .sort((a, b) => b.attempt_index - a.attempt_index)[0],
    })) ?? [];
  const rows = entries.filter(
    ({ record }) =>
      filter === "all" ||
      (filter === "unanswered" ? !record : !record || record.is_correct === 0),
  );
  return (
    <>
      <div className="page-heading">
        <h1>答题结果</h1>
        <Button onClick={() => navigate({ page: "records" })}>
          返回学习记录
        </Button>
      </div>
      <Notice error={error} loading={!data} />
      {data && (
        <>
          <div className="result-hero">
            <div>
              <span className="muted">
                {data.mode === "exam" ? "考试" : "练习"}已结束
              </span>
              <h2 className="space-y-2">{data.paper_name ?? "历史套题"}</h2>
              <div className="actions muted small">
                <span>
                  已完成 {entries.filter(({ record }) => record).length} /{" "}
                  {entries.length} 题
                </span>
                <span>
                  正确{" "}
                  {entries.filter(({ record }) => !!record?.is_correct).length}{" "}
                  题
                </span>
                <span>
                  用时{" "}
                  <span data-dynamic-date="duration">
                    {formatTime(data.effective_duration_seconds)}
                  </span>
                </span>
                <span>累计 {data.records.length} 次作答</span>
              </div>
            </div>
            <div className="score">
              {entries.reduce(
                (sum, { record }) => sum + (record?.score ?? 0),
                0,
              )}
              <span className="unit">
                /{" "}
                {entries.reduce(
                  (sum, { question }) => sum + (question.max_score ?? 0),
                  0,
                )}{" "}
                分
              </span>
            </div>
          </div>
          <div className="toolbar">
            <div
              className="tabs result-tabs"
              role="group"
              aria-label="结果筛选"
            >
              {[
                ["all", "全部题目"],
                ["incorrect", "未满分与未作答"],
                ["unanswered", "未作答"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  className={`button tab ${filter === value ? "active" : ""}`}
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value!)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              className="quiet"
              onClick={() => navigate({ page: "mistakes" })}
            >
              打开错题本 <Icon name="forward" />
            </Button>
          </div>
          {rows.map(({ id, question, record, index }) => (
            <article className="result-row" key={id}>
              <div className="study-info">
                <span>
                  第 {index + 1} 题 ·{" "}
                  {types.find((type) => type.id === question.type)?.name}
                </span>
                <span>
                  {record ? `得分 ${record.score ?? "不自动判分"}` : "未作答"}
                </span>
              </div>
              <div className="question-text">
                <Markdown text={question.content} />
              </div>
              <details className="space-top-3">
                <summary>答案与解析</summary>
                <Answer
                  q={question}
                  answer={record?.answer ?? emptyAnswer(question)}
                  locked
                  reveal
                  onChange={() => {}}
                />
              </details>
            </article>
          ))}
          {!rows.length && (
            <EmptyState
              title="没有符合条件的题目"
              detail="切换筛选查看其他题目。"
            />
          )}
        </>
      )}
    </>
  );
}

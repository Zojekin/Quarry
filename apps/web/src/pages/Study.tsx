import { useEffect, useRef, useState } from "react";
import { client } from "../api/client.js";
import type { Session, QuestionView, StudyAnswer } from "../api/client.js";
import { formatTime } from "../state.js";
import type { Route } from "../state.js";
import {
  Button,
  Notice,
  types,
  useLoad,
  useViewState,
} from "../components/ui.js";
import { Markdown } from "../components/Markdown.js";
export function emptyAnswer(q: QuestionView): StudyAnswer {
  return q.options
    ? { kind: "choice", option_ids: [] }
    : q.blanks
      ? { kind: "blanks", values: q.blanks.map(() => "") }
      : { kind: "text", value: "" };
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
    <div className="answer-fields">
      {q.options && answer.kind === "choice" ? (
        q.options.map((o, i) => {
          const chosen = answer.option_ids.includes(o.id);
          return (
            <button
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
              <span>{String.fromCharCode(65 + i)}.</span>
              <Markdown text={o.content} />
              {reveal && (o.is_correct || chosen) && (
                <svg
                  role="img"
                  aria-label={o.is_correct ? "正确" : "选错"}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                >
                  <path
                    d={o.is_correct ? "M4 12l5 5L20 6" : "M5 5l14 14M19 5L5 19"}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </button>
          );
        })
      ) : answer.kind === "blanks" ? (
        answer.values.map((v, i) => (
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
        ))
      ) : answer.kind === "text" ? (
        <textarea
          aria-label="作答"
          disabled={locked}
          value={answer.value}
          onChange={(e) => onChange({ kind: "text", value: e.target.value })}
        />
      ) : null}
      {reveal && (
        <>
          {!q.options && (
            <section className="solution">
              <strong>参考答案</strong>
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
          <section className="solution">
            <strong>解析</strong>
            <Markdown text={q.explanation ?? ""} />
          </section>
        </>
      )}
    </div>
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
    if (session.mode === "exam")
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
        <div className="study-rail">
          <p>{session.mode === "exam" ? "考试" : "练习"}</p>
          <h2>{session.paper_name ?? "套题"}</h2>
          <div className="clock">
            {formatTime(
              session.mode === "exam" && deadline
                ? (deadline - now) / 1000
                : elapsed,
            )}
          </div>
          <div className="toolbar">
            <Button
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
              primary={session.mode === "exam"}
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    session.mode === "exam"
                      ? "确认交卷？"
                      : "结束本次练习？未提交的题目不计入作答量。",
                  )
                )
                  void act(finish);
              }}
            >
              {session.mode === "exam" ? "交卷" : "结束练习"}
            </Button>
          </div>
          <div className="question-nav">
            {session.items.map((item, i) => (
              <button
                key={item.id}
                className={`${i === index ? "current" : ""} ${session.records.some((r) => r.question_id === item.question.id) || drafts[item.question.id] ? "answered" : ""}`}
                onClick={() => move(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <Button onClick={() => navigate({ page: "records" })}>
            学习记录
          </Button>
        </div>
      ) : null,
    );
    return () => onRail(null);
  }, [session, index, drafts, now, busy, redo]);
  return (
    <>
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
      {session &&
        session.status !== "paused" &&
        session.items
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
                className={`card study-card ${session.mode === "practice" ? "practice-split" : ""}`}
                key={q.id}
              >
                <header>
                  {types.find((t) => t.id === q.type)?.name}{" "}
                  {locked
                    ? ` · ${record.score ?? "已查看"}${record.score === null ? "" : " 分"}`
                    : ""}
                </header>
                <div className="study-stem">
                  {q.material && <Markdown text={q.material} />}
                  <Markdown text={q.content} />
                </div>
                <div className="study-response">
                  <Answer
                    q={q}
                    answer={
                      locked ? record.answer : (drafts[q.id] ?? emptyAnswer(q))
                    }
                    locked={locked || busy}
                    reveal={locked}
                    onChange={(a) => change(q, a)}
                  />
                  {session.mode === "practice" && (
                    <div className="toolbar study-actions">
                      <Button
                        disabled={busy}
                        onClick={() => {
                          if (locked) {
                            setRedo([...redo, q.id]);
                            setDrafts({ ...drafts, [q.id]: emptyAnswer(q) });
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
                                const recovered = await client.sessions.get(id);
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
                      <span className="grow" />
                      <Button
                        disabled={index === 0 || busy}
                        onClick={() => move(index - 1)}
                      >
                        上一题
                      </Button>
                      <Button
                        primary
                        disabled={index === session.items.length - 1 || busy}
                        onClick={() => move(index + 1)}
                      >
                        下一题
                      </Button>
                    </div>
                  )}
                  {locked &&
                    ["subjective", "free_fill_in_blank"].includes(q.type) && (
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
      {session?.status === "paused" && (
        <div
          className="pause-mask"
          role="dialog"
          aria-modal="true"
          aria-label="练习已暂停"
        >
          <h1>已暂停</h1>
          <Button
            primary
            onClick={() =>
              void act(async () => setSession(await client.sessions.resume(id)))
            }
          >
            继续答题
          </Button>
        </div>
      )}
    </>
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
  if (data && data.status !== "completed")
    return (
      <section className="card">
        <h1>答题尚未结束</h1>
        <Button onClick={() => navigate({ page: "study", id })}>
          继续答题
        </Button>
      </section>
    );
  return (
    <>
      <h1>答题结果</h1>
      <Notice error={error} loading={!data} />
      {data && (
        <>
          <div className="card">
            <div className="display-number">
              {data.items.reduce(
                (sum, item) =>
                  sum +
                  (data.records
                    .filter((r) => r.question_id === item.question.id)
                    .sort((a, b) => b.attempt_index - a.attempt_index)[0]
                    ?.score ?? 0),
                0,
              )}{" "}
              分
            </div>
            <p>用时 {formatTime(data.effective_duration_seconds)}</p>
          </div>
          {data.items.map((item) => {
            const q = item.question;
            const record = data.records
              .filter((r) => r.question_id === q.id)
              .sort((a, b) => b.attempt_index - a.attempt_index)[0];
            return (
              <article className="card question-preview" key={item.id}>
                <Markdown text={q.content} />
                <p>
                  {record ? `得分 ${record.score ?? "不自动判分"}` : "未作答"}
                </p>
                <Answer
                  q={q}
                  answer={record?.answer ?? emptyAnswer(q)}
                  locked
                  reveal
                  onChange={() => {}}
                />
              </article>
            );
          })}
        </>
      )}
    </>
  );
}

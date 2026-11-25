import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { client } from "../api/client.js";
import type { Paper, QuestionView, RecordView, Session, StudyAnswer } from "../api/client.js";
import { formatTime, type Route } from "../state.js";
import { Icon } from "../components/Icons.js";
import { Markdown } from "../components/Markdown.js";
import {
  Button,
  errorMessage,
  Modal,
  NavigationControls,
  Notice,
  Segmented,
  StatusPill,
  types,
  useConfirmation,
  useLoad,
} from "../components/ui.js";
import type { NavigationProps } from "../components/ui.js";
import { Badge } from "../components/ui/badge.js";
import { Card } from "../components/ui/card.js";
import { Input, Textarea } from "../components/ui/input.js";
import { cn } from "../lib/utils.js";

export function emptyAnswer(q: QuestionView): StudyAnswer {
  if (
    q.type === "single_choice" ||
    q.type === "multiple_choice" ||
    q.type === "indefinite_choice"
  ) {
    return { kind: "choice", option_ids: [] };
  }
  if (q.type === "strict_fill_in_blank") {
    return { kind: "blanks", values: Array(q.blanks?.length ?? 1).fill("") };
  }
  return { kind: "text", value: "" };
}

export function hasAnswer(answer?: StudyAnswer) {
  if (!answer) return false;
  if (answer.kind === "choice") return answer.option_ids.length > 0;
  if (answer.kind === "blanks") return answer.values.some((v) => v.trim());
  return !!answer.value.trim();
}

function referenceText(q: QuestionView): string | undefined {
  return (
    q.reference_answer ??
    q.options
      ?.filter((o) => o.is_correct)
      .map((o) => o.content)
      .join("；") ??
    q.blanks?.map((b) => b.valid_answers?.join(" / ")).join("；")
  );
}

export function Answer({
  q,
  answer,
  locked,
  reveal = false,
  onChange,
}: {
  q: QuestionView;
  answer: StudyAnswer;
  locked: boolean;
  reveal?: boolean;
  onChange: (value: StudyAnswer) => void;
}) {
  const options = q.options ?? [];

  if (options.length > 0) {
    const multiple = q.type !== "single_choice";
    const selected = answer.kind === "choice" ? answer.option_ids : [];

    function pick(id: string) {
      if (locked) return;
      if (!multiple) {
        onChange({ kind: "choice", option_ids: [id] });
      } else {
        onChange({
          kind: "choice",
          option_ids: selected.includes(id)
            ? selected.filter((v) => v !== id)
            : [...selected, id],
        });
      }
    }

    return (
      <div className="space-y-3">
        <div
          className="space-y-2.5"
          role={multiple ? "group" : "radiogroup"}
          aria-label="题目选项"
        >
          {options.map((option, idx) => {
            const chosen = selected.includes(option.id);
            const right = reveal && chosen && !!option.is_correct;
            const missed = reveal && !chosen && !!option.is_correct;
            const wrong = reveal && chosen && !option.is_correct;

            return (
              <button
                key={option.id}
                type="button"
                role={multiple ? "checkbox" : "radio"}
                aria-checked={chosen}
                disabled={locked}
                onClick={() => pick(option.id)}
                className={cn(
                  "flex w-full items-start gap-3.5 rounded-lg border px-4 py-3 text-left text-[15px] leading-relaxed transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                  !locked &&
                    !chosen &&
                    "border-border bg-card hover:border-black/15 hover:bg-muted/45",
                  !reveal &&
                    chosen &&
                    "chosen border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-ink)] shadow-[0_1px_2px_rgba(90,75,40,0.08)]",
                  right &&
                    "answer-correct border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-fg)]",
                  missed &&
                    "border-dashed border-[var(--success-border)] bg-[var(--success-bg)]/55 text-[var(--success-fg)]",
                  wrong &&
                    "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)]",
                )}
              >
                {/* Plain bold option letter — intentionally NO box around A/B/C/D */}
                <span
                  className={cn(
                    "min-w-5 shrink-0 pt-0.5 text-[15px] font-bold tabular-nums",
                    chosen && !reveal
                      ? "text-[var(--selection-ink)]"
                      : right || missed
                        ? "text-[var(--success-fg)]"
                        : wrong
                          ? "text-[var(--error-fg)]"
                          : "text-foreground/75",
                  )}
                >
                  {String.fromCharCode(65 + idx)}
                </span>

                <div className="min-w-0 flex-1 text-foreground">
                  <Markdown text={option.content} />
                </div>

                {(right || missed || wrong) && (
                  <span
                    className="ml-auto inline-flex shrink-0 items-center gap-1 pt-0.5 text-[12px] font-semibold"
                    role="img"
                    aria-label={right ? "正确" : missed ? "漏选" : "选错"}
                  >
                    <Icon name={wrong ? "cross" : "check"} className="size-3.5" />
                    <span>{right ? "正确" : missed ? "漏选" : "选错"}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {reveal && q.explanation && (
          <div className="rounded-lg bg-[#f3f5ef] px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground/85">解析：</span>
            <Markdown text={q.explanation} />
          </div>
        )}
      </div>
    );
  }

  if (q.type === "strict_fill_in_blank") {
    const blanks =
      q.blanks && q.blanks.length > 0 ? q.blanks : [{ id: "0", valid_answers: [] }];
    const current = answer.kind === "blanks" ? answer.values : [];

    return (
      <div className="space-y-3">
        {blanks.map((_, i) => (
          <label key={i} className="block space-y-1.5 text-[13px] font-medium">
            <span className="text-muted-foreground">第 {i + 1} 空</span>
            <Input
              disabled={locked}
              value={current[i] ?? ""}
              onChange={(event) => {
                const next = [...current];
                next[i] = event.target.value;
                onChange({ kind: "blanks", values: next });
              }}
              placeholder={`输入第 ${i + 1} 空答案…`}
            />
          </label>
        ))}
        {reveal && q.explanation && (
          <div className="rounded-lg bg-[#f3f5ef] px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground/85">解析：</span>
            <Markdown text={q.explanation} />
          </div>
        )}
      </div>
    );
  }

  const isFreeBlank = q.type === "free_fill_in_blank";
  return (
    <div className="space-y-3">
      <label className="block space-y-1.5 text-[13px] font-medium">
        <span className="text-muted-foreground">
          {isFreeBlank ? "填空作答" : "作答内容"}
        </span>
        {isFreeBlank ? (
          <Input
            disabled={locked}
            value={answer.kind === "text" ? answer.value : ""}
            onChange={(event) =>
              onChange({ kind: "text", value: event.target.value })
            }
            placeholder="输入你的作答…"
          />
        ) : (
          <Textarea
            disabled={locked}
            rows={6}
            value={answer.kind === "text" ? answer.value : ""}
            onChange={(event) =>
              onChange({ kind: "text", value: event.target.value })
            }
            placeholder="输入你的作答…"
          />
        )}
      </label>
      {reveal && q.explanation && (
        <div className="rounded-lg bg-[#f3f5ef] px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground/85">解析：</span>
          <Markdown text={q.explanation} />
        </div>
      )}
    </div>
  );
}

function PauseScreen({
  mode,
  error,
  busy,
  onResume,
  onExit,
}: {
  mode: "practice" | "exam";
  error: string;
  busy: boolean;
  onResume: () => void;
  onExit: () => void;
}) {
  return (
    <div
      className="flex min-h-[65vh] flex-col items-center justify-center rounded-xl border border-border bg-card/80 p-10 text-center"
      aria-label="答题暂停遮罩"
    >
      <Modal
        title="答题已暂停"
        onClose={onResume}
        actions={
          <>
            <Button variant="outline" onClick={onExit}>
              返回练习记录
            </Button>
            <Button variant="default" disabled={busy} onClick={onResume}>
              继续答题
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground">
            {mode === "exam"
              ? "已隐藏题目内容，考试截止时间按开考时间固定计算。按 Esc 或点击「继续答题」回到作答位置。"
              : "计时已暂停，题目内容已安全隐藏。按 Esc 或点击「继续答题」回到作答位置。"}
          </p>
          <Notice error={error} loading={busy} />
        </div>
      </Modal>
    </div>
  );
}

type CheckedState = {
  score: number | null;
  recordId: string;
  correct: boolean | null;
  answer: StudyAnswer;
};

export function Study({
  id,
  navigate,
  onRail,
  onSubmitted,
  onTitle,
}: {
  id: string;
  navigate: (route: Route) => void;
  onRail: (rail: ReactNode) => void;
  onSubmitted?: () => void;
  onTitle?: (title: string) => void;
}) {
  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        client.sessions.get(id),
        client.papers.list().catch(() => [] as Paper[]),
      ]),
    [id],
  );
  const [session, setSession] = useState<Session>();
  const [paperMeta, setPaperMeta] = useState<Paper>();
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  indexRef.current = index;
  const [drafts, setDrafts] = useState<Record<string, StudyAnswer>>({});
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<string, CheckedState>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const [draftError, setDraftError] = useState("");
  const confirm = useConfirmation();
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const resumeFocusPending = useRef(false);
  const saveChain = useRef(Promise.resolve());
  const draftFailedRef = useRef<Error | null>(null);
  const failedDraftsRef = useRef<Map<string, StudyAnswer>>(new Map());
  const failedIndexRef = useRef<number | null>(null);
  const autoSubmitted = useRef(false);
  const pauseSentForRef = useRef<string | null>(null);
  const leavingRef = useRef(false);
  const sessionRef = useRef(session);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  function commitSession(next: Session) {
    sessionRef.current = next;
    setSession(next);
  }

  const onTitleRef = useRef(onTitle);
  onTitleRef.current = onTitle;

  useEffect(() => {
    if (!data) return;
    const [loadedSession, papers] = data;
    const foundPaper = papers.find((p) => p.id === loadedSession.paper_id);
    commitSession(loadedSession);
    setPaperMeta(foundPaper);
    autoSubmitted.current = false;
    leavingRef.current = false;
    pauseSentForRef.current =
      loadedSession.status === "in_progress" ? null : loadedSession.id;
    draftFailedRef.current = null;
    failedDraftsRef.current.clear();
    failedIndexRef.current = null;
    setDraftError("");
    if (loadedSession.status === "completed") {
      navigate({ page: "result", id: loadedSession.id });
      return;
    }

    const title = loadedSession.paper_name ?? foundPaper?.name ?? "作答";
    onTitleRef.current?.(
      `${title} · ${loadedSession.mode === "exam" ? "考试" : "练习"}`,
    );

    const items = loadedSession.items;
    const latestRecordByQ = new Map<string, RecordView>();
    const initAttempts: Record<string, number> = {};
    for (const r of loadedSession.records) {
      initAttempts[r.question_id] = Math.max(
        initAttempts[r.question_id] ?? 0,
        r.attempt_index,
      );
      const prev = latestRecordByQ.get(r.question_id);
      if (!prev || r.attempt_index >= prev.attempt_index) {
        latestRecordByQ.set(r.question_id, r);
      }
    }

    const initialIndex = Math.max(
      0,
      Math.min(loadedSession.current_index, Math.max(0, items.length - 1)),
    );
    setIndex(initialIndex);

    const initDrafts: Record<string, StudyAnswer> = {};
    for (const item of items) {
      initDrafts[item.question.id] =
        loadedSession.draft_answers[item.question.id] ??
        latestRecordByQ.get(item.question.id)?.answer ??
        emptyAnswer(item.question);
    }
    setDrafts(initDrafts);

    const initChecked: Record<string, CheckedState> = {};
    for (const [qid, r] of latestRecordByQ.entries()) {
      const item = items.find((it) => it.question.id === qid);
      const maxScore = item?.question.max_score;
      const graded = maxScore !== undefined && r.score !== null;
      initChecked[qid] = {
        score: graded ? r.score : null,
        recordId: r.id,
        correct: graded ? (r.score ?? 0) >= maxScore : null,
        answer: r.answer,
      };
    }
    setAttemptCounts(initAttempts);
    setChecked(initChecked);
    setNowMs(Date.now());
  }, [data]);

  const timeLimit = session?.time_limit_seconds ?? null;
  const deadlineMs =
    session && session.mode === "exam" && timeLimit
      ? Date.parse(session.start_time) + timeLimit * 1000
      : null;

  useEffect(() => {
    if (!session || session.status === "completed") return;
    if (session.status !== "in_progress" && deadlineMs === null) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.status, deadlineMs]);

  useEffect(() => {
    if (session?.status === "in_progress" && resumeFocusPending.current) {
      resumeFocusPending.current = false;
      requestAnimationFrame(() => pauseButtonRef.current?.focus());
    }
  }, [session?.status]);

  useEffect(() => {
    if (
      !session ||
      session.mode !== "exam" ||
      session.status === "completed" ||
      deadlineMs === null ||
      autoSubmitted.current
    ) {
      return;
    }
    const checkDeadline = () => {
      if (autoSubmitted.current || busyRef.current) return;
      if (Date.now() >= deadlineMs) {
        void submitExam(true);
      }
    };
    checkDeadline();
    if (!autoSubmitted.current) {
      const waitMs = Math.max(0, deadlineMs - Date.now());
      const handle = window.setTimeout(checkDeadline, waitMs);
      return () => window.clearTimeout(handle);
    }
  }, [nowMs, busy, session?.id, session?.mode, session?.status, deadlineMs]);

  useEffect(() => {
    const pauseOnLeave = () => {
      const active = sessionRef.current;
      if (
        !active ||
        active.status !== "in_progress" ||
        pauseSentForRef.current === active.id
      ) {
        return;
      }
      leavingRef.current = true;
      pauseSentForRef.current = active.id;
      void saveChain.current
        .catch(() => {})
        .then(() => {
          if (sessionRef.current?.id === active.id) {
            sessionRef.current = { ...active, status: "paused" };
          }
          return client.sessions.pause(active.id).catch(() => {});
        });
    };
    window.addEventListener("pagehide", pauseOnLeave);
    return () => {
      window.removeEventListener("pagehide", pauseOnLeave);
      pauseOnLeave();
    };
  }, []);

  function queueDraft(
    nextIndex: number,
    questionId?: string,
    userAnswer?: StudyAnswer,
  ) {
    if (
      !sessionRef.current ||
      sessionRef.current.status !== "in_progress" ||
      leavingRef.current
    )
      return;
    const sessionId = sessionRef.current.id;
    saveChain.current = saveChain.current.then(async () => {
      if (
        !sessionRef.current ||
        sessionRef.current.id !== sessionId ||
        sessionRef.current.status === "completed"
      )
        return;
      try {
        await client.sessions.saveDraft(sessionId, {
          current_index: nextIndex,
          ...(questionId && userAnswer
            ? { question_id: questionId, user_answer: userAnswer }
            : {}),
        });
        if (questionId && userAnswer) {
          if (draftsRef.current[questionId] === userAnswer) {
            failedDraftsRef.current.delete(questionId);
          }
        } else {
          failedIndexRef.current = null;
        }
        if (
          failedDraftsRef.current.size === 0 &&
          failedIndexRef.current === null
        ) {
          draftFailedRef.current = null;
          setDraftError("");
        }
      } catch (err) {
        if (questionId && userAnswer) {
          failedDraftsRef.current.set(questionId, userAnswer);
        } else {
          failedIndexRef.current = nextIndex;
        }
        const errObj = err instanceof Error ? err : new Error(errorMessage(err));
        draftFailedRef.current = errObj;
        setDraftError(errorMessage(err));
      }
    });
  }

  async function retryDraft() {
    if (!sessionRef.current || sessionRef.current.status !== "in_progress")
      return;
    const sessionId = sessionRef.current.id;
    saveChain.current = saveChain.current.then(async () => {
      if (
        !sessionRef.current ||
        sessionRef.current.id !== sessionId ||
        sessionRef.current.status === "completed"
      )
        return;
      try {
        const pendingEntries = Array.from(failedDraftsRef.current.entries());
        for (const [qid, ans] of pendingEntries) {
          const latestAns = draftsRef.current[qid] ?? ans;
          await client.sessions.saveDraft(sessionId, {
            current_index: indexRef.current,
            question_id: qid,
            user_answer: latestAns,
          });
          if (
            draftsRef.current[qid] === latestAns ||
            draftsRef.current[qid] === ans
          ) {
            failedDraftsRef.current.delete(qid);
          }
        }
        if (failedIndexRef.current !== null || pendingEntries.length === 0) {
          await client.sessions.saveDraft(sessionId, {
            current_index: indexRef.current,
          });
          failedIndexRef.current = null;
        }
        if (
          failedDraftsRef.current.size === 0 &&
          failedIndexRef.current === null
        ) {
          draftFailedRef.current = null;
          setDraftError("");
        }
      } catch (err) {
        const errObj = err instanceof Error ? err : new Error(errorMessage(err));
        draftFailedRef.current = errObj;
        setDraftError(errorMessage(err));
      }
    });
    await saveChain.current;
  }

  function updateAnswer(question: QuestionView, nextAnswer: StudyAnswer) {
    if (
      busyRef.current ||
      leavingRef.current ||
      sessionRef.current?.status !== "in_progress"
    )
      return;
    setDrafts((prev) => ({ ...prev, [question.id]: nextAnswer }));
    if (
      !(
        sessionRef.current?.mode === "practice" &&
        (attemptCounts[question.id] ?? 0) > 0
      )
    ) {
      queueDraft(index, question.id, nextAnswer);
    }
  }

  function go(nextIndex: number) {
    if (
      busyRef.current ||
      leavingRef.current ||
      sessionRef.current?.status !== "in_progress"
    )
      return;
    setIndex(nextIndex);
    queueDraft(nextIndex);
  }

  const currentItem = session?.items[index];
  const currentQuestion = currentItem?.question;
  const currentCheck = currentQuestion ? checked[currentQuestion.id] : undefined;

  async function checkCurrent() {
    if (
      !session ||
      sessionRef.current?.status !== "in_progress" ||
      !currentQuestion ||
      busyRef.current
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    const qid = currentQuestion.id;
    const answer = drafts[qid] ?? emptyAnswer(currentQuestion);
    const attempt = (attemptCounts[qid] ?? 0) + 1;
    const applySubmission = (record: RecordView) => {
      const maxScore = currentQuestion.max_score;
      const graded = maxScore !== undefined && record.score !== null;
      setAttemptCounts((prev) => ({
        ...prev,
        [qid]: Math.max(prev[qid] ?? 0, record.attempt_index),
      }));
      failedDraftsRef.current.delete(qid);
      if (
        failedDraftsRef.current.size === 0 &&
        failedIndexRef.current === null
      ) {
        draftFailedRef.current = null;
        setDraftError("");
      }
      setChecked((prev) => ({
        ...prev,
        [qid]: {
          score: graded ? record.score : null,
          recordId: record.id,
          correct: graded ? (record.score ?? 0) >= maxScore : null,
          answer: record.answer ?? answer,
        },
      }));
    };
    try {
      await saveChain.current;
      const result = await client.sessions.submitQuestion(session.id, {
        question_id: qid,
        answer,
        attempt_index: attempt,
      });
      applySubmission(result);
      const latest = sessionRef.current ?? session;
      const refreshed = await client.sessions.get(session.id).catch(() => null);
      if (refreshed) {
        commitSession({
          ...latest,
          items: refreshed.items,
          records: refreshed.records,
        });
      } else {
        commitSession({
          ...latest,
          records: [...latest.records, result],
        });
      }
      onSubmitted?.();
    } catch (e) {
      const recovered = await client.sessions.get(session.id).catch(() => null);
      if (recovered?.status === "completed") {
        commitSession(recovered);
        onSubmitted?.();
        navigate({ page: "result", id: session.id });
        return;
      }
      const savedRecord = recovered?.records
        .filter((r) => r.question_id === qid)
        .sort((a, b) => b.attempt_index - a.attempt_index)[0];
      if (recovered && savedRecord && savedRecord.attempt_index >= attempt) {
        commitSession(recovered);
        applySubmission(savedRecord);
        onSubmitted?.();
      } else {
        setMessage(errorMessage(e));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function redoCurrent() {
    if (
      !currentQuestion ||
      busyRef.current ||
      leavingRef.current ||
      sessionRef.current?.status !== "in_progress"
    )
      return;
    setChecked((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
    const reset = emptyAnswer(currentQuestion);
    updateAnswer(currentQuestion, reset);
  }

  async function addMistake(recordId: string) {
    if (
      !session ||
      sessionRef.current?.status !== "in_progress" ||
      busyRef.current
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      await client.mistakes.manual(session.id, recordId);
      setMessage("已主动收入错题本。");
      onSubmitted?.();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function finishPractice() {
    if (
      !session ||
      sessionRef.current?.status === "completed" ||
      busyRef.current
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      await saveChain.current;
      if (draftFailedRef.current) throw draftFailedRef.current;
      sessionRef.current = { ...session, status: "completed" };
      await client.sessions.finishPractice(session.id);
      onSubmitted?.();
      navigate({ page: "result", id: session.id });
    } catch (e) {
      const recovered = await client.sessions.get(session.id).catch(() => null);
      if (recovered?.status === "completed") {
        commitSession(recovered);
        onSubmitted?.();
        navigate({ page: "result", id: session.id });
        return;
      }
      sessionRef.current = session;
      setMessage(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function submitExam(isAuto = false) {
    let currentSession = sessionRef.current ?? session;
    if (
      !currentSession ||
      currentSession.status === "completed" ||
      busyRef.current
    )
      return;
    if (isAuto) autoSubmitted.current = true;
    busyRef.current = true;
    setBusy(true);
    try {
      await saveChain.current;
      if (currentSession.status === "paused") {
        currentSession = await client.sessions.resume(currentSession.id);
        pauseSentForRef.current = null;
        commitSession(currentSession);
      }
      sessionRef.current = { ...currentSession, status: "completed" };
      const currentDrafts = draftsRef.current;
      const answers = currentSession.items.map((item) => ({
        question_id: item.question.id,
        answer: currentDrafts[item.question.id] ?? emptyAnswer(item.question),
      }));
      await client.sessions.submitExam(currentSession.id, answers);
      onSubmitted?.();
      navigate({ page: "result", id: currentSession.id });
    } catch (e) {
      const recovered = await client.sessions
        .get(currentSession.id)
        .catch(() => null);
      if (recovered?.status === "completed") {
        commitSession(recovered);
        onSubmitted?.();
        navigate({ page: "result", id: currentSession.id });
        return;
      }
      sessionRef.current = currentSession;
      if (!isAuto) autoSubmitted.current = false;
      setMessage(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function pauseSession() {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await saveChain.current;
      if (draftFailedRef.current) throw draftFailedRef.current;
      pauseSentForRef.current = session.id;
      sessionRef.current = { ...session, status: "paused" };
      const updated = await client.sessions.pause(session.id);
      commitSession(updated);
    } catch (e) {
      pauseSentForRef.current = null;
      sessionRef.current = session;
      setMessage(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function exitStudy() {
    const active = sessionRef.current ?? session;
    if (active && active.status === "in_progress") {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        let prevChain: Promise<void>;
        do {
          prevChain = saveChain.current;
          await prevChain;
        } while (saveChain.current !== prevChain);
        if (
          failedDraftsRef.current.size > 0 ||
          failedIndexRef.current !== null
        ) {
          await retryDraft();
        }
        if (draftFailedRef.current) {
          const reason = draftFailedRef.current.message;
          setMessage(reason);
          confirm.ask(
            `存在未保存的草稿（${reason}），确认放弃未保存更改并退出吗？`,
            () =>
              void (async () => {
                if (busyRef.current) return;
                busyRef.current = true;
                setBusy(true);
                leavingRef.current = true;
                pauseSentForRef.current = active.id;
                try {
                  const paused = await client.sessions.pause(active.id);
                  commitSession(paused);
                } catch {
                  pauseSentForRef.current = null;
                } finally {
                  busyRef.current = false;
                  setBusy(false);
                }
                navigate({ page: "records" });
              })(),
          );
          return;
        }
        pauseSentForRef.current = active.id;
        const paused = await client.sessions.pause(active.id);
        leavingRef.current = true;
        commitSession(paused);
      } catch (e) {
        pauseSentForRef.current = null;
        leavingRef.current = false;
        const reason = errorMessage(e);
        setMessage(reason);
        confirm.ask(`暂停会话失败（${reason}），仍要退出答题吗？`, () => {
          leavingRef.current = true;
          navigate({ page: "records" });
        });
        return;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    }
    navigate({ page: "records" });
  }

  async function resumeSession() {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    resumeFocusPending.current = true;
    try {
      const updated = await client.sessions.resume(session.id);
      pauseSentForRef.current = null;
      commitSession(updated);
    } catch (e) {
      resumeFocusPending.current = false;
      setMessage(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (
      !session ||
      session.mode !== "practice" ||
      session.status !== "in_progress" ||
      !currentQuestion
    )
      return;
    const locked = !!checked[currentQuestion.id];
    const onKeyDown = (event: KeyboardEvent) => {
      if (busyRef.current || document.querySelector('[role="dialog"]')) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true']",
        )
      ) {
        return;
      }
      if (
        !locked &&
        currentQuestion.options &&
        currentQuestion.options.length > 0 &&
        /^[1-9]$/.test(event.key)
      ) {
        const idx = Number(event.key) - 1;
        const opt = currentQuestion.options[idx];
        if (!opt) return;
        event.preventDefault();
        const cur = drafts[currentQuestion.id] ?? emptyAnswer(currentQuestion);
        if (currentQuestion.type === "single_choice") {
          updateAnswer(currentQuestion, { kind: "choice", option_ids: [opt.id] });
        } else {
          const list = cur.kind === "choice" ? cur.option_ids : [];
          updateAnswer(currentQuestion, {
            kind: "choice",
            option_ids: list.includes(opt.id)
              ? list.filter((x) => x !== opt.id)
              : [...list, opt.id],
          });
        }
      } else if (event.key === "Enter" && !locked) {
        if (
          target?.closest(
            "button, a, summary, [role='button'], [role='radio'], [role='checkbox'], [role='tab'], [role='menuitem']",
          )
        ) {
          return;
        }
        event.preventDefault();
        void checkCurrent();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session, currentQuestion, checked, drafts, index]);

  /* Inject Study Rail into App Sidebar (no divider lines!) */
  useEffect(() => {
    if (!session || session.status === "completed") {
      onRail(null);
      return;
    }
    const answeredCount = session.items.filter((item) => {
      if (session.mode === "practice") return !!checked[item.question.id];
      return hasAnswer(drafts[item.question.id]);
    }).length;
    const anchorMs =
      session.status === "paused" && session.paused_at
        ? Date.parse(session.paused_at)
        : nowMs;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((anchorMs - Date.parse(session.start_time)) / 1000) -
        (session.paused_duration_seconds ?? 0),
    );
    const displayedSeconds =
      deadlineMs !== null
        ? Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000))
        : elapsedSeconds;
    const paperTitle = session.paper_name ?? paperMeta?.name ?? "试卷作答";

    onRail(
      <div className="space-y-5 px-0.5 text-[13px]">
        <div className="space-y-2 rounded-lg bg-card/85 p-3 shadow-[0_1px_2px_rgba(23,27,25,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={session.mode === "exam" ? "warning" : "info"}>
              {session.mode === "exam" ? "考试模式" : "练习模式"}
            </Badge>
            <span
              className="font-mono text-[13px] font-semibold text-foreground tabular-nums"
              data-dynamic-date="duration"
            >
              {formatTime(displayedSeconds)}
            </span>
          </div>
          <div className="truncate font-serif text-[14.5px] font-semibold text-foreground">
            {paperTitle}
          </div>
          <div className="text-[12px] text-muted-foreground tabular-nums">
            已答 {answeredCount} / {session.items.length} 题
          </div>
        </div>

        <div className="space-y-2">
          <div className="px-1 text-[11.5px] font-semibold text-muted-foreground">
            题目导航
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {session.items.map((item, i) => {
              const check = checked[item.question.id];
              const isCurrent = session.mode === "practice" && i === index;
              const done =
                session.mode === "practice"
                  ? !!check
                  : hasAnswer(drafts[item.question.id]);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`第 ${i + 1} 题`}
                  onClick={() => {
                    if (session.mode === "practice") {
                      go(i);
                    } else {
                      document
                        .getElementById(`exam-q-${i}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-md border text-[12px] font-medium tabular-nums transition-all",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : check
                        ? check.correct === null
                          ? "border-border bg-accent text-accent-foreground"
                          : check.correct
                            ? "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-fg)]"
                            : "border-[var(--error-border)] bg-[var(--error-bg)] text-[var(--error-fg)]"
                        : done
                          ? "border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-ink)]"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            ref={pauseButtonRef}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={busy || session.status !== "in_progress"}
            onClick={() => void pauseSession()}
          >
            暂停
          </Button>
          <Button
            variant="default"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() =>
              confirm.ask(
                session.mode === "exam"
                  ? "确认交卷？"
                  : "确认结束本次练习吗？",
                () =>
                  void (session.mode === "exam"
                    ? submitExam()
                    : finishPractice()),
              )
            }
          >
            {session.mode === "exam" ? "交卷" : "结束练习"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() => void exitStudy()}
          >
            退出答题
          </Button>
        </div>
      </div>,
    );
    return () => onRail(null);
  }, [session, paperMeta, drafts, checked, index, nowMs, busy, deadlineMs]);

  if (error || !session || session.status === "completed") {
    return (
      <div className="space-y-4">
        <Notice
          error={error}
          loading={!error && (!session || session.status === "completed")}
        />
        {error && (
          <Button variant="outline" onClick={reload}>
            重试加载
          </Button>
        )}
      </div>
    );
  }

  if (session.status === "paused") {
    return (
      <PauseScreen
        mode={session.mode}
        error={message}
        busy={busy}
        onResume={() => void resumeSession()}
        onExit={() => navigate({ page: "records" })}
      />
    );
  }

  const canManualMistake =
    currentQuestion &&
    ["subjective", "free_fill_in_blank"].includes(currentQuestion.type);

  const reference = currentQuestion ? referenceText(currentQuestion) : undefined;

  return (
    <div className="space-y-6">
      <Notice error={message} loading={false} />
      {draftError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3.5 py-2.5 text-[13px] text-[var(--error-fg)]"
        >
          <span>草稿保存失败：{draftError}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void retryDraft()}
          >
            重试保存草稿
          </Button>
        </div>
      )}

      {session.mode === "practice" && currentQuestion ? (
        /* Practice Mode: Reimagined Left-Right Split */
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {/* Left Column: Calm Metadata + Shared Material + Regular-Weight Serif Stem */}
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
              <Badge variant="outline">
                第 {index + 1} / {session.items.length} 题
              </Badge>
              <span>
                {types.find((t) => t.id === currentQuestion.type)?.name ??
                  currentQuestion.type}
              </span>
              <span className="tabular-nums">
                ·{" "}
                {currentQuestion.max_score !== undefined
                  ? `${currentQuestion.max_score} 分`
                  : "不计分"}
              </span>
            </div>

            {currentQuestion.material && (
              <div className="rounded-xl bg-muted/65 px-4 py-3.5 text-[14.5px] leading-[1.75] text-foreground/90">
                <Markdown text={currentQuestion.material} />
              </div>
            )}

            <div className="question-stem font-serif text-[19px] leading-[1.82] font-normal text-foreground">
              <Markdown text={currentQuestion.content} />
            </div>
          </div>

          {/* Right Column: Options + Feedback + 3 Bare Buttons (No Dock Card) */}
          <div className="min-w-0 space-y-5">
            <Answer
              q={currentQuestion}
              answer={
                currentCheck
                  ? currentCheck.answer
                  : (drafts[currentQuestion.id] ?? emptyAnswer(currentQuestion))
              }
              locked={!!currentCheck || busy}
              reveal={!!currentCheck}
              onChange={(val) => updateAnswer(currentQuestion, val)}
            />

            {currentCheck && (
              <div className="space-y-2 rounded-xl bg-[#f3f5ef] px-4 py-3 text-[13.5px] leading-relaxed">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill
                    state={
                      currentCheck.correct === null
                        ? "in_progress"
                        : currentCheck.correct
                          ? "completed"
                          : "disabled"
                    }
                  >
                    {currentCheck.correct === null
                      ? "非自动判分 · 已开放参考答案"
                      : currentCheck.correct
                        ? `回答正确 · +${currentCheck.score ?? 0} 分`
                        : `本题得分 ${currentCheck.score ?? 0} / ${currentQuestion.max_score} 分`}
                  </StatusPill>
                  {canManualMistake && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void addMistake(currentCheck.recordId)}
                    >
                      加入错题本
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-primary">参考答案：</span>
                  {reference ? (
                    <div className="text-foreground/90">
                      <Markdown text={reference} />
                    </div>
                  ) : (
                    <span className="text-foreground/90">暂无参考答案</span>
                  )}
                </div>
              </div>
            )}

            {/* 3 bare action buttons directly underneath — NO outer wrapping card */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                variant="outline"
                disabled={busy || index === 0}
                onClick={() => go(index - 1)}
              >
                上一题
              </Button>
              {currentCheck ? (
                <Button variant="default" disabled={busy} onClick={redoCurrent}>
                  重新作答
                </Button>
              ) : (
                <Button
                  variant="default"
                  disabled={busy}
                  onClick={() => void checkCurrent()}
                >
                  查看答案
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy || index >= session.items.length - 1}
                onClick={() => go(index + 1)}
              >
                下一题
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Exam Mode: Full Paper Scroll */
        <div className="space-y-5">
          {session.items.map((item, i) => {
            const q = item.question;
            return (
              <Card key={item.id} id={`exam-q-${i}`} as="section" className="p-6">
                <div className="mb-3 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <Badge variant="outline" className="tabular-nums">
                    第 {i + 1} 题
                  </Badge>
                  <span>
                    {types.find((t) => t.id === q.type)?.name ?? q.type} ·{" "}
                    {q.max_score !== undefined ? `${q.max_score} 分` : "不计分"}
                  </span>
                </div>
                {q.material && (
                  <div className="mb-4 rounded-lg bg-muted/65 px-4 py-3 text-[14px] leading-relaxed">
                    <Markdown text={q.material} />
                  </div>
                )}
                <div className="question-stem mb-4 font-serif text-[18px] leading-[1.78] font-normal text-foreground">
                  <Markdown text={q.content} />
                </div>
                <Answer
                  q={q}
                  answer={drafts[q.id] ?? emptyAnswer(q)}
                  locked={busy}
                  reveal={false}
                  onChange={(val) => updateAnswer(q, val)}
                />
              </Card>
            );
          })}
        </div>
      )}
      {confirm.dialog}
    </div>
  );
}

export function Result({
  id,
  navigation,
  onBack,
}: {
  id: string;
  navigation?: NavigationProps;
  onBack?: () => void;
}) {
  const { data, error } = useLoad(() => client.sessions.get(id), [id]);
  const [filter, setFilter] = useState<"all" | "missed" | "unanswered">("all");

  const records = useMemo(() => {
    const map = new Map<string, RecordView>();
    for (const r of data?.records ?? []) {
      const prev = map.get(r.question_id);
      if (!prev || r.attempt_index >= prev.attempt_index) {
        map.set(r.question_id, r);
      }
    }
    return map;
  }, [data?.records]);

  const items = data?.items ?? [];
  const obtained = items.reduce(
    (sum, item) => sum + (records.get(item.question.id)?.score ?? 0),
    0,
  );
  const totalScore = items.reduce(
    (sum, item) => sum + (item.question.max_score ?? 0),
    0,
  );

  const rows = items
    .map((item, idx) => ({ item, number: idx + 1 }))
    .filter(({ item }) => {
      const r = records.get(item.question.id);
      const maxScore = item.question.max_score;
      if (filter === "missed") {
        return !r || (maxScore !== undefined && (r.score ?? 0) < maxScore);
      }
      if (filter === "unanswered") return !r;
      return true;
    });

  return (
    <div className="space-y-6">
      {(navigation || onBack) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {navigation ? <NavigationControls {...navigation} /> : <span />}
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              返回练习记录
            </Button>
          )}
        </div>
      )}

      <Notice error={error} loading={!data && !error} />

      {data && (
        <>
          <Card className="result-hero p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <Badge variant={data.mode === "exam" ? "warning" : "info"}>
                  {data.mode === "exam" ? "考试成绩报告" : "练习完成报告"}
                </Badge>
                <h1 className="m-0 font-serif text-[26px] font-semibold text-foreground">
                  {data.paper_name ?? "成绩报告"}
                </h1>
                <p className="m-0 text-[13px] text-muted-foreground tabular-nums">
                  总用时{" "}
                  <span data-dynamic-date="duration">
                    {formatTime(data.effective_duration_seconds)}
                  </span>{" "}
                  · 共 {items.length} 题
                </p>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-muted-foreground">最终得分</div>
                <div className="score font-serif text-[38px] leading-none font-normal text-primary tabular-nums">
                  {obtained} / {totalScore} 分
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              label="题目筛选"
              options={[
                ["all", "全部题目"],
                ["missed", "未满分与未作答"],
                ["unanswered", "未作答"],
              ]}
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
            />
          </div>

          <div className="space-y-4">
            {rows.map(({ item, number }) => {
              const q = item.question;
              const r = records.get(q.id);
              const maxScore = q.max_score;
              const graded = maxScore !== undefined && r && r.score !== null;
              const score = r?.score ?? 0;
              const full = graded && score >= maxScore;
              const refText = referenceText(q);

              return (
                <Card key={item.id} className="p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                      <Badge variant="outline" className="tabular-nums">
                        第 {number} 题
                      </Badge>
                      <span>{types.find((t) => t.id === q.type)?.name ?? q.type}</span>
                    </div>
                    <StatusPill
                      state={
                        !r
                          ? "disabled"
                          : !graded
                            ? "in_progress"
                            : full
                              ? "completed"
                              : "disabled"
                      }
                    >
                      {!r
                        ? "未作答"
                        : !graded
                          ? "非自动判分"
                          : `得分 ${score} / ${maxScore}`}
                    </StatusPill>
                  </div>
                  <div className="mb-3 font-serif text-[17px] leading-[1.75] font-normal text-foreground">
                    <Markdown text={q.content} />
                  </div>
                  {r && (
                    <Answer
                      q={q}
                      answer={r.answer}
                      locked
                      reveal
                      onChange={() => {}}
                    />
                  )}
                  <details className="mt-3 rounded-lg bg-[#f3f5ef] px-3.5 py-2.5 text-[13px]">
                    <summary className="font-medium text-primary">
                      {r ? "参考答案" : "答案与解析"}
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      <div className="space-y-1">
                        <span className="font-semibold">参考答案：</span>
                        {refText ? (
                          <div className="text-foreground/90">
                            <Markdown text={refText} />
                          </div>
                        ) : (
                          <span>暂无参考答案</span>
                        )}
                      </div>
                      {!r && q.explanation && (
                        <div className="text-muted-foreground">
                          <span className="font-semibold text-foreground/80">
                            解析：
                          </span>
                          <Markdown text={q.explanation} />
                        </div>
                      )}
                    </div>
                  </details>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

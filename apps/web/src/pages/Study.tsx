import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { client } from "../api/client.js";
import type { Paper, QuestionView, RecordView, Session, StudyAnswer } from "../api/client.js";
import { formatTime, type Route } from "../state.js";
import { Icon } from "../components/Icons.js";
import { Markdown } from "../components/Markdown.js";
import {
  Button,
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
  if (q.type === "strict_fill_in_blank" || q.type === "free_fill_in_blank") {
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

  if (
    q.type === "strict_fill_in_blank" ||
    q.type === "free_fill_in_blank"
  ) {
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

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5 text-[13px] font-medium">
        <span className="text-muted-foreground">作答内容</span>
        <Textarea
          disabled={locked}
          rows={6}
          value={answer.kind === "text" ? answer.value : ""}
          onChange={(event) =>
            onChange({ kind: "text", value: event.target.value })
          }
          placeholder="输入你的作答…"
        />
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

function PauseScreen({ onResume }: { onResume: () => void }) {
  return (
    <div
      className="flex min-h-[65vh] flex-col items-center justify-center rounded-xl border border-border bg-card/80 p-10 text-center"
      aria-label="考试暂停遮罩"
    >
      <Modal
        title="答题已暂停"
        onClose={onResume}
        actions={
          <Button variant="default" onClick={onResume}>
            继续答题
          </Button>
        }
      >
        <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground">
          计时已暂停，题目内容已在恢复前安全隐藏。按 Esc 或点击「继续答题」回到当前位置。
        </p>
      </Modal>
    </div>
  );
}

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
  const [drafts, setDrafts] = useState<Record<string, StudyAnswer>>({});
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<
    Record<string, { score: number | null; recordId: string; correct: boolean | null }>
  >({});
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [message, setMessage] = useState("");
  const confirm = useConfirmation();
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const resumeFocusPending = useRef(false);
  const saveChain = useRef(Promise.resolve());
  const autoSubmitted = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const onTitleRef = useRef(onTitle);
  onTitleRef.current = onTitle;

  useEffect(() => {
    if (!data) return;
    const [loadedSession, papers] = data;
    const foundPaper = papers.find((p) => p.id === loadedSession.paper_id);
    setSession(loadedSession);
    setPaperMeta(foundPaper);
    autoSubmitted.current = false;

    const title = foundPaper?.name ?? loadedSession.paper_name ?? "作答";
    onTitleRef.current?.(`${title} · ${loadedSession.mode === "exam" ? "考试" : "练习"}`);

    const items = loadedSession.items;
    const firstUnchecked =
      loadedSession.mode === "practice"
        ? items.findIndex(
            (item) =>
              !loadedSession.records.some(
                (r) => r.question_id === item.question.id,
              ),
          )
        : -1;
    setIndex(
      firstUnchecked >= 0
        ? firstUnchecked
        : Math.min(loadedSession.current_index, Math.max(0, items.length - 1)),
    );

    const initDrafts: Record<string, StudyAnswer> = {};
    for (const item of items) {
      initDrafts[item.question.id] =
        loadedSession.draft_answers[item.question.id] ??
        emptyAnswer(item.question);
    }
    setDrafts(initDrafts);

    const initAttempts: Record<string, number> = {};
    const initChecked: Record<
      string,
      { score: number | null; recordId: string; correct: boolean | null }
    > = {};
    for (const r of loadedSession.records) {
      initAttempts[r.question_id] = Math.max(
        initAttempts[r.question_id] ?? 0,
        r.attempt_index,
      );
      const item = items.find((it) => it.question.id === r.question_id);
      const maxScore = item?.question.max_score;
      const graded = maxScore !== undefined && r.score !== null;
      initChecked[r.question_id] = {
        score: graded ? r.score : null,
        recordId: r.id,
        correct: graded ? (r.score ?? 0) >= maxScore : null,
      };
    }
    setAttemptCounts(initAttempts);
    setChecked(initChecked);
    setElapsed(loadedSession.effective_duration_seconds);
  }, [data]);

  useEffect(() => {
    if (session?.status !== "in_progress") return;
    const timer = window.setInterval(() => {
      setElapsed((sec) => sec + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session?.status]);

  useEffect(() => {
    if (session?.status === "in_progress" && resumeFocusPending.current) {
      resumeFocusPending.current = false;
      requestAnimationFrame(() => pauseButtonRef.current?.focus());
    }
  }, [session?.status]);

  const timeLimit =
    paperMeta?.time_limit_seconds ?? session?.time_limit_seconds ?? null;

  useEffect(() => {
    if (
      !session ||
      session.mode !== "exam" ||
      session.status !== "in_progress" ||
      !timeLimit ||
      autoSubmitted.current
    )
      return;

    const elapsedMsSinceStart =
      Date.now() -
      new Date(session.start_time).getTime() -
      session.paused_duration_seconds * 1000;
    if (elapsedMsSinceStart >= timeLimit * 1000 || elapsed >= timeLimit) {
      autoSubmitted.current = true;
      void submitExam();
    }
  }, [elapsed, session, timeLimit]);

  useEffect(() => {
    const onHide = () => {
      if (session?.mode === "exam" && session.status === "in_progress") {
        void client.sessions.pause(session.id).catch(() => {});
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [session?.id, session?.mode, session?.status]);

  function queueDraft(
    nextIndex: number,
    questionId?: string,
    userAnswer?: StudyAnswer,
  ) {
    if (!sessionRef.current || sessionRef.current.status !== "in_progress")
      return;
    const sessionId = sessionRef.current.id;
    saveChain.current = saveChain.current.then(() => {
      if (sessionRef.current?.status !== "in_progress") return undefined;
      return client.sessions
        .saveDraft(sessionId, {
          current_index: nextIndex,
          ...(questionId && userAnswer
            ? { question_id: questionId, user_answer: userAnswer }
            : {}),
        })
        .then(() => undefined)
        .catch(() => undefined);
    });
  }

  function updateAnswer(question: QuestionView, nextAnswer: StudyAnswer) {
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
    setIndex(nextIndex);
    queueDraft(nextIndex);
  }

  const currentItem = session?.items[index];
  const currentQuestion = currentItem?.question;
  const currentCheck = currentQuestion ? checked[currentQuestion.id] : undefined;

  async function checkCurrent() {
    if (!session || !currentQuestion || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await saveChain.current;
      const answer = drafts[currentQuestion.id] ?? emptyAnswer(currentQuestion);
      const attempt = (attemptCounts[currentQuestion.id] ?? 0) + 1;
      const result = await client.sessions.submitQuestion(session.id, {
        question_id: currentQuestion.id,
        answer,
        attempt_index: attempt,
      });
      const refreshed = await client.sessions.get(session.id);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              items: refreshed.items,
              records: refreshed.records,
            }
          : refreshed,
      );
      const maxScore = currentQuestion.max_score;
      const graded = maxScore !== undefined && result.score !== null;
      setAttemptCounts((prev) => ({ ...prev, [currentQuestion.id]: attempt }));
      setChecked((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          score: graded ? result.score : null,
          recordId: result.id,
          correct: graded ? (result.score ?? 0) >= maxScore : null,
        },
      }));
      onSubmitted?.();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function redoCurrent() {
    if (!currentQuestion) return;
    setChecked((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
    const reset = emptyAnswer(currentQuestion);
    updateAnswer(currentQuestion, reset);
  }

  async function addMistake(recordId: string) {
    if (!session) return;
    setBusy(true);
    try {
      await client.mistakes.manual(session.id, recordId);
      setMessage("已主动收入错题本。");
      onSubmitted?.();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finishPractice() {
    if (!session) return;
    setBusy(true);
    try {
      await saveChain.current;
      sessionRef.current = { ...session, status: "completed" };
      await client.sessions.finishPractice(session.id);
      onSubmitted?.();
      navigate({ page: "result", id: session.id });
    } catch (e) {
      sessionRef.current = session;
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitExam() {
    if (!session) return;
    setBusy(true);
    try {
      await saveChain.current;
      sessionRef.current = { ...session, status: "completed" };
      const answers = session.items.map((item) => ({
        question_id: item.question.id,
        answer: drafts[item.question.id] ?? emptyAnswer(item.question),
      }));
      await client.sessions.submitExam(session.id, answers);
      onSubmitted?.();
      navigate({ page: "result", id: session.id });
    } catch (e) {
      sessionRef.current = session;
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pauseExam() {
    if (!session) return;
    setBusy(true);
    try {
      await saveChain.current;
      sessionRef.current = { ...session, status: "paused" };
      const updated = await client.sessions.pause(session.id);
      setSession(updated);
    } catch (e) {
      sessionRef.current = session;
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resumeExam() {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    resumeFocusPending.current = true;
    try {
      const updated = await client.sessions.resume(session.id);
      setSession(updated);
    } catch (e) {
      resumeFocusPending.current = false;
      setMessage((e as Error).message);
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
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
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
        event.preventDefault();
        void checkCurrent();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session, currentQuestion, checked, drafts, index]);

  /* Inject Study Rail into App Sidebar (no divider lines!) */
  useEffect(() => {
    if (!session) {
      onRail(null);
      return;
    }
    const answeredCount = session.items.filter((item) => {
      if (session.mode === "practice") return !!checked[item.question.id];
      return hasAnswer(drafts[item.question.id]);
    }).length;
    const remaining = timeLimit ? Math.max(0, timeLimit - elapsed) : elapsed;
    const paperTitle = paperMeta?.name ?? session.paper_name ?? "试卷作答";

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
              {formatTime(remaining)}
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
          {session.mode === "exam" && (
            <Button
              ref={pauseButtonRef}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={busy || session.status !== "in_progress"}
              onClick={() => void pauseExam()}
            >
              暂停
            </Button>
          )}
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
            onClick={() => navigate({ page: "records" })}
          >
            退出答题
          </Button>
        </div>
      </div>,
    );
    return () => onRail(null);
  }, [session, paperMeta, drafts, checked, index, elapsed, busy, timeLimit]);

  if (error || !session) {
    return (
      <div className="space-y-4">
        <Notice error={error} loading={!error && !session} />
        {error && (
          <Button variant="outline" onClick={reload}>
            重试加载
          </Button>
        )}
      </div>
    );
  }

  if (session.status === "paused") {
    return <PauseScreen onResume={() => void resumeExam()} />;
  }

  const reference =
    currentQuestion &&
    (currentQuestion.reference_answer ??
      currentQuestion.options
        ?.filter((o) => o.is_correct)
        .map((o) => o.content)
        .join("；") ??
      currentQuestion.blanks
        ?.map((b) => b.valid_answers?.join(" / "))
        .join("；"));

  return (
    <div className="space-y-6">
      <Notice error={message} loading={false} />

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
              answer={drafts[currentQuestion.id] ?? emptyAnswer(currentQuestion)}
              locked={!!currentCheck}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void addMistake(currentCheck.recordId)}
                  >
                    加入错题本
                  </Button>
                </div>
                <div>
                  <span className="font-semibold text-primary">参考答案：</span>
                  <span className="text-foreground/90">
                    {reference || "暂无参考答案"}
                  </span>
                </div>
              </div>
            )}

            {/* 3 bare action buttons directly underneath — NO outer wrapping card */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                variant="outline"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                上一题
              </Button>
              {currentCheck ? (
                <Button variant="default" onClick={redoCurrent}>
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
                disabled={index >= session.items.length - 1}
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
                  locked={false}
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
  const { data, error } = useLoad(
    () =>
      Promise.all([
        client.sessions.get(id),
        client.papers.list().catch(() => [] as Paper[]),
      ]),
    [id],
  );
  const [filter, setFilter] = useState<"all" | "missed" | "unanswered">("all");

  const session = data?.[0];
  const papers = data?.[1] ?? [];
  const paper = papers.find((p) => p.id === session?.paper_id);

  const records = useMemo(() => {
    const map = new Map<string, RecordView>();
    for (const r of session?.records ?? []) {
      const prev = map.get(r.question_id);
      if (!prev || r.attempt_index >= prev.attempt_index) {
        map.set(r.question_id, r);
      }
    }
    return map;
  }, [session?.records]);

  const items = session?.items ?? [];
  const obtained = items.reduce(
    (sum, item) => sum + (records.get(item.question.id)?.score ?? 0),
    0,
  );
  const totalScore =
    paper?.full_score ||
    items.reduce((sum, item) => sum + (item.question.max_score ?? 0), 0);

  const rows = items.filter((item) => {
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

      {session && (
        <>
          <Card className="result-hero p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <Badge variant={session.mode === "exam" ? "warning" : "info"}>
                  {session.mode === "exam" ? "考试成绩报告" : "练习完成报告"}
                </Badge>
                <h1 className="m-0 font-serif text-[26px] font-semibold text-foreground">
                  {paper?.name ?? session.paper_name ?? "成绩报告"}
                </h1>
                <p className="m-0 text-[13px] text-muted-foreground tabular-nums">
                  总用时{" "}
                  <span data-dynamic-date="duration">
                    {formatTime(session.effective_duration_seconds)}
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
            {rows.map((item, idx) => {
              const q = item.question;
              const r = records.get(q.id);
              const maxScore = q.max_score;
              const graded = maxScore !== undefined && r && r.score !== null;
              const score = r?.score ?? 0;
              const full = graded && score >= maxScore;
              const refText =
                q.reference_answer ??
                q.options
                  ?.filter((o) => o.is_correct)
                  .map((o) => o.content)
                  .join("；") ??
                q.blanks?.map((b) => b.valid_answers?.join(" / ")).join("；");

              return (
                <Card key={item.id} className="p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                      <Badge variant="outline" className="tabular-nums">
                        第 {idx + 1} 题
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
                      <div>
                        <span className="font-semibold">参考答案：</span>
                        <span>{refText || "暂无参考答案"}</span>
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

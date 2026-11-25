// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { client } from "../src/api/client.js";
import type { Mistake, Paper, QuestionView, Session, Tag } from "../src/api/client.js";
import { App } from "../src/App.js";
import { Detail, Library } from "../src/pages/Library.js";
import { Mistakes, Records, Settings } from "../src/pages/Learning.js";
import { Result, Study } from "../src/pages/Study.js";
import { PromptDialog } from "../src/components/ui.js";
import { updatePreferences } from "../src/lib/preferences.js";
import { ThemeProvider } from "../src/lib/theme-context.js";

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdom.window.localStorage);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessionStorage.clear();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});
it("opens a production create form and saves the current folder ownership", async () => {
  vi.spyOn(client.folders, "list").mockResolvedValue([]);
  vi.spyOn(client.banks, "list").mockResolvedValue([]);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.questions, "list").mockResolvedValue([]);
  vi.spyOn(client.tags, "list").mockResolvedValue([]);
  const create = vi
    .spyOn(client.folders, "create")
    .mockResolvedValue({ id: "new" } as never);
  render(
    <Library
      folder="parent"
      navigate={() => {}}
      navigation={{ back: () => {}, forward: () => {}, home: () => {}, canBack: false, canForward: false }}
      search=""
      setSearch={() => {}}
    />,
  );
  const createBtn = screen.getByRole("button", { name: /新建/ });
  fireEvent.keyDown(createBtn, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "新建文件夹" }));
  fireEvent.change(screen.getByLabelText("名称"), {
    target: { value: "New folder" },
  });
  fireEvent.click(screen.getByText("保存"));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith({
      name: "New folder",
      parent_id: "parent",
      tag_ids: [],
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("serializes color saves and acknowledges only the final persisted color", async () => {
  const tag: Tag = {
    id: "t",
    name: "Math",
    target_type: "question",
    color: null,
  };
  vi.spyOn(client.tags, "listWithUsage").mockResolvedValue([{ ...tag, usage_count: 0 }]);
  vi.spyOn(client, "health").mockResolvedValue({ status: "ok", database: "connected", version: "0.3.0", timestamp: 0 });
  let release: (t: Tag) => void = () => {};
  const save = vi
    .spyOn(client.tags, "update")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue({ ...tag, color: "#222222" });
  render(<ThemeProvider><Settings /></ThemeProvider>);
  const qTab = screen.getByRole("tab", { name: "题目标签" });
  fireEvent.mouseDown(qTab, { button: 0 });
  fireEvent.click(qTab);
  const picker = await screen.findByLabelText("Math颜色");
  fireEvent.change(picker, { target: { value: "#111111" } });
  fireEvent.change(picker, { target: { value: "#222222" } });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  release({ ...tag, color: "#111111" });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls.map((c) => c[1])).toEqual([{ color: "#111111" }, { color: "#222222" }]);
  await screen.findByText("已保存");
});
it("runs a backup restore only after confirmation and allows retrying the same file", async () => {
  vi.spyOn(client.tags, "listWithUsage").mockResolvedValue([]);
  vi.spyOn(client, "health").mockResolvedValue({ status: "ok", database: "connected", version: "0.3.0", timestamp: 0 });
  const restore = vi.spyOn(client.backup, "backupRestore").mockResolvedValue({ recovery_point_id: "recovery" });
  const { container } = render(<ThemeProvider><Settings /></ThemeProvider>);
  const file = new File(["archive"], "quarry.quarry-backup");
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [file] } });
  const dialog = screen.getByRole("dialog", { name: /完整恢复/ });
  fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
  expect(restore).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(within(screen.getByRole("dialog", { name: /完整恢复/ })).getByRole("button", { name: "确认" }));
  expect(restore).toHaveBeenCalledWith(file);
  await screen.findByText("恢复完成，请刷新页面");
});
it("accepts a nonempty review paper name through the prompt dialog", () => {
  const save = vi.fn();
  render(<PromptDialog title="保存复习套题" label="复习套题名称" initialValue="错题复习" onAccept={save} onClose={() => {}} />);
  const dialog = within(screen.getByRole("dialog", { name: "保存复习套题" }));
  fireEvent.change(dialog.getByLabelText("复习套题名称"), { target: { value: "   " } });
  const button = dialog.getByRole("button", { name: "保存" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(dialog.getByLabelText("复习套题名称"), { target: { value: "  地理复习  " } });
  fireEvent.click(button);
  expect(save).toHaveBeenCalledWith("地理复习");
});
const session: Session = {
  id: "s",
  paper_id: "p",
  mode: "practice",
  status: "in_progress",
  current_index: 0,
  draft_answers: {},
  items: [
    {
      id: "i",
      source_question_id: null,
      question: {
        id: "q",
        version: 1,
        owner_id: "p",
        owner_type: "paper",
        type: "single_choice",
        content: "Pick one",
        max_score: 6,
        tag_ids: [],
        options: [
          { id: "a", content: "Alpha" },
          { id: "b", content: "Beta" },
        ],
      },
    },
  ],
  records: [],
  start_time: new Date().toISOString(),
  end_time: null,
  paused_duration_seconds: 0,
  effective_duration_seconds: 0,
};
it("saves a picked answer as a draft without submitting an attempt", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue(session);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  const draft = vi
    .spyOn(client.sessions, "saveDraft")
    .mockResolvedValue(session);
  const submit = vi.spyOn(client.sessions, "submitQuestion");
  vi.spyOn(client, "transport").mockResolvedValue(new Response("{}"));
  render(<Study id="s" navigate={() => {}} onRail={() => {}} />);
  fireEvent.click(await screen.findByText("Alpha"));
  await waitFor(() =>
    expect(draft).toHaveBeenCalledWith("s", {
      question_id: "q",
      current_index: 0,
      user_answer: { kind: "choice", option_ids: ["a"] },
    }),
  );
  expect(submit).not.toHaveBeenCalled();
  expect(screen.queryByText("解析")).toBeNull();
});
it("counts the latest question attempt once in the result score", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue({
    ...session,
    status: "completed",
    records: [
      {
        id: "r1",
        question_id: "q",
        attempt_index: 1,
        score: 1,
        is_correct: 0,
        answer: { kind: "choice", option_ids: ["b"] },
        answered_at: "",
      },
      {
        id: "r2",
        question_id: "q",
        attempt_index: 2,
        score: 3,
        is_correct: 1,
        answer: { kind: "choice", option_ids: ["a"] },
        answered_at: "",
      },
    ],
  });
  render(<Result id="s" />);
  await waitFor(() => expect(document.querySelector(".result-hero .score")?.textContent).toBe("3 / 6 分"));
});

it("auto-submits persisted exam drafts when the immutable deadline expires", async () => {
  const exam = {
    ...session,
    mode: "exam" as const,
    time_limit_seconds: 1,
    start_time: new Date(Date.now() - 2000).toISOString(),
    draft_answers: { q: { kind: "choice" as const, option_ids: ["a"] } },
  };
  vi.spyOn(client.sessions, "get").mockResolvedValue(exam);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  const submit = vi
    .spyOn(client.sessions, "submitExam")
    .mockResolvedValue({ score: 1 });
  const navigate = vi.fn();
  render(<Study id="s" navigate={navigate} onRail={() => {}} />);
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith("s", [
      { question_id: "q", answer: { kind: "choice", option_ids: ["a"] } },
    ]),
  );
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({ page: "result", id: "s" }),
  );
});
it("masks and removes the question content while paused", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue({
    ...session,
    status: "paused",
  });
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  render(<Study id="s" navigate={() => {}} onRail={() => {}} />);
  await screen.findByRole("dialog", { name: "答题已暂停" });
  expect(screen.queryByText("Pick one")).toBeNull();
  expect(screen.queryByText("Alpha")).toBeNull();
});

it("emits text answers for free_fill_in_blank instead of blanks", async () => {
  const freeBlankSession: Session = {
    ...session,
    items: [
      {
        id: "i-free",
        source_question_id: null,
        question: {
          id: "q-free",
          version: 1,
          owner_id: "p",
          owner_type: "paper",
          type: "free_fill_in_blank",
          content: "Fill freely",
          reference_answer: "granite",
          max_score: 5,
          tag_ids: [],
        },
      },
    ],
  };
  vi.spyOn(client.sessions, "get").mockResolvedValue(freeBlankSession);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  const saveDraft = vi
    .spyOn(client.sessions, "saveDraft")
    .mockResolvedValue(freeBlankSession);
  const submitQuestion = vi
    .spyOn(client.sessions, "submitQuestion")
    .mockResolvedValue({
      id: "rec-free",
      question_id: "q-free",
      attempt_index: 1,
      score: null,
      is_correct: null,
      answer: { kind: "text", value: "granite" },
      answered_at: "",
    });

  render(<Study id="s" navigate={() => {}} onRail={() => {}} />);
  const input = await screen.findByPlaceholderText("输入你的作答…");
  fireEvent.change(input, { target: { value: "granite" } });
  await waitFor(() =>
    expect(saveDraft).toHaveBeenCalledWith("s", {
      question_id: "q-free",
      current_index: 0,
      user_answer: { kind: "text", value: "granite" },
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: /查看答案/ }));
  await waitFor(() =>
    expect(submitQuestion).toHaveBeenCalledWith("s", {
      question_id: "q-free",
      answer: { kind: "text", value: "granite" },
      attempt_index: 1,
    }),
  );
});

it("hydrates the latest record answer for locked practice questions after draft_answers are cleared", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue({
    ...session,
    draft_answers: {},
    records: [
      {
        id: "rec-locked",
        question_id: "q",
        attempt_index: 1,
        score: 6,
        is_correct: 1,
        answer: { kind: "choice", option_ids: ["a"] },
        answered_at: "",
      },
    ],
  });
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  render(<Study id="s" navigate={() => {}} onRail={() => {}} />);
  const alpha = await screen.findByRole("radio", { name: /Alpha/ });
  expect(alpha.getAttribute("aria-checked")).toBe("true");
  expect((alpha as HTMLButtonElement).disabled).toBe(true);
});

it("resumes and auto-submits a paused exam when the immutable deadline expires, ignoring live paper time limit changes", async () => {
  const expiredExam: Session = {
    ...session,
    mode: "exam",
    status: "paused",
    time_limit_seconds: 60,
    start_time: new Date(Date.now() - 120_000).toISOString(),
    paused_duration_seconds: 90,
    draft_answers: { q: { kind: "choice", option_ids: ["a"] } },
  };
  vi.spyOn(client.sessions, "get").mockResolvedValue(expiredExam);
  vi.spyOn(client.papers, "list").mockResolvedValue([
    {
      id: "p",
      folder_id: null,
      parent_id: null,
      name: "Live Paper",
      description: "",
      status: "published",
      mode: "exam",
      time_limit_seconds: 9999,
      total_score: 99,
      tag_ids: [],
    },
  ]);
  const resume = vi
    .spyOn(client.sessions, "resume")
    .mockResolvedValue({ ...expiredExam, status: "in_progress" });
  const submitExam = vi
    .spyOn(client.sessions, "submitExam")
    .mockResolvedValue({ score: 6 });
  const navigate = vi.fn();

  render(<Study id="s" navigate={navigate} onRail={() => {}} />);
  await waitFor(() => expect(resume).toHaveBeenCalledWith("s"));
  await waitFor(() =>
    expect(submitExam).toHaveBeenCalledWith("s", [
      { question_id: "q", answer: { kind: "choice", option_ids: ["a"] } },
    ]),
  );
  expect(navigate).toHaveBeenCalledWith({ page: "result", id: "s" });
});

it("does not trigger checkCurrent when Enter is pressed on a focused radio option or button", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue(session);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.sessions, "saveDraft").mockResolvedValue(session);
  const submitQuestion = vi
    .spyOn(client.sessions, "submitQuestion")
    .mockResolvedValue({
      id: "rec-1",
      question_id: "q",
      attempt_index: 1,
      score: 6,
      is_correct: 1,
      answer: { kind: "choice", option_ids: ["a"] },
      answered_at: "",
    });

  render(<Study id="s" navigate={() => {}} onRail={() => {}} />);
  const alpha = await screen.findByRole("radio", { name: /Alpha/ });
  alpha.focus();
  fireEvent.keyDown(alpha, { key: "Enter", bubbles: true });
  expect(submitQuestion).not.toHaveBeenCalled();

  const body = document.body;
  fireEvent.keyDown(body, { key: "Enter", bubbles: true });
  await waitFor(() => expect(submitQuestion).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", { name: /加入错题本/ })).toBeNull();
});

it("exposes practice pause, draft retry recovery, and pause resume failure escape", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue(session);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  const saveDraft = vi
    .spyOn(client.sessions, "saveDraft")
    .mockRejectedValueOnce(new Error("网络断开"))
    .mockResolvedValueOnce(session);
  const pause = vi
    .spyOn(client.sessions, "pause")
    .mockResolvedValue({ ...session, status: "paused" });
  const resume = vi
    .spyOn(client.sessions, "resume")
    .mockRejectedValue(new Error("恢复超时"));
  const navigate = vi.fn();
  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return (
      <div>
        {rail}
        <Study id="s" navigate={navigate} onRail={setRail} />
      </div>
    );
  }
  render(<Harness />);

  fireEvent.click(await screen.findByRole("radio", { name: /Alpha/ }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("网络断开");

  fireEvent.click(within(alert).getByRole("button", { name: "重试保存草稿" }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());

  fireEvent.click(await screen.findByRole("button", { name: "暂停" }));
  await waitFor(() => expect(pause).toHaveBeenCalledWith("s"));

  const dialog = await screen.findByRole("dialog", { name: "答题已暂停" });
  fireEvent.click(within(dialog).getByRole("button", { name: "继续答题" }));
  await waitFor(() => expect(resume).toHaveBeenCalledWith("s"));
  expect(within(dialog).getByText("恢复超时")).toBeTruthy();

  fireEvent.click(within(dialog).getByRole("button", { name: "返回练习记录" }));
  expect(navigate).toHaveBeenCalledWith({ page: "records" });
});

it("computes result total score from frozen session items rather than live paper total_score", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue({
    ...session,
    status: "completed",
    paper_name: "快照试卷",
    records: [
      {
        id: "r1",
        question_id: "q",
        attempt_index: 1,
        score: 4,
        is_correct: 0,
        answer: { kind: "choice", option_ids: ["b"] },
        answered_at: "",
      },
    ],
  });
  vi.spyOn(client.papers, "list").mockResolvedValue([
    {
      id: "p",
      folder_id: null,
      parent_id: null,
      name: "改名后的试卷",
      description: "",
      status: "published",
      mode: "exam",
      time_limit_seconds: null,
      total_score: 100,
      tag_ids: [],
    },
  ]);
  render(<Result id="s" />);
  await waitFor(() =>
    expect(document.querySelector(".result-hero .score")?.textContent).toBe(
      "4 / 6 分",
    ),
  );
  expect(screen.getByRole("heading", { name: "快照试卷" })).toBeTruthy();
});

it("isolates persisted view state across tabs sharing the same page view", async () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: vi.fn(),
  });
  vi.spyOn(client.mistakes, "list").mockResolvedValue([]);
  vi.spyOn(client.sessions, "list").mockResolvedValue([
    { ...session, id: "s1", status: "completed" },
    { ...session, id: "s2", status: "in_progress" },
  ]);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.banks, "list").mockResolvedValue([]);
  vi.spyOn(client.analytics, "getDashboard").mockResolvedValue({
    total_questions_answered: 0,
    deduplicated_questions_count: 0,
    total_duration_seconds: 0,
    daily_heatmap: [],
  });

  render(<App />);
  const nav = await screen.findByRole("navigation");
  fireEvent.click(within(nav).getByRole("button", { name: "练习记录" }));
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
  fireEvent.click(screen.getByRole("button", { name: "已完成" }));
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));

  fireEvent.click(screen.getByRole("button", { name: "新建标签页" }));
  fireEvent.click(within(nav).getByRole("button", { name: "练习记录" }));
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));

  const tabButtons = screen.getAllByRole("tab");
  fireEvent.click(tabButtons[0]!);
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
});

it("sorts records newest-first and uses explicit keyboard-accessible controls in mistakes", async () => {
  vi.spyOn(client.sessions, "list").mockResolvedValue([
    {
      ...session,
      id: "old",
      paper_name: "早期练习",
      start_time: "2026-01-01T08:00:00.000Z",
    },
    {
      ...session,
      id: "new",
      paper_name: "最新练习",
      start_time: "2026-01-02T08:00:00.000Z",
    },
  ]);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);

  const { unmount } = render(<Records navigate={() => {}} />);
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
  const bodyRows = screen.getAllByRole("row").slice(1);
  expect(bodyRows[0]?.textContent).toContain("最新练习");
  expect(bodyRows[1]?.textContent).toContain("早期练习");
  unmount();

  const mistakes: Mistake[] = [
    {
      id: "m1",
      source_paper_id: "p",
      source_paper_name: "地理卷",
      question_snapshot: { ...session.items[0]!.question, content: "第一道错题" },
      mastery_status: "reviewing",
      wrong_count: 1,
      created_at: "2026-01-01T08:00:00.000Z",
      history: [],
    },
    {
      id: "m2",
      source_paper_id: "p",
      source_paper_name: "地理卷",
      question_snapshot: { ...session.items[0]!.question, id: "q2", content: "第二道错题" },
      mastery_status: "mastered",
      wrong_count: 2,
      created_at: "2026-01-02T08:00:00.000Z",
      history: [],
    },
  ];
  vi.spyOn(client.mistakes, "list").mockResolvedValue(mistakes);
  vi.spyOn(client.folders, "list").mockResolvedValue([]);
  vi.spyOn(client.tags, "list").mockResolvedValue([]);

  render(<Mistakes navigate={() => {}} />);
  const previewSecond = await screen.findByRole("button", {
    name: "预览错题 第二道错题",
  });
  fireEvent.click(previewSecond);
  expect(previewSecond.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "标记已掌握" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "标记待复习" })).toBeTruthy();
});

it("triggers exam auto-submit after an overlapping pause finishes past deadline and commits resume state on submit failure", async () => {
  let now = Date.parse("2026-11-25T10:00:00.000Z");
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const exam: Session = {
    ...session,
    mode: "exam",
    status: "in_progress",
    time_limit_seconds: 1,
    start_time: new Date(now).toISOString(),
    draft_answers: { q: { kind: "choice", option_ids: ["a"] } },
  };
  vi.spyOn(client.sessions, "get").mockResolvedValue(exam);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  let releasePause!: (s: Session) => void;
  const pause = vi.spyOn(client.sessions, "pause").mockImplementation(
    () =>
      new Promise<Session>((resolve) => {
        releasePause = resolve;
      }),
  );
  const resume = vi
    .spyOn(client.sessions, "resume")
    .mockResolvedValue({ ...exam, status: "in_progress" });
  const submitExam = vi
    .spyOn(client.sessions, "submitExam")
    .mockRejectedValue(new Error("交卷服务暂不可用"));

  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return (
      <div>
        {rail}
        <Study id="s" navigate={() => {}} onRail={setRail} />
      </div>
    );
  }
  render(<Harness />);
  const pauseBtn = await screen.findByRole("button", { name: "暂停" });

  fireEvent.click(pauseBtn);
  await waitFor(() => expect(pause).toHaveBeenCalledTimes(1));

  now += 2000;
  await new Promise((resolve) => setTimeout(resolve, 1100));
  expect(submitExam).not.toHaveBeenCalled();

  releasePause({ ...exam, status: "paused" });
  await waitFor(() => expect(resume).toHaveBeenCalledWith("s"));
  await waitFor(() =>
    expect(submitExam).toHaveBeenCalledWith("s", [
      { question_id: "q", answer: { kind: "choice", option_ids: ["a"] } },
    ]),
  );
  expect(screen.queryByRole("dialog", { name: "答题已暂停" })).toBeNull();
  expect(await screen.findByText("交卷服务暂不可用")).toBeTruthy();
});

it("keeps an earlier failed question draft alert visible across index saves and replays it on retry", async () => {
  const twoQuestionSession: Session = {
    ...session,
    items: [
      session.items[0]!,
      {
        id: "i2",
        source_question_id: null,
        question: {
          ...session.items[0]!.question,
          id: "q2",
          content: "Second question",
        },
      },
    ],
  };
  vi.spyOn(client.sessions, "get").mockResolvedValue(twoQuestionSession);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  const saveDraft = vi
    .spyOn(client.sessions, "saveDraft")
    .mockRejectedValueOnce(new Error("Q1保存失败"))
    .mockResolvedValueOnce(twoQuestionSession)
    .mockResolvedValueOnce(twoQuestionSession);

  render(<Study id="s" navigate={() => {}} onRail={() => {}} />);
  fireEvent.click(await screen.findByRole("radio", { name: /Alpha/ }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Q1保存失败");

  fireEvent.click(screen.getByRole("button", { name: /下一题/ }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("alert").textContent).toContain("Q1保存失败");

  fireEvent.click(screen.getByRole("button", { name: "重试保存草稿" }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(3));
  expect(saveDraft).toHaveBeenLastCalledWith("s", {
    current_index: 1,
    question_id: "q",
    user_answer: { kind: "choice", option_ids: ["a"] },
  });
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

it("drains queued answers before pausing on exit and on unmount", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue(session);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  let releaseFirst!: () => void;
  const saveOrder: string[] = [];
  const saveDraft = vi
    .spyOn(client.sessions, "saveDraft")
    .mockImplementationOnce(
      (_id, payload) =>
        new Promise<Session>((resolve) => {
          saveOrder.push(
            `draft:${JSON.stringify(payload.user_answer)}`,
          );
          releaseFirst = () => resolve(session);
        }),
    )
    .mockImplementation(async (_id, payload) => {
      saveOrder.push(`draft:${JSON.stringify(payload.user_answer)}`);
      return session;
    });
  const pause = vi.spyOn(client.sessions, "pause").mockImplementation(async () => {
    saveOrder.push("pause");
    return { ...session, status: "paused" };
  });
  const navigate = vi.fn();

  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return (
      <div>
        {rail}
        <Study id="s" navigate={navigate} onRail={setRail} />
      </div>
    );
  }

  const first = render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: "退出答题" }));
  await waitFor(() => expect(pause).toHaveBeenCalledTimes(1));
  expect(navigate).toHaveBeenCalledWith({ page: "records" });
  first.unmount();
  expect(pause).toHaveBeenCalledTimes(1);
  saveOrder.length = 0;

  const second = render(<Study id="s" navigate={navigate} onRail={() => {}} />);
  fireEvent.click(await screen.findByRole("radio", { name: /Alpha/ }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("radio", { name: /Beta/ }));
  second.unmount();

  expect(pause).toHaveBeenCalledTimes(1);
  releaseFirst();
  await waitFor(() => expect(pause).toHaveBeenCalledTimes(2));
  expect(saveDraft).toHaveBeenCalledTimes(2);
  expect(saveOrder).toEqual([
    'draft:{"kind":"choice","option_ids":["a"]}',
    'draft:{"kind":"choice","option_ids":["b"]}',
    "pause",
  ]);
});

it("requires confirmation on exit when draft retry or pause fails instead of discarding answers", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue(session);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.sessions, "saveDraft").mockRejectedValue(
    new Error("离线未同步"),
  );
  const pause = vi
    .spyOn(client.sessions, "pause")
    .mockResolvedValue({ ...session, status: "paused" });
  const navigate = vi.fn();

  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return (
      <div>
        {rail}
        <Study id="s" navigate={navigate} onRail={setRail} />
      </div>
    );
  }

  render(<Harness />);
  fireEvent.click(await screen.findByRole("radio", { name: /Alpha/ }));
  await screen.findByRole("alert");

  fireEvent.click(screen.getByRole("button", { name: "退出答题" }));
  const confirmDialog = await screen.findByRole("dialog");
  expect(confirmDialog.textContent).toContain("存在未保存的草稿");
  expect(navigate).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();

  fireEvent.click(within(confirmDialog).getByRole("button", { name: "确认" }));
  await waitFor(() => expect(pause).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({ page: "records" }),
  );
});

it("freezes edits during exit drain and retries automatic pause on unmount after a failed exit pause", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue(session);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  let releaseDraft!: () => void;
  const saveDraft = vi.spyOn(client.sessions, "saveDraft").mockImplementation(
    () =>
      new Promise<Session>((resolve) => {
        releaseDraft = () => resolve(session);
      }),
  );
  const pause = vi
    .spyOn(client.sessions, "pause")
    .mockRejectedValueOnce(new Error("暂停超时"))
    .mockResolvedValueOnce({ ...session, status: "paused" });
  const navigate = vi.fn();

  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return (
      <div>
        {rail}
        <Study id="s" navigate={navigate} onRail={setRail} />
      </div>
    );
  }

  const view = render(<Harness />);
  fireEvent.click(await screen.findByRole("radio", { name: /Alpha/ }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole("button", { name: "退出答题" }));
  const beta = screen.getByRole("radio", { name: /Beta/ }) as HTMLButtonElement;
  expect(beta.disabled).toBe(true);
  fireEvent.click(beta);
  expect(saveDraft).toHaveBeenCalledTimes(1);

  releaseDraft();
  const failDialog = await screen.findByRole("dialog");
  expect(failDialog.textContent).toContain("暂停会话失败");
  fireEvent.click(within(failDialog).getByRole("button", { name: "取消" }));
  expect(navigate).not.toHaveBeenCalled();

  view.unmount();
  await waitFor(() => expect(pause).toHaveBeenCalledTimes(2));
});

it("renders practice reference answers via Markdown rather than literal source", async () => {
  const mdSession: Session = {
    ...session,
    items: [
      {
        id: "i-md",
        source_question_id: null,
        question: {
          id: "q-md",
          version: 1,
          owner_id: "p",
          owner_type: "paper",
          type: "subjective",
          content: "Explain basalt",
          reference_answer: "**关键术语**",
          max_score: 5,
          tag_ids: [],
        },
      },
    ],
  };
  vi.spyOn(client.sessions, "get").mockResolvedValue(mdSession);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.sessions, "submitQuestion").mockResolvedValue({
    id: "r-md",
    question_id: "q-md",
    attempt_index: 1,
    score: null,
    is_correct: null,
    answer: { kind: "text", value: "ans" },
    answered_at: "",
  });

  render(<Study id="s" navigate={() => {}} onRail={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: /查看答案/ }));
  const strong = await screen.findByText("关键术语");
  expect(strong.tagName).toBe("STRONG");
});

it("renders Result reference answers via Markdown and keeps original question numbering under filters", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue({
    ...session,
    status: "completed",
    items: [
      {
        ...session.items[0]!,
        id: "i1",
        question: {
          ...session.items[0]!.question,
          id: "q1",
          max_score: 5,
          reference_answer: "**满分题**",
        },
      },
      {
        ...session.items[0]!,
        id: "i2",
        question: {
          ...session.items[0]!.question,
          id: "q2",
          content: "Second stem",
          max_score: 5,
          reference_answer: "**核心解析点**",
        },
      },
    ],
    records: [
      {
        id: "r1",
        question_id: "q1",
        attempt_index: 1,
        score: 5,
        is_correct: 1,
        answer: { kind: "choice", option_ids: ["a"] },
        answered_at: "",
      },
    ],
  });

  render(<Result id="s" />);
  const md = await screen.findByText("核心解析点");
  expect(md.tagName).toBe("STRONG");

  fireEvent.click(screen.getByRole("button", { name: "未作答" }));
  expect(screen.queryByText("Pick one")).toBeNull();
  expect(screen.getByText("第 2 题")).toBeTruthy();
});

it("redirects completed sessions to Result and disables editing handlers", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue({
    ...session,
    status: "completed",
  });
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  const navigate = vi.fn();

  render(<Study id="s" navigate={navigate} onRail={() => {}} />);
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({ page: "result", id: "s" }),
  );
  expect(screen.queryByRole("button", { name: /查看答案/ })).toBeNull();
  expect(screen.queryByText("Alpha")).toBeNull();
});

it("computes active elapsed time from timestamps and restores saved current_index on re-entry", async () => {
  const now = Date.parse("2026-11-25T10:05:00.000Z");
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const twoItemsSession: Session = {
    ...session,
    current_index: 1,
    start_time: new Date(now - 300_000).toISOString(),
    paused_duration_seconds: 60,
    effective_duration_seconds: 0,
    items: [
      session.items[0]!,
      {
        id: "i2",
        source_question_id: null,
        question: {
          ...session.items[0]!.question,
          id: "q2",
          content: "Second question stem",
        },
      },
    ],
  };
  vi.spyOn(client.sessions, "get").mockResolvedValue(twoItemsSession);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);

  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return (
      <div>
        {rail}
        <Study id="s" navigate={() => {}} onRail={setRail} />
      </div>
    );
  }
  render(<Harness />);

  await screen.findByText("Second question stem");
  expect(await screen.findByText("04:00")).toBeTruthy();
});

it("keeps edits locked while confirmed discard exit is pausing", async () => {
  vi.spyOn(client.sessions, "get").mockResolvedValue(session);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  const saveDraft = vi
    .spyOn(client.sessions, "saveDraft")
    .mockRejectedValue(new Error("保存失败"));
  let releasePause!: (s: Session) => void;
  const pause = vi.spyOn(client.sessions, "pause").mockImplementation(
    () =>
      new Promise<Session>((resolve) => {
        releasePause = resolve;
      }),
  );
  const navigate = vi.fn();

  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return (
      <div>
        {rail}
        <Study id="s" navigate={navigate} onRail={setRail} />
      </div>
    );
  }
  render(<Harness />);

  fireEvent.click(await screen.findByRole("radio", { name: /Alpha/ }));
  await screen.findByRole("alert");

  fireEvent.click(screen.getByRole("button", { name: "退出答题" }));
  const confirmDialog = await screen.findByRole("dialog");
  fireEvent.click(within(confirmDialog).getByRole("button", { name: "确认" }));

  await waitFor(() => expect(pause).toHaveBeenCalledTimes(1));
  const beta = screen.getByRole("radio", { name: /Beta/ }) as HTMLButtonElement;
  expect(beta.disabled).toBe(true);
  fireEvent.click(beta);
  expect(saveDraft).toHaveBeenCalledTimes(2);
  expect(navigate).not.toHaveBeenCalled();

  releasePause({ ...session, status: "paused" });
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({ page: "records" }),
  );
});

it("updates checked state and increments attempt index even when follow-up session refresh fails", async () => {
  const get = vi
    .spyOn(client.sessions, "get")
    .mockResolvedValueOnce(session)
    .mockRejectedValueOnce(new Error("刷新超时"))
    .mockResolvedValue({ ...session, records: [] });
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.sessions, "saveDraft").mockResolvedValue(session);
  const submitQuestion = vi
    .spyOn(client.sessions, "submitQuestion")
    .mockResolvedValueOnce({
      id: "r1",
      question_id: "q",
      attempt_index: 1,
      score: 6,
      is_correct: 1,
      answer: { kind: "choice", option_ids: ["a"] },
      answered_at: "",
      correct_answer: ["a"],
      analysis: "这是解析内容",
    })
    .mockResolvedValueOnce({
      id: "r2",
      question_id: "q",
      attempt_index: 2,
      score: 6,
      is_correct: 1,
      answer: { kind: "choice", option_ids: ["b"] },
      answered_at: "",
      correct_answer: ["a"],
      analysis: "这是解析内容",
    });

  render(<Study id="s" navigate={() => {}} onRail={() => {}} />);
  fireEvent.click(await screen.findByRole("radio", { name: /Alpha/ }));
  fireEvent.click(screen.getByRole("button", { name: /查看答案/ }));
  await screen.findByRole("button", { name: "重新作答" });
  expect(get).toHaveBeenCalledTimes(2);
  expect(screen.getByText("回答正确 · +6 分")).toBeTruthy();
  expect(screen.getByText("正确")).toBeTruthy();
  expect(screen.queryByText("选错")).toBeNull();
  expect(screen.queryByText("暂无参考答案")).toBeNull();
  expect(screen.getByText("这是解析内容")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "重新作答" }));
  fireEvent.click(await screen.findByRole("button", { name: /查看答案/ }));
  await waitFor(() => expect(submitQuestion).toHaveBeenCalledTimes(2));
  expect(submitQuestion.mock.calls.map((c) => c[1].attempt_index)).toEqual([
    1, 2,
  ]);
});

it("recovers a committed exam submission and redirects to Result when submit response is lost", async () => {
  const exam: Session = {
    ...session,
    mode: "exam",
    status: "in_progress",
    time_limit_seconds: null,
  };
  vi.spyOn(client.sessions, "get")
    .mockResolvedValueOnce(exam)
    .mockResolvedValueOnce({ ...exam, status: "completed" });
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.sessions, "submitExam").mockRejectedValue(
    new Error("连接中断"),
  );
  const navigate = vi.fn();

  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return (
      <div>
        {rail}
        <Study id="s" navigate={navigate} onRail={setRail} />
      </div>
    );
  }
  render(<Harness />);

  fireEvent.click(await screen.findByRole("button", { name: "交卷" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({ page: "result", id: "s" }),
  );
});

it("uses study preferences for manual exam submission and shortcut hints", async () => {
  updatePreferences({ confirmExamSubmit: false, showShortcutHints: true });
  const get = vi.spyOn(client.sessions, "get").mockResolvedValue(session);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  const submit = vi.spyOn(client.sessions, "submitExam").mockResolvedValue({ score: 0 });
  const navigate = vi.fn();
  function Harness() {
    const [rail, setRail] = useState<ReactNode>(null);
    return <>{rail}<Study id="s" navigate={navigate} onRail={setRail} /></>;
  }
  const practice = render(<Harness />);
  expect((await screen.findByText("Enter")).parentElement?.textContent).toContain("查看答案");
  practice.unmount();

  get.mockResolvedValue({ ...session, mode: "exam", time_limit_seconds: null });
  render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: "交卷" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(navigate).toHaveBeenCalledWith({ page: "result", id: "s" });
});

it("filters bank questions by search, type, and tag and paper questions by search", async () => {
  const q1: QuestionView = {
    ...session.items[0]!.question,
    id: "q1",
    type: "single_choice",
    content: "玄武岩成因",
    tag_ids: ["tag-rock"],
  };
  const q2: QuestionView = {
    ...session.items[0]!.question,
    id: "q2",
    type: "subjective",
    content: "板块构造假说",
    explanation: "地质动力学解释",
    tag_ids: [],
  };
  const qTags: Tag[] = [
    { id: "tag-rock", name: "岩石", target_type: "question", color: null },
  ];
  vi.spyOn(client.banks, "get").mockResolvedValue({
    id: "b1",
    folder_id: null,
    name: "地理题库",
    description: "",
    tag_ids: [],
    updated_at: "2026-11-25T00:00:00Z",
  });
  vi.spyOn(client.questions, "list").mockResolvedValue([q1, q2]);
  vi.spyOn(client.tags, "list").mockImplementation(async (target) =>
    target === "question" ? qTags : [],
  );
  vi.spyOn(client.folders, "list").mockResolvedValue([]);

  const navProps = {
    back: () => {},
    forward: () => {},
    home: () => {},
    canBack: false,
    canForward: false,
  };
  const bankRender = render(
    <Detail
      kind="bank"
      id="b1"
      navigate={() => {}}
      navigation={navProps}
      onTitle={() => {}}
    />,
  );
  await screen.findByText("玄武岩成因");
  expect(screen.getByText("板块构造假说")).toBeTruthy();

  fireEvent.change(screen.getByPlaceholderText("搜索题干或解析"), {
    target: { value: "地质动力学" },
  });
  expect(screen.queryByText("玄武岩成因")).toBeNull();
  expect(screen.getByText("板块构造假说")).toBeTruthy();

  fireEvent.change(screen.getByPlaceholderText("搜索题干或解析"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "题型" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "全选" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "单选题" }));
  await waitFor(() => expect(screen.queryByText("板块构造假说")).toBeNull());
  expect(screen.getByText("玄武岩成因")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "题目标签" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "全选" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "岩石" }));
  expect(screen.getByText("玄武岩成因")).toBeTruthy();
  bankRender.unmount();

  const paperDoc: Paper = {
    id: "p1",
    folder_id: null,
    parent_id: null,
    name: "测试套题",
    description: "",
    status: "published",
    mode: "exam",
    time_limit_seconds: null,
    total_score: 10,
    tag_ids: [],
    updated_at: "2026-11-25T00:00:00Z",
    sections: [
      {
        id: "sec1",
        title: "第一部分",
        question_type: "single_choice",
        shuffle_questions: false,
        fixed_groups: [],
        items: [
          { id: "it1", source_question_id: null, question: q1 },
          { id: "it2", source_question_id: null, question: q2 },
        ],
      },
    ],
  };
  vi.spyOn(client.papers, "get").mockResolvedValue(paperDoc);
  render(
    <Detail
      kind="paper"
      id="p1"
      navigate={() => {}}
      navigation={navProps}
      onTitle={() => {}}
    />,
  );
  await screen.findByText("玄武岩成因");
  fireEvent.change(screen.getByPlaceholderText("搜索题干或解析"), {
    target: { value: "玄武岩" },
  });
  expect(screen.getByText("玄武岩成因")).toBeTruthy();
  expect(screen.queryByText("板块构造假说")).toBeNull();
});

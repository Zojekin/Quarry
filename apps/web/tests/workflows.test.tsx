// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { client } from "../src/api/client.js";
import type { Mistake, Session, Tag } from "../src/api/client.js";
import { App } from "../src/App.js";
import { Library } from "../src/pages/Library.js";
import { Mistakes, Records, Settings } from "../src/pages/Learning.js";
import { Result, Study } from "../src/pages/Study.js";
import { PromptDialog } from "../src/components/ui.js";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
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
  vi.spyOn(client.tags, "list").mockResolvedValue([tag]);
  let release: (t: Tag) => void = () => {};
  const save = vi
    .spyOn(client.tags, "updateColor")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue({ ...tag, color: "#222222" });
  render(<Settings />);
  const qTab = screen.getByRole("tab", { name: "题目标签" });
  fireEvent.mouseDown(qTab, { button: 0 });
  fireEvent.click(qTab);
  const picker = await screen.findByLabelText("Math颜色");
  fireEvent.change(picker, { target: { value: "#111111" } });
  fireEvent.change(picker, { target: { value: "#222222" } });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  release({ ...tag, color: "#111111" });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls.map((c) => c[1])).toEqual(["#111111", "#222222"]);
  await screen.findByText("已保存");
});
it("runs a backup restore only after confirmation and allows retrying the same file", async () => {
  vi.spyOn(client.tags, "list").mockResolvedValue([]);
  const restore = vi.spyOn(client.backup, "backupRestore").mockResolvedValue({ recovery_point_id: "recovery" });
  const { container } = render(<Settings />);
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

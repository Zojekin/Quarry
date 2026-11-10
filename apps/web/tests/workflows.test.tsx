// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { client } from "../src/api/client.js";
import type { Session, Tag } from "../src/api/client.js";
import { Library } from "../src/pages/Library.js";
import { Settings } from "../src/pages/Learning.js";
import { Result, Study } from "../src/pages/Study.js";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
it("opens a production create form and saves the current folder ownership", async () => {
  vi.spyOn(client.folders, "list").mockResolvedValue([]);
  vi.spyOn(client.banks, "list").mockResolvedValue([]);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.tags, "list").mockResolvedValue([]);
  const create = vi
    .spyOn(client.folders, "create")
    .mockResolvedValue({ id: "new" } as never);
  render(
    <Library
      folder="parent"
      navigate={() => {}}
      search=""
      setSearch={() => {}}
    />,
  );
  fireEvent.click(screen.getByText("新建文件夹"));
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
  const picker = await screen.findByLabelText("Math颜色");
  fireEvent.change(picker, { target: { value: "#111111" } });
  fireEvent.change(picker, { target: { value: "#222222" } });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  release({ ...tag, color: "#111111" });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls.map((c) => c[1])).toEqual(["#111111", "#222222"]);
  await screen.findByText("已保存");
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
  await screen.findByText("3 分");
  expect(screen.queryByText("4 分")).toBeNull();
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
  await screen.findByRole("dialog", { name: "练习已暂停" });
  expect(screen.queryByText("Pick one")).toBeNull();
  expect(screen.queryByText("Alpha")).toBeNull();
});

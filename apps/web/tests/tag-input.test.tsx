// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createSqliteDatabase } from "../../../packages/database/src/index.js";
import { createQuarryServer } from "../../../packages/server/src/app.js";
import { client, type Tag } from "../src/api/client.js";
import { DocumentEditor } from "../src/components/DocumentEditor.js";
import { QuestionEditor } from "../src/components/QuestionEditor.js";
import { TagInput, type DraftTag } from "../src/components/TagInput.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const existing: Tag[] = [
  { id: "one", name: "数学", color: "#386450", target_type: "file" },
  { id: "two", name: "数学史", color: "#CBE5DB", target_type: "file" },
  { id: "three", name: "物理", color: null, target_type: "file" },
];

function Example() {
  const [value, setValue] = useState<DraftTag[]>([]);
  return <TagInput label="文件标签" tags={existing} value={value} onChange={setValue} disabled={false} />;
}

it("commits new names only on Enter, keeps commas, and uses one default color", () => {
  render(<Example />);
  const input = screen.getByRole("combobox", { name: "文件标签" });
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "," });
  fireEvent.change(input, { target: { value: "甲,乙" } });
  fireEvent.blur(input);
  expect(screen.queryByRole("button", { name: /^移除/ })).toBeNull();
  fireEvent.focus(input);
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(screen.queryByRole("button", { name: /^移除/ })).toBeNull();
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.change(input, { target: { value: "丙" } });
  fireEvent.keyDown(input, { key: "Enter" });
  const colors = screen.getAllByRole("button", { name: /^移除/ }).map(
    (button) => button.parentElement!.style.getPropertyValue("--tag-bg"),
  );
  expect(colors).toEqual(["#E4EADE", "#E4EADE"]);
  fireEvent.keyDown(input, { key: "Backspace" });
  expect(screen.queryByRole("button", { name: "移除 丙" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "移除 甲,乙" }));
  expect(screen.queryByRole("button", { name: /^移除/ })).toBeNull();
});

it("filters existing tags and selects a colored suggestion with the arrow keys", () => {
  render(<Example />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "数学" } });
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["数学", "数学史"]);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(screen.getByRole("option", { selected: true }).textContent).toBe("数学史");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByRole("button", { name: "移除 数学史" }).parentElement!.style.getPropertyValue("--tag-bg")).toBe("#CBE5DB");
});

it("keeps cancelled and failed drafts out of SQLite and attaches a new tag on save", async () => {
  const db = await createSqliteDatabase(":memory:");
  try {
    const app = createQuarryServer({ db: db.db });
    vi.spyOn(client, "transport").mockImplementation((url, init) => app.request(String(url), init));
    const saved = vi.fn();
    const closed = vi.fn();
    const doc = render(<DocumentEditor kind="folders" tags={[]} onClose={closed} onSaved={saved} />);
    const fileTag = screen.getByRole("combobox", { name: "文件标签" });
    fireEvent.change(fileTag, { target: { value: "取消的文件标签" } });
    fireEvent.keyDown(fileTag, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(closed).toHaveBeenCalledTimes(1);
    doc.unmount();

    const missingParent = render(
      <DocumentEditor kind="folders" parent={crypto.randomUUID()} tags={[]} onClose={closed} onSaved={saved} />,
    );
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "文件夹" } });
    const unlinkedTag = screen.getByRole("combobox", { name: "文件标签" });
    fireEvent.change(unlinkedTag, { target: { value: "保存失败的标签" } });
    fireEvent.keyDown(unlinkedTag, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByRole("alert");
    expect(await db.repositories.tags.list()).toEqual([]);
    missingParent.unmount();

    const bank = await client.banks.create({ name: "题库" });
    const question = await client.questions.create({
      owner_id: bank.id,
      owner_type: "question_bank",
      type: "subjective",
      content: "题干",
      reference_answer: "参考答案",
    });
    const editor = render(<QuestionEditor question={question} ownerId={bank.id} paper={false} onClose={closed} onSaved={saved} />);
    const questionTag = screen.getByRole("combobox", { name: "题目标签" });
    fireEvent.change(questionTag, { target: { value: "保留,逗号" } });
    fireEvent.keyDown(questionTag, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(closed).toHaveBeenCalledTimes(2);
    expect(await db.repositories.tags.list()).toEqual([]);
    expect(saved).not.toHaveBeenCalled();
    editor.unmount();

    render(<QuestionEditor question={question} ownerId={bank.id} paper={false} onClose={closed} onSaved={saved} />);
    const newTag = screen.getByRole("combobox", { name: "题目标签" });
    fireEvent.change(newTag, { target: { value: "保留,逗号" } });
    fireEvent.keyDown(newTag, { key: "Enter" });
    fireEvent.change(newTag, { target: { value: "未按回车" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    const tags = await client.tags.list("question");
    expect(tags).toEqual([expect.objectContaining({ name: "保留,逗号", color: null })]);
    expect((await client.questions.get(question.id)).tag_ids).toEqual([tags[0]!.id]);
  } finally {
    await db.destroy();
  }
});

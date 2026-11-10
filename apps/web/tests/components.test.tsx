// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { Facet } from "../src/components/ui.js";
import { Answer, emptyAnswer } from "../src/pages/Study.js";
import { closeTab, navigateTab, newTab, formatTime } from "../src/state.js";
import type { QuestionView } from "../src/api/client.js";
const q: QuestionView = {
  id: "q",
  owner_id: "b",
  owner_type: "question_bank",
  version: 1,
  content: "Question",
  type: "multiple_choice",
  tag_ids: [],
  options: [
    { id: "stable-a", content: "Alpha", is_correct: true },
    { id: "stable-b", content: "Beta", is_correct: false },
  ],
  explanation: "Explanation",
};
afterEach(cleanup);
describe("Workspace and study interactions", () => {
  it("retains the last tab and creates independent history", () => {
    const a = newTab(),
      b = newTab();
    expect(a.id).not.toBe(b.id);
    expect(closeTab([a], a.id)).toEqual([a]);
    const visited = navigateTab(a, { page: "library", id: "folder" });
    expect(visited.history).toHaveLength(2);
    expect(b.route.page).toBe("home");
  });
  it("formats timer boundaries", () => {
    expect(formatTime(59)).toBe("00:59");
    expect(formatTime(3600)).toBe("01:00:00");
    expect(formatTime(-1)).toBe("00:00");
  });
  it("selects stable option IDs without showing solutions before submission", () => {
    const changed = vi.fn();
    render(
      <Answer
        q={q}
        answer={emptyAnswer(q)}
        locked={false}
        onChange={changed}
      />,
    );
    fireEvent.click(screen.getByText("Alpha"));
    expect(changed).toHaveBeenCalledWith({
      kind: "choice",
      option_ids: ["stable-a"],
    });
    expect(screen.queryByText("Explanation")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("locks options and reveals accessible grading only after confirmation", () => {
    const changed = vi.fn();
    render(
      <Answer
        q={q}
        answer={{ kind: "choice", option_ids: ["stable-b"] }}
        locked
        reveal
        onChange={changed}
      />,
    );
    fireEvent.click(screen.getByText("Alpha"));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "正确" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "选错" })).toBeTruthy();
    expect(screen.getByText("Explanation")).toBeTruthy();
  });
  it("keeps a multi-select menu mounted and distinguishes all from none", () => {
    function Example() {
      const [value, setValue] = useState<string[]>();
      return (
        <Facet
          label="题型"
          options={[
            { id: "a", name: "甲" },
            { id: "b", name: "乙" },
          ]}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Example />);
    const all = screen.getByLabelText("全选");
    fireEvent.click(all);
    expect(screen.getByText("题型 · 未选择")).toBeTruthy();
    expect((screen.getByLabelText("甲") as HTMLInputElement).checked).toBe(
      false,
    );
    fireEvent.click(screen.getByLabelText("甲"));
    fireEvent.click(screen.getByLabelText("乙"));
    expect(screen.getByText("题型")).toBeTruthy();
    expect(screen.getByLabelText("全选")).toBe(all);
    expect((all as HTMLInputElement).checked).toBe(true);
  });
});

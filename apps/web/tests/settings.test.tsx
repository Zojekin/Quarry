// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { client, type Tag } from "../src/api/client.js";
import { CliGuideCard } from "../src/components/CliGuideCard.js";
import { DiagnosticsCard } from "../src/components/DiagnosticsCard.js";
import { TagManagerCard } from "../src/components/TagManagerCard.js";
import { preferencesKey } from "../src/lib/preferences.js";

// Use the jsdom origin's storage even when Node exposes its own global getter.
beforeEach(() => {
  vi.stubGlobal("localStorage", jsdom.window.localStorage);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("shows the CLI workflow and copies the exact displayed DSL example", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<CliGuideCard />);
  expect(screen.getByText("quarry spec")).toBeTruthy();
  expect(screen.getByText("quarry validate draft.md")).toBeTruthy();
  expect(screen.getByText("quarry convert draft.md -o questions.json")).toBeTruthy();
  expect(screen.getByText("skills/question-converter/SKILL.md")).toBeTruthy();
  const example = document.querySelector("pre")!.textContent;
  expect(example).toContain("## [单选]");
  fireEvent.click(screen.getByRole("button", { name: "复制模板" }));
  expect(writeText).toHaveBeenCalledWith(example);
  await screen.findByText("已复制模板");
});

it("adds and renames a tag, resets its color, and confirms deletion with its use count", async () => {
  const tag: Tag = { id: "t", name: "历史", target_type: "file", color: "#386450" };
  const added: Tag = { ...tag, id: "new", name: "地理", color: null };
  vi.spyOn(client.tags, "listWithUsage").mockResolvedValue([{ ...tag, usage_count: 3 }]);
  const create = vi.spyOn(client.tags, "create").mockResolvedValue(added);
  const update = vi.spyOn(client.tags, "update").mockImplementation(async (_id, patch) => ({ ...tag, name: "近代史", ...patch }));
  const remove = vi.spyOn(client.tags, "delete").mockResolvedValue(null);
  render(<TagManagerCard />);
  expect(await screen.findByText("已用于 3 项")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("新标签名称"), { target: { value: " 地理 " } });
  fireEvent.click(screen.getByRole("button", { name: "添加标签" }));
  expect(await screen.findByText(added.name)).toBeTruthy();
  expect(create).toHaveBeenCalledWith({ name: "地理", target_type: "file" });

  const rename = screen.getByLabelText("历史的新名称");
  fireEvent.change(rename, { target: { value: "近代史" } });
  fireEvent.click(within(rename.closest("form")!).getByRole("button", { name: "重命名" }));
  const color = await screen.findByLabelText("近代史颜色");
  expect(update).toHaveBeenCalledWith(tag.id, { name: "近代史" });
  fireEvent.click(screen.getAllByRole("button", { name: "系统默认" }).find((button) => !button.hasAttribute("disabled"))!);
  await waitFor(() => expect(update).toHaveBeenCalledWith(tag.id, { color: null }));
  expect((color as HTMLInputElement).value).toBe("#e4eade");
  fireEvent.click(await screen.findByRole("button", { name: "删除 近代史" }));
  const dialog = await screen.findByRole("dialog", { name: /已用于 3 项/ });
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));
  await waitFor(() => expect(screen.queryByText("近代史")).toBeNull());
  expect(remove).toHaveBeenCalledWith(tag.id);
});

it("applies the saved font size and uses preferences for workspace defaults after restart", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.localStorage.setItem(preferencesKey, JSON.stringify({ questionSize: "invalid", libraryView: "list" }));
  vi.spyOn(client.tags, "listWithUsage").mockResolvedValue([]);
  vi.spyOn(client.tags, "list").mockResolvedValue([]);
  vi.spyOn(client, "health").mockResolvedValue({ status: "ok", version: "0.3.0", database: "connected", timestamp: 0 });
  vi.spyOn(client.mistakes, "list").mockResolvedValue([]);
  vi.spyOn(client.sessions, "list").mockResolvedValue([]);
  vi.spyOn(client.folders, "list").mockResolvedValue([]);
  vi.spyOn(client.banks, "list").mockResolvedValue([]);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.analytics, "getDashboard").mockResolvedValue({
    daily_heatmap: [], total_duration_seconds: 0, total_questions_answered: 0, deduplicated_questions_count: 0,
  });

  const app = render(<App />);
  expect(document.documentElement.style.getPropertyValue("--question-size")).toBe("19px");
  fireEvent.click(screen.getByRole("button", { name: "系统设置" }));
  expect(await screen.findByRole("heading", { name: "题目转换 CLI 与 AI Skill" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "大号" }));
  fireEvent.click(screen.getByRole("switch", { name: "交卷前二次确认" }));
  fireEvent.click(screen.getByRole("switch", { name: "显示答题快捷键提示" }));
  fireEvent.click(screen.getByRole("switch", { name: "启动时收起侧边栏" }));
  fireEvent.click(within(screen.getByRole("group", { name: "资料库默认视图" })).getByRole("button", { name: "网格" }));
  expect(document.documentElement.style.getPropertyValue("--question-size")).toBe("25px");
  expect(JSON.parse(window.localStorage.getItem(preferencesKey)!)).toEqual({
    questionSize: "large", confirmExamSubmit: false, showShortcutHints: true,
    sidebarCollapsed: true, libraryView: "grid",
  });
  app.unmount();
  render(<App />);
  expect(screen.getByRole("button", { name: "展开导航" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "题库与套题" }));
  const libraryView = await screen.findByRole("button", { name: "网格" });
  expect(libraryView.getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("heading", { name: "题目转换 CLI 与 AI Skill" })).toBeNull();
});

it("reports the health check outcome and can retry", async () => {
  vi.spyOn(client, "health")
    .mockRejectedValueOnce(new Error("服务暂不可用"))
    .mockResolvedValue({ status: "ok", version: "0.3.0", database: "connected", timestamp: 0 });
  render(<DiagnosticsCard />);
  expect(await screen.findByText("连接状态未知")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "重新检测" }));
  expect(await screen.findByText("已连接")).toBeTruthy();
  expect(screen.getByText("运行正常（0.3.0）")).toBeTruthy();
});

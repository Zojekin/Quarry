// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { DesktopCliToolsBridge, DesktopZoomBridge, DesktopZoomLevel } from "@quarry/shared";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { client, type Tag } from "../src/api/client.js";
import { CliGuideCard } from "../src/components/CliGuideCard.js";
import { DiagnosticsCard } from "../src/components/DiagnosticsCard.js";
import { TagManagerCard } from "../src/components/TagManagerCard.js";
import { PreferencesSettingsCard } from "../src/components/PreferencesSettingsCard.js";
import { preferencesKey, updatePreferences, usePreferences } from "../src/lib/preferences.js";

// Use the jsdom origin's storage even when Node exposes its own global getter.
beforeEach(() => {
  vi.stubGlobal("localStorage", jsdom.window.localStorage);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

function selectOption(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.keyDown(screen.getByRole("option", { name: option }), { key: "Enter" });
}

it("uses the browser's own zoom in the absence of a desktop zoom bridge", () => {
  render(<PreferencesSettingsCard />);
  expect(screen.queryByLabelText("界面缩放")).toBeNull();
  expect(screen.getByRole("group", { name: "题目字号" })).toBeTruthy();
});

it("loads desktop zoom, sends the chosen level and follows desktop changes", async () => {
  let notify: (level: DesktopZoomLevel) => void = () => {};
  const unsubscribe = vi.fn();
  const zoom: DesktopZoomBridge = {
    getLevel: vi.fn().mockResolvedValue(85),
    setLevel: vi.fn().mockImplementation(async (level: DesktopZoomLevel) => notify(level)),
    onLevelChange: (callback) => {
      notify = callback;
      return unsubscribe;
    },
  };
  vi.stubGlobal("__QUARRY_DESKTOP__", { zoom });
  const card = render(<PreferencesSettingsCard />);
  const select = screen.getByRole("combobox", { name: "界面缩放" });
  await waitFor(() => expect(select.textContent).toBe("85%"));
  selectOption("界面缩放", "125%");
  expect(zoom.setLevel).toHaveBeenCalledWith(125);
  expect(select.textContent).toBe("125%");
  act(() => notify(150));
  expect(select.textContent).toBe("150%");
  card.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("toggles the Web CLI workflow and copies the prompt, Skill and displayed DSL example", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<CliGuideCard />);
  const toggle = screen.getByRole("switch", { name: "题目转换 CLI 与 AI Skill" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  expect(screen.queryByText("pnpm quarry spec")).toBeNull();
  expect(screen.queryByRole("button", { name: "复制 Agent 提示词" })).toBeNull();
  expect(screen.queryByRole("link", { name: "下载 SKILL.md" })).toBeNull();
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("pnpm quarry spec")).toBeTruthy();
  expect(screen.getByText("pnpm quarry validate draft.md")).toBeTruthy();
  expect(screen.getByText("pnpm quarry convert draft.md -o questions.json")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Skill 安装位置" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "复制 Agent 提示词" }));
  await screen.findByText("已复制提示词");
  const prompt = writeText.mock.calls[0]![0];
  expect(prompt).toContain("question-converter");
  expect(prompt).toContain("请勿解题");
  expect(prompt).toContain("pnpm quarry validate draft.md");
  expect(prompt).toContain("pnpm quarry convert draft.md -o questions.json");

  const link = screen.getByRole<HTMLAnchorElement>("link", { name: "下载 SKILL.md" });
  expect(link.download).toBe("SKILL.md");
  fireEvent.click(screen.getByRole("button", { name: "复制 Skill 内容" }));
  await screen.findByText("已复制Skill 内容");
  const skill = writeText.mock.calls[1]![0];
  expect(skill).toContain("name: question-converter");
  expect(decodeURIComponent(link.href.split(",")[1]!)).toBe(skill);

  const example = document.querySelector("pre")!.textContent;
  expect(example).toContain("## [单选]");
  fireEvent.click(screen.getByRole("button", { name: "复制模板" }));
  expect(writeText).toHaveBeenCalledWith(example);
  await screen.findByText("已复制模板");
  fireEvent.click(toggle);
  expect(screen.queryByRole("heading", { name: "命令速查" })).toBeNull();
  expect(screen.queryByRole("button", { name: "复制模板" })).toBeNull();
});

it("uses desktop CLI info and reports Skill installation results", async () => {
  const cliPath = "C:\\Program Files\\Quarry\\resources\\cli\\index.js";
  const skillDirectory = "C:\\Users\\tester\\.codex\\skills\\question-converter";
  const command = `node '${cliPath}'`;
  const getInfo = vi.fn().mockResolvedValue({
    cli: { path: cliPath, command },
    targets: [{ id: "codex", label: "Codex", path: skillDirectory }],
  });
  const installSkill = vi.fn()
    .mockResolvedValueOnce({ status: "installed", path: skillDirectory + "\\SKILL.md" })
    .mockResolvedValueOnce({ status: "canceled" })
    .mockRejectedValueOnce(new Error("目标已存在"));
  const writeText = vi.fn().mockResolvedValue(undefined);
  const cliTools: DesktopCliToolsBridge = { getInfo, installSkill };
  vi.stubGlobal("__QUARRY_DESKTOP__", { cliTools });
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<CliGuideCard />);
  expect(getInfo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch", { name: "题目转换 CLI 与 AI Skill" }));
  expect(await screen.findByText(`${command} spec`)).toBeTruthy();
  expect(getInfo).toHaveBeenCalledOnce();
  expect(screen.queryByRole("link", { name: "下载 SKILL.md" })).toBeNull();
  expect(screen.queryByRole("button", { name: "复制 Skill 内容" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "复制 Agent 提示词" }));
  await screen.findByText("已复制提示词");
  expect(writeText).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(`${command} validate draft.md`));

  fireEvent.click(screen.getByRole("button", { name: "安装 Skill" }));
  expect(await screen.findByText(`已安装至 ${skillDirectory}\\SKILL.md`)).toBeTruthy();
  expect(installSkill).toHaveBeenNthCalledWith(1, "codex");
  selectOption("Skill 安装位置", "自选目录…");
  const customButton = screen.getByRole<HTMLButtonElement>("button", { name: "选择目录并安装" });
  fireEvent.click(customButton);
  await waitFor(() => expect(customButton.disabled).toBe(false));
  expect(installSkill).toHaveBeenNthCalledWith(2, "custom");
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(customButton);
  expect((await screen.findByRole("alert")).textContent).toContain("目标已存在");
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

it.each([
  [undefined, 38], [null, 38], ["50", 38], [1.5, 2], [-10, 0], [0, 0], [120, 100],
])("normalizes stored glass transparency %s to %s", (stored, expected) => {
  localStorage.setItem(preferencesKey, JSON.stringify({ glassTransparency: stored }));
  const { result } = renderHook(() => usePreferences());
  expect(result.current.glassTransparency).toBe(expected);
});

it("persists only normalized glass transparency values", () => {
  updatePreferences({ glassTransparency: 110.8 });
  expect(JSON.parse(localStorage.getItem(preferencesKey)!).glassTransparency).toBe(100);
  updatePreferences({ glassTransparency: Number.NaN });
  expect(JSON.parse(localStorage.getItem(preferencesKey)!).glassTransparency).toBe(38);
});

it("applies saved display preferences live and restores them after restart", async () => {
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
  const style = document.documentElement.style;
  expect(style.getPropertyValue("--question-size")).toBe("19px");
  expect(style.getPropertyValue("--glass-transparency")).toBe("0.38");
  fireEvent.click(screen.getByRole("button", { name: "系统设置" }));
  expect(await screen.findByRole("heading", { name: "题目转换 CLI 与 AI Skill" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "大号" }));
  fireEvent.click(screen.getByRole("switch", { name: "交卷前二次确认" }));
  fireEvent.click(screen.getByRole("switch", { name: "显示答题快捷键提示" }));
  fireEvent.click(screen.getByRole("switch", { name: "启动时收起侧边栏" }));
  fireEvent.click(within(screen.getByRole("group", { name: "资料库默认视图" })).getByRole("button", { name: "网格" }));
  expect(style.getPropertyValue("--question-size")).toBe("25px");
  const slider = screen.getByRole("slider", { name: "浮层与遮罩磨砂通透度" });
  expect(slider.getAttribute("aria-valuetext")).toBe("38%");
  fireEvent.change(slider, { target: { value: "64" } });
  expect(slider.getAttribute("aria-valuetext")).toBe("64%");
  expect(style.getPropertyValue("--glass-transparency")).toBe("0.64");
  expect(JSON.parse(window.localStorage.getItem(preferencesKey)!)).toEqual({
    questionSize: "large", confirmExamSubmit: false, showShortcutHints: true,
    sidebarCollapsed: true, libraryView: "grid", cliEnabled: false, glassTransparency: 64,
  });
  app.unmount();
  render(<App />);
  expect(style.getPropertyValue("--glass-transparency")).toBe("0.64");
  expect(screen.getByRole("button", { name: "展开导航" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "资料库" }));
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

// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { client } from "../src/api/client.js";
import { ThemeSettingsCard } from "../src/components/ThemeSettingsCard.js";
import { ThemeProvider } from "../src/lib/theme-context.js";
import { bootTheme, darkPreferenceQuery, defaultThemeConfig, minimumContrast, themeStorageKey } from "../src/lib/themes.js";
import { Settings } from "../src/pages/Learning.js";

const root = document.documentElement;
const savedTheme = () => JSON.parse(localStorage.getItem(themeStorageKey)!);

beforeEach(() => {
  // Node also provides a localStorage global in newer releases.
  vi.stubGlobal("localStorage", jsdom.window.localStorage);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  root.removeAttribute("style");
  root.removeAttribute("data-theme-mode");
  root.classList.remove("dark");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockSystemPreference(initial: boolean) {
  const preference = Object.assign(new EventTarget(), { matches: initial });
  const matchMedia = vi.fn(() => preference);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    set(dark: boolean) {
      preference.matches = dark;
      act(() => { preference.dispatchEvent(new Event("change")); });
    },
  };
}

it("applies stored tokens before React and recovers from malformed or unavailable storage", () => {
  const system = mockSystemPreference(true);
  localStorage.setItem(themeStorageKey, JSON.stringify({
    preset: "slate-neutral", mode: "system", activeCustomThemeId: "night",
    customThemes: [
      { id: "paper", name: "春日", basePreset: "pine-paper", colors: { light: {}, dark: {} } },
      { id: "night", name: "夜读", basePreset: "slate-neutral", colors: { light: {}, dark: { sidebar: "#0f1520" } } },
    ],
  }));
  bootTheme(window);
  expect(system.matchMedia).toHaveBeenCalledWith(darkPreferenceQuery);
  expect(root.dataset.themeMode).toBe("dark");
  expect(root.classList.contains("dark")).toBe(true);
  expect(root.style.getPropertyValue("--sidebar")).toBe("#0f1520");
  expect(root.style.getPropertyValue("--background")).toBe("#191d22");

  localStorage.setItem(themeStorageKey, "{");
  bootTheme(window);
  expect(root.dataset.themeMode).toBe("light");
  expect(root.classList.contains("dark")).toBe(false);
  expect(root.style.getPropertyValue("--sidebar")).toBe("#f3f3ee");
  vi.spyOn(Object.getPrototypeOf(localStorage), "getItem").mockImplementation(() => { throw new Error("Storage disabled"); });
  expect(() => bootTheme(window)).not.toThrow();
});

it("updates the root and Windows bridge on system changes only while following the system", () => {
  const system = mockSystemPreference(false);
  const setTitleBarOverlay = vi.fn();
  vi.stubGlobal("__QUARRY_DESKTOP__", { setTitleBarOverlay });
  localStorage.setItem(themeStorageKey, JSON.stringify({ preset: "indigo-ink", mode: "system" }));
  render(<ThemeProvider><ThemeSettingsCard /></ThemeProvider>);
  expect(setTitleBarOverlay).toHaveBeenLastCalledWith({ color: "#f7f8fc", symbolColor: "#3e5287" });

  system.set(true);
  expect(root.dataset.themeMode).toBe("dark");
  expect(root.style.getPropertyValue("--sidebar")).toBe("#1d2334");
  expect(setTitleBarOverlay).toHaveBeenLastCalledWith({ color: "#171b29", symbolColor: "#e9edfa" });
  expect(savedTheme()).toEqual({ preset: "indigo-ink", mode: "system" });
  fireEvent.click(screen.getByRole("button", { name: "日间" }));
  expect(root.dataset.themeMode).toBe("light");
  expect(savedTheme().mode).toBe("light");
  setTitleBarOverlay.mockClear();
  system.set(false);
  expect(setTitleBarOverlay).not.toHaveBeenCalled();
  expect(root.dataset.themeMode).toBe("light");
});

it("refreshes the theme when another renderer changes the stored configuration", () => {
  render(<ThemeProvider><ThemeSettingsCard /></ThemeProvider>);
  localStorage.setItem(themeStorageKey, JSON.stringify({ preset: "slate-neutral", mode: "dark" }));
  fireEvent(window, new StorageEvent("storage", { key: themeStorageKey }));
  expect(root.dataset.themeMode).toBe("dark");
  expect(root.style.getPropertyValue("--primary")).toBe("#adc1d5");
  expect(screen.getByRole("button", { name: "夜间" }).getAttribute("aria-pressed")).toBe("true");
});

it("shows a compact settings grid and saves separate day and night palettes from the dialog", async () => {
  const system = mockSystemPreference(false);
  vi.spyOn(client.tags, "listWithUsage").mockResolvedValue([]);
  vi.spyOn(client, "health").mockResolvedValue({ status: "ok", database: "connected", version: "0.3.0", timestamp: 0 });
  const { unmount } = render(<ThemeProvider><Settings /></ThemeProvider>);
  await screen.findByText("此分类暂无标签。");
  const settings = within(screen.getByRole("region", { name: "外观与主题" }));
  const grid = within(settings.getByRole("group", { name: "主题" }));
  expect(grid.getAllByRole("button").map((button) => button.textContent)).toEqual([
    "松绿纸韵", "青黛书墨", "暖陶琥珀", "石板素灰", "自定义主题",
  ]);
  for (const label of ["主色", "画布", "侧栏", "卡片"]) expect(settings.queryByLabelText(label)).toBeNull();
  expect(settings.queryByRole("meter")).toBeNull();
  expect(settings.queryByRole("button", { name: "自动调整" })).toBeNull();

  const preset = settings.getByRole("button", { name: "暖陶琥珀" });
  fireEvent.click(preset);
  expect(preset.getAttribute("aria-pressed")).toBe("true");
  expect(root.style.getPropertyValue("--primary")).toBe("#8b4c28");

  fireEvent.click(settings.getByRole("button", { name: "夜间" }));
  expect(settings.getByRole("button", { name: "夜间" }).getAttribute("aria-pressed")).toBe("true");
  expect(root.dataset.themeMode).toBe("dark");
  expect(root.style.getPropertyValue("--primary")).toBe("#edb589");

  fireEvent.click(grid.getByRole("button", { name: "新建自定义主题" }));
  const dialog = within(screen.getByRole("dialog", { name: "新建自定义主题" }));
  const name = dialog.getByRole<HTMLInputElement>("textbox", { name: "主题名称" });
  expect(name.value).toBe("自定义主题");
  expect(document.activeElement).toBe(name);
  fireEvent.change(name, { target: { value: "  " } });
  expect((dialog.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(name, { target: { value: "  琥珀夜读  " } });
  const primary = dialog.getByLabelText<HTMLInputElement>("主色");
  expect(primary.value).toBe("#edb589");
  fireEvent.change(primary, { target: { value: "#221b18" } });
  expect(root.style.getPropertyValue("--primary")).toBe("#edb589");
  expect(screen.getByRole("dialog").querySelector('[data-slot="theme-preview"]')?.innerHTML).toContain("rgb(34, 27, 24)");
  expect(dialog.getByText(/低于 WCAG AA/)).toBeTruthy();
  expect(dialog.getByRole<HTMLMeterElement>("meter").value).toBeLessThan(minimumContrast);
  fireEvent.click(dialog.getByRole("button", { name: "自动调整" }));
  expect(dialog.queryByText(/低于 WCAG AA/)).toBeNull();
  expect(dialog.getByRole<HTMLMeterElement>("meter").value).toBeGreaterThanOrEqual(minimumContrast);
  const darkPrimary = primary.value;
  fireEvent.click(dialog.getByRole("button", { name: "日间" }));
  expect(primary.value).toBe("#8b4c28");
  fireEvent.change(primary, { target: { value: "#205c48" } });
  fireEvent.click(dialog.getByRole("button", { name: "保存" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(grid.getByRole("button", { name: "琥珀夜读" }).getAttribute("aria-pressed")).toBe("true");
  expect(preset.getAttribute("aria-pressed")).toBe("false");
  expect(root.style.getPropertyValue("--primary")).toBe(darkPrimary);
  expect(savedTheme()).toMatchObject({
    preset: "amber-clay", mode: "dark", activeCustomThemeId: expect.any(String),
    customThemes: [{
      id: savedTheme().activeCustomThemeId, basePreset: "amber-clay", name: "琥珀夜读",
      colors: { light: { primary: "#205c48" }, dark: { primary: darkPrimary } },
    }],
  });

  fireEvent.click(settings.getByRole("button", { name: "跟随系统" }));
  expect(root.style.getPropertyValue("--primary")).toBe("#205c48");
  system.set(true);
  expect(root.style.getPropertyValue("--primary")).toBe(darkPrimary);

  unmount();
  render(<ThemeProvider><Settings /></ThemeProvider>);
  await screen.findByText("此分类暂无标签。");
  expect(root.style.getPropertyValue("--primary")).toBe(darkPrimary);
  fireEvent.click(screen.getByRole("button", { name: "恢复默认主题" }));
  expect(savedTheme()).toEqual({ ...defaultThemeConfig, customThemes: savedTheme().customThemes });
  expect(screen.getByRole("button", { name: "琥珀夜读" }).getAttribute("aria-pressed")).toBe("false");
  expect(root.dataset.themeMode).toBe("light");
  expect(root.style.getPropertyValue("--primary")).toBe("#2d5c48");
});

it("edits and deletes named themes without selecting them when opening their actions", () => {
  render(<ThemeProvider><ThemeSettingsCard /></ThemeProvider>);
  const create = (name: string) => {
    fireEvent.click(screen.getByRole("button", { name: "新建自定义主题" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByRole("textbox", { name: "主题名称" }), { target: { value: name } });
    fireEvent.click(dialog.getByRole("button", { name: "保存" }));
  };
  create("竹纸");
  fireEvent.click(screen.getByRole("button", { name: "青黛书墨" }));
  create("青墨");
  expect(savedTheme().customThemes.map(({ name }: { name: string }) => name)).toEqual(["竹纸", "青墨"]);

  const activeBeforeEdit = savedTheme().activeCustomThemeId;
  fireEvent.click(screen.getByRole("button", { name: "编辑 竹纸" }));
  expect(savedTheme().activeCustomThemeId).toBe(activeBeforeEdit);
  let dialog = within(screen.getByRole("dialog", { name: "编辑自定义主题" }));
  fireEvent.change(dialog.getByRole("textbox", { name: "主题名称" }), { target: { value: "青墨" } });
  fireEvent.change(dialog.getByLabelText("侧栏"), { target: { value: "#000000" } });
  expect(dialog.getByText("已有同名主题。")).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "取消" }));
  expect(screen.getByRole("button", { name: "竹纸", exact: true }).getAttribute("aria-pressed")).toBe("false");

  fireEvent.click(screen.getByRole("button", { name: "编辑 竹纸" }));
  dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByLabelText<HTMLInputElement>("侧栏").value).toBe("#f3f3ee");
  fireEvent.change(dialog.getByRole("textbox", { name: "主题名称" }), { target: { value: "春竹" } });
  fireEvent.change(dialog.getByLabelText("侧栏"), { target: { value: "#e8ede5" } });
  fireEvent.click(dialog.getByRole("button", { name: "保存" }));
  expect(screen.queryByRole("button", { name: "竹纸", exact: true })).toBeNull();
  expect(screen.getByRole("button", { name: "春竹", exact: true }).getAttribute("aria-pressed")).toBe("true");
  expect(root.style.getPropertyValue("--sidebar")).toBe("#e8ede5");

  const activeBeforeDelete = savedTheme().activeCustomThemeId;
  fireEvent.click(screen.getByRole("button", { name: "删除 青墨" }));
  expect(savedTheme().activeCustomThemeId).toBe(activeBeforeDelete);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "取消" }));
  expect(screen.getByRole("button", { name: "青墨", exact: true })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "删除 春竹" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "删除「春竹」？" })).getByRole("button", { name: "删除" }));
  expect(screen.queryByRole("button", { name: "春竹", exact: true })).toBeNull();
  expect(screen.getByRole("button", { name: "松绿纸韵" }).getAttribute("aria-pressed")).toBe("true");
  expect(root.style.getPropertyValue("--sidebar")).toBe("#f3f3ee");
  expect(savedTheme().activeCustomThemeId).toBeUndefined();
  expect(savedTheme().customThemes).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "青墨", exact: true }));
  expect(savedTheme().activeCustomThemeId).toBe(activeBeforeEdit);
  expect(root.style.getPropertyValue("--sidebar")).toBe("#eef0f8");

  fireEvent.click(screen.getByRole("button", { name: "删除 青墨" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "删除" }));
  expect(savedTheme()).toEqual({ preset: "indigo-ink", mode: "light" });
  expect(screen.getByRole("button", { name: "青黛书墨" }).getAttribute("aria-pressed")).toBe("true");
});

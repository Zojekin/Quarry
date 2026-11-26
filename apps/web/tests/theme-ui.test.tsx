// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { client } from "../src/api/client.js";
import { ThemeModeToggle } from "../src/components/ThemeModeToggle.js";
import { ThemeProvider } from "../src/lib/theme-context.js";
import { bootTheme, darkPreferenceQuery, defaultThemeConfig, themeStorageKey } from "../src/lib/themes.js";
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
    preset: "slate-neutral", mode: "system", custom: { sidebar: "#0f1520" },
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
  render(<ThemeProvider><ThemeModeToggle /></ThemeProvider>);
  expect(setTitleBarOverlay).toHaveBeenLastCalledWith({ color: "#eef0f8", symbolColor: "#3e5287" });

  system.set(true);
  expect(root.dataset.themeMode).toBe("dark");
  expect(root.style.getPropertyValue("--sidebar")).toBe("#1d2334");
  expect(setTitleBarOverlay).toHaveBeenLastCalledWith({ color: "#1d2334", symbolColor: "#e9edfa" });
  expect(savedTheme()).toEqual({ preset: "indigo-ink", mode: "system" });
  fireEvent.click(screen.getByRole("button", { name: "外观模式：跟随系统，切换至日间" }));
  expect(root.dataset.themeMode).toBe("light");
  expect(savedTheme().mode).toBe("light");
  setTitleBarOverlay.mockClear();
  system.set(false);
  expect(setTitleBarOverlay).not.toHaveBeenCalled();
  expect(root.dataset.themeMode).toBe("light");
});

it("refreshes the theme when another renderer changes the stored configuration", () => {
  render(<ThemeProvider><ThemeModeToggle /></ThemeProvider>);
  localStorage.setItem(themeStorageKey, JSON.stringify({ preset: "slate-neutral", mode: "dark" }));
  fireEvent(window, new StorageEvent("storage", { key: themeStorageKey }));
  expect(root.dataset.themeMode).toBe("dark");
  expect(root.style.getPropertyValue("--primary")).toBe("#adc1d5");
  expect(screen.getByRole("button", { name: "外观模式：夜间，切换至跟随系统" })).toBeTruthy();
});

it("shares theme state between Settings and the titlebar, previews overrides, fixes contrast and resets", async () => {
  vi.spyOn(client.tags, "listWithUsage").mockResolvedValue([]);
  vi.spyOn(client, "health").mockResolvedValue({ status: "ok", database: "connected", version: "0.3.0", timestamp: 0 });
  const { unmount } = render(<ThemeProvider><ThemeModeToggle /><Settings /></ThemeProvider>);
  await screen.findByText("此分类暂无标签。");
  const settings = within(screen.getByRole("region", { name: "外观与主题" }));
  const preset = settings.getByRole("button", { name: "暖陶琥珀" });
  fireEvent.click(preset);
  expect(preset.getAttribute("aria-pressed")).toBe("true");
  expect(root.style.getPropertyValue("--primary")).toBe("#8b4c28");

  fireEvent.click(screen.getByRole("button", { name: "外观模式：日间，切换至夜间" }));
  expect(settings.getByRole("button", { name: "夜间" }).getAttribute("aria-pressed")).toBe("true");
  expect(root.dataset.themeMode).toBe("dark");
  expect(root.style.getPropertyValue("--primary")).toBe("#edb589");

  const primary = settings.getByLabelText("主色");
  fireEvent.change(primary, { target: { value: "#221b18" } });
  expect(root.style.getPropertyValue("--primary")).toBe("#221b18");
  expect(preset.querySelector("[aria-hidden=true] > span:last-child > span:last-child")?.getAttribute("style")).toContain("rgb(34, 27, 24)");
  expect(settings.getByText(/低于 WCAG AA/)).toBeTruthy();
  expect((settings.getByRole("meter") as HTMLMeterElement).value).toBeLessThan(4.5);
  fireEvent.click(settings.getByRole("button", { name: "自动调整" }));
  expect(settings.queryByText(/低于 WCAG AA/)).toBeNull();
  expect((settings.getByRole("meter") as HTMLMeterElement).value).toBeGreaterThanOrEqual(4.5);
  expect(savedTheme()).toMatchObject({ preset: "amber-clay", mode: "dark", custom: { primary: expect.any(String) } });

  unmount();
  render(<ThemeProvider><Settings /></ThemeProvider>);
  await screen.findByText("此分类暂无标签。");
  expect(root.style.getPropertyValue("--primary")).toBe(savedTheme().custom.primary);
  fireEvent.click(screen.getByRole("button", { name: "恢复默认主题" }));
  expect(savedTheme()).toEqual(defaultThemeConfig);
  expect(root.dataset.themeMode).toBe("light");
  expect(root.style.getPropertyValue("--primary")).toBe("#2d5c48");
});

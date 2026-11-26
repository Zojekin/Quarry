import { describe, expect, it } from "vitest";
import {
  contrastRatio, customThemeNameLimit, defaultThemeConfig, fixThemeContrast, minimumContrast, normalizeThemeConfig,
  resolveTheme, resolveThemePalette, themeContrast, themePresets,
  type ThemePreset,
} from "../src/lib/themes.js";

const presets = Object.keys(themePresets) as ThemePreset[];

describe("theme palettes", () => {
  it("preserves the original pine-paper day tokens", () => {
    const theme = resolveTheme(defaultThemeConfig, true);
    expect(theme.mode).toBe("light");
    expect(theme.tokens).toMatchObject({
      background: "#fafaf7", sidebar: "#f3f3ee", card: "#ffffff", primary: "#2d5c48",
      "primary-hover": "#224737", "primary-foreground": "#ffffff",
      "selection-bg": "#f6efd9", "selection-border": "#d7c797", "selection-ink": "#5a4b28",
      "success-bg": "#e7f4ec", "error-bg": "#fbeceb", "heat-4": "#2d5c48",
      accent: "#e8f0ea", border: "rgba(23, 27, 25, 0.09)", "code-bg": "#f5f5f0",
    });
    expect(theme.overlay).toEqual({ color: "#fafaf7", symbolColor: "#2d5c48" });
  });

  it.each(presets)("keeps both %s palettes legible and distinct", (preset) => {
    const light = resolveTheme({ preset, mode: "system" }, false);
    const dark = resolveTheme({ preset, mode: "system" }, true);
    expect(light.mode).toBe("light");
    expect(dark.mode).toBe("dark");
    expect(dark.tokens.background).not.toBe(light.tokens.background);
    for (const theme of [light, dark]) {
      const { tokens, overlay } = theme;
      const { primary, button, foreground } = themeContrast(theme);
      expect(Math.min(primary, button, ...foreground.map((pair) => pair.ratio))).toBeGreaterThanOrEqual(minimumContrast);
      for (const [fg, bg] of [
        [tokens["primary-foreground"], tokens["primary-hover"]],
        [tokens["accent-foreground"], tokens.accent],
        [tokens["selection-ink"], tokens["selection-bg"]],
        [tokens["success-fg"], tokens["success-bg"]],
        [tokens["error-fg"], tokens["error-bg"]],
        [tokens["warning-fg"], tokens["warning-bg"]],
        [tokens["info-fg"], tokens["info-bg"]],
        [tokens["destructive-foreground"], tokens.destructive],
        [overlay.symbolColor, overlay.color],
      ] as const) {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minimumContrast);
      }
      const heat = [tokens["heat-0"], tokens["heat-1"], tokens["heat-2"], tokens["heat-3"], tokens["heat-4"]];
      expect(new Set(heat).size).toBe(5);
    }
  });

  it("derives custom states from all four overrides and falls back to a legible titlebar symbol", () => {
    const base = resolveTheme(defaultThemeConfig, false);
    const custom = { primary: "#faf9f8", background: "#eeeeee", card: "#eaeaea", sidebar: "#fafafa" };
    const theme = resolveThemePalette("pine-paper", "light", custom);
    expect(theme.tokens).toMatchObject({ ...custom, "primary-foreground": "#000000", popover: custom.card });
    for (const key of ["primary-hover", "accent", "accent-foreground", "ring", "selection-bg", "heat-4"] as const) {
      expect(theme.tokens[key]).not.toBe(base.tokens[key]);
    }
    expect(theme.overlay).toEqual({ color: custom.background, symbolColor: theme.tokens.foreground });
    expect(theme.tokens["success-bg"]).toBe(base.tokens["success-bg"]);
  });

  it("recovers from incomplete, malformed, and unknown stored values", () => {
    expect(normalizeThemeConfig(null)).toEqual(defaultThemeConfig);
    expect(normalizeThemeConfig({ preset: "__proto__", mode: "solar", custom: { primary: "#123", background: "red" } })).toEqual(defaultThemeConfig);
  });

  it("migrates legacy overrides into a selected named theme in both modes", () => {
    const migrated = normalizeThemeConfig({
      preset: "amber-clay", mode: "system",
      custom: { primary: "#AABBCC", background: 0, card: "#deface", extra: "#ff0000" },
    });
    const colors = { primary: "#aabbcc", card: "#deface" };
    expect(migrated).toEqual({
      preset: "amber-clay", mode: "system", activeCustomThemeId: "legacy-custom",
      customThemes: [{
        id: "legacy-custom", name: "自定义主题", basePreset: "amber-clay",
        colors: { light: colors, dark: colors },
      }],
    });
    expect(resolveTheme(migrated, false).tokens).toMatchObject(colors);
    expect(resolveTheme(migrated, true).tokens).toMatchObject(colors);
    expect(normalizeThemeConfig(migrated)).toEqual(migrated);
  });

  it("normalizes named themes and resolves only the selected theme's current mode", () => {
    const config = normalizeThemeConfig({
      preset: "slate-neutral", mode: "system", activeCustomThemeId: "ink",
      customThemes: [
        { id: "ink", name: " 青墨 ", basePreset: "indigo-ink", colors: {
          light: { primary: "#ABCDEF", sidebar: "blue" }, dark: { card: "#242400" },
        } },
        { id: "ink", name: "重复 ID" },
        { id: "invalid", name: " " },
        { id: "paper", name: "纸".repeat(50), basePreset: "__proto__", colors: null },
      ],
    });
    expect(config).toEqual({
      preset: "indigo-ink", mode: "system", activeCustomThemeId: "ink",
      customThemes: [
        {
          id: "ink", name: "青墨", basePreset: "indigo-ink",
          colors: { light: { primary: "#abcdef" }, dark: { card: "#242400" } },
        },
        {
          id: "paper", name: "纸".repeat(customThemeNameLimit), basePreset: "pine-paper",
          colors: { light: {}, dark: {} },
        },
      ],
    });
    expect(resolveTheme(config, false).tokens).toMatchObject({ primary: "#abcdef", sidebar: "#eef0f8" });
    expect(resolveTheme(config, true).tokens).toMatchObject({ card: "#242400", primary: "#a8b9f2" });
    expect(resolveTheme({ ...config, activeCustomThemeId: "paper" }, true).tokens.background).toBe("#151c18");
    const fallback = normalizeThemeConfig({ ...config, activeCustomThemeId: "missing" });
    expect(fallback.activeCustomThemeId).toBeUndefined();
    expect(resolveTheme(fallback, true).tokens.card).toBe("#242b40");
  });
});

describe("contrast", () => {
  it("uses WCAG relative luminance with a real 4.5:1 threshold", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#1a1b1c", "#1a1b1c")).toBe(1);
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
    expect(contrastRatio("#111111", "#bbbbbb")).toBe(contrastRatio("#bbbbbb", "#111111"));
  });

  it.each([
    { mode: "light", primary: "#fffff0", badSurface: "#0e1520", goodCard: "#fffbf4" },
    { mode: "dark", primary: "#151412", badSurface: "#fff0ef", goodCard: "#272727" },
  ] as const)("adjusts only failing colors in the $mode palette", ({ mode, primary, badSurface, goodCard }) => {
    const preset = "amber-clay";
    const colors = { primary, background: badSurface, sidebar: badSurface, card: goodCard };
    const before = themeContrast(resolveThemePalette(preset, mode, colors));
    expect(before.foreground[0]!.ratio).toBeLessThan(minimumContrast);
    const fixed = fixThemeContrast(preset, mode, colors);
    expect(fixed.card).toBe(goodCard);
    expect(fixed.primary).not.toBe(primary);
    expect(fixed.background).not.toBe(badSurface);
    const after = themeContrast(resolveThemePalette(preset, mode, fixed));
    expect(Math.min(after.primary, after.button, ...after.foreground.map((pair) => pair.ratio))).toBeGreaterThanOrEqual(minimumContrast);
    expect(fixThemeContrast(preset, mode, fixed)).toEqual(fixed);
  });
});

import { describe, expect, it } from "vitest";
import {
  contrastRatio, defaultThemeConfig, fixThemeContrast, minimumContrast, normalizeThemeConfig,
  resolveTheme, themeContrast, themePresets,
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
    expect(theme.overlay).toEqual({ color: "#f3f3ee", symbolColor: "#2d5c48" });
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
    const theme = resolveTheme({ ...defaultThemeConfig, custom }, false);
    expect(theme.tokens).toMatchObject({ ...custom, "primary-foreground": "#000000", popover: custom.card });
    for (const key of ["primary-hover", "accent", "accent-foreground", "ring", "selection-bg", "heat-4"] as const) {
      expect(theme.tokens[key]).not.toBe(base.tokens[key]);
    }
    expect(theme.overlay).toEqual({ color: custom.sidebar, symbolColor: theme.tokens.foreground });
    expect(theme.tokens["success-bg"]).toBe(base.tokens["success-bg"]);
  });

  it("recovers from incomplete, malformed, and unknown stored values", () => {
    expect(normalizeThemeConfig(null)).toEqual(defaultThemeConfig);
    expect(normalizeThemeConfig({ preset: "__proto__", mode: "solar", custom: { primary: "#123", background: "red" } })).toEqual(defaultThemeConfig);
    expect(normalizeThemeConfig({
      preset: "amber-clay", mode: "system",
      custom: { primary: "#AABBCC", background: 0, card: "#deface", extra: "#ff0000" },
    })).toEqual({ preset: "amber-clay", mode: "system", custom: { primary: "#aabbcc", card: "#deface" } });
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
    { prefersDark: false, primary: "#fffff0", badSurface: "#0e1520", goodCard: "#fffbf4" },
    { prefersDark: true, primary: "#151412", badSurface: "#fff0ef", goodCard: "#272727" },
  ])("adjusts only failing colors when system dark is $prefersDark", ({ prefersDark, primary, badSurface, goodCard }) => {
    const config = {
      preset: "amber-clay", mode: "system",
      custom: { primary, background: badSurface, sidebar: badSurface, card: goodCard },
    } as const;
    const before = themeContrast(resolveTheme(config, prefersDark));
    expect(before.foreground[0]!.ratio).toBeLessThan(minimumContrast);
    const fixed = fixThemeContrast(config, prefersDark);
    expect(fixed).toMatchObject({ preset: config.preset, mode: config.mode, custom: { card: goodCard } });
    expect(fixed.custom?.primary).not.toBe(primary);
    expect(fixed.custom?.background).not.toBe(badSurface);
    const after = themeContrast(resolveTheme(fixed, prefersDark));
    expect(Math.min(after.primary, after.button, ...after.foreground.map((pair) => pair.ratio))).toBeGreaterThanOrEqual(minimumContrast);
    expect(fixThemeContrast(fixed, prefersDark)).toEqual(fixed);
  });
});

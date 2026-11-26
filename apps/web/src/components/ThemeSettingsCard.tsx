import type { CSSProperties } from "react";
import { Check, RotateCcw } from "lucide-react";
import { useTheme } from "../lib/theme-context.js";
import {
  customColorKeys, defaultThemeConfig, fixThemeContrast, minimumContrast, resolveTheme,
  themeContrast, themeModes, themePresets,
} from "../lib/themes.js";
import type { CustomColorKey, ResolvedTheme, ThemePreset } from "../lib/themes.js";
import { cn } from "../lib/utils.js";
import { themeModeLabels } from "./ThemeModeToggle.js";
import { Segmented } from "./ui.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.js";

const presets = Object.keys(themePresets) as ThemePreset[];
const modeOptions = themeModes.map((mode) => [mode, themeModeLabels[mode]] as const);
const colorLabels: Record<CustomColorKey, string> = {
  primary: "主色",
  background: "画布",
  sidebar: "侧栏",
  card: "卡片",
};

function Swatch({ tokens }: { tokens: ResolvedTheme["tokens"] }) {
  return (
    <span aria-hidden="true" className="flex h-12 overflow-hidden rounded-md border border-border" style={{ background: tokens.background }}>
      <span className="h-full w-1/4 shrink-0" style={{ background: tokens.sidebar }} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5 p-1.5">
        <span className="flex h-full min-w-0 flex-1 flex-col justify-center gap-1 rounded-sm border border-current/10 px-1.5" style={{ background: tokens.card, color: tokens.foreground }}>
          <span className="h-0.75 w-3/4 rounded-full bg-current opacity-65" />
          <span className="h-0.75 w-1/2 rounded-full bg-current opacity-30" />
        </span>
        <span className="size-3 shrink-0 rounded-full" style={{ background: tokens.primary }} />
      </span>
    </span>
  );
}

export function ThemeSettingsCard() {
  const { config, setConfig, theme, prefersDark } = useTheme();
  const { foreground, primary, button } = themeContrast(theme);
  const ratio = Math.min(primary, button, ...foreground.map((pair) => pair.ratio));
  const passes = ratio >= minimumContrast;
  const lowContrast = foreground
    .filter((pair) => pair.ratio < minimumContrast)
    .map((pair) => `${colorLabels[pair.surface]}文字`);
  if (primary < minimumContrast) lowContrast.push("主色文字");
  const canReset = config.preset !== defaultThemeConfig.preset ||
    config.mode !== defaultThemeConfig.mode || Boolean(config.custom);
  // Keep the controls legible while the user previews a low-contrast card color.
  const presetTheme = resolveTheme({ preset: config.preset, mode: theme.mode }, prefersDark);
  const legibleCard = foreground.some((pair) => pair.surface === "card" && pair.ratio < minimumContrast)
    ? Object.fromEntries(Object.entries(presetTheme.tokens).map(([key, value]) => [`--${key}`, value])) as CSSProperties
    : undefined;

  return (
    <Card as="section" aria-label="外观与主题" style={legibleCard}>
      <CardHeader className="flex-wrap items-center">
        <CardTitle>外观与主题</CardTitle>
        <Segmented label="外观模式" value={config.mode} options={modeOptions}
          onChange={(mode) => setConfig({ ...config, mode })} />
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="预设主题">
          {presets.map((preset) => {
            const active = preset === config.preset;
            const preview = active ? theme : resolveTheme({ preset, mode: theme.mode }, prefersDark);
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                onClick={() => setConfig({ ...config, preset })}
                className={cn(
                  "min-w-0 rounded-lg border p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active ? "border-primary bg-accent" : "border-border hover:bg-muted",
                )}
              >
                <Swatch tokens={preview.tokens} />
                <span className={cn("flex items-center justify-between gap-1 px-0.5 pt-1.5 text-[12px] font-medium", active && "text-accent-foreground")}>
                  {themePresets[preset].label}
                  {active && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 text-[13px] font-semibold">自定义颜色</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {customColorKeys.map((key) => (
              <label key={key} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-input p-1.5 text-[12px]">
                <input
                  aria-label={colorLabels[key]}
                  type="color"
                  value={theme.tokens[key]}
                  className="size-7 shrink-0 cursor-pointer rounded-sm border-none bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-ring"
                  onChange={(event) => setConfig({ ...config, custom: { ...config.custom, [key]: event.target.value } })}
                />
                <span className="leading-tight">
                  {colorLabels[key]}
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{theme.tokens[key]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div aria-live="polite" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            <span className="font-medium">最低文字对比度</span>
            <meter aria-label="最低文字对比度" min={1} max={21} low={minimumContrast}
              optimum={21} value={ratio} className="w-13" />
            <span className="font-mono tabular-nums">{(Math.floor(ratio * 100) / 100).toFixed(2)}:1</span>
            {!passes && <span className="text-[var(--error-fg)]">{lowContrast.join("、")}低于 WCAG AA（4.5:1）</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!passes && <Button variant="outline" size="sm" onClick={() => setConfig(fixThemeContrast(config, prefersDark))}>自动调整</Button>}
            <Button variant="ghost" size="sm" disabled={!canReset} onClick={() => setConfig(defaultThemeConfig)}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              恢复默认主题
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

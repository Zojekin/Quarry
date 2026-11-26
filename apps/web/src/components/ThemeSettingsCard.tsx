import { useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useTheme } from "../lib/theme-context.js";
import {
  customColorKeys, customThemeNameLimit, defaultThemeConfig, fixThemeContrast, minimumContrast, resolveThemePalette,
  themeContrast, themeModes, themePresets,
} from "../lib/themes.js";
import type { CustomColorKey, CustomColors, CustomTheme, ResolvedTheme, ResolvedThemeMode, ThemePreset } from "../lib/themes.js";
import { cn } from "../lib/utils.js";
import { themeModeLabels } from "./ThemeModeToggle.js";
import { Modal, Segmented } from "./ui.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.js";
import { Input } from "./ui/input.js";

const presets = Object.keys(themePresets) as ThemePreset[];
const modeOptions = themeModes.map((mode) => [mode, themeModeLabels[mode]] as const);
const paletteModes = [["light", themeModeLabels.light], ["dark", themeModeLabels.dark]] as const;
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

function ThemeTile({ name, tokens, active, onSelect, actions }: {
  name: string;
  tokens: ResolvedTheme["tokens"];
  active: boolean;
  onSelect: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-lg border", active ? "border-primary bg-accent" : "border-border")}>
      <button
        type="button"
        title={name}
        aria-pressed={active}
        onClick={onSelect}
        className={cn(
          "w-full min-w-0 rounded-md p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          !active && "hover:bg-muted",
        )}
      >
        <Swatch tokens={tokens} />
        <span className={cn("flex items-center justify-between gap-1 px-0.5 pt-1.5 text-[12px] font-medium", active && "text-accent-foreground")}>
          <span className="truncate">{name}</span>
          {active && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
        </span>
      </button>
      {actions && <div className="flex justify-end gap-0.5 px-1.5 pb-1.5">{actions}</div>}
    </div>
  );
}

function ThemeEditor({ initial, isNew, initialMode, customThemes, style, onSave, onClose }: {
  initial: CustomTheme;
  isNew: boolean;
  initialMode: ResolvedThemeMode;
  customThemes: CustomTheme[];
  style: CSSProperties | undefined;
  onSave: (theme: CustomTheme) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [mode, setMode] = useState(initialMode);
  const nameErrorId = useId();
  const name = draft.name.trim();
  const duplicateName = customThemes.some((entry) => entry.id !== draft.id && entry.name === name);
  const preview = resolveThemePalette(draft.basePreset, mode, draft.colors[mode]);
  const { foreground, primary, button } = themeContrast(preview);
  const ratio = Math.min(primary, button, ...foreground.map((pair) => pair.ratio));
  const passes = ratio >= minimumContrast;
  const lowContrast = foreground
    .filter((pair) => pair.ratio < minimumContrast)
    .map((pair) => `${colorLabels[pair.surface]}文字`);
  if (primary < minimumContrast) lowContrast.push("主色文字");

  function updateColors(colors: CustomColors) {
    setDraft({ ...draft, colors: { ...draft.colors, [mode]: colors } });
  }

  return (
    <Modal
      title={isNew ? "新建自定义主题" : "编辑自定义主题"}
      onClose={onClose}
      style={style}
      onSubmit={() => {
        if (name && !duplicateName) onSave({ ...draft, name });
      }}
      actions={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="default" type="submit" disabled={!name || duplicateName}>保存</Button>
        </>
      }
    >
      <label className="block space-y-1.5">
        <span className="font-medium">主题名称</span>
        <Input
          value={draft.name}
          maxLength={customThemeNameLimit}
          required
          aria-invalid={duplicateName}
          aria-describedby={duplicateName ? nameErrorId : undefined}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      {duplicateName && <p id={nameErrorId} className="text-[var(--error-fg)]">已有同名主题。</p>}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">配色预览</span>
          <Segmented label="配色模式" value={mode} options={paletteModes} onChange={setMode} />
        </div>
        <div data-slot="theme-preview"><Swatch tokens={preview.tokens} /></div>
      </div>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-2 text-[13px] font-semibold">自定义颜色</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {customColorKeys.map((key) => (
            <label key={key} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-input p-1.5 text-[12px]">
              <input
                aria-label={colorLabels[key]}
                type="color"
                value={preview.tokens[key]}
                className="size-7 shrink-0 cursor-pointer rounded-sm border-none bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-ring"
                onChange={(event) => updateColors({ ...draft.colors[mode], [key]: event.target.value })}
              />
              <span className="leading-tight">
                {colorLabels[key]}
                <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{preview.tokens[key]}</span>
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
        {!passes && (
          <Button size="sm" onClick={() => updateColors(fixThemeContrast(draft.basePreset, mode, draft.colors[mode]))}>
            自动调整
          </Button>
        )}
      </div>
    </Modal>
  );
}

export function ThemeSettingsCard() {
  const { config, setConfig, theme, saveCustomTheme, deleteCustomTheme } = useTheme();
  const [editor, setEditor] = useState<{ initial: CustomTheme; isNew: boolean } | null>(null);
  const [deleting, setDeleting] = useState<CustomTheme | null>(null);
  const { customThemes = [], activeCustomThemeId } = config;
  const canReset = config.preset !== defaultThemeConfig.preset ||
    config.mode !== defaultThemeConfig.mode || Boolean(activeCustomThemeId);
  // Retain readable settings and dialog controls even when a saved palette has low contrast.
  const contrast = themeContrast(theme);
  const needsFallback = contrast.primary < minimumContrast ||
    contrast.foreground.some(({ surface, ratio }) => surface === "card" && ratio < minimumContrast);
  const style = needsFallback
    ? Object.fromEntries(Object.entries(resolveThemePalette(config.preset, theme.mode).tokens)
      .map(([key, value]) => [`--${key}`, value])) as CSSProperties
    : undefined;

  function createTheme() {
    const names = new Set(customThemes.map((entry) => entry.name));
    let name = "自定义主题";
    for (let number = 2; names.has(name); number++) name = `自定义主题 ${number}`;
    setEditor({
      isNew: true,
      initial: { id: crypto.randomUUID(), name, basePreset: config.preset, colors: { light: {}, dark: {} } },
    });
  }

  return (
    <Card as="section" aria-label="外观与主题" style={style}>
      <CardHeader className="flex-wrap items-center">
        <CardTitle>外观与主题</CardTitle>
        <Segmented label="外观模式" value={config.mode} options={modeOptions}
          onChange={(mode) => setConfig({ ...config, mode })} />
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="主题">
          {presets.map((preset) => (
            <ThemeTile
              key={preset}
              name={themePresets[preset].label}
              active={!activeCustomThemeId && preset === config.preset}
              tokens={resolveThemePalette(preset, theme.mode).tokens}
              onSelect={() => setConfig({ ...config, preset, activeCustomThemeId: undefined })}
            />
          ))}
          {customThemes.map((entry) => (
            <ThemeTile
              key={entry.id}
              name={entry.name}
              active={entry.id === activeCustomThemeId}
              tokens={resolveThemePalette(entry.basePreset, theme.mode, entry.colors[theme.mode]).tokens}
              onSelect={() => setConfig({ ...config, activeCustomThemeId: entry.id })}
              actions={
                <>
                  <Button variant="ghost" size="iconSm" aria-label={`编辑 ${entry.name}`} title="编辑"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditor({ initial: entry, isNew: false });
                    }}>
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button variant="destructiveGhost" size="iconSm" aria-label={`删除 ${entry.name}`} title="删除"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleting(entry);
                    }}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </>
              }
            />
          ))}
          <Button variant="ghost" className="h-auto min-h-20 min-w-0 whitespace-normal border-dashed border-input"
            aria-label="新建自定义主题"
            onClick={createTheme}>
            <Plus aria-hidden="true" />
            自定义主题
          </Button>
        </div>
        <Button variant="ghost" size="sm" disabled={!canReset}
          onClick={() => setConfig({ ...defaultThemeConfig, customThemes })}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          恢复默认主题
        </Button>
        {editor && (
          <ThemeEditor
            {...editor}
            style={style}
            initialMode={theme.mode}
            customThemes={customThemes}
            onClose={() => setEditor(null)}
            onSave={(draft) => {
              saveCustomTheme(draft);
              setEditor(null);
            }}
          />
        )}
        {deleting && (
          <Modal
            title={`删除「${deleting.name}」？`}
            style={style}
            onClose={() => setDeleting(null)}
            onSubmit={() => {
              deleteCustomTheme(deleting.id);
              setDeleting(null);
            }}
            actions={
              <>
                <Button onClick={() => setDeleting(null)}>取消</Button>
                <Button variant="destructive" type="submit">删除</Button>
              </>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

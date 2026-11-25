// Keep this module dependency-free so Vite can inline the same resolver in the head.
export const themeModes = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof themeModes)[number];
export type ResolvedThemeMode = Exclude<ThemeMode, "system">;
export const customColorKeys = ["primary", "background", "sidebar", "card"] as const;
export type CustomColorKey = (typeof customColorKeys)[number];
export type CustomColors = Partial<Record<CustomColorKey, string>>;

type Palette = Record<CustomColorKey, string> & {
  foreground: string;
  muted: string;
  mutedForeground: string;
  selection: string;
};

export const themePresets = {
  "pine-paper": {
    label: "松绿纸韵",
    light: {
      primary: "#2d5c48", background: "#fafaf7", sidebar: "#f3f3ee", card: "#ffffff",
      foreground: "#171b19", muted: "#f2f2ec", mutedForeground: "#666e68", selection: "#a67f27",
    },
    dark: {
      primary: "#8cc8a8", background: "#151c18", sidebar: "#1b2620", card: "#202c25",
      foreground: "#e8f1ea", muted: "#2b3a31", mutedForeground: "#b0c1b6", selection: "#e8c477",
    },
  },
  "indigo-ink": {
    label: "青黛书墨",
    light: {
      primary: "#3e5287", background: "#f7f8fc", sidebar: "#eef0f8", card: "#ffffff",
      foreground: "#202637", muted: "#edf0f8", mutedForeground: "#535e77", selection: "#6478b4",
    },
    dark: {
      primary: "#a8b9f2", background: "#171b29", sidebar: "#1d2334", card: "#242b40",
      foreground: "#e9edfa", muted: "#30394f", mutedForeground: "#b5bed7", selection: "#bbc5f9",
    },
  },
  "amber-clay": {
    label: "暖陶琥珀",
    light: {
      primary: "#8b4c28", background: "#fcf8f1", sidebar: "#f4ece1", card: "#fffdfa",
      foreground: "#35241b", muted: "#f3ebe1", mutedForeground: "#69564b", selection: "#b87830",
    },
    dark: {
      primary: "#edb589", background: "#221b18", sidebar: "#2c221d", card: "#332720",
      foreground: "#fbefe5", muted: "#413127", mutedForeground: "#cfb8a7", selection: "#f0c47a",
    },
  },
  "slate-neutral": {
    label: "石板素灰",
    light: {
      primary: "#49596b", background: "#f7f8f9", sidebar: "#edf0f2", card: "#ffffff",
      foreground: "#252c32", muted: "#edf0f2", mutedForeground: "#555f68", selection: "#687b91",
    },
    dark: {
      primary: "#adc1d5", background: "#191d22", sidebar: "#22272e", card: "#292f37",
      foreground: "#ecf0f4", muted: "#363e48", mutedForeground: "#b5bec8", selection: "#bbcadb",
    },
  },
} satisfies Record<string, { label: string } & Record<ResolvedThemeMode, Palette>>;

export type ThemePreset = keyof typeof themePresets;
export type ThemeConfig = {
  preset: ThemePreset;
  mode: ThemeMode;
  custom?: CustomColors;
};

export const defaultThemeConfig: Readonly<ThemeConfig> = { preset: "pine-paper", mode: "light" };
export const themeStorageKey = "quarry.theme.v1";
export const darkPreferenceQuery = "(prefers-color-scheme: dark)";
export const minimumContrast = 4.5;

const black = "#000000";
const white = "#ffffff";
const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function normalizeThemeConfig(value: unknown): ThemeConfig {
  if (!value || typeof value !== "object") return { ...defaultThemeConfig };

  const data = value as Partial<Record<keyof ThemeConfig, unknown>>;
  const preset = typeof data.preset === "string" && Object.hasOwn(themePresets, data.preset)
    ? data.preset as ThemePreset
    : defaultThemeConfig.preset;
  const mode = themeModes.find((option) => option === data.mode) ?? defaultThemeConfig.mode;
  const custom: CustomColors = {};
  if (data.custom && typeof data.custom === "object") {
    const colors = data.custom as Record<string, unknown>;
    for (const key of customColorKeys) {
      const color = colors[key];
      if (isHexColor(color)) custom[key] = color.toLowerCase();
    }
  }
  return Object.keys(custom).length ? { preset, mode, custom } : { preset, mode };
}

export function readThemeConfig(view: Window): ThemeConfig {
  try {
    return normalizeThemeConfig(JSON.parse(view.localStorage.getItem(themeStorageKey) ?? "null"));
  } catch {
    return { ...defaultThemeConfig };
  }
}

export function writeThemeConfig(view: Window, config: ThemeConfig) {
  try {
    view.localStorage.setItem(themeStorageKey, JSON.stringify(config));
  } catch {
    // Private or restricted origins can still use the theme for this session.
  }
}

function rgb(hex: string) {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
}

function rgba(hex: string, alpha: number) {
  return `rgba(${rgb(hex).join(", ")}, ${alpha})`;
}

function mix(from: string, to: string, amount: number) {
  const end = rgb(to);
  return "#" + rgb(from).map((channel, index) =>
    Math.round(channel + (end[index]! - channel) * amount).toString(16).padStart(2, "0"),
  ).join("");
}

function relativeLuminance(hex: string) {
  const [r, g, b] = rgb(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2 contrast ratio for opaque #RRGGBB colors. */
export function contrastRatio(foreground: string, background: string) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function contrastInk(background: string, preferred?: string) {
  if (preferred && contrastRatio(preferred, background) >= minimumContrast) return preferred;
  const luminance = relativeLuminance(background);
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? black : white;
}

const statusTokens = {
  light: {
    "success-bg": "#e7f4ec", "success-border": "#b4dcc3", "success-fg": "#1f663e",
    "error-bg": "#fbeceb", "error-border": "#eabcb8", "error-fg": "#b23a31",
    "info-bg": "#ebf2f9", "info-fg": "#2b5c86",
    "warning-bg": "#fbf2df", "warning-fg": "#8c5c16",
    destructive: "#b23a31", "destructive-foreground": "#ffffff",
  },
  dark: {
    "success-bg": "#233b2d", "success-border": "#467858", "success-fg": "#a5dfb6",
    "error-bg": "#432b2b", "error-border": "#91524e", "error-fg": "#ffb8af",
    "info-bg": "#24384c", "info-fg": "#b0d5fa",
    "warning-bg": "#41321f", "warning-fg": "#f2ce94",
    destructive: "#f6aca4", "destructive-foreground": "#341a18",
  },
} as const;

export function resolveTheme(config: ThemeConfig, prefersDark: boolean) {
  const mode = config.mode === "system" ? (prefersDark ? "dark" : "light") : config.mode;
  const palette = themePresets[config.preset][mode];
  const { primary, background, sidebar, card } = { ...palette, ...config.custom };
  const dark = mode === "dark";
  const pineLight = mode === "light" && config.preset === "pine-paper";
  const originalCardTints = pineLight && primary === palette.primary && card === palette.card;
  const originalHeat = pineLight && primary === palette.primary && background === palette.background;
  const { foreground, mutedForeground } = palette;
  const primaryForeground = contrastInk(primary, dark ? background : white);
  const accent = originalCardTints ? "#e8f0ea" : mix(card, primary, dark ? 0.16 : 0.12);
  const accentForeground = originalCardTints ? "#204635" : contrastInk(accent, foreground);
  const selectionHue = primary === palette.primary ? palette.selection : primary;
  const selectionBg = originalCardTints ? "#f6efd9" : mix(card, selectionHue, dark ? 0.18 : 0.15);
  const selectionInk = originalCardTints ? "#5a4b28" : contrastInk(selectionBg, foreground);
  const heat0 = originalHeat ? "#ecece6" : mix(background, foreground, dark ? 0.14 : 0.07);
  const heat4 = adjustColor(primary, contrastInk(background), (candidate) =>
    contrastRatio(candidate, background) >= 3,
  );
  const sidebarForeground = pineLight ? "#2f3632" : foreground;
  const titlebarSymbol = !dark && contrastRatio(primary, sidebar) >= minimumContrast
    ? primary
    : contrastInk(sidebar, foreground);

  return {
    mode,
    overlay: { color: sidebar, symbolColor: titlebarSymbol },
    tokens: {
      background, foreground, card, sidebar, primary,
      "card-foreground": foreground,
      popover: card,
      "popover-foreground": foreground,
      "primary-foreground": primaryForeground,
      "primary-hover": pineLight && primary === palette.primary ? "#224737"
        : mix(primary, contrastInk(primaryForeground), 0.14),
      secondary: palette.muted,
      "secondary-foreground": pineLight ? "#272d29" : foreground,
      muted: palette.muted,
      "muted-foreground": mutedForeground,
      accent,
      "accent-foreground": accentForeground,
      border: rgba(foreground, dark ? 0.16 : 0.09),
      input: rgba(foreground, dark ? 0.42 : 0.14),
      ring: contrastRatio(primary, card) >= 3 ? primary : contrastInk(card, foreground),
      "sidebar-foreground": sidebarForeground,
      "sidebar-accent": accent,
      "sidebar-accent-foreground": accentForeground,
      "sidebar-border": rgba(foreground, dark ? 0.16 : 0.08),
      "selection-bg": selectionBg,
      "selection-border": originalCardTints ? "#d7c797" : mix(card, selectionHue, 0.48),
      "selection-ink": selectionInk,
      ...statusTokens[mode],
      "heat-0": heat0,
      "heat-1": originalHeat ? "#cce0cd" : mix(heat0, heat4, 0.24),
      "heat-2": originalHeat ? "#9bc1a1" : mix(heat0, heat4, 0.48),
      "heat-3": originalHeat ? "#629672" : mix(heat0, heat4, 0.72),
      "heat-4": heat4,
      "code-bg": pineLight && background === palette.background ? "#f5f5f0" : palette.muted,
      "table-head": pineLight && background === palette.background ? "#f7f7f3" : palette.muted,
      "table-hover": pineLight && card === palette.card ? "#f7f7f2" : mix(card, accent, 0.55),
      "answer-bg": originalCardTints ? "#f3f5ef" : mix(card, accent, 0.65),
    },
  };
}

export type ResolvedTheme = ReturnType<typeof resolveTheme>;

const surfaces = ["background", "sidebar", "card"] as const;

export function themeContrast({ tokens }: ResolvedTheme) {
  const foreground = surfaces.map((surface) => ({
    surface,
    ratio: Math.min(
      contrastRatio(tokens.foreground, tokens[surface]),
      contrastRatio(tokens["muted-foreground"], tokens[surface]),
      surface === "sidebar"
        ? contrastRatio(tokens["sidebar-foreground"], tokens.sidebar)
        : Infinity,
    ),
  }));
  return {
    foreground,
    primary: Math.min(...surfaces.map((surface) => contrastRatio(tokens.primary, tokens[surface]))),
    button: contrastRatio(tokens["primary-foreground"], tokens.primary),
  };
}

function adjustColor(color: string, target: string, passes: (candidate: string) => boolean) {
  if (passes(color)) return color;
  // Step toward a known-good color and keep the first passing shade.
  for (let step = 1; step < 100; step++) {
    const candidate = mix(color, target, step / 100);
    if (passes(candidate)) return candidate;
  }
  return target;
}

export function fixThemeContrast(config: ThemeConfig, prefersDark: boolean): ThemeConfig {
  const theme = resolveTheme(config, prefersDark);
  const palette = themePresets[config.preset][theme.mode];
  const custom = { ...config.custom };
  for (const { surface, ratio } of themeContrast(theme).foreground) {
    if (ratio >= minimumContrast) continue;
    custom[surface] = adjustColor(theme.tokens[surface], palette[surface], (candidate) =>
      contrastRatio(theme.tokens.foreground, candidate) >= minimumContrast &&
      contrastRatio(theme.tokens["muted-foreground"], candidate) >= minimumContrast &&
      (surface !== "sidebar" ||
        contrastRatio(theme.tokens["sidebar-foreground"], candidate) >= minimumContrast),
    );
  }

  const passesPrimary = (candidate: string) => surfaces.every((surface) =>
    contrastRatio(candidate, custom[surface] ?? palette[surface]) >= minimumContrast,
  );
  if (!passesPrimary(theme.tokens.primary)) {
    const target = passesPrimary(palette.primary) ? palette.primary : theme.mode === "dark" ? white : black;
    custom.primary = adjustColor(theme.tokens.primary, target, passesPrimary);
  }
  return normalizeThemeConfig({ ...config, custom });
}

declare global {
  interface Window {
    __QUARRY_DESKTOP__?: {
      setTitleBarOverlay?: (colors: ResolvedTheme["overlay"]) => void;
    };
  }
}

export function applyTheme(view: Window, theme: ResolvedTheme) {
  const root = view.document.documentElement;
  for (const [token, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${token}`, value);
  }
  root.dataset.themeMode = theme.mode;
  root.classList.toggle("dark", theme.mode === "dark");
  view.__QUARRY_DESKTOP__?.setTitleBarOverlay?.(theme.overlay);
}

export function bootTheme(view: Window) {
  applyTheme(view, resolveTheme(readThemeConfig(view), view.matchMedia?.(darkPreferenceQuery).matches ?? false));
}

import type { ThemeMode } from "../lib/themes.js";

export const themeModeLabels = {
  light: "日间",
  dark: "夜间",
  system: "跟随系统",
} satisfies Record<ThemeMode, string>;

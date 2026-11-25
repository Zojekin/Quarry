import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  applyTheme,
  darkPreferenceQuery,
  normalizeThemeConfig,
  readThemeConfig,
  resolveTheme,
  themeStorageKey,
  writeThemeConfig,
} from "./themes.js";
import type { ResolvedTheme, ThemeConfig } from "./themes.js";

const ThemeContext = createContext<{
  config: ThemeConfig;
  theme: ResolvedTheme;
  prefersDark: boolean;
  setConfig: (config: ThemeConfig) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(() => readThemeConfig(window));
  const [preference] = useState(() => window.matchMedia?.(darkPreferenceQuery));
  const [prefersDark, setPrefersDark] = useState(() => preference?.matches ?? false);
  const systemDark = config.mode === "system" && prefersDark;
  const theme = useMemo(() => resolveTheme(config, systemDark), [config, systemDark]);

  useLayoutEffect(() => applyTheme(window, theme), [theme]);

  useEffect(() => {
    const onPreference = () => setPrefersDark(preference?.matches ?? false);
    const onStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey || event.key === null) setConfig(readThemeConfig(window));
    };
    preference?.addEventListener("change", onPreference);
    window.addEventListener("storage", onStorage);
    onPreference();
    return () => {
      preference?.removeEventListener("change", onPreference);
      window.removeEventListener("storage", onStorage);
    };
  }, [preference]);

  function saveConfig(next: ThemeConfig) {
    const normalized = normalizeThemeConfig(next);
    setConfig(normalized);
    writeThemeConfig(window, normalized);
  }

  return (
    <ThemeContext.Provider value={{ config, theme, prefersDark, setConfig: saveConfig }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeProvider is missing");
  return theme;
}

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
import type { CustomTheme, ResolvedTheme, ThemeConfig } from "./themes.js";

const ThemeContext = createContext<{
  config: ThemeConfig;
  theme: ResolvedTheme;
  setConfig: (config: ThemeConfig) => void;
  saveCustomTheme: (theme: CustomTheme) => void;
  deleteCustomTheme: (id: string) => void;
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

  function saveCustomTheme(customTheme: CustomTheme) {
    const customThemes = config.customThemes ?? [];
    saveConfig({
      ...config,
      activeCustomThemeId: customTheme.id,
      customThemes: customThemes.some(({ id }) => id === customTheme.id)
        ? customThemes.map((entry) => entry.id === customTheme.id ? customTheme : entry)
        : [...customThemes, customTheme],
    });
  }

  function deleteCustomTheme(id: string) {
    saveConfig({
      ...config,
      activeCustomThemeId: config.activeCustomThemeId === id ? undefined : config.activeCustomThemeId,
      customThemes: (config.customThemes ?? []).filter((entry) => entry.id !== id),
    });
  }

  return (
    <ThemeContext.Provider value={{ config, theme, setConfig: saveConfig, saveCustomTheme, deleteCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeProvider is missing");
  return theme;
}

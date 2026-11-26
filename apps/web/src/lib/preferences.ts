import { useMemo, useSyncExternalStore } from "react";

export const preferencesKey = "quarry-preferences-v1";
export const questionSizes = { small: 16, standard: 19, comfortable: 22, large: 25 } as const;

export type Preferences = {
  questionSize: keyof typeof questionSizes;
  confirmExamSubmit: boolean;
  showShortcutHints: boolean;
  sidebarCollapsed: boolean;
  libraryView: "list" | "grid";
  cliEnabled: boolean;
};

const defaults: Preferences = {
  questionSize: "standard",
  confirmExamSubmit: true,
  showShortcutHints: false,
  sidebarCollapsed: false,
  libraryView: "list",
  cliEnabled: false,
};

const listeners = new Set<() => void>();
let memoryPreferences: string | undefined;

function read() {
  try {
    return memoryPreferences ?? window.localStorage.getItem(preferencesKey) ?? "{}";
  } catch {
    return memoryPreferences ?? "{}";
  }
}

function parse(value: string): Preferences {
  try {
    const stored = JSON.parse(value) as Partial<Preferences> | null;
    return {
      questionSize: stored?.questionSize && Object.hasOwn(questionSizes, stored.questionSize)
        ? stored.questionSize
        : defaults.questionSize,
      confirmExamSubmit: typeof stored?.confirmExamSubmit === "boolean" ? stored.confirmExamSubmit : defaults.confirmExamSubmit,
      showShortcutHints: typeof stored?.showShortcutHints === "boolean" ? stored.showShortcutHints : defaults.showShortcutHints,
      sidebarCollapsed: typeof stored?.sidebarCollapsed === "boolean" ? stored.sidebarCollapsed : defaults.sidebarCollapsed,
      libraryView: stored?.libraryView === "grid" ? "grid" : defaults.libraryView,
      cliEnabled: typeof stored?.cliEnabled === "boolean" ? stored.cliEnabled : defaults.cliEnabled,
    };
  } catch {
    return defaults;
  }
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === preferencesKey || event.key === null) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePreferences() {
  const value = useSyncExternalStore(subscribe, read, () => "{}");
  return useMemo(() => parse(value), [value]);
}

export function updatePreferences(patch: Partial<Preferences>) {
  const value = JSON.stringify({ ...parse(read()), ...patch });
  try {
    window.localStorage.setItem(preferencesKey, value);
    memoryPreferences = undefined;
  } catch {
    memoryPreferences = value;
  }
  listeners.forEach((listener) => listener());
}

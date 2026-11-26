// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { preferencesKey, updatePreferences, usePreferences } from "../src/lib/preferences.js";

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdom.window.localStorage);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

it.each([{}, { cliEnabled: "true" }, { cliEnabled: null }])(
  "defaults cliEnabled to false for older or invalid preferences (%o)",
  (stored) => {
    window.localStorage.setItem(preferencesKey, JSON.stringify(stored));
    expect(renderHook(usePreferences).result.current.cliEnabled).toBe(false);
  },
);

it("persists both CLI toggle values across mounts and unrelated preference changes", () => {
  const hook = renderHook(usePreferences);
  act(() => updatePreferences({ cliEnabled: true }));
  expect(hook.result.current.cliEnabled).toBe(true);
  act(() => updatePreferences({ questionSize: "large" }));
  hook.unmount();
  const restarted = renderHook(usePreferences);
  expect(restarted.result.current).toMatchObject({ cliEnabled: true, questionSize: "large" });
  act(() => updatePreferences({ cliEnabled: false }));
  expect(restarted.result.current.cliEnabled).toBe(false);
  expect(JSON.parse(window.localStorage.getItem(preferencesKey)!)).toMatchObject({
    cliEnabled: false, questionSize: "large",
  });
});

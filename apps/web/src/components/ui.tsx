import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BackendError } from "../api/client.js";
export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof BackendError && Array.isArray(error.details))
    return [
      message,
      ...error.details.map(
        (item: { line?: number; path?: string; message?: string }) =>
          `${item.line ? `第 ${item.line} 行 ` : ""}${item.path ?? ""} ${item.message ?? ""}`,
      ),
    ].join("\n");
  return message;
}
export function Button({
  children,
  onClick,
  disabled = false,
  primary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className={`button ${primary ? "primary" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function useLoad<T>(loader: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [revision, refresh] = useState(0);
  useEffect(() => {
    let live = true;
    setData(undefined);
    setError("");
    loader()
      .then((value) => {
        if (live) setData(value);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [...dependencies, revision]);
  return { data, error, reload: () => refresh((n) => n + 1) };
}
export function Notice({
  error,
  loading,
}: {
  error: string;
  loading: boolean;
}) {
  return error ? (
    <p role="alert">{error}</p>
  ) : loading ? (
    <p role="status">正在加载…</p>
  ) : null;
}
export function Facet({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string[] | undefined;
  onChange: (value: string[] | undefined) => void;
}) {
  return (
    <details
      className="facet"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.open = false;
          e.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label={label}
        title={
          value
            ? `${label}: ${
                value.length
                  ? options
                      .filter((o) => value.includes(o.id))
                      .map((o) => o.name)
                      .join("、")
                  : "未选择"
              }`
            : label
        }
        className={`button ${value ? "constrained" : ""}`}
      >
        {value
          ? `${label} · ${
              value.length
                ? options
                    .filter((o) => value.includes(o.id))
                    .map((o) => o.name)
                    .join("、")
                : "未选择"
            }`
          : label}
      </summary>
      <div className="facet-menu">
        <label>
          <input
            type="checkbox"
            checked={value === undefined}
            onChange={(e) => onChange(e.target.checked ? undefined : [])}
          />
          全选
        </label>
        {options.map((o) => (
          <label key={o.id}>
            <input
              type="checkbox"
              checked={value === undefined || value.includes(o.id)}
              onChange={(e) => {
                const current = value ?? options.map((o) => o.id);
                const next = e.target.checked
                  ? [...current, o.id]
                  : current.filter((id) => id !== o.id);
                onChange(next.length === options.length ? undefined : next);
              }}
            />
            {o.name}
          </label>
        ))}
      </div>
    </details>
  );
}
export const types = [
  ["single_choice", "单选题"],
  ["multiple_choice", "多选题"],
  ["indefinite_choice", "不定项选择"],
  ["strict_fill_in_blank", "严格填空"],
  ["free_fill_in_blank", "非严格填空"],
  ["subjective", "主观题"],
].map(([id, name]) => ({ id: id!, name: name! }));

export const ViewContext = createContext("default");
export function useViewState<T>(key: string, initial: T | (() => T)) {
  const scope = useContext(ViewContext);
  const storageKey = "quarry-view/" + scope + "/" + key;
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {}
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    try {
      if (value === undefined) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [storageKey, value]);
  return [value, setValue] as const;
}

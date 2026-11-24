import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icons.js";
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
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`button ${primary ? "primary" : ""} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  className = "",
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`button icon-only ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
  actions,
  className = "",
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  children?: ReactNode;
  actions: ReactNode;
  className?: string;
  onSubmit?: () => void;
}) {
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement;
    if (typeof node.showModal === "function") node.showModal();
    else node.setAttribute("open", "");
    return () => {
      if (typeof node.close === "function") node.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  const body = (
    <>
      <div className="modal-head modal-heading">
        <h2 id={heading}>{title}</h2>
        <IconButton icon="close" label="关闭" onClick={onClose} />
      </div>
      {children && <div className="modal-body">{children}</div>}
      <div className="modal-actions">{actions}</div>
    </>
  );
  return (
    <div className="modal-backdrop">
      <dialog
        ref={dialog}
        className={`modal ${className}`}
        aria-modal="true"
        aria-labelledby={heading}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        {onSubmit ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </dialog>
    </div>
  );
}

function ActionDialog({
  title,
  onClose,
  onSubmit,
  children,
  action,
  disabled = false,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  children?: ReactNode;
  action: string;
  disabled?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      onSubmit={onSubmit}
      actions={
        <>
          <Button onClick={onClose}>取消</Button>
          <button className="button primary" type="submit" disabled={disabled}>
            {action}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export function ConfirmDialog({
  title,
  onClose,
  onAccept,
}: {
  title: string;
  onClose: () => void;
  onAccept: () => void;
}) {
  return (
    <ActionDialog
      title={title}
      action="确认"
      onClose={onClose}
      onSubmit={onAccept}
    />
  );
}

export function PromptDialog({
  title,
  label,
  initialValue,
  onClose,
  onAccept,
}: {
  title: string;
  label: string;
  initialValue: string;
  onClose: () => void;
  onAccept: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const name = value.trim();
  return (
    <ActionDialog
      title={title}
      action="保存"
      onClose={onClose}
      disabled={!name}
      onSubmit={() => {
        if (name) onAccept(name);
      }}
    >
      <label className="field">
        {label}
        <input
          autoFocus
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
    </ActionDialog>
  );
}

export function useConfirmation() {
  const [pending, setPending] = useState<{
    title: string;
    action: () => void;
  }>();
  const close = () => setPending(undefined);
  return {
    ask: (title: string, action: () => void) => setPending({ title, action }),
    dialog: pending && (
      <ConfirmDialog
        title={pending.title}
        onClose={close}
        onAccept={() => {
          close();
          pending.action();
        }}
      />
    ),
  };
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
  const summary =
    value === undefined
      ? label
      : value.length
        ? options
            .filter((option) => value.includes(option.id))
            .map((option) => option.name)
            .join("、")
        : "未选择";
  return (
    <details
      className={`quarry-select filter-card ${value === undefined ? "" : "is-filtered"}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="select-trigger" aria-label={label} title={summary}>
        <span className="filter-value">
          <span data-select-value>{summary}</span>
        </span>
        <Icon name="chevron" />
      </summary>
      <div className="select-popover facet-options">
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
const tagPalette = ["#E4EADE", "#EEE7DA", "#EBE6EE"];

export function tagBackground(color: string | null, name: string) {
  const index = Array.from(name).reduce(
    (sum, character) => sum + character.codePointAt(0)!,
    0,
  );
  return color && /^#[0-9a-f]{6}$/i.test(color)
    ? color
    : tagPalette[index % tagPalette.length]!;
}

export function tagColorStyle(
  color: string | null,
  name: string,
): CSSProperties {
  const background = tagBackground(color, name);
  const rgb = background
    .slice(1)
    .match(/../g)!
    .map((value) => parseInt(value, 16));
  const [red, green, blue] = rgb.map((value) => {
    const ratio = value / 255;
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
  const outline = rgb
    .map((value) =>
      Math.round(value * 0.65)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  return {
    "--tag-bg": background,
    "--tag-ink": luminance > 0.179 ? "#253128" : "#FFFFFF",
    "--tag-outline": "#" + outline,
  } as CSSProperties;
}

const statusIcons = {
  completed: "check",
  paused: "pause",
  in_progress: "play",
} as const;
export function StatusPill({
  state,
  children,
}: {
  state:
    | keyof typeof statusIcons
    | "enabled"
    | "disabled"
    | "reviewing"
    | "mastered";
  children: ReactNode;
}) {
  const icon =
    state in statusIcons
      ? statusIcons[state as keyof typeof statusIcons]
      : undefined;
  return (
    <span className={`pill status-pill status-${state}`}>
      {icon ? (
        <span className="status-mark">
          <Icon name={icon} />
        </span>
      ) : (
        <span className="status-dot" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

export function SearchField({
  label,
  placeholder = label,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="search">
      <Icon name="search" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Breadcrumb({
  items,
}: {
  items: { label: string; onClick?: () => void }[];
}) {
  return (
    <nav className="breadcrumb" aria-label="当前位置">
      {items.map(({ label, onClick }, index) => (
        <span key={index}>
          {index > 0 && (
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
          )}
          {onClick ? (
            <button type="button" onClick={onClick}>
              {label}
            </button>
          ) : (
            <span aria-current="page">{label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">
        <Icon name="library" />
      </span>
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
    </div>
  );
}

export type NavigationProps = {
  back: () => void;
  forward: () => void;
  home: () => void;
  canBack: boolean;
  canForward: boolean;
};

export function NavigationControls({
  back,
  forward,
  home,
  canBack,
  canForward,
}: NavigationProps) {
  return (
    <div
      className="nav-controls page-navigation-controls"
      aria-label="页面导航"
    >
      <IconButton
        icon="back"
        label="返回上一页"
        disabled={!canBack}
        onClick={back}
      />
      <IconButton
        icon="forward"
        label="前进下一页"
        disabled={!canForward}
        onClick={forward}
      />
      <IconButton icon="home" label="返回首页" onClick={home} />
    </div>
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

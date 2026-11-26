import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { BookOpen, ChevronDown, Search, X } from "lucide-react";
import { Icon, type IconName } from "./Icons.js";
import { BackendError } from "../api/client.js";
import { contrastInk } from "../lib/themes.js";
import { cn } from "../lib/utils.js";
import { Button } from "./ui/button.js";
import { Badge } from "./ui/badge.js";
import { Checkbox } from "./ui/checkbox.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.js";
import { Input } from "./ui/input.js";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.js";

export { Button };

export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof BackendError && Array.isArray(error.details)) {
    return [
      message,
      ...error.details.map(
        (item: { line?: number; path?: string; message?: string }) =>
          `${item.line ? `第 ${item.line} 行 ` : ""}${item.path ?? ""} ${item.message ?? ""}`,
      ),
    ].join("\n");
  }
  return message;
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "ghost",
  className = "",
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "ghost" | "outline" | "destructiveGhost";
  className?: string;
}) {
  return (
    <Button
      variant={variant}
      size="icon"
      className={className}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </Button>
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
  const activeElement = document.activeElement;
  const menuTriggerId = activeElement
    ?.closest('[role="menu"]')
    ?.getAttribute("aria-labelledby");
  const previousFocus = useRef(
    menuTriggerId ? document.getElementById(menuTriggerId) : activeElement,
  );
  const contentRef = useRef<HTMLDivElement>(null);

  const body = (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-[20px] font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </DialogTitle>
        <DialogClose asChild>
          <Button size="icon" variant="ghost" aria-label="关闭">
            <X className="size-4" />
          </Button>
        </DialogClose>
      </DialogHeader>
      {children && <div data-slot="modal-body" className="space-y-4 text-[13.5px]">{children}</div>}
      <DialogFooter>{actions}</DialogFooter>
    </>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        ref={contentRef}
        className={cn("quarry-modal", className)}
        aria-describedby={undefined}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          const input = contentRef.current?.querySelector<HTMLElement>(
            "[data-autofocus], input, textarea",
          );
          if (!input) return;
          event.preventDefault();
          input.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (previousFocus.current instanceof HTMLElement) {
            previousFocus.current.focus();
          }
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
      </DialogContent>
    </Dialog>
  );
}

function ActionDialog({
  title,
  onClose,
  onSubmit,
  children,
  action,
  disabled = false,
  destructive = false,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  children?: ReactNode;
  action: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      onSubmit={onSubmit}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            type="submit"
            disabled={disabled}
          >
            {action}
          </Button>
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
  const destructive = /删除|清除|恢复/.test(title);
  return (
    <ActionDialog
      title={title}
      action="确认"
      destructive={destructive}
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
      <label className="block space-y-1.5 text-[13px] font-medium text-foreground">
        <span>{label}</span>
        <Input
          data-autofocus
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
  return { data, setData, error, reload: () => refresh((n) => n + 1) };
}

export function Notice({
  error,
  loading,
}: {
  error: string;
  loading: boolean;
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3.5 py-2.5 text-[13px] text-[var(--error-fg)] whitespace-pre-wrap"
      >
        {error}
      </div>
    );
  }
  if (loading) {
    return (
      <p role="status" className="text-[13px] text-muted-foreground">
        正在加载…
      </p>
    );
  }
  return null;
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matchingOptions = options.filter((option) =>
    option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const filtered = value !== undefined;
  const summary = !filtered
    ? label
    : value.length
      ? options
          .filter((option) => value.includes(option.id))
          .map((option) => option.name)
          .join("、")
      : "未选择";

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) setQuery("");
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={label}
          title={summary}
          className={cn(
            "max-w-[200px] justify-between gap-2 font-medium",
            filtered && "border-primary/35 bg-accent/70 text-accent-foreground",
          )}
        >
          <span data-select-value className="truncate">
            {summary}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-65" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={label} className="w-56 p-1.5">
        <Input
          type="search"
          aria-label={`搜索${label}`}
          placeholder="搜索选项"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] font-medium hover:bg-accent/70">
            <Checkbox
              aria-label="全选"
              checked={value === undefined}
              onCheckedChange={(checked) => onChange(checked ? undefined : [])}
            />
            <span>全选</span>
          </label>
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            清空
          </Button>
        </div>
        <div className="mt-1 max-h-60 space-y-0.5 overflow-y-auto">
          {matchingOptions.length === 0 && (
            <p className="px-2 py-2 text-[13px] text-muted-foreground">没有匹配的选项</p>
          )}
          {matchingOptions.map((option) => {
            const isChecked = value === undefined || value.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-accent/70"
              >
                <Checkbox
                  aria-label={option.name}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const current = value ?? options.map((entry) => entry.id);
                    const next = checked
                      ? Array.from(new Set([...current, option.id]))
                      : current.filter((id) => id !== option.id);
                    onChange(options.every((entry) => next.includes(entry.id)) ? undefined : next);
                  }}
                />
                <span className="truncate">{option.name}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const defaultTagBackground = "#E4EADE";

export function tagBackground(color: string | null) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : defaultTagBackground;
}

export function tagColorStyle(color: string | null): CSSProperties {
  const background = tagBackground(color);
  const rgb = background
    .slice(1)
    .match(/../g)!
    .map((value) => parseInt(value, 16));
  const outline = rgb
    .map((value) =>
      Math.round(value * 0.65)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  return {
    "--tag-bg": background,
    "--tag-ink": contrastInk(background, "#253128").toUpperCase(),
    "--tag-outline": "#" + outline,
  } as CSSProperties;
}

const statusMeta = {
  completed: { variant: "success", icon: "check" },
  paused: { variant: "warning", icon: "pause" },
  in_progress: { variant: "info", icon: "play" },
  enabled: { variant: "success", icon: undefined },
  disabled: { variant: "destructive", icon: undefined },
  reviewing: { variant: "info", icon: undefined },
  mastered: { variant: "success", icon: undefined },
} as const;

export function StatusPill({
  state,
  children,
}: {
  state: keyof typeof statusMeta;
  children: ReactNode;
}) {
  const meta = statusMeta[state];
  return (
    <Badge variant={meta.variant} className="gap-1.5">
      {meta.icon ? (
        <Icon name={meta.icon} className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      )}
      {children}
    </Badge>
  );
}

export function SearchField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder="搜索"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-52 pl-8 text-[13px]"
      />
    </div>
  );
}

export function Breadcrumb({
  items,
}: {
  items: { label: string; onClick?: () => void }[];
}) {
  return (
    <nav
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground"
      aria-label="当前位置"
    >
      {items.map(({ label, onClick }, index) => (
        <span key={index} className="inline-flex items-center gap-1.5">
          {index > 0 && (
            <span className="text-muted-foreground/50" aria-hidden="true">
              /
            </span>
          )}
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              {label}
            </button>
          ) : (
            <span aria-current="page" className="font-medium text-foreground">
              {label}
            </span>
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
        <BookOpen className="size-5" aria-hidden="true" />
      </div>
      <h2 className="m-0 font-serif text-[18px] font-semibold text-foreground">{title}</h2>
      {detail && <p className="mt-1.5 max-w-md text-[13px] text-muted-foreground">{detail}</p>}
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
    <div className="flex items-center gap-0.5" aria-label="页面导航">
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

export function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [Value, string])[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-8.5 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5 text-muted-foreground"
    >
      {options.map(([key, name]) => (
        <button
          type="button"
          key={key}
          aria-pressed={key === value}
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex h-7 items-center justify-center rounded-md px-3 text-[12.5px] font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/35",
            key === value
              ? "bg-card text-foreground shadow-[0_1px_2px_rgba(var(--shadow-ink),0.06)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {name}
        </button>
      ))}
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

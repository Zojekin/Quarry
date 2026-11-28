import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Copy, Download, FolderInput, FolderOpen, HardDrive, MoreHorizontal, Pencil, Scissors, Trash2 } from "lucide-react";
import type { LibraryTarget } from "@quarry/shared";
import type { Document, Folder } from "../api/client.js";
import { cn } from "../lib/utils.js";
import { Button, IconButton, Modal } from "./ui.js";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu.js";

export type FileEntry = { kind: "folders" | "banks" | "papers"; item: Document };
export type LibraryClipboard = { action: "move" | "copy"; targets: LibraryTarget[] };

const entities = { folders: "folder", banks: "bank", papers: "paper" } as const;
export function libraryTarget({ kind, item }: FileEntry): LibraryTarget {
  return { entity: entities[kind], id: item.id };
}

export function blockedDestinations(folders: Folder[], targets: LibraryTarget[]) {
  const children = folderChildren(folders);
  const pending = targets.filter(({ entity }) => entity === "folder").map(({ id }) => id);
  const blocked = new Set<string>();
  for (const id of pending) {
    if (blocked.has(id)) continue;
    blocked.add(id);
    for (const child of children.get(id) ?? []) pending.push(child.id);
  }
  return blocked;
}

function folderChildren(folders: Folder[]) {
  const children = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const siblings = children.get(folder.parent_id) ?? [];
    siblings.push(folder);
    children.set(folder.parent_id, siblings);
  }
  return children;
}

export function Shortcut({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" className="ml-auto pl-4 font-mono text-[11px] text-muted-foreground">{children}</span>;
}

type FileActions = {
  open: () => void;
  edit: () => void;
  cut: () => void;
  copy: () => void;
  move: () => void;
  export: () => void;
  remove: () => void;
};

export function FileMenuItems({ actions, single, folder, busy }: {
  actions: FileActions;
  single: boolean;
  folder: boolean;
  busy: boolean;
}) {
  return (
    <>
      {single && (
        <>
          <DropdownMenuItem onSelect={actions.open}><FolderOpen />打开</DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.edit} disabled={busy} aria-keyshortcuts="F2">
            <Pencil />{folder ? "重命名" : "编辑属性"}<Shortcut>F2</Shortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem onSelect={actions.cut} disabled={busy} aria-keyshortcuts="Control+X Meta+X">
        <Scissors />剪切<Shortcut>Ctrl+X</Shortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={actions.copy} disabled={busy} aria-keyshortcuts="Control+C Meta+C">
        <Copy />复制<Shortcut>Ctrl+C</Shortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={actions.move} disabled={busy}><FolderInput />移动到…</DropdownMenuItem>
      <DropdownMenuItem onSelect={actions.export}><Download />导出</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={actions.remove} disabled={busy} aria-keyshortcuts="Delete" className="text-destructive [&_svg]:text-destructive">
        <Trash2 />删除
      </DropdownMenuItem>
    </>
  );
}

export function FileActionButtons({ entry, actions, busy }: { entry: FileEntry; actions: FileActions; busy: boolean }) {
  return (
    <div
      className="inline-flex shrink-0 items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
      onClick={event => event.stopPropagation()}
    >
      <IconButton icon="trash" label="删除" variant="destructiveGhost" disabled={busy} onClick={actions.remove} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="更多操作" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-44">
          <FileMenuItems actions={actions} single folder={entry.kind === "folders"} busy={busy} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function FileTransferButtons({ actions, busy, dock = false, canClear, clear }: {
  actions: FileActions;
  busy: boolean;
  dock?: boolean;
  canClear: boolean;
  clear: () => void;
}) {
  const style = dock ? "h-7.5 bg-inverse-ink/12 text-inverse-ink hover:bg-inverse-ink/20" : "";
  return (
    <>
      <Button size="sm" variant={dock ? "secondary" : "outline"} className={style} disabled={busy} onClick={actions.move}>
        <FolderInput className="size-3.5" />移动到…
      </Button>
      <Button size="sm" variant={dock ? "secondary" : "outline"} className={style} disabled={busy} onClick={actions.copy}>
        <Copy className="size-3.5" />复制
      </Button>
      <Button size="sm" variant={dock ? "secondary" : "outline"} className={style} disabled={busy} onClick={actions.cut}>
        <Scissors className="size-3.5" />剪切
      </Button>
      <Button size="sm" variant={dock ? "secondary" : "outline"} className={style} onClick={actions.export}>
        <Download className="size-3.5" />导出
      </Button>
      <Button size="sm" variant={dock ? "destructive" : "destructiveGhost"} className={dock ? "h-7.5" : ""} disabled={busy} onClick={actions.remove}>
        <Trash2 className="size-3.5" />删除
      </Button>
      <Button size="sm" variant="ghost" disabled={!canClear} className={dock ? "h-7.5 text-inverse-ink/75 hover:bg-inverse-ink/10 hover:text-inverse-ink" : ""} onClick={clear}>
        取消选择
      </Button>
    </>
  );
}

export function MovePicker({ folders, targets, currentFolder, busy, error, close, move }: {
  folders: Folder[];
  targets: LibraryTarget[];
  currentFolder: string | null;
  busy: boolean;
  error: string;
  close: () => void;
  move: (destination: string | null) => void;
}) {
  const [destination, setDestination] = useState(currentFolder);
  const name = useId();
  const blocked = blockedDestinations(folders, targets);
  const children = folderChildren(folders);

  function folderOptions(parent: string | null): ReactNode {
    const siblings = children.get(parent);
    if (!siblings?.length) return null;
    return (
      <ul className="ml-4 list-none border-l border-border pl-2">
        {siblings.map(folder => (
          <li key={folder.id}>
            {option(folder.id, folder.name)}
            {folderOptions(folder.id)}
          </li>
        ))}
      </ul>
    );
  }

  function option(id: string | null, label: string) {
    const selected = destination === id;
    const disabled = busy || (id !== null && blocked.has(id));
    const Icon = id === null ? HardDrive : FolderOpen;
    return (
      <label className={cn("flex min-h-9 items-center gap-2 rounded-md px-2 has-focus-visible:ring-2 has-focus-visible:ring-ring",
        disabled ? "opacity-50" : "cursor-pointer hover:bg-muted", selected && "bg-accent text-accent-foreground")}>
        <input type="radio" name={name} checked={selected} disabled={disabled} onChange={() => setDestination(id)} />
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="wrap-anywhere">{label}</span>
      </label>
    );
  }

  return (
    <Modal title="移动到…" onClose={close} dismissible={!busy} actions={
      <>
        <Button variant="outline" onClick={close} disabled={busy}>取消</Button>
        <Button onClick={() => move(destination)} disabled={busy || destination === currentFolder}>移动</Button>
      </>
    }>
      <fieldset aria-label="目标文件夹" className="max-h-[48vh] overflow-auto rounded-lg border border-border p-2">
        {option(null, "资料库（根目录）")}
        {folderOptions(null)}
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </Modal>
  );
}

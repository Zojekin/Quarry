import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FilePlus2,
  FolderPlus,
  Layers,
  MoreHorizontal,
  Play,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { client } from "../api/client.js";
import type { Bank, Document, Paper, QuestionView, Tag } from "../api/client.js";
import type { Route } from "../state.js";
import { Icon } from "../components/Icons.js";
import { ComposerEditor, DocumentEditor } from "../components/DocumentEditor.js";
import { QuestionEditor } from "../components/QuestionEditor.js";
import { QuestionPreview } from "../components/QuestionPreview.js";
import { usePreferences } from "../lib/preferences.js";
import { FollowDialog, ImportDialog, QuestionPicker } from "../components/Workflows.js";
import {
  Button,
  Breadcrumb,
  EmptyState,
  Facet,
  IconButton,
  Modal,
  NavigationControls,
  Notice,
  SearchField,
  Segmented,
  tagColorStyle,
  types,
  useConfirmation,
  useLoad,
  useViewState,
} from "../components/ui.js";
import type { NavigationProps } from "../components/ui.js";
import { Badge } from "../components/ui/badge.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card.js";
import { Checkbox } from "../components/ui/checkbox.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table.js";
import { cn } from "../lib/utils.js";

function dateText(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN");
}

function paperCount(paper: Paper) {
  return paper.sections.reduce((sum, section) => sum + section.items.length, 0);
}

function TagPills({ tags, ids }: { tags: Tag[]; ids: string[] }) {
  const list = tags.filter((tag) => ids.includes(tag.id));
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((tag) => (
        <span
          className="tag-color inline-flex h-5 items-center rounded-full px-2 text-[11.5px] font-medium"
          key={tag.id}
          style={tagColorStyle(tag.color)}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

type FileEntry = {
  kind: "folders" | "banks" | "papers";
  item: Document;
};

const kindNames = {
  folders: "文件夹",
  banks: "题库",
  papers: "套题",
} as const;

export function Library({
  folder,
  navigate,
  navigation,
  search,
  setSearch,
}: {
  folder?: string;
  navigate: (route: Route) => void;
  navigation: NavigationProps;
  search: string;
  setSearch: (s: string) => void;
}) {
  const preferences = usePreferences();
  const [viewOverride, setView] = useViewState<"list" | "grid" | undefined>("library-view", undefined);
  const view = viewOverride ?? preferences.libraryView;
  const [kindFilter, setKindFilter] = useViewState<string[] | undefined>(
    "library-kind",
    undefined,
  );
  const [tagFilter, setTagFilter] = useViewState<string[] | undefined>(
    "library-tag",
    undefined,
  );
  const [create, setCreate] = useState<"folders" | "banks" | "papers">();
  const [editing, setEditing] = useState<FileEntry>();
  const [importing, setImporting] = useState<File>();
  const [activeId, setActiveId] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const confirm = useConfirmation();

  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        client.folders.list(),
        client.banks.list(),
        client.papers.list(),
        client.questions.list(),
        client.tags.list("file"),
      ]),
    [],
  );

  const [
    folders = [],
    banks = [],
    papers = [],
    allQuestions = [],
    tags = [],
  ] = data ?? [];

  const bankCounts = new Map<string, number>();
  for (const q of allQuestions) {
    bankCounts.set(q.owner_id, (bankCounts.get(q.owner_id) ?? 0) + 1);
  }

  const trail: { id: string; name: string }[] = [];
  let cursor = folder;
  while (cursor) {
    const cur = folders.find((f) => f.id === cursor);
    if (!cur) break;
    trail.unshift({ id: cur.id, name: cur.name });
    cursor = cur.parent_id ?? undefined;
  }

  const folderEntries = folders
    .filter((f) => (f.parent_id ?? undefined) === folder)
    .map((item) => ({ kind: "folders" as const, item }));
  const bankEntries = banks
    .filter((b) => (b.folder_id ?? undefined) === folder)
    .map((item) => ({ kind: "banks" as const, item }));
  const paperEntries = papers
    .filter((p) => (p.folder_id ?? undefined) === folder)
    .map((item) => ({ kind: "papers" as const, item }));

  const rows: FileEntry[] = [...folderEntries, ...bankEntries, ...paperEntries].filter(
    ({ kind, item }) => {
      const entity =
        kind === "folders" ? "folder" : kind === "banks" ? "bank" : "paper";
      const matchSearch =
        !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchKind = kindFilter === undefined || kindFilter.includes(entity);
      const matchTag =
        tagFilter === undefined ||
        tagFilter.some((id) => item.tag_ids.includes(id));
      return matchSearch && matchKind && matchTag;
    },
  );

  const inspected = rows.find((r) => r.item.id === activeId) ?? rows[0];
  const validSelected = selectedIds.filter((id) =>
    rows.some((r) => r.item.id === id),
  );
  const allSelected =
    rows.length > 0 && validSelected.length === rows.length;

  useEffect(() => {
    setSelectedIds([]);
    setActiveId(undefined);
  }, [folder]);

  function openEntry(entry: FileEntry) {
    if (entry.kind === "folders") navigate({ page: "library", id: entry.item.id });
    else if (entry.kind === "banks") navigate({ page: "bank", id: entry.item.id });
    else navigate({ page: "paper", id: entry.item.id });
  }

  function itemCountLabel(entry: FileEntry) {
    if (entry.kind === "folders") return "—";
    if (entry.kind === "banks") return String(bankCounts.get(entry.item.id) ?? 0);
    return String(paperCount(entry.item as Paper));
  }

  function exportEntry(entry: FileEntry, format = "quarry") {
    const entity =
      entry.kind === "folders"
        ? "folder"
        : entry.kind === "banks"
          ? "bank"
          : "paper";
    const ext = format === "markdown" ? "md" : format === "json" ? "json" : "quarry";
    void client.backup
      .export(entity, entry.item.id, format)
      .then((blob) => download(blob, `${entry.item.name}.${ext}`))
      .catch((e) => setMessage((e as Error).message));
  }

  async function batchDelete() {
    setBusy(true);
    setMessage("");
    try {
      for (const id of validSelected) {
        const entry = rows.find((r) => r.item.id === id);
        if (entry) await client[entry.kind].delete(entry.item.id);
      }
      setSelectedIds([]);
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function batchExport() {
    for (const id of validSelected) {
      const entry = rows.find((r) => r.item.id === id);
      if (entry) exportEntry(entry);
    }
  }

  async function quickStartPaper(paperId: string, mode: "practice" | "exam") {
    setBusy(true);
    setMessage("");
    try {
      const s = await client.sessions.start(paperId, mode);
      navigate({ page: "study", id: s.id });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((item) => item !== id),
    );
  };

  const inspectedPaper =
    inspected?.kind === "papers" ? (inspected.item as Paper) : undefined;
  const inspectedBank =
    inspected?.kind === "banks" ? (inspected.item as Bank) : undefined;

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <NavigationControls {...navigation} />
          <Breadcrumb
            items={[
              {
                label: "题库与套题",
                ...(folder ? { onClick: () => navigate({ page: "library" }) } : {}),
              },
              ...trail.map((item, idx) => ({
                label: item.name,
                ...(idx < trail.length - 1
                  ? { onClick: () => navigate({ page: "library", id: item.id }) }
                  : {}),
              })),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {folder && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void client.backup
                  .export("folder", folder)
                  .then((blob) =>
                    download(blob, (trail.at(-1)?.name ?? "文件夹") + ".quarry"),
                  )
              }
            >
              <Download className="size-3.5" />
              导出当前文件夹
            </Button>
          )}
          <label className="file-input-button">
            <Upload className="size-3.5" />
            <span>导入文件</span>
            <input
              type="file"
              accept=".quarry,.json,.md"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) setImporting(file);
              }}
            />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="size-3.5" />
                新建
                <ChevronDown className="size-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setCreate("folders")}>
                <FolderPlus />
                <span>新建文件夹</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCreate("banks")}>
                <Layers />
                <span>新建题库</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCreate("papers")}>
                <FilePlus2 />
                <span>新建套题</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div>
        <h1 className="m-0 font-serif text-[26px] font-semibold tracking-[-0.02em] text-foreground">
          {trail.at(-1)?.name ?? "题库与套题"}
        </h1>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            label="搜索文件夹、题库与套题"
            value={search}
            onChange={setSearch}
          />
          <Facet
            label="类型"
            options={[
              { id: "folder", name: "文件夹" },
              { id: "bank", name: "题库" },
              { id: "paper", name: "套题" },
            ]}
            value={kindFilter}
            onChange={setKindFilter}
          />
          <Facet
            label="标签"
            options={tags}
            value={tagFilter}
            onChange={setTagFilter}
          />
        </div>
        <Segmented
          label="视图"
          options={[
            ["list", "列表"],
            ["grid", "网格"],
          ]}
          value={view}
          onChange={(v) => setView(v as "list" | "grid")}
        />
      </div>

      <Notice error={error || message} loading={!data && !error} />

      {data && rows.length === 0 && (
        <EmptyState
          title="这里还没有内容"
          detail="点击右上角「新建」创建文件夹、题库或套题，或直接导入题目包。"
        />
      )}

      {/* Master-Detail Dual Pane */}
      {data && rows.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_312px]">
          <div className="min-w-0">
            {view === "list" ? (
              <Table aria-label="文件列表">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="全选文件"
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          setSelectedIds(
                            checked ? rows.map((r) => r.item.id) : [],
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead className="w-20">类型</TableHead>
                    <TableHead className="hidden md:table-cell">标签</TableHead>
                    <TableHead className="w-20">题数</TableHead>
                    <TableHead className="w-28">更新时间</TableHead>
                    <TableHead className="w-28 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((entry) => {
                    const { kind, item } = entry;
                    const isActive = inspected?.item.id === item.id;
                    const isSelected = validSelected.includes(item.id);
                    return (
                      <TableRow
                        key={item.id}
                        data-selected={isActive || isSelected ? "true" : undefined}
                        onClick={() => setActiveId(item.id)}
                        onDoubleClick={() => openEntry(entry)}
                        className="cursor-pointer"
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label={`选择 ${item.name}`}
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              toggleSelect(item.id, !!checked)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEntry(entry);
                            }}
                            className="inline-flex max-w-full items-center gap-2 text-left font-medium text-foreground transition-colors hover:text-primary"
                          >
                            <Icon
                              name={
                                kind === "folders"
                                  ? "folder"
                                  : kind === "banks"
                                    ? "bank"
                                    : "paper"
                              }
                              className="size-4 shrink-0 text-primary/80"
                            />
                            <span className="truncate">{item.name}</span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{kindNames[kind]}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <TagPills tags={tags} ids={item.tag_ids} />
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground tabular-nums">
                          {itemCountLabel(entry)}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground tabular-nums">
                          <span data-dynamic-date="date">
                            {dateText(item.updated_at)}
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100">
                            <IconButton
                              icon="download"
                              label="导出"
                              onClick={() => exportEntry(entry)}
                            />
                            <IconButton
                              icon="edit"
                              label="重命名"
                              onClick={() => setEditing(entry)}
                            />
                            <IconButton
                              icon="trash"
                              label="删除"
                              variant="destructiveGhost"
                              onClick={() =>
                                confirm.ask(
                                  `确认删除「${item.name}」吗？可在回收站恢复。`,
                                  () =>
                                    void client[kind]
                                      .delete(item.id)
                                      .then(reload),
                                )
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((entry) => {
                  const { kind, item } = entry;
                  const isActive = inspected?.item.id === item.id;
                  const isSelected = validSelected.includes(item.id);
                  return (
                    <Card
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      onDoubleClick={() => openEntry(entry)}
                      className={cn(
                        "group cursor-pointer transition-all hover:border-primary/35",
                        isActive && "border-primary/45 ring-1 ring-primary/20",
                      )}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <div
                            className="pt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              aria-label={`选择 ${item.name}`}
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleSelect(item.id, !!checked)
                              }
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                              <Icon
                                name={
                                  kind === "folders"
                                    ? "folder"
                                    : kind === "banks"
                                      ? "bank"
                                      : "paper"
                                }
                                className="size-3.5 text-primary"
                              />
                              <span>{kindNames[kind]}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEntry(entry);
                              }}
                              className="mt-1 block max-w-full truncate text-left font-serif text-[16px] font-semibold text-foreground hover:text-primary"
                            >
                              {item.name}
                            </button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pb-3">
                        <TagPills tags={tags} ids={item.tag_ids} />
                        {item.description && (
                          <p className="line-clamp-2 text-[12.5px] text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </CardContent>
                      <CardFooter className="py-2.5 text-[12px]">
                        <span className="tabular-nums">
                          {kind === "folders"
                            ? "文件夹"
                            : `${itemCountLabel(entry)} 道题目`}
                        </span>
                        <span data-dynamic-date="date">
                          {dateText(item.updated_at)}
                        </span>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Inspector Panel */}
          {inspected && (
            <Card as="aside" aria-label="文件概览" className="xl:sticky xl:top-16">
              <CardHeader className="pb-3">
                <div className="space-y-1.5">
                  <Badge variant="info">{kindNames[inspected.kind]}</Badge>
                  <CardTitle className="font-serif text-[19px] leading-snug">
                    {inspected.item.name}
                  </CardTitle>
                  {inspected.item.description && (
                    <CardDescription>{inspected.item.description}</CardDescription>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <TagPills tags={tags} ids={inspected.item.tag_ids} />
                <dl className="grid grid-cols-2 gap-y-2 rounded-lg bg-muted/45 px-3.5 py-2.5 text-[12.5px]">
                  <dt className="text-muted-foreground">题目规模</dt>
                  <dd className="text-right font-medium text-foreground tabular-nums">
                    {inspected.kind === "folders"
                      ? "目录节点"
                      : `${itemCountLabel(inspected)} 题`}
                  </dd>
                  {inspectedPaper && (
                    <>
                      <dt className="text-muted-foreground">总分 / 限时</dt>
                      <dd className="text-right font-medium text-foreground tabular-nums">
                        {inspectedPaper.full_score ||
                          inspectedPaper.sections
                            .flatMap((s) => s.items)
                            .reduce(
                              (sum, i) => sum + (i.question.max_score ?? 0),
                              0,
                            )}{" "}
                        分 ·{" "}
                        {inspectedPaper.time_limit_seconds
                          ? `${Math.round(inspectedPaper.time_limit_seconds / 60)} 分钟`
                          : "不限时"}
                      </dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">最近更新</dt>
                  <dd className="text-right font-medium text-foreground tabular-nums">
                    <span data-dynamic-date="date">
                      {dateText(inspected.item.updated_at)}
                    </span>
                  </dd>
                </dl>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="default"
                    className="w-full justify-between"
                    onClick={() => openEntry(inspected)}
                  >
                    <span>
                      {inspected.kind === "folders"
                        ? "打开文件夹"
                        : inspected.kind === "banks"
                          ? "进入题库管理"
                          : "查看套题详情"}
                    </span>
                    <ArrowRight className="size-4" />
                  </Button>
                  {inspectedPaper && paperCount(inspectedPaper) > 0 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={() => void quickStartPaper(inspectedPaper.id, "practice")}
                    >
                      <Play className="size-3.5" />
                      直接开始练习
                    </Button>
                  )}
                  {inspectedBank && (
                    <p className="m-0 text-center text-[11.5px] text-muted-foreground">
                      双击列表行或点击名称也可直接进入
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Floating Multi-Select Batch Dock */}
      {validSelected.length > 0 && (
        <div
          role="region"
          aria-label="批量操作"
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-control-edge/15 bg-(--inverse-surface) px-4 py-2.5 text-[13px] text-inverse-ink shadow-[0_14px_34px_-8px_rgba(var(--shadow-ink),0.4)]"
        >
          <span className="font-medium tabular-nums">
            已选 {validSelected.length} 项
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="h-7.5 bg-inverse-ink/12 text-inverse-ink hover:bg-inverse-ink/20"
            onClick={batchExport}
          >
            <Download className="size-3.5" />
            导出
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            className="h-7.5"
            onClick={() =>
              confirm.ask(
                `确认将已选的 ${validSelected.length} 个项目移入回收站吗？`,
                () => void batchDelete(),
              )
            }
          >
            <Trash2 className="size-3.5" />
            删除
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7.5 text-inverse-ink/75 hover:bg-inverse-ink/10 hover:text-inverse-ink"
            onClick={() => setSelectedIds([])}
          >
            取消选择
          </Button>
        </div>
      )}

      {create && (
        <DocumentEditor
          kind={create}
          {...(folder ? { parent: folder } : {})}
          tags={tags}
          onClose={() => setCreate(undefined)}
          onSaved={reload}
        />
      )}
      {editing && (
        <DocumentEditor
          kind={editing.kind}
          document={editing.item}
          tags={tags}
          onClose={() => setEditing(undefined)}
          onSaved={reload}
        />
      )}
      {importing && (
        <ImportDialog
          file={importing}
          onClose={() => setImporting(undefined)}
          onSaved={reload}
        />
      )}
      {confirm.dialog}
    </div>
  );
}

export function Detail({
  kind,
  id,
  navigate,
  navigation,
  onTitle,
}: {
  kind: "bank" | "paper";
  id: string;
  navigate: (route: Route) => void;
  navigation: NavigationProps;
  onTitle: (label: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QuestionView>();
  const [picking, setPicking] = useState(false);
  const [composing, setComposing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revealPreview, setRevealPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useViewState("detail-search", "");
  const [typeFilter, setTypeFilter] = useViewState<string[] | undefined>(
    "detail-type",
    undefined,
  );
  const [tagFilter, setTagFilter] = useViewState<string[] | undefined>(
    "detail-tag",
    undefined,
  );
  const confirm = useConfirmation();

  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        kind === "bank" ? client.banks.get(id) : client.papers.get(id),
        kind === "bank"
          ? client.questions.list({ bank_id: id })
          : Promise.resolve([]),
        client.tags.list("question"),
        client.tags.list("file"),
        client.folders.list(),
      ]),
    [kind, id],
  );

  const doc = data?.[0];
  const onTitleRef = useRef(onTitle);
  onTitleRef.current = onTitle;
  useEffect(() => {
    if (doc) onTitleRef.current(doc.name);
  }, [doc?.name]);

  const qTags = data?.[2] ?? [];
  const fTags = data?.[3] ?? [];
  const folders = data?.[4] ?? [];
  const bank = kind === "bank" ? (doc as Bank | undefined) : undefined;
  const paper = kind === "paper" ? (doc as Paper | undefined) : undefined;
  const questions =
    kind === "bank"
      ? (data?.[1] ?? [])
      : (paper?.sections.flatMap((s) => s.items) ?? []);
  const questionEntries = questions.map((entry, idx) => ({
    entry,
    itemId: entry.id,
    q: "question" in entry ? entry.question : entry,
    number: idx + 1,
  }));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredQuestions = questionEntries.filter(
    ({ q }) =>
      (kind === "paper" ||
        typeFilter === undefined ||
        typeFilter.includes(q.type)) &&
      (kind === "paper" ||
        tagFilter === undefined ||
        tagFilter.some((tag) => q.tag_ids.includes(tag))) &&
      (!normalizedSearch ||
        `${q.content} ${q.explanation ?? ""} ${q.material ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedSearch)),
  );

  const parentFolder = folders.find((f) => f.id === doc?.folder_id);
  const count = questions.length;

  async function launch(mode: "practice" | "exam") {
    if (!paper) return;
    setBusy(true);
    setMessage("");
    try {
      const session = await client.sessions.start(paper.id, mode);
      navigate({ page: "study", id: session.id });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportDoc(format = "quarry") {
    if (!doc) return;
    const ext = format === "markdown" ? "md" : format === "json" ? "json" : "quarry";
    void client.backup
      .export(kind, doc.id, format)
      .then((blob) => download(blob, `${doc.name}.${ext}`))
      .catch((e) => setMessage((e as Error).message));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <NavigationControls {...navigation} />
          <Breadcrumb
            items={[
              {
                label: "题库与套题",
                onClick: () => navigate({ page: "library" }),
              },
              ...(parentFolder
                ? [
                    {
                      label: parentFolder.name,
                      onClick: () => navigate({ page: "library", id: parentFolder.id }),
                    },
                  ]
                : []),
              { label: doc?.name ?? (kind === "bank" ? "题库" : "套题") },
            ]}
          />
        </div>
      </div>

      <Notice error={error || message} loading={!data && !error} />

      {doc && (
        <>
          {/* Clean 2-Layer Detail Header (No Right Property Sidebar) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-foreground">
                  {doc.name}
                </h1>
                {doc.description && (
                  <p className="m-0 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                    {doc.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {paper && (
                  <>
                    <Button
                      variant="default"
                      disabled={busy || count === 0}
                      onClick={() => void launch("practice")}
                    >
                      <Play className="size-3.5" />
                      开始练习
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || count === 0}
                      onClick={() => void launch("exam")}
                    >
                      <Clock className="size-3.5" />
                      开始考试
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setCreating(true)}>
                  <Plus className="size-3.5" />
                  新建题目
                </Button>
                {paper && (
                  <Button variant="outline" onClick={() => setPicking(true)}>
                    从题库选题
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="更多操作">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {paper && (
                      <>
                        <DropdownMenuItem onSelect={() => setComposing(true)}>
                          <SlidersHorizontal />
                          <span>编排组卷</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
                          <Eye />
                          <span>预览试卷</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setFollowing(true)}>
                          <Layers />
                          <span>来源差异</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onSelect={() => setPropsOpen(true)}>
                      <span>编辑属性</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => exportDoc("quarry")}>
                      <Download />
                      <span>导出 .quarry</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => exportDoc("markdown")}>
                      <Download />
                      <span>导出 Markdown</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Inline Clickable Spec Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[12.5px]">
              <Badge variant="secondary" className="tabular-nums">
                {count} 道题目
              </Badge>
              {paper && (
                <>
                  <Badge variant="secondary" className="tabular-nums">
                    总分{" "}
                    {paper.full_score ||
                      questions.reduce(
                        (sum, entry) =>
                          sum +
                          (("question" in entry
                            ? entry.question
                            : entry
                          ).max_score ?? 0),
                        0,
                      )}{" "}
                    分
                  </Badge>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[12px] font-medium text-foreground/85 transition-colors hover:bg-muted"
                      >
                        <Clock className="size-3 text-muted-foreground" />
                        <span>
                          {paper.time_limit_seconds
                            ? `限时 ${Math.round(paper.time_limit_seconds / 60)} 分钟`
                            : "不限时"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-60 space-y-2 p-3 text-[12.5px]">
                      <div className="font-semibold text-foreground">作答与随机规则</div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>打乱选项</span>
                        <span>{paper.shuffle_options ? "开启" : "关闭"}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>打乱分区</span>
                        <span>{paper.shuffle_sections ? "开启" : "关闭"}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 w-full"
                        onClick={() => setPropsOpen(true)}
                      >
                        调整套题属性
                      </Button>
                    </PopoverContent>
                  </Popover>
                </>
              )}
              {bank && <Badge variant="outline">题库源</Badge>}
              <TagPills tags={fTags} ids={doc.tag_ids} />
            </div>
          </div>

          {/* Question Filter Toolbar */}
          {questions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <SearchField
                label="搜索题目"
                value={search}
                onChange={setSearch}
                placeholder="搜索题干或解析"
                className="min-w-[200px] flex-1 sm:max-w-[280px]"
              />
              {bank && (
                <>
                  <Facet
                    label="题型"
                    options={types}
                    value={typeFilter}
                    onChange={setTypeFilter}
                  />
                  {qTags.length > 0 && (
                    <Facet
                      label="题目标签"
                      options={qTags}
                      value={tagFilter}
                      onChange={setTagFilter}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Question List (Immediately visible on first screen) */}
          {questions.length === 0 ? (
            <EmptyState
              title="还没有题目"
              detail="点击右上角「新建题目」录入一道题，或从已有题库中挑选题目。"
            />
          ) : filteredQuestions.length === 0 ? (
            <EmptyState
              title="没有匹配的题目"
              detail="尝试调整搜索词或筛选条件。"
            />
          ) : (
            <div className="space-y-3">
              {filteredQuestions.map(({ itemId, q, number }) => {
                const typeName =
                  types.find((t) => t.id === q.type)?.name ?? q.type;
                return (
                  <Card
                    key={itemId}
                    as="article"
                    className="group transition-colors hover:border-control-edge/15"
                  >
                    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                          <span className="font-semibold text-foreground tabular-nums">
                            第 {number} 题
                          </span>
                          <Badge variant="outline">{typeName}</Badge>
                          <span className="tabular-nums">
                            {q.max_score !== undefined ? `${q.max_score} 分` : "不计分"}
                          </span>
                          <TagPills tags={qTags} ids={q.tag_ids} />
                        </div>
                        <div className="font-serif text-[16px] leading-[1.7] font-normal text-foreground">
                          <QuestionPreview question={q} />
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <IconButton
                          icon="edit"
                          label={`编辑第 ${number} 题`}
                          onClick={() => setEditing(q)}
                        />
                        <IconButton
                          icon="trash"
                          label={`删除第 ${number} 题`}
                          variant="destructiveGhost"
                          onClick={() =>
                            confirm.ask("确认删除这道题目吗？", () =>
                              void (paper
                                ? client.papers.removeItem(paper.id, itemId)
                                : client.questions.delete(q.id)
                              ).then(reload),
                            )
                          }
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {creating && doc && (
        <QuestionEditor
          ownerId={doc.id}
          paper={kind === "paper"}
          availableTags={qTags}
          onClose={() => setCreating(false)}
          onSaved={reload}
        />
      )}
      {editing && doc && (
        <QuestionEditor
          question={editing}
          ownerId={doc.id}
          paper={kind === "paper"}
          availableTags={qTags}
          onClose={() => setEditing(undefined)}
          onSaved={reload}
        />
      )}
      {picking && paper && (
        <QuestionPicker
          paperId={paper.id}
          onClose={() => setPicking(false)}
          onSaved={reload}
        />
      )}
      {composing && paper && (
        <ComposerEditor
          paper={paper}
          onClose={() => setComposing(false)}
          onSaved={reload}
        />
      )}
      {following && paper && (
        <FollowDialog
          paper={paper}
          tags={qTags}
          onClose={() => setFollowing(false)}
          onSaved={reload}
        />
      )}
      {propsOpen && doc && (
        <DocumentEditor
          kind={kind === "bank" ? "banks" : "papers"}
          document={doc}
          tags={fTags}
          onClose={() => setPropsOpen(false)}
          onSaved={reload}
        />
      )}
      {previewOpen && paper && (
        <Modal
          title={`预览 · ${paper.name}`}
          onClose={() => setPreviewOpen(false)}
          className="w-[min(760px,calc(100vw-2rem))]"
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => setRevealPreview((r) => !r)}
              >
                {revealPreview ? "隐藏答案解析" : "显示答案解析"}
              </Button>
              <Button variant="default" onClick={() => setPreviewOpen(false)}>
                关闭
              </Button>
            </>
          }
        >
          <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
            {paper.sections.map((section) => (
              <section key={section.id} className="space-y-3">
                <h3 className="m-0 text-[14px] font-semibold text-primary">
                  {section.title}
                </h3>
                <div className="space-y-4">
                  {section.items.map((item, i) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="mb-1.5 text-[12px] font-medium text-muted-foreground tabular-nums">
                        第 {i + 1} 题 ·{" "}
                        {item.question.max_score !== undefined
                          ? `${item.question.max_score} 分`
                          : "不计分"}
                      </div>
                      <QuestionPreview
                        question={item.question}
                        reveal={revealPreview}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Modal>
      )}
      {confirm.dialog}
    </div>
  );
}

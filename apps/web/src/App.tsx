import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  Command as CommandIcon,
  FolderOpen,
  History,
  Home as HomeIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import logoUrl from "./assets/logo.svg";
import { client } from "./api/client.js";
import type { Bank, Paper } from "./api/client.js";
import {
  closeTab,
  navigateTab,
  newTab,
  type Route,
  type WorkspaceTab,
} from "./state.js";
import { ViewContext } from "./components/ui.js";
import { Badge } from "./components/ui/badge.js";
import { Button } from "./components/ui/button.js";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./components/ui/command.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip.js";
import { cn } from "./lib/utils.js";
import { Detail, Library } from "./pages/Library.js";
import { Home, Mistakes, Records, Settings, Trash } from "./pages/Learning.js";
import { Result, Study } from "./pages/Study.js";

const tabsKey = "quarry-production-tabs";

function loadTabs(): { tabs: WorkspaceTab[]; active: string } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(tabsKey) ?? "null") as {
      tabs: WorkspaceTab[];
      active: string;
    } | null;
    if (saved?.tabs?.length) return saved;
  } catch {}
  const first = newTab();
  return { tabs: [first], active: first.id };
}

function viewKey(route: Route) {
  return route.page + ":" + (route.id ?? "");
}

function defaultLabel(route: Route) {
  return (
    {
      home: "首页",
      library: "题库与套题",
      bank: "题库详情",
      paper: "套题详情",
      study: "作答",
      result: "成绩报告",
      mistakes: "错题本",
      records: "练习记录",
      trash: "回收站",
      settings: "系统设置",
    }[route.page] ?? "题匣"
  );
}

const primaryNav = [
  { key: "home", label: "首页", icon: HomeIcon },
  { key: "library", label: "题库与套题", icon: BookOpen },
  { key: "mistakes", label: "错题本", icon: RotateCcw },
  { key: "records", label: "练习记录", icon: History },
] as const;

const secondaryNav = [
  { key: "trash", label: "回收站", icon: Trash2 },
  { key: "settings", label: "系统设置", icon: SettingsIcon },
] as const;

export function App() {
  const initial = useRef(loadTabs());
  const [tabs, setTabs] = useState<WorkspaceTab[]>(initial.current.tabs);
  const [active, setActive] = useState<string>(initial.current.active);
  const [compact, setCompact] = useState(false);
  const [rail, setRail] = useState<ReactNode>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [reviewCount, setReviewCount] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickItems, setQuickItems] = useState<{
    banks: Bank[];
    papers: Paper[];
  }>({ banks: [], papers: [] });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    try {
      sessionStorage.setItem(tabsKey, JSON.stringify({ tabs, active }));
    } catch {}
  }, [tabs, active]);

  const refreshReview = useCallback(() => {
    void client.mistakes
      .list({ mastery_status: "reviewing" })
      .then((list) => setReviewCount(list.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshReview();
  }, [refreshReview]);

  useEffect(() => {
    let live = true;
    void Promise.all([
      client.folders.list().catch(() => []),
      client.banks.list().catch(() => []),
      client.papers.list().catch(() => []),
    ]).then(([folders, banks, papers]) => {
      if (!live) return;
      const map: Record<string, string> = {};
      for (const f of folders) map[`library:${f.id}`] = f.name;
      for (const b of banks) map[`bank:${b.id}`] = b.name;
      for (const p of papers) map[`paper:${p.id}`] = p.name;
      setTitles((prev) => ({ ...prev, ...map }));
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    let live = true;
    void Promise.all([client.banks.list(), client.papers.list()])
      .then(([banks, papers]) => {
        if (live) setQuickItems({ banks, papers });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [commandOpen]);

  const current = tabs.find((t) => t.id === active) ?? tabs[0]!;
  const route = current.route;
  const currentView = viewKey(route);

  function saveViewPatch(patch: { search?: string; scroll?: number }) {
    setTabs((list) =>
      list.map((t) =>
        t.id === current.id
          ? {
              ...t,
              views: {
                ...t.views,
                [currentView]: { ...t.views[currentView], ...patch },
              },
            }
          : t,
      ),
    );
  }

  useEffect(() => {
    const scrollY = current.views[currentView]?.scroll ?? 0;
    window.scrollTo(0, scrollY);
  }, [current.id, currentView]);

  const navigate = useCallback(
    (next: Route) => {
      saveViewPatch({ scroll: window.scrollY });
      setTabs((list) =>
        list.map((t) => (t.id === active ? navigateTab(t, next) : t)),
      );
    },
    [active, currentView],
  );

  function step(delta: -1 | 1) {
    saveViewPatch({ scroll: window.scrollY });
    setTabs((list) =>
      list.map((t) => {
        if (t.id !== active) return t;
        const cursor = t.cursor + delta;
        const nextRoute = t.history[cursor];
        if (!nextRoute) return t;
        return { ...t, cursor, route: nextRoute };
      }),
    );
  }

  function addTab() {
    saveViewPatch({ scroll: window.scrollY });
    const tab = newTab();
    setTabs((list) => [...list, tab]);
    setActive(tab.id);
  }

  function removeTab(id: string) {
    saveViewPatch({ scroll: window.scrollY });
    const next = closeTab(tabs, id);
    setTabs(next);
    if (active === id) setActive(next[next.length - 1]!.id);
  }

  function focusTab(index: number) {
    const target = tabs[index];
    if (!target) return;
    saveViewPatch({ scroll: window.scrollY });
    setActive(target.id);
    requestAnimationFrame(() => tabRefs.current[target.id]?.focus());
  }

  function tabLabel(tab: WorkspaceTab) {
    return titles[viewKey(tab.route)] ?? defaultLabel(tab.route);
  }

  function isNavActive(key: string) {
    if (route.page === key) return true;
    if (key === "library" && (route.page === "bank" || route.page === "paper"))
      return true;
    if (key === "records" && route.page === "result") return true;
    return false;
  }

  const handleTitle = useCallback(
    (title: string) => {
      setTitles((prev) =>
        prev[currentView] === title ? prev : { ...prev, [currentView]: title },
      );
    },
    [currentView],
  );
  const navigation = useMemo(
    () => ({
      back: () => step(-1),
      forward: () => step(1),
      home: () => navigate({ page: "home" }),
      canBack: current.cursor > 0,
      canForward: current.cursor < current.history.length - 1,
    }),
    [current.cursor, current.history.length, navigate],
  );

  const isStudyView = route.page === "study" && !!rail;

  function renderNavButton(
    item: (typeof primaryNav)[number] | (typeof secondaryNav)[number],
    badge?: number,
  ) {
    const activeItem = isNavActive(item.key);
    const IconComp = item.icon;
    const button = (
      <button
        key={item.key}
        type="button"
        aria-current={activeItem ? "page" : undefined}
        aria-label={item.label}
        onClick={() => navigate({ page: item.key })}
        className={cn(
          "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
          compact && "justify-center px-0",
          !compact && "max-[960px]:justify-center max-[960px]:px-0",
          activeItem
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(45,92,72,0.12)]"
            : "text-sidebar-foreground/85 hover:bg-black/[0.045] hover:text-foreground",
        )}
      >
        <IconComp
          className={cn(
            "size-4 shrink-0 transition-colors",
            activeItem
              ? "text-primary"
              : "text-muted-foreground group-hover:text-foreground",
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            compact && "hidden",
            !compact && "max-[960px]:hidden",
          )}
        >
          {item.label}
        </span>
        {badge !== undefined && badge > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "h-5 min-w-5 justify-center rounded-full bg-primary/12 px-1.5 text-[11px] font-semibold text-primary tabular-nums",
              compact && "hidden",
              !compact && "max-[960px]:hidden",
            )}
          >
            {badge}
          </Badge>
        )}
      </button>
    );

    if (!compact) return button;
    return (
      <Tooltip key={item.key}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
        {/* Integrated 42px Frameless Titlebar & Workspace Tabs */}
        <header className="quarry-titlebar sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-sidebar/95 px-2.5 backdrop-blur-sm">
          <div className="quarry-no-drag flex shrink-0 items-center gap-2 px-1.5">
            <img
              src={logoUrl}
              alt="题匣"
              className="size-5 rounded-[5px] object-contain"
            />
            <span className="hidden font-serif text-[14.5px] font-semibold tracking-tight text-foreground sm:inline">
              题匣
            </span>
          </div>

          <div
            className="quarry-no-drag flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1"
            role="tablist"
            aria-label="工作标签页"
          >
            {tabs.map((tab, index) => {
              const isSelected = tab.id === current.id;
              const label = tabLabel(tab);
              return (
                <div
                  key={tab.id}
                  className={cn(
                    "group/tab inline-flex h-7.5 max-w-[200px] min-w-[96px] items-center rounded-md border text-[12.5px] transition-all",
                    isSelected
                      ? "border-border bg-card text-foreground shadow-[0_1px_2px_rgba(23,27,25,0.05)]"
                      : "border-transparent bg-transparent text-muted-foreground hover:bg-black/[0.04] hover:text-foreground",
                  )}
                >
                  <button
                    ref={(node) => {
                      tabRefs.current[tab.id] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    className="h-full min-w-0 flex-1 truncate px-2.5 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                    onClick={() => {
                      saveViewPatch({ scroll: window.scrollY });
                      setActive(tab.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight") {
                        event.preventDefault();
                        focusTab((index + 1) % tabs.length);
                      } else if (event.key === "ArrowLeft") {
                        event.preventDefault();
                        focusTab((index - 1 + tabs.length) % tabs.length);
                      } else if (event.key === "Home") {
                        event.preventDefault();
                        focusTab(0);
                      } else if (event.key === "End") {
                        event.preventDefault();
                        focusTab(tabs.length - 1);
                      }
                    }}
                  >
                    {label}
                  </button>
                  {tabs.length > 1 && (
                    <button
                      type="button"
                      className="mr-1 inline-flex size-4.5 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-65 transition-colors hover:bg-muted hover:text-foreground group-hover/tab:opacity-100"
                      aria-label={`关闭 ${label}`}
                      onClick={() => removeTab(tab.id)}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="新建标签页"
              onClick={addTab}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <div className="quarry-no-drag ml-auto flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              aria-label="快速命令"
              onClick={() => setCommandOpen(true)}
              className="h-7 gap-1.5 bg-card/80 px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <CommandIcon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">快速跳转</span>
              <kbd className="hidden rounded border border-border bg-muted px-1 py-px font-mono text-[10.5px] text-muted-foreground md:inline">
                Ctrl K
              </kbd>
            </Button>
          </div>
        </header>

        {/* App Body: Sidebar + Main Canvas */}
        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="主导航"
            className={cn(
              "sticky top-[42px] flex h-[calc(100vh-42px)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-2.5 transition-[width] duration-200",
              compact
                ? "w-[58px] items-center px-1.5"
                : isStudyView
                  ? "w-[224px]"
                  : "w-[224px] max-[960px]:w-[58px] max-[960px]:items-center max-[960px]:px-1.5",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-2 px-1 pb-2",
                compact && "justify-center px-0",
                !compact &&
                  !isStudyView &&
                  "max-[960px]:justify-center max-[960px]:px-0",
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-semibold tracking-wider text-muted-foreground/75 uppercase",
                  compact && "hidden",
                  !compact && !isStudyView && "max-[960px]:hidden",
                )}
              >
                {isStudyView ? "作答控制台" : "学习空间"}
              </span>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={compact ? "展开导航" : "收起导航"}
                aria-expanded={!compact}
                onClick={() => setCompact((c) => !c)}
                className="text-muted-foreground hover:text-foreground"
              >
                {compact ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </Button>
            </div>

            {isStudyView ? (
              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto pt-1",
                  compact && "hidden",
                )}
              >
                {rail}
              </div>
            ) : (
              <nav className="flex flex-1 flex-col gap-1 pt-1" aria-label="功能区">
                <div className="space-y-1">
                  {primaryNav.map((item) =>
                    renderNavButton(
                      item,
                      item.key === "mistakes" ? reviewCount : undefined,
                    ),
                  )}
                </div>
                <div className="mt-auto space-y-1 pt-4">
                  {secondaryNav.map((item) => renderNavButton(item))}
                </div>
              </nav>
            )}
          </aside>

          <main
            className="min-w-0 flex-1 bg-background"
            aria-labelledby={`tab-${current.id}`}
          >
            <ViewContext.Provider value={current.id + ":" + currentView}>
              <div className="mx-auto max-w-[1260px] px-7 py-6 max-[960px]:px-5 max-[960px]:py-5">
                {route.page === "home" && <Home navigate={navigate} />}
                {route.page === "library" && (
                  <Library
                    {...(route.id ? { folder: route.id } : {})}
                    navigate={navigate}
                    navigation={navigation}
                    search={current.views[currentView]?.search ?? ""}
                    setSearch={(search) => saveViewPatch({ search })}
                  />
                )}
                {(route.page === "bank" || route.page === "paper") && (
                  <Detail
                    kind={route.page}
                    id={route.id!}
                    navigate={navigate}
                    navigation={navigation}
                    onTitle={handleTitle}
                  />
                )}
                {route.page === "study" && (
                  <Study
                    id={route.id!}
                    navigate={navigate}
                    onRail={setRail}
                    onSubmitted={refreshReview}
                    onTitle={handleTitle}
                  />
                )}
                {route.page === "result" && (
                  <Result
                    id={route.id!}
                    navigation={navigation}
                    onBack={() => navigate({ page: "records" })}
                  />
                )}
                {route.page === "mistakes" && (
                  <Mistakes navigate={navigate} onChanged={refreshReview} />
                )}
                {route.page === "records" && <Records navigate={navigate} />}
                {route.page === "trash" && <Trash onChanged={refreshReview} />}
                {route.page === "settings" && <Settings />}
              </div>
            </ViewContext.Provider>
          </main>
        </div>

        {/* Ctrl+K Command Palette */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="搜索视图、题库或套题…" />
          <CommandList>
            <CommandEmpty>没有找到匹配的页面或文件</CommandEmpty>
            <CommandGroup heading="页面导航">
              {[...primaryNav, ...secondaryNav].map((item) => {
                const IconComp = item.icon;
                return (
                  <CommandItem
                    key={item.key}
                    value={`页面 ${item.label}`}
                    onSelect={() => {
                      setCommandOpen(false);
                      navigate({ page: item.key });
                    }}
                  >
                    <IconComp className="size-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {quickItems.papers.length > 0 && (
              <CommandGroup heading="套题">
                {quickItems.papers.slice(0, 8).map((paper) => (
                  <CommandItem
                    key={paper.id}
                    value={`套题 ${paper.name}`}
                    onSelect={() => {
                      setCommandOpen(false);
                      setTitles((prev) => ({
                        ...prev,
                        [`paper:${paper.id}`]: paper.name,
                      }));
                      navigate({ page: "paper", id: paper.id });
                    }}
                  >
                    <Sparkles className="size-4 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{paper.name}</span>
                    <span className="text-[11.5px] text-muted-foreground tabular-nums">
                      {paper.sections.reduce((n, s) => n + s.items.length, 0)} 题
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {quickItems.banks.length > 0 && (
              <CommandGroup heading="题库">
                {quickItems.banks.slice(0, 8).map((bank) => (
                  <CommandItem
                    key={bank.id}
                    value={`题库 ${bank.name}`}
                    onSelect={() => {
                      setCommandOpen(false);
                      setTitles((prev) => ({
                        ...prev,
                        [`bank:${bank.id}`]: bank.name,
                      }));
                      navigate({ page: "bank", id: bank.id });
                    }}
                  >
                    <FolderOpen className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{bank.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </CommandDialog>
      </div>
    </TooltipProvider>
  );
}

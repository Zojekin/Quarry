import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
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
import { Icon } from "./components/Icons.js";
import type { LibraryClipboard } from "./components/LibraryFileActions.js";
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
import { getDesktopUpdater, useDesktopUpdateState } from "./lib/desktop-updater.js";
import { questionSizes, usePreferences } from "./lib/preferences.js";
import { ThemeProvider } from "./lib/theme-context.js";
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
      library: "资料库",
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
  { key: "library", label: "资料库", icon: BookOpen },
  { key: "mistakes", label: "错题本", icon: RotateCcw },
  { key: "records", label: "练习记录", icon: History },
] as const;

const secondaryNav = [
  { key: "trash", label: "回收站", icon: Trash2 },
  { key: "settings", label: "系统设置", icon: SettingsIcon },
] as const;

export function App() {
  return (
    <ThemeProvider>
      <Workspace />
    </ThemeProvider>
  );
}

function Workspace() {
  const preferences = usePreferences();
  const questionSize = questionSizes[preferences.questionSize];
  const { glassTransparency } = preferences;
  const initial = useRef(loadTabs());
  const [tabs, setTabs] = useState<WorkspaceTab[]>(initial.current.tabs);
  const [active, setActive] = useState<string>(initial.current.active);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(preferences.sidebarCollapsed);
  const [narrowSidebarCollapsed, setNarrowSidebarCollapsed] = useState<boolean | null>(null);
  const [narrowViewport] = useState(() => window.matchMedia?.("(max-width: 960px)"));
  const [isNarrow, setIsNarrow] = useState(() => narrowViewport?.matches ?? false);
  useEffect(() => {
    const sync = () => setIsNarrow(narrowViewport?.matches ?? false);
    narrowViewport?.addEventListener("change", sync);
    sync();
    return () => narrowViewport?.removeEventListener("change", sync);
  }, [narrowViewport]);
  const [rail, setRail] = useState<ReactNode>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [reviewCount, setReviewCount] = useState(0);
  const updateReady = useDesktopUpdateState(getDesktopUpdater())?.status === "downloaded";
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    style.setProperty("--question-size", `${questionSize}px`);
    return () => { style.removeProperty("--question-size"); };
  }, [questionSize]);
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    style.setProperty("--glass-transparency", String(glassTransparency / 100));
    return () => { style.removeProperty("--glass-transparency"); };
  }, [glassTransparency]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [libraryClipboard, setLibraryClipboard] = useState<LibraryClipboard>();
  const [quickItems, setQuickItems] = useState<{
    banks: Bank[];
    papers: Paper[];
  }>({ banks: [], papers: [] });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    tabRefs.current[active]?.parentElement?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);

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
  const autoCompact = isNarrow && !isStudyView;
  const compact = autoCompact ? (narrowSidebarCollapsed ?? true) : sidebarCollapsed;
  const sidebarWidth = compact ? "[--sidebar-width:58px]" : "[--sidebar-width:224px]";
  const sidebarColumn = "w-(--sidebar-width) shrink-0 transition-[width] duration-200";

  function toggleSidebar() {
    if (autoCompact) setNarrowSidebarCollapsed(!compact);
    else setSidebarCollapsed(!compact);
  }

  const quickCommand = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="快速命令"
          onClick={() => setCommandOpen(true)}
          className="size-[36px] hover:bg-(--sidebar-hover)"
        >
          <Icon name="command" className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={compact ? "right" : "top"}>快速命令 (Ctrl+K)</TooltipContent>
    </Tooltip>
  );
  function renderNavButton(
    item: (typeof primaryNav)[number] | (typeof secondaryNav)[number],
    iconOnly = compact,
  ) {
    const activeItem = isNavActive(item.key);
    const showUpdate = item.key === "settings" && updateReady;
    const badge = item.key === "mistakes" ? reviewCount : 0;
    const IconComp = item.icon;
    const button = (
      <button
        key={item.key}
        type="button"
        aria-current={activeItem ? "page" : undefined}
        aria-label={item.label}
        aria-description={showUpdate ? "更新已就绪" : undefined}
        onClick={() => navigate({ page: item.key })}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-lg text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
          iconOnly ? "size-[36px] shrink-0 justify-center" : "h-9 w-full px-2.5",
          activeItem
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
            : "text-sidebar-foreground/85 hover:bg-(--sidebar-hover) hover:text-foreground",
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
        {showUpdate && (
          <span aria-hidden="true" title="更新已就绪" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
        )}
        {!iconOnly && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
        {!iconOnly && badge > 0 && (
          <Badge
            variant="secondary"
            className="h-5 min-w-5 justify-center rounded-full bg-primary/12 px-1.5 text-[11px] font-semibold text-primary tabular-nums"
          >
            {badge}
          </Badge>
        )}
      </button>
    );

    if (!iconOnly) return button;
    return (
      <Tooltip key={item.key}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side={compact ? "right" : "top"}>{showUpdate ? `${item.label}（更新已就绪）` : item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(
        "flex min-h-dvh w-full flex-col bg-background text-foreground",
        sidebarWidth,
        isStudyView && !compact && "max-[960px]:[--sidebar-width:156px]",
      )}>
        <header className="quarry-titlebar sticky top-0 z-30 flex bg-background">
          <div className={cn("flex items-center bg-sidebar px-1.5", sidebarColumn, compact ? "justify-center" : "justify-between")}>
            {!compact && (
              <div className="flex items-center gap-1.5 pl-1">
                <img src={logoUrl} alt="" className="size-5 rounded-[5px] object-contain" />
                <span className="whitespace-nowrap font-serif text-[14.5px] font-semibold tracking-tight">
                  题匣
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={compact ? "展开导航" : "收起导航"}
              aria-expanded={!compact}
              onClick={toggleSidebar}
              className="quarry-no-drag size-[36px] hover:bg-(--sidebar-hover)"
            >
              {compact ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
          </div>

          <div className="quarry-titlebar-content mx-auto flex min-w-0 max-w-[1260px] flex-1 items-center gap-1 pl-7 max-[960px]:pl-5">
            <div className="quarry-tabs flex min-w-0 items-center gap-1 overflow-x-auto py-1" role="tablist" aria-label="工作标签页">
              {tabs.map((tab, index) => {
                const isSelected = tab.id === current.id;
                const label = tabLabel(tab);
                return (
                  <div
                    key={tab.id}
                    className={cn(
                      "quarry-no-drag group/tab inline-flex h-7.5 max-w-[200px] min-w-[96px] items-center rounded-md border text-[12.5px] transition-all",
                      isSelected
                        ? "border-border bg-card text-foreground shadow-[0_1px_2px_rgba(var(--shadow-ink),0.05)]"
                        : "border-transparent bg-transparent text-muted-foreground hover:bg-(--tab-hover) hover:text-foreground",
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
            </div>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="新建标签页"
              onClick={addTab}
              className="quarry-no-drag shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </header>

        {/* App Body: Sidebar + Main Canvas */}
        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="主导航"
            className={cn("quarry-sidebar sticky flex flex-col bg-sidebar p-2.5", sidebarColumn)}
          >
            {isStudyView ? (
              <div className={cn("min-h-0 flex-1 overflow-y-auto pt-1", compact && "hidden")}>
                <p className="px-1 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground/75">
                  作答控制台
                </p>
                {rail}
              </div>
            ) : (
              <nav className="flex min-h-0 flex-1 flex-col gap-[4px] overflow-y-auto pt-1" aria-label="功能区">
                <div className={cn("flex flex-col gap-[4px]", compact && "items-center")}>
                  {primaryNav.map((item) => renderNavButton(item))}
                </div>
                <div className={cn("mt-auto flex items-center gap-[4px] pt-4", compact && "flex-col")}>
                  {quickCommand}
                  {secondaryNav.map((item) => renderNavButton(item, true))}
                </div>
              </nav>
            )}
            {isStudyView && compact && (
              <div className="mt-auto flex justify-center">{quickCommand}</div>
            )}
          </aside>

          <main
            className="min-w-0 flex-1 bg-background"
            aria-labelledby={`tab-${current.id}`}
          >
            <ViewContext.Provider
              key={current.id + ":" + currentView}
              value={current.id + ":" + currentView}
            >
              <div className="mx-auto max-w-[1260px] px-7 py-6 max-[960px]:px-5 max-[960px]:py-5">
                {route.page === "home" && <Home navigate={navigate} />}
                {route.page === "library" && (
                  <Library
                    {...(route.id ? { folder: route.id } : {})}
                    navigate={navigate}
                    navigation={navigation}
                    clipboard={libraryClipboard}
                    setClipboard={setLibraryClipboard}
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
                {quickItems.papers.map((paper) => (
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
                {quickItems.banks.map((bank) => (
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

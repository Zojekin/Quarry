import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { newTab, navigateTab, closeTab } from "./state.js";
import type { Route, WorkspaceTab } from "./state.js";
import { ViewContext } from "./components/ui.js";
import { Icon, type IconName } from "./components/Icons.js";
import { client } from "./api/client.js";
import logoUrl from "./assets/logo.svg";
import { Library, Detail } from "./pages/Library.js";
import { Home, Mistakes, Records, Settings, Trash } from "./pages/Learning.js";
import { Study, Result } from "./pages/Study.js";
const labels: Record<string, string> = {
  home: "首页",
  library: "资料库",
  bank: "题库",
  paper: "套题",
  study: "答题",
  result: "答题结果",
  mistakes: "错题本",
  records: "学习记录",
  settings: "设置",
  trash: "回收站",
};
const pageIcons: Record<string, IconName> = {
  home: "home",
  library: "library",
  bank: "library",
  paper: "paper",
  study: "play",
  result: "records",
  mistakes: "mistakes",
  records: "records",
  settings: "settings",
  trash: "trash",
};
function pageIcon(page: string) {
  return pageIcons[page] ?? "paper";
}

function restore() {
  try {
    const data = JSON.parse(
      sessionStorage.getItem("quarry-production-tabs") ?? "null",
    ) as { tabs: WorkspaceTab[]; active: string } | null;
    if (
      data?.tabs.length &&
      data.tabs.every((t) => t.id && t.route && t.history && t.views)
    )
      return data;
  } catch {}
  const tab = newTab();
  return { tabs: [tab], active: tab.id };
}
export function App() {
  const [initial] = useState(restore);
  const [tabs, setTabs] = useState(initial.tabs);
  const [active, setActive] = useState(initial.active);
  const [compact, setCompact] = useState(false);
  const [rail, setRail] = useState<ReactNode>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const refreshReviewCount = useCallback(() => {
    void client.mistakes
      .list({ mastery_status: "reviewing" })
      .then((items) => setReviewCount(items.length))
      .catch(() => {});
  }, []);
  const current = tabs.find((t) => t.id === active) ?? tabs[0]!;
  const route = current.route;
  const key = route.page + "/" + (route.id ?? "");
  const container = useRef<HTMLElement>(null);
  const scrolls = useRef<Record<string, number>>({});
  const restoringScroll = useRef(false);
  useLayoutEffect(() => {
    try {
      Object.assign(
        scrolls.current,
        JSON.parse(sessionStorage.getItem("quarry-scrolls") ?? "{}"),
      );
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "quarry-production-tabs",
        JSON.stringify({ tabs, active }),
      );
    } catch {}
  }, [tabs, active]);
  const navigate = useCallback(
    (r: Route) =>
      setTabs((list) =>
        list.map((t) => (t.id === active ? navigateTab(t, r) : t)),
      ),
    [active],
  );
  function search(value: string) {
    setTabs((list) =>
      list.map((t) =>
        t.id === active
          ? {
              ...t,
              views: { ...t.views, [key]: { ...t.views[key], search: value } },
            }
          : t,
      ),
    );
  }
  function history(direction: number) {
    setTabs((list) =>
      list.map((t) => {
        if (t.id !== active) return t;
        const cursor = Math.max(
          0,
          Math.min(t.history.length - 1, t.cursor + direction),
        );
        return { ...t, cursor, route: t.history[cursor]! };
      }),
    );
  }
  useEffect(() => {
    if (route.page !== "study") refreshReviewCount();
  }, [active, key, refreshReviewCount]);
  useLayoutEffect(() => {
    const page = container.current?.querySelector(".page-content");
    if (!page) return;
    const scrollKey = `${active}/${key}`;
    const target = scrolls.current[scrollKey] ?? 0;
    restoringScroll.current = true;
    const stop = () => {
      restoringScroll.current = false;
      observer.disconnect();
    };
    const restore = () => {
      if (window.scrollY !== target) window.scrollTo(0, target);
      if (document.documentElement.scrollHeight - window.innerHeight >= target)
        stop();
    };
    const observer = new ResizeObserver(restore);
    observer.observe(page);
    restore();
    const save = () => {
      if (restoringScroll.current) return;
      scrolls.current[scrollKey] = window.scrollY;
      try {
        sessionStorage.setItem(
          "quarry-scrolls",
          JSON.stringify(scrolls.current),
        );
      } catch {}
    };
    window.addEventListener("scroll", save);
    window.addEventListener("wheel", stop, { once: true });
    return () => {
      stop();
      window.removeEventListener("scroll", save);
      window.removeEventListener("wheel", stop);
    };
  }, [active, key]);
  const navigation = {
    back: () => history(-1),
    forward: () => history(1),
    home: () => navigate({ page: "home" }),
    canBack: current.cursor > 0,
    canForward: current.cursor < current.history.length - 1,
  };
  const studying = route.page === "study";
  const selectedPage =
    route.page === "bank" || route.page === "paper" ? "library" : route.page;
  function navButton(page: string) {
    return (
      <button
        type="button"
        key={page}
        className={`nav-link ${selectedPage === page ? "selected" : ""}`}
        title={labels[page]}
        aria-label={labels[page]}
        aria-current={selectedPage === page ? "page" : undefined}
        onClick={() => navigate({ page })}
      >
        <Icon name={pageIcon(page)} />
        <span>{labels[page]}</span>
        {page === "mistakes" && <small>{reviewCount}</small>}
      </button>
    );
  }
  return (
    <div id="app">
      <aside
        className={`app-sidebar ${compact ? "compact" : ""} ${studying ? "study-sidebar" : ""}`}
      >
        <div className="brand-row">
          <button
            type="button"
            className="brand"
            aria-label="题匣首页"
            onClick={navigation.home}
          >
            <img src={logoUrl} alt="题匣" />
            <b>题匣</b>
          </button>
          <button
            type="button"
            className="button icon-button"
            aria-label={compact ? "展开侧栏" : "收起侧栏"}
            aria-expanded={!compact}
            onClick={() => setCompact(!compact)}
          >
            <Icon name="panel" />
          </button>
        </div>
        {studying ? (
          rail
        ) : (
          <>
            <nav className="main-nav" aria-label="主导航">
              {["home", "library", "mistakes", "records"].map(navButton)}
            </nav>
            <div className="sidebar-bottom">
              {["trash", "settings"].map(navButton)}
            </div>
          </>
        )}
      </aside>
      <main ref={container} className="app-main">
        <header className="app-top workspace-header">
          <nav className="workspace-tabs" aria-label="工作区标签页">
            <div
              className="workspace-tab-list"
              role="tablist"
              aria-label="打开的页面"
              onKeyDown={(event) => {
                if (
                  !(event.target instanceof Element) ||
                  event.target.getAttribute("role") !== "tab"
                )
                  return;
                const i = tabs.findIndex((tab) => tab.id === active);
                const next =
                  event.key === "ArrowRight"
                    ? (i + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (i + tabs.length - 1) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : -1;
                if (next >= 0) {
                  event.preventDefault();
                  setActive(tabs[next]!.id);
                  event.currentTarget
                    .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                    [next]?.focus();
                }
              }}
            >
              {tabs.map((tab) => (
                <div
                  className={`workspace-tab ${active === tab.id ? "active" : ""}`}
                  key={tab.id}
                >
                  <button
                    type="button"
                    className="workspace-tab-button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-controls="workspace-page"
                    aria-selected={active === tab.id}
                    tabIndex={active === tab.id ? 0 : -1}
                    onClick={() => setActive(tab.id)}
                  >
                    <Icon name={pageIcon(tab.route.page)} />
                    <span>{labels[tab.route.page]}</span>
                  </button>
                  {tabs.length > 1 && (
                    <button
                      type="button"
                      className="button tab-close"
                      aria-label={`关闭${labels[tab.route.page]}`}
                      onClick={() => {
                        const next = closeTab(tabs, tab.id);
                        const nextActive =
                          active === tab.id
                            ? next[Math.max(0, tabs.indexOf(tab) - 1)]!.id
                            : active;
                        setTabs(next);
                        setActive(nextActive);
                        document.getElementById(`tab-${nextActive}`)?.focus();
                      }}
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="button new-tab-button"
              aria-label="新建标签页"
              onClick={() => {
                const tab = newTab();
                setTabs([...tabs, tab]);
                setActive(tab.id);
                requestAnimationFrame(() =>
                  document.getElementById(`tab-${tab.id}`)?.focus(),
                );
              }}
            >
              +
            </button>
          </nav>
        </header>
        <ViewContext.Provider
          key={`${active}/${key}`}
          value={`${active}/${key}`}
        >
          <div
            id="workspace-page"
            role="tabpanel"
            aria-labelledby={`tab-${current.id}`}
            className="page-content"
          >
            {route.page === "home" ? (
              <Home navigate={navigate} />
            ) : route.page === "library" ? (
              <Library
                navigate={navigate}
                navigation={navigation}
                {...(route.id ? { folder: route.id } : {})}
                search={current.views[key]?.search ?? ""}
                setSearch={search}
              />
            ) : route.page === "bank" || route.page === "paper" ? (
              <Detail
                navigate={navigate}
                navigation={navigation}
                id={route.id!}
                paper={route.page === "paper"}
              />
            ) : route.page === "study" ? (
              <Study navigate={navigate} id={route.id!} onRail={setRail} />
            ) : route.page === "result" ? (
              <Result navigate={navigate} id={route.id!} />
            ) : route.page === "mistakes" ? (
              <Mistakes
                navigate={navigate}
                onMasteryChanged={refreshReviewCount}
              />
            ) : route.page === "records" ? (
              <Records navigate={navigate} />
            ) : route.page === "settings" ? (
              <Settings />
            ) : (
              <Trash />
            )}
          </div>
        </ViewContext.Provider>
      </main>
    </div>
  );
}

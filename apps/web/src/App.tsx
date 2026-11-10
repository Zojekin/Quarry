import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { newTab, navigateTab, closeTab } from "./state.js";
import type { Route, WorkspaceTab } from "./state.js";
import { ViewContext } from "./components/ui.js";
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
  const current = tabs.find((t) => t.id === active) ?? tabs[0]!;
  const route = current.route;
  const key = route.page + "/" + (route.id ?? "");
  const container = useRef<HTMLElement>(null);
  const scrolls = useRef<Record<string, number>>({});
  const restoringScroll = useRef(false);
  useEffect(() => {
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
    const main = container.current;
    if (!main) return;
    const target = scrolls.current[`${active}/${key}`] ?? 0;
    restoringScroll.current = true;
    const stop = () => {
      restoringScroll.current = false;
      observer.disconnect();
    };
    const restore = () => {
      main.scrollTop = target;
      if (main.scrollHeight - main.clientHeight >= target) stop();
    };
    const observer = new ResizeObserver(restore);
    const page = main.querySelector(".page-content");
    if (page) observer.observe(page);
    restore();
    main.addEventListener("wheel", stop, { once: true });
    return () => {
      stop();
      main.removeEventListener("wheel", stop);
    };
  }, [active, key]);
  const props = { navigate };
  return (
    <div className={`production-shell ${compact ? "is-compact" : ""}`}>
      <aside className="production-sidebar">
        <button
          className="button quiet compact"
          aria-label={compact ? "展开侧栏" : "收起侧栏"}
          onClick={() => setCompact(!compact)}
        >
          ☰
        </button>
        {!compact && (
          <>
            <h2 className="brand">题匣</h2>
            {route.page === "study" ? (
              rail
            ) : (
              <nav>
                {["home", "library", "mistakes", "records"].map((page) => (
                  <button
                    className={`button quiet ${route.page === page ? "nav-active" : ""}`}
                    key={page}
                    onClick={() => navigate({ page })}
                  >
                    {labels[page]}
                  </button>
                ))}
              </nav>
            )}
            <div className="sidebar-bottom">
              {["trash", "settings"].map((page) => (
                <button
                  className="button quiet"
                  key={page}
                  onClick={() => navigate({ page })}
                >
                  {labels[page]}
                </button>
              ))}
            </div>
          </>
        )}
        {compact && (
          <nav>
            {[
              "home",
              "library",
              "mistakes",
              "records",
              "settings",
              "trash",
            ].map((page) => (
              <button
                className="button icon-only quiet"
                key={page}
                aria-label={labels[page]}
                title={labels[page]}
                onClick={() => navigate({ page })}
              >
                {labels[page]?.slice(0, 1)}
              </button>
            ))}
          </nav>
        )}
      </aside>
      <div className="workspace">
        <div
          className="production-tabs"
          role="tablist"
          aria-label="工作区"
          onKeyDown={(e) => {
            const i = tabs.findIndex((t) => t.id === active);
            const next =
              e.key === "ArrowRight"
                ? (i + 1) % tabs.length
                : e.key === "ArrowLeft"
                  ? (i + tabs.length - 1) % tabs.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? tabs.length - 1
                      : -1;
            if (next >= 0) {
              e.preventDefault();
              setActive(tabs[next]!.id);
              e.currentTarget
                .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus();
            }
          }}
        >
          {tabs.map((t) => (
            <div
              className={`workspace-tab ${active === t.id ? "active" : ""}`}
              key={t.id}
            >
              <button
                role="tab"
                aria-selected={active === t.id}
                tabIndex={active === t.id ? 0 : -1}
                onClick={() => setActive(t.id)}
              >
                {labels[t.route.page]}
              </button>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  aria-label={`关闭${labels[t.route.page]}`}
                  onClick={() => {
                    const next = closeTab(tabs, t.id);
                    setTabs(next);
                    if (active === t.id)
                      setActive(next[Math.max(0, tabs.indexOf(t) - 1)]!.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            className="button quiet icon-only"
            aria-label="新建标签页"
            onClick={() => {
              const tab = newTab();
              setTabs([...tabs, tab]);
              setActive(tab.id);
            }}
          >
            ＋
          </button>
        </div>
        <main
          ref={container}
          onScroll={() => {
            if (restoringScroll.current) return;
            scrolls.current[`${active}/${key}`] =
              container.current?.scrollTop ?? 0;
            try {
              sessionStorage.setItem(
                "quarry-scrolls",
                JSON.stringify(scrolls.current),
              );
            } catch {}
          }}
        >
          <div className="toolbar navigation-tools">
            <button
              className="button quiet compact"
              aria-label="返回"
              disabled={current.cursor === 0}
              onClick={() => history(-1)}
            >
              ←
            </button>
            <button
              className="button quiet compact"
              aria-label="前进"
              disabled={current.cursor === current.history.length - 1}
              onClick={() => history(1)}
            >
              →
            </button>
            <button
              className="button quiet compact"
              aria-label="首页"
              onClick={() => navigate({ page: "home" })}
            >
              ⌂
            </button>
            <span>{labels[route.page]}</span>
          </div>
          <ViewContext.Provider
            key={`${active}/${key}`}
            value={`${active}/${key}`}
          >
            <div className="page-content">
              {route.page === "home" ? (
                <Home {...props} />
              ) : route.page === "library" ? (
                <Library
                  {...props}
                  {...(route.id ? { folder: route.id } : {})}
                  search={current.views[key]?.search ?? ""}
                  setSearch={search}
                />
              ) : route.page === "bank" || route.page === "paper" ? (
                <Detail
                  {...props}
                  id={route.id!}
                  paper={route.page === "paper"}
                />
              ) : route.page === "study" ? (
                <Study {...props} id={route.id!} onRail={setRail} />
              ) : route.page === "result" ? (
                <Result id={route.id!} navigate={navigate} />
              ) : route.page === "mistakes" ? (
                <Mistakes {...props} />
              ) : route.page === "records" ? (
                <Records {...props} />
              ) : route.page === "settings" ? (
                <Settings />
              ) : (
                <Trash />
              )}
            </div>
          </ViewContext.Provider>
        </main>
      </div>
    </div>
  );
}

export interface Route {
  page: string;
  id?: string;
}
export interface WorkspaceTab {
  id: string;
  route: Route;
  history: Route[];
  cursor: number;
  views: Record<string, { search?: string; scroll?: number }>;
}
export function newTab(): WorkspaceTab {
  return {
    id: crypto.randomUUID(),
    route: { page: "home" },
    history: [{ page: "home" }],
    cursor: 0,
    views: {},
  };
}
export function navigateTab(tab: WorkspaceTab, route: Route): WorkspaceTab {
  const history = [...tab.history.slice(0, tab.cursor + 1), route];
  return { ...tab, route, history, cursor: history.length - 1 };
}
export function closeTab(tabs: WorkspaceTab[], id: string) {
  return tabs.length === 1 ? tabs : tabs.filter((t) => t.id !== id);
}
export function formatTime(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return (
    (n >= 3600
      ? `${Math.floor(n / 3600)
          .toString()
          .padStart(2, "0")}:`
      : "") +
    `${Math.floor(n / 60) % 60}`.padStart(2, "0") +
    ":" +
    `${n % 60}`.padStart(2, "0")
  );
}

// @vitest-environment jsdom
/// <reference types="vitest/jsdom" />
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { client } from "../src/api/client.js";
import type { Bank, Folder } from "../src/api/client.js";
import type { LibraryClipboard } from "../src/components/LibraryFileActions.js";
import { TooltipProvider } from "../src/components/ui/tooltip.js";
import { Library } from "../src/pages/Library.js";

beforeEach(() => vi.stubGlobal("localStorage", jsdom.window.localStorage));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

const metadata = { tag_ids: [], updated_at: "2026-11-28T00:00:00Z" };
const folders: Folder[] = [
  { ...metadata, id: "course", name: "课程资料", parent_id: null },
  { ...metadata, id: "chapter", name: "章节", parent_id: "course" },
  { ...metadata, id: "lesson", name: "子章节", parent_id: "chapter" },
  { ...metadata, id: "other", name: "其它资料", parent_id: null },
];
const banks: Bank[] = [
  { ...metadata, id: "bank", name: "地理题库", folder_id: null, description: "" },
  { ...metadata, id: "local", name: "课程题库", folder_id: "course", description: "" },
];

function renderLibrary() {
  vi.spyOn(client.folders, "list").mockResolvedValue(folders);
  vi.spyOn(client.banks, "list").mockResolvedValue(banks);
  vi.spyOn(client.papers, "list").mockResolvedValue([]);
  vi.spyOn(client.questions, "list").mockResolvedValue([]);
  vi.spyOn(client.tags, "list").mockResolvedValue([]);
  const move = vi.spyOn(client.library, "move").mockImplementation(async ({ targets }) =>
    targets.map(item => ({ ...item, name: item.id })));
  const copy = vi.spyOn(client.library, "copy").mockImplementation(async ({ targets }) =>
    targets.map(item => ({ ...item, name: item.id })));
  const remove = vi.spyOn(client.banks, "delete").mockResolvedValue(null);
  const navigation = { back: vi.fn(), forward: vi.fn(), home: vi.fn(), canBack: false, canForward: false };

  function Workspace() {
    const [folder, setFolder] = useState<string>();
    const [clipboard, setClipboard] = useState<LibraryClipboard>();
    return (
      <TooltipProvider>
        <main>
          <Library
            key={folder ?? "root"}
            {...(folder ? { folder } : {})}
            navigate={route => setFolder(route.id)}
            navigation={navigation}
            search=""
            setSearch={() => {}}
            clipboard={clipboard}
            setClipboard={setClipboard}
          />
        </main>
      </TooltipProvider>
    );
  }
  render(<Workspace />);
  return { move, copy, remove };
}

function row(name: string) {
  return screen.getByRole("button", { name, exact: true }).closest("tr")!;
}

function shortcut(key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, ...modifiers });
}

function dragData() {
  const values = new Map<string, string>();
  return {
    types: ["Files"],
    setData(type: string, value: string) {
      this.types.push(type);
      values.set(type, value);
    },
    getData: (type: string) => values.get(type),
  };
}

it("uses the selected rows from the item context menu and pastes that batch via the empty area", async () => {
  const { copy } = renderLibrary();
  await screen.findByRole("button", { name: "地理题库", exact: true });
  fireEvent.click(screen.getByRole("checkbox", { name: "选择 课程资料" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "选择 地理题库" }));
  const dock = within(screen.getByRole("region", { name: "批量操作" }));
  for (const name of ["移动到…", "复制", "剪切", "导出", "删除", "取消选择"]) expect(dock.getByRole("button", { name })).toBeTruthy();

  fireEvent.contextMenu(row("其它资料"));
  let menu = within(await screen.findByRole("menu", { name: "项目操作" }));
  expect(menu.getByRole("menuitem", { name: "打开" })).toBeTruthy();
  expect(menu.getByRole("menuitem", { name: /重命名/ })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });

  fireEvent.contextMenu(row("地理题库"));
  menu = within(await screen.findByRole("menu", { name: "项目操作" }));
  expect(menu.queryByRole("menuitem", { name: "打开" })).toBeNull();
  expect(menu.queryByRole("menuitem", { name: /编辑属性/ })).toBeNull();
  fireEvent.click(menu.getByRole("menuitem", { name: /复制/ }));

  fireEvent.contextMenu(screen.getByRole("main"), { clientX: 20, clientY: 110 });
  menu = within(await screen.findByRole("menu", { name: "资料库操作" }));
  for (const name of ["新建文件夹", "新建题库", "新建套题", "导入文件", /全选/]) {
    expect(menu.getByRole("menuitem", { name })).toBeTruthy();
  }
  expect(menu.queryByRole("menuitem", { name: /列表|网格/ })).toBeNull();
  fireEvent.click(menu.getByRole("menuitem", { name: /粘贴 \(2\)/ }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith({
    targets: [{ entity: "folder", id: "course" }, { entity: "bank", id: "bank" }], target_folder_id: null,
  }));
});

it("opens the overflow menu in list and grid and disables circular destinations in the move picker", async () => {
  const { move } = renderLibrary();
  await screen.findByRole("button", { name: "课程资料", exact: true });
  const entry = within(row("课程资料"));
  expect(entry.getByRole("button", { name: "删除", exact: true })).toBeTruthy();
  expect(entry.queryByRole("button", { name: "导出", exact: true })).toBeNull();
  fireEvent.keyDown(entry.getByRole("button", { name: "更多操作" }), { key: "ArrowDown" });
  const menu = within(await screen.findByRole("menu"));
  expect(menu.getByRole("menuitem", { name: "导出" })).toBeTruthy();
  fireEvent.click(menu.getByRole("menuitem", { name: "移动到…" }));
  const dialog = within(await screen.findByRole("dialog", { name: "移动到…" }));
  for (const name of ["课程资料", "章节", "子章节"]) expect(dialog.getByRole<HTMLInputElement>("radio", { name, exact: true }).disabled).toBe(true);
  expect(dialog.getByRole<HTMLInputElement>("radio", { name: "资料库（根目录）" }).checked).toBe(true);
  fireEvent.click(dialog.getByRole("radio", { name: "其它资料" }));
  fireEvent.click(dialog.getByRole("button", { name: "移动", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(move).toHaveBeenCalledWith({ targets: [{ entity: "folder", id: "course" }], target_folder_id: "other" });

  fireEvent.click(screen.getByRole("button", { name: "网格", exact: true }));
  const card = screen.getByRole("button", { name: "地理题库", exact: true }).closest("[data-slot=card]")!;
  fireEvent.keyDown(within(card as HTMLElement).getByRole("button", { name: "更多操作" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("menuitem", { name: /编辑属性/ }));
  expect(await screen.findByRole("dialog", { name: "编辑属性" })).toBeTruthy();
});

it("scopes keyboard shortcuts to the library and keeps the cut clipboard across folders until a successful paste", async () => {
  const { move, copy, remove } = renderLibrary();
  const bank = await screen.findByRole("button", { name: "地理题库", exact: true });
  const search = screen.getByRole("searchbox");
  fireEvent.keyDown(search, { key: "a", ctrlKey: true });
  expect(screen.queryByRole("region", { name: "批量操作" })).toBeNull();

  bank.focus();
  shortcut("F2");
  const editor = within(await screen.findByRole("dialog", { name: "编辑属性" }));
  fireEvent.keyDown(editor.getByRole("button", { name: "取消" }), { key: "a", ctrlKey: true });
  fireEvent.click(editor.getByRole("button", { name: "取消" }));
  expect(screen.queryByRole("region", { name: "批量操作" })).toBeNull();

  bank.focus();
  shortcut("c", { metaKey: true });
  shortcut("v", { ctrlKey: true });
  await waitFor(() => expect(copy).toHaveBeenCalledWith({
    targets: [{ entity: "bank", id: "bank" }], target_folder_id: null,
  }));
  (await screen.findByRole("button", { name: "地理题库", exact: true })).focus();
  shortcut("x", { ctrlKey: true });
  expect(row("地理题库").dataset.cut).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "课程资料", exact: true }));
  await screen.findByRole("button", { name: "课程题库", exact: true });
  shortcut("v", { metaKey: true });
  await waitFor(() => expect(move).toHaveBeenCalledWith({
    targets: [{ entity: "bank", id: "bank" }], target_folder_id: "course",
  }));
  (await screen.findByRole("button", { name: "课程题库", exact: true })).focus();
  shortcut("v", { metaKey: true });
  expect(move).toHaveBeenCalledTimes(1);
  shortcut("Delete");
  const confirmation = within(await screen.findByRole("dialog", { name: /确认删除「课程题库」/ }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(confirmation.getByRole("button", { name: "确认" }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith("local"));
  await screen.findByRole("button", { name: "课程题库", exact: true });
  shortcut("Backspace");
  await screen.findByRole("button", { name: "地理题库", exact: true });
  shortcut("a", { ctrlKey: true });
  expect(screen.getByText("已选 3 项")).toBeTruthy();
});

it("moves internal drags to valid folders or ancestor breadcrumbs and leaves external import idle", async () => {
  const { move } = renderLibrary();
  await screen.findByRole("button", { name: "地理题库", exact: true });
  fireEvent.click(screen.getByRole("checkbox", { name: "选择 课程资料" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "选择 地理题库" }));
  const dataTransfer = dragData();
  fireEvent.dragStart(row("课程资料"), { dataTransfer });
  const payload = dataTransfer.getData("application/x-quarry-entries");
  expect(JSON.parse(payload!)).toEqual([{ entity: "folder", id: "course" }, { entity: "bank", id: "bank" }]);
  fireEvent.dragEnter(row("其它资料"), { dataTransfer });
  expect(screen.queryByText(/松开即可导入/)).toBeNull();
  expect(fireEvent.dragOver(row("课程资料"), { dataTransfer })).toBe(true);
  fireEvent.drop(row("课程资料"), { dataTransfer });
  expect(move).not.toHaveBeenCalled();
  expect(fireEvent.dragOver(row("其它资料"), { dataTransfer })).toBe(false);
  expect(row("其它资料").classList.contains("ring-primary")).toBe(true);
  fireEvent.drop(row("其它资料"), { dataTransfer });
  await waitFor(() => expect(move).toHaveBeenCalledWith({ targets: JSON.parse(payload!), target_folder_id: "other" }));

  fireEvent.click(await screen.findByRole("button", { name: "课程资料", exact: true }));
  await screen.findByRole("button", { name: "课程题库", exact: true });
  fireEvent.click(screen.getByRole("button", { name: "网格", exact: true }));
  const card = screen.getByRole("button", { name: "课程题库", exact: true }).closest("[data-slot=card]")!;
  const root = screen.getByRole("navigation", { name: "当前位置" }).querySelector("button")!;
  const gridTransfer = dragData();
  fireEvent.dragStart(card, { dataTransfer: gridTransfer });
  expect(fireEvent.dragOver(root, { dataTransfer: gridTransfer })).toBe(false);
  fireEvent.drop(root, { dataTransfer: gridTransfer });
  await waitFor(() => expect(move).toHaveBeenLastCalledWith({
    targets: [{ entity: "bank", id: "local" }], target_folder_id: null,
  }));
});

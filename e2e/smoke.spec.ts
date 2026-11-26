import { version } from '../package.json';
import { api, assertPageHealthy, expect, test } from './fixtures/electron';

test('boots with a live backend, unified frameless chrome, workspace tabs and packaged renderer assets', async ({ quarry }) => {
  const { page } = quarry;
  await expect(page.getByRole('heading', { name: '学习概览' })).toBeVisible();
  const health = await api(page, 'health');
  expect(health).toMatchObject({ status: 'ok', version, database: 'connected' });
  await assertPageHealthy(page);

  const chrome = await quarry.windowChrome();
  expect(chrome.hasAppMenu).toBe(false);
  expect(chrome.menuBarVisible).toBe(false);
  expect(chrome.titlebarHeight).toBe(42);
  if (process.platform === 'win32') {
    expect(chrome.overlayVisible).toBe(true);
  }

  await page.getByRole('button', { name: '收起导航' }).click();
  const sidebar = page.locator('aside[aria-label="主导航"]');
  await expect(sidebar).toHaveCSS('width', '58px');
  const homeNav = sidebar.getByRole('button', { name: '首页' });
  await expect(homeNav).toHaveCSS('width', '31.5px');
  await expect(homeNav).toHaveCSS('height', '31.5px');
  await sidebar.getByRole('button', { name: '快速命令' }).click();
  await expect(page.getByRole('dialog', { name: '快速命令' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '展开导航' }).click();
  await expect(sidebar).toHaveCSS('width', '224px');

  const titlebar = page.locator('.quarry-titlebar');
  await expect(titlebar).toHaveCSS('-webkit-app-region', 'drag');
  await expect(titlebar.locator('.quarry-titlebar-content')).not.toHaveCSS('-webkit-app-region', 'no-drag');
  await expect(titlebar.getByRole('button', { name: '新建标签页' })).toHaveCSS('-webkit-app-region', 'no-drag');
  await expect.poll(async () => {
    const [tabs, heading] = await Promise.all([
      page.getByRole('tablist', { name: '工作标签页' }).boundingBox(),
      page.getByRole('heading', { name: '学习概览' }).boundingBox(),
    ]);
    return Math.abs(tabs!.x - heading!.x);
  }).toBeLessThan(1);

  await sidebar.getByRole('button', { name: '资料库' }).click();
  await expect(page.getByRole('heading', { name: '资料库' })).toBeVisible();
  await page.getByRole('button', { name: '新建标签页' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: '首页' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '资料库' }).click();
  await expect(page.getByRole('heading', { name: '资料库' })).toBeVisible();
  await page.getByRole('button', { name: '关闭 资料库' }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);

  await sidebar.getByRole('button', { name: '系统设置' }).click();
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible();
  const logo = page.getByRole('img', { name: '题匣标志' });
  await expect(logo).toBeVisible();
  await assertPageHealthy(page);
});

test('adapts the sidebar and library inspector to the viewport width', async ({ quarry }) => {
  const { page } = quarry;
  await api(page, 'banks', { name: '响应式题库' });
  const sidebar = page.getByRole('complementary', { name: '主导航' });
  await sidebar.getByRole('button', { name: '资料库' }).click();
  await expect(page.getByRole('searchbox', { name: '搜索文件夹、题库与套题' })).toHaveAttribute('placeholder', '搜索');

  const inspector = page.locator('aside[aria-label="文件概览"]');
  await page.setViewportSize({ width: 1339, height: 760 });
  await expect(inspector).toHaveCSS('display', 'none');
  await page.setViewportSize({ width: 1340, height: 760 });
  await expect(inspector).toBeVisible();
  await expect(inspector).toHaveCSS('position', 'sticky');

  await page.setViewportSize({ width: 960, height: 760 });
  await expect(sidebar).toHaveCSS('width', '58px');
  await expect(sidebar.getByRole('button', { name: '资料库' })).toHaveCSS('width', '31.5px');
  await page.getByRole('button', { name: '展开导航' }).click();
  await expect(sidebar).toHaveCSS('width', '224px');
  await page.getByRole('button', { name: '收起导航' }).click();
  await expect(sidebar).toHaveCSS('width', '58px');
  await assertPageHealthy(page);
});

test('restores dark mode before the app mounts and syncs the Windows caption colors', async ({ quarry }) => {
  const { page } = quarry;
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme-mode', 'light');
  const readOverlay = process.platform === 'win32' ? await quarry.observeTitleBarOverlay() : undefined;
  await page.getByRole('button', { name: '外观模式：日间，切换至夜间' }).click();
  await expect(root).toHaveAttribute('data-theme-mode', 'dark');
  await expect(root).toHaveCSS('color-scheme', 'dark');
  if (readOverlay) {
    await expect.poll(readOverlay).toEqual({ color: '#151c18', symbolColor: '#e8f1ea', height: 42 });
  }

  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const mode = document.documentElement?.dataset.themeMode;
      if (!mode) return;
      Reflect.set(window, '__quarryFirstTheme', { mode, appRootExists: !!document.getElementById('root') });
      observer.disconnect();
    });
    observer.observe(document, { attributes: true, attributeFilter: ['data-theme-mode'], subtree: true });
  });
  await page.reload();
  await expect(root).toHaveAttribute('data-theme-mode', 'dark');
  expect(await page.evaluate(() => Reflect.get(window, '__quarryFirstTheme'))).toEqual({
    mode: 'dark', appRootExists: false,
  });
  await expect(page.getByRole('heading', { name: '学习概览' })).toBeVisible();

  const sidebar = page.getByRole('complementary', { name: '主导航' });
  await sidebar.getByRole('button', { name: '系统设置' }).click();
  const darkCard = 'rgb(32, 44, 37)';
  for (const name of ['外观与主题', '标签管理', '应用更新', '显示与操作', '题目转换 CLI 与 AI Skill']) {
    const card = page.locator('[data-slot="card"]').filter({
      has: page.getByRole('heading', { name, exact: true }),
    });
    await expect(card).toHaveCSS('background-color', darkCard);
  }

  const bank = '夜间题库';
  await api(page, 'banks', { name: bank });
  await api(page, 'tags', { name: '文件分类', target_type: 'file' });
  await api(page, 'tags', { name: '题目分类', target_type: 'question' });
  await sidebar.getByRole('button', { name: '资料库' }).click();
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '新建题库' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: '文件标签' }).fill('文件分类');
  const fileOptions = dialog.getByRole('listbox', { name: '文件标签建议' });
  await expect(fileOptions).toHaveCSS('background-color', darkCard);
  await fileOptions.getByRole('option', { name: '文件分类' }).click();
  await expect(dialog.getByRole('button', { name: '移除 文件分类' })).toBeVisible();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();

  await page.getByRole('button', { name: bank, exact: true }).click();
  await page.getByRole('button', { name: '新建题目' }).click();
  await dialog.getByRole('combobox', { name: '题目标签' }).fill('题目分类');
  const questionOptions = dialog.getByRole('listbox', { name: '题目标签建议' });
  await expect(questionOptions).toHaveCSS('background-color', darkCard);
  await questionOptions.getByRole('option', { name: '题目分类' }).click();
  await expect(dialog.getByRole('button', { name: '移除 题目分类' })).toBeVisible();
  await assertPageHealthy(page);
});

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
  await page.getByRole('button', { name: '展开导航' }).click();
  await expect(sidebar).toHaveCSS('width', '224px');

  await sidebar.getByRole('button', { name: '题库与套题' }).click();
  await expect(page.getByRole('heading', { name: '题库与套题' })).toBeVisible();
  await page.getByRole('button', { name: '新建标签页' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: '首页' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '题库与套题' }).click();
  await expect(page.getByRole('heading', { name: '题库与套题' })).toBeVisible();
  await page.getByRole('button', { name: '关闭 题库与套题' }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);

  await sidebar.getByRole('button', { name: '系统设置' }).click();
  await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible();
  const logo = page.getByRole('img', { name: '题匣标志' });
  await expect(logo).toBeVisible();
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
    await expect.poll(readOverlay).toEqual({ color: '#1b2620', symbolColor: '#e8f1ea', height: 42 });
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
  await assertPageHealthy(page);
});

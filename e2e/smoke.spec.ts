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

import { version } from '../package.json';
import { api, assertPageHealthy, expect, test } from './fixtures/electron';

test('boots with a live backend, workspace tabs and packaged renderer assets', async ({ quarry }) => {
  const { page } = quarry;
  await expect(page.getByRole('heading', { name: '学习概览' })).toBeVisible();
  const health = await api(page, 'health');
  expect(health).toMatchObject({ status: 'ok', version, database: 'connected' });
  await assertPageHealthy(page);

  await page.getByRole('button', { name: '收起侧栏' }).click();
  const sidebar = page.locator('.production-sidebar');
  await expect(sidebar).toHaveCSS('width', '72px');
  await page.getByRole('button', { name: '展开侧栏' }).click();
  await expect(sidebar).toHaveCSS('width', '280px');

  await sidebar.getByRole('button', { name: '资料库' }).click();
  await expect(page.getByRole('heading', { name: '资料库' })).toBeVisible();
  await page.getByRole('button', { name: '新建标签页' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: '首页' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '资料库' }).click();
  await expect(page.getByRole('heading', { name: '资料库' })).toBeVisible();
  await page.getByRole('button', { name: '关闭资料库' }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);

  await sidebar.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  const logo = page.getByRole('img', { name: '题匣标志' });
  await expect(logo).toBeVisible();
  await assertPageHealthy(page);
});

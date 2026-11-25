import { version } from '../package.json';
import { api, assertPageHealthy, expect, test } from './fixtures/electron';

test('boots with a live backend, workspace tabs and packaged renderer assets', async ({ quarry }) => {
  const { page } = quarry;
  await expect(page.getByRole('heading', { name: '学习概览' })).toBeVisible();
  const health = await api(page, 'health');
  expect(health).toMatchObject({ status: 'ok', version, database: 'connected' });
  expect(await quarry.windowChrome()).toEqual({ hasMenu: false, menuVisible: false });
  await assertPageHealthy(page);

  await page.getByRole('button', { name: '收起侧栏' }).click();
  const sidebar = page.locator('.app-sidebar');
  await expect(sidebar).toHaveCSS('width', '72px');
  await page.getByRole('button', { name: '展开侧栏' }).click();
  await expect(sidebar).toHaveCSS('width', '280px');

  await sidebar.getByRole('button', { name: '资料库' }).click();
  await expect(page.getByRole('heading', { name: '所有资料' })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
  const typeFilter = page.getByRole('button', { name: '类型', exact: true });
  await typeFilter.click();
  const facet = page.getByRole('dialog', { name: '类型', exact: true });
  await facet.getByRole('checkbox', { name: '全选' }).uncheck();
  await expect(facet).toBeVisible();
  await expect(typeFilter).toHaveText('未选择');
  await page.keyboard.press('Escape');
  await expect(facet).toBeHidden();
  await expect(typeFilter).toBeFocused();
  await page.getByRole('button', { name: '新建标签页' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: '首页' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '资料库' }).click();
  await expect(page.getByRole('heading', { name: '所有资料' })).toBeVisible();
  await page.getByRole('button', { name: '关闭资料库' }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);

  await sidebar.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  const logo = page.getByRole('img', { name: '题匣标志' });
  await expect(logo).toBeVisible();
  await assertPageHealthy(page);
});

test('reserves Windows caption buttons while tabs remain interactive at both window sizes', async ({ quarry }) => {
  test.skip(process.platform !== 'win32', 'The integrated title bar is enabled on Windows.');
  const { page } = quarry;
  const addTab = page.getByRole('button', { name: '新建标签页' });
  const header = page.locator('.workspace-header');
  for (const [width, height] of [[1440, 900], [960, 760]] as const) {
    await quarry.resize(width, height);
    for (let tab = 0; tab < 8; tab++) await addTab.click();
    await expect.poll(() => page.evaluate(() => {
      const overlay = Reflect.get(navigator, 'windowControlsOverlay') as {
        visible: boolean;
        getTitlebarAreaRect(): DOMRect;
      } | undefined;
      const add = document.querySelector('.new-tab-button')!.getBoundingClientRect();
      const area = overlay?.getTitlebarAreaRect();
      return {
        size: [innerWidth, innerHeight],
        visible: overlay?.visible,
        captionHeight: area?.height,
        clear: Boolean(area && add.right <= area.right),
      };
    })).toEqual({ size: [width, height], visible: true, captionHeight: 44, clear: true });
    await expect(header).toHaveCSS('-webkit-app-region', 'drag');
    await expect(addTab).toHaveCSS('-webkit-app-region', 'no-drag');
    await expect(page.getByRole('tab', { name: '首页', selected: true })).toBeVisible();
    await page.getByRole('tab', { name: '首页', selected: false }).first().click();
    const close = page.getByRole('button', { name: '关闭首页', exact: true });
    for (let tab = 0; tab < 8; tab++) await close.first().click();
    await expect(page.getByRole('tab')).toHaveCount(1);
    await assertPageHealthy(page);
  }
});

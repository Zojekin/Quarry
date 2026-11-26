import type { Page } from '@playwright/test';
import { api, assertPageHealthy, expect, test } from './fixtures/electron';

test.use({ nativeViewport: true });

const nav = (page: Page, name: string) =>
  page.getByRole('complementary', { name: '主导航' }).getByRole('button', { name });
const zoomControl = (page: Page) => page.getByRole('combobox', { name: '界面缩放' });

test('zooms from shortcuts and Settings and restores the level on restart', async ({ quarry }) => {
  const { page } = quarry;
  await nav(page, '系统设置').click();
  const zoom = zoomControl(page);
  await expect(zoom).toHaveValue('100');
  await quarry.pressZoomShortcut('=');
  await expect(zoom).toHaveValue('110');
  await expect.poll(quarry.zoomFactor).toBeCloseTo(1.1);
  await quarry.pressZoomShortcut('-');
  await expect(zoom).toHaveValue('100');
  await quarry.pressZoomShortcut('-');
  await expect(zoom).toHaveValue('90');
  await quarry.pressZoomShortcut('0');
  await expect(zoom).toHaveValue('100');

  await zoom.selectOption('85');
  await expect(zoom).toHaveValue('85');
  await expect.poll(quarry.zoomFactor).toBeCloseTo(0.85);
  await zoom.selectOption('125');
  await expect.poll(quarry.zoomFactor).toBeCloseTo(1.25);
  const restarted = await quarry.restart();
  await expect.poll(quarry.zoomFactor).toBeCloseTo(1.25);
  await nav(restarted, '系统设置').click();
  await expect(zoomControl(restarted)).toHaveValue('125');
  await quarry.pressZoomShortcut('0');
  await expect(zoomControl(restarted)).toHaveValue('100');
});

for (const { width, height, level } of [
  { width: 960, height: 540, level: 150 },
  { width: 1280, height: 720, level: 125 },
  { width: 900, height: 500, level: 85 },
]) {
  test(`keeps the workspace usable at ${width}×${height} and ${level}%`, async ({ quarry }) => {
    const { page } = quarry;
    const bank = await api<{ id: string }>(page, 'banks', { name: '缩放验收题库' });
    const paper = await api<{ id: string }>(page, 'papers', { name: '缩放验收套题' });
    for (let index = 1; index <= 8; index++) {
      const question = await api<{ id: string }>(page, 'questions', {
        owner_id: bank.id, owner_type: 'question_bank', type: 'subjective',
        content: `请解答第 ${index} 道题。`, reference_answer: '参考答案',
      });
      await api(page, `papers/${paper.id}/items`, { source_question_id: question.id });
    }

    await quarry.resizeWindow(width, height);
    await nav(page, '系统设置').click();
    await zoomControl(page).selectOption(String(level));
    await expect.poll(async () => {
      const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
      return Math.max(
        Math.abs(viewport.width - width * 100 / level),
        Math.abs(viewport.height - height * 100 / level),
      );
    }).toBeLessThanOrEqual(1);
    await assertPageHealthy(page);
    if (process.platform === 'win32') {
      await expect.poll(() => page.evaluate(() => {
        const { windowControlsOverlay: overlay } = navigator as Navigator & {
          windowControlsOverlay: { visible: boolean; getTitlebarAreaRect(): DOMRect };
        };
        const area = overlay.getTitlebarAreaRect();
        const bar = document.querySelector('.quarry-titlebar')!;
        const tabs = bar.querySelector('[role="tablist"]')!;
        const controlsFit = [...bar.children].every(child => {
          const bounds = child.getBoundingClientRect();
          return bounds.left >= area.left - 1 && bounds.right <= area.right + 1 &&
            bounds.top >= area.top - 1 && bounds.bottom <= area.bottom + 1;
        });
        return overlay.visible && Math.abs(bar.getBoundingClientRect().bottom - area.bottom) <= 1 &&
          tabs.getBoundingClientRect().width > 40 && controlsFit;
      })).toBe(true);
    }

    for (let index = 0; index < 7; index++) {
      await page.getByRole('button', { name: '新建标签页' }).click();
    }
    const selectedTab = page.getByRole('tab', { selected: true });
    await expect(selectedTab).toBeInViewport({ ratio: 0.99 });
    const heatmap = page.getByRole('grid', { name: '年度学习热力图' });
    await expect(heatmap).toBeVisible();
    await expect.poll(() => heatmap.locator('i').first().evaluate(cell => cell.getBoundingClientRect().width)).toBeGreaterThanOrEqual(6);
    if (width === 960) {
      const track = heatmap.locator('../..');
      await expect.poll(() => track.evaluate(node => node.scrollWidth - node.clientWidth)).toBeGreaterThan(0);
      expect(await track.evaluate(node => { node.scrollLeft = node.scrollWidth; return node.scrollLeft; })).toBeGreaterThan(0);
    }
    await assertPageHealthy(page);

    await page.keyboard.press('Control+k');
    const command = page.getByRole('dialog', { name: '快速命令' });
    await command.getByPlaceholder('搜索视图、题库或套题…').fill('题库与套题');
    await command.getByRole('option', { name: '题库与套题' }).click();
    const table = page.getByRole('table', { name: '文件列表' });
    await expect(table).toBeVisible();
    await assertPageHealthy(page);
    await table.getByRole('button', { name: '缩放验收套题' }).click();

    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '预览试卷' }).click();
    const preview = page.getByRole('dialog', { name: '预览 · 缩放验收套题' });
    const previewTitle = preview.getByRole('heading', { name: '预览 · 缩放验收套题' });
    await expect(previewTitle).toBeInViewport();
    const action = preview.getByRole('button', { name: '显示答案解析' });
    await expect(action).toBeInViewport({ ratio: 1 });
    const body = preview.locator('[data-slot="modal-body"]');
    await body.evaluate(node => node.scrollTop = node.scrollHeight);
    await expect(body.getByText('请解答第 8 道题。')).toBeInViewport();
    await expect(previewTitle).toBeInViewport();
    await expect(action).toBeInViewport({ ratio: 1 });
    await assertPageHealthy(page);
    await action.click();
    await preview.getByRole('button', { name: '关闭', exact: true }).last().click();

    await page.getByRole('button', { name: '开始练习' }).click();
    const rail = page.getByRole('complementary', { name: '主导航' });
    await expect(rail.getByRole('button', { name: '第 1 题' })).toBeVisible();
    const railWidth = width * 100 / level < 960 ? 156 : 224;
    await expect.poll(() => rail.evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(railWidth, 0);
    await rail.getByRole('button', { name: '暂停', exact: true }).click();
    await page.getByRole('button', { name: '继续答题' }).click();
    await assertPageHealthy(page);
  });
}

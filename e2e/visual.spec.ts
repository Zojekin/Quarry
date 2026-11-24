import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { api, assertPageHealthy, expect, test } from './fixtures/electron';

const bankName = '地质学基础';
const paperName = '火山与岩石';
const stem = '下列哪种岩石由岩浆冷却形成？';
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: true });
const nav = (page: Page, name: string) => page.locator('.app-sidebar').getByRole('button', { name, exact: true });
const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

async function seed(page: Page) {
  const fileTag = await api<{ id: string }>(page, 'tags', { name: '地球科学', target_type: 'file', color: '#386450' });
  const questionTag = await api<{ id: string }>(page, 'tags', { name: '岩石分类', target_type: 'question', color: '#946037' });
  const bank = await api<{ id: string }>(page, 'banks', {
    name: bankName, description: '岩石、火山活动与地表变迁。', tag_ids: [fileTag.id],
  });
  const choice = await api<{ id: string }>(page, 'questions', {
    id: id(1), owner_id: bank.id, owner_type: 'question_bank', type: 'single_choice', content: stem,
    explanation: '玄武岩是岩浆喷出后迅速冷却形成的岩浆岩。', tag_ids: [questionTag.id],
    options: [
      { id: id(2), content: '玄武岩', is_correct: true },
      { id: id(3), content: '石灰岩', is_correct: false },
      { id: id(4), content: '大理石', is_correct: false },
      { id: id(5), content: '砂岩', is_correct: false },
    ],
  });
  const subjective = await api<{ id: string }>(page, 'questions', {
    id: id(6), owner_id: bank.id, owner_type: 'question_bank', type: 'subjective',
    content: '请简述板块运动与火山活动的关系。', reference_answer: '板块边界是岩浆活动的主要区域。',
  });
  await api(page, 'folders', { name: '地球科学笔记', tag_ids: [fileTag.id] });
  const removed = await api<{ id: string }>(page, 'folders', { name: '旧版课程笔记' });
  await api(page, 'folders/' + removed.id, undefined, 'DELETE');
  const paper = await api<{ id: string }>(page, 'papers', {
    name: paperName, description: '巩固岩石分类与板块运动知识。', tag_ids: [fileTag.id],
    time_limit_seconds: 3600,
  });
  for (const source_question_id of [choice.id, subjective.id]) {
    await api(page, 'papers/' + paper.id + '/items', { source_question_id });
  }
  const start = (mode: 'practice' | 'exam') =>
    api<{ id: string; start_time: string; items: { question: { id: string; type: string } }[] }>(page, 'sessions', {
      mode, paper_id: paper.id, seed: 124, time_zone: 'UTC',
    });
  const history = await start('practice');
  await api(page, 'sessions/' + history.id + '/submit-question', {
    question_id: history.items.find(item => item.question.type === 'single_choice')!.question.id,
    answer: { kind: 'choice', option_ids: [id(3)] }, attempt_index: 1,
  });
  await api(page, 'sessions/' + history.id + '/complete', {});
  return { '练习': await start('practice'), '考试': await start('exam') };
}

const layouts = [
  { name: 'expanded', width: 1440, height: 900, compact: false },
  { name: 'compact', width: 1440, height: 900, compact: true },
  { name: 'narrow', width: 960, height: 760, compact: false },
];

for (const layout of layouts) {
  test('visual pages in ' + layout.name + ' layout', async ({ quarry }) => {
    const { page } = quarry;
    const sessions = await seed(page);
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.clock.setFixedTime(new Date('2024-12-31T12:00:00Z'));
    await page.reload();
    if (layout.compact) await button(page, '收起侧栏').click();
    const capture = async (view: string, mask: ReturnType<Page['locator']>[] = []) => {
      await test.step(view, async () => {
        await expect(page.getByText('正在加载…', { exact: true })).toHaveCount(0);
        await page.waitForLoadState('networkidle');
        await assertPageHealthy(page);
        const name = view + '-' + layout.name + '.png';
        const options = { animations: 'disabled' as const, caret: 'hide' as const };
        if (process.env.QUARRY_CAPTURE_REVIEW === '1') {
          const directory = resolve('e2e/review-screenshots');
          await mkdir(directory, { recursive: true });
          await page.screenshot({ ...options, path: resolve(directory, name) });
        } else {
          await expect(page).toHaveScreenshot(name, { ...options, mask, maskColor: '#deded8' });
        }
      });
    };

    await page.getByLabel('年份').selectOption('2024');
    await expect(page.locator('.heat-grid > i')).toHaveCount(53 * 7);
    await capture('home', [
      page.locator('.metric-row .big-number').first(),
      page.locator('.paper-card .card-bottom > span'),
    ]);
    await nav(page, '资料库').click();
    await button(page, bankName).waitFor();
    const tag = page.locator('.tag-chip.tag-color').first();
    await expect(tag).toHaveCSS('background-color', 'rgb(56, 100, 80)');
    await expect(tag).toHaveCSS('color', 'rgb(255, 255, 255)');
    await capture('library-list', [page.locator('.library-content tbody td:nth-child(5)')]);
    await button(page, '图标视图').click();
    await expect(page.locator('.document-grid')).toBeVisible();
    await capture('library-grid');
    await button(page, bankName).click();
    await expect(page.getByText(stem, { exact: true })).toBeVisible();
    await capture('bank-detail');
    await nav(page, '资料库').click();
    await button(page, paperName).click();
    await expect(page.getByRole('heading', { name: paperName })).toBeVisible();
    await capture('paper-detail', [page.locator('.paper-property-list div').filter({ has: page.getByText('最后修改') }).locator('dd')]);
    await nav(page, '错题本').click();
    const mistake = page.locator('.mistake-row');
    await expect(mistake.getByText(stem, { exact: true })).toBeVisible();
    await capture('mistakes', [mistake.locator('time'), page.locator('.history-item > :first-child')]);
    await nav(page, '设置').click();
    await page.getByLabel('标签类型').selectOption('question');
    await expect(page.getByLabel('岩石分类颜色')).toBeVisible();
    await capture('settings');
    await nav(page, '回收站').click();
    await expect(page.getByText('旧版课程笔记')).toBeVisible();
    await capture('trash');
    await nav(page, '学习记录').click();
    await expect(page.getByRole('button', { name: '继续作答', exact: true })).toHaveCount(2);
    await capture('records', [page.locator('tbody td:nth-child(5), tbody td:nth-child(6)')]);
    for (const [mode, view] of [['练习', 'study-practice'], ['考试', 'study-exam']] as const) {
      await page.clock.setFixedTime(new Date(sessions[mode].start_time));
      const session = page.getByRole('row').filter({ hasText: mode }).filter({ hasText: '进行中' });
      await session.getByRole('button', { name: '继续作答' }).click();
      await expect(page.locator('.question-stem').getByText(stem, { exact: true })).toBeVisible();
      await capture(view, [page.locator('.clock')]);
      if (layout.compact) await button(page, '展开侧栏').click();
      await button(page, '退出答题').click();
      if (layout.compact) await button(page, '收起侧栏').click();
    }
  });
}

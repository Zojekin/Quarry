import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { api, assertPageHealthy, expect, test } from './fixtures/electron';

const bankName = '地质学基础';
const paperName = '火山与岩石';
const stem = '下列哪种岩石由岩浆冷却形成？';
const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: true });
const nav = (page: Page, name: string) =>
  page.locator('aside[aria-label="主导航"]').getByRole('button', { name, exact: true });
const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

async function seed(page: Page) {
  const fileTag = await api<{ id: string }>(page, 'tags', { name: '地球科学', target_type: 'file' });
  const questionTag = await api<{ id: string }>(page, 'tags', { name: '岩石分类', target_type: 'question' });
  const bank = await api<{ id: string }>(page, 'banks', {
    name: bankName,
    description: '岩石、火山活动与地表变迁。',
    tag_ids: [fileTag.id],
  });
  const choice = await api<{ id: string }>(page, 'questions', {
    id: id(1),
    owner_id: bank.id,
    owner_type: 'question_bank',
    type: 'single_choice',
    content: stem,
    explanation: '玄武岩是岩浆喷出后迅速冷却形成的岩浆岩。',
    tag_ids: [questionTag.id],
    options: [
      { id: id(2), content: '玄武岩', is_correct: true },
      { id: id(3), content: '石灰岩', is_correct: false },
      { id: id(4), content: '大理石', is_correct: false },
      { id: id(5), content: '砂岩', is_correct: false },
    ],
  });
  const subjective = await api<{ id: string }>(page, 'questions', {
    id: id(6),
    owner_id: bank.id,
    owner_type: 'question_bank',
    type: 'subjective',
    content: '请简述板块运动与火山活动的关系。',
    reference_answer: '板块边界是岩浆活动的主要区域。',
  });
  await api(page, 'folders', { name: '地球科学笔记', tag_ids: [fileTag.id] });
  const removed = await api<{ id: string }>(page, 'folders', { name: '旧版课程笔记' });
  await api(page, 'folders/' + removed.id, undefined, 'DELETE');
  const paper = await api<{ id: string }>(page, 'papers', {
    name: paperName,
    description: '巩固岩石分类与板块运动知识。',
    tag_ids: [fileTag.id],
    time_limit_seconds: 3600,
  });
  for (const source_question_id of [choice.id, subjective.id]) {
    await api(page, 'papers/' + paper.id + '/items', { source_question_id });
  }
  const start = (mode: 'practice' | 'exam') =>
    api<{ id: string; start_time: string; items: { question: { id: string; type: string } }[] }>(
      page,
      'sessions',
      { mode, paper_id: paper.id, seed: 124, time_zone: 'UTC' },
    );
  const history = await start('practice');
  await api(page, 'sessions/' + history.id + '/submit-question', {
    question_id: history.items.find((item) => item.question.type === 'single_choice')!.question.id,
    answer: { kind: 'choice', option_ids: [id(3)] },
    attempt_index: 1,
  });
  await api(page, 'sessions/' + history.id + '/complete', {});
  await expect.poll(Date.now).toBeGreaterThan(Date.parse(history.start_time));
  const practice = await start('practice');
  await expect.poll(Date.now).toBeGreaterThan(Date.parse(practice.start_time));
  const exam = await start('exam');
  return { '练习': practice, '考试': exam, '历史': history };
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
    if (layout.compact) await button(page, '收起导航').click();
    const capture = async (view: string) => {
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
        } else if (process.platform === 'win32') {
          await expect(page).toHaveScreenshot(name, {
            ...options,
            mask: [page.locator('[data-dynamic-date]:visible')],
            maskColor: '#deded8',
            stylePath: resolve('e2e/visual-screenshot.css'),
          });
        }
      });
    };

    const year = page.getByRole('combobox', { name: '年份' });
    const yearOption = page.getByRole('option', { name: '2024 年', exact: true });
    await year.press('Enter');
    await yearOption.press('Enter');
    await expect(yearOption).toBeHidden();
    await expect(year).toHaveText('2024 年');
    await year.blur();
    await expect(page.locator('.quarry-heat-grid > i')).toHaveCount(53 * 7);
    await capture('home');

    await nav(page, '资料库').click();
    await button(page, bankName).waitFor();
    const tag = page.locator('.tag-color').first();
    await expect(tag).toHaveCSS('background-color', 'rgb(228, 234, 222)');
    await expect(tag).toHaveCSS('color', 'rgb(37, 49, 40)');
    await capture('library-list');

    await button(page, '网格').click();
    await capture('library-grid');

    await button(page, bankName).click();
    await expect(page.getByText(stem, { exact: true })).toBeVisible();
    await capture('bank-detail');

    await nav(page, '资料库').click();
    await button(page, paperName).click();
    await expect(page.getByRole('heading', { name: paperName })).toBeVisible();
    await capture('paper-detail');

    await nav(page, '错题本').click();
    const mistake = page.locator('.mistake-row');
    await expect(mistake.getByText(stem, { exact: true })).toBeVisible();
    const filterLabels = page.locator('.mistake-filter-row [data-select-value]');
    await expect(filterLabels).toHaveText(['来源套题', '文件夹', '题目标签', '题型']);
    expect(
      await filterLabels.evaluateAll((labels) =>
        labels
          .filter((label) => label.scrollWidth > label.clientWidth)
          .map((label) => label.textContent),
      ),
      'truncated mistake filter labels',
    ).toEqual([]);
    await capture('mistakes');

    await nav(page, '系统设置').click();
    await page.getByRole('tab', { name: '题目标签' }).click();
    await expect(page.getByRole('heading', { name: '外观与主题' })).toBeInViewport();
    await expect(page.getByLabel('岩石分类颜色')).toBeInViewport();
    await expect(page.getByRole('heading', { name: '应用更新', exact: true })).toBeInViewport();
    if (process.env.QUARRY_E2E_PACKAGED !== '1') {
      await expect(page.getByText('自动更新适用于 Windows 正式发布的桌面版。')).toBeVisible();
    }
    const zoom = page.getByRole('combobox', { name: '界面缩放' });
    await expect(zoom).toHaveText('100%');
    await zoom.evaluate(select => {
      const bottom = select.getBoundingClientRect().bottom;
      window.scrollBy(0, Math.max(0, bottom + 24 - window.innerHeight));
    });
    await expect(zoom).toBeInViewport({ ratio: 1 });
    await capture('settings');

    await nav(page, '回收站').click();
    await expect(page.getByText('旧版课程笔记')).toBeVisible();
    await capture('trash');

    await nav(page, '练习记录').click();
    await expect(page.getByRole('button', { name: '继续作答', exact: true })).toHaveCount(2);
    await capture('records');

    const completedRow = page.getByRole('row').filter({ hasText: '已完成' });
    await completedRow.getByRole('button', { name: '查看报告' }).click();
    await expect(page.locator('.result-hero')).toBeVisible();
    await capture('result');
    await button(page, '返回练习记录').click();

    for (const [mode, view] of [['练习', 'study-practice'], ['考试', 'study-exam']] as const) {
      await page.clock.setFixedTime(new Date(sessions[mode].start_time));
      const sessionRow = page.getByRole('row').filter({ hasText: mode }).filter({ hasText: '进行中' });
      await sessionRow.getByRole('button', { name: '继续作答' }).click();
      await expect(page.locator('.question-stem').getByText(stem, { exact: true })).toBeVisible();
      await capture(view);
      if (layout.compact) await button(page, '展开导航').click();
      await button(page, '退出答题').click();
      if (layout.compact) await button(page, '收起导航').click();
    }
  });
}

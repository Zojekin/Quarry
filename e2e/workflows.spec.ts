import type { Page } from '@playwright/test';
import { api, assertPageHealthy, expect, test } from './fixtures/electron';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=',
  'base64',
);
const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: true });
const sidebar = (page: Page, name: string) =>
  page.locator('aside[aria-label="主导航"]').getByRole('button', { name, exact: true });
const row = (page: Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) });

async function saveDocument(page: Page, name: string, tag?: string) {
  const dialog = page.getByRole('dialog', {
    name: /新建(?:文件夹|题库|套题)|编辑属性/,
  });
  await dialog.getByLabel('名称').fill(name);
  if (tag) {
    const tags = dialog.getByRole('combobox', { name: '文件标签' });
    await tags.fill(tag);
    await tags.press('Enter');
  }
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function confirmAction(page: Page, name: string | RegExp) {
  const dialog = page.getByRole('dialog', { name });
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function openCreateMenu(page: Page, item: string) {
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

async function archiveImport(page: Page, path: string, summary: RegExp) {
  await page.locator('input[accept=".quarry,.json,.md"]').setInputFiles(path);
  const dialog = page.getByRole('dialog', { name: '导入预览' });
  await expect(dialog.getByText(summary)).toBeVisible();
  await dialog.getByRole('button', { name: '确认导入为新文件' }).click();
  await expect(dialog).toBeHidden();
}

test('creates, studies, archives and recovers a real library', async ({ quarry }, testInfo) => {
  test.setTimeout(120_000);
  let { page } = quarry;
  const folder = '地理资料';
  const bank = '火山题库';
  const paper = '火山测验';
  const question = '哪一种是火山岩？';

  await test.step('create and rename folder, bank and paper with tags', async () => {
    await sidebar(page, '资料库').click();
    await openCreateMenu(page, '新建文件夹');
    await saveDocument(page, '资料草稿', '地理');
    await row(page, '资料草稿').getByRole('button', { name: '重命名' }).click({ force: true });
    await saveDocument(page, folder);
    await button(page, folder).click();

    await openCreateMenu(page, '新建题库');
    await saveDocument(page, '题库草稿', '地理');
    await row(page, '题库草稿').getByRole('button', { name: '重命名' }).click({ force: true });
    await saveDocument(page, bank);

    await openCreateMenu(page, '新建套题');
    await saveDocument(page, '套题草稿', '地理');
    await row(page, '套题草稿').getByRole('button', { name: '重命名' }).click({ force: true });
    await saveDocument(page, paper);
    await expect(row(page, paper).getByText('地理', { exact: true })).toBeVisible();
  });

  await test.step('upload an image, edit a question, and reopen it after Electron restarts', async () => {
    await button(page, bank).click();
    await button(page, '新建题目').click();
    const editor = page.getByRole('dialog', { name: /新增题目|编辑题目/ });
    await editor.getByLabel('题型').click();
    await page.getByRole('option', { name: '单选题' }).click();
    const stem = editor.getByLabel('题干');
    await stem.fill(question);
    await editor.getByLabel('选项 1', { exact: true }).fill('玄武岩');
    await editor.getByLabel('选项 2', { exact: true }).fill('石灰岩');
    await editor.getByRole('checkbox', { name: '正确选项 1' }).check();
    const tags = editor.getByRole('combobox', { name: '题目标签' });
    await tags.fill('岩石');
    await tags.press('Enter');
    await editor.locator('input[type=file]').setInputFiles({
      name: 'rock.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await expect(stem).toHaveValue(/attachment:\/\/[a-f0-9-]{36}/);
    await expect(editor.getByRole('img', { name: '图片' })).toBeVisible();
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await expect(editor).toBeHidden();

    await button(page, '编辑第 1 题').click({ force: true });
    await editor.getByLabel('解析').fill('玄武岩是火山喷发后形成的岩石。');
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await expect(editor).toBeHidden();

    const before = await page.getByRole('img', { name: '图片' }).getAttribute('src');
    page = await quarry.restart();
    await sidebar(page, '资料库').click();
    await button(page, folder).click();
    await button(page, bank).click();
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    const picture = page.getByRole('img', { name: '图片' });
    await expect(picture).toBeVisible();
    await expect
      .poll(() => picture.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    expect(await picture.getAttribute('src')).not.toBe(before);

    const [savedBank] = await api<{ id: string }[]>(page, 'banks');
    if (!savedBank) throw new Error('The saved bank was not restored');
    const [saved] = await api<{ content: string; explanation: string }[]>(
      page,
      'questions?bank_id=' + savedBank.id,
    );
    expect(saved).toMatchObject({
      content: expect.stringMatching(/attachment:\/\/[a-f0-9-]{36}/),
      explanation: expect.stringContaining('玄武岩是火山喷发后'),
    });
  });

  await test.step('pick a question, save composer settings, practice and sit an exam with pause focus restoration', async () => {
    await sidebar(page, '资料库').click();
    await button(page, folder).click();
    await button(page, paper).click();
    await button(page, '从题库选题').click();
    const picker = page.getByRole('dialog', { name: '从题库选题' });
    await picker.getByLabel('题库').click();
    await page.getByRole('option', { name: bank }).click();
    await picker.getByRole('checkbox', { name: '全选当前结果' }).click();
    await picker.getByRole('button', { name: '加入 1 道题目' }).click();
    await expect(picker).toBeHidden();

    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '编排组卷' }).click();
    const composer = page.getByRole('dialog', { name: '套题编排' });
    await composer.getByRole('switch', { name: '分区内打乱' }).click();
    await composer.getByRole('button', { name: '保存编排' }).click();
    await expect(composer).toBeHidden();

    await button(page, '开始练习').click();
    const draftResponse = page.waitForResponse(
      (response) => response.url().endsWith('/draft') && response.ok(),
    );
    await page.getByRole('radio', { name: /石灰岩/ }).click();
    await draftResponse;
    await expect(page.getByRole('radio', { name: /石灰岩/ })).toHaveClass(/chosen/);
    await button(page, '查看答案').click();
    await expect(page.getByRole('img', { name: '选错' })).toBeVisible();
    await button(page, '重新作答').click();
    await page.getByRole('radio', { name: /玄武岩/ }).click();
    await button(page, '查看答案').click();
    await expect(page.getByText('回答正确')).toBeVisible();
    await button(page, '结束练习').click();
    await confirmAction(page, /结束本次练习/);
    await expect(page.getByRole('heading', { name: paper })).toBeVisible();

    await sidebar(page, '资料库').click();
    await button(page, folder).click();
    await button(page, paper).click();
    await button(page, '开始考试').click();
    await page.getByRole('radio', { name: /玄武岩/ }).click();

    await button(page, '暂停').click();
    const pause = page.getByRole('dialog', { name: '答题已暂停' });
    await expect(page.getByRole('radio', { name: /玄武岩/ })).toHaveCount(0);
    await pause.getByRole('button', { name: '继续答题' }).click();
    await expect(pause).toBeHidden();
    await expect(button(page, '暂停')).toBeFocused();
    await expect(page.getByRole('radio', { name: /玄武岩/ })).toHaveClass(/chosen/);

    await button(page, '暂停').click();
    await expect(pause).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pause).toBeHidden();
    await expect(button(page, '暂停')).toBeFocused();

    await button(page, '交卷').click();
    await confirmAction(page, '确认交卷？');
    await expect(page.getByRole('heading', { name: paper })).toBeVisible();
  });

  await test.step('filter mistakes, change mastery, save a review paper and inspect records', async () => {
    await sidebar(page, '错题本').click();
    await page.getByRole('searchbox', { name: '搜索错题' }).fill('不存在的题目');
    await expect(page.locator('.mistake-row')).toHaveCount(0);
    await page.getByRole('searchbox', { name: '搜索错题' }).fill('火山岩');
    await button(page, '标记已掌握').click();
    await button(page, '已掌握').click();
    await button(page, '标记待复习').click();
    await button(page, '待复习').click();
    await page.locator('.mistake-row').getByRole('checkbox').check();
    await button(page, '生成错题复习套题').click();
    const naming = page.getByRole('dialog', { name: '保存复习套题' });
    await naming.getByLabel('复习套题名称').fill('岩石复习');
    await naming.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('heading', { name: '岩石复习' })).toBeVisible();
    await sidebar(page, '练习记录').click();
    await expect(page.getByText(paper, { exact: true })).toHaveCount(2);
    await sidebar(page, '首页').click();
    await expect(page.getByRole('heading', { name: '学习概览' })).toBeVisible();
    await expect(page.locator('.quarry-heat-grid :is(.lv1, .lv2, .lv3, .lv4)')).not.toHaveCount(0);
  });

  await test.step('round-trip bank and folder archives, then back up and restore', async () => {
    await sidebar(page, '资料库').click();
    await button(page, folder).click();
    const bankFile = testInfo.outputPath('bank.quarry');
    await quarry.download(bankFile, () =>
      row(page, bank).getByRole('button', { name: '导出' }).click({ force: true }),
    );
    await archiveImport(page, bankFile, /题库 · 1 道题目 · 1 个附件/);

    await sidebar(page, '资料库').click();
    const folderFile = testInfo.outputPath('folder.quarry');
    await quarry.download(folderFile, () =>
      row(page, folder).getByRole('button', { name: '导出' }).click({ force: true }),
    );
    await archiveImport(page, folderFile, /1 个文件夹 · 1 个题库 · 1 份套题 · 2 道题目 · 1 个附件/);
    await expect(row(page, folder)).toHaveCount(2);

    await sidebar(page, '系统设置').click();
    const backupFile = testInfo.outputPath('quarry.quarry-backup');
    await quarry.download(backupFile, () => button(page, '完整备份').click());
    await sidebar(page, '资料库').click();
    await openCreateMenu(page, '新建文件夹');
    await saveDocument(page, '备份之后');
    await expect(row(page, '备份之后')).toBeVisible();

    await sidebar(page, '系统设置').click();
    await page.locator('input[type=file]').setInputFiles(backupFile);
    await confirmAction(page, /完整恢复/);
    await expect(page.getByText('恢复完成，请刷新页面')).toBeVisible();
    await sidebar(page, '资料库').click();
    await expect(row(page, folder)).toHaveCount(2);
    await expect(row(page, '备份之后')).toHaveCount(0);
  });

  await test.step('trash and recover files, permanently purge and autosave a tag color', async () => {
    await row(page, bank).getByRole('button', { name: '删除' }).click({ force: true });
    await confirmAction(page, /确认删除/);
    await expect(row(page, bank)).toHaveCount(0);
    await sidebar(page, '回收站').click();
    await page.getByRole('row').filter({ hasText: bank }).getByRole('button', { name: '恢复' }).click();
    await expect(page.getByRole('row').filter({ hasText: bank })).toHaveCount(0);
    await sidebar(page, '资料库').click();
    await expect(row(page, bank)).toBeVisible();

    await row(page, '岩石复习').getByRole('button', { name: '删除' }).click({ force: true });
    await confirmAction(page, /确认删除/);
    await expect(row(page, '岩石复习')).toHaveCount(0);
    await row(page, folder).last().getByRole('button', { name: '删除' }).click({ force: true });
    await confirmAction(page, /确认删除/);
    await expect(row(page, folder)).toHaveCount(1);

    await sidebar(page, '回收站').click();
    await page.getByRole('row').filter({ hasText: '岩石复习' }).getByRole('button', { name: '永久删除' }).click();
    await confirmAction(page, /永久删除/);
    await expect(page.getByRole('row').filter({ hasText: '岩石复习' })).toHaveCount(0);

    await sidebar(page, '系统设置').click();
    await page.getByRole('tab', { name: '题目标签' }).click();
    await page.getByLabel('岩石颜色').fill('#336699');
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await sidebar(page, '首页').click();
    await sidebar(page, '系统设置').click();
    await page.getByRole('tab', { name: '题目标签' }).click();
    await expect(page.getByLabel('岩石颜色')).toHaveValue('#336699');
    await assertPageHealthy(page);
  });
});

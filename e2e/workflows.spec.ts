import type { Page } from '@playwright/test';
import { api, assertPageHealthy, expect, test } from './fixtures/electron';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=', 'base64');
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: true });
const sidebar = (page: Page, name: string) =>
  page.locator('.production-sidebar').getByRole('button', { name, exact: true });
const row = (page: Page, name: string) => page.locator('.document-row').filter({ hasText: name });

async function saveDocument(page: Page, name: string, tag?: string) {
  const dialog = page.getByRole('dialog', { name: '文件属性' });
  await dialog.getByLabel('名称').fill(name);
  if (tag) await dialog.getByLabel(/文件标签/).fill(tag);
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function confirmAction(page: Page, name: string | RegExp) {
  const dialog = page.getByRole('dialog', { name });
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function archiveImport(page: Page, path: string, summary: RegExp) {
  await page.locator('input[accept=".json,.md,.quarry"]').setInputFiles(path);
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
    await button(page, '新建文件夹').click();
    await saveDocument(page, '资料草稿', '地理');
    await row(page, '资料草稿').getByRole('button', { name: '编辑属性' }).click();
    await saveDocument(page, folder);
    await button(page, new RegExp(folder + '$')).click();
    await button(page, '新建题库').click();
    await saveDocument(page, '题库草稿', '地理');
    await row(page, '题库草稿').getByRole('button', { name: '编辑属性' }).click();
    await saveDocument(page, bank);
    await button(page, '新建套题').click();
    await saveDocument(page, '套题草稿', '地理');
    await row(page, '套题草稿').getByRole('button', { name: '编辑属性' }).click();
    await saveDocument(page, paper);
    await expect(row(page, paper).getByText('地理', { exact: true })).toBeVisible();
  });

  await test.step('upload an image, edit a question, and reopen it after Electron restarts', async () => {
    await button(page, new RegExp(bank + '$')).click();
    await button(page, /新建题目/).click();
    const editor = page.getByRole('dialog', { name: '编辑题目' });
    await editor.getByLabel('题型').selectOption('single_choice');
    const stem = editor.getByLabel('题干');
    await stem.fill(question);
    await editor.getByLabel('选项 1', { exact: true }).fill('玄武岩');
    await editor.getByLabel('选项 2', { exact: true }).fill('石灰岩');
    await editor.getByLabel('正确选项 1').check();
    await editor.getByLabel(/题目标签/).fill('岩石');
    await editor.locator('input[type=file]').setInputFiles({ name: 'rock.png', mimeType: 'image/png', buffer: png });
    await expect(stem).toHaveValue(/attachment:\/\/[a-f0-9-]{36}/);
    await expect(editor.getByRole('img', { name: '图片' })).toBeVisible();
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await expect(editor).toBeHidden();
    await button(page, '编辑').click();
    await editor.getByLabel('解析').fill('玄武岩是火山喷发后形成的岩石。');
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await expect(editor).toBeHidden();
    const before = await page.getByRole('img', { name: '图片' }).getAttribute('src');
    page = await quarry.restart();
    await sidebar(page, '资料库').click();
    await button(page, new RegExp(folder + '$')).click();
    await button(page, new RegExp(bank + '$')).click();
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    const picture = page.getByRole('img', { name: '图片' });
    await expect(picture).toBeVisible();
    await expect.poll(() => picture.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await picture.getAttribute('src')).not.toBe(before);
    const [savedBank] = await api<{ id: string }[]>(page, 'banks');
    if (!savedBank) throw new Error('The saved bank was not restored');
    const [saved] = await api<{ content: string; explanation: string }[]>(page, 'questions?bank_id=' + savedBank.id);
    expect(saved).toMatchObject({ content: expect.stringMatching(/attachment:\/\/[a-f0-9-]{36}/),
      explanation: expect.stringContaining('玄武岩是火山喷发后') });
  });

  await test.step('pick a question, save composer settings, practice and sit an exam', async () => {
    await sidebar(page, '资料库').click();
    await button(page, new RegExp(folder + '$')).click();
    await button(page, new RegExp(paper + '$')).click();
    await button(page, '从题库选题').click();
    const picker = page.getByRole('dialog', { name: '从题库选题' });
    await picker.getByLabel('题库', { exact: true }).selectOption({ label: bank });
    await picker.getByLabel('全选当前结果').check();
    await picker.getByRole('button', { name: '加入 1 道题目' }).click();
    await expect(picker).toBeHidden();
    await button(page, '编排与打乱').click();
    const composer = page.getByRole('dialog', { name: '套题编排' });
    await composer.getByLabel('分区内打乱').check();
    await composer.getByRole('button', { name: '保存编排' }).click();
    await expect(composer).toBeHidden();
    await button(page, '开始练习').click();
    const draftResponse = page.waitForResponse(response => response.url().endsWith('/draft') && response.ok());
    await button(page, /石灰岩/).click();
    await draftResponse;
    await expect(button(page, /石灰岩/)).toHaveClass(/chosen/);
    await button(page, '查看答案').click();
    await expect(page.getByRole('img', { name: '选错' })).toBeVisible();
    await button(page, '重新作答').click();
    await button(page, /玄武岩/).click();
    await button(page, '查看答案').click();
    await expect(button(page, /玄武岩/)).toHaveClass(/answer-correct/);
    await button(page, '结束练习').click();
    await confirmAction(page, /结束本次练习/);
    await expect(page.getByRole('heading', { name: '答题结果' })).toBeVisible();

    await sidebar(page, '资料库').click();
    await button(page, new RegExp(folder + '$')).click();
    await button(page, new RegExp(paper + '$')).click();
    await button(page, '开始考试').click();
    await button(page, /玄武岩/).click();
    await button(page, '暂停').click();
    const pause = page.getByRole('dialog', { name: '练习已暂停' });
    await pause.getByRole('button', { name: '继续答题' }).click();
    await expect(pause).toBeHidden();
    await expect(button(page, /玄武岩/)).toHaveClass(/chosen/);
    await button(page, '交卷').click();
    await confirmAction(page, '确认交卷？');
    await expect(page.getByRole('heading', { name: '答题结果' })).toBeVisible();
  });

  await test.step('filter mistakes, change mastery, save a review paper and inspect records', async () => {
    await sidebar(page, '错题本').click();
    await page.getByPlaceholder('搜索题干或来源').fill('不存在的题目');
    await expect(page.locator('.mistake-row')).toHaveCount(0);
    await page.getByPlaceholder('搜索题干或来源').fill('火山岩');
    await button(page, '斩').click();
    await button(page, '已掌握').click();
    await button(page, '复').click();
    await button(page, '待复习').click();
    await page.getByRole('checkbox', { name: '选择错题' }).check();
    await button(page, '保存复习套题').click();
    const naming = page.getByRole('dialog', { name: '保存复习套题' });
    await naming.getByLabel('复习套题名称').fill('岩石复习');
    await naming.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('heading', { name: '岩石复习' })).toBeVisible();
    await sidebar(page, '学习记录').click();
    await expect(page.getByText(paper, { exact: true })).toHaveCount(2);
    await sidebar(page, '首页').click();
    await expect(page.getByRole('heading', { name: '日积月累' })).toBeVisible();
    await expect(page.locator('.heat-cell:not(.level-0)')).not.toHaveCount(0);
  });

  await test.step('round-trip bank and folder archives, then back up and restore', async () => {
    await sidebar(page, '资料库').click();
    await button(page, new RegExp(folder + '$')).click();
    const bankFile = testInfo.outputPath('bank.quarry');
    await quarry.download(bankFile, () => row(page, bank).getByRole('button', { name: '导出' }).click());
    await archiveImport(page, bankFile, /题库 · 1 道题目 · 1 个附件/);

    await sidebar(page, '资料库').click();
    const folderFile = testInfo.outputPath('folder.quarry');
    await quarry.download(folderFile, () => row(page, folder).getByRole('button', { name: '导出' }).click());
    await archiveImport(page, folderFile, /1 个文件夹 · 1 个题库 · 1 份套题 · 2 道题目 · 1 个附件/);
    await expect(row(page, folder)).toHaveCount(2);

    await sidebar(page, '设置').click();
    const backupFile = testInfo.outputPath('quarry.quarry-backup');
    await quarry.download(backupFile, () => button(page, '完整备份').click());
    await sidebar(page, '资料库').click();
    await button(page, '新建文件夹').click();
    await saveDocument(page, '备份之后');
    await expect(row(page, '备份之后')).toBeVisible();
    await sidebar(page, '设置').click();
    await page.locator('input[type=file]').setInputFiles(backupFile);
    await confirmAction(page, /完整恢复/);
    await expect(page.getByText('恢复完成，请刷新页面')).toBeVisible();
    await sidebar(page, '资料库').click();
    await expect(row(page, folder)).toHaveCount(2);
    await expect(row(page, '备份之后')).toHaveCount(0);
  });

  await test.step('trash and recover files, permanently purge and autosave a tag color', async () => {
    await row(page, bank).getByRole('button', { name: '删除' }).click();
    await confirmAction(page, /移到回收站/);
    await expect(row(page, bank)).toHaveCount(0);
    await sidebar(page, '回收站').click();
    await row(page, bank).getByRole('button', { name: '恢复' }).click();
    await expect(row(page, bank)).toHaveCount(0);
    await sidebar(page, '资料库').click();
    await expect(row(page, bank)).toBeVisible();
    await row(page, '岩石复习').getByRole('button', { name: '删除' }).click();
    await confirmAction(page, /移到回收站/);
    await expect(row(page, '岩石复习')).toHaveCount(0);
    await row(page, folder).last().getByRole('button', { name: '删除' }).click();
    await confirmAction(page, /删除文件夹/);
    await expect(row(page, folder)).toHaveCount(1);
    await sidebar(page, '回收站').click();
    await row(page, '岩石复习').getByRole('button', { name: '永久删除' }).click();
    await confirmAction(page, /永久删除/);
    await expect(row(page, '岩石复习')).toHaveCount(0);

    await sidebar(page, '设置').click();
    await page.getByLabel('岩石颜色').fill('#336699');
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await sidebar(page, '首页').click();
    await sidebar(page, '设置').click();
    await expect(page.getByLabel('岩石颜色')).toHaveValue('#336699');
    await assertPageHealthy(page);
  });
});

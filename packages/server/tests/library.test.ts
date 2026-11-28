import { randomUUID } from 'node:crypto';
import { createSqliteDatabase, type SqliteDatabase } from '@quarry/database';
import type { LibraryTarget, LibraryTransferItem } from '@quarry/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createQuarryServer } from '../src/app.js';

let database: SqliteDatabase;
let app: ReturnType<typeof createQuarryServer>;
beforeEach(async () => {
  database = await createSqliteDatabase(':memory:');
  app = createQuarryServer({ db: database.db });
});
afterEach(() => database.destroy());

async function request(path: string, method = 'GET', input?: unknown, status = 200) {
  const response = await app.request('/api/' + path, {
    method, ...(input === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }),
  });
  const result = await response.json();
  expect(response.status, JSON.stringify(result)).toBe(status);
  return result.data;
}

function create(path: string, input: unknown) {
  return request(path, 'POST', input, 201);
}

async function transfer(action: 'move' | 'copy', targets: LibraryTarget[], target_folder_id: string | null, status = action === 'copy' ? 201 : 200) {
  return await request('library/' + action, 'POST', { targets, target_folder_id }, status) as LibraryTransferItem[];
}

function target(entity: LibraryTarget['entity'], id: string): LibraryTarget {
  return { entity, id };
}

function question(owner_id: string, content: string, fields: Record<string, unknown> = {}) {
  return create('questions', { owner_type: 'question_bank', owner_id, type: 'subjective',
    reference_answer: 'Answer', content, ...fields });
}

it('moves all file types together and can move them back to the root', async () => {
  const source = await create('folders', { name: 'Source' });
  const folder = await create('folders', { name: 'Folder', parent_id: source.id });
  const bank = await create('banks', { name: 'Bank', folder_id: source.id });
  const paper = await create('papers', { name: 'Paper', folder_id: source.id });
  const destination = await create('folders', { name: 'Destination' });
  const targets = [target('folder', folder.id), target('bank', bank.id), target('paper', paper.id)];

  for (const id of [destination.id, null]) {
    expect(await transfer('move', targets, id)).toEqual([
      { ...targets[0], name: folder.name }, { ...targets[1], name: bank.name }, { ...targets[2], name: paper.name },
    ]);
    expect((await request('folders/' + folder.id)).parent_id).toBe(id);
    expect((await request('banks/' + bank.id)).folder_id).toBe(id);
    expect((await request('papers/' + paper.id)).folder_id).toBe(id);
  }
});

it.each(['move', 'copy'] as const)('rejects invalid %s targets and circular destinations without changes', async action => {
  const parent = await create('folders', { name: 'Parent' });
  const child = await create('folders', { name: 'Child', parent_id: parent.id });
  const grandchild = await create('folders', { name: 'Grandchild', parent_id: child.id });
  const deleted = await create('folders', { name: 'Deleted' });
  const bank = await create('banks', { name: 'Bank' });
  await request('folders/' + deleted.id, 'DELETE');
  const targets = [target('bank', bank.id), target('folder', parent.id)];
  for (const destination of [parent.id, grandchild.id]) await transfer(action, targets, destination, 400);
  for (const destination of [deleted.id, randomUUID()]) await transfer(action, targets, destination, 404);
  await transfer(action, [targets[0]!, target('folder', deleted.id)], child.id, 404);
  await transfer(action, [targets[0]!, targets[0]!], null, 400);
  await transfer(action, [], null, 400);
  expect((await request('banks')).map((item: { id: string; folder_id: null }) => [item.id, item.folder_id]))
    .toEqual([[bank.id, null]]);
  expect(await request('folders')).toHaveLength(3);
});

it('rolls back earlier moves if a later write fails', async () => {
  const folder = await create('folders', { name: 'Folder' });
  const bank = await create('banks', { name: 'Bank' });
  const paper = await create('papers', { name: 'Paper' });
  app = createQuarryServer({ db: database.db, withTransaction: work => database.withTransaction(repositories => {
    vi.spyOn(repositories.papers, 'update').mockRejectedValueOnce(new Error('Injected failed write'));
    return work(repositories);
  }) });
  await transfer('move', [target('bank', bank.id), target('paper', paper.id)], folder.id, 500);
  expect((await request('banks/' + bank.id)).folder_id).toBeNull();
  expect((await request('papers/' + paper.id)).folder_id).toBeNull();
});

it('copies bank metadata, file and question tags, material hierarchy and attachment references', async () => {
  const fileTag = await create('tags', { target_type: 'file', name: 'Files' });
  const questionTag = await create('tags', { target_type: 'question', name: 'Questions' });
  const bank = await create('banks', { name: 'Bank', description: 'Notes', tag_ids: [fileTag.id] });
  const attachment = `![image](attachment://${randomUUID()})`;
  const parent = await question(bank.id, 'Parent', { material: attachment });
  const child = await question(bank.id, attachment, { material_parent_id: parent.id, tag_ids: [questionTag.id] });
  const grandchild = await question(bank.id, 'Grandchild', { material_parent_id: child.id });
  const deleted = await question(bank.id, 'Deleted');
  await request('questions/' + deleted.id, 'DELETE');

  const [copy] = await transfer('copy', [target('bank', bank.id)], null);
  expect(copy).toMatchObject({ entity: 'bank', name: 'Bank (副本)' });
  expect(copy!.id).not.toBe(bank.id);
  expect(await request('banks/' + copy!.id)).toMatchObject({ description: 'Notes', tag_ids: [fileTag.id] });
  const questions = await request('questions?bank_id=' + copy!.id);
  expect(questions).toHaveLength(3);
  const find = (content: string) => questions.find((item: { content: string }) => item.content === content);
  expect(find('Parent')).toMatchObject({ material: attachment, material_parent_id: null });
  expect(find('Parent').id).not.toBe(parent.id);
  expect(find(attachment)).toMatchObject({ material_parent_id: find('Parent').id, tag_ids: [questionTag.id] });
  expect(find(attachment).id).not.toBe(child.id);
  expect(find('Grandchild')).toMatchObject({ material_parent_id: find(attachment).id });
  expect(find('Grandchild').id).not.toBe(grandchild.id);
});

it('copies paper settings, composition and snapshots while keeping standalone source links', async () => {
  const fileTag = await create('tags', { target_type: 'file', name: 'Files' });
  const questionTag = await create('tags', { target_type: 'question', name: 'Questions' });
  const bank = await create('banks', { name: 'Sources' });
  const source = await question(bank.id, 'Linked', { tag_ids: [questionTag.id] });
  await request('questions/' + source.id, 'PUT', { content: 'Linked version two' });
  const settings = { description: 'Notes', full_score: 10, score_mode: 'proportional',
    time_limit_seconds: 120, shuffle_options: true, shuffle_sections: true, shuffle_materials: true,
    follow_source: true, tag_ids: [fileTag.id] };
  const paper = await create('papers', { name: 'Paper', ...settings });
  const parent = await question(paper.id, 'Material', { owner_type: 'paper', material: 'Passage' });
  const child = await question(paper.id, 'Child', { owner_type: 'paper', material_parent_id: parent.id });
  const removed = await question(paper.id, 'Removed', { owner_type: 'paper' });
  const sectionA = randomUUID(), sectionB = randomUUID(), itemA = randomUUID(), itemB = randomUUID(), itemC = randomUUID();
  const original = await request('papers/' + paper.id, 'PUT', {
    merged_shuffle_sections: [[sectionA, sectionB]],
    sections: [
      { id: sectionA, title: 'First', question_type: 'subjective', shuffle_questions: true,
        fixed_groups: [[itemA, itemB]], items: [
          { id: itemA, source_question_id: source.id }, { id: itemB, question_id: child.id },
          { id: itemC, question_id: removed.id },
        ] },
      { id: sectionB, title: 'Second', question_type: 'subjective', items: [] },
    ],
  });
  await request('questions/' + removed.id, 'DELETE');

  const [copy] = await transfer('copy', [target('paper', paper.id)], null);
  const result = await request('papers/' + copy!.id);
  expect(result).toMatchObject(settings);
  const [a, b] = result.sections;
  expect(a).toMatchObject({ title: 'First', shuffle_questions: true });
  expect(a.id).not.toBe(sectionA);
  expect(b.id).not.toBe(sectionB);
  expect(result.merged_shuffle_sections).toEqual([[a.id, b.id]]);
  expect(a.items).toHaveLength(2);
  const [linked, local] = a.items;
  expect(a.fixed_groups).toEqual([[linked.id, local.id]]);
  expect(local.group_id).toBe(linked.id);
  expect(linked.id).not.toBe(itemA);
  expect(local.id).not.toBe(itemB);
  expect(linked.question.id).not.toBe(original.sections[0].items[0].question.id);
  expect(linked).toMatchObject({ source_question_id: source.id, source_version: 2,
    question: { content: 'Linked version two', tag_ids: [questionTag.id] } });
  const material = await request('questions/' + local.question.material_parent_id);
  expect(material).toMatchObject({ owner_id: copy!.id, material: 'Passage' });
  expect(material.id).not.toBe(parent.id);
  expect(await request('questions?paper_id=' + copy!.id)).toHaveLength(3);
});

it('recursively copies active files and remaps only links inside the selected subtree', async () => {
  const tag = await create('tags', { target_type: 'file', name: 'Files' });
  const root = await create('folders', { name: 'Root', tag_ids: [tag.id] });
  const child = await create('folders', { name: 'Child', parent_id: root.id, tag_ids: [tag.id] });
  const bank = await create('banks', { name: 'Bank', folder_id: child.id });
  const externalBank = await create('banks', { name: 'Outside' });
  const internal = await question(bank.id, 'Inside');
  await request('questions/' + internal.id, 'PUT', { content: 'Inside updated' });
  const external = await question(externalBank.id, 'Outside');
  const paper = await create('papers', { name: 'Paper', folder_id: root.id, follow_source: true });
  await create('papers/' + paper.id + '/items', { source_question_id: internal.id });
  await create('papers/' + paper.id + '/items', { source_question_id: external.id });
  const deleted = await create('folders', { name: 'Deleted', parent_id: root.id });
  await create('banks', { name: 'Hidden', folder_id: deleted.id });
  await request('folders/' + deleted.id, 'DELETE');
  const destination = await create('folders', { name: 'Destination' });

  const copies = await transfer('copy', [target('bank', bank.id), target('folder', root.id)], destination.id);
  expect(copies).toHaveLength(1);
  const [copy] = copies;
  const tree = await request('folders?tree=true');
  const [clonedTree] = tree.find((item: { id: string }) => item.id === destination.id).children;
  expect(clonedTree).toMatchObject({ id: copy!.id, name: 'Root', tag_ids: [tag.id] });
  expect(clonedTree.children).toHaveLength(1);
  const [clonedChild] = clonedTree.children;
  expect(clonedChild).toMatchObject({ name: 'Child', tag_ids: [tag.id] });
  expect(clonedChild.id).not.toBe(child.id);
  const [clonedBank] = await request('banks?folder_id=' + clonedChild.id);
  const [newSource] = await request('questions?bank_id=' + clonedBank.id);
  expect(newSource).toMatchObject({ version: 2, content: 'Inside updated' });
  expect(newSource.id).not.toBe(internal.id);
  const [clonedPaper] = await request('papers?folder_id=' + copy!.id);
  expect(clonedPaper.sections.flatMap((section: { items: unknown[] }) => section.items)).toEqual([
    expect.objectContaining({ source_question_id: newSource.id, source_version: 2 }),
    expect.objectContaining({ source_question_id: external.id, source_version: 1 }),
  ]);
  expect(await request('papers/' + clonedPaper.id + '/follow-diff')).toEqual([]);
});

it('deduplicates copy names within a type, across the batch, reusing names of deleted siblings', async () => {
  await create('folders', { name: 'Notes (副本)' });
  const bank = await create('banks', { name: 'Notes' });
  const deleted = await create('banks', { name: 'Notes (副本)' });
  await request('banks/' + deleted.id, 'DELETE');
  const folder = await create('folders', { name: 'Source' });
  const other = await create('banks', { name: 'Notes', folder_id: folder.id });

  const result = await transfer('copy', [target('bank', bank.id), target('bank', other.id)], null);
  expect(result.map(item => item.name)).toEqual(['Notes (副本)', 'Notes (副本 2)']);
  const [copyOfCopy] = await transfer('copy', [target('bank', result[0]!.id)], null);
  expect(copyOfCopy!.name).toBe('Notes (副本 3)');
});

it('rolls back all copies if a later composer cannot be read', async () => {
  const bank = await create('banks', { name: 'Bank' });
  await question(bank.id, 'Original');
  const paper = await create('papers', { name: 'Paper' });
  await database.repositories.papers.update(paper.id, { composer_json: '{"sections":"invalid"}' });
  await transfer('copy', [target('bank', bank.id), target('paper', paper.id)], null, 400);
  expect(await database.repositories.questionBanks.list()).toHaveLength(1);
  expect(await database.repositories.papers.list()).toHaveLength(1);
  expect(await database.repositories.questions.list()).toHaveLength(1);
});

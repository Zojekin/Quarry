import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteDatabase } from '@quarry/database';
import type { SqliteDatabase } from '@quarry/database';
import { createQuarryServer } from '../src/app.js';

let database: SqliteDatabase;
let directory: string;
let app: ReturnType<typeof createQuarryServer>;
beforeEach(async () => {
  database = await createSqliteDatabase(':memory:');
  directory = await mkdtemp(join(tmpdir(), 'quarry-api-'));
  app = createQuarryServer({ db: database.db, attachmentsDir: directory });
});
afterEach(async () => {
  await database.destroy();
  await rm(directory, { recursive: true, force: true });
});
async function request(path: string, method = 'GET', input?: unknown, status = 200) {
  const response = await app.request(`/api${path}`, { method,
    ...(input === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }) });
  const result = await response.json();
  expect(response.status, JSON.stringify(result)).toBe(status);
  return result.data;
}
async function bank() { return request('/banks', 'POST', { name: 'Bank' }, 201); }
async function tag(target_type = 'question', name = randomUUID()) {
  return request('/tags', 'POST', { name, target_type }, 201);
}
function question(owner: string, type = 'subjective') {
  const base = { owner_type: 'question_bank', owner_id: owner, type, content: 'Find the answer', explanation: 'Analysis' };
  if (type.includes('choice')) return { ...base, options: [
    { id: randomUUID(), content: 'First', is_correct: true },
    { id: randomUUID(), content: 'Second', is_correct: false },
  ] };
  if (type === 'strict_fill_in_blank') return { ...base, blanks: [{ id: randomUUID(), valid_answers: [' A ', 'Ａ'] }] };
  return { ...base, reference_answer: 'Reference' };
}
async function createQuestion(owner: string, fields: Record<string, unknown> = {}, type = 'subjective') {
  return request('/questions', 'POST', { ...question(owner, type), ...fields }, 201);
}

describe('attachment storage', () => {
  it('deduplicates binary uploads and streams exact bytes and MIME without local paths', async () => {
    const bytes = new Uint8Array([0, 255, 42, 10, 128]);
    const upload = async () => {
      const form = new FormData();
      form.set('file', new File([bytes], 'image.png', { type: 'image/png' }));
      const response = await app.request('/api/attachments', { method: 'POST', body: form });
      expect(response.status).toBe(201);
      return (await response.json()).data;
    };
    const [first, second] = await Promise.all([upload(), upload()]);
    expect(first.id).toBe(second.id);
    expect(first).not.toHaveProperty('path');
    expect(await readdir(directory)).toEqual([first.sha256]);
    expect(await database.repositories.attachments.list()).toHaveLength(1);
    const response = await app.request(first.url);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    await unlink(join(directory, first.sha256));
    await request(`/attachments/${first.id}`, 'GET', undefined, 404);
    await request(`/attachments/${randomUUID()}`, 'GET', undefined, 404);
  });
  it('rejects malformed uploads', async () => {
    await request('/attachments', 'POST', {}, 400);
    const response = await app.request('/api/attachments', { method: 'POST', body: new FormData() });
    expect(response.status).toBe(400);
  });
});

describe('folders and banks', () => {
  it('builds a tree, moves folders and rejects cycles without changing the tree', async () => {
    const root = await request('/folders', 'POST', { name: 'Root' }, 201);
    const child = await request('/folders', 'POST', { name: 'Child', parent_id: root.id }, 201);
    await request(`/folders/${root.id}`, 'PUT', { parent_id: child.id }, 400);
    await request(`/folders/${child.id}`, 'PUT', { parent_id: child.id }, 400);
    expect((await request('/folders?tree=true'))[0].children[0].id).toBe(child.id);
    await request(`/folders/${child.id}`, 'PUT', { parent_id: null, name: 'Moved' });
    expect(await request('/folders?tree=true')).toHaveLength(2);
    await request(`/folders/${child.id}`, 'DELETE');
    await request(`/folders/${child.id}`, 'GET', undefined, 404);
  });
  it('supports bank CRUD and file tag filtering without inheritance', async () => {
    const fileTag = await tag('file');
    const folder = await request('/folders', 'POST', { name: 'Root', tag_ids: [fileTag.id] }, 201);
    const b = await request('/banks', 'POST', { name: 'Chemistry', folder_id: folder.id }, 201);
    expect(await request(`/banks?tags=${fileTag.id}`)).toHaveLength(0);
    await request(`/banks/${b.id}`, 'PUT', { name: 'Physics', tag_ids: [fileTag.id] });
    expect(await request(`/banks?tags=${fileTag.id}&search=Physics&folder_id=${folder.id}`)).toHaveLength(1);
    expect((await request(`/banks/${b.id}`)).description).toBe('');
    await request(`/banks/${b.id}`, 'DELETE');
    await request(`/banks/${b.id}`, 'GET', undefined, 404);
  });
  it('soft-deletes a folder subtree and its owned content', async () => {
    const root = await request('/folders', 'POST', { name: 'Root' }, 201);
    const child = await request('/folders', 'POST', { name: 'Child', parent_id: root.id }, 201);
    const b = await request('/banks', 'POST', { name: 'Nested', folder_id: child.id }, 201);
    const q = await createQuestion(b.id);
    const paper = await request('/papers', 'POST', { name: 'Nested', folder_id: child.id }, 201);
    await request(`/folders/${root.id}`, 'DELETE');
    for (const path of [`/banks/${b.id}`, `/papers/${paper.id}`, `/questions/${q.id}`])
      await request(path, 'GET', undefined, 404);
    expect(await request('/folders')).toEqual([]);
    expect((await database.db.selectFrom('questions').selectAll().executeTakeFirstOrThrow()).is_deleted).toBe(1);
  });
  it('returns uniform validation and missing-resource errors', async () => {
    await request('/banks', 'POST', { name: '   ' }, 400);
    await request('/folders', 'POST', { name: 'X', parent_id: randomUUID() }, 404);
    await request(`/banks/${randomUUID()}`, 'PUT', { name: 'Missing' }, 404);
    const response = await app.request('/api/questions', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: '{' });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('questions and dual tags', () => {
  it.each(['single_choice', 'multiple_choice', 'indefinite_choice', 'strict_fill_in_blank', 'free_fill_in_blank', 'subjective'])
    ('round trips %s with versioned edits, search and deletion', async type => {
      const b = await bank();
      const t = await tag();
      const q = await createQuestion(b.id, { tag_ids: [t.id] }, type);
      expect(q.version).toBe(1);
      if (type === 'strict_fill_in_blank') expect(q.blanks[0].valid_answers).toEqual([' A ', 'Ａ']);
      const changed = await request(`/questions/${q.id}`, 'PUT', { content: 'Changed stem' });
      expect(changed.version).toBe(2);
      expect(await request(`/questions?type=${type}&bank_id=${b.id}&tags=${t.id}&search=changed`)).toHaveLength(1);
      expect(await request(`/questions?search=absent`)).toHaveLength(0);
      await request(`/questions/${q.id}`, 'DELETE');
      await request(`/questions/${q.id}`, 'GET', undefined, 404);
    });
  it('strictly isolates both namespaces on create, replace, attach, detach and filters', async () => {
    const b = await bank();
    const file = await tag('file', 'Same name');
    const qt = await tag('question', 'Same name');
    await request('/tags', 'POST', { name: 'Same name', target_type: 'file' }, 409);
    const q = await createQuestion(b.id);
    await request('/questions', 'POST', { ...question(b.id), tag_ids: [file.id] }, 400);
    await request(`/questions/${q.id}`, 'PUT', { content: 'Must rollback', tag_ids: [file.id] }, 400);
    expect((await request(`/questions/${q.id}`)).content).toBe('Find the answer');
    await request(`/banks/${b.id}`, 'PUT', { tag_ids: [qt.id] }, 400);
    const target = { tag_type: 'question', target_type: 'question', target_id: q.id, entity_type: 'question' };
    await request(`/tags/${qt.id}/relations`, 'POST', target, 201);
    await request(`/tags/${qt.id}/relations`, 'POST', target, 201);
    expect(await database.repositories.tags.listRelations(qt.id)).toHaveLength(1);
    expect((await request(`/questions/${q.id}`)).tag_ids).toEqual([qt.id]);
    await request(`/tags/${file.id}/relations`, 'POST', target, 400);
    await request(`/tags/${file.id}/relations`, 'DELETE', target, 400);
    await request(`/tags/${file.id}/relations`, 'POST', { ...target, tag_type: 'file', target_type: 'file' }, 400);
    await request(`/tags/${qt.id}/relations`, 'DELETE', target);
    expect((await request(`/questions/${q.id}`)).tag_ids).toEqual([]);
    expect(await request('/tags?target_type=file')).toHaveLength(1);
    await request(`/questions?tags=${file.id}`, 'GET', undefined, 400);
    await request(`/banks?tags=${qt.id}`, 'GET', undefined, 400);
    await request('/questions?type=unsupported', 'GET', undefined, 400);
  });
  it('supports shared material parents and rejects foreign owners and cycles', async () => {
    const b = await bank();
    const other = await bank();
    const parent = await createQuestion(b.id, { material: 'Read this passage' });
    const child = await createQuestion(b.id, { material_parent_id: parent.id });
    expect(child.material_parent_id).toBe(parent.id);
    await request(`/questions/${parent.id}`, 'PUT', { material_parent_id: child.id }, 400);
    await request('/questions', 'POST', { ...question(other.id), material_parent_id: parent.id }, 400);
    await request(`/questions/${child.id}`, 'PUT', { owner_id: other.id }, 400);
    await request(`/questions/${parent.id}`, 'DELETE');
    await request(`/questions/${child.id}`, 'GET', undefined, 404);
  });
});

describe('paper composer and source following', () => {
  it('keeps material siblings together and preserves their relative order on recomposition', async () => {
    const b = await bank();
    const parent = await createQuestion(b.id, { material: 'Shared passage' });
    const first = await createQuestion(b.id, { material_parent_id: parent.id });
    const second = await createQuestion(b.id, { material_parent_id: parent.id });
    let paper = await request('/papers', 'POST', { name: 'Material' }, 201);
    paper = await request(`/papers/${paper.id}/items`, 'POST', { source_question_id: first.id }, 201);
    paper = await request(`/papers/${paper.id}/items`, 'POST', { source_question_id: second.id }, 201);
    const section = paper.sections[0];
    expect(section.items[0].question.material_parent_id).toBe(section.items[1].question.material_parent_id);
    const config = { id: section.id, title: section.title, question_type: section.question_type };
    await request(`/papers/${paper.id}`, 'PUT', { sections: [{ ...config,
      items: [...section.items].reverse().map(item => ({ id: item.id })) }] }, 400);
    await request(`/papers/${paper.id}`, 'PUT', { sections: [{ ...config, items: [
      { id: section.items[0].id }, { question: question(b.id) }, { id: section.items[1].id },
    ] }] }, 400);
    expect((await request(`/papers/${paper.id}`)).sections[0].items.map(item => item.id))
      .toEqual(section.items.map(item => item.id));
  });
  it('rejects overlapping fixed groups and keeps an unchanged composition on failure', async () => {
    const b = await bank();
    let paper = await request('/papers', 'POST', { name: 'Groups' }, 201);
    for (let index = 0; index < 3; index++)
      paper = await request(`/papers/${paper.id}/items`, 'POST', { question: question(b.id) }, 201);
    const section = paper.sections[0];
    const ids = section.items.map(item => item.id);
    await request(`/papers/${paper.id}`, 'PUT', { sections: [{ id: section.id, title: section.title,
      question_type: section.question_type, items: ids.map(id => ({ id })),
      fixed_groups: [[ids[0], ids[1]], [ids[1], ids[2]]] }] }, 400);
    expect((await request(`/papers/${paper.id}`)).sections[0].fixed_groups).toEqual([]);
  });
  it('removes paper items and clears fixed groups that no longer have two members', async () => {
    const b = await bank();
    const itemIds = [randomUUID(), randomUUID()];
    const paper = await request('/papers', 'POST', { name: 'Delete item', sections: [{ id: randomUUID(),
      title: 'Questions', question_type: 'subjective', fixed_groups: [itemIds],
      items: itemIds.map(id => ({ id, question: question(b.id) })) }] }, 201);
    await request(`/papers/${paper.id}/items/${itemIds[0]}`, 'DELETE');
    const updated = await request(`/papers/${paper.id}`);
    expect(updated.sections[0].fixed_groups).toEqual([]);
    expect(updated.sections[0].items[0].group_id).toBe(null);
    expect(updated.sections[0].items[0].sort_order).toBe(0);
    await request(`/questions/${updated.sections[0].items[0].question_id}`, 'DELETE');
    expect((await request(`/papers/${paper.id}`)).sections[0].items).toHaveLength(0);
  });
  it('uses injected repositories through their supplied transaction runner', async () => {
    app = createQuarryServer({ db: database.db, repositories: database.repositories,
      withTransaction: work => database.withTransaction(work) });
    const b = await bank();
    expect((await database.repositories.questionBanks.findById(b.id))?.name).toBe('Bank');
  });
  it('creates inline and source questions, sections, groups and persisted shuffle settings', async () => {
    const b = await bank();
    const q = await createQuestion(b.id, {}, 'single_choice');
    const sectionId = randomUUID();
    const firstId = randomUUID();
    const secondId = randomUUID();
    const paper = await request('/papers', 'POST', { name: 'Exam', sections: [{ id: sectionId,
      title: 'Choices', question_type: 'single_choice', shuffle_questions: true,
      fixed_groups: [[firstId, secondId]], items: [
        { id: firstId, source_question_id: q.id, full_score: 7 },
        { id: secondId, question: question(b.id, 'single_choice') },
      ] }], shuffle_options: true, shuffle_materials: true }, 201);
    expect(paper.follow_source).toBe(false);
    expect(paper.sections[0].items[0].source_version).toBe(1);
    expect(paper.sections[0].items[0].question.max_score).toBe(7);
    expect(paper.sections[0].items[0].question.owner_id).toBe(paper.id);
    expect(paper.sections[0].items[0].group_id).toBe(firstId);
    expect(paper.sections[0].fixed_groups).toEqual([[firstId, secondId]]);
    expect((await request(`/papers/${paper.id}`)).shuffle_materials).toBe(true);
    expect(await request(`/questions?paper_id=${paper.id}`)).toHaveLength(2);
    const added = await request(`/papers/${paper.id}/items`, 'POST', { question: question(b.id) }, 201);
    expect(added.sections).toHaveLength(2);
    const merged = await request(`/papers/${paper.id}`, 'PUT', {
      merged_shuffle_sections: [[sectionId, added.sections[1].id]], name: 'Updated' });
    expect(merged.merged_shuffle_sections).toHaveLength(1);
    expect(await request('/papers?search=Updated')).toHaveLength(1);
    await request(`/papers/${paper.id}`, 'DELETE');
    await request(`/papers/${paper.id}`, 'GET', undefined, 404);
  });
  it('rolls back an entire composition with invalid types, groups or merged references', async () => {
    const b = await bank();
    const q = await createQuestion(b.id);
    await request('/papers', 'POST', { name: 'Bad', sections: [{ id: randomUUID(), title: 'Wrong',
      question_type: 'single_choice', items: [{ source_question_id: q.id }] }] }, 400);
    expect(await request('/papers')).toHaveLength(0);
    expect(await database.repositories.questions.list()).toHaveLength(1);
    const paper = await request('/papers', 'POST', { name: 'Valid' }, 201);
    await request(`/papers/${paper.id}`, 'PUT', { name: 'Rollback', merged_shuffle_sections: [[randomUUID(), randomUUID()]] }, 400);
    expect((await request(`/papers/${paper.id}`)).name).toBe('Valid');
    await request(`/papers/${paper.id}`, 'PUT', { sections: [{ id: randomUUID(), title: 'Bad',
      question_type: 'subjective', items: [], fixed_groups: [[randomUUID(), randomUUID()]] }] }, 400);
  });
  it('previews all followed content, applies updates and retains selection, scores and order', async () => {
    const b = await bank();
    const oldTag = await tag();
    const newTag = await tag();
    const parent = await createQuestion(b.id, { material: 'Old material' });
    const source = await createQuestion(b.id, { material_parent_id: parent.id, tag_ids: [oldTag.id] }, 'multiple_choice');
    let paper = await request('/papers', 'POST', { name: 'Follow', full_score: 100, score_mode: 'proportional' }, 201);
    paper = await request(`/papers/${paper.id}/items`, 'POST', { source_question_id: source.id,
      full_score: 9, score_mode: 'proportional' }, 201);
    const originalItem = paper.sections[0].items[0];
    await request(`/questions/${source.id}`, 'PUT', { content: 'New stem', explanation: 'New analysis', tag_ids: [newTag.id],
      options: source.options.map((o: { is_correct: boolean; content: string }) => ({ ...o,
        content: `New ${o.content}`, is_correct: !o.is_correct })) });
    await request(`/questions/${parent.id}`, 'PUT', { material: 'New material' });
    const diff = await request(`/papers/${paper.id}/follow-diff`);
    expect(Object.keys(diff[0].changes).sort()).toEqual(['analysis', 'answers', 'material', 'options', 'stem', 'tags']);
    expect(diff[0].changes.material).toEqual({ before: 'Old material', after: 'New material' });
    expect((await request(`/papers/${paper.id}`)).sections[0].items[0].question.content).toBe('Find the answer');
    await request(`/papers/${paper.id}/apply-follow`, 'POST', {}, 409);
    await request(`/papers/${paper.id}`, 'PUT', { follow_source: true });
    const updated = await request(`/papers/${paper.id}/apply-follow`, 'POST', {});
    const item = updated.sections[0].items[0];
    expect(item.id).toBe(originalItem.id);
    expect(item.question_id).toBe(originalItem.question_id);
    expect(item.sort_order).toBe(originalItem.sort_order);
    expect(item.question.content).toBe('New stem');
    expect(item.question.material).toBe('New material');
    expect(item.question.tag_ids).toEqual([newTag.id]);
    expect(item.question.max_score).toBe(9);
    expect(item.question.score_mode).toBe('proportional');
    expect(updated.full_score).toBe(100);
    expect(updated.score_mode).toBe('proportional');
    expect(await request(`/papers/${paper.id}/follow-diff`)).toEqual([]);
    const unchanged = await request(`/papers/${paper.id}/apply-follow`, 'POST', {});
    expect(unchanged.sections[0].items[0].question.version).toBe(item.question.version);
    await request(`/papers/${paper.id}`, 'PUT', { follow_source: false });
    await request(`/questions/${source.id}`, 'PUT', { content: 'Unfollowed' });
    expect((await request(`/papers/${paper.id}`)).sections[0].items[0].question.content).toBe('New stem');
  });
  it.each(['question', 'bank'])('marks deleted source %s invalid while retaining the last content', async deletion => {
    const b = await bank();
    const q = await createQuestion(b.id);
    let paper = await request('/papers', 'POST', { name: 'Follow', follow_source: true }, 201);
    paper = await request(`/papers/${paper.id}/items`, 'POST', { source_question_id: q.id }, 201);
    await request(deletion === 'bank' ? `/banks/${b.id}` : `/questions/${q.id}`, 'DELETE');
    expect((await request(`/papers/${paper.id}/follow-diff`))[0].source_invalid).toBe(true);
    const updated = await request(`/papers/${paper.id}/apply-follow`, 'POST', {});
    expect(updated.sections[0].items[0].source_invalid).toBe(1);
    expect(updated.sections[0].items[0].source_available).toBe(false);
    expect(updated.sections[0].items[0].question.content).toBe(q.content);
  });
  it('follows answer-only changes for manual and strict blank questions', async () => {
    const b = await bank();
    const manual = await createQuestion(b.id);
    const blank = await createQuestion(b.id, {}, 'strict_fill_in_blank');
    let paper = await request('/papers', 'POST', { name: 'Answers', follow_source: true }, 201);
    paper = await request(`/papers/${paper.id}/items`, 'POST', { source_question_id: manual.id }, 201);
    paper = await request(`/papers/${paper.id}/items`, 'POST', { source_question_id: blank.id }, 201);
    await request(`/questions/${manual.id}`, 'PUT', { reference_answer: 'New reference' });
    await request(`/questions/${blank.id}`, 'PUT', { blanks: [{ ...blank.blanks[0], valid_answers: [' X '] }] });
    const changes = await request(`/papers/${paper.id}/follow-diff`);
    expect(changes).toHaveLength(2);
    expect(changes.every((change: { changes: object }) => Object.keys(change.changes).join() === 'answers')).toBe(true);
    const updated = await request(`/papers/${paper.id}/apply-follow`, 'POST', {});
    expect(updated.sections[1].items[0].question.blanks[0].valid_answers).toEqual([' X ']);
  });
});

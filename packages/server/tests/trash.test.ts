import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createSqliteDatabase } from '@quarry/database';
import type { SqliteDatabase } from '@quarry/database';
import { createQuarryServer } from '../src/app.js';

let database: SqliteDatabase;
let app: ReturnType<typeof createQuarryServer>;
beforeEach(async () => {
  database = await createSqliteDatabase(':memory:');
  app = createQuarryServer({ db: database.db });
});
afterEach(async () => { await database.destroy(); });
async function request(path: string, method = 'GET', input?: unknown, status = 200) {
  const response = await app.request(`/api${path}`, { method,
    ...(input === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }) });
  const result = await response.json();
  expect(response.status, JSON.stringify(result)).toBe(status);
  return result.data;
}

it('restores a nested folder and owned content, including required ancestors', async () => {
  const root = await request('/folders', 'POST', { name: 'Root' }, 201);
  const child = await request('/folders', 'POST', { name: 'Child', parent_id: root.id }, 201);
  const bank = await request('/banks', 'POST', { name: 'Bank', folder_id: child.id }, 201);
  const q = await request('/questions', 'POST', { owner_type: 'question_bank', owner_id: bank.id,
    content: 'Manual', type: 'subjective', reference_answer: 'A' }, 201);
  await request(`/folders/${root.id}`, 'DELETE');
  expect(await request('/trash')).toHaveLength(4);
  await request(`/trash/questions/${q.id}/restore`, 'POST');
  expect((await request(`/questions/${q.id}`)).content).toBe('Manual');
  expect(await request('/trash')).toHaveLength(0);
  await request(`/folders/${root.id}`, 'DELETE');
  await request(`/trash/folders/${root.id}/restore`, 'POST');
  expect(await request('/trash')).toHaveLength(0);
  expect(await request('/folders')).toHaveLength(2);
});

it('lists question metadata using the current owner, including paper and material questions', async () => {
  const bank = await request('/banks', 'POST', { name: 'Bank' }, 201);
  const parent = await request('/questions', 'POST', { owner_type: 'question_bank', owner_id: bank.id,
    content: 'Material question', material: 'Shared material', type: 'subjective', reference_answer: 'A' }, 201);
  const child = await request('/questions', 'POST', { owner_type: 'question_bank', owner_id: bank.id,
    content: 'Material child', material_parent_id: parent.id, type: 'single_choice', options: [
      { id: randomUUID(), content: 'Right', is_correct: true },
      { id: randomUUID(), content: 'Wrong', is_correct: false },
    ] }, 201);
  const paper = await request('/papers', 'POST', { name: 'Paper', sections: [{ id: randomUUID(),
    title: 'Manual', question_type: 'subjective', items: [
      { question: { type: 'subjective', content: 'Paper question', reference_answer: 'A' } },
    ] }] }, 201);
  const paperQuestion = paper.sections[0].items[0].question;
  await request(`/questions/${child.id}`, 'DELETE');
  const [standalone] = await request('/trash');
  expect(standalone).toMatchObject({ id: child.id, entity: 'questions', stem: 'Material child',
    type: 'single_choice', question_type: 'single_choice', parent_name: 'Bank', parent_deleted: false,
    material_parent_id: parent.id, deleted_batch_id: expect.any(String) });

  await request(`/banks/${bank.id}`, 'DELETE');
  await request(`/papers/${paper.id}`, 'DELETE');
  expect(await request('/trash')).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: bank.id, entity: 'question_banks', name: 'Bank', deleted_batch_id: expect.any(String) }),
    expect.objectContaining({ ...standalone, parent_deleted: true }),
    expect.objectContaining({ id: parent.id, parent_name: 'Bank', parent_deleted: true }),
    expect.objectContaining({ id: paperQuestion.id, parent_name: 'Paper', parent_deleted: true, question_type: 'subjective' }),
  ]));

  await request(`/trash/question_banks/${bank.id}/restore`, 'POST');
  expect(await request('/trash')).toContainEqual(standalone);
});

it('batch restores overlapping selections and preserves previously deleted descendants', async () => {
  const folder = await request('/folders', 'POST', { name: 'Folder' }, 201);
  const bank = await request('/banks', 'POST', { name: 'Bank', folder_id: folder.id }, 201);
  const sibling = await request('/banks', 'POST', { name: 'Sibling', folder_id: folder.id }, 201);
  const q = await request('/questions', 'POST', { owner_type: 'question_bank', owner_id: bank.id,
    content: 'Manual', type: 'subjective', reference_answer: 'A' }, 201);
  await request(`/questions/${q.id}`, 'DELETE');
  await request(`/banks/${bank.id}`, 'DELETE');
  await request(`/folders/${folder.id}`, 'DELETE');
  await request('/trash/batch', 'POST', { action: 'restore', targets: [
    { entity: 'question_banks', id: bank.id }, { entity: 'folders', id: folder.id },
  ] });
  expect((await request('/banks')).map(bank => bank.id)).toEqual(expect.arrayContaining([bank.id, sibling.id]));
  expect(await request('/trash')).toEqual([expect.objectContaining({ id: q.id, parent_deleted: false })]);
});

it('batch purges only the selected subtrees and rejects stale selections before purging', async () => {
  const folder = await request('/folders', 'POST', { name: 'Folder' }, 201);
  const nested = await request('/folders', 'POST', { name: 'Nested', parent_id: folder.id }, 201);
  const bank = await request('/banks', 'POST', { name: 'Bank', folder_id: nested.id }, 201);
  const active = await request('/banks', 'POST', { name: 'Active' }, 201);
  const makeQuestion = (owner_id: string, material_parent_id?: string) => request('/questions', 'POST', {
    owner_type: 'question_bank', owner_id, content: 'Manual', type: 'subjective', reference_answer: 'A', material_parent_id,
  }, 201);
  const parent = await makeQuestion(bank.id);
  const child = await makeQuestion(bank.id, parent.id);
  const standalone = await makeQuestion(active.id);
  await request(`/questions/${standalone.id}`, 'DELETE');
  await request(`/folders/${folder.id}`, 'DELETE');
  const targets = [{ entity: 'folders', id: folder.id }, { entity: 'question_banks', id: bank.id }];
  await request('/trash/batch', 'POST', { action: 'purge', targets: [
    ...targets, { entity: 'question_banks', id: active.id },
  ] }, 404);
  expect(await request('/trash')).toHaveLength(6);
  await request('/trash/batch', 'POST', { action: 'purge', targets });
  expect(await request('/trash')).toEqual([expect.objectContaining({ id: standalone.id, parent_deleted: false })]);
  expect(await database.db.selectFrom('questions').select('id').where('id', 'in', [parent.id, child.id]).execute()).toEqual([]);
  await request('/trash/batch', 'POST', { action: 'purge', targets: [{ entity: 'questions', id: standalone.id }] });
  expect(await request('/trash')).toEqual([]);
});

it('purges a source bank and descendants while retaining paper copies and learning history', async () => {
  const bank = await request('/banks', 'POST', { name: 'Bank' }, 201);
  const q = await request('/questions', 'POST', { owner_type: 'question_bank', owner_id: bank.id,
    content: 'Manual', type: 'subjective', reference_answer: 'A' }, 201);
  const paper = await request('/papers', 'POST', { name: 'Paper', sections: [{ id: randomUUID(),
    title: 'Manual', question_type: 'subjective', items: [{ source_question_id: q.id }] }] }, 201);
  const sessionId = randomUUID();
  await database.repositories.studySessions.create({ id: sessionId, paper_id: paper.id, mode: 'practice',
    start_time: new Date().toISOString(), end_time: null });
  await database.repositories.studySessions.addRecord({ id: randomUUID(), session_id: sessionId,
    question_id: q.id, attempt_index: 1, user_answer_json: '"A"', score: null, is_correct: null,
    answered_at: new Date().toISOString() });
  const mistake = await database.repositories.mistakes.create({ id: randomUUID(), source_question_id: q.id,
    source_version: 1, question_snapshot_json: JSON.stringify(q), last_user_answer_json: '"A"',
    last_wrong_at: new Date().toISOString() });
  await request(`/banks/${bank.id}`, 'DELETE');
  await request(`/trash/question_banks/${bank.id}`, 'DELETE');
  expect((await request(`/papers/${paper.id}`)).sections[0].items[0].question.content).toBe('Manual');
  expect(await database.repositories.studySessions.listRecords(sessionId)).toHaveLength(1);
  expect(await database.repositories.mistakes.findById(mistake.id)).toBeDefined();
  expect(await request('/trash')).toHaveLength(0);
  expect(await database.db.selectFrom('questions').selectAll().where('id', '=', q.id).execute()).toEqual([]);
});

it('restoring a folder leaves children deleted in earlier operations in the trash', async () => {
  const folder = await request('/folders', 'POST', { name: 'Folder' }, 201);
  const early = await request('/banks', 'POST', { name: 'Earlier deletion', folder_id: folder.id }, 201);
  const recent = await request('/banks', 'POST', { name: 'Same deletion', folder_id: folder.id }, 201);
  await request(`/banks/${early.id}`, 'DELETE');
  await request(`/folders/${folder.id}`, 'DELETE');
  await request(`/trash/folders/${folder.id}/restore`, 'POST');
  expect((await request('/trash')).map(item => item.id)).toEqual([early.id]);
  expect((await request('/banks')).map(item => item.id)).toEqual([recent.id]);
});

it('retains source identity for new sessions and mistake merging after permanent source deletion', async () => {
  const bank = await request('/banks', 'POST', { name: 'Bank' }, 201);
  const options = [{ id: randomUUID(), content: 'Right', is_correct: true },
    { id: randomUUID(), content: 'Wrong', is_correct: false }];
  const q = await request('/questions', 'POST', { owner_type: 'question_bank', owner_id: bank.id,
    content: 'Choice', type: 'single_choice', options }, 201);
  const paper = await request('/papers', 'POST', { name: 'Paper', sections: [{ id: randomUUID(),
    title: 'Choice', question_type: 'single_choice', items: [{ source_question_id: q.id }] }] }, 201);
  const submit = async () => {
    const session = await request('/sessions', 'POST', { paper_id: paper.id, mode: 'practice' }, 201);
    await request(`/sessions/${session.id}/submit-question`, 'POST', {
      question_id: session.items[0].question.id, answer: { kind: 'choice', option_ids: [options[1]!.id] },
    });
  };
  await submit();
  await request(`/banks/${bank.id}`, 'DELETE');
  await request(`/trash/question_banks/${bank.id}`, 'DELETE');
  await submit();
  const mistakes = await request('/mistakes');
  expect(mistakes).toHaveLength(1);
  expect(mistakes[0].source_question_id).toBe(q.id);
  expect(mistakes[0].wrong_count).toBe(2);
  expect((await request('/analytics/dashboard')).deduplicated_questions_count).toBe(1);
});

it('clears folder subtrees and paper contents, and rejects active or missing targets', async () => {
  const folder = await request('/folders', 'POST', { name: 'Folder' }, 201);
  const paper = await request('/papers', 'POST', { name: 'Paper', folder_id: folder.id,
    sections: [{ id: randomUUID(), title: 'Manual', question_type: 'subjective', items: [
      { question: { type: 'subjective', content: 'Q', reference_answer: 'A' } },
    ] }] }, 201);
  await request(`/trash/papers/${paper.id}`, 'DELETE', undefined, 404);
  await request('/trash/nope/id', 'DELETE', undefined, 400);
  await request(`/trash/questions/${randomUUID()}/restore`, 'POST', undefined, 404);
  await request(`/folders/${folder.id}`, 'DELETE');
  await request('/trash', 'DELETE');
  expect(await request('/trash')).toEqual([]);
  expect(await database.db.selectFrom('folders').selectAll().execute()).toEqual([]);
  expect(await database.db.selectFrom('questions').selectAll().execute()).toEqual([]);
  expect(await database.db.selectFrom('paper_items').selectAll().execute()).toEqual([]);
});

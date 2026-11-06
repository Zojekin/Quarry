import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createSqliteDatabase } from '@quarry/database';
import { createQuarryServer } from '../src/app.js';
let db: Awaited<ReturnType<typeof createSqliteDatabase>>;
let app: ReturnType<typeof createQuarryServer>;
beforeEach(async () => { db = await createSqliteDatabase(':memory:'); app = createQuarryServer({ db: db.db }); });
afterEach(async () => { vi.useRealTimers(); await db.destroy(); });
async function request(path: string, input?: unknown, status = 200, method = input === undefined ? 'GET' : 'POST') {
  const response = await app.request(`/api${path}`, { method, headers: { 'Content-Type': 'application/json' },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
  const json = await response.json();
  expect(response.status, JSON.stringify(json)).toBe(status);
  return json.data;
}
async function setup(type = 'single_choice', count = 1) {
  const bank = await request('/banks', { name: 'Bank' }, 201);
  const correct = randomUUID();
  const q = await request('/questions', { owner_type: 'question_bank', owner_id: bank.id, type,
    content: 'Question', explanation: 'Secret analysis', tag_ids: [], ...(type === 'single_choice'
      ? { max_score: 5, options: [{ id: correct, content: 'Yes', is_correct: true }, { id: randomUUID(), content: 'No', is_correct: false }], options_order_fixed: false }
      : { reference_answer: 'Reference' }) }, 201);
  let paper = await request('/papers', { name: 'Paper', shuffle_options: true }, 201);
  paper = await request(`/papers/${paper.id}/items`, { source_question_id: q.id }, 201);
  for (let i = 1; i < count; i++) paper = await request(`/papers/${paper.id}/items`, { question: {
    type, content: 'Extra', explanation: '', tag_ids: [], max_score: 5,
    options: [{ id: randomUUID(), content: 'A', is_correct: true }, { id: randomUUID(), content: 'B', is_correct: false }], options_order_fixed: false } }, 201);
  return { paper, q, correct };
}
describe('sessions, mistakes and analytics', () => {
  it('persists deterministic order, protects solutions, locks attempts and merges versioned mistakes', async () => {
    const { paper, q, correct } = await setup();
    const first = await request('/sessions', { paper_id: paper.id, mode: 'practice', seed: 4 }, 201);
    const second = await request('/sessions', { paper_id: paper.id, mode: 'practice', seed: 4 }, 201);
    expect(first.option_order).toEqual(second.option_order);
    expect(JSON.stringify(first)).not.toContain('Secret analysis');
    expect(first.items[0].question.options[0]).not.toHaveProperty('is_correct');
    const question_id = first.question_order[0];
    const input = { question_id, answer: { kind: 'choice', option_ids: [] } };
    const wrong = await request(`/sessions/${first.id}/submit-question`, input);
    expect(wrong).toMatchObject({ score: 0, locked: true, analysis: 'Secret analysis', correct_answer: [correct] });
    await request(`/sessions/${first.id}/submit-question`, input, 409);
    const mistake = (await request('/mistakes'))[0];
    expect(mistake.source_question_id).toBe(q.id);
    await request(`/mistakes/${mistake.id}/mastery`, { mastery_status: 'mastered' }, 200, 'PUT');
    await request(`/sessions/${first.id}/submit-question`, { ...input, attempt_index: 2 });
    const merged = (await request('/mistakes'))[0];
    expect(merged).toMatchObject({ wrong_count: 2, mastery_status: 'reviewing' });
    expect(merged.history).toHaveLength(2);
    expect(await db.repositories.studySessions.listRecords(first.id)).toHaveLength(2);
    // Practice confirmations count even when the submitted answer is blank.
    expect((await request('/analytics/dashboard')).total_questions_answered).toBe(2);
    await request(`/sessions/${first.id}/submit-question`, { question_id, attempt_index: 3, answer: { kind: 'choice', option_ids: [correct] } });
    expect(await request('/analytics/dashboard')).toMatchObject({ total_questions_answered: 3, deduplicated_questions_count: 1 });
    const review = await request('/mistakes/create-paper', { mastery_status: 'reviewing' }, 201);
    expect(review.sections[0].items[0]).toMatchObject({ source_question_id: q.id, source_version: 1 });
  });
  it('retains exam blanks, excludes pauses, splits midnight and rejects repeat submission', async () => {
    const { paper, correct } = await setup('single_choice', 2);
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T23:59:00Z'));
    const session = await request('/sessions', { paper_id: paper.id, mode: 'exam', time_zone: 'UTC' }, 201);
    vi.setSystemTime(new Date('2026-11-06T23:59:30Z'));
    await request(`/sessions/${session.id}/pause`, {});
    await request(`/sessions/${session.id}/submit-exam`, {}, 409);
    vi.setSystemTime(new Date('2026-11-07T00:00:00Z'));
    await request(`/sessions/${session.id}/resume`, {});
    vi.setSystemTime(new Date('2026-11-07T00:01:00Z'));
    const result = await request(`/sessions/${session.id}/submit-exam`, { answers: [
      { question_id: session.question_order[0], answer: { kind: 'choice', option_ids: [correct] } }] });
    expect(result.results).toHaveLength(2); expect(result.answered_count).toBe(1);
    await request(`/sessions/${session.id}/submit-exam`, {}, 409);
    const saved = await request(`/sessions/${session.id}`);
    expect(saved).toMatchObject({ paused_duration_seconds: 30, effective_duration_seconds: 90, status: 'completed' });
    expect(saved.daily_metrics).toEqual([{ date: '2026-11-06', seconds: 45 }, { date: '2026-11-07', seconds: 45 }]);
    expect((await request('/analytics/dashboard')).daily_heatmap).toHaveLength(2);
  });
  it('keeps versions separate and reviews the historical snapshot after permanent source deletion', async () => {
    const { paper, q } = await setup();
    const initial = await request('/sessions', { paper_id: paper.id, mode: 'practice' }, 201);
    await request(`/sessions/${initial.id}/submit-question`, { question_id: initial.question_order[0], answer: { kind: 'choice', option_ids: [] } });
    await request(`/questions/${q.id}`, { content: 'Version two' }, 200, 'PUT');
    const secondPaper = await request('/papers', { name: 'Version two' }, 201);
    await request(`/papers/${secondPaper.id}/items`, { source_question_id: q.id }, 201);
    const second = await request('/sessions', { paper_id: secondPaper.id, mode: 'practice' }, 201);
    await request(`/sessions/${second.id}/submit-question`, { question_id: second.question_order[0], answer: { kind: 'choice', option_ids: [] } });
    expect((await request('/mistakes')).map((m: { source_version: number }) => m.source_version).sort()).toEqual([1, 2]);
    const original = (await request('/mistakes')).find((m: { source_version: number }) => m.source_version === 1);
    await request(`/questions/${q.id}`, undefined, 200, 'DELETE');
    await db.db.deleteFrom('questions').where('id', '=', q.id).execute();
    const review = await request('/mistakes/create-paper', { ids: [original.id] }, 201);
    expect(review.sections[0].items[0].question.content).toBe('Question');
    const retry = await request('/sessions', { paper_id: review.id, mode: 'practice' }, 201);
    await request(`/sessions/${retry.id}/submit-question`, { question_id: retry.question_order[0], answer: { kind: 'choice', option_ids: [] } });
    expect((await request(`/mistakes/${original.id}`)).wrong_count).toBe(2);
  });
  it('keeps session snapshots through paper edits and server recreation; invalid answers roll back', async () => {
    const { paper } = await setup();
    const session = await request('/sessions', { paper_id: paper.id, mode: 'practice', seed: 12 }, 201);
    const question = paper.sections[0].items[0].question;
    await request(`/questions/${question.id}`, { content: 'Updated later', explanation: 'Updated explanation' }, 200, 'PUT');
    app = createQuarryServer({ db: db.db });
    const reopened = await request(`/sessions/${session.id}`);
    expect(reopened.items[0].question.content).toBe('Question');
    expect(reopened.option_order).toEqual(session.option_order);
    await request(`/sessions/${session.id}/submit-question`, { question_id: session.question_order[0],
      answer: { kind: 'choice', option_ids: [randomUUID()] } }, 400);
    expect(await db.repositories.studySessions.listRecords(session.id)).toHaveLength(0);
    expect(await db.repositories.mistakes.list()).toHaveLength(0);
    const result = await request(`/sessions/${session.id}/submit-question`, { question_id: session.question_order[0],
      answer: { kind: 'choice', option_ids: [] } });
    expect(result.analysis).toBe('Secret analysis');
  });
  it('shuffles fixed and material blocks atomically across merged sections', async () => {
    const bank = await request('/banks', { name: 'Materials' }, 201);
    const question = (content: string) => ({ type: 'subjective', content, explanation: '', tag_ids: [], reference_answer: 'Reference' });
    const parent = await request('/questions', { ...question('Passage'), owner_type: 'question_bank', owner_id: bank.id, material: 'Shared material' }, 201);
    const childIds = [];
    for (const content of ['Child 1', 'Child 2']) childIds.push((await request('/questions', {
      ...question(content), owner_type: 'question_bank', owner_id: bank.id, material_parent_id: parent.id }, 201)).id);
    const a = randomUUID(), b = randomUUID();
    const paper = await request('/papers', { name: 'Blocks', shuffle_sections: true,
      sections: [{ id: randomUUID(), title: 'First', question_type: 'subjective', shuffle_questions: true,
        fixed_groups: [[a, b]], items: [ { id: a, question: question('Fixed 1') }, { id: b, question: question('Fixed 2') },
          ...childIds.map(source_question_id => ({ source_question_id })), { question: question('Loose') } ] },
      { id: randomUUID(), title: 'Second', question_type: 'subjective', items: [{ question: question('Other') }] }] }, 201);
    await request(`/papers/${paper.id}`, { merged_shuffle_sections: [paper.sections.map((s: { id: string }) => s.id)] }, 200, 'PUT');
    for (const seed of [1, 2, 3, 4]) {
      const session = await request('/sessions', { paper_id: paper.id, mode: 'practice', seed }, 201);
      const order = session.items.map((i: { question: { content: string } }) => i.question.content);
      expect(order.indexOf('Fixed 2')).toBe(order.indexOf('Fixed 1') + 1);
      expect(order.indexOf('Child 2')).toBe(order.indexOf('Child 1') + 1);
      expect(order).toHaveLength(6);
    }
  });
  it('deduplicates manual no-source requests and can review snapshots whose tags were removed', async () => {
    const tag = await request('/tags', { name: 'Temporary', target_type: 'question' }, 201);
    const paper = await request('/papers', { name: 'Inline', sections: [{ title: 'Manual', question_type: 'subjective', items: [{ question: {
      type: 'subjective', content: 'Manual', explanation: '', reference_answer: 'Reference', tag_ids: [tag.id] } }] }] }, 201);
    const session = await request('/sessions', { paper_id: paper.id, mode: 'practice' }, 201);
    const record = await request(`/sessions/${session.id}/submit-question`, { question_id: session.question_order[0], answer: { kind: 'text', value: 'Answer' } });
    const first = await request('/mistakes', { session_id: session.id, study_record_id: record.id }, 201);
    expect(first.source_question_id).toBeNull();
    expect((await request('/mistakes', { session_id: session.id, study_record_id: record.id }, 201)).id).toBe(first.id);
    expect(await request('/mistakes')).toHaveLength(1);
    await db.repositories.tags.delete(tag.id);
    const review = await request('/mistakes/create-paper', { ids: [first.id] }, 201);
    expect(review.sections[0].items[0].question.tag_ids).toEqual([]);
    expect((await request(`/mistakes/${first.id}`)).question_snapshot.tag_ids).toEqual([tag.id]);
  });
  it('supports manual subjective mistakes without auto grading', async () => {
    const { paper } = await setup('subjective');
    const session = await request('/sessions', { paper_id: paper.id, mode: 'practice' }, 201);
    const record = await request(`/sessions/${session.id}/submit-question`, { question_id: session.question_order[0], answer: { kind: 'text', value: 'My answer' } });
    expect(record.score).toBeNull(); expect(await request('/mistakes')).toHaveLength(0);
    const manual = await request('/mistakes', { session_id: session.id, study_record_id: record.id }, 201);
    expect(manual.wrong_count).toBe(1);
    await request('/mistakes', { session_id: session.id, study_record_id: record.id }, 201);
    expect((await request('/mistakes'))[0].wrong_count).toBe(1);
  });
});


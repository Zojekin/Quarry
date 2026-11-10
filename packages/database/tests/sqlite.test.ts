import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { createSqliteDatabase, initializeDatabase } from '../src/index.js';
import type { NewRow, SqliteDatabase } from '../src/index.js';

let database: SqliteDatabase;
const question = (id = 'q'): NewRow<'questions'> => ({
  id, bank_id: 'bank', paper_id: null, type: 'single_choice', stem: '**Question**',
  material_parent_id: null, options_json: '[{"id":"a","text":"A"}]',
  blanks_json: null, standard_answers_json: '["a"]', full_score: 2, score_mode: null,
});
const now = '2026-11-06T00:00:00.000Z';

beforeEach(async () => { database = await createSqliteDatabase(':memory:'); });
afterEach(async () => { await database.destroy(); });

async function seed() {
  const r = database.repositories;
  await r.folders.create({ id: 'folder', parent_id: null, name: 'Folder' });
  await r.questionBanks.create({ id: 'bank', folder_id: 'folder', name: 'Bank' });
  await r.papers.create({ id: 'paper', folder_id: 'folder', name: 'Paper', time_limit_seconds: null });
  await r.questions.create(question());
  return r;
}

describe('initialization and migrations', () => {
  it('enables foreign keys and initializes all eleven tables only once', async () => {
    expect((await sql<{ foreign_keys: number }>`PRAGMA foreign_keys`.execute(database.db)).rows[0]?.foreign_keys).toBe(1);
    // SQLite cannot use WAL for a pure in-memory database.
    expect((await sql<{ journal_mode: string }>`PRAGMA journal_mode`.execute(database.db)).rows[0]?.journal_mode).toBe('memory');
    const tables = await database.db.introspection.getTables();
    expect(tables.filter(table => !table.name.startsWith('kysely_'))).toHaveLength(11);
    await seed();
    await initializeDatabase(database.db);
    expect(await database.repositories.questions.list()).toHaveLength(1);
  });

  it('enables WAL on disk and preserves data when reopened', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'quarry-database-'));
    let disk: SqliteDatabase | undefined;
    try {
      const path = join(directory, 'test.sqlite');
      disk = await createSqliteDatabase(path);
      expect((await sql<{ journal_mode: string }>`PRAGMA journal_mode`.execute(disk.db)).rows[0]?.journal_mode).toBe('wal');
      expect((await sql<{ foreign_keys: number }>`PRAGMA foreign_keys`.execute(disk.db)).rows[0]?.foreign_keys).toBe(1);
      await disk.repositories.folders.create({ id: 'saved', name: 'Saved', parent_id: null });
      await disk.destroy();
      disk = undefined;
      disk = await createSqliteDatabase(path);
      expect(await disk.repositories.folders.findById('saved')).toMatchObject({ name: 'Saved' });
    } finally {
      await disk?.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('content repositories', () => {
  it('creates, reads, lists, updates and soft deletes folders, banks, papers and questions', async () => {
    const r = await seed();
    expect(await r.folders.create({ id: 'child', parent_id: 'folder', name: 'Child' })).toMatchObject({ parent_id: 'folder' });
    expect(await r.questions.findById('q')).toMatchObject({ version: 1, fixed_options_order: 0, options_json: question().options_json });
    expect(await r.papers.findById('paper')).toMatchObject({ follow_source: 0, full_score: 0, score_mode: 'all_or_nothing' });
    await r.questions.update('q', { stem: 'Edited', version: 2 });
    expect(await r.questions.findById('q')).toMatchObject({ stem: 'Edited', version: 2 });
    for (const [repository, id] of [[r.folders, 'folder'], [r.questionBanks, 'bank'], [r.papers, 'paper']] as const) {
      expect(await repository.findById(id)).toBeDefined();
      expect((await repository.list()).length).toBeGreaterThan(0);
      expect(await repository.update(id, { name: 'Renamed' })).toMatchObject({ name: 'Renamed' });
      expect(await repository.update(id, {})).toMatchObject({ name: 'Renamed' });
      expect(await repository.delete(id)).toBe(true);
      expect(await repository.delete(id)).toBe(false);
      expect(await repository.findById(id)).toBeUndefined();
      expect((await repository.list()).some(row => row.id === id)).toBe(false);
      expect(await repository.update(id, { name: 'Hidden' })).toBeUndefined();
    }
    expect(await r.questions.delete('q')).toBe(true);
    expect(await r.questions.findById('q')).toBeUndefined();
    expect(await r.questions.list()).toEqual([]);
    expect(await database.db.selectFrom('questions').select('is_deleted').where('id', '=', 'q').executeTakeFirst()).toEqual({ is_deleted: 1 });
  });

  it('enforces parent references, question ownership, valid JSON, enums and versions', async () => {
    const r = await seed();
    await expect(r.folders.create({ id: 'bad', parent_id: 'missing', name: 'Bad' })).rejects.toThrow();
    await expect(r.questions.create({ ...question('no-owner'), bank_id: null })).rejects.toThrow();
    await expect(r.questions.create({ ...question('two-owners'), paper_id: 'paper' })).rejects.toThrow();
    await expect(r.questions.create({ ...question('bad-json'), options_json: '{' })).rejects.toThrow();
    await expect(r.questions.update('q', { version: 0 })).rejects.toThrow();
    await expect(sql`UPDATE questions SET type = 'unknown' WHERE id = 'q'`.execute(database.db)).rejects.toThrow();
    expect(await r.questions.create({ ...question('direct'), bank_id: null, paper_id: 'paper' })).toMatchObject({ paper_id: 'paper' });
  });

  it('orders and removes paper items while retaining source identities', async () => {
    const r = await seed();
    await r.questions.create(question('q2'));
    const item = { paper_id: 'paper', source_question_id: 'q', source_version: 1, section_index: 0, section_name: 'Choice', group_id: null };
    await r.papers.addItem({ ...item, id: 'i2', question_id: 'q2', sort_order: 2 });
    await r.papers.addItem({ ...item, id: 'i1', question_id: 'q', sort_order: 1 });
    expect((await r.papers.listItems('paper')).map(row => row.id)).toEqual(['i1', 'i2']);
    await expect(r.papers.addItem({ ...item, id: 'dup', question_id: 'q', sort_order: 3 })).rejects.toThrow();
    expect(await r.papers.removeItem('i1')).toBe(true);
    expect(await r.papers.removeItem('i1')).toBe(false);
  });
});

describe('transactions', () => {
  it('commits multiple repositories and returns the callback result', async () => {
    expect(await database.withTransaction(async r => {
      await r.folders.create({ id: 'f', parent_id: null, name: 'F' });
      await r.questionBanks.create({ id: 'b', folder_id: 'f', name: 'B' });
      return 42;
    })).toBe(42);
    expect(await database.repositories.questionBanks.findById('b')).toBeDefined();
  });

  it('rolls back all writes on callback or constraint failure', async () => {
    await expect(database.withTransaction(async r => {
      await r.folders.create({ id: 'f', parent_id: null, name: 'F' });
      await r.questionBanks.create({ id: 'b', folder_id: 'f', name: 'B' });
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect(await database.repositories.folders.list()).toEqual([]);
    expect(await database.repositories.questionBanks.list()).toEqual([]);
    await expect(database.withTransaction(async r => {
      await r.folders.create({ id: 'f', parent_id: null, name: 'F' });
      await r.questionBanks.create({ id: 'b', folder_id: 'missing', name: 'B' });
    })).rejects.toThrow();
    expect(await database.repositories.folders.list()).toEqual([]);
  });
});

describe('dual tag isolation', () => {
  it('accepts file targets and question targets only in their own namespaces', async () => {
    const r = await seed();
    await r.tags.create({ id: 'file-tag', name: 'Shared name', target_type: 'file' });
    await r.tags.create({ id: 'question-tag', name: 'Shared name', target_type: 'question' });
    for (const target of ['folder', 'bank', 'paper']) {
      await r.tags.addRelation({ id: target, tag_id: 'file-tag', target_type: 'file', target_id: target });
    }
    await r.tags.addRelation({ id: 'question', tag_id: 'question-tag', target_type: 'question', target_id: 'q' });
    // Both namespace mismatch and lying about the actual target kind are rejected.
    for (const relation of [
      { tag_id: 'file-tag', target_type: 'question', target_id: 'q' },
      { tag_id: 'question-tag', target_type: 'file', target_id: 'folder' },
      { tag_id: 'file-tag', target_type: 'file', target_id: 'q' },
      { tag_id: 'question-tag', target_type: 'question', target_id: 'folder' },
      { tag_id: 'file-tag', target_type: 'file', target_id: 'missing' },
    ] as const) {
      await expect(r.tags.addRelation({ id: 'invalid', ...relation })).rejects.toThrow();
    }
    expect(await r.tags.listRelations('file-tag')).toHaveLength(3);
    expect(await r.tags.listRelations('question-tag')).toHaveLength(1);
    await expect(database.db.updateTable('tag_relations').set({ target_id: 'q' }).where('id', '=', 'folder').execute()).rejects.toThrow();
    await expect(r.tags.update('file-tag', { target_type: 'question' })).rejects.toThrow();
    expect(await r.tags.removeRelation('folder')).toBe(true);
    expect(await r.tags.removeRelation('folder')).toBe(false);
    expect(await r.tags.update('file-tag', { name: 'Renamed' })).toMatchObject({ name: 'Renamed' });
    expect(await r.tags.delete('file-tag')).toBe(true);
    expect(await r.tags.listRelations('file-tag')).toEqual([]);
    expect(await r.tags.list()).toHaveLength(1);
  });
});

describe('learning and attachment repositories', () => {
  it('stores sessions, ordered attempts, nullable grades and rejects duplicate completion', async () => {
    const r = await seed();
    await r.studySessions.create({ id: 'session', paper_id: 'paper', mode: 'practice', start_time: now, end_time: null });
    expect(await r.studySessions.findById('session')).toMatchObject({ status: 'in_progress', effective_duration_seconds: 0 });
    const answer = { session_id: 'session', question_id: 'q', user_answer_json: '["a"]', score: null, is_correct: null, answered_at: now };
    await r.studySessions.addRecord({ ...answer, id: 'a2', attempt_index: 2 });
    await r.studySessions.addRecord({ ...answer, id: 'a1', attempt_index: 1 });
    await expect(r.studySessions.addRecord({ ...answer, id: 'duplicate', attempt_index: 1 })).rejects.toThrow();
    expect((await r.studySessions.listRecords('session')).map(row => row.attempt_index)).toEqual([1, 2]);
    expect(await r.studySessions.update('session', { status: 'paused', effective_duration_seconds: 10 })).toMatchObject({ status: 'paused' });
    expect(await r.studySessions.list()).toHaveLength(1);
    // History keeps stable identities after permanent source deletion.
    await database.db.deleteFrom('questions').where('id', '=', 'q').execute();
    await database.db.deleteFrom('papers').where('id', '=', 'paper').execute();
    expect(await r.studySessions.listRecords('session')).toHaveLength(2);
    expect(await r.studySessions.delete('session')).toBe(true);
    expect(await r.studySessions.listRecords('session')).toEqual([]);
  });

  it('preserves versioned mistake snapshots independently of source content', async () => {
    const r = await seed();
    const mistake = { source_question_id: 'q', source_version: 1, question_snapshot_json: '{"stem":"Snapshot"}', last_user_answer_json: '[]', last_wrong_at: now };
    await r.mistakes.create({ ...mistake, id: 'm1' });
    await expect(r.mistakes.create({ ...mistake, id: 'duplicate' })).rejects.toThrow();
    await r.mistakes.create({ ...mistake, id: 'm2', source_version: 2 });
    for (const id of ['independent1', 'independent2']) {
      await r.mistakes.create({ ...mistake, id, source_question_id: null, source_version: null });
    }
    expect(await r.mistakes.update('m1', { mastery_status: 'mastered', wrong_count: 2 })).toMatchObject({ mastery_status: 'mastered', wrong_count: 2 });
    await database.db.deleteFrom('questions').where('id', '=', 'q').execute();
    expect(await r.mistakes.findById('m1')).toMatchObject({ source_question_id: 'q', question_snapshot_json: mistake.question_snapshot_json });
    expect(await r.mistakes.list()).toHaveLength(4);
    expect(await r.mistakes.delete('m1')).toBe(true);
    expect(await r.mistakes.findById('m1')).toBeUndefined();
  });

  it('deduplicates attachment hashes and supports metadata CRUD', async () => {
    const r = database.repositories.attachments;
    const attachment = { id: 'image', sha256: 'a'.repeat(64), filename: 'image.png', mime_type: 'image/png', file_size: 123 };
    await r.create(attachment);
    await expect(r.create({ ...attachment, id: 'duplicate' })).rejects.toThrow();
    expect(await r.findBySha256(attachment.sha256)).toMatchObject(attachment);
    expect(await r.update('image', { filename: 'renamed.png' })).toMatchObject({ filename: 'renamed.png' });
    expect(await r.findById('image')).toBeDefined();
    expect(await r.list()).toHaveLength(1);
    expect(await r.delete('image')).toBe(true);
    expect(await r.delete('image')).toBe(false);
    expect(await r.findBySha256(attachment.sha256)).toBeUndefined();
  });
});

it('persists Phase 1.5 defaults, draft state, colors and historical paper identity', async () => {
  const r = await seed();
  expect(await r.tags.create({ id: 'colored', name: 'Color', target_type: 'file', color: '#123456' })).toMatchObject({ color: '#123456' });
  expect(await r.tags.update('colored', { color: null })).toMatchObject({ color: null });
  expect(await r.studySessions.create({ id: 'draft', paper_id: 'paper', mode: 'practice', start_time: now, end_time: null }))
    .toMatchObject({ current_index: 0, draft_answers_json: null });
  await r.studySessions.update('draft', { current_index: 2, draft_answers_json: '{"q":{"kind":"text","value":"draft"}}' });
  await initializeDatabase(database.db);
  expect(await r.studySessions.findById('draft')).toMatchObject({ current_index: 2 });
  await r.studySessions.addRecord({ id: 'historical', session_id: 'draft', question_id: 'q', attempt_index: 1,
    user_answer_json: '{}', score: null, is_correct: null, answered_at: now, source_paper_id: 'paper', source_paper_name: 'Original' });
  await database.db.deleteFrom('papers').where('id', '=', 'paper').execute();
  expect((await r.studySessions.listRecords('draft'))[0]).toMatchObject({ source_paper_id: 'paper', source_paper_name: 'Original' });
});

it('upgrades existing study history using the session paper snapshot rather than live paper names', async () => {
  const r = await seed();
  await r.studySessions.create({ id: 'legacy-session', paper_id: 'paper', mode: 'practice', start_time: now, end_time: null,
    state_json: JSON.stringify({ paper: { id: 'paper', name: 'Historical name', folder_id: 'folder' } }) });
  await r.studySessions.addRecord({ id: 'legacy-record', session_id: 'legacy-session', question_id: 'q', attempt_index: 1,
    user_answer_json: '{}', score: 0, is_correct: 0, answered_at: now });
  await r.mistakes.create({ id: 'legacy-mistake', source_question_id: 'q', source_version: 1,
    question_snapshot_json: '{}', last_user_answer_json: '{}', last_wrong_at: now,
    history_json: JSON.stringify([{ study_record_id: 'legacy-record' }]) });
  for (const table of ['study_records', 'mistake_records']) for (const column of ['source_paper_id', 'source_paper_name', 'source_folder_id'])
    await sql.raw(`ALTER TABLE ${table} DROP COLUMN ${column}`).execute(database.db);
  await sql`ALTER TABLE tags DROP COLUMN color`.execute(database.db);
  await sql`ALTER TABLE study_sessions DROP COLUMN current_index`.execute(database.db);
  await sql`ALTER TABLE study_sessions DROP COLUMN draft_answers_json`.execute(database.db);
  await sql`DELETE FROM kysely_migration WHERE name = '005_phase_1_5'`.execute(database.db);
  await r.papers.update('paper', { name: 'Renamed later' });
  await initializeDatabase(database.db);
  expect((await r.studySessions.listRecords('legacy-session'))[0]).toMatchObject({ source_paper_name: 'Historical name' });
  expect(await r.mistakes.findById('legacy-mistake')).toMatchObject({ source_paper_id: 'paper', source_paper_name: 'Historical name' });
});

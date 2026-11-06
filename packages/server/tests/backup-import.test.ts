import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createSqliteDatabase, SqliteSnapshotRepository } from '@quarry/database';
import type { SqliteDatabase } from '@quarry/database';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createQuarryServer } from '../src/app.js';
import { BackupService } from '../src/services/backup.service.js';
import { LocalAttachmentStorage } from '../src/services/attachment.service.js';

let database: SqliteDatabase;
let directory: string;
let service: BackupService;
let app: ReturnType<typeof createQuarryServer>;
beforeEach(async () => {
  database = await createSqliteDatabase(':memory:'); directory = await mkdtemp(join(tmpdir(), 'quarry-backup-'));
  service = new BackupService(database.repositories, database.withTransaction, new SqliteSnapshotRepository(database.db),
    new LocalAttachmentStorage(join(directory, 'attachments')), join(directory, 'recovery'));
  app = createQuarryServer({ db: database.db, attachmentsDir: join(directory, 'attachments') });
});
afterEach(async () => { await database.destroy(); await rm(directory, { recursive: true, force: true }); });
function document() {
  return { version: 1, entity: 'bank', name: 'Imported', questions: [1, 2].map(index => ({ id: randomUUID(), version: 1,
    owner_type: 'question_bank', owner_id: randomUUID(), type: 'subjective', content: `Question ${index}`, reference_answer: 'Answer' })) };
}
it('rejects the entire file with the second question precise line and leaves all tables unchanged', async () => {
  const input = document(); input.questions[1]!.content = '';
  const content = JSON.stringify(input, null, 2);
  const expectedLine = content.slice(0, content.indexOf('"content": ""')).split('\n').length;
  for (const endpoint of ['preview', 'commit']) {
    const response = await app.request(`/api/import/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', content }) });
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ line: expectedLine })]));
  }
  expect(await database.repositories.questionBanks.list()).toHaveLength(0);
  expect(await database.repositories.questions.list()).toHaveLength(0);
});
it('rejects invalid references, unknown properties and JSON syntax, with no partial writes', async () => {
  const input = document();
  for (const content of [JSON.stringify({ ...input, bogus: true }), '{\n"version": !}',
    JSON.stringify({ ...input, questions: [{ ...input.questions[0], tag_ids: [randomUUID()] }] })]) {
    await expect(service.commit(content, 'json')).rejects.toMatchObject({ code: 'IMPORT_FAILED' });
  }
  expect(await database.repositories.questions.list()).toHaveLength(0);
});
it('roundtrips documented Markdown and JSON templates without overwriting existing content', async () => {
  const imported = await service.commit(JSON.stringify(document()), 'json');
  for (const format of ['json', 'markdown', 'quarry']) {
    const exported = await service.export('bank', imported.id, format);
    if (format === 'quarry') await service.importArchive(exported.bytes, true);
    else await service.commit(strFromU8(exported.bytes), format);
  }
  expect(await database.repositories.questionBanks.list()).toHaveLength(4);
  expect(await database.repositories.questions.list()).toHaveLength(8);
});
it('exports and imports .quarry attachment bytes through multipart routes', async () => {
  const form = new FormData(); form.set('file', new File(['picture'], 'image.png', { type: 'image/png' }));
  const upload = await app.request('/api/attachments', { method: 'POST', body: form });
  const { url, ...attachment } = (await upload.json()).data;
  const input = document(); input.questions[0]!.content = `![image](attachment://${attachment.id})`;
  const withAttachment = { ...input, attachments: [attachment] };
  const imported = await service.commit(JSON.stringify(withAttachment), 'json');
  const exported = await app.request(`/api/export/bank/${imported.id}?format=quarry`);
  expect(exported.headers.get('content-disposition')).toContain('.quarry');
  const bytes = new Uint8Array(await exported.arrayBuffer());
  expect(strFromU8(unzipSync(bytes)[`attachments/${attachment.sha256}`]!)).toBe('picture');
  const corrupt = unzipSync(bytes); delete corrupt[`attachments/${attachment.sha256}`];
  for (const commit of [false, true]) await expect(service.importArchive(zipSync(corrupt), commit))
    .rejects.toMatchObject({ code: 'IMPORT_FAILED' });
  await new LocalAttachmentStorage(join(directory, 'attachments')).delete(attachment.sha256);
  const archiveForm = new FormData(); archiveForm.set('file', new File([bytes], 'content.quarry'));
  const response = await app.request('/api/import/commit', { method: 'POST', body: archiveForm });
  expect(response.status, await response.text()).toBe(201);
  const read = await app.request(`/api/attachments/${attachment.id}`);
  expect(await read.text()).toBe('picture');
});
it('roundtrips paper settings, order and fixed groups', async () => {
  const request = async (path: string, input: unknown) => {
    const response = await app.request(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const data = await response.json(); expect(response.status, JSON.stringify(data)).toBe(201); return data.data;
  };
  const sectionId = randomUUID(); const itemIds = [randomUUID(), randomUUID()];
  const paper = await request('papers', { name: 'Exam', shuffle_options: true, full_score: 20, time_limit_seconds: 90,
    sections: [{ id: sectionId, title: 'Section', question_type: 'subjective', shuffle_questions: true,
      fixed_groups: [itemIds], items: itemIds.map((id, index) => ({ id, question: { type: 'subjective', content: `Item ${index}`, reference_answer: 'A' } })) }] });
  const exported = await service.export('paper', paper.id, 'json');
  const imported = await service.commit(strFromU8(exported.bytes), 'json');
  const response = await app.request(`/api/papers/${imported.id}`); const result = (await response.json()).data;
  expect(result).toMatchObject({ shuffle_options: true, time_limit_seconds: 90, full_score: 20 });
  expect(result.sections[0].fixed_groups[0]).toEqual(result.sections[0].items.map((item: { id: string }) => item.id));
  expect(result.sections[0].items.map((item: { question: { content: string } }) => item.question.content)).toEqual(['Item 0', 'Item 1']);
});
it('backs up soft deleted content and replaces the full database while keeping a recovery archive', async () => {
  const first = await service.commit(JSON.stringify(document()), 'json');
  await database.repositories.questionBanks.delete(first.id);
  const archive = await service.create();
  await service.commit(JSON.stringify(document()), 'json');
  const result = await service.restore(archive);
  expect(result.recovery_point_id).toBeTruthy();
  expect(await readdir(join(directory, 'recovery'))).toHaveLength(1);
  expect(await database.repositories.questionBanks.list()).toHaveLength(0);
  const snapshot = await new SqliteSnapshotRepository(database.db).capture();
  expect(snapshot.question_banks).toHaveLength(1);
  expect(snapshot.question_banks![0]!.is_deleted).toBe(1);
});
it('rolls back database and partially uploaded files on attachment write failure', async () => {
  await service.commit(JSON.stringify(document()), 'json');
  const before = await new SqliteSnapshotRepository(database.db).capture();
  const files = unzipSync(await service.create());
  const snapshot = JSON.parse(strFromU8(files['database.json']!));
  snapshot.question_banks = []; snapshot.questions = [];
  const blobs = [strToU8('first'), strToU8('second')];
  snapshot.attachments = blobs.map((bytes, index) => {
    const sha256 = createHash('sha256').update(bytes).digest('hex'); files[`attachments/${sha256}`] = bytes;
    return { id: randomUUID(), sha256, filename: `${index}.txt`, mime_type: 'text/plain', file_size: bytes.length, created_at: new Date().toISOString() };
  });
  files['database.json'] = strToU8(JSON.stringify(snapshot));
  files['manifest.json'] = strToU8(JSON.stringify({ format: 'quarry-backup', version: 1, created_at: new Date().toISOString(),
    checksums: Object.fromEntries(Object.entries(files).filter(([name]) => name !== 'manifest.json').map(([name, data]) => [name, createHash('sha256').update(data).digest('hex')])) }));
  const storage = new LocalAttachmentStorage(join(directory, 'attachments')); let uploads = 0;
  const failing = new BackupService(database.repositories, database.withTransaction, new SqliteSnapshotRepository(database.db), {
    exists: hash => storage.exists(hash), readStream: hash => storage.readStream(hash), delete: hash => storage.delete(hash),
    upload: async (hash, data) => { await storage.upload(hash, data); if (++uploads === 2) throw new Error('Disk full'); },
  }, join(directory, 'recovery'));
  await expect(failing.restore(zipSync(files))).rejects.toMatchObject({ code: 'STORAGE_ERROR' });
  expect(await new SqliteSnapshotRepository(database.db).capture()).toEqual(before);
  expect(await readdir(join(directory, 'attachments'))).toEqual([]);
  expect(await readdir(join(directory, 'recovery'))).toHaveLength(1);
});
it('rejects corrupt backup checksums before replacing current data', async () => {
  await service.commit(JSON.stringify(document()), 'json');
  const files = unzipSync(await service.create()); files['database.json'] = strToU8('{}');
  await expect(service.restore(zipSync(files))).rejects.toMatchObject({ code: 'IMPORT_FAILED' });
  expect(await database.repositories.questionBanks.list()).toHaveLength(1);
});

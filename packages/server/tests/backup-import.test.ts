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
it('commits JSON and multipart Markdown into the requested folder', async () => {
  const folder = await database.repositories.folders.create({ id: randomUUID(), name: 'Destination', parent_id: null });
  const content = JSON.stringify(document());
  const markdown = new FormData();
  markdown.set('file', new File(['# Quarry\n\n```json\n' + content + '\n```\n'], 'questions.MD'));
  markdown.set('folder_id', folder.id);
  const requests = [
    { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'json', content, folder_id: folder.id }) },
    { body: markdown },
  ];
  for (const request of requests) {
    const response = await app.request('/api/import/commit', { method: 'POST', ...request });
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(201);
    expect(result.data).toMatchObject({ name: 'Imported', entity: 'bank', imported_count: 2 });
    expect(await database.repositories.questionBanks.findById(result.data.id)).toMatchObject({ folder_id: folder.id });
  }
});
it.each([undefined, '', null])('commits to the root when folder_id is %s', async folder_id => {
  const response = await app.request('/api/import/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'json', content: JSON.stringify(document()), folder_id }) });
  expect(response.status).toBe(201);
  const { data } = await response.json();
  expect(await database.repositories.questionBanks.findById(data.id)).toMatchObject({ folder_id: null });
});
it('rejects malformed, missing and deleted import targets without writing content', async () => {
  const repositories = database.repositories;
  const deleted = await repositories.folders.create({ id: randomUUID(), name: 'Deleted', parent_id: null });
  await repositories.folders.delete(deleted.id);
  const content = JSON.stringify(document());
  const archive = zipSync({ 'content.json': strToU8(content) });
  for (const [folderId, status] of [['malformed', 400], [randomUUID(), 404], [deleted.id, 404]] as const) {
    const response = await app.request('/api/import/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'json', content, folder_id: folderId }) });
    expect(response.status).toBe(status);
    const form = new FormData();
    form.set('file', new File([archive], 'questions.quarry'));
    form.set('folder_id', folderId);
    expect((await app.request('/api/import/commit', { method: 'POST', body: form })).status).toBe(status);
  }
  expect(await repositories.questionBanks.list()).toEqual([]);
  expect(await repositories.questions.list()).toEqual([]);
});
it.each(['bank', 'paper'] as const)('commits a single %s archive into the requested folder', async entity => {
  const repositories = database.repositories;
  const folder = await repositories.folders.create({ id: randomUUID(), name: 'Destination', parent_id: null });
  const original = await service.commit(JSON.stringify({ ...document(), entity }), 'json');
  const exported = await service.export(entity, original.id, 'quarry');
  const form = new FormData();
  form.set('file', new File([Buffer.from(exported.bytes)], 'questions.quarry'));
  form.set('folder_id', folder.id);
  const response = await app.request('/api/import/commit', { method: 'POST', body: form });
  const result = await response.json();
  expect(response.status, JSON.stringify(result)).toBe(201);
  expect(result.data).toMatchObject({ name: 'Imported', entity, imported_count: 2 });
  const repository = entity === 'bank' ? repositories.questionBanks : repositories.papers;
  expect(await repository.findById(result.data.id)).toMatchObject({ folder_id: folder.id });
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

it('exports only the folder subtree with file tags, portable contents and referenced attachments', async () => {
  const r = database.repositories;
  const root = randomUUID(), child = randomUUID(), outside = randomUUID();
  await r.folders.create({ id: root, parent_id: null, name: 'Root' });
  await r.folders.create({ id: child, parent_id: root, name: 'Child' });
  await r.folders.create({ id: outside, parent_id: null, name: 'Outside' });
  const form = new FormData(); form.set('file', new File(['folder-picture'], 'folder.png', { type: 'image/png' }));
  const attachment = (await (await app.request('/api/attachments', { method: 'POST', body: form })).json()).data;
  const input = document(); input.questions[0]!.content = `attachment://${attachment.id}`;
  const { url, ...metadata } = attachment;
  const bank = await service.commit(JSON.stringify({ ...input, attachments: [metadata] }), 'json');
  await r.questionBanks.update(bank.id, { folder_id: child });
  const excluded = await service.commit(JSON.stringify(document()), 'json');
  await r.questionBanks.update(excluded.id, { folder_id: outside });
  const paperResponse = await app.request('/api/papers', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Nested paper', folder_id: root }) });
  const paper = (await paperResponse.json()).data;
  const tag = await r.tags.create({ id: randomUUID(), name: 'Folder tag', target_type: 'file', color: '#abcdef' });
  await r.tags.addRelation({ id: randomUUID(), tag_id: tag.id, target_type: 'file', target_id: child });
  const response = await app.request(`/api/export/folder/${root}`);
  expect(response.status).toBe(200); expect(response.headers.get('content-disposition')).toContain('.quarry');
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const tree = JSON.parse(strFromU8(files['content.json']!));
  expect(tree).toMatchObject({ version: 1, entity: 'folder', root_id: root });
  expect(tree.folders.map((f: { id: string }) => f.id).sort()).toEqual([root, child].sort());
  expect(tree.banks.map((b: { id: string }) => b.id)).toEqual([bank.id]);
  expect(tree.papers.map((p: { id: string }) => p.id)).toEqual([paper.id]);
  expect(tree.tags[0]).toMatchObject({ color: '#abcdef' });
  expect(tree).not.toHaveProperty('study_records');
  expect(strFromU8(files[`attachments/${attachment.sha256}`]!)).toBe('folder-picture');
  expect(service.preview(strFromU8(files[`contents/${bank.id}.json`]!), 'json').questions).toHaveLength(2);
  expect(files[`contents/${excluded.id}.json`]).toBeUndefined();
  expect(JSON.parse(strFromU8(files['manifest.json']!)).format).toBe('quarry-folder');
  expect((await app.request(`/api/export/folder/${randomUUID()}`)).status).toBe(404);
});

it('previews and imports a verified folder archive under the requested folder', async () => {
  const r = database.repositories;
  const root = await r.folders.create({ id: randomUUID(), name: 'Root', parent_id: null });
  const child = await r.folders.create({ id: randomUUID(), name: 'Nested', parent_id: root.id });
  const fileTag = await r.tags.create({ id: randomUUID(), name: 'Files', target_type: 'file', color: '#aabbcc' });
  await r.tags.addRelation({ id: randomUUID(), tag_id: fileTag.id, target_type: 'file', target_id: child.id });
  const form = new FormData();
  form.set('file', new File(['folder-image'], 'image.png', { type: 'image/png' }));
  const { url, ...image } = (await (await app.request('/api/attachments', { method: 'POST', body: form })).json()).data;
  const questionTag = { id: randomUUID(), name: 'Questions', target_type: 'question', color: '#abc123' };
  const input = document();
  const bank = await service.commit(JSON.stringify({ ...input, tags: [questionTag], questions: [
    { ...input.questions[0], content: '![image](http://127.0.0.1:49111/api/attachments/' + image.id + ')',
      tag_ids: [questionTag.id] },
  ] }), 'json');
  await r.questionBanks.update(bank.id, { folder_id: child.id });
  const paper = await service.commit(JSON.stringify({ ...document(), entity: 'paper', name: 'Review' }), 'json');
  const source = (await r.questions.list()).find(question => question.bank_id === bank.id)!;
  const linked = await app.request('/api/papers/' + paper.id + '/items', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_question_id: source.id }) });
  expect(linked.status).toBe(201);
  await r.papers.update(paper.id, { folder_id: root.id, time_limit_seconds: 90, follow_source: 1 });
  const { bytes } = await service.export('folder', root.id, 'quarry');
  const target = await createSqliteDatabase(':memory:');
  try {
    const storage = new LocalAttachmentStorage(join(directory, 'target'));
    const importer = new BackupService(target.repositories, target.withTransaction, new SqliteSnapshotRepository(target.db), storage);
    const files = unzipSync(bytes);
    files['attachments/' + image.sha256] = strToU8('tampered');
    for (const commit of [false, true])
      await expect(importer.importArchive(zipSync(files), commit)).rejects.toMatchObject({ code: 'IMPORT_FAILED' });
    expect(await importer.importArchive(bytes, false)).toEqual({ entity: 'folder', name: 'Root',
      summary: { folders: 2, banks: 1, papers: 1, questions: 4, attachments: 1 } });
    expect(await target.repositories.folders.list()).toEqual([]);
    const failing = new BackupService(target.repositories, target.withTransaction, new SqliteSnapshotRepository(target.db), {
      exists: sha => storage.exists(sha), readStream: sha => storage.readStream(sha), delete: sha => storage.delete(sha),
      upload: async (sha, data) => { await storage.upload(sha, data); throw new Error('Write failed'); },
    });
    await expect(failing.importArchive(bytes, true)).rejects.toThrow('Write failed');
    expect(await target.repositories.folders.list()).toEqual([]);
    expect(await target.repositories.attachments.list()).toEqual([]);
    expect(await storage.exists(image.sha256)).toBe(false);
    const destination = await target.repositories.folders.create({ id: randomUUID(), name: 'Destination', parent_id: null });
    const archiveForm = new FormData();
    archiveForm.set('file', new File([Buffer.from(bytes)], 'folder.quarry'));
    archiveForm.set('folder_id', destination.id);
    const targetApp = createQuarryServer({ db: target.db, attachmentStorage: storage });
    const response = await targetApp.request('/api/import/commit', { method: 'POST', body: archiveForm });
    const { data: imported, error } = await response.json();
    expect(response.status, JSON.stringify(error)).toBe(201);
    expect(imported).toMatchObject({ name: 'Root', entity: 'folder', imported_count: 4 });
    expect(imported).toHaveProperty('id');
    const folders = await target.repositories.folders.list();
    const importedRoot = folders.find(folder => folder.name === 'Root')!;
    const nested = folders.find(folder => folder.name === 'Nested')!;
    expect(imported).toHaveProperty('id', importedRoot.id);
    expect(importedRoot.id).not.toBe(root.id);
    expect(importedRoot.parent_id).toBe(destination.id);
    expect(nested.parent_id).toBe(importedRoot.id);
    const [importedBank] = await target.repositories.questionBanks.list();
    expect(importedBank?.folder_id).toBe(nested.id);
    const [importedPaper] = await target.repositories.papers.list();
    expect(importedPaper).toMatchObject({ name: 'Review', folder_id: importedRoot.id, time_limit_seconds: 90, follow_source: 1 });
    const importedItems = await target.repositories.papers.listItems(importedPaper!.id);
    expect(importedItems).toHaveLength(3);
    const tags = await target.repositories.tags.list();
    const restoredFileTag = tags.find(tag => tag.name === 'Files')!;
    expect(restoredFileTag).toMatchObject({ color: '#aabbcc', target_type: 'file' });
    expect(await target.repositories.tags.listRelations(restoredFileTag.id)).toMatchObject([{ target_id: nested.id }]);
    const restoredQuestionTag = tags.find(tag => tag.name === 'Questions')!;
    const restoredQuestion = (await target.repositories.questions.list()).find(question => question.bank_id === importedBank!.id)!;
    expect(restoredQuestion.stem).toBe('![image](attachment://' + image.id + ')');
    expect(importedItems).toContainEqual(expect.objectContaining({ source_question_id: restoredQuestion.id, source_version: source.version }));
    const questionRelations = await target.repositories.tags.listRelations(restoredQuestionTag.id);
    expect(questionRelations).toHaveLength(2);
    expect(questionRelations).toContainEqual(expect.objectContaining({ target_id: restoredQuestion.id }));
    expect(await new Response(await storage.readStream(image.sha256)).text()).toBe('folder-image');
  } finally {
    await target.destroy();
  }
});

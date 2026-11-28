import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import type { DatabaseSnapshot, ISnapshotRepository, ITransactionRunner, Repositories } from '@quarry/database';
import { AppError, ErrorCode, ContentDocumentSchema, validateContentReferences, ScoreMode } from '@quarry/shared';
import type { ContentDocument } from '@quarry/shared';
import type { IAttachmentStorage } from './attachment.service.js';
import type { QuestionView } from './question.service.js';
import { QuestionService } from './question.service.js';
import { PaperService } from './paper.service.js';
import { found, invalid } from './common.js';
import { readFolderArchive } from './folder-archive.js';

type Files = Record<string, Uint8Array>;
function hash(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex'); }
/** Locate parsed JSON paths without confusing repeated field names in different questions. */
function jsonLocations(source: string): Map<string, number> {
  const locations = new Map<string, number>(); let cursor = 0;
  const whitespace = () => { while (/\s/.test(source[cursor] ?? '') && cursor < source.length) cursor++; };
  const string = () => {
    const start = cursor++;
    while (cursor < source.length) { const char = source[cursor++]; if (char === '\\') cursor++; else if (char === '"') break; }
    return JSON.parse(source.slice(start, cursor)) as string;
  };
  const visit = (path: (string | number)[]) => {
    whitespace(); locations.set(JSON.stringify(path), cursor);
    if (source[cursor] === '{') {
      cursor++; whitespace();
      while (source[cursor] !== '}') {
        const key = string(); whitespace(); cursor++; visit([...path, key]); whitespace();
        if (source[cursor] !== ',') break; cursor++; whitespace();
      }
      cursor++;
    } else if (source[cursor] === '[') {
      cursor++; whitespace(); let index = 0;
      while (source[cursor] !== ']') {
        visit([...path, index++]); whitespace(); if (source[cursor] !== ',') break; cursor++; whitespace();
      }
      cursor++;
    } else if (source[cursor] === '"') string();
    else while (cursor < source.length && !/[\s,}\]]/.test(source[cursor]!)) cursor++;
  };
  visit([]); return locations;
}
function reject(details: unknown): never { throw new AppError(ErrorCode.ImportFailed, 'Import rejected; no data was written', details); }
function unpack(bytes: Uint8Array): Files {
  let files: Files;
  try { files = unzipSync(bytes); } catch { return reject([{ line: 1, message: 'Invalid ZIP archive' }]); }
  if (Object.keys(files).some(name => name.includes('..') || name.includes('\\') || name.startsWith('/')))
    reject([{ line: 1, message: 'Unsafe archive path' }]);
  return files;
}

function verifyArchiveAttachments(document: ContentDocument, files: Files) {
  for (const attachment of document.attachments) {
    const data = files['attachments/' + attachment.sha256];
    if (!data || hash(data) !== attachment.sha256 || data.length !== attachment.file_size)
      reject([{ line: 1, path: 'attachments', message: 'Missing or corrupt attachment: ' + attachment.id }]);
  }
}

async function restoreTags(repositories: Repositories, tags: ContentDocument['tags']) {
  const ids = new Map<string, string>();
  const existing = await repositories.tags.list();
  for (const tag of tags) {
    let target = existing.find(entry => entry.name === tag.name && entry.target_type === tag.target_type);
    if (!target) {
      target = await repositories.tags.create({ ...tag, id: randomUUID() });
      existing.push(target);
    }
    ids.set(tag.id, target.id);
  }
  return ids;
}

async function restoreDocument(repositories: Repositories, document: ContentDocument,
  folderId: string | null, attachmentIds: Map<string, string>) {
  const tagIds = await restoreTags(repositories, document.tags);
  const id = randomUUID();
  const owner = { id, folder_id: folderId, name: document.name, description: document.description };
  if (document.entity === 'bank') await repositories.questionBanks.create(owner);
  else await repositories.papers.create({ ...owner, time_limit_seconds: null });
  const questionIds = new Map(document.questions.map(question => [question.id, randomUUID()]));
  const itemIds = new Map<string, string>();
  const pending = [...document.questions];
  const service = new QuestionService(repositories);
  while (pending.length) {
    const index = pending.findIndex(question => !question.material_parent_id ||
      !pending.some(parent => parent.id === question.material_parent_id));
    const question = pending.splice(index, 1)[0]!;
    const content = JSON.parse(JSON.stringify(question).replace(/attachment:\/\/([a-f0-9-]{36})/gi,
      (url, attachmentId: string) => 'attachment://' + (attachmentIds.get(attachmentId) ?? attachmentId))) as typeof question;
    await service.save({ ...content, id: questionIds.get(question.id), owner_type: document.entity === 'bank' ? 'question_bank' : 'paper',
      owner_id: id, tag_ids: question.tag_ids.map(tag => tagIds.get(tag)),
      material_parent_id: question.material_parent_id ? questionIds.get(question.material_parent_id) : null });
  }
  if (document.entity === 'paper') {
    const paper = new PaperService(repositories);
    if (document.paper) {
      const sectionIds = new Map(document.paper.sections.map(section => [section.id, randomUUID()]));
      for (const section of document.paper.sections)
        for (const item of section.items) itemIds.set(item.id, randomUUID());
      await paper.save({ ...document.paper,
        merged_shuffle_sections: document.paper.merged_shuffle_sections.map(group => group.map(id => sectionIds.get(id))),
        sections: document.paper.sections.map(section => ({ ...section, id: sectionIds.get(section.id),
          fixed_groups: section.fixed_groups.map(group => group.map(id => itemIds.get(id))),
          items: section.items.map(item => ({ id: itemIds.get(item.id), question_id: questionIds.get(item.question_id) })) })),
      }, id);
    } else for (const question of document.questions) await paper.addItem(id, { question_id: questionIds.get(question.id) });
  }
  return { id, questionIds, itemIds };
}

export class BackupService {
  constructor(readonly repositories: Repositories, private readonly transaction: ITransactionRunner['withTransaction'],
    private readonly snapshots: ISnapshotRepository, private readonly storage?: IAttachmentStorage,
    private readonly recoveryDirectory = join(tmpdir(), 'quarry-recovery')) {}

  preview(content: string, format: string): ContentDocument {
    let source = content;
    let offset = 0;
    if (format === 'markdown' || format === 'md') {
      const match = /^# Quarry\s*\r?\n\s*```json\r?\n([\s\S]*?)\r?\n```\s*$/.exec(content);
      if (!match) reject([{ line: 1, message: 'Expected # Quarry followed by one fenced JSON document' }]);
      source = match[1]!; offset = content.slice(0, content.indexOf(source)).split('\n').length - 1;
    } else if (format !== 'json') invalid('Unsupported import format');
    let value: unknown;
    try { value = JSON.parse(source); } catch (error) {
      const position = /position (\d+)/.exec(String(error));
      const line = /line (\d+)/.exec(String(error));
      reject([{ line: offset + (line ? Number(line[1]) : source.slice(0, Number(position?.[1] ?? 0)).split('\n').length),
        message: String(error) }]);
    }
    const locations = jsonLocations(source);
    const result = ContentDocumentSchema.safeParse(value);
    if (!result.success) reject(result.error.issues.map(issue => {
      const path = [...issue.path];
      while (path.length && !locations.has(JSON.stringify(path))) path.pop();
      const index = locations.get(JSON.stringify(path)) ?? 0;
      return { line: offset + source.slice(0, Math.max(0, index)).split('\n').length,
        path: issue.path.join('.'), message: issue.message };
    }));
    const document = result.data;
    const referenceError = (path: (string | number)[], message: string): never => {
      const originalPath = [...path];
      while (path.length && !locations.has(JSON.stringify(path))) path.pop();
      const position = locations.get(JSON.stringify(path)) ?? 0;
      return reject([{ line: offset + source.slice(0, position).split('\n').length, path: originalPath.join('.'), message }]);
    };
    validateContentReferences(document, referenceError);
    return document;
  }
  async commit(content: string, format: string, folderId: string | null = null) {
    return this.commitDocument(this.preview(content, format), {}, folderId);
  }
  private commitDocument(document: ContentDocument, files: Files, folderId: string | null) {
    return this.commitImport([document], files, folderId, async (repositories, attachmentIds) => ({
      id: (await restoreDocument(repositories, document, folderId, attachmentIds)).id,
      name: document.name, entity: document.entity, imported_count: document.questions.length,
    }));
  }
  private commitImport<T>(documents: ContentDocument[], files: Files, folderId: string | null,
    write: (repositories: Repositories, attachmentIds: Map<string, string>) => Promise<T>) {
    return this.transaction(async repositories => {
      if (folderId !== null && !(await repositories.folders.findById(folderId)))
        throw new AppError(ErrorCode.NotFound, 'Import target folder not found');
      const uploaded = new Set<string>();
      const ids = new Map<string, string>();
      try {
        for (const attachment of documents.flatMap(document => document.attachments)) {
          if (ids.has(attachment.id)) continue;
          const { sha256 } = attachment;
          const bytes = files['attachments/' + sha256];
          const exists = await this.storage?.exists(sha256);
          if (!bytes && !exists) reject([{ line: 1, message: 'Missing attachment data' }]);
          if (bytes && (hash(bytes) !== sha256 || bytes.length !== attachment.file_size))
            reject([{ line: 1, message: 'Attachment checksum mismatch' }]);
          const existing = await repositories.attachments.findBySha256(sha256);
          const collision = !existing && await repositories.attachments.findById(attachment.id);
          const id = existing?.id ?? (collision ? randomUUID() : attachment.id);
          ids.set(attachment.id, id);
          if (!existing) await repositories.attachments.create({ ...attachment, id });
          if (!exists) {
            if (!this.storage) invalid('Attachment storage is not configured');
            uploaded.add(sha256);
            await this.storage.upload(sha256, bytes!);
          }
        }
        return await write(repositories, ids);
      } catch (error) {
        await Promise.allSettled([...uploaded].map(sha256 => this.storage?.delete(sha256)));
        throw error;
      }
    });
  }
  async importArchive(bytes: Uint8Array, commit: boolean, folderId: string | null = null) {
    const files = unpack(bytes);
    if (!files['content.json']) reject([{ line: 1, message: 'Missing content.json' }]);
    if (files['manifest.json']) {
      let archive: ReturnType<typeof readFolderArchive>;
      try {
        archive = readFolderArchive(files, hash, data => {
          const document = this.preview(strFromU8(data), 'json');
          verifyArchiveAttachments(document, files);
          return document;
        });
      } catch (error) {
        if (error instanceof AppError) throw error;
        return reject([{ line: 1, message: 'Invalid folder archive: ' + String(error) }]);
      }
      if (!commit) return archive.preview;
      return this.commitImport(archive.contents.map(entry => entry.document), files, folderId, async (repositories, attachmentIds) => {
        const targets = new Map<string, string>();
        for (const folder of archive.folders) {
          const id = randomUUID();
          await repositories.folders.create({ id, name: folder.name,
            parent_id: folder.parent_id ? targets.get(folder.parent_id)! : folderId });
          targets.set(folder.id, id);
        }
        const bankQuestions = new Map<string, string>();
        const paperItems = new Map<string, Map<string, string>>();
        for (const { owner, document } of archive.contents) {
          const restored = await restoreDocument(repositories, document, targets.get(owner.folder_id)!, attachmentIds);
          targets.set(owner.id, restored.id);
          if (document.entity === 'bank')
            for (const [original, id] of restored.questionIds) bankQuestions.set(original, id);
          else paperItems.set(owner.id, restored.itemIds);
        }
        for (const link of archive.sourceLinks) {
          await repositories.papers.updateItem(paperItems.get(link.paper_id)!.get(link.item_id)!, {
            source_question_id: bankQuestions.get(link.source_question_id)!, source_version: link.source_version,
          });
        }
        for (const paper of archive.papers) {
          if (paper.follow_source) await repositories.papers.update(targets.get(paper.id)!, { follow_source: 1 });
        }
        const tagIds = await restoreTags(repositories, archive.tags);
        for (const relation of archive.relations) {
          const tag_id = tagIds.get(relation.tag_id)!;
          const target_id = targets.get(relation.target_id)!;
          if (!(await repositories.tags.listRelations(tag_id)).some(entry => entry.target_id === target_id))
            await repositories.tags.addRelation({ id: randomUUID(), tag_id, target_id, target_type: 'file' });
        }
        return { id: targets.get(archive.folders[0]!.id)!, name: archive.preview.name, entity: 'folder' as const,
          imported_count: archive.preview.summary.questions };
      });
    }
    const document = this.preview(strFromU8(files['content.json']), 'json');
    verifyArchiveAttachments(document, files);
    return commit ? this.commitDocument(document, files, folderId) : document;
  }
  async export(entity: string, id: string, format: string) {
    if (entity === 'folder') return this.exportFolder(id);
    if (!['bank', 'banks', 'paper', 'papers'].includes(entity)) invalid('Unsupported export entity');
    const isBank = entity === 'bank' || entity === 'banks';
    const owner = found(await (isBank ? this.repositories.questionBanks : this.repositories.papers).findById(id));
    const questionService = new QuestionService(this.repositories);
    const questions: QuestionView[] = [];
    if (isBank) {
      for (const row of await this.repositories.questions.list()) if (row.bank_id === id) questions.push(await questionService.view(row));
    } else {
      for (const item of await this.repositories.papers.listItems(id)) questions.push(await questionService.get(item.question_id));
      // Material containers can be owned by the paper without being answerable paper items.
      for (let index = 0; index < questions.length; index++) {
        const parent = questions[index]!.material_parent_id;
        if (parent && !questions.some(question => question.id === parent)) questions.push(await questionService.get(parent));
      }
    }
    const tagIds = new Set(questions.flatMap(question => question.tag_ids));
    const storedAttachments = await this.repositories.attachments.list();
    const storedIds = new Set(storedAttachments.map(attachment => attachment.id));
    const serialized = JSON.stringify(questions).replace(
      /(?<![\w/:.])(?:http:\/\/127\.0\.0\.1:\d+)?\/api\/attachments\/([a-f0-9-]{36})/gi,
      (url, id: string) => storedIds.has(id) ? 'attachment://' + id : url,
    );
    const attachmentIds = new Set([...serialized.matchAll(/attachment:\/\/([a-f0-9-]{36})/gi)].map(match => match[1]));
    const document: ContentDocument = { version: 1, entity: isBank ? 'bank' : 'paper', name: owner.name,
      description: owner.description, questions: JSON.parse(serialized) as QuestionView[],
      tags: (await this.repositories.tags.list()).filter(tag => tagIds.has(tag.id)).map(({ id, name, target_type, color }) => ({ id, name, target_type, color })),
      attachments: storedAttachments.filter(attachment => attachmentIds.has(attachment.id)) };
    if (!isBank) {
      const paper = await new PaperService(this.repositories).get(id);
      document.paper = { full_score: paper.full_score, score_mode: paper.score_mode as ScoreMode,
        time_limit_seconds: paper.time_limit_seconds, shuffle_options: paper.shuffle_options,
        shuffle_sections: paper.shuffle_sections, shuffle_materials: paper.shuffle_materials,
        merged_shuffle_sections: paper.merged_shuffle_sections,
        sections: paper.sections.map(section => ({ ...section,
          items: section.items.map(item => ({ id: item.id, question_id: item.question_id })) })) };
    }
    const json = JSON.stringify(document, null, 2);
    if (format === 'json') return { bytes: strToU8(json), extension: 'json', mime: 'application/json' };
    if (format === 'markdown' || format === 'md') return { bytes: strToU8(`# Quarry\n\n\`\`\`json\n${json}\n\`\`\`\n`), extension: 'md', mime: 'text/markdown' };
    if (format !== 'quarry') invalid('Unsupported export format');
    const files: Files = { 'content.json': strToU8(json) };
    await this.attachments(files, document.attachments);
    return { bytes: zipSync(files), extension: 'quarry', mime: 'application/zip' };
  }
  private async exportFolder(id: string) {
    found(await this.repositories.folders.findById(id));
    const all = await this.repositories.folders.list();
    const ids = new Set([id]);
    let changed = true;
    while (changed) { changed = false; for (const folder of all) if (folder.parent_id && ids.has(folder.parent_id) && !ids.has(folder.id)) {
      ids.add(folder.id); changed = true;
    } }
    const folders = all.filter(f => ids.has(f.id)).map(f => ({ ...f, parent_id: f.id === id ? null : f.parent_id }));
    const banks = (await this.repositories.questionBanks.list()).filter(b => b.folder_id && ids.has(b.folder_id));
    const papers = (await this.repositories.papers.list()).filter(p => p.folder_id && ids.has(p.folder_id));
    const bankIds = new Set(banks.map(bank => bank.id));
    const sourceIds = new Set((await this.repositories.questions.list())
      .filter(question => question.bank_id && bankIds.has(question.bank_id)).map(question => question.id));
    const sourceLinks = [];
    for (const paper of papers) {
      for (const item of await this.repositories.papers.listItems(paper.id)) {
        if (!item.source_invalid && item.source_question_id && item.source_version && sourceIds.has(item.source_question_id)) {
          sourceLinks.push({ paper_id: paper.id, item_id: item.id, source_question_id: item.source_question_id,
            source_version: item.source_version });
        }
      }
    }
    const files: Files = {};
    for (const [entity, owners] of [['bank', banks], ['paper', papers]] as const) for (const owner of owners) {
      const result = await this.export(entity, owner.id, 'quarry');
      const content = unpack(result.bytes);
      files[`contents/${owner.id}.json`] = content['content.json']!;
      for (const [path, bytes] of Object.entries(content)) if (path.startsWith('attachments/')) files[path] = bytes;
    }
    const targets = new Set([...ids, ...banks.map(b => b.id), ...papers.map(p => p.id)]);
    const tags = []; const relations = [];
    for (const tag of await this.repositories.tags.list()) if (tag.target_type === 'file') {
      const selected = (await this.repositories.tags.listRelations(tag.id)).filter(r => targets.has(r.target_id));
      if (selected.length) { tags.push(tag); relations.push(...selected); }
    }
    files['content.json'] = strToU8(JSON.stringify({ version: 1, entity: 'folder', root_id: id, folders, banks, papers,
      tags, tag_relations: relations, source_links: sourceLinks }));
    files['manifest.json'] = strToU8(JSON.stringify({ format: 'quarry-folder', version: 1,
      checksums: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hash(bytes)])) }));
    return { bytes: zipSync(files), extension: 'quarry', mime: 'application/zip' };
  }
  private async attachments(files: Files, rows: { sha256: string }[]) {
    for (const attachment of rows) {
      if (!this.storage) invalid('Attachment storage is not configured');
      files[`attachments/${attachment.sha256}`] = new Uint8Array(await new Response(await this.storage.readStream(attachment.sha256)).arrayBuffer());
    }
  }
  async create() {
    const snapshot = await this.snapshots.capture();
    const files: Files = { 'database.json': strToU8(JSON.stringify(snapshot)) };
    await this.attachments(files, snapshot.attachments as unknown as { sha256: string }[]);
    files['manifest.json'] = strToU8(JSON.stringify({ format: 'quarry-backup', version: 1,
      created_at: new Date().toISOString(), checksums: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hash(bytes)])) }));
    return zipSync(files);
  }
  async restore(bytes: Uint8Array) {
    const files = unpack(bytes);
    let snapshot: DatabaseSnapshot;
    try {
      const manifest = z.strictObject({ format: z.literal('quarry-backup'), version: z.literal(1), created_at: z.string(),
        checksums: z.record(z.string(), z.string()) }).parse(JSON.parse(strFromU8(files['manifest.json']!)));
      if (!manifest.checksums['database.json'] || Object.keys(files).length !== Object.keys(manifest.checksums).length + 1)
        throw new Error('Incomplete manifest');
      for (const [name, checksum] of Object.entries(manifest.checksums)) if (!files[name] || hash(files[name]) !== checksum) throw new Error('Checksum mismatch');
      snapshot = z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).parse(JSON.parse(strFromU8(files['database.json']!)));
      for (const attachment of snapshot.attachments ?? []) {
        const data = files[`attachments/${attachment.sha256}`];
        if (!data || hash(data) !== attachment.sha256 || data.length !== attachment.file_size) throw new Error('Invalid attachment data');
      }
    } catch (error) { return reject([{ line: 1, message: `Invalid backup: ${String(error)}` }]); }
    const recovery = await this.create();
    await mkdir(this.recoveryDirectory, { recursive: true });
    const recoveryId = randomUUID();
    await writeFile(join(this.recoveryDirectory, `${recoveryId}.quarry-backup`), recovery, { flag: 'wx' });
    const uploaded: string[] = [];
    try {
      await this.snapshots.replace(snapshot, async () => {
        for (const attachment of snapshot.attachments ?? []) {
          const sha = String(attachment.sha256);
          if (!this.storage) invalid('Attachment storage is not configured');
          if (!await this.storage.exists(sha)) { uploaded.push(sha); await this.storage.upload(sha, files[`attachments/${sha}`]!); }
        }
      });
    } catch (error) {
      for (const sha of uploaded) await this.storage?.delete(sha);
      throw new AppError(ErrorCode.StorageError, 'Restore failed; database rolled back to recovery point', { recovery_point_id: recoveryId, cause: String(error) });
    }
    return { recovery_point_id: recoveryId };
  }
}



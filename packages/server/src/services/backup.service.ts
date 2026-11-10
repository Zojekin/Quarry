import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import type { DatabaseSnapshot, ISnapshotRepository, ITransactionRunner, Repositories } from '@quarry/database';
import { AppError, ErrorCode, IdSchema, QuestionSchema, QuestionType, ScoreMode, TagColorSchema } from '@quarry/shared';
import type { IAttachmentStorage } from './attachment.service.js';
import type { QuestionView } from './question.service.js';
import { QuestionService } from './question.service.js';
import { PaperService } from './paper.service.js';
import { found, invalid } from './common.js';

// Strip the material extension before applying the strict domain schema.
const portableQuestion = z.unknown().transform((value, ctx) => {
  const base = z.record(z.string(), z.unknown()).safeParse(value);
  if (!base.success) { ctx.addIssue({ code: 'custom', message: 'Expected question object' }); return z.NEVER; }
  const { material, material_parent_id, ...content } = base.data;
  const parsed = QuestionSchema.safeParse(content);
  if (!parsed.success) { for (const issue of parsed.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message }); return z.NEVER; }
  const extension = z.strictObject({ material: z.string().nullable().default(null),
    material_parent_id: IdSchema.nullable().default(null) }).safeParse({ material, material_parent_id });
  if (!extension.success) { for (const issue of extension.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message }); return z.NEVER; }
  return { ...parsed.data, ...extension.data };
});
const paperConfigSchema = z.strictObject({ full_score: z.number().nonnegative(), score_mode: z.enum(ScoreMode),
  time_limit_seconds: z.number().int().positive().nullable(), shuffle_options: z.boolean(), shuffle_sections: z.boolean(),
  shuffle_materials: z.boolean(), merged_shuffle_sections: z.array(z.array(IdSchema)),
  sections: z.array(z.strictObject({ id: IdSchema, title: z.string().min(1), question_type: z.enum(QuestionType),
    shuffle_questions: z.boolean(), fixed_groups: z.array(z.array(IdSchema)),
    items: z.array(z.strictObject({ id: IdSchema, question_id: IdSchema })) })) });
const documentSchema = z.strictObject({ version: z.literal(1), entity: z.enum(['bank', 'paper']),
  name: z.string().trim().min(1), description: z.string().default(''),
  questions: z.array(portableQuestion),
  tags: z.array(z.strictObject({ id: IdSchema, name: z.string().min(1), target_type: z.enum(['file', 'question']), color: TagColorSchema.optional() })).default([]),
  attachments: z.array(z.strictObject({ id: IdSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/),
    filename: z.string(), mime_type: z.string(), file_size: z.number().int().nonnegative(), created_at: z.string() })).default([]),
  paper: paperConfigSchema.optional(),
});
type ContentDocument = z.infer<typeof documentSchema>;
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
    const result = documentSchema.safeParse(value);
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
    const ids = new Set(document.questions.map(question => question.id));
    const tags = new Map(document.tags.map(tag => [tag.id, tag]));
    const attachmentIds = new Set(document.attachments.map(attachment => attachment.id));
    if (ids.size !== document.questions.length || tags.size !== document.tags.length)
      reject([{ line: 1, message: 'Duplicate question or tag IDs' }]);
    if (attachmentIds.size !== document.attachments.length
      || new Set(document.attachments.map(attachment => attachment.sha256)).size !== document.attachments.length)
      reject([{ line: 1, message: 'Duplicate attachment identities' }]);
    for (const [questionIndex, question] of document.questions.entries()) {
      if (question.tag_ids.some(id => tags.get(id)?.target_type !== 'question'))
        referenceError(['questions', questionIndex, 'tag_ids'], `Invalid question tag reference: ${question.id}`);
      for (const match of JSON.stringify(question).matchAll(/attachment:\/\/([a-f0-9-]{36})/gi))
        if (!attachmentIds.has(match[1]!)) referenceError(['questions', questionIndex], `Invalid attachment reference: ${match[1]}`);
      const visited = new Set([question.id]);
      let parent = question.material_parent_id;
      while (parent) {
        if (!ids.has(parent) || visited.has(parent)) referenceError(['questions', questionIndex, 'material_parent_id'], 'Invalid material parent reference');
        visited.add(parent); parent = document.questions.find(entry => entry.id === parent)!.material_parent_id;
      }
    }
    if (document.entity === 'bank' && document.paper) reject([{ line: 1, message: 'Bank cannot contain paper configuration' }]);
    if (document.paper) {
      const sections = new Set(document.paper.sections.map(section => section.id));
      const items = document.paper.sections.flatMap(section => section.items);
      if (sections.size !== document.paper.sections.length || new Set(items.map(item => item.id)).size !== items.length
        || new Set(items.map(item => item.question_id)).size !== items.length)
        reject([{ line: 1, message: 'Duplicate paper section or item' }]);
      const merged = document.paper.merged_shuffle_sections.flat();
      if (merged.some(id => !sections.has(id)) || new Set(merged).size !== merged.length)
        reject([{ line: 1, message: 'Invalid merged section reference' }]);
      for (const [sectionIndex, section] of document.paper.sections.entries()) {
        if (section.items.some(item => !ids.has(item.question_id)
          || document.questions.find(question => question.id === item.question_id)?.type !== section.question_type))
          referenceError(['paper', 'sections', sectionIndex, 'items'], 'Invalid paper question reference or type');
        const grouped = section.fixed_groups.flat();
        if (new Set(grouped).size !== grouped.length || section.fixed_groups.some(group => group.length < 2
          || group.some((id, i) => {
            const position = section.items.findIndex(item => item.id === id);
            return position < 0 || (i > 0 && position !== section.items.findIndex(item => item.id === group[i - 1]) + 1);
          }))) referenceError(['paper', 'sections', sectionIndex, 'fixed_groups'], 'Invalid fixed group');
      }
    }
    return document;
  }
  async commit(content: string, format: string, files: Files = {}) {
    const document = this.preview(content, format);
    const createdFiles: string[] = [];
    try {
      for (const attachment of document.attachments) {
        const bytes = files[`attachments/${attachment.sha256}`];
        const existing = await this.repositories.attachments.findById(attachment.id);
        if (existing && existing.sha256 !== attachment.sha256) reject([{ line: 1, message: 'Attachment identity conflict' }]);
        if (!bytes && !await this.storage?.exists(attachment.sha256)) reject([{ line: 1, message: 'Missing attachment data' }]);
        if (bytes && (hash(bytes) !== attachment.sha256 || bytes.length !== attachment.file_size))
          reject([{ line: 1, message: 'Attachment checksum mismatch' }]);
      }
      return await this.transaction(async repositories => {
        const tagIds = new Map<string, string>();
        for (const tag of document.tags) {
          const existing = (await repositories.tags.list()).find(entry => entry.name === tag.name && entry.target_type === tag.target_type);
          const id = existing?.id ?? randomUUID(); tagIds.set(tag.id, id);
          if (!existing) await repositories.tags.create({ ...tag, id });
        }
        const id = randomUUID();
        if (document.entity === 'bank') await repositories.questionBanks.create({ id, folder_id: null, name: document.name, description: document.description });
        if (document.entity === 'paper') await repositories.papers.create({ id, folder_id: null, name: document.name,
          description: document.description, time_limit_seconds: null });
        const questionIds = new Map(document.questions.map(question => [question.id, randomUUID()]));
        const pending = [...document.questions];
        const service = new QuestionService(repositories);
        while (pending.length) {
          const index = pending.findIndex(question => !question.material_parent_id || !pending.some(parent => parent.id === question.material_parent_id));
          const question = pending.splice(index, 1)[0]!;
          await service.save({ ...question, id: questionIds.get(question.id), owner_type: document.entity === 'bank' ? 'question_bank' : 'paper',
            owner_id: id, tag_ids: question.tag_ids.map(tag => tagIds.get(tag)),
            material_parent_id: question.material_parent_id ? questionIds.get(question.material_parent_id) : null });
        }
        if (document.entity === 'paper') {
          const paper = new PaperService(repositories);
          if (document.paper) {
            const sectionIds = new Map(document.paper.sections.map(section => [section.id, randomUUID()]));
            const itemIds = new Map(document.paper.sections.flatMap(section => section.items).map(item => [item.id, randomUUID()]));
            await paper.save({ ...document.paper,
              merged_shuffle_sections: document.paper.merged_shuffle_sections.map(group => group.map(id => sectionIds.get(id))),
              sections: document.paper.sections.map(section => ({ ...section, id: sectionIds.get(section.id),
                fixed_groups: section.fixed_groups.map(group => group.map(id => itemIds.get(id))),
                items: section.items.map(item => ({ id: itemIds.get(item.id), question_id: questionIds.get(item.question_id) })) })),
            }, id);
          } else for (const question of document.questions) await paper.addItem(id, { question_id: questionIds.get(question.id) });
        }
        for (const attachment of document.attachments) {
          if (!await repositories.attachments.findById(attachment.id)) await repositories.attachments.create(attachment);
          if (!await this.storage?.exists(attachment.sha256)) {
            if (!this.storage) invalid('Attachment storage is not configured');
            createdFiles.push(attachment.sha256);
            await this.storage.upload(attachment.sha256, files[`attachments/${attachment.sha256}`]!);
          }
        }
        return { id, entity: document.entity, imported_count: document.questions.length };
      });
    } catch (error) { for (const entry of createdFiles) await this.storage?.delete(entry); throw error; }
  }
  async importArchive(bytes: Uint8Array, commit: boolean) {
    const files = unpack(bytes);
    if (!files['content.json']) reject([{ line: 1, message: 'Missing content.json' }]);
    const content = strFromU8(files['content.json']);
    const document = this.preview(content, 'json');
    for (const attachment of document.attachments) {
      const bytes = files[`attachments/${attachment.sha256}`];
      if (!bytes || hash(bytes) !== attachment.sha256 || bytes.length !== attachment.file_size)
        reject([{ line: 1, path: 'attachments', message: `Missing or corrupt attachment: ${attachment.id}` }]);
    }
    return commit ? this.commit(content, 'json', files) : document;
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
    const serialized = JSON.stringify(questions);
    const attachmentIds = new Set([...serialized.matchAll(/attachment:\/\/([a-f0-9-]{36})/gi)].map(match => match[1]));
    const document: ContentDocument = { version: 1, entity: isBank ? 'bank' : 'paper', name: owner.name,
      description: owner.description, questions,
      tags: (await this.repositories.tags.list()).filter(tag => tagIds.has(tag.id)).map(({ id, name, target_type, color }) => ({ id, name, target_type, color })),
      attachments: (await this.repositories.attachments.list()).filter(attachment => attachmentIds.has(attachment.id)) };
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
    files['content.json'] = strToU8(JSON.stringify({ version: 1, entity: 'folder', root_id: id, folders, banks, papers, tags, tag_relations: relations }));
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



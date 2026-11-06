import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Repositories } from '@quarry/database';
import { IdSchema } from '@quarry/shared';
import { found, idsSchema, invalid, nameSchema, parse } from './common.js';
import { TagService } from './tag.service.js';

const folderInput = z.strictObject({ name: nameSchema, parent_id: IdSchema.nullable().default(null),
  tag_ids: idsSchema.default([]) });
const bankInput = z.strictObject({ name: nameSchema, folder_id: IdSchema.nullable().default(null),
  description: z.string().default(''), tag_ids: idsSchema.default([]) });
export class ContentService {
  readonly tags: TagService;
  constructor(readonly repositories: Repositories) { this.tags = new TagService(repositories); }
  async folder(id: string) {
    const row = found(await this.repositories.folders.findById(id));
    return { ...row, tag_ids: await this.tags.ids(id, 'file') };
  }
  async bank(id: string) {
    const row = found(await this.repositories.questionBanks.findById(id));
    return { ...row, tag_ids: await this.tags.ids(id, 'file') };
  }
  async saveFolder(input: Record<string, unknown>, id?: string) {
    const old = id ? await this.folder(id) : undefined;
    const data = parse(folderInput, { ...(old ? { name: old.name, parent_id: old.parent_id,
      tag_ids: old.tag_ids } : {}), ...input });
    const folderId = id ?? randomUUID();
    let parent = data.parent_id;
    const visited = new Set([folderId]);
    while (parent) {
      if (visited.has(parent)) invalid('Circular folder nesting is not allowed');
      visited.add(parent);
      parent = (await this.folder(parent)).parent_id;
    }
    await this.tags.validate(data.tag_ids, 'file');
    const { tag_ids, ...row } = data;
    if (id) await this.repositories.folders.update(id, row);
    else await this.repositories.folders.create({ id: folderId, ...row });
    await this.tags.replace(folderId, 'file', tag_ids);
    return this.folder(folderId);
  }
  async saveBank(input: Record<string, unknown>, id?: string) {
    const old = id ? await this.bank(id) : undefined;
    const data = parse(bankInput, { ...(old ? { name: old.name, folder_id: old.folder_id,
      description: old.description, tag_ids: old.tag_ids } : {}), ...input });
    if (data.folder_id) await this.folder(data.folder_id);
    await this.tags.validate(data.tag_ids, 'file');
    const bankId = id ?? randomUUID();
    const { tag_ids, ...row } = data;
    if (id) await this.repositories.questionBanks.update(id, row);
    else await this.repositories.questionBanks.create({ id: bankId, ...row });
    await this.tags.replace(bankId, 'file', tag_ids);
    return this.bank(bankId);
  }
  async deleteBank(id: string) {
    await this.bank(id);
    for (const question of await this.repositories.questions.list())
      if (question.bank_id === id) await this.repositories.questions.delete(question.id);
    await this.repositories.questionBanks.delete(id);
  }
  async deleteFolder(id: string) {
    await this.folder(id);
    const folders = await this.repositories.folders.list();
    const ids = new Set([id]);
    let size = 0;
    while (size !== ids.size) {
      size = ids.size;
      for (const folder of folders) if (folder.parent_id && ids.has(folder.parent_id)) ids.add(folder.id);
    }
    for (const bank of await this.repositories.questionBanks.list())
      if (bank.folder_id && ids.has(bank.folder_id)) await this.deleteBank(bank.id);
    for (const paper of await this.repositories.papers.list()) if (paper.folder_id && ids.has(paper.folder_id)) {
      for (const question of await this.repositories.questions.list())
        if (question.paper_id === paper.id) await this.repositories.questions.delete(question.id);
      await this.repositories.papers.delete(paper.id);
    }
    for (const folderId of ids) await this.repositories.folders.delete(folderId);
  }
}

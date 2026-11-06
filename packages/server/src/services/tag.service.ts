import { randomUUID } from 'node:crypto';
import type { Repositories } from '@quarry/database';
import { AppError, ErrorCode } from '@quarry/shared';
import { found, idsSchema, parse } from './common.js';

export type Namespace = 'file' | 'question';
export type EntityType = 'folder' | 'question_bank' | 'paper' | 'question';
export class TagService {
  private index: Promise<Map<string, string[]>> | undefined;
  constructor(private readonly repositories: Repositories) {}
  async validate(ids: string[], namespace: Namespace) {
    parse(idsSchema, ids);
    for (const id of ids) {
      const tag = found(await this.repositories.tags.findById(id));
      if (tag.target_type !== namespace) throw new AppError(ErrorCode.TagIsolationViolation,
        `Only ${namespace} tags can attach to this object`);
    }
  }
  async target(id: string, entity: EntityType, namespace: Namespace) {
    if ((entity === 'question') !== (namespace === 'question'))
      throw new AppError(ErrorCode.TagIsolationViolation, 'Tag and target namespaces must match');
    const repository = { folder: this.repositories.folders, question_bank: this.repositories.questionBanks,
      paper: this.repositories.papers, question: this.repositories.questions }[entity];
    found(await repository.findById(id));
  }
  async ids(target: string, namespace: Namespace): Promise<string[]> {
    this.index ??= (async () => {
      const index = new Map<string, string[]>();
      const tags = await this.repositories.tags.list();
      for (const tag of tags) for (const relation of await this.repositories.tags.listRelations(tag.id)) {
        const key = `${tag.target_type}:${relation.target_id}`;
        const ids = index.get(key) ?? [];
        ids.push(tag.id);
        index.set(key, ids);
      }
      return index;
    })();
    return [...((await this.index).get(`${namespace}:${target}`) ?? [])].sort();
  }
  async replace(target: string, namespace: Namespace, ids: string[]) {
    await this.validate(ids, namespace);
    const current = await this.ids(target, namespace);
    for (const id of current) if (!ids.includes(id)) await this.detach(id, target, namespace);
    for (const id of ids) if (!current.includes(id)) await this.attach(id, target, namespace);
  }
  async attach(id: string, target: string, namespace: Namespace) {
    this.index = undefined;
    await this.validate([id], namespace);
    const existing = (await this.repositories.tags.listRelations(id)).find(r => r.target_id === target);
    return existing ?? this.repositories.tags.addRelation({ id: randomUUID(), tag_id: id,
      target_id: target, target_type: namespace });
  }
  async detach(id: string, target: string, namespace: Namespace) {
    this.index = undefined;
    await this.validate([id], namespace);
    const relation = (await this.repositories.tags.listRelations(id)).find(r => r.target_id === target);
    if (relation) await this.repositories.tags.removeRelation(relation.id);
  }
  async matches(target: string, namespace: Namespace, ids: string[]) {
    if (!ids.length) return true;
    const attached = await this.ids(target, namespace);
    return ids.every(id => attached.includes(id));
  }
}

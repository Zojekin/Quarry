import { randomUUID } from 'node:crypto';
import type { Repositories, Row } from '@quarry/database';
import type { LibraryTarget, LibraryTransfer, LibraryTransferItem } from '@quarry/shared';
import { found, invalid, parse } from './common.js';
import { composerSchema } from './paper.service.js';
import { TagService, type Namespace } from './tag.service.js';

type Folder = Row<'folders'>;
type Bank = Row<'question_banks'>;
type Paper = Row<'papers'>;
type Question = Row<'questions'>;
type Entry =
  | { entity: 'folder'; row: Folder }
  | { entity: 'bank'; row: Bank }
  | { entity: 'paper'; row: Paper };

function parentOf(entry: Entry) {
  return entry.entity === 'folder' ? entry.row.parent_id : entry.row.folder_id;
}

function itemOf(entry: Entry): LibraryTransferItem {
  return { entity: entry.entity, id: entry.row.id, name: entry.row.name };
}

function indexByParent<T>(rows: T[], parentOfRow: (row: T) => string | null) {
  const index = new Map<string | null, T[]>();
  for (const row of rows) {
    const parent = parentOfRow(row);
    const siblings = index.get(parent) ?? [];
    siblings.push(row);
    index.set(parent, siblings);
  }
  return index;
}

export class LibraryService {
  readonly #tags: TagService;

  constructor(private readonly repositories: Repositories) {
    this.#tags = new TagService(repositories);
  }

  private async entry({ entity, id }: LibraryTarget): Promise<Entry> {
    switch (entity) {
      case 'folder': return { entity, row: found(await this.repositories.folders.findById(id)) };
      case 'bank': return { entity, row: found(await this.repositories.questionBanks.findById(id)) };
      case 'paper': return { entity, row: found(await this.repositories.papers.findById(id)) };
    }
  }

  private async validate({ targets, target_folder_id }: LibraryTransfer) {
    const forbidden = new Set(targets.filter(target => target.entity === 'folder').map(target => target.id));
    const visited = new Set<string>();
    let parent = target_folder_id;
    while (parent !== null) {
      const folder = found(await this.repositories.folders.findById(parent));
      if (forbidden.has(parent) || visited.has(parent)) invalid('Circular folder nesting is not allowed');
      visited.add(parent);
      parent = folder.parent_id;
    }
    return Promise.all(targets.map(target => this.entry(target)));
  }

  async move(input: LibraryTransfer): Promise<LibraryTransferItem[]> {
    const entries = await this.validate(input);
    const destination = input.target_folder_id;
    for (const entry of entries) {
      if (parentOf(entry) === destination) continue;
      const { id } = entry.row;
      switch (entry.entity) {
        case 'folder': await this.repositories.folders.update(id, { parent_id: destination }); break;
        case 'bank': await this.repositories.questionBanks.update(id, { folder_id: destination }); break;
        case 'paper': await this.repositories.papers.update(id, { folder_id: destination }); break;
      }
    }
    return entries.map(itemOf);
  }

  async copy(input: LibraryTransfer): Promise<LibraryTransferItem[]> {
    const entries = await this.validate(input);
    const [folders, banks, papers, questions] = await Promise.all([
      this.repositories.folders.list(), this.repositories.questionBanks.list(),
      this.repositories.papers.list(), this.repositories.questions.list(),
    ]);
    const files: Entry[] = [
      ...folders.map(row => ({ entity: 'folder' as const, row })),
      ...banks.map(row => ({ entity: 'bank' as const, row })),
      ...papers.map(row => ({ entity: 'paper' as const, row })),
    ];
    const byParent = indexByParent(files, parentOf);
    const byOwner = indexByParent(questions, question => question.bank_id ?? question.paper_id);
    const folderParents = new Map(folders.map(row => [row.id, row.parent_id]));
    const selectedFolders = new Set(entries.filter(entry => entry.entity === 'folder').map(entry => entry.row.id));
    const names = new Map<string, Set<string>>();
    const created: LibraryTransferItem[] = [];

    for (const entry of entries) {
      // A selected descendant already travels with its selected ancestor.
      let parent = parentOf(entry);
      const visited = new Set([entry.row.id]);
      while (parent) {
        if (visited.has(parent)) invalid('Circular folder nesting is not allowed');
        if (selectedFolders.has(parent)) break;
        visited.add(parent);
        parent = folderParents.get(parent) ?? null;
      }
      if (parent) continue;

      const pending = [{ entry, destination: input.target_folder_id }];
      const copiedBankQuestions = new Map<string, string>();
      const copiedPapers: { source: Paper; id: string }[] = [];
      for (const { entry: source, destination } of pending) {
        const key = `${destination}:${source.entity}`;
        let siblings = names.get(key);
        if (!siblings) {
          siblings = new Set(byParent.get(destination)?.filter(file => file.entity === source.entity).map(file => file.row.name));
          names.set(key, siblings);
        }
        const name = copyName(source.row.name, siblings);
        const id = randomUUID();
        const row = source.row;
        if (source === entry) created.push({ entity: source.entity, id, name });
        switch (source.entity) {
          case 'folder':
            await this.repositories.folders.create({ id, name, parent_id: destination });
            for (const child of byParent.get(row.id) ?? []) pending.push({ entry: child, destination: id });
            break;
          case 'bank':
            await this.repositories.questionBanks.create({ id, name, folder_id: destination, description: source.row.description });
            await this.copyQuestions(byOwner.get(row.id) ?? [], { bank_id: id, paper_id: null }, copiedBankQuestions);
            break;
          case 'paper': {
            const { description, time_limit_seconds, full_score, score_mode, shuffle_options, shuffle_sections, follow_source } = source.row;
            await this.repositories.papers.create({ id, name, folder_id: destination, description, time_limit_seconds,
              full_score, score_mode, shuffle_options, shuffle_sections, follow_source });
            copiedPapers.push({ source: source.row, id });
            break;
          }
        }
        await this.copyTags(row.id, id, 'file');
      }

      // All banks in this tree must exist before a copied paper can refer to them.
      for (const { source, id } of copiedPapers) {
        const questionIds = new Map<string, string>();
        await this.copyQuestions(byOwner.get(source.id) ?? [], { paper_id: id, bank_id: null }, questionIds);
        await this.copyComposer(source, id, questionIds, copiedBankQuestions);
      }
    }
    return created;
  }

  private async copyTags(source: string, target: string, namespace: Namespace) {
    for (const tag_id of await this.#tags.ids(source, namespace)) {
      await this.repositories.tags.addRelation({ id: randomUUID(), tag_id, target_id: target, target_type: namespace });
    }
  }

  private async copyQuestions(questions: Question[], owner: Pick<Question, 'bank_id' | 'paper_id'>, ids: Map<string, string>) {
    for (const question of questions) {
      const { id: source, created_at, updated_at, is_deleted, deleted_batch_id, ...content } = question;
      const id = randomUUID();
      ids.set(source, id);
      await this.repositories.questions.create({ ...content, ...owner, id, material_parent_id: null });
      await this.copyTags(source, id, 'question');
    }
    // Insert every question first so the result is independent of the original row order.
    for (const question of questions) {
      const parentId = question.material_parent_id && ids.get(question.material_parent_id);
      if (parentId) await this.repositories.questions.update(ids.get(question.id)!, { material_parent_id: parentId });
    }
  }

  private async copyComposer(source: Paper, paperId: string, questionIds: Map<string, string>, bankQuestionIds: Map<string, string>) {
    const composer = parse(composerSchema, JSON.parse(source.composer_json));
    const sectionIds = new Map(composer.sections.map(section => [section.id, randomUUID()]));
    const items = (await this.repositories.papers.listItems(source.id)).filter(item => questionIds.has(item.question_id));
    const itemIds = new Map(items.map(item => [item.id, randomUUID()]));
    const groupHeads = new Map<string, string>();
    const sections = composer.sections.map(section => {
      const fixed_groups = section.fixed_groups
        .map(group => remapIds(group, itemIds))
        .filter(group => group.length >= 2);
      for (const group of fixed_groups) for (const itemId of group) groupHeads.set(itemId, group[0]!);
      return { ...section, id: sectionIds.get(section.id), fixed_groups };
    });
    const nextOrder = new Map<number, number>();
    for (const item of items) {
      const { created_at, ...fields } = item;
      const id = itemIds.get(item.id)!;
      const sourceId = item.source_question_id;
      const sort_order = nextOrder.get(item.section_index) ?? 0;
      nextOrder.set(item.section_index, sort_order + 1);
      await this.repositories.papers.addItem({
        ...fields, id, paper_id: paperId, question_id: questionIds.get(item.question_id)!,
        group_id: groupHeads.get(id) ?? null, sort_order,
        source_question_id: sourceId ? bankQuestionIds.get(sourceId) ?? sourceId : null,
      });
    }
    await this.repositories.papers.update(paperId, {
      composer_json: JSON.stringify({ ...composer, sections,
        merged_shuffle_sections: composer.merged_shuffle_sections.map(group => remapIds(group, sectionIds)),
      }),
    });
  }
}

function remapIds(ids: string[], replacements: Map<string, string>) {
  return ids.flatMap(id => replacements.get(id) ?? []);
}

function copyName(name: string, siblings: Set<string>) {
  if (!siblings.has(name)) {
    siblings.add(name);
    return name;
  }
  const base = name.replace(/ \(副本(?: \d+)?\)$/, '');
  let candidate = `${base} (副本)`;
  for (let number = 2; siblings.has(candidate); number++) candidate = `${base} (副本 ${number})`;
  siblings.add(candidate);
  return candidate;
}

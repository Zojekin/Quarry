import type { ContentSnapshot, Repositories, TrashTable } from '@quarry/database';
import { found } from './common.js';

const trashTables = ['folders', 'question_banks', 'papers', 'questions'] as const;
type TrashTarget = { entity: TrashTable; id: string };

function contentChildren(snapshot: ContentSnapshot) {
  const children = new Map<TrashTable, Map<string, TrashTarget[]>>();
  const add = (parent: TrashTable, parentId: string | null, entity: TrashTable, id: string) => {
    if (!parentId) return;
    const byId = children.get(parent) ?? new Map<string, TrashTarget[]>();
    const rows = byId.get(parentId) ?? [];
    rows.push({ entity, id });
    byId.set(parentId, rows);
    children.set(parent, byId);
  };
  for (const row of snapshot.folders) add('folders', row.parent_id, 'folders', row.id);
  for (const kind of ['question_banks', 'papers'] as const)
    for (const row of snapshot[kind]) add('folders', row.folder_id, kind, row.id);
  for (const row of snapshot.questions) {
    add('question_banks', row.bank_id, 'questions', row.id);
    add('papers', row.paper_id, 'questions', row.id);
    add('questions', row.material_parent_id, 'questions', row.id);
  }
  return children;
}

function questionTrashMetadata(snapshot: ContentSnapshot) {
  const banks = new Map(snapshot.question_banks.map(bank => [bank.id, bank]));
  const papers = new Map(snapshot.papers.map(paper => [paper.id, paper]));
  const questions = new Map(snapshot.questions.map(question => [question.id, question]));
  const ownerOf = (question: ContentSnapshot['questions'][number]) =>
    question.bank_id ? banks.get(question.bank_id) : papers.get(question.paper_id ?? '');

  return (question: ContentSnapshot['questions'][number]) => {
    const material = question.material_parent_id ? questions.get(question.material_parent_id) : undefined;
    const owner = ownerOf(question);
    const materialOwner = material && ownerOf(material);
    return {
      parent_deleted: owner?.is_deleted === 1 || materialOwner?.is_deleted === 1,
      parent_name: (owner ?? materialOwner)?.name ?? null,
      question_type: question.type,
    };
  };
}

export class TrashService {
  constructor(private readonly repositories: Repositories) {}
  async list() {
    const snapshot = await this.repositories.trash.snapshot();
    const metadata = questionTrashMetadata(snapshot);
    const resources = (['folders', 'question_banks', 'papers'] as const).flatMap(entity =>
      snapshot[entity].filter(row => row.is_deleted).map(row => ({ ...row, entity })));
    const questions = snapshot.questions.filter(row => row.is_deleted)
      .map(row => ({ ...row, entity: 'questions' as const, ...metadata(row) }));
    return [...resources, ...questions];
  }
  private descendants(children: ReturnType<typeof contentChildren>, targets: TrashTarget[]) {
    const selected: Record<TrashTable, Set<string>> = {
      folders: new Set(), question_banks: new Set(), papers: new Set(), questions: new Set(),
    };
    const pending = [...targets];
    while (pending.length) {
      const { entity, id } = pending.pop()!;
      if (selected[entity].has(id)) continue;
      selected[entity].add(id);
      for (const child of children.get(entity)?.get(id) ?? []) pending.push(child);
    }
    return selected;
  }
  async restore(table: TrashTable, id: string) {
    await this.batch('restore', [{ entity: table, id }]);
  }
  async purge(table: TrashTable, id: string) {
    await this.batch('purge', [{ entity: table, id }]);
  }
  async batch(action: 'restore' | 'purge', targets: TrashTarget[]) {
    const snapshot = await this.repositories.trash.snapshot();
    const byId = {
      folders: new Map(snapshot.folders.map(row => [row.id, row])),
      question_banks: new Map(snapshot.question_banks.map(row => [row.id, row])),
      papers: new Map(snapshot.papers.map(row => [row.id, row])),
      questions: new Map(snapshot.questions.map(row => [row.id, row])),
    };
    const affected = targets.map(target => {
      const row = byId[target.entity].get(target.id);
      return { ...target, batchId: found(row?.is_deleted ? row : undefined).deleted_batch_id };
    });
    if (action === 'purge') return this.purgeItems(snapshot, targets);

    // Restore only necessary ancestors, without reviving unrelated sibling content.
    const seen = new Set<string>();
    const ancestor = async (kind: TrashTable, rowId: string) => {
      const key = `${kind}:${rowId}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (kind === 'questions') {
        const q = found(byId.questions.get(rowId));
        if (q.material_parent_id) await ancestor('questions', q.material_parent_id);
        if (q.bank_id) await ancestor('question_banks', q.bank_id);
        if (q.paper_id) await ancestor('papers', q.paper_id);
      } else {
        const row = found(byId[kind].get(rowId));
        const folder = 'parent_id' in row ? row.parent_id : row.folder_id;
        if (folder) await ancestor('folders', folder);
      }
      await this.repositories.trash.restore(kind, rowId);
    };
    // Use the original snapshot for every selected batch, even if an earlier restore already revived an ancestor.
    const byBatch = new Map<string, TrashTarget[]>();
    for (const target of affected) {
      if (target.batchId === null) {
        await ancestor(target.entity, target.id);
      } else {
        const group = byBatch.get(target.batchId) ?? [];
        group.push(target);
        byBatch.set(target.batchId, group);
      }
    }
    const children = contentChildren(snapshot);
    for (const [batchId, group] of byBatch) {
      const selected = this.descendants(children, group);
      for (const kind of trashTables)
        for (const rowId of selected[kind]) {
          if (byId[kind].get(rowId)?.deleted_batch_id === batchId) await ancestor(kind, rowId);
        }
    }
  }
  private async purgeItems(snapshot: ContentSnapshot, targets: TrashTarget[]) {
    const selected = this.descendants(contentChildren(snapshot), targets);
    // Foreign keys require children before parents. Learning data has no content FK.
    for (const kind of ['questions', 'papers', 'question_banks', 'folders'] as const) {
      const pending = selected[kind];
      if (!pending.size) continue;
      const parents = new Map<string, string>();
      const childCounts = new Map<string, number>();
      for (const row of snapshot[kind]) {
        if (!pending.has(row.id)) continue;
        const parent = 'parent_id' in row ? row.parent_id
          : 'material_parent_id' in row ? row.material_parent_id : null;
        if (parent && pending.has(parent)) {
          parents.set(row.id, parent);
          childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
        }
      }
      const leaves = [...pending].filter(rowId => !childCounts.has(rowId));
      for (let remaining = pending.size; remaining > 0; remaining--) {
        const leaf = found(leaves.pop());
        await this.repositories.trash.purge(kind, leaf);
        const parent = parents.get(leaf);
        if (parent) {
          const count = found(childCounts.get(parent)) - 1;
          if (count === 0) leaves.push(parent);
          childCounts.set(parent, count);
        }
      }
    }
  }
  async clear() {
    const snapshot = await this.repositories.trash.snapshot();
    const targets = trashTables.flatMap(entity => snapshot[entity].filter(row => row.is_deleted)
      .map(({ id }) => ({ entity, id })));
    await this.purgeItems(snapshot, targets);
  }
}

import type { ContentSnapshot, Repositories, TrashTable } from '@quarry/database';
import { found } from './common.js';

export class TrashService {
  constructor(private readonly repositories: Repositories) {}
  async list() {
    const snapshot = await this.repositories.trash.snapshot();
    return (Object.keys(snapshot) as TrashTable[]).flatMap(entity =>
      snapshot[entity].filter(row => row.is_deleted).map(row => ({ ...row, entity })));
  }
  private descendants(snapshot: ContentSnapshot, table: TrashTable, id: string) {
    const selected: Record<TrashTable, Set<string>> = {
      folders: new Set(), question_banks: new Set(), papers: new Set(), questions: new Set(),
    };
    selected[table].add(id);
    let count = -1;
    while (count !== Object.values(selected).reduce((n, ids) => n + ids.size, 0)) {
      count = Object.values(selected).reduce((n, ids) => n + ids.size, 0);
      for (const row of snapshot.folders)
        if (row.parent_id && selected.folders.has(row.parent_id)) selected.folders.add(row.id);
      for (const kind of ['question_banks', 'papers'] as const)
        for (const row of snapshot[kind])
          if (row.folder_id && selected.folders.has(row.folder_id)) selected[kind].add(row.id);
      for (const row of snapshot.questions)
        if ((row.bank_id && selected.question_banks.has(row.bank_id))
          || (row.paper_id && selected.papers.has(row.paper_id))
          || (row.material_parent_id && selected.questions.has(row.material_parent_id)))
          selected.questions.add(row.id);
    }
    return selected;
  }
  async restore(table: TrashTable, id: string) {
    const snapshot = await this.repositories.trash.snapshot();
    const target = found(snapshot[table].find(row => row.id === id && row.is_deleted));
    const selected = this.descendants(snapshot, table, id);
    // Restore only necessary ancestors, without reviving unrelated sibling content.
    const ancestor = async (kind: TrashTable, rowId: string, seen = new Set<string>()) => {
      const key = `${kind}:${rowId}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (kind === 'questions') {
        const q = found(snapshot.questions.find(row => row.id === rowId));
        if (q.material_parent_id) await ancestor('questions', q.material_parent_id, seen);
        if (q.bank_id) await ancestor('question_banks', q.bank_id, seen);
        if (q.paper_id) await ancestor('papers', q.paper_id, seen);
      } else {
        const row = found(snapshot[kind].find(value => value.id === rowId));
        const folder = 'parent_id' in row ? row.parent_id : row.folder_id;
        if (folder) await ancestor('folders', folder, seen);
      }
      await this.repositories.trash.restore(kind, rowId);
    };
    for (const kind of Object.keys(selected) as TrashTable[])
      for (const rowId of selected[kind]) {
        const row = found(snapshot[kind].find(value => value.id === rowId));
        if (rowId === id || (target.deleted_batch_id !== null && row.deleted_batch_id === target.deleted_batch_id))
          await ancestor(kind, rowId);
      }
  }
  async purge(table: TrashTable, id: string) {
    const snapshot = await this.repositories.trash.snapshot();
    found(snapshot[table].find(row => row.id === id && row.is_deleted));
    const selected = this.descendants(snapshot, table, id);
    // Foreign keys require children before parents. Learning data has no content FK.
    for (const kind of ['questions', 'papers', 'question_banks', 'folders'] as const) {
      const rows = snapshot[kind];
      const pending = new Set(selected[kind]);
      while (pending.size) {
        const leaf = found([...pending].find(rowId => !rows.some(row => {
          const parent = 'parent_id' in row ? row.parent_id
            : 'material_parent_id' in row ? row.material_parent_id : null;
          return parent === rowId && pending.has(row.id);
        })));
        await this.repositories.trash.purge(kind, leaf);
        pending.delete(leaf);
      }
    }
  }
  async clear() {
    for (const item of await this.list()) {
      const snapshot = await this.repositories.trash.snapshot();
      if (snapshot[item.entity].some(row => row.id === item.id)) await this.purge(item.entity, item.id);
    }
  }
}

import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { QuarryDatabase } from '../schema/index.js';

export const snapshotTables = ['folders', 'question_banks', 'papers', 'questions', 'paper_items',
  'tags', 'tag_relations', 'study_sessions', 'study_records', 'mistake_records', 'attachments'] as const;
export type DatabaseSnapshot = Record<string, Record<string, unknown>[]>;
export interface ISnapshotRepository {
  capture(): Promise<DatabaseSnapshot>;
  replace(snapshot: DatabaseSnapshot, beforeCommit?: () => Promise<void>): Promise<void>;
}
/** Full table snapshots include soft deleted rows and all learning history. */
export class SqliteSnapshotRepository implements ISnapshotRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}
  async capture(): Promise<DatabaseSnapshot> {
    return this.db.transaction().execute(async transaction => {
      const result: DatabaseSnapshot = {};
      for (const table of snapshotTables) result[table] = await transaction.selectFrom(table).selectAll().execute();
      return result;
    });
  }
  async replace(snapshot: DatabaseSnapshot, beforeCommit?: () => Promise<void>): Promise<void> {
    if (Object.keys(snapshot).length !== snapshotTables.length
      || snapshotTables.some(table => !Array.isArray(snapshot[table]))) throw new Error('Incomplete database snapshot');
    const tables = await this.db.introspection.getTables();
    await this.db.transaction().execute(async transaction => {
      await sql`PRAGMA defer_foreign_keys = ON`.execute(transaction);
      for (const table of [...snapshotTables].reverse()) await transaction.deleteFrom(table).execute();
      for (const table of snapshotTables) {
        const columns = tables.find(entry => entry.name === table)!.columns.map(column => column.name);
        for (const row of snapshot[table]!) {
          const keys = Object.keys(row);
          if (keys.length !== columns.length || keys.some(key => !columns.includes(key)))
            throw new Error(`Invalid columns in ${table}`);
          await sql`INSERT INTO ${sql.table(table)} (${sql.join(keys.map(key => sql.ref(key)))}) VALUES (${sql.join(keys.map(key => sql.val(row[key])))})`.execute(transaction);
        }
      }
      const violations = await sql`PRAGMA foreign_key_check`.execute(transaction);
      if (violations.rows.length) throw new Error('Snapshot contains invalid references');
      await beforeCommit?.();
    });
  }
}

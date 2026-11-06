import type { Kysely } from 'kysely';
import type { QuarryDatabase } from '../schema/index.js';
import type { ContentSnapshot, ITrashRepository, TrashTable } from '../repositories/index.js';

export class SqliteTrashRepository implements ITrashRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}
  async snapshot(): Promise<ContentSnapshot> {
    return {
      folders: await this.db.selectFrom('folders').selectAll().execute(),
      question_banks: await this.db.selectFrom('question_banks').selectAll().execute(),
      papers: await this.db.selectFrom('papers').selectAll().execute(),
      questions: await this.db.selectFrom('questions').selectAll().execute(),
    };
  }
  async restore(table: TrashTable, id: string) {
    await this.db.updateTable(table).set({ is_deleted: 0, deleted_batch_id: null, updated_at: new Date().toISOString() })
      .where('id', '=', id).execute();
  }
  async purge(table: TrashTable, id: string) {
    if (table === 'questions') {
      // The question snapshot in a paper survives loss of its original source.
      const copies = await this.db.selectFrom('paper_items').selectAll()
        .where('source_question_id', '=', id).execute();
      for (const copy of copies) await this.db.updateTable('paper_items').set({ source_invalid: 1,
        historical_source_question_id: copy.historical_source_question_id ?? id })
        .where('id', '=', copy.id).execute();
      await this.db.deleteFrom('paper_items').where('question_id', '=', id).execute();
    }
    await this.db.deleteFrom(table).where('id', '=', id).execute();
  }
}

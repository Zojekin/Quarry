import type { Kysely } from 'kysely';
import type { QuarryDatabase, NewRow, Row, RowPatch } from '../schema/index.js';
import type { IFolderRepository, IQuestionBankRepository, IPaperRepository, IQuestionRepository, ITagRepository, IStudySessionRepository, IMistakeRepository, IAttachmentRepository, Repositories } from '../repositories/index.js';

export class SqliteFolderRepository implements IFolderRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}

  async create(input: NewRow<'folders'>): Promise<Row<'folders'>> {
    return this.db.insertInto('folders').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Row<'folders'> | undefined> {
    return this.db.selectFrom('folders').selectAll().where('id', '=', id).where('is_deleted', '=', 0).executeTakeFirst();
  }

  async list(): Promise<Row<'folders'>[]> {
    return this.db.selectFrom('folders').selectAll().where('is_deleted', '=', 0).orderBy('id').execute();
  }

  async update(id: string, patch: RowPatch<'folders'>): Promise<Row<'folders'> | undefined> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    return this.db.updateTable('folders').set({ ...patch, updated_at: new Date().toISOString() }).where('id', '=', id).where('is_deleted', '=', 0).returningAll().executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.updateTable('folders').set({ is_deleted: 1, updated_at: new Date().toISOString() }).where('id', '=', id).where('is_deleted', '=', 0).executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }
}

export class SqliteQuestionBankRepository implements IQuestionBankRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}

  async create(input: NewRow<'question_banks'>): Promise<Row<'question_banks'>> {
    return this.db.insertInto('question_banks').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Row<'question_banks'> | undefined> {
    return this.db.selectFrom('question_banks').selectAll().where('id', '=', id).where('is_deleted', '=', 0).executeTakeFirst();
  }

  async list(): Promise<Row<'question_banks'>[]> {
    return this.db.selectFrom('question_banks').selectAll().where('is_deleted', '=', 0).orderBy('id').execute();
  }

  async update(id: string, patch: RowPatch<'question_banks'>): Promise<Row<'question_banks'> | undefined> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    return this.db.updateTable('question_banks').set({ ...patch, updated_at: new Date().toISOString() }).where('id', '=', id).where('is_deleted', '=', 0).returningAll().executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.updateTable('question_banks').set({ is_deleted: 1, updated_at: new Date().toISOString() }).where('id', '=', id).where('is_deleted', '=', 0).executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }
}

export class SqlitePaperRepository implements IPaperRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}

  async create(input: NewRow<'papers'>): Promise<Row<'papers'>> {
    return this.db.insertInto('papers').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Row<'papers'> | undefined> {
    return this.db.selectFrom('papers').selectAll().where('id', '=', id).where('is_deleted', '=', 0).executeTakeFirst();
  }

  async list(): Promise<Row<'papers'>[]> {
    return this.db.selectFrom('papers').selectAll().where('is_deleted', '=', 0).orderBy('id').execute();
  }

  async update(id: string, patch: RowPatch<'papers'>): Promise<Row<'papers'> | undefined> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    return this.db.updateTable('papers').set({ ...patch, updated_at: new Date().toISOString() }).where('id', '=', id).where('is_deleted', '=', 0).returningAll().executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.updateTable('papers').set({ is_deleted: 1, updated_at: new Date().toISOString() }).where('id', '=', id).where('is_deleted', '=', 0).executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }

  async addItem(input: NewRow<'paper_items'>): Promise<Row<'paper_items'>> {
    return this.db.insertInto('paper_items').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async listItems(paperId: string): Promise<Row<'paper_items'>[]> {
    return this.db.selectFrom('paper_items').selectAll().where('paper_id', '=', paperId)
      .orderBy('section_index').orderBy('sort_order').orderBy('id').execute();
  }

  async removeItem(id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('paper_items').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}

export class SqliteQuestionRepository implements IQuestionRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}

  async create(input: NewRow<'questions'>): Promise<Row<'questions'>> {
    return this.db.insertInto('questions').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Row<'questions'> | undefined> {
    return this.db.selectFrom('questions').selectAll().where('id', '=', id).where('is_deleted', '=', 0).executeTakeFirst();
  }

  async list(): Promise<Row<'questions'>[]> {
    return this.db.selectFrom('questions').selectAll().where('is_deleted', '=', 0).orderBy('id').execute();
  }

  async update(id: string, patch: RowPatch<'questions'>): Promise<Row<'questions'> | undefined> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    return this.db.updateTable('questions').set({ ...patch, updated_at: new Date().toISOString() }).where('id', '=', id).where('is_deleted', '=', 0).returningAll().executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.updateTable('questions').set({ is_deleted: 1, updated_at: new Date().toISOString() }).where('id', '=', id).where('is_deleted', '=', 0).executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }
}

export class SqliteTagRepository implements ITagRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}

  async create(input: NewRow<'tags'>): Promise<Row<'tags'>> {
    return this.db.insertInto('tags').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Row<'tags'> | undefined> {
    return this.db.selectFrom('tags').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async list(): Promise<Row<'tags'>[]> {
    return this.db.selectFrom('tags').selectAll().orderBy('id').execute();
  }

  async update(id: string, patch: RowPatch<'tags'>): Promise<Row<'tags'> | undefined> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    return this.db.updateTable('tags').set(patch).where('id', '=', id).returningAll().executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('tags').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  async addRelation(input: NewRow<'tag_relations'>): Promise<Row<'tag_relations'>> {
    // Composite FK checks the stored tag namespace; triggers validate target existence.
    return this.db.insertInto('tag_relations').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async listRelations(tagId: string): Promise<Row<'tag_relations'>[]> {
    return this.db.selectFrom('tag_relations').selectAll().where('tag_id', '=', tagId).orderBy('id').execute();
  }

  async removeRelation(id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('tag_relations').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}

export class SqliteStudySessionRepository implements IStudySessionRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}

  async create(input: NewRow<'study_sessions'>): Promise<Row<'study_sessions'>> {
    return this.db.insertInto('study_sessions').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Row<'study_sessions'> | undefined> {
    return this.db.selectFrom('study_sessions').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async list(): Promise<Row<'study_sessions'>[]> {
    return this.db.selectFrom('study_sessions').selectAll().orderBy('id').execute();
  }

  async update(id: string, patch: RowPatch<'study_sessions'>): Promise<Row<'study_sessions'> | undefined> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    return this.db.updateTable('study_sessions').set({ ...patch, updated_at: new Date().toISOString() }).where('id', '=', id).returningAll().executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('study_sessions').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  async addRecord(input: NewRow<'study_records'>): Promise<Row<'study_records'>> {
    return this.db.insertInto('study_records').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async listRecords(sessionId: string): Promise<Row<'study_records'>[]> {
    return this.db.selectFrom('study_records').selectAll().where('session_id', '=', sessionId)
      .orderBy('answered_at').orderBy('attempt_index').orderBy('id').execute();
  }
}

export class SqliteMistakeRepository implements IMistakeRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}

  async create(input: NewRow<'mistake_records'>): Promise<Row<'mistake_records'>> {
    return this.db.insertInto('mistake_records').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Row<'mistake_records'> | undefined> {
    return this.db.selectFrom('mistake_records').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async list(): Promise<Row<'mistake_records'>[]> {
    return this.db.selectFrom('mistake_records').selectAll().orderBy('id').execute();
  }

  async update(id: string, patch: RowPatch<'mistake_records'>): Promise<Row<'mistake_records'> | undefined> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    return this.db.updateTable('mistake_records').set({ ...patch, updated_at: new Date().toISOString() }).where('id', '=', id).returningAll().executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('mistake_records').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}

export class SqliteAttachmentRepository implements IAttachmentRepository {
  constructor(private readonly db: Kysely<QuarryDatabase>) {}

  async create(input: NewRow<'attachments'>): Promise<Row<'attachments'>> {
    return this.db.insertInto('attachments').values(input).returningAll().executeTakeFirstOrThrow();
  }

  async findById(id: string): Promise<Row<'attachments'> | undefined> {
    return this.db.selectFrom('attachments').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async list(): Promise<Row<'attachments'>[]> {
    return this.db.selectFrom('attachments').selectAll().orderBy('id').execute();
  }

  async update(id: string, patch: RowPatch<'attachments'>): Promise<Row<'attachments'> | undefined> {
    if (Object.keys(patch).length === 0) return this.findById(id);
    return this.db.updateTable('attachments').set(patch).where('id', '=', id).returningAll().executeTakeFirst();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('attachments').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  async findBySha256(sha256: string): Promise<Row<'attachments'> | undefined> {
    return this.db.selectFrom('attachments').selectAll().where('sha256', '=', sha256).executeTakeFirst();
  }
}

export function createSqliteRepositories(db: Kysely<QuarryDatabase>): Repositories {
  return {
    folders: new SqliteFolderRepository(db),
    questionBanks: new SqliteQuestionBankRepository(db),
    papers: new SqlitePaperRepository(db),
    questions: new SqliteQuestionRepository(db),
    tags: new SqliteTagRepository(db),
    studySessions: new SqliteStudySessionRepository(db),
    mistakes: new SqliteMistakeRepository(db),
    attachments: new SqliteAttachmentRepository(db),
  };
}

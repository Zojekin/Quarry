import type { NewRow, Row, RowPatch, TableName } from '../schema/index.js';

/** Persistence contracts expose data and promises, never a driver or SQL query builder. */
export interface IRepository<T extends TableName> {
  create(input: NewRow<T>): Promise<Row<T>>;
  findById(id: string): Promise<Row<T> | undefined>;
  list(): Promise<Row<T>[]>;
  update(id: string, patch: RowPatch<T>): Promise<Row<T> | undefined>;
  /** Content deletion moves the row to the recycle bin. Other entities are removed. */
  delete(id: string): Promise<boolean>;
}
export interface IFolderRepository extends IRepository<'folders'> {}
export interface IQuestionBankRepository extends IRepository<'question_banks'> {}
export interface IPaperRepository extends IRepository<'papers'> {
  addItem(input: NewRow<'paper_items'>): Promise<Row<'paper_items'>>;
  listItems(paperId: string): Promise<Row<'paper_items'>[]>;
  removeItem(id: string): Promise<boolean>;
  updateItem(id: string, patch: RowPatch<'paper_items'>): Promise<Row<'paper_items'> | undefined>;
}
export interface IQuestionRepository extends IRepository<'questions'> {}
export interface ITagRepository extends IRepository<'tags'> {
  addRelation(input: NewRow<'tag_relations'>): Promise<Row<'tag_relations'>>;
  listRelations(tagId: string): Promise<Row<'tag_relations'>[]>;
  removeRelation(id: string): Promise<boolean>;
}
export interface IStudySessionRepository extends IRepository<'study_sessions'> {
  addRecord(input: NewRow<'study_records'>): Promise<Row<'study_records'>>;
  listRecords(sessionId: string): Promise<Row<'study_records'>[]>;
}
export interface IMistakeRepository extends IRepository<'mistake_records'> {}
export interface IAttachmentRepository extends IRepository<'attachments'> {
  findBySha256(sha256: string): Promise<Row<'attachments'> | undefined>;
}
export type TrashTable = 'folders' | 'question_banks' | 'papers' | 'questions';
export type ContentSnapshot = { [T in TrashTable]: Row<T>[] };
/** Includes deleted content; mutations are used only inside a transaction. */
export interface ITrashRepository {
  snapshot(): Promise<ContentSnapshot>;
  restore(table: TrashTable, id: string): Promise<void>;
  purge(table: TrashTable, id: string): Promise<void>;
}
export interface Repositories {
  trash: ITrashRepository;
  folders: IFolderRepository;
  questionBanks: IQuestionBankRepository;
  papers: IPaperRepository;
  questions: IQuestionRepository;
  tags: ITagRepository;
  studySessions: IStudySessionRepository;
  mistakes: IMistakeRepository;
  attachments: IAttachmentRepository;
}
export interface ITransactionRunner {
  withTransaction<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

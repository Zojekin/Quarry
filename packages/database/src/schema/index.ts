import type { Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { QuestionType, ScoreMode, SessionStatus } from '@quarry/shared';

/** SQLite stores booleans as constrained integers and timestamps as UTC ISO strings. */
export type SqliteBoolean = 0 | 1;
export type TagNamespace = 'file' | 'question';
export interface EntityTable { id: string; created_at: Generated<string> }
export interface MutableTable extends EntityTable { updated_at: Generated<string> }
export interface SoftDeletedTable extends MutableTable {
  is_deleted: Generated<SqliteBoolean>;
  deleted_batch_id: Generated<string | null>;
}
export interface FoldersTable extends SoftDeletedTable {
  parent_id: string | null;
  name: string;
}
export interface QuestionBanksTable extends SoftDeletedTable {
  folder_id: string | null;
  name: string;
  description: Generated<string>;
}
export interface PapersTable extends QuestionBanksTable {
  composer_json: Generated<string>;
  full_score: Generated<number>;
  score_mode: Generated<`${ScoreMode}`>;
  time_limit_seconds: number | null;
  shuffle_options: Generated<SqliteBoolean>;
  shuffle_sections: Generated<SqliteBoolean>;
  follow_source: Generated<SqliteBoolean>;
}
export interface QuestionsTable extends SoftDeletedTable {
  material: Generated<string | null>;
  bank_id: string | null;
  paper_id: string | null;
  type: `${QuestionType}`;
  stem: string;
  material_parent_id: string | null;
  options_json: string | null;
  blanks_json: string | null;
  standard_answers_json: string | null;
  analysis: Generated<string>;
  full_score: number | null;
  score_mode: `${ScoreMode}` | null;
  fixed_options_order: Generated<SqliteBoolean>;
  version: Generated<number>;
}
export interface PaperItemsTable extends EntityTable {
  historical_source_question_id: Generated<string | null>;
  paper_id: string;
  question_id: string;
  source_question_id: string | null;
  source_version: number | null;
  source_invalid: Generated<SqliteBoolean>;
  section_index: number;
  section_name: string;
  group_id: string | null;
  sort_order: number;
}
export interface TagsTable extends EntityTable { name: string; target_type: TagNamespace; color: Generated<string | null> }
export interface TagRelationsTable extends EntityTable {
  tag_id: string;
  target_type: TagNamespace;
  target_id: string;
}
export interface StudySessionsTable extends MutableTable {
  current_index: Generated<number>;
  draft_answers_json: Generated<string | null>;
  state_json: Generated<string>;
  paper_id: string;
  mode: 'practice' | 'exam';
  status: Generated<`${SessionStatus}`>;
  start_time: string;
  end_time: string | null;
  paused_duration_seconds: Generated<number>;
  effective_duration_seconds: Generated<number>;
}
export interface StudyRecordsTable {
  source_paper_id: Generated<string | null>;
  source_paper_name: Generated<string | null>;
  source_folder_id: Generated<string | null>;
  id: string;
  session_id: string;
  question_id: string;
  attempt_index: number;
  user_answer_json: string;
  score: number | null;
  is_correct: SqliteBoolean | null;
  answered_at: string;
}
export interface MistakeRecordsTable extends MutableTable {
  source_paper_id: Generated<string | null>;
  source_paper_name: Generated<string | null>;
  source_folder_id: Generated<string | null>;
  history_json: Generated<string>;
  source_question_id: string | null;
  source_version: number | null;
  question_snapshot_json: string;
  last_user_answer_json: string;
  mastery_status: Generated<'reviewing' | 'mastered'>;
  wrong_count: Generated<number>;
  last_wrong_at: string;
}
export interface AttachmentsTable extends EntityTable {
  sha256: string;
  filename: string;
  mime_type: string;
  file_size: number;
}
export interface QuarryDatabase {
  folders: FoldersTable;
  question_banks: QuestionBanksTable;
  papers: PapersTable;
  questions: QuestionsTable;
  paper_items: PaperItemsTable;
  tags: TagsTable;
  tag_relations: TagRelationsTable;
  study_sessions: StudySessionsTable;
  study_records: StudyRecordsTable;
  mistake_records: MistakeRecordsTable;
  attachments: AttachmentsTable;
}
export type TableName = keyof QuarryDatabase;
export type Row<T extends TableName> = Selectable<QuarryDatabase[T]>;
export type NewRow<T extends TableName> = Insertable<QuarryDatabase[T]>;
export type RowPatch<T extends TableName> = Omit<Updateable<QuarryDatabase[T]>, 'id' | 'created_at'>;

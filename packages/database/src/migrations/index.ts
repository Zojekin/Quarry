import { Migrator, sql } from 'kysely';
import type { Kysely, Migration } from 'kysely';
import type { QuarryDatabase } from '../schema/index.js';

// Historical study/mistake identities deliberately have no content foreign keys:
// deleting source content must never erase or rewrite learning history.
const initialSchema: Migration = {
  async up(db) {
    const statements = [
      "CREATE TABLE folders (id TEXT PRIMARY KEY NOT NULL, parent_id TEXT REFERENCES folders(id), name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)), CHECK(parent_id IS NULL OR parent_id <> id))",
      "CREATE TABLE question_banks (id TEXT PRIMARY KEY NOT NULL, folder_id TEXT REFERENCES folders(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)))",
      "CREATE TABLE papers (id TEXT PRIMARY KEY NOT NULL, folder_id TEXT REFERENCES folders(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', full_score REAL NOT NULL DEFAULT 0 CHECK(full_score >= 0), score_mode TEXT NOT NULL DEFAULT 'all_or_nothing' CHECK(score_mode IN ('all_or_nothing','proportional')), time_limit_seconds INTEGER CHECK(time_limit_seconds > 0), shuffle_options INTEGER NOT NULL DEFAULT 0 CHECK(shuffle_options IN (0,1)), shuffle_sections INTEGER NOT NULL DEFAULT 0 CHECK(shuffle_sections IN (0,1)), follow_source INTEGER NOT NULL DEFAULT 0 CHECK(follow_source IN (0,1)), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)))",
      "CREATE TABLE questions (id TEXT PRIMARY KEY NOT NULL, bank_id TEXT REFERENCES question_banks(id), paper_id TEXT REFERENCES papers(id), type TEXT NOT NULL CHECK(type IN ('single_choice','multiple_choice','indefinite_choice','strict_fill_in_blank','free_fill_in_blank','subjective')), stem TEXT NOT NULL, material_parent_id TEXT REFERENCES questions(id), options_json TEXT CHECK(options_json IS NULL OR json_valid(options_json)), blanks_json TEXT CHECK(blanks_json IS NULL OR json_valid(blanks_json)), standard_answers_json TEXT CHECK(standard_answers_json IS NULL OR json_valid(standard_answers_json)), analysis TEXT NOT NULL DEFAULT '', full_score REAL CHECK(full_score >= 0), score_mode TEXT CHECK(score_mode IN ('all_or_nothing','proportional')), fixed_options_order INTEGER NOT NULL DEFAULT 0 CHECK(fixed_options_order IN (0,1)), version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)), CHECK((bank_id IS NOT NULL) <> (paper_id IS NOT NULL)), CHECK(material_parent_id IS NULL OR material_parent_id <> id))",
      "CREATE TABLE paper_items (id TEXT PRIMARY KEY NOT NULL, paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE, question_id TEXT NOT NULL REFERENCES questions(id), source_question_id TEXT REFERENCES questions(id) ON DELETE SET NULL, source_version INTEGER CHECK(source_version > 0), source_invalid INTEGER NOT NULL DEFAULT 0 CHECK(source_invalid IN (0,1)), section_index INTEGER NOT NULL CHECK(section_index >= 0), section_name TEXT NOT NULL, group_id TEXT, sort_order INTEGER NOT NULL CHECK(sort_order >= 0), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(paper_id,question_id))",
      "CREATE TABLE tags (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, target_type TEXT NOT NULL CHECK(target_type IN ('file','question')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(id,target_type), UNIQUE(name,target_type))",
      "CREATE TABLE tag_relations (id TEXT PRIMARY KEY NOT NULL, tag_id TEXT NOT NULL, target_type TEXT NOT NULL CHECK(target_type IN ('file','question')), target_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), FOREIGN KEY(tag_id,target_type) REFERENCES tags(id,target_type) ON DELETE CASCADE, UNIQUE(tag_id,target_type,target_id))",
      "CREATE TABLE study_sessions (id TEXT PRIMARY KEY NOT NULL, paper_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('practice','exam')), status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','paused','completed','abandoned')), start_time TEXT NOT NULL, end_time TEXT, paused_duration_seconds REAL NOT NULL DEFAULT 0 CHECK(paused_duration_seconds >= 0), effective_duration_seconds REAL NOT NULL DEFAULT 0 CHECK(effective_duration_seconds >= 0), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
      "CREATE TABLE study_records (id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE, question_id TEXT NOT NULL, attempt_index INTEGER NOT NULL CHECK(attempt_index >= 1), user_answer_json TEXT NOT NULL CHECK(json_valid(user_answer_json)), score REAL CHECK(score >= 0), is_correct INTEGER CHECK(is_correct IN (0,1)), answered_at TEXT NOT NULL, UNIQUE(session_id,question_id,attempt_index))",
      "CREATE TABLE mistake_records (id TEXT PRIMARY KEY NOT NULL, source_question_id TEXT, source_version INTEGER CHECK(source_version > 0), question_snapshot_json TEXT NOT NULL CHECK(json_valid(question_snapshot_json)), last_user_answer_json TEXT NOT NULL CHECK(json_valid(last_user_answer_json)), mastery_status TEXT NOT NULL DEFAULT 'reviewing' CHECK(mastery_status IN ('reviewing','mastered')), wrong_count INTEGER NOT NULL DEFAULT 1 CHECK(wrong_count > 0), last_wrong_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), CHECK((source_question_id IS NULL) = (source_version IS NULL)), UNIQUE(source_question_id,source_version))",
      "CREATE TABLE attachments (id TEXT PRIMARY KEY NOT NULL, sha256 TEXT NOT NULL UNIQUE CHECK(length(sha256) = 64), filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL CHECK(file_size >= 0), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
      "CREATE INDEX idx_folders_parent_id ON folders (parent_id)",
      "CREATE INDEX idx_question_banks_folder_id ON question_banks (folder_id)",
      "CREATE INDEX idx_papers_folder_id ON papers (folder_id)",
      "CREATE INDEX idx_questions_bank_id ON questions (bank_id)",
      "CREATE INDEX idx_questions_paper_id ON questions (paper_id)",
      "CREATE INDEX idx_questions_material_parent_id ON questions (material_parent_id)",
      "CREATE INDEX idx_paper_items_paper_id ON paper_items (paper_id)",
      "CREATE INDEX idx_paper_items_question_id ON paper_items (question_id)",
      "CREATE INDEX idx_paper_items_source_question_id ON paper_items (source_question_id)",
      "CREATE INDEX idx_tag_relations_target_type_target_id ON tag_relations (target_type,target_id)",
      "CREATE INDEX idx_study_sessions_paper_id ON study_sessions (paper_id)",
      "CREATE INDEX idx_study_records_question_id ON study_records (question_id)",
      "CREATE TRIGGER validate_tag_target_insert BEFORE INSERT ON tag_relations WHEN NOT ((NEW.target_type = 'question' AND EXISTS(SELECT 1 FROM questions WHERE id = NEW.target_id)) OR (NEW.target_type = 'file' AND (EXISTS(SELECT 1 FROM folders WHERE id = NEW.target_id) OR EXISTS(SELECT 1 FROM question_banks WHERE id = NEW.target_id) OR EXISTS(SELECT 1 FROM papers WHERE id = NEW.target_id)))) BEGIN SELECT RAISE(ABORT, 'Invalid tag target namespace or missing target'); END",
      "CREATE TRIGGER validate_tag_target_update BEFORE UPDATE ON tag_relations WHEN NOT ((NEW.target_type = 'question' AND EXISTS(SELECT 1 FROM questions WHERE id = NEW.target_id)) OR (NEW.target_type = 'file' AND (EXISTS(SELECT 1 FROM folders WHERE id = NEW.target_id) OR EXISTS(SELECT 1 FROM question_banks WHERE id = NEW.target_id) OR EXISTS(SELECT 1 FROM papers WHERE id = NEW.target_id)))) BEGIN SELECT RAISE(ABORT, 'Invalid tag target namespace or missing target'); END",
      "CREATE TRIGGER cleanup_folders_tags AFTER DELETE ON folders BEGIN DELETE FROM tag_relations WHERE target_id = OLD.id AND target_type = 'file'; END",
      "CREATE TRIGGER cleanup_question_banks_tags AFTER DELETE ON question_banks BEGIN DELETE FROM tag_relations WHERE target_id = OLD.id AND target_type = 'file'; END",
      "CREATE TRIGGER cleanup_papers_tags AFTER DELETE ON papers BEGIN DELETE FROM tag_relations WHERE target_id = OLD.id AND target_type = 'file'; END",
      "CREATE TRIGGER cleanup_questions_tags AFTER DELETE ON questions BEGIN DELETE FROM tag_relations WHERE target_id = OLD.id AND target_type = 'question'; END"
    ];
    for (const statement of statements) await sql.raw(statement).execute(db);
  },
};

/** Versioned, transactional and safe to call again when reopening a database. */
export async function initializeDatabase(db: Kysely<QuarryDatabase>): Promise<void> {
  await sql`PRAGMA foreign_keys = ON`.execute(db);
  await sql`PRAGMA journal_mode = WAL`.execute(db);
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() { return { '001_initial_schema': initialSchema,
        '002_batch_a_content': { async up(database) {
          await sql`ALTER TABLE papers ADD COLUMN composer_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(composer_json))`.execute(database);
          await sql`ALTER TABLE questions ADD COLUMN material TEXT`.execute(database);
        } },
        '003_batch_b_study': { async up(database) {
          await sql`ALTER TABLE paper_items ADD COLUMN historical_source_question_id TEXT`.execute(database);
          await sql`ALTER TABLE study_sessions ADD COLUMN state_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(state_json))`.execute(database);
          await sql`ALTER TABLE mistake_records ADD COLUMN history_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(history_json))`.execute(database);
        } },
        '004_batch_b_trash': { async up(database) {
          for (const table of ['folders', 'question_banks', 'papers', 'questions'])
            await sql.raw(`ALTER TABLE ${table} ADD COLUMN deleted_batch_id TEXT`).execute(database);
        } },
      }; },
    },
  });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
}

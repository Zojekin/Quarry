import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { QuarryDatabase } from '../schema/index.js';
import type { ITransactionRunner, Repositories } from '../repositories/index.js';
import { initializeDatabase } from '../migrations/index.js';
import { createSqliteRepositories } from './repositories.js';

export * from './repositories.js';

export interface SqliteDatabase extends ITransactionRunner {
  db: Kysely<QuarryDatabase>;
  repositories: Repositories;
  destroy(): Promise<void>;
}

export async function withTransaction<T>(
  db: Kysely<QuarryDatabase>,
  work: (repositories: Repositories) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(transaction => work(createSqliteRepositories(transaction)));
}

/** Each connection is configured before it can execute application queries. */
export async function createSqliteDatabase(path: string | ':memory:'): Promise<SqliteDatabase> {
  const connection = new BetterSqlite3(path);
  let db: Kysely<QuarryDatabase> | undefined;
  try {
    connection.pragma('foreign_keys = ON');
    connection.pragma('journal_mode = WAL');
    connection.pragma('busy_timeout = 5000');
    db = new Kysely<QuarryDatabase>({ dialect: new SqliteDialect({ database: connection }) });
    await initializeDatabase(db);
    const database = db;
    return {
      db: database,
      repositories: createSqliteRepositories(database),
      withTransaction: work => withTransaction(database, work),
      destroy: () => database.destroy(),
    };
  } catch (error) {
    if (db) await db.destroy();
    else connection.close();
    throw error;
  }
}

export class SqliteDatabaseFactory {
  static create = createSqliteDatabase;
}

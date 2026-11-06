import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Kysely } from 'kysely';
import { createSqliteRepositories, withTransaction } from '@quarry/database';
import type { ITransactionRunner, QuarryDatabase, Repositories } from '@quarry/database';
import { AppError, ErrorCode } from '@quarry/shared';
import { createHealthRoutes } from './routes/health.js';
import { createAttachmentRoutes } from './routes/attachments.js';
import { createFolderRoutes } from './routes/folders.js';
import { createBankRoutes } from './routes/banks.js';
import { createQuestionRoutes } from './routes/questions.js';
import { createTagRoutes } from './routes/tags.js';
import { createPaperRoutes } from './routes/papers.js';
import type { IAttachmentStorage } from './services/attachment.service.js';

export interface QuarryServerOptions {
  db: Kysely<QuarryDatabase>;
  repositories?: Repositories;
  attachmentsDir?: string;
  attachmentStorage?: IAttachmentStorage;
  withTransaction?: ITransactionRunner['withTransaction'];
}

export type QuarryServerEnv = {
  Variables: { repositories: Repositories; attachmentsDir: string | undefined;
    attachmentStorage: IAttachmentStorage | undefined; withTransaction: ITransactionRunner['withTransaction'] };
};

function localOrigin(origin: string): string | undefined {
  try {
    const url = new URL(origin);
    if (['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return origin;
  } catch { /* Invalid origins receive no CORS permission. */ }
  return undefined;
}

/** Compose an app without opening a listener or owning the supplied database. */
export function createQuarryServer(options: QuarryServerOptions) {
  const repositories = options.repositories ?? createSqliteRepositories(options.db);
  const app = new Hono<QuarryServerEnv>();

  app.use('*', cors({ origin: localOrigin }));
  app.use('*', async (context, next) => {
    context.set('repositories', repositories);
    context.set('attachmentsDir', options.attachmentsDir);
    context.set('attachmentStorage', options.attachmentStorage);
    context.set('withTransaction', options.withTransaction ?? (options.repositories
      ? async () => { throw new AppError(ErrorCode.InvalidState, 'Injected repositories require a withTransaction implementation for writes'); }
      : work => withTransaction(options.db, work)));
    await next();
  });
  app.onError((error, context) => {
    if (error instanceof AppError) {
      return context.json({ success: false as const, error: error.toJSON() },
        error.statusCode as ContentfulStatusCode);
    }
    return context.json({ success: false as const, error: {
      code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error', details: null, statusCode: 500,
    } }, 500);
  });
  app.notFound(context => context.json({ success: false as const,
    error: new AppError(ErrorCode.NotFound, 'Not found').toJSON(),
  }, 404));

  return app.route('/api', createHealthRoutes(options.db))
    .route('/api/attachments', createAttachmentRoutes())
    .route('/api/folders', createFolderRoutes())
    .route('/api/banks', createBankRoutes())
    .route('/api/questions', createQuestionRoutes())
    .route('/api/tags', createTagRoutes())
    .route('/api/papers', createPaperRoutes());
}

export type AppType = ReturnType<typeof createQuarryServer>;

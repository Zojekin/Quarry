import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hc } from 'hono/client';
import { createSqliteDatabase } from '@quarry/database';
import type { SqliteDatabase } from '@quarry/database';
import { AppError, ErrorCode } from '@quarry/shared';
import { createQuarryServer } from '../src/index.js';
import type { AppType } from '../src/index.js';

let database: SqliteDatabase;
beforeEach(async () => { database = await createSqliteDatabase(':memory:'); });
afterEach(async () => { await database.destroy(); });

describe('Quarry server', () => {
  it('returns health through the typed RPC client with a live database', async () => {
    const app = createQuarryServer({ db: database.db });
    const client = hc<AppType>('http://localhost', {
      fetch: (input, init) => app.request(input, init),
    });
    const before = Date.now();
    const response = await client.api.health.$get();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, data: {
      status: 'ok', version: '0.1.0', timestamp: expect.any(Number), database: 'connected',
    } });
    expect(body.data.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.data.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('preserves AppError status overrides and structured details', async () => {
    const app = createQuarryServer({ db: database.db });
    const error = new AppError(ErrorCode.ValidationError, 'Invalid input', { field: 'name' }, 422);
    app.get('/failure', () => { throw error; });
    const response = await app.request('/failure');
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ success: false, error: error.toJSON() });
  });

  it('returns the standard not-found body', async () => {
    const response = await createQuarryServer({ db: database.db }).request('/missing');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: {
      code: 'NOT_FOUND', message: 'Not found', details: null, statusCode: 404,
    } });
  });

  it('hides unexpected error details', async () => {
    const app = createQuarryServer({ db: database.db });
    app.get('/failure', async () => { throw new Error('private database credentials'); });
    const response = await app.request('/failure');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: {
      code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error', details: null, statusCode: 500,
    } });
  });

  it('does not report connected when the database is unavailable', async () => {
    const app = createQuarryServer({ db: database.db });
    await database.destroy();
    expect((await app.request('/api/health')).status).toBe(500);
  });

  it('injects supplied repositories and attachment configuration', async () => {
    const app = createQuarryServer({ db: database.db,
      repositories: database.repositories, attachmentsDir: 'attachments',
    });
    app.get('/dependencies', context => context.json({
      same: context.get('repositories') === database.repositories,
      directory: context.get('attachmentsDir'),
    }));
    expect(await (await app.request('/dependencies')).json())
      .toEqual({ same: true, directory: 'attachments' });
  });

  it('requires a matching snapshot adapter when repositories are injected', async () => {
    const app = createQuarryServer({ db: database.db, repositories: database.repositories,
      withTransaction: work => database.withTransaction(work) });
    const response = await app.request('/api/backup/create', { method: 'POST' });
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toContain('snapshotRepository');
  });

  it.each(['http://localhost:5173', 'http://127.0.0.1:8080', 'http://[::1]:3000'])
    ('allows local CORS preflight for %s', async origin => {
      const response = await createQuarryServer({ db: database.db }).request('/api/health', {
        method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    });

  it.each(['https://example.com', 'http://localhost.evil.test', 'null'])
    ('does not grant CORS to %s', async origin => {
      const response = await createQuarryServer({ db: database.db }).request('/api/health', {
        headers: { Origin: origin },
      });
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
});

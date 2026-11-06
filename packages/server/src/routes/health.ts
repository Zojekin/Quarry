import { Hono } from 'hono';
import type { Kysely } from 'kysely';
import type { QuarryDatabase } from '@quarry/database';

export function createHealthRoutes(db: Kysely<QuarryDatabase>) {
  return new Hono().get('/health', async context => {
    await db.selectNoFrom(eb => eb.val(1).as('health')).executeTakeFirstOrThrow();
    return context.json({ success: true as const, data: {
      status: 'ok' as const, version: '0.1.0' as const,
      timestamp: Date.now(), database: 'connected' as const,
    } });
  });
}

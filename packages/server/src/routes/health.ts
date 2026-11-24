import { Hono } from 'hono';
import type { Repositories } from '@quarry/database';
import serverPackage from '../../package.json' with { type: 'json' };

export function createHealthRoutes(repositories: Repositories) {
  return new Hono().get('/health', async context => {
    await repositories.checkConnection();
    return context.json({ success: true as const, data: {
      status: 'ok' as const, version: serverPackage.version,
      timestamp: Date.now(), database: 'connected' as const,
    } });
  });
}

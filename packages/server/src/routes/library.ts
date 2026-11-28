import { Hono } from 'hono';
import { LibraryTransferSchema } from '@quarry/shared';
import type { QuarryServerEnv } from '../app.js';
import { body, parse } from '../services/common.js';
import { LibraryService } from '../services/library.service.js';

export function createLibraryRoutes() {
  const app = new Hono<QuarryServerEnv>();
  for (const action of ['move', 'copy'] as const) {
    app.post(`/${action}`, async c => {
      const input = parse(LibraryTransferSchema, await body(c));
      const data = await c.get('withTransaction')(repositories => new LibraryService(repositories)[action](input));
      return c.json({ success: true, data }, action === 'copy' ? 201 : 200);
    });
  }
  return app;
}

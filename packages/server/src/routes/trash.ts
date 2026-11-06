import { Hono } from 'hono';
import { z } from 'zod';
import type { QuarryServerEnv } from '../app.js';
import { parse } from '../services/common.js';
import { TrashService } from '../services/trash.service.js';

const entitySchema = z.enum(['folders', 'question_banks', 'papers', 'questions']);
export function createTrashRoutes() {
  return new Hono<QuarryServerEnv>()
    .get('/', async c => c.json({ success: true, data: await new TrashService(c.get('repositories')).list() }))
    .post('/:entity/:id/restore', async c => {
      const entity = parse(entitySchema, c.req.param('entity'));
      await c.get('withTransaction')(r => new TrashService(r).restore(entity, c.req.param('id')));
      return c.json({ success: true, data: null });
    })
    .delete('/:entity/:id', async c => {
      const entity = parse(entitySchema, c.req.param('entity'));
      await c.get('withTransaction')(r => new TrashService(r).purge(entity, c.req.param('id')));
      return c.json({ success: true, data: null });
    })
    .delete('/', async c => {
      await c.get('withTransaction')(r => new TrashService(r).clear());
      return c.json({ success: true, data: null });
    });
}

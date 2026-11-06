import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { AppError, ErrorCode, TagRelationSchema } from '@quarry/shared';
import type { QuarryServerEnv } from '../app.js';
import { body, nameSchema, parse } from '../services/common.js';
import { TagService } from '../services/tag.service.js';

const inputSchema = z.strictObject({ name: nameSchema, target_type: z.enum(['file', 'question']) });
export function createTagRoutes() {
  return new Hono<QuarryServerEnv>()
    .get('/', async c => {
      const namespace = c.req.query('target_type');
      if (namespace) parse(z.enum(['file', 'question']), namespace);
      const data = (await c.get('repositories').tags.list()).filter(t => !namespace || t.target_type === namespace);
      return c.json({ success: true, data });
    })
    .post('/', async c => {
      const input = parse(inputSchema, await body(c));
      const data = await c.get('withTransaction')(async r => {
        if ((await r.tags.list()).some(t => t.name === input.name && t.target_type === input.target_type))
          throw new AppError(ErrorCode.Conflict, 'Tag already exists');
        return r.tags.create({ id: randomUUID(), ...input });
      });
      return c.json({ success: true, data }, 201);
    })
    .post('/:id/relations', async c => {
      const input = parse(TagRelationSchema, { ...await body(c), tag_id: c.req.param('id') });
      const data = await c.get('withTransaction')(async r => {
        const service = new TagService(r);
        await service.target(input.target_id, input.entity_type, input.target_type);
        return service.attach(input.tag_id, input.target_id, input.target_type);
      });
      return c.json({ success: true, data }, 201);
    })
    .delete('/:id/relations', async c => {
      const input = parse(TagRelationSchema, { ...await body(c), tag_id: c.req.param('id') });
      await c.get('withTransaction')(async r => {
        const service = new TagService(r);
        await service.target(input.target_id, input.entity_type, input.target_type);
        await service.detach(input.tag_id, input.target_id, input.target_type);
      });
      return c.json({ success: true, data: null });
    });
}

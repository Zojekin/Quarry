import { Hono } from 'hono';
import type { QuarryServerEnv } from '../app.js';
import { body, filterIds, found } from '../services/common.js';
import { MistakeService } from '../services/mistake.service.js';
export function createMistakeRoutes() {
  return new Hono<QuarryServerEnv>()
    .get('/', async c => c.json({ success: true, data: await new MistakeService(c.get('repositories')).list({
      ...c.req.query(), tags: filterIds(c.req.query('tags')),
      ...Object.fromEntries(['types', 'source_paper_ids', 'folder_ids', 'tag_ids', 'ids'].filter(key => c.req.query(key) !== undefined).map(key =>
        [key, c.req.queries(key)!.flatMap(value => value.split(',').filter(Boolean))])) }) }))
    .get('/:id', async c => c.json({ success: true, data: new MistakeService(c.get('repositories')).view(
      found(await c.get('repositories').mistakes.findById(c.req.param('id')))) }))
    .post('/', async c => { const input = await body(c); return c.json({ success: true,
      data: await c.get('withTransaction')(r => new MistakeService(r).manual(input)) }, 201); })
    .put('/:id/mastery', async c => { const input = await body(c); return c.json({ success: true,
      data: await c.get('withTransaction')(r => new MistakeService(r).mastery(c.req.param('id'), input)) }); })
    .post('/create-paper', async c => { const input = await body(c); return c.json({ success: true,
      data: await c.get('withTransaction')(r => new MistakeService(r).createPaper(input)) }, 201); });
}

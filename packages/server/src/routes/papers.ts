import { Hono } from 'hono';
import type { QuarryServerEnv } from '../app.js';
import { body, filterIds } from '../services/common.js';
import { PaperService } from '../services/paper.service.js';

export function createPaperRoutes() {
  return new Hono<QuarryServerEnv>()
    .get('/', async c => {
      const service = new PaperService(c.get('repositories'));
      const tags = filterIds(c.req.query('tags'));
      await service.questions.tags.validate(tags, 'file');
      const data = [];
      for (const paper of await service.repositories.papers.list()) {
        if (c.req.query('folder_id') && paper.folder_id !== c.req.query('folder_id')) continue;
        if (c.req.query('search') && !paper.name.includes(c.req.query('search')!)) continue;
        if (await service.questions.tags.matches(paper.id, 'file', tags)) data.push(await service.get(paper.id));
      }
      return c.json({ success: true, data });
    })
    .get('/:id', async c => c.json({ success: true,
      data: await new PaperService(c.get('repositories')).get(c.req.param('id')) }))
    .post('/', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new PaperService(r).save(input));
      return c.json({ success: true, data }, 201);
    })
    .put('/:id', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new PaperService(r).save(input, c.req.param('id')));
      return c.json({ success: true, data });
    })
    .delete('/:id', async c => {
      await c.get('withTransaction')(r => new PaperService(r).delete(c.req.param('id')));
      return c.json({ success: true, data: null });
    })
    .post('/:id/items', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new PaperService(r).addItem(c.req.param('id'), input));
      return c.json({ success: true, data }, 201);
    })
    .delete('/:id/items/:itemId', async c => {
      await c.get('withTransaction')(r => new PaperService(r).removeItem(c.req.param('id'), c.req.param('itemId')));
      return c.json({ success: true, data: null });
    })
    .get('/:id/follow-diff', async c => c.json({ success: true,
      data: await new PaperService(c.get('repositories')).diff(c.req.param('id')) }))
    .post('/:id/apply-follow', async c => {
      const data = await c.get('withTransaction')(r => new PaperService(r).applyFollow(c.req.param('id')));
      return c.json({ success: true, data });
    });
}

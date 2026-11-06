import { Hono } from 'hono';
import type { QuarryServerEnv } from '../app.js';
import { body, filterIds } from '../services/common.js';
import { ContentService } from '../services/content.service.js';

export function createBankRoutes() {
  return new Hono<QuarryServerEnv>()
    .get('/', async c => {
      const service = new ContentService(c.get('repositories'));
      const tags = filterIds(c.req.query('tags'));
      await service.tags.validate(tags, 'file');
      const data = [];
      for (const bank of await service.repositories.questionBanks.list()) {
        if (c.req.query('folder_id') && bank.folder_id !== c.req.query('folder_id')) continue;
        if (c.req.query('search') && !bank.name.includes(c.req.query('search')!)) continue;
        if (await service.tags.matches(bank.id, 'file', tags)) data.push(await service.bank(bank.id));
      }
      return c.json({ success: true, data });
    })
    .get('/:id', async c => c.json({ success: true,
      data: await new ContentService(c.get('repositories')).bank(c.req.param('id')) }))
    .post('/', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new ContentService(r).saveBank(input));
      return c.json({ success: true, data }, 201);
    })
    .put('/:id', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new ContentService(r).saveBank(input, c.req.param('id')));
      return c.json({ success: true, data });
    })
    .delete('/:id', async c => {
      await c.get('withTransaction')(r => new ContentService(r).deleteBank(c.req.param('id')));
      return c.json({ success: true, data: null });
    });
}

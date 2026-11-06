import { Hono } from 'hono';
import type { QuarryServerEnv } from '../app.js';
import { body, filterIds } from '../services/common.js';
import { ContentService } from '../services/content.service.js';

export function createFolderRoutes() {
  return new Hono<QuarryServerEnv>()
    .get('/', async c => {
      const service = new ContentService(c.get('repositories'));
      const tags = filterIds(c.req.query('tags'));
      await service.tags.validate(tags, 'file');
      const rows = await service.repositories.folders.list();
      const folders = [];
      for (const row of rows) if (await service.tags.matches(row.id, 'file', tags)) folders.push(await service.folder(row.id));
      if (c.req.query('tree') === 'true') {
        type Node = (typeof folders)[number] & { children: Node[] };
        const nodes = new Map<string, Node>(folders.map(f => [f.id, { ...f, children: [] }]));
        const roots: Node[] = [];
        for (const node of nodes.values()) {
          const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
          if (parent) parent.children.push(node); else roots.push(node);
        }
        return c.json({ success: true, data: roots });
      }
      return c.json({ success: true, data: folders });
    })
    .get('/:id', async c => c.json({ success: true,
      data: await new ContentService(c.get('repositories')).folder(c.req.param('id')) }))
    .post('/', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new ContentService(r).saveFolder(input));
      return c.json({ success: true, data }, 201);
    })
    .put('/:id', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new ContentService(r).saveFolder(input, c.req.param('id')));
      return c.json({ success: true, data });
    })
    .delete('/:id', async c => {
      await c.get('withTransaction')(r => new ContentService(r).deleteFolder(c.req.param('id')));
      return c.json({ success: true, data: null });
    });
}

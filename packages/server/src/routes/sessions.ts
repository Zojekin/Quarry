import { Hono } from 'hono';
import type { QuarryServerEnv } from '../app.js';
import { body } from '../services/common.js';
import { SessionService } from '../services/session.service.js';
export function createSessionRoutes() {
  return new Hono<QuarryServerEnv>()
    .get('/', async c => c.json({ success: true, data: await Promise.all((await c.get('repositories').studySessions.list()).map(r => new SessionService(c.get('repositories')).get(r.id))) }))
    .get('/:id', async c => c.json({ success: true, data: await new SessionService(c.get('repositories')).get(c.req.param('id')) }))
    .post('/', async c => { const input = await body(c); return c.json({ success: true,
      data: await c.get('withTransaction')(r => new SessionService(r).start(input)) }, 201); })
    .post('/:id/submit-question', async c => { const input = await body(c); return c.json({ success: true,
      data: await c.get('withTransaction')(r => new SessionService(r).submitQuestion(c.req.param('id'), input)) }); })
    .post('/:id/submit-exam', async c => { const input = await body(c); return c.json({ success: true,
      data: await c.get('withTransaction')(r => new SessionService(r).submitExam(c.req.param('id'), input)) }); })
    .post('/:id/pause', async c => c.json({ success: true,
      data: await c.get('withTransaction')(r => new SessionService(r).pause(c.req.param('id'))) }))
    .post('/:id/resume', async c => c.json({ success: true,
      data: await c.get('withTransaction')(r => new SessionService(r).pause(c.req.param('id'), true)) }));
}

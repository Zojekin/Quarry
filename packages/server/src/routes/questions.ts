import { Hono } from 'hono';
import { z } from 'zod';
import { QuestionType } from '@quarry/shared';
import type { QuarryServerEnv } from '../app.js';
import { body, filterIds, parse } from '../services/common.js';
import { QuestionService } from '../services/question.service.js';
import { PaperService } from '../services/paper.service.js';

export function createQuestionRoutes() {
  return new Hono<QuarryServerEnv>()
    .get('/', async c => {
      const service = new QuestionService(c.get('repositories'));
      const tags = filterIds(c.req.query('tags'));
      await service.tags.validate(tags, 'question');
      const type = c.req.query('type');
      if (type) parse(z.enum(QuestionType), type);
      const data = [];
      const bankIds = new Set((await service.repositories.questionBanks.list()).map(b => b.id));
      const paperIds = new Set((await service.repositories.papers.list()).map(p => p.id));
      for (const row of await service.repositories.questions.list()) {
        if (row.bank_id ? !bankIds.has(row.bank_id) : !paperIds.has(row.paper_id!)) continue;
        if (type && row.type !== type) continue;
        if (c.req.query('bank_id') && row.bank_id !== c.req.query('bank_id')) continue;
        if (c.req.query('paper_id') && row.paper_id !== c.req.query('paper_id')) continue;
        const search = c.req.query('search')?.toLocaleLowerCase();
        if (search && ![row.stem, row.analysis, row.material, row.options_json, row.standard_answers_json,
          row.blanks_json].some(value => value?.toLocaleLowerCase().includes(search))) continue;
        if (await service.tags.matches(row.id, 'question', tags)) data.push(await service.view(row));
      }
      return c.json({ success: true, data });
    })
    .get('/:id', async c => c.json({ success: true,
      data: await new QuestionService(c.get('repositories')).get(c.req.param('id')) }))
    .post('/', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new QuestionService(r).save(input));
      return c.json({ success: true, data }, 201);
    })
    .put('/:id', async c => {
      const input = await body(c);
      const data = await c.get('withTransaction')(r => new QuestionService(r).save(input, c.req.param('id')));
      return c.json({ success: true, data });
    })
    .delete('/:id', async c => {
      await c.get('withTransaction')(async r => {
        const service = new QuestionService(r);
        await service.get(c.req.param('id'));
        const ids = new Set([c.req.param('id')]);
        const rows = await r.questions.list();
        let previous = 0;
        while (previous !== ids.size) {
          previous = ids.size;
          for (const q of rows) if (q.material_parent_id && ids.has(q.material_parent_id)) ids.add(q.id);
        }
        for (const id of ids) {
          const q = await r.questions.findById(id);
          if (q?.paper_id) for (const item of await r.papers.listItems(q.paper_id))
            if (item.question_id === id) await new PaperService(r).removeItem(q.paper_id, item.id);
          await r.questions.delete(id);
        }
      });
      return c.json({ success: true, data: null });
    });
}

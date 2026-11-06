import { Hono } from 'hono';
import type { QuarryServerEnv } from '../app.js';
import type { StudyAnswer } from '@quarry/shared';
import { answered } from '../services/session.service.js';
import type { SessionState } from '../services/session.service.js';
export function createAnalyticsRoutes() {
  return new Hono<QuarryServerEnv>().get('/dashboard', async c => {
    const repositories = c.get('repositories');
    const days = new Map<string, { date: string; count: number; duration_seconds: number }>();
    const day = (date: string) => { let value = days.get(date); if (!value) { value = { date, count: 0, duration_seconds: 0 }; days.set(date, value); } return value; };
    const unique = new Set<string>();
    let count = 0;
    let duration = 0;
    for (const session of await repositories.studySessions.list()) {
      const state = JSON.parse(session.state_json) as Partial<SessionState>;
      duration += session.effective_duration_seconds;
      for (const metric of state.daily_metrics ?? []) day(metric.date).duration_seconds += metric.seconds;
      for (const record of await repositories.studySessions.listRecords(session.id)) {
        if (session.mode === 'exam' && !answered(JSON.parse(record.user_answer_json) as StudyAnswer)) continue;
        count++;
        const item = state.items?.find(i => i.question.id === record.question_id);
        unique.add(item?.source_question_id ?? record.question_id);
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: state.time_zone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(record.answered_at));
        const value = (type: string) => parts.find(p => p.type === type)!.value;
        day(`${value('year')}-${value('month')}-${value('day')}`).count++;
      }
    }
    return c.json({ success: true, data: { total_questions_answered: count, deduplicated_questions_count: unique.size,
      total_duration_seconds: duration, daily_heatmap: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) } });
  });
}

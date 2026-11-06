import { z } from 'zod';
import { MasteryStatus, SessionStatus, StudyMode } from '../enums/index.js';
import { entityShape, IdSchema, TimestampSchema } from './common.js';
import { PaperSchema } from './content.js';
import { QuestionSchema } from './question.js';
export const StudySessionSchema = z.strictObject({
  ...entityShape, paper_id: IdSchema, paper_snapshot: PaperSchema,
  mode: z.enum(StudyMode), status: z.enum(SessionStatus),
  started_at: TimestampSchema, completed_at: TimestampSchema.nullable(),
  deadline_at: TimestampSchema.nullable(), elapsed_ms: z.number().int().nonnegative(),
  question_order: z.array(IdSchema), option_order: z.record(IdSchema, z.array(IdSchema)),
}).superRefine((s, ctx) => {
  const questions = [...s.paper_snapshot.sections.flatMap((section) => section.items.map((i) => i.question)),
    ...s.paper_snapshot.materials.flatMap((m) => m.children)];
  const ids = new Set(questions.map((q) => q.id));
  if (s.paper_id !== s.paper_snapshot.id || s.question_order.length !== ids.size ||
    new Set(s.question_order).size !== ids.size || s.question_order.some((id) => !ids.has(id)))
    ctx.addIssue({ code: 'custom', path: ['question_order'], message: 'Order must match the paper snapshot' });
  for (const [id, order] of Object.entries(s.option_order)) {
    const q = questions.find((question) => question.id === id);
    if (!q || !('options' in q) || order.length !== q.options.length ||
      new Set(order).size !== order.length || order.some((option) => !q.options.some((o) => o.id === option)))
      ctx.addIssue({ code: 'custom', path: ['option_order', id], message: 'Invalid option permutation' });
  }
  if ((s.status === SessionStatus.Completed) !== (s.completed_at !== null) ||
    (s.completed_at !== null && Date.parse(s.completed_at) < Date.parse(s.started_at)))
    ctx.addIssue({ code: 'custom', path: ['completed_at'], message: 'Invalid completion time' });
});
export const StudyAnswerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('choice'), option_ids: z.array(IdSchema).refine((a) => new Set(a).size === a.length) }),
  z.strictObject({ kind: z.literal('blanks'), values: z.array(z.string()) }),
  z.strictObject({ kind: z.literal('text'), value: z.string() }),
]);
export const StudyRecordSchema = z.strictObject({
  ...entityShape, session_id: IdSchema, question_snapshot: QuestionSchema,
  attempt_index: z.number().int().positive(), answer: StudyAnswerSchema,
  completed_at: TimestampSchema.nullable(), elapsed_ms: z.number().int().nonnegative(),
  score: z.number().finite().nonnegative().nullable(), is_correct: z.boolean().nullable(),
}).superRefine((r, ctx) => {
  const q = r.question_snapshot;
  const valid = 'options' in q ? r.answer.kind === 'choice' &&
    r.answer.option_ids.every((id) => q.options.some((o) => o.id === id)) &&
    (q.type !== 'single_choice' || r.answer.option_ids.length <= 1) :
    'blanks' in q ? r.answer.kind === 'blanks' && r.answer.values.length === q.blanks.length : r.answer.kind === 'text';
  if (!valid) ctx.addIssue({ code: 'custom', path: ['answer'], message: 'Answer does not match question' });
  if (!('max_score' in q) ? r.score !== null || r.is_correct !== null :
    r.score !== null && r.score > q.max_score)
    ctx.addIssue({ code: 'custom', path: ['score'], message: 'Invalid grading for question' });
});
export const MistakeRecordSchema = z.strictObject({
  ...entityShape, source_question_id: IdSchema.nullable(), source_version: z.number().int().positive().nullable(),
  question_snapshot: QuestionSchema, answer: StudyAnswerSchema,
  study_record_ids: z.array(IdSchema).min(1).refine((ids) => new Set(ids).size === ids.length),
  mastery_status: z.enum(MasteryStatus), added_manually: z.boolean(),
}).refine((r) => (r.source_question_id === null) === (r.source_version === null),
  { message: 'Source ID and version must be provided together' });
export type StudySession = z.infer<typeof StudySessionSchema>;
export type StudyAnswer = z.infer<typeof StudyAnswerSchema>;
export type StudyRecord = z.infer<typeof StudyRecordSchema>;
export type MistakeRecord = z.infer<typeof MistakeRecordSchema>;

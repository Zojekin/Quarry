import { z } from 'zod';
import { QuestionType, ScoreMode } from '../enums/index.js';
import { entityShape, IdSchema, NonEmptyTextSchema, uniqueIds } from './common.js';
import { QuestionSchema, SharedMaterialQuestionSchema } from './question.js';
const file = { ...entityShape, name: NonEmptyTextSchema, folder_id: IdSchema.nullable(),
  tag_ids: z.array(IdSchema).default([]), deleted_at: z.iso.datetime({ offset: true }).nullable().default(null) };
export const FolderSchema = z.strictObject({ ...entityShape, name: NonEmptyTextSchema,
  parent_id: IdSchema.nullable(), tag_ids: z.array(IdSchema).default([]) })
  .refine((f) => f.parent_id !== f.id, { path: ['parent_id'], message: 'Folder cannot contain itself' });
export const QuestionBankSchema = z.strictObject({ ...file, description: z.string().default('') });
export const PaperItemSchema = z.strictObject({
  id: IdSchema, question: QuestionSchema, source_question_id: IdSchema.nullable(),
  source_version: z.number().int().positive().nullable(), source_available: z.boolean(),
}).refine((i) => (i.source_question_id === null) === (i.source_version === null),
  { message: 'Source ID and version must be provided together' });
export const PaperSectionSchema = z.strictObject({
  id: IdSchema, title: NonEmptyTextSchema, question_type: z.enum(QuestionType),
  items: z.array(PaperItemSchema).refine(uniqueIds, 'Item IDs must be unique'),
  shuffle_questions: z.boolean().default(false),
  fixed_groups: z.array(z.array(IdSchema).min(2)).default([]),
}).superRefine((section, ctx) => {
  const ids = new Set(section.items.map((i) => i.id));
  const grouped = new Set<string>();
  if (section.items.some((i) => i.question.type !== section.question_type))
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Section question types must match' });
  for (const group of section.fixed_groups) for (const id of group) {
    if (!ids.has(id) || grouped.has(id)) ctx.addIssue({ code: 'custom', path: ['fixed_groups'],
      message: 'Fixed groups must reference existing items without overlap' });
    grouped.add(id);
  }
});
export const PaperSchema = z.strictObject({
  ...file, sections: z.array(PaperSectionSchema).refine(uniqueIds, 'Section IDs must be unique'),
  materials: z.array(SharedMaterialQuestionSchema).default([]),
  shuffle_options: z.boolean().default(false), shuffle_materials: z.boolean().default(false),
  merged_shuffle_sections: z.array(z.array(IdSchema).min(2)).default([]),
  follow_source: z.boolean().default(false),
  score_mode: z.enum(ScoreMode).default(ScoreMode.AllOrNothing),
  time_limit_seconds: z.number().int().positive().nullable().default(null),
}).superRefine((paper, ctx) => {
  const sections = new Set(paper.sections.map((s) => s.id));
  const merged = new Set<string>();
  for (const group of paper.merged_shuffle_sections) for (const id of group) {
    if (!sections.has(id) || merged.has(id)) ctx.addIssue({ code: 'custom',
      path: ['merged_shuffle_sections'], message: 'Merged sections must exist and cannot overlap' });
    merged.add(id);
  }
  const questions = [...paper.sections.flatMap((s) => s.items.map((i) => i.question)),
    ...paper.materials.flatMap((m) => m.children)];
  if (!uniqueIds(questions) || questions.some((q) => q.owner_type !== 'paper' || q.owner_id !== paper.id))
    ctx.addIssue({ code: 'custom', path: ['sections'], message: 'Questions must be unique and owned by this paper' });
});
export type Folder = z.infer<typeof FolderSchema>;
export type QuestionBank = z.infer<typeof QuestionBankSchema>;
export type Paper = z.infer<typeof PaperSchema>;
export type PaperSection = z.infer<typeof PaperSectionSchema>;
export type PaperItem = z.infer<typeof PaperItemSchema>;

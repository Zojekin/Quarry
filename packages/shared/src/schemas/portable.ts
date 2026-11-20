import { z } from 'zod';
import { IdSchema } from './common.js';
import { QuestionSchema } from './question.js';
import { TagColorSchema } from './tag.js';
import { QuestionType, ScoreMode } from '../enums/index.js';

// Strip the material extension before applying the strict domain schema.
const portableQuestion = z.unknown().transform((value, ctx) => {
  const base = z.record(z.string(), z.unknown()).safeParse(value);
  if (!base.success) { ctx.addIssue({ code: 'custom', message: 'Expected question object' }); return z.NEVER; }
  const { material, material_parent_id, ...content } = base.data;
  const parsed = QuestionSchema.safeParse(content);
  if (!parsed.success) { for (const issue of parsed.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message }); return z.NEVER; }
  const extension = z.strictObject({ material: z.string().nullable().default(null),
    material_parent_id: IdSchema.nullable().default(null) }).safeParse({ material, material_parent_id });
  if (!extension.success) { for (const issue of extension.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message }); return z.NEVER; }
  return { ...parsed.data, ...extension.data };
});
const paperConfigSchema = z.strictObject({ full_score: z.number().nonnegative(), score_mode: z.enum(ScoreMode),
  time_limit_seconds: z.number().int().positive().nullable(), shuffle_options: z.boolean(), shuffle_sections: z.boolean(),
  shuffle_materials: z.boolean(), merged_shuffle_sections: z.array(z.array(IdSchema)),
  sections: z.array(z.strictObject({ id: IdSchema, title: z.string().min(1), question_type: z.enum(QuestionType),
    shuffle_questions: z.boolean(), fixed_groups: z.array(z.array(IdSchema)),
    items: z.array(z.strictObject({ id: IdSchema, question_id: IdSchema })) })) });
export const ContentDocumentSchema = z.strictObject({ version: z.literal(1), entity: z.enum(['bank', 'paper']),
  name: z.string().trim().min(1), description: z.string().default(''),
  questions: z.array(portableQuestion),
  tags: z.array(z.strictObject({ id: IdSchema, name: z.string().min(1), target_type: z.enum(['file', 'question']), color: TagColorSchema.optional() })).default([]),
  attachments: z.array(z.strictObject({ id: IdSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/),
    filename: z.string(), mime_type: z.string(), file_size: z.number().int().nonnegative(), created_at: z.string() })).default([]),
  paper: paperConfigSchema.optional(),
});
export type ContentDocument = z.infer<typeof ContentDocumentSchema>;

export function validateContentReferences(document: ContentDocument,
  referenceError: (path: (string | number)[], message: string) => never): void {
  const questions = new Map(document.questions.map(question => [question.id, question]));
  const tags = new Map(document.tags.map(tag => [tag.id, tag]));
  const attachmentIds = new Set(document.attachments.map(attachment => attachment.id));
  if (questions.size !== document.questions.length || tags.size !== document.tags.length)
    referenceError([], 'Duplicate question or tag IDs');
  if (attachmentIds.size !== document.attachments.length
    || new Set(document.attachments.map(attachment => attachment.sha256)).size !== document.attachments.length)
    referenceError([], 'Duplicate attachment identities');
  for (const [questionIndex, question] of document.questions.entries()) {
    if (question.tag_ids.some(id => tags.get(id)?.target_type !== 'question'))
      referenceError(['questions', questionIndex, 'tag_ids'], `Invalid question tag reference: ${question.id}`);
    for (const match of JSON.stringify(question).matchAll(/attachment:\/\/([a-f0-9-]{36})/gi))
      if (!attachmentIds.has(match[1]!)) referenceError(['questions', questionIndex], `Invalid attachment reference: ${match[1]}`);
    const visited = new Set([question.id]);
    let parent = question.material_parent_id;
    while (parent) {
      if (!questions.has(parent) || visited.has(parent)) referenceError(['questions', questionIndex, 'material_parent_id'], 'Invalid material parent reference');
      visited.add(parent); parent = questions.get(parent)!.material_parent_id;
    }
  }
  if (document.entity === 'bank' && document.paper) referenceError([], 'Bank cannot contain paper configuration');
  if (document.paper) {
    const sections = new Set(document.paper.sections.map(section => section.id));
    const items = document.paper.sections.flatMap(section => section.items);
    if (sections.size !== document.paper.sections.length || new Set(items.map(item => item.id)).size !== items.length
      || new Set(items.map(item => item.question_id)).size !== items.length)
      referenceError([], 'Duplicate paper section or item');
    const merged = document.paper.merged_shuffle_sections.flat();
    if (merged.some(id => !sections.has(id)) || new Set(merged).size !== merged.length)
      referenceError([], 'Invalid merged section reference');
    for (const [sectionIndex, section] of document.paper.sections.entries()) {
      if (section.items.some(item => !questions.has(item.question_id)
        || questions.get(item.question_id)?.type !== section.question_type))
        referenceError(['paper', 'sections', sectionIndex, 'items'], 'Invalid paper question reference or type');
      const grouped = section.fixed_groups.flat();
      if (new Set(grouped).size !== grouped.length || section.fixed_groups.some(group => group.length < 2
        || group.some((id, i) => {
          const position = section.items.findIndex(item => item.id === id);
          return position < 0 || (i > 0 && position !== section.items.findIndex(item => item.id === group[i - 1]) + 1);
        }))) referenceError(['paper', 'sections', sectionIndex, 'fixed_groups'], 'Invalid fixed group');
    }
  }
}

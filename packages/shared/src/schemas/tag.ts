import { z } from 'zod';
import { TagTargetType } from '../enums/index.js';
import { entityShape, IdSchema, NonEmptyTextSchema } from './common.js';
export const TagColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable();
export const TagSchema = z.strictObject({ ...entityShape, name: NonEmptyTextSchema, color: TagColorSchema.optional(), target_type: z.enum(TagTargetType) });
// Repositories additionally verify the persisted tag's namespace against tag_type.
export const TagRelationSchema = z.discriminatedUnion('target_type', [
  z.strictObject({ tag_id: IdSchema, tag_type: z.literal(TagTargetType.File),
    target_type: z.literal(TagTargetType.File), target_id: IdSchema,
    entity_type: z.enum(['folder', 'question_bank', 'paper']) }),
  z.strictObject({ tag_id: IdSchema, tag_type: z.literal(TagTargetType.Question),
    target_type: z.literal(TagTargetType.Question), target_id: IdSchema, entity_type: z.literal('question') }),
]);
export type Tag = z.infer<typeof TagSchema>;
export type TagRelation = z.infer<typeof TagRelationSchema>;

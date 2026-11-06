import { z } from 'zod';
import { QuestionType, ScoreMode } from '../enums/index.js';
import { IdSchema, NonEmptyTextSchema, uniqueIds } from './common.js';
export const OptionSchema = z.strictObject({ id: IdSchema, content: NonEmptyTextSchema, is_correct: z.boolean() });
// Answers are preserved verbatim, including spaces, case and character width.
export const BlankSchema = z.strictObject({ id: IdSchema, valid_answers: z.array(z.string().min(1)).min(1) });
const base = {
  id: IdSchema, version: z.number().int().positive(),
  owner_type: z.enum(['question_bank', 'paper']), owner_id: IdSchema,
  content: NonEmptyTextSchema, explanation: z.string().default(''), tag_ids: z.array(IdSchema).default([]),
};
const choice = {
  options: z.array(OptionSchema).min(2).refine(uniqueIds, 'Option IDs must be unique'),
  options_order_fixed: z.boolean().default(false),
};
const scoring = { max_score: z.number().finite().positive().default(1) };
const proportional = { ...scoring, score_mode: z.enum(ScoreMode).default(ScoreMode.AllOrNothing) };
export const SingleChoiceQuestionSchema = z.strictObject({
  ...base, ...choice, ...scoring, type: z.literal(QuestionType.SingleChoice),
}).refine((q) => q.options.filter((o) => o.is_correct).length === 1,
  { path: ['options'], message: 'Exactly one correct option is required' });
export const MultipleChoiceQuestionSchema = z.strictObject({
  ...base, ...choice, ...proportional, type: z.literal(QuestionType.MultipleChoice),
}).refine((q) => q.options.some((o) => o.is_correct),
  { path: ['options'], message: 'At least one correct option is required' });
export const IndefiniteChoiceQuestionSchema = z.strictObject({
  ...base, ...choice, ...proportional, type: z.literal(QuestionType.IndefiniteChoice),
}).refine((q) => q.options.some((o) => o.is_correct),
  { path: ['options'], message: 'At least one correct option is required' });
export const StrictFillInBlankQuestionSchema = z.strictObject({
  ...base, ...proportional, type: z.literal(QuestionType.StrictFillInBlank),
  blanks: z.array(BlankSchema).min(1).refine(uniqueIds, 'Blank IDs must be unique'),
});
export const FreeFillInBlankQuestionSchema = z.strictObject({
  ...base, type: z.literal(QuestionType.FreeFillInBlank), reference_answer: NonEmptyTextSchema,
});
export const SubjectiveQuestionSchema = z.strictObject({
  ...base, type: z.literal(QuestionType.Subjective), reference_answer: NonEmptyTextSchema,
});
export const QuestionSchema = z.discriminatedUnion('type', [SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema, IndefiniteChoiceQuestionSchema, StrictFillInBlankQuestionSchema,
  FreeFillInBlankQuestionSchema, SubjectiveQuestionSchema]);
export const SharedMaterialQuestionSchema = z.strictObject({
  id: IdSchema, material: NonEmptyTextSchema,
  children: z.array(QuestionSchema).min(1).refine(uniqueIds, 'Child IDs must be unique'),
  movable: z.boolean().default(true),
}).refine((g) => g.children.every((q) => q.owner_id === g.children[0]?.owner_id &&
  q.owner_type === g.children[0]?.owner_type), { path: ['children'], message: 'Children must share one owner' });
export type Option = z.infer<typeof OptionSchema>;
export type Blank = z.infer<typeof BlankSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type SharedMaterialQuestion = z.infer<typeof SharedMaterialQuestionSchema>;

import type { z } from 'zod';
import type { FolderSchema, QuestionBankSchema, PaperSchema, QuestionSchema, TagSchema,
  TagRelationSchema, StudySessionSchema, StudyRecordSchema, MistakeRecordSchema } from '../schemas/index.js';
// Input DTOs retain optional defaulted fields; output entity types describe parsed data.
export type FolderDTO = z.input<typeof FolderSchema>;
export type QuestionBankDTO = z.input<typeof QuestionBankSchema>;
export type PaperDTO = z.input<typeof PaperSchema>;
export type QuestionDTO = z.input<typeof QuestionSchema>;
export type TagDTO = z.input<typeof TagSchema>;
export type TagRelationDTO = z.input<typeof TagRelationSchema>;
export type StudySessionDTO = z.input<typeof StudySessionSchema>;
export type StudyRecordDTO = z.input<typeof StudyRecordSchema>;
export type MistakeRecordDTO = z.input<typeof MistakeRecordSchema>;

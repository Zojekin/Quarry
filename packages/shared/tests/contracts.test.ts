import { describe, expect, it } from 'vitest';
import { AppError, ErrorCode, QuestionSchema, OptionSchema, SharedMaterialQuestionSchema,
  TagSchema, TagRelationSchema, FolderSchema, QuestionBankSchema, PaperSchema,
  StudySessionSchema, StudyRecordSchema, MistakeRecordSchema } from '../src/index.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const timestamp = '2026-11-06T00:00:00Z';
const entity = { id: id(1), created_at: timestamp, updated_at: timestamp };
const base = { id: id(2), owner_type: 'paper', owner_id: id(1), version: 1, content: '**Question**' };
const options = [
  { id: id(3), content: 'A', is_correct: true },
  { id: id(4), content: 'B', is_correct: false },
];
const single = { ...base, type: 'single_choice', options };
const strict = { ...base, type: 'strict_fill_in_blank', blanks: [{ id: id(5), valid_answers: [' A ', 'Ａ', 'a'] }] };
const manual = { ...base, type: 'subjective', reference_answer: 'Reference' };
const section = { id: id(6), title: 'Choice', question_type: 'single_choice',
  items: [{ id: id(7), question: single, source_question_id: null, source_version: null, source_available: false }] };
const paper = { ...entity, name: 'Paper', folder_id: null, sections: [section] };
const record = { ...entity, session_id: id(8), question_snapshot: single, attempt_index: 1,
  answer: { kind: 'choice', option_ids: [id(3)] }, completed_at: timestamp, elapsed_ms: 10, score: 1, is_correct: true };

describe('question contracts', () => {
  it.each(['single_choice', 'multiple_choice', 'indefinite_choice'])('validates %s and correct-option constraints', (type) => {
    expect(QuestionSchema.safeParse({ ...single, type }).success).toBe(true);
    expect(QuestionSchema.safeParse({ ...single, type, options: options.map((o) => ({ ...o, is_correct: false })) }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...single, type, options: options.map((o) => ({ ...o, is_correct: true })) }).success)
      .toBe(type !== 'single_choice');
  });
  it.each(['single_choice', 'multiple_choice', 'indefinite_choice'])('rejects malformed %s options', (type) => {
    for (const invalid of [[], [options[0]], [options[0], options[0]], [{ ...options[0], id: 'A' }, options[1]]])
      expect(QuestionSchema.safeParse({ ...single, type, options: invalid }).success).toBe(false);
  });
  it('preserves exact strict-fill answers and accepts multiple blanks', () => {
    const parsed = QuestionSchema.parse(strict);
    expect('blanks' in parsed && parsed.blanks[0]?.valid_answers).toEqual([' A ', 'Ａ', 'a']);
    expect(QuestionSchema.safeParse({ ...strict, blanks: [...strict.blanks, { id: id(9), valid_answers: ['B'] }] }).success).toBe(true);
  });
  it.each([[], [{ id: id(5), valid_answers: [] }], [{ id: id(5), valid_answers: [''] }],
    [{ id: 'bad', valid_answers: ['A'] }], [strict.blanks[0], strict.blanks[0]]]
    .map((blanks) => ({ blanks })))('rejects invalid blanks $blanks', ({ blanks }) => {
    expect(QuestionSchema.safeParse({ ...strict, blanks }).success).toBe(false);
  });
  it.each(['free_fill_in_blank', 'subjective'])('requires a reference and disallows grading for %s', (type) => {
    expect(QuestionSchema.safeParse({ ...manual, type }).success).toBe(true);
    for (const extra of [{ reference_answer: '' }, { reference_answer: undefined }, { max_score: 1 },
      { score_mode: 'proportional' }, { options }])
      expect(QuestionSchema.safeParse({ ...manual, type, ...extra }).success).toBe(false);
  });
  it('rejects unknown types, missing owners, bad versions and invalid scoring', () => {
    for (const extra of [{ type: 'true_false' }, { owner_id: undefined }, { owner_type: 'global' },
      { version: 0 }, { content: ' ' }, { max_score: -1 }, { max_score: Infinity }])
      expect(QuestionSchema.safeParse({ ...single, ...extra }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...strict, score_mode: 'partial' }).success).toBe(false);
    expect(QuestionSchema.parse({ ...strict, score_mode: 'proportional' })).toHaveProperty('score_mode', 'proportional');
  });
  it('validates option primitives', () => {
    expect(OptionSchema.safeParse(options[0]).success).toBe(true);
    expect(OptionSchema.safeParse({ ...options[0], is_correct: 'true' }).success).toBe(false);
  });
  it('keeps material children ordered, validated and under one owner', () => {
    const material = { id: id(10), material: '# Passage', children: [single, { ...manual, id: id(11) }] };
    expect(SharedMaterialQuestionSchema.parse(material).children.map((q) => q.id)).toEqual([id(2), id(11)]);
    for (const children of [[], [single, single], [{ ...single, options: [] }],
      [single, { ...manual, id: id(11), owner_id: id(12) }]])
      expect(SharedMaterialQuestionSchema.safeParse({ ...material, children }).success).toBe(false);
  });
});

describe('dual tag isolation', () => {
  it.each(['file', 'question'])('validates the %s namespace', (target_type) => {
    expect(TagSchema.safeParse({ ...entity, name: 'Tag', target_type }).success).toBe(true);
  });
  it.each(['folder', 'question_bank', 'paper', 'question'])('checks all namespace combinations for %s', (entity_type) => {
    for (const tag_type of ['file', 'question']) for (const target_type of ['file', 'question']) {
      const expected = entity_type === 'question' ? tag_type === 'question' && target_type === 'question'
        : tag_type === 'file' && target_type === 'file';
      expect(TagRelationSchema.safeParse({ tag_id: id(1), target_id: id(2), tag_type, target_type, entity_type }).success).toBe(expected);
    }
  });
  it('rejects unspecified namespaces and unsupported entities', () => {
    expect(TagSchema.safeParse({ ...entity, name: 'Tag', target_type: 'all' }).success).toBe(false);
    expect(TagRelationSchema.safeParse({ tag_id: id(1), target_id: id(2), target_type: 'file', entity_type: 'folder' }).success).toBe(false);
  });
});

describe('files, paper and study contracts', () => {
  it('validates nested folders and banks', () => {
    expect(FolderSchema.safeParse({ ...entity, name: 'Folder', parent_id: null }).success).toBe(true);
    expect(FolderSchema.safeParse({ ...entity, name: 'Folder', parent_id: entity.id }).success).toBe(false);
    expect(QuestionBankSchema.safeParse({ ...entity, name: 'Bank', folder_id: id(9) }).success).toBe(true);
  });
  it('defaults follow and shuffle flags to false', () => {
    expect(PaperSchema.parse(paper)).toMatchObject({ follow_source: false, shuffle_options: false, shuffle_materials: false });
    expect(PaperSchema.parse(paper).sections[0]?.shuffle_questions).toBe(false);
  });
  it('rejects invalid ownership, types and group references', () => {
    expect(PaperSchema.safeParse({ ...paper, id: id(99) }).success).toBe(false);
    expect(PaperSchema.safeParse({ ...paper, sections: [{ ...section, question_type: 'subjective' }] }).success).toBe(false);
    expect(PaperSchema.safeParse({ ...paper, sections: [section, section] }).success).toBe(false);
    expect(PaperSchema.safeParse({ ...paper, sections: [{ ...section, fixed_groups: [[id(7), id(7)]] }] }).success).toBe(false);
    expect(PaperSchema.safeParse({ ...paper, merged_shuffle_sections: [[id(6), id(99)]] }).success).toBe(false);
  });
  it('validates frozen sessions and order permutations', () => {
    const session = { ...entity, paper_id: id(1), paper_snapshot: paper, mode: 'exam', status: 'in_progress',
      started_at: timestamp, completed_at: null, deadline_at: null, elapsed_ms: 0,
      question_order: [id(2)], option_order: { [id(2)]: [id(4), id(3)] } };
    expect(StudySessionSchema.safeParse(session).success).toBe(true);
    for (const extra of [{ question_order: [] }, { question_order: [id(2), id(2)] },
      { option_order: { [id(2)]: [id(3), id(3)] } }, { status: 'completed' }, { elapsed_ms: -1 }])
      expect(StudySessionSchema.safeParse({ ...session, ...extra }).success).toBe(false);
    expect(StudySessionSchema.safeParse({ ...session, status: 'completed', completed_at: timestamp }).success).toBe(true);
  });
  it('validates answers, retries and ungraded manual questions', () => {
    expect(StudyRecordSchema.safeParse(record).success).toBe(true);
    for (const extra of [{ attempt_index: 0 }, { score: 2 }, { answer: { kind: 'choice', option_ids: [id(99)] } },
      { answer: { kind: 'text', value: 'A' } }])
      expect(StudyRecordSchema.safeParse({ ...record, ...extra }).success).toBe(false);
    const manualRecord = { ...record, question_snapshot: manual, answer: { kind: 'text', value: 'Answer' }, score: null, is_correct: null };
    expect(StudyRecordSchema.safeParse(manualRecord).success).toBe(true);
    expect(StudyRecordSchema.safeParse({ ...manualRecord, score: 0 }).success).toBe(false);
  });
  it('requires paired source identity and unique mistake history', () => {
    const mistake = { ...entity, source_question_id: id(2), source_version: 1, question_snapshot: single,
      answer: record.answer, study_record_ids: [id(9)], mastery_status: 'reviewing', added_manually: false };
    expect(MistakeRecordSchema.safeParse(mistake).success).toBe(true);
    expect(MistakeRecordSchema.safeParse({ ...mistake, source_version: null }).success).toBe(false);
    expect(MistakeRecordSchema.safeParse({ ...mistake, study_record_ids: [id(9), id(9)] }).success).toBe(false);
  });
});

describe('AppError', () => {
  it('serializes the public contract without stack traces', () => {
    const error = new AppError(ErrorCode.ValidationError, 'Invalid question', { field: 'options' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(JSON.parse(JSON.stringify(error))).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid question',
      details: { field: 'options' }, statusCode: 400 });
  });
  it('supports status overrides and default details', () => {
    expect(new AppError(ErrorCode.NotFound, 'Missing').toJSON()).toEqual({
      code: 'NOT_FOUND', message: 'Missing', details: null, statusCode: 404 });
    expect(new AppError(ErrorCode.InternalError, 'Unavailable', null, 503).statusCode).toBe(503);
  });
});

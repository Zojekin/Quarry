import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { NewRow, Repositories, Row } from '@quarry/database';
import { AppError, ErrorCode, IdSchema, QuestionSchema } from '@quarry/shared';
import type { Question } from '@quarry/shared';
import { found, invalid, parse } from './common.js';
import { TagService } from './tag.service.js';

export type QuestionView = Question & { material_parent_id: string | null; material: string | null };
export function questionRow(question: Question): Omit<NewRow<'questions'>, 'material_parent_id'> {
  return { id: question.id, bank_id: question.owner_type === 'question_bank' ? question.owner_id : null,
    paper_id: question.owner_type === 'paper' ? question.owner_id : null, type: question.type,
    stem: question.content, analysis: question.explanation, version: question.version,
    options_json: 'options' in question ? JSON.stringify(question.options) : null,
    blanks_json: 'blanks' in question ? JSON.stringify(question.blanks) : null,
    standard_answers_json: 'reference_answer' in question ? JSON.stringify(question.reference_answer) : null,
    full_score: 'max_score' in question ? question.max_score : null,
    score_mode: 'score_mode' in question ? question.score_mode : null,
    fixed_options_order: 'options_order_fixed' in question && question.options_order_fixed ? 1 : 0 };
}
export class QuestionService {
  readonly tags: TagService;
  constructor(readonly repositories: Repositories) { this.tags = new TagService(repositories); }
  async view(row: Row<'questions'>): Promise<QuestionView> {
    const value: Record<string, unknown> = { id: row.id, version: row.version,
      owner_type: row.bank_id ? 'question_bank' : 'paper', owner_id: row.bank_id ?? row.paper_id,
      type: row.type, content: row.stem, explanation: row.analysis,
      tag_ids: await this.tags.ids(row.id, 'question') };
    if (row.options_json !== null) {
      value.options = JSON.parse(row.options_json);
      value.options_order_fixed = !!row.fixed_options_order;
    }
    if (row.blanks_json !== null) value.blanks = JSON.parse(row.blanks_json);
    if (row.standard_answers_json !== null) value.reference_answer = JSON.parse(row.standard_answers_json);
    if (row.full_score !== null) value.max_score = row.full_score;
    if (row.score_mode !== null) value.score_mode = row.score_mode;
    return { ...parse(QuestionSchema, value), material_parent_id: row.material_parent_id, material: row.material };
  }
  async get(id: string) {
    const row = found(await this.repositories.questions.findById(id));
    await this.owner(row.bank_id ? 'question_bank' : 'paper', found(row.bank_id ?? row.paper_id ?? undefined));
    return this.view(row);
  }
  async owner(type: string, id: string) {
    found(await (type === 'question_bank' ? this.repositories.questionBanks : this.repositories.papers).findById(id));
  }
  async save(input: Record<string, unknown>, id?: string) {
    const old = id ? await this.get(id) : undefined;
    const merged: Record<string, unknown> = { ...old, ...input };
    // A type change replaces the variant fields while retaining identity and ownership.
    // Otherwise fields from the previous variant fail the strict shared schema.
    if (old && input.type && input.type !== old.type) {
      for (const field of ['options', 'options_order_fixed', 'blanks', 'reference_answer', 'max_score', 'score_mode'])
        if (!(field in input)) delete merged[field];
    }
    const { material_parent_id: rawParent, material: rawMaterial, ...content } = merged;
    const question = parse(QuestionSchema, { id: id ?? randomUUID(), version: 1, ...content,
      ...(id ? { id, version: found(old).version + 1 } : {}) });
    if (!id && await this.repositories.questions.findById(question.id))
      throw new AppError(ErrorCode.Conflict, 'Question ID already exists');
    if (old && (old.owner_id !== question.owner_id || old.owner_type !== question.owner_type))
      invalid('Question ownership cannot be changed');
    const parentId = parse(IdSchema.nullable(), rawParent ?? null);
    const material = parse(z.string().nullable(), rawMaterial ?? null);
    await this.owner(question.owner_type, question.owner_id);
    await this.tags.validate(question.tag_ids, 'question');
    let ancestor = parentId;
    const visited = new Set([question.id]);
    while (ancestor) {
      if (visited.has(ancestor)) invalid('Circular material hierarchy');
      visited.add(ancestor);
      const parent = await this.get(ancestor);
      if (parent.owner_id !== question.owner_id || parent.owner_type !== question.owner_type)
        invalid('Material parent must have the same owner');
      ancestor = parent.material_parent_id;
    }
    const row = { ...questionRow(question), material_parent_id: parentId, material };
    if (id) { const { id: ignored, ...patch } = row; await this.repositories.questions.update(id, patch); }
    else await this.repositories.questions.create(row);
    await this.tags.replace(question.id, 'question', question.tag_ids);
    return this.get(question.id);
  }
}

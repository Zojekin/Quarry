import { randomUUID } from 'node:crypto';
import type { Repositories, Row } from '@quarry/database';
import { IdSchema, QuestionType, StudyAnswerSchema, AppError, ErrorCode } from '@quarry/shared';
import type { StudyAnswer } from '@quarry/shared';
import { z } from 'zod';
import { found, invalid, parse, nameSchema } from './common.js';
import { PaperService } from './paper.service.js';
import type { QuestionView } from './question.service.js';

export interface MistakeHistory { study_record_id: string; answer: StudyAnswer; answered_at: string; source_paper_id?: string | null; source_paper_name?: string | null; source_folder_id?: string | null }
export class MistakeService {
  constructor(readonly repositories: Repositories) {}
  view(row: Row<'mistake_records'>) {
    const { question_snapshot_json, last_user_answer_json, history_json, ...fields } = row;
    return { ...fields, question_snapshot: JSON.parse(question_snapshot_json) as QuestionView,
      answer: JSON.parse(last_user_answer_json) as StudyAnswer, history: JSON.parse(history_json) as MistakeHistory[] };
  }
  async record(question: QuestionView, sourceId: string | null, sourceVersion: number | null, history: MistakeHistory, automatic = true) {
    const all = await this.repositories.mistakes.list();
    const duplicate = all.find(m => (JSON.parse(m.history_json) as MistakeHistory[]).some(entry => entry.study_record_id === history.study_record_id));
    if (duplicate) return this.view(duplicate);
    const old = sourceId ? all.find(m =>
      m.source_question_id === sourceId && m.source_version === sourceVersion) : undefined;
    if (old) {
      const entries = JSON.parse(old.history_json) as MistakeHistory[];
      if (entries.some(entry => entry.study_record_id === history.study_record_id)) return this.view(old);
      return this.view(found(await this.repositories.mistakes.update(old.id, {
        wrong_count: old.wrong_count + 1, mastery_status: automatic ? 'reviewing' : old.mastery_status, last_wrong_at: history.answered_at,
        last_user_answer_json: JSON.stringify(history.answer), history_json: JSON.stringify([...entries, history]),
      })));
    }
    return this.view(await this.repositories.mistakes.create({ id: randomUUID(), source_question_id: sourceId,
      source_version: sourceVersion, source_paper_id: history.source_paper_id ?? null,
      source_paper_name: history.source_paper_name ?? null, source_folder_id: history.source_folder_id ?? null, question_snapshot_json: JSON.stringify(question),
      last_user_answer_json: JSON.stringify(history.answer), last_wrong_at: history.answered_at,
      history_json: JSON.stringify([history]) }));
  }
  async manual(input: Record<string, unknown>) {
    const data = parse(z.strictObject({ session_id: IdSchema, study_record_id: IdSchema }), input);
    const session = found(await this.repositories.studySessions.findById(data.session_id));
    const record = found((await this.repositories.studySessions.listRecords(session.id)).find(r => r.id === data.study_record_id));
    const state = JSON.parse(session.state_json) as { items: { question: QuestionView; source_question_id: string | null; source_version: number | null }[] };
    const item = found(state.items.find(i => i.question.id === record.question_id));
    if (!['subjective', 'free_fill_in_blank'].includes(item.question.type)) invalid('Only manual questions may be added manually');
    return this.record(item.question, item.source_question_id, item.source_version, {
      study_record_id: record.id, answer: parse(StudyAnswerSchema, JSON.parse(record.user_answer_json)), answered_at: record.answered_at, source_paper_id: record.source_paper_id, source_paper_name: record.source_paper_name, source_folder_id: record.source_folder_id }, false);
  }
  async mastery(id: string, input: Record<string, unknown>) {
    const data = parse(z.strictObject({ mastery_status: z.enum(['reviewing', 'mastered']) }), input);
    return this.view(found(await this.repositories.mistakes.update(id, data)));
  }
  async list(filters: Record<string, unknown> = {}) {
    const data = parse(z.strictObject({ type: z.string().optional(), tags: z.array(IdSchema).default([]),
      types: z.array(z.enum(QuestionType)).optional(), source_paper_ids: z.array(IdSchema).optional(),
      folder_ids: z.array(IdSchema).optional(), tag_ids: z.array(IdSchema).optional(),
      date_from: z.iso.date().optional(), date_to: z.iso.date().optional(), search: z.string().optional(),
      source_question_id: IdSchema.optional(), source: IdSchema.optional(), mastery_status: z.enum(['reviewing', 'mastered', 'all']).optional(),
      ids: z.array(IdSchema).optional() }), filters);
    if (data.date_from && data.date_to && data.date_from > data.date_to) invalid('Invalid date range');
    const folders = new Set(data.folder_ids);
    if (data.folder_ids) {
      const all = (await this.repositories.trash.snapshot()).folders;
      let changed = true;
      while (changed) { changed = false; for (const f of all) if (f.parent_id && folders.has(f.parent_id) && !folders.has(f.id)) {
        folders.add(f.id); changed = true;
      } }
    }
    return (await this.repositories.mistakes.list()).map(row => this.view(row)).filter(m => {
      const sources = [m, ...m.history];
      return (!data.type || m.question_snapshot.type === data.type) &&
        (!data.types || data.types.includes(m.question_snapshot.type)) &&
        (!data.mastery_status || data.mastery_status === 'all' || m.mastery_status === data.mastery_status) &&
        (!(data.source_question_id ?? data.source) || m.source_question_id === (data.source_question_id ?? data.source)) &&
        (!data.ids || data.ids.includes(m.id)) && data.tags.every(tag => m.question_snapshot.tag_ids.includes(tag)) &&
        (!data.tag_ids || data.tag_ids.some(tag => m.question_snapshot.tag_ids.includes(tag))) &&
        (!data.source_paper_ids || sources.some(h => h.source_paper_id && data.source_paper_ids!.includes(h.source_paper_id))) &&
        (!data.folder_ids || sources.some(h => h.source_folder_id && folders.has(h.source_folder_id))) &&
        (!data.date_from || m.created_at.slice(0, 10) >= data.date_from) &&
        (!data.date_to || m.created_at.slice(0, 10) <= data.date_to) &&
        (!data.search || [m.question_snapshot.content, ...sources.map(h => h.source_paper_name ?? '')]
          .some(text => text.toLowerCase().includes(data.search!.toLowerCase())));
    });
  }
  async createPaper(input: Record<string, unknown>) {
    const { name, ...filters } = input;
    const mistakes = await this.list(filters);
    if (!mistakes.length) throw new AppError(ErrorCode.ValidationError, 'No matching mistakes');
    const availableTags = new Set((await this.repositories.tags.list()).filter(t => t.target_type === 'question').map(t => t.id));
    const sections = new Map<string, { title: string; question_type: string; items: unknown[] }>();
    for (const mistake of mistakes) {
      const q = mistake.question_snapshot;
      const section = sections.get(q.type) ?? { title: q.type, question_type: q.type, items: [] };
      const { id, owner_id, owner_type, version, material_parent_id, ...content } = q;
      section.items.push({ question: { ...content, tag_ids: content.tag_ids.filter(id => availableTags.has(id)) } });
      sections.set(q.type, section);
    }
    const papers = new PaperService(this.repositories);
    const paper = await papers.save({ name: parse(nameSchema, name ?? 'Mistake review'), sections: [...sections.values()] });
    const remaining = [...mistakes];
    for (const section of paper.sections) for (const item of section.items) {
      const index = remaining.findIndex(m => m.question_snapshot.type === item.question.type);
      const mistake = remaining.splice(index, 1)[0]!;
      // Preserve the historical version even when the source has since changed or disappeared.
      const sourceExists = mistake.source_question_id && await this.repositories.questions.findById(mistake.source_question_id);
      await this.repositories.papers.updateItem(item.id, { source_question_id: sourceExists ? mistake.source_question_id : null,
        historical_source_question_id: mistake.source_question_id,
        source_version: mistake.source_version });
    }
    return papers.get(paper.id);
  }
}

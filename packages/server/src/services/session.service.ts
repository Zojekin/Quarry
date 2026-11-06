import { randomUUID } from 'node:crypto';
import type { Repositories, Row } from '@quarry/database';
import { AppError, ErrorCode, IdSchema, StudyAnswerSchema } from '@quarry/shared';
import type { StudyAnswer } from '@quarry/shared';
import { scoreQuestion, shuffle, shuffleOptions, shuffleSection, splitDurationAcrossMidnight } from '@quarry/core';
import { z } from 'zod';
import { found, invalid, parse } from './common.js';
import { PaperService } from './paper.service.js';
import type { QuestionView } from './question.service.js';
import { MistakeService } from './mistake.service.js';

type PaperView = Awaited<ReturnType<PaperService['get']>>;
type Item = PaperView['sections'][number]['items'][number];
export interface SessionState { paper: PaperView; items: Item[]; seed: number; time_zone: string;
  paused_at: string | null; daily_metrics: { date: string; seconds: number }[] }
const conflict = (message: string): never => { throw new AppError(ErrorCode.InvalidState, message); };
export function answered(answer: StudyAnswer) {
  return answer.kind === 'choice' ? answer.option_ids.length > 0 : answer.kind === 'blanks'
    ? answer.values.some(value => value.length > 0) : answer.value.length > 0;
}
export class SessionService {
  constructor(readonly repositories: Repositories, readonly now: () => Date = () => new Date()) {}
  async load(id: string) {
    const row = found(await this.repositories.studySessions.findById(id));
    const state = JSON.parse(row.state_json) as SessionState;
    if (!state.items) conflict('Session snapshot unavailable');
    return { row, state };
  }
  async get(id: string) {
    const { row, state } = await this.load(id);
    const records = await this.repositories.studySessions.listRecords(id);
    const { state_json, ...fields } = row;
    const reveal = (q: QuestionView, complete: boolean) => {
      if (complete) return q;
      const { explanation, ...safe } = q;
      if ('options' in safe) return { ...safe, options: safe.options.map(({ is_correct, ...option }) => option) };
      if ('blanks' in safe) return { ...safe, blanks: safe.blanks.map(({ valid_answers, ...blank }) => blank) };
      const { reference_answer, ...manual } = safe;
      return manual;
    };
    return { ...fields, seed: state.seed, question_order: state.items.map(i => i.question.id),
      option_order: Object.fromEntries(state.items.filter(i => 'options' in i.question).map(i =>
        [i.question.id, 'options' in i.question ? i.question.options.map(o => o.id) : []])),
      items: state.items.map(item => ({ id: item.id, source_question_id: item.source_question_id,
        source_version: item.source_version, question: reveal(item.question, row.status === 'completed' ||
          (row.mode === 'practice' && records.some(r => r.question_id === item.question.id))) })),
      records: row.mode === 'exam' && row.status !== 'completed' ? [] : records.map(r => ({ ...r,
        answer: JSON.parse(r.user_answer_json), locked: true })), daily_metrics: state.daily_metrics };
  }
  async start(input: Record<string, unknown>) {
    const data = parse(z.strictObject({ paper_id: IdSchema, mode: z.enum(['practice', 'exam']),
      seed: z.number().int().min(0).max(0xffffffff).optional(), time_zone: z.string().default(Intl.DateTimeFormat().resolvedOptions().timeZone) }), input);
    try { new Intl.DateTimeFormat('en', { timeZone: data.time_zone }); } catch { invalid('Invalid time zone'); }
    const paper = await new PaperService(this.repositories).get(data.paper_id);
    const id = randomUUID();
    const seed = data.seed ?? Number.parseInt(id.replaceAll('-', '').slice(0, 8), 16);
    // Material sibling blocks and fixed groups are unioned into atomic shuffle units.
    const sections = paper.sections.map(section => {
      const groups = section.fixed_groups.map(g => [...g]);
      const parents = new Map<string, string[]>();
      for (const item of section.items) if (item.question.material_parent_id) {
        const group = parents.get(item.question.material_parent_id) ?? [];
        group.push(item.id); parents.set(item.question.material_parent_id, group);
      }
      for (const siblings of parents.values()) {
        const overlap = groups.filter(g => g.some(id => siblings.includes(id)));
        const merged = new Set([...siblings, ...overlap.flat()]);
        for (const group of overlap) groups.splice(groups.indexOf(group), 1);
        groups.push(section.items.filter(i => merged.has(i.id)).map(i => i.id));
      }
      return { ...section, fixed_groups: groups };
    });
    const emitted = new Set<string>();
    let regions = sections.flatMap(section => {
      if (emitted.has(section.id)) return [];
      const mergedIds = paper.merged_shuffle_sections.find(group => group.includes(section.id));
      const members = mergedIds ? sections.filter(s => mergedIds.includes(s.id)) : [section];
      members.forEach(s => emitted.add(s.id));
      const units = members.flatMap(s => {
        const ordered = shuffleSection({ ...s, shuffle_questions: false }, seed).items;
        const seen = new Set<string>();
        return ordered.flatMap(item => {
          const group = s.fixed_groups.find(g => g.includes(item.id)) ?? [item.id];
          if (seen.has(item.id)) return [];
          group.forEach(id => seen.add(id));
          return [group.map(id => found(s.items.find(i => i.id === id)))];
        });
      });
      let arranged = mergedIds || section.shuffle_questions ? shuffle(units, seed) : units;
      if (paper.shuffle_materials && !mergedIds && !section.shuffle_questions) {
        const materials = shuffle(units.filter(unit => unit.some(i => i.question.material_parent_id)), seed);
        let cursor = 0;
        arranged = units.map(unit => unit.some(i => i.question.material_parent_id) ? materials[cursor++]! : unit);
      }
      return [{ items: arranged.flat() }];
    });
    if (paper.shuffle_sections) regions = shuffle(regions, seed);
    const items = regions.flatMap(region => region.items).map(item => ({ ...item,
      source_question_id: item.historical_source_question_id ?? item.source_question_id, question:
      'options' in item.question && paper.shuffle_options ? { ...item.question,
        options: shuffleOptions(item.question, seed ^ Number.parseInt(item.id.slice(0, 8), 16)) } : item.question }));
    if (!items.length) invalid('Cannot start an empty paper');
    const state: SessionState = { paper, items, seed, time_zone: data.time_zone, paused_at: null, daily_metrics: [] };
    await this.repositories.studySessions.create({ id, paper_id: paper.id, mode: data.mode,
      start_time: this.now().toISOString(), end_time: null, state_json: JSON.stringify(state) });
    return this.get(id);
  }
  private validateAnswer(question: QuestionView, raw: unknown): StudyAnswer {
    const answer = parse(StudyAnswerSchema, raw);
    if ('options' in question) {
      if (answer.kind !== 'choice' || answer.option_ids.some(id => !question.options.some(o => o.id === id)) ||
        (question.type === 'single_choice' && answer.option_ids.length > 1)) invalid('Answer does not match question');
    } else if ('blanks' in question) {
      if (answer.kind !== 'blanks' || answer.values.length !== question.blanks.length) invalid('Answer does not match blanks');
    } else if (answer.kind !== 'text') invalid('Expected text answer');
    return answer;
  }
  private async record(row: Row<'study_sessions'>, item: Item, answer: StudyAnswer, attempt: number) {
    const values = answer.kind === 'choice' ? answer.option_ids : answer.kind === 'blanks' ? answer.values : [answer.value];
    const result = scoreQuestion(item.question, values);
    const correct = result.isGraded && 'max_score' in item.question ? result.score === item.question.max_score : null;
    const record = await this.repositories.studySessions.addRecord({ id: randomUUID(), session_id: row.id,
      question_id: item.question.id, attempt_index: attempt, user_answer_json: JSON.stringify(answer),
      score: result.isGraded ? result.score : null, is_correct: correct === null ? null : correct ? 1 : 0,
      answered_at: this.now().toISOString() });
    if (result.isGraded && !correct) await new MistakeService(this.repositories).record(item.question,
      item.source_question_id, item.source_version, { study_record_id: record.id, answer, answered_at: record.answered_at });
    return { ...record, answer, locked: true, correct_answer: 'options' in item.question
      ? item.question.options.filter(o => o.is_correct).map(o => o.id) : 'blanks' in item.question
        ? item.question.blanks.map(b => b.valid_answers) : item.question.reference_answer,
      analysis: item.question.explanation };
  }
  private async complete(row: Row<'study_sessions'>, state: SessionState) {
    const end = this.now();
    const effective = Math.max(0, (end.getTime() - Date.parse(row.start_time)) / 1000 - row.paused_duration_seconds);
    state.daily_metrics = splitDurationAcrossMidnight(Date.parse(row.start_time), end.getTime(), effective, state.time_zone);
    await this.repositories.studySessions.update(row.id, { status: 'completed', end_time: end.toISOString(),
      effective_duration_seconds: effective, state_json: JSON.stringify(state) });
  }
  async submitQuestion(id: string, input: Record<string, unknown>) {
    const data = parse(z.strictObject({ question_id: IdSchema, answer: StudyAnswerSchema,
      attempt_index: z.number().int().positive().default(1) }), input);
    const { row, state } = await this.load(id);
    if (row.mode !== 'practice' || !['in_progress', 'completed'].includes(row.status)) conflict('Practice session is not active');
    const item = found(state.items.find(i => i.question.id === data.question_id));
    const records = await this.repositories.studySessions.listRecords(id);
    const latest = Math.max(0, ...records.filter(r => r.question_id === data.question_id).map(r => r.attempt_index));
    if (data.attempt_index !== latest + 1) conflict('Submission is locked; a re-attempt requires the next attempt_index');
    const result = await this.record(row, item, this.validateAnswer(item.question, data.answer), data.attempt_index);
    if (row.status !== 'completed' && state.items.every(i => i.question.id === item.question.id || records.some(r => r.question_id === i.question.id)))
      await this.complete(row, state);
    return result;
  }
  async submitExam(id: string, input: Record<string, unknown>) {
    const data = parse(z.strictObject({ answers: z.array(z.strictObject({ question_id: IdSchema, answer: StudyAnswerSchema })).default([]) }), input);
    const { row, state } = await this.load(id);
    if (row.mode !== 'exam' || row.status !== 'in_progress') conflict('Exam is not active');
    if (new Set(data.answers.map(a => a.question_id)).size !== data.answers.length ||
      data.answers.some(a => !state.items.some(i => i.question.id === a.question_id))) invalid('Invalid exam question IDs');
    const results = [];
    for (const item of state.items) {
      const raw = data.answers.find(a => a.question_id === item.question.id)?.answer;
      const blank: StudyAnswer = 'options' in item.question ? { kind: 'choice', option_ids: [] } :
        'blanks' in item.question ? { kind: 'blanks', values: item.question.blanks.map(() => '') } : { kind: 'text', value: '' };
      results.push(await this.record(row, item, this.validateAnswer(item.question, raw ?? blank), 1));
    }
    await this.complete(row, state);
    return { results, answered_count: results.filter(r => answered(r.answer)).length,
      score: results.reduce((sum, result) => sum + (result.score ?? 0), 0) };
  }
  async pause(id: string, resume = false) {
    const { row, state } = await this.load(id);
    if (row.status !== (resume ? 'paused' : 'in_progress')) conflict('Invalid pause transition');
    let paused = row.paused_duration_seconds;
    if (resume) { paused += Math.max(0, (this.now().getTime() - Date.parse(found(state.paused_at ?? undefined))) / 1000); state.paused_at = null; }
    else state.paused_at = this.now().toISOString();
    await this.repositories.studySessions.update(id, { status: resume ? 'in_progress' : 'paused',
      paused_duration_seconds: paused, state_json: JSON.stringify(state) });
    return this.get(id);
  }
}

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Repositories, Row } from '@quarry/database';
import { AppError, ErrorCode, IdSchema, PaperSectionSchema, QuestionType, ScoreMode } from '@quarry/shared';
import { found, idsSchema, invalid, nameSchema, parse } from './common.js';
import { QuestionService, questionRow } from './question.service.js';
import type { QuestionView } from './question.service.js';

const sectionConfig = z.strictObject({ id: IdSchema, title: nameSchema, question_type: z.enum(QuestionType),
  shuffle_questions: z.boolean().default(false), fixed_groups: z.array(idsSchema.min(2)).default([]) });
const composerSchema = z.strictObject({ sections: z.array(sectionConfig).default([]),
  merged_shuffle_sections: z.array(idsSchema.min(2)).default([]), shuffle_materials: z.boolean().default(false) });
const paperInput = z.strictObject({ name: nameSchema, folder_id: IdSchema.nullable().default(null),
  description: z.string().default(''), full_score: z.number().finite().nonnegative().default(0),
  score_mode: z.enum(ScoreMode).default(ScoreMode.AllOrNothing),
  time_limit_seconds: z.number().int().positive().nullable().default(null),
  shuffle_options: z.boolean().default(false), shuffle_sections: z.boolean().default(false),
  follow_source: z.boolean().default(false), tag_ids: idsSchema.default([]),
  shuffle_materials: z.boolean().default(false), merged_shuffle_sections: z.array(idsSchema.min(2)).default([]),
  sections: z.array(z.unknown()).optional() });
const itemInput = z.strictObject({ id: IdSchema.optional(), source_question_id: IdSchema.nullable().optional(),
  question: z.record(z.string(), z.unknown()).optional(), question_id: IdSchema.optional(),
  full_score: z.number().finite().positive().optional(), score_mode: z.enum(ScoreMode).optional() });
type Composer = z.infer<typeof composerSchema>;

export class PaperService {
  readonly questions: QuestionService;
  constructor(readonly repositories: Repositories) { this.questions = new QuestionService(repositories); }
  async get(id: string) {
    const row = found(await this.repositories.papers.findById(id));
    const composer = parse(composerSchema, JSON.parse(row.composer_json));
    const items: (Row<'paper_items'> & { source_available: boolean; question: QuestionView })[] = [];
    for (const item of await this.repositories.papers.listItems(id)) {
      const question = await this.repositories.questions.findById(item.question_id);
      if (question) items.push({ ...item, source_available: !item.source_invalid,
        question: await this.questions.view(question) });
    }
    const { composer_json, ...paper } = row;
    return { ...paper, follow_source: !!row.follow_source, shuffle_options: !!row.shuffle_options,
      shuffle_sections: !!row.shuffle_sections, tag_ids: await this.questions.tags.ids(id, 'file'),
      ...composer, sections: composer.sections.map((section, index) => ({ ...section,
        items: items.filter(item => item.section_index === index) })) };
  }
  async save(input: Record<string, unknown>, id?: string) {
    const old = id ? await this.get(id) : undefined;
    const defaults = old ? { name: old.name, folder_id: old.folder_id, description: old.description,
      full_score: old.full_score, score_mode: old.score_mode, time_limit_seconds: old.time_limit_seconds,
      shuffle_options: old.shuffle_options, shuffle_sections: old.shuffle_sections, follow_source: old.follow_source,
      tag_ids: old.tag_ids, shuffle_materials: old.shuffle_materials,
      merged_shuffle_sections: old.merged_shuffle_sections } : {};
    const data = parse(paperInput, { ...defaults, ...input });
    if (data.folder_id) found(await this.repositories.folders.findById(data.folder_id));
    await this.questions.tags.validate(data.tag_ids, 'file');
    const paperId = id ?? randomUUID();
    const { sections, merged_shuffle_sections, shuffle_materials, tag_ids, ...fields } = data;
    const row = { ...fields, follow_source: data.follow_source ? 1 as const : 0 as const,
      shuffle_options: data.shuffle_options ? 1 as const : 0 as const,
      shuffle_sections: data.shuffle_sections ? 1 as const : 0 as const };
    if (id) await this.repositories.papers.update(id, row);
    else await this.repositories.papers.create({ id: paperId, ...row });
    await this.questions.tags.replace(paperId, 'file', tag_ids);
    let composer: Composer = { sections: old?.sections.map(({ items, ...config }) => config) ?? [],
      merged_shuffle_sections, shuffle_materials };
    if (sections) composer = await this.compose(paperId, sections, composer);
    await this.validateComposer(paperId, composer);
    await this.repositories.papers.update(paperId, { composer_json: JSON.stringify(composer) });
    return this.get(paperId);
  }
  private async material(row: Row<'questions'>): Promise<string | null> {
    if (row.material !== null) return row.material;
    const seen = new Set([row.id]);
    let parentId = row.material_parent_id;
    const parts: string[] = [];
    while (parentId) {
      if (seen.has(parentId)) invalid('Circular material hierarchy');
      seen.add(parentId);
      const parent = await this.repositories.questions.findById(parentId);
      if (!parent) break;
      parts.unshift(parent.material ?? parent.stem);
      parentId = parent.material_parent_id;
    }
    return parts.length ? parts.join('\n\n') : null;
  }
  private async source(id: string) {
    const row = await this.repositories.questions.findById(id);
    if (!row?.bank_id || !await this.repositories.questionBanks.findById(row.bank_id)) return undefined;
    return row;
  }
  private async snapshot(source: Row<'questions'>, paperId: string, parents: Map<string, string>): Promise<QuestionView> {
    let parentId: string | null = null;
    if (source.material_parent_id) {
      parentId = parents.get(source.material_parent_id) ?? null;
      if (!parentId) {
        const parent = found(await this.source(source.material_parent_id));
        parentId = (await this.snapshot(parent, paperId, parents)).id;
      }
    }
    const original = await this.questions.view(source);
    const copy = await this.questions.save({ ...original, id: randomUUID(), owner_type: 'paper', owner_id: paperId,
      material_parent_id: parentId, material: await this.material(source) });
    parents.set(source.id, copy.id);
    return copy;
  }
  private async compose(id: string, rawSections: unknown[], previous: Composer): Promise<Composer> {
    const existing = await this.repositories.papers.listItems(id);
    const retained = new Set<string>();
    const sections: Composer['sections'] = [];
    const parents = new Map<string, string>();
    for (const item of existing) if (item.source_question_id) {
      const source = await this.source(item.source_question_id);
      const copy = await this.repositories.questions.findById(item.question_id);
      if (source?.material_parent_id && copy?.material_parent_id)
        parents.set(source.material_parent_id, copy.material_parent_id);
    }
    for (const [index, raw] of rawSections.entries()) {
      const value = parse(z.record(z.string(), z.unknown()), raw);
      const { items: rawItems, ...config } = value;
      const section = parse(sectionConfig, { id: randomUUID(), ...config });
      sections.push(section);
      const items = parse(z.array(itemInput), rawItems ?? []);
      for (const [order, input] of items.entries()) {
        const old = input.id ? existing.find(item => item.id === input.id) : undefined;
        if (input.id && retained.has(input.id)) invalid('Paper items must be unique');
        if (old) {
          if (retained.has(old.id)) invalid('Paper items must be unique');
          if (input.question || input.source_question_id || input.question_id)
            invalid('Existing items use their ID; edit content through the question route');
          retained.add(old.id);
          await this.repositories.papers.updateItem(old.id, { section_index: index, section_name: section.title,
            sort_order: order, group_id: section.fixed_groups.find(g => g.includes(old.id))?.[0] ?? null });
          if (input.full_score !== undefined || input.score_mode !== undefined) {
            const q = await this.questions.get(old.question_id);
            await this.questions.save({ ...('max_score' in q && input.full_score !== undefined ? { max_score: input.full_score } : {}),
              ...('score_mode' in q && input.score_mode !== undefined ? { score_mode: input.score_mode } : {}) }, q.id);
          }
          continue;
        }
        if ([!!input.source_question_id, !!input.question, !!input.question_id].filter(Boolean).length !== 1)
          invalid('Provide exactly one source_question_id, question_id or inline question');
        let question: QuestionView;
        let source: Row<'questions'> | undefined;
        if (input.source_question_id) {
          source = found(await this.source(input.source_question_id));
          question = await this.snapshot(source, id, parents);
        } else if (input.question_id) {
          question = await this.questions.get(input.question_id);
          if (question.owner_type !== 'paper' || question.owner_id !== id) invalid('Question must belong to this paper');
          if (existing.some(item => item.question_id === question.id)) invalid('Question is already composed');
        } else question = await this.questions.save({ ...input.question, id: randomUUID(), owner_type: 'paper', owner_id: id });
        if (input.full_score !== undefined || input.score_mode !== undefined) question = await this.questions.save({
          ...('max_score' in question && input.full_score !== undefined ? { max_score: input.full_score } : {}),
          ...('score_mode' in question && input.score_mode !== undefined ? { score_mode: input.score_mode } : {}),
        }, question.id);
        const itemId = input.id ?? randomUUID();
        const item = await this.repositories.papers.addItem({ id: itemId, paper_id: id, question_id: question.id,
          source_question_id: source?.id ?? null, source_version: source?.version ?? null,
          section_index: index, section_name: section.title, sort_order: order,
          group_id: section.fixed_groups.find(group => group.includes(itemId))?.[0] ?? null });
        retained.add(item.id);
      }
    }
    for (const item of existing) if (!retained.has(item.id)) {
      await this.repositories.papers.removeItem(item.id);
      await this.repositories.questions.delete(item.question_id);
    }
    // Existing material siblings form an indivisible ordered block.
    const before = new Map<string, string[]>();
    for (const item of existing) {
      const question = await this.repositories.questions.findById(item.question_id);
      if (!question?.material_parent_id || !retained.has(item.id)) continue;
      const siblings = before.get(question.material_parent_id) ?? [];
      siblings.push(item.id);
      before.set(question.material_parent_id, siblings);
    }
    const after = await this.repositories.papers.listItems(id);
    for (const siblings of before.values()) {
      const reordered = after.filter(item => siblings.includes(item.id)).map(item => item.id);
      if (JSON.stringify(reordered) !== JSON.stringify(siblings)) invalid('Material children must retain their relative order');
    }
    return { ...previous, sections };
  }
  private async validateComposer(id: string, composer: Composer) {
    if (new Set(composer.sections.map(s => s.id)).size !== composer.sections.length) invalid('Duplicate section IDs');
    const items = await this.repositories.papers.listItems(id);
    const materialGroups = new Map<string, Row<'paper_items'>[]>();
    for (const item of items) {
      const question = found(await this.repositories.questions.findById(item.question_id));
      if (!question.material_parent_id) continue;
      const siblings = materialGroups.get(question.material_parent_id) ?? [];
      siblings.push(item);
      materialGroups.set(question.material_parent_id, siblings);
    }
    for (const siblings of materialGroups.values()) {
      if (siblings.some((item, index) => item.section_index !== siblings[0]!.section_index
        || (index > 0 && item.sort_order !== siblings[index - 1]!.sort_order + 1)))
        invalid('Material children must remain together in one section');
    }
    for (const [index, section] of composer.sections.entries()) {
      const sectionItems = items.filter(item => item.section_index === index);
      const validated = [];
      for (const item of sectionItems) {
        const { material, material_parent_id, ...question } = await this.questions.get(item.question_id);
        validated.push({ id: item.id, question, source_question_id: item.source_question_id,
          source_version: item.source_version, source_available: !item.source_invalid });
      }
      parse(PaperSectionSchema, { ...section, items: validated });
      for (const group of section.fixed_groups) {
        const indexes = group.map(member => sectionItems.findIndex(i => i.id === member));
        if (indexes.some((n, i) => i > 0 && n !== indexes[i - 1]! + 1)) invalid('Fixed groups must be contiguous and ordered');
      }
    }
    const known = new Set(composer.sections.map(s => s.id));
    const used = new Set<string>();
    for (const group of composer.merged_shuffle_sections) for (const sectionId of group) {
      if (!known.has(sectionId) || used.has(sectionId)) invalid('Merged sections must exist without overlap');
      used.add(sectionId);
    }
  }
  async addItem(id: string, input: Record<string, unknown>) {
    const paper = await this.get(id);
    const parsed = parse(itemInput, input);
    const source = parsed.source_question_id ? found(await this.source(parsed.source_question_id)) : undefined;
    const type = source?.type ?? (parsed.question_id ? (await this.questions.get(parsed.question_id)).type : parsed.question?.type);
    parse(z.enum(QuestionType), type);
    const sections = paper.sections.map(section => ({ ...section, items: section.items.map(item => ({ id: item.id })) }));
    let section = sections.find(s => s.question_type === type);
    if (!section) {
      section = { id: randomUUID(), title: String(type), question_type: type as QuestionType,
        shuffle_questions: false, fixed_groups: [], items: [] };
      sections.push(section);
    }
    (section.items as unknown[]).push(parsed);
    return this.save({ sections }, id);
  }
  async diff(id: string) {
    await this.get(id);
    const changes = [];
    for (const item of await this.repositories.papers.listItems(id)) {
      if (!item.source_question_id) continue;
      const source = await this.source(item.source_question_id);
      const snapshot = found(await this.repositories.questions.findById(item.question_id));
      if (!source) {
        changes.push({ item_id: item.id, source_question_id: item.source_question_id, source_invalid: true,
          source_version: item.source_version, changes: {} });
        continue;
      }
      const before = { type: snapshot.type, stem: snapshot.stem, options: JSON.parse(snapshot.options_json ?? 'null'),
        answers: JSON.parse(snapshot.standard_answers_json ?? snapshot.blanks_json ?? 'null'), analysis: snapshot.analysis,
        material: await this.material(snapshot), tags: await this.questions.tags.ids(snapshot.id, 'question') };
      const after: typeof before = { type: source.type, stem: source.stem, options: JSON.parse(source.options_json ?? 'null'),
        answers: JSON.parse(source.standard_answers_json ?? source.blanks_json ?? 'null'), analysis: source.analysis,
        material: await this.material(source), tags: await this.questions.tags.ids(source.id, 'question') };
      // Choice answer identities are reported separately from option content.
      const answers = (row: Row<'questions'>) => row.options_json
        ? (JSON.parse(row.options_json) as { id: string; is_correct: boolean }[]).filter(o => o.is_correct).map(o => o.id)
        : JSON.parse(row.standard_answers_json ?? row.blanks_json ?? 'null');
      before.answers = answers(snapshot); after.answers = answers(source);
      const fields: Record<string, { before: unknown; after: unknown }> = {};
      for (const key of Object.keys(before) as (keyof typeof before)[])
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) fields[key] = { before: before[key], after: after[key] };
      if (Object.keys(fields).length || item.source_version !== source.version || item.source_invalid)
        changes.push({ item_id: item.id, source_question_id: source.id, source_invalid: false,
          source_version: source.version, changes: fields });
    }
    return changes;
  }
  async applyFollow(id: string) {
    const paper = found(await this.repositories.papers.findById(id));
    if (!paper.follow_source) throw new AppError(ErrorCode.InvalidState, 'Source following is disabled');
    const changedIds = new Set((await this.diff(id)).map(change => change.item_id));
    for (const item of await this.repositories.papers.listItems(id)) {
      if (!changedIds.has(item.id)) continue;
      if (!item.source_question_id) continue;
      const source = await this.source(item.source_question_id);
      if (!source) { await this.repositories.papers.updateItem(item.id, { source_invalid: 1 }); continue; }
      const snapshot = found(await this.repositories.questions.findById(item.question_id));
      if (snapshot.type !== source.type) invalid('Source type changed; recompose the paper before following');
      const original = await this.questions.view(source);
      const { id: ignored, ...content } = questionRow(original);
      await this.repositories.questions.update(snapshot.id, { ...content,
        bank_id: null, paper_id: id, material: await this.material(source),
        material_parent_id: source.material_parent_id ? snapshot.material_parent_id : null,
        full_score: snapshot.full_score, score_mode: snapshot.score_mode, version: snapshot.version + 1 });
      await this.questions.tags.replace(snapshot.id, 'question', original.tag_ids);
      await this.repositories.papers.updateItem(item.id, { source_version: source.version, source_invalid: 0 });
    }
    return this.get(id);
  }
  async delete(id: string) {
    await this.get(id);
    for (const question of await this.repositories.questions.list())
      if (question.paper_id === id) await this.repositories.questions.delete(question.id);
    await this.repositories.papers.delete(id);
  }
  async removeItem(paperId: string, itemId: string) {
    const paper = found(await this.repositories.papers.findById(paperId));
    const item = found((await this.repositories.papers.listItems(paperId)).find(entry => entry.id === itemId));
    const composer = parse(composerSchema, JSON.parse(paper.composer_json));
    for (const section of composer.sections) section.fixed_groups = section.fixed_groups
      .map(group => group.filter(id => id !== itemId)).filter(group => group.length >= 2);
    await this.repositories.papers.removeItem(itemId);
    await this.repositories.questions.delete(item.question_id);
    const orders = new Map<number, number>();
    for (const remaining of await this.repositories.papers.listItems(paperId)) {
      const section = composer.sections[remaining.section_index];
      const groupId = section?.fixed_groups.find(group => group.includes(remaining.id))?.[0] ?? null;
      const sort_order = orders.get(remaining.section_index) ?? 0;
      orders.set(remaining.section_index, sort_order + 1);
      await this.repositories.papers.updateItem(remaining.id, { group_id: groupId, sort_order });
    }
    await this.repositories.papers.update(paperId, { composer_json: JSON.stringify(composer) });
  }
}

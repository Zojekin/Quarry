
import { randomUUID } from 'node:crypto';
import { ContentDocumentSchema, QuestionType, validateContentReferences } from '@quarry/shared';
import type { ContentDocument } from '@quarry/shared';
import { findNodeAtLocation, parseTree } from 'jsonc-parser';
import { fail, markdownDraft, questionTypes } from './markdown.js';
import type { Locate, Path } from './markdown.js';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const mapArray = (value: unknown, map: (item: Record<string, unknown>) => unknown) =>
  Array.isArray(value) ? value.map(item => object(item) ? map(item) : item) : value;
const identified = (item: Record<string, unknown>) => ({ id: randomUUID(), ...item });
const labels = new Map(Object.entries(questionTypes).map(([label, type]) => [type, label]));

function normalize(value: unknown): unknown {
  if (!object(value)) return value;
  const ownerId = randomUUID();
  const questions = mapArray(value.questions, question => ({
    ...identified({
      version: 1,
      owner_id: ownerId,
      owner_type: value.entity === 'paper' ? 'paper' : 'question_bank',
      ...question,
    }),
    ...(question.options !== undefined && { options: mapArray(question.options, identified) }),
    ...(question.blanks !== undefined && { blanks: mapArray(question.blanks, identified) }),
  }));
  const tags = Array.isArray(value.tags) ? value.tags.map(tag => {
    if (typeof tag === 'string') return identified({ name: tag.trim(), target_type: 'file' });
    return object(tag) ? identified({ target_type: 'file', ...tag }) : tag;
  }) : value.tags;

  let paper = value.paper;
  if (value.entity === 'paper' && (paper === undefined || object(paper))) {
    const config = paper ?? {};
    const sections = new Map<unknown, { id: string; title: string; question_type: unknown; items: unknown[]; shuffle_questions: boolean; fixed_groups: unknown[] }>();
    let fullScore = 0;
    if (Array.isArray(questions)) for (const question of questions) {
      if (!object(question)) continue;
      const type = question.type as QuestionType;
      if (!labels.has(type)) continue;
      let section = sections.get(type);
      if (!section) {
        section = { id: randomUUID(), title: labels.get(type)!, question_type: type, items: [], shuffle_questions: false, fixed_groups: [] };
        sections.set(type, section);
      }
      section.items.push({ id: randomUUID(), question_id: question.id });
      if (type !== QuestionType.Subjective && type !== QuestionType.FreeFillInBlank) {
        fullScore += typeof question.max_score === 'number' && question.max_score > 0 ? question.max_score : 1;
      }
    }
    paper = {
      full_score: fullScore, score_mode: 'all_or_nothing', time_limit_seconds: null,
      shuffle_options: false, shuffle_sections: false, shuffle_materials: false, merged_shuffle_sections: [],
      ...config,
      sections: config.sections === undefined ? [...sections.values()] : mapArray(config.sections, section => ({
        ...identified({ shuffle_questions: false, fixed_groups: [], ...section }),
        ...(section.items !== undefined && { items: mapArray(section.items, identified) }),
      })),
    };
  }
  return {
    version: 1, ...value, questions,
    ...(tags !== undefined && { tags }),
    ...(value.attachments !== undefined && { attachments: mapArray(value.attachments, identified) }),
    ...(paper !== undefined && { paper }),
  };
}

function jsonDraft(source: string, offset: number): { value: unknown; locate: Locate } {
  const lineAt = (position: number) => offset + source.slice(0, position).split('\n').length;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    const message = String(error);
    const position = /position (\d+)/.exec(message)?.[1];
    fail(lineAt(position ? Number(position) : source.length), [], message);
  }
  const tree = parseTree(source);
  return {
    value,
    locate(path) {
      const keys = path.map(key => typeof key === 'symbol' ? String(key) : key);
      while (keys.length && tree) {
        const node = findNodeAtLocation(tree, keys);
        if (node) return lineAt(node.offset);
        keys.pop();
      }
      return offset + 1;
    },
  };
}

export function convertDocument(input: string, extension: '.md' | '.json'): ContentDocument {
  const source = input.replace(/^\uFEFF/, '');
  let draft: { value: unknown; locate: Locate };
  let questionLabels: string[] = [];
  if (extension === '.json') draft = jsonDraft(source, 0);
  else if (/^# Quarry(?:\r?\n|$)/.test(source)) {
    const match = /^# Quarry[ \t]*\r?\n(?:[ \t]*\r?\n)*```json\r?\n([\s\S]*?)\r?\n```\s*$/.exec(source);
    if (!match) fail(1, [], '标准导入 Markdown 须包含一个 JSON 围栏');
    const opening = match[0].indexOf('\n', match[0].indexOf('json'));
    draft = jsonDraft(match[1]!, source.slice(0, opening + 1).split('\n').length - 1);
  } else {
    const { value, locations, labels: names } = markdownDraft(source);
    questionLabels = names;
    draft = {
      value,
      locate(path) {
        const keys = [...path];
        while (keys.length) {
          const line = locations.get(keys.map(String).join('.'));
          if (line) return line;
          keys.pop();
        }
        return 1;
      },
    };
  }
  const value = normalize(draft.value);
  const report = (path: Path, message: string) => {
    const index = path[0] === 'questions' && typeof path[1] === 'number' ? path[1] : undefined;
    const question = index !== undefined && object(value) && Array.isArray(value.questions) ? value.questions[index] : undefined;
    const type = index === undefined ? undefined : questionLabels[index] ??
      (object(question) && typeof question.type === 'string' ? labels.get(question.type as QuestionType) ?? question.type : undefined);
    return fail(draft.locate(path), path, message, type);
  };
  const result = ContentDocumentSchema.safeParse(value);
  if (!result.success) {
    const [issue] = result.error.issues;
    return report(issue!.path, issue!.message);
  }
  validateContentReferences(result.data, report);
  return result.data;
}

export function summarize(document: ContentDocument): string {
  const counts = new Map<string, number>();
  let materials = 0;
  let children = 0;
  for (const question of document.questions) {
    if (question.material && !question.material_parent_id) materials++;
    if (question.material || question.material_parent_id) children++;
    else {
      const label = labels.get(question.type)!;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const details = [...counts].map(([label, count]) => `${label} ${count}`);
  if (materials || children) details.push(`材料题 ${materials}（含 ${children} 小题）`);
  return `✓ 校验通过：共识别 ${document.questions.length} 道题目${details.length ? `（${details.join('，')}）` : ''}`;
}

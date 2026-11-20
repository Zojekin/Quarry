
import { randomUUID } from 'node:crypto';
import { QuestionType } from '@quarry/shared';
import { parseDocument } from 'yaml';

export type Path = (number | string | symbol)[];
export type Locate = (path: Path) => number;
export const questionTypes = {
  单选: QuestionType.SingleChoice,
  多选: QuestionType.MultipleChoice,
  不定项: QuestionType.IndefiniteChoice,
  严格填空: QuestionType.StrictFillInBlank,
  填空: QuestionType.FreeFillInBlank,
  主观题: QuestionType.Subjective,
};
export function fail(line: number, path: Path, message: string, type?: string): never {
  throw new Error([`第 ${line} 行`, type, path.map(String).join('.') || 'document', message].filter(Boolean).join(' · '));
}

type Line = { text: string; line: number; literal: boolean };
type Block = { label: string; line: number; body: Line[]; children: Block[] };
const join = (lines: Line[]) => lines.map(line => line.text).join('\n').trim();

function blocks(lines: string[], start: number): Block[] {
  const result: Block[] = [];
  let current: Block | undefined;
  let material: Block | undefined;
  let fence: string | undefined;
  let math = false;
  for (let index = start; index < lines.length; index++) {
    const text = lines[index]!;
    const line = index + 1;
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    const literal = Boolean(fence || marker || math || text.trim().startsWith('$$'));
    const heading = literal ? null : /^(#{2,3})\s+\[([^\]]+)\](?:\s+(.*))?$/.exec(text);
    if (heading) {
      const label = heading[2]!;
      if (label !== '材料题' && !Object.hasOwn(questionTypes, label)) fail(line, ['type'], '未知题型', label);
      current = { label, line, body: [], children: [] };
      if (heading[3]) current.body.push({ text: heading[3], line, literal: false });
      if (heading[1] === '##') {
        result.push(current);
        material = label === '材料题' ? current : undefined;
      } else {
        if (!material || label === '材料题') fail(line, ['type'], '三级题目仅能放在材料题下', label);
        material.children.push(current);
      }
      continue;
    }
    if (current) current.body.push({ text, line, literal });
    else if (text.trim()) fail(line, ['questions'], '题目须以 ## [题型] 开始');
    if (marker && !math) {
      const token = marker[1]!;
      if (!fence) fence = token;
      else if (token[0] === fence[0] && token.length >= fence.length && !marker[2]?.trim()) fence = undefined;
    } else if (!fence && text.trim().startsWith('$$')) {
      const delimiters = [...text.matchAll(/(?<!\\)\$\$/g)];
      if (delimiters.length % 2) math = !math;
    }
  }
  if (fence || math) fail(lines.length, ['content'], '代码块或公式块缺少结束标记', current?.label);
  return result;
}

export function markdownDraft(source: string) {
  const lines = source.split(/\r?\n/);
  const end = lines.findIndex((line, index) => index > 0 && /^---[ \t]*$/.test(line));
  if (lines[0]?.trim() !== '---' || end < 0) fail(1, [], '缺少 YAML Frontmatter');
  const yaml = parseDocument(lines.slice(1, end).join('\n'));
  if (yaml.errors[0]) fail((yaml.errors[0].linePos?.[0]?.line ?? 1) + 1, [], yaml.errors[0].message);
  const metadata: unknown = yaml.toJS({ maxAliasCount: 20 });
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) fail(2, [], '元信息必须是对象');
  for (const key of Object.keys(metadata)) {
    if (!['entity', 'name', 'description', 'tags'].includes(key)) fail(2, [key], '未知元信息字段');
  }

  const questions: Record<string, unknown>[] = [];
  const locations = new Map<string, number>();
  const labels: string[] = [];
  for (let index = 1; index < end; index++) {
    const key = /^([\w-]+):/.exec(lines[index]!);
    if (key) locations.set(key[1]!, index + 1);
  }

  function add(block: Block, material?: string, parent?: string) {
    const index = questions.length;
    const prefix = ['questions', index];
    const at = (path: Path, line: number) => locations.set([...prefix, ...path].join('.'), line);
    at([], block.line);
    labels.push(block.label);
    const type = questionTypes[block.label as keyof typeof questionTypes];
    const question: Record<string, unknown> = { id: randomUUID(), type, material, material_parent_id: parent };
    const choice = type === QuestionType.SingleChoice || type === QuestionType.MultipleChoice || type === QuestionType.IndefiniteChoice;
    const content: Line[] = [];
    const options: { content: string; is_correct: boolean }[] = [];
    const blanks: { valid_answers: string[] }[] = [];
    const directives = new Map<string, Line[]>();
    let directive: Line[] | undefined;
    for (const line of block.body) {
      const control = !line.literal && /^>\s*(答案解析|解析|参考答案|判分)[：:][ \t]*(.*)$/.exec(line.text);
      const option = !line.literal && choice && /^ {0,3}-\s+(?:\(([xX ])\)|\[([xX ])\])(?:\s+(.*)|$)/.exec(line.text);
      if (control) {
        const field = control[1] === '参考答案' ? 'reference_answer' : control[1] === '判分' ? 'score_mode' : 'explanation';
        if (directives.has(field)) fail(line.line, [...prefix, field], '重复指令', block.label);
        directive = [{ ...line, text: control[2]! }];
        directives.set(field, directive);
        at([field], line.line);
      } else if (option) {
        at(['options', options.length], line.line);
        options.push({ content: (option[3] ?? '').replace(/^[A-Z][.、)][ \t]+/i, ''), is_correct: (option[1] ?? option[2])?.toLowerCase() === 'x' });
        directive = undefined;
      } else if (directive && /^\s*>/.test(line.text)) {
        directive.push({ ...line, text: line.text.replace(/^\s*> ?/, '') });
      } else {
        if (line.text.trim()) directive = undefined;
        content.push(line);
      }
    }
    for (const [field, value] of directives) {
      const body = join(value);
      if (field === 'score_mode') {
        if (body !== '按比例得分' && body !== '完全正确') fail(value[0]!.line, [...prefix, field], '判分须为按比例得分或完全正确', block.label);
        question[field] = body === '按比例得分' ? 'proportional' : 'all_or_nothing';
      } else question[field] = body;
    }
    if (choice) question.options = options;
    if (type === QuestionType.StrictFillInBlank) {
      for (const line of content) {
        if (line.literal) continue;
        line.text = line.text.replace(/(?<!\\)(`+)(.*?)\1|(?<!\\)\$\$(?:\\.|[^$\\]|\$(?!\$))*\$\$|(?<!\\)\$(?:\\.|[^$\\])*\$|(?<![\\!\]])\[((?:\\.|[^\[\]\\])+)\](?![\[(])/g,
          (match: string, ticks: string | undefined, _code: string | undefined, answer: string | undefined) => {
            if (ticks || answer === undefined) return match;
            at(['blanks', blanks.length], line.line);
            blanks.push({ valid_answers: answer.split(/(?<!\\)\|/).map(value => value.replace(/\\([|[\]\\])/g, '$1')) });
            return '____';
          });
      }
      question.blanks = blanks;
    }
    question.content = join(content);
    questions.push(question);
    return question.id as string;
  }

  for (const block of blocks(lines, end + 1)) {
    if (block.label !== '材料题') {
      add(block);
      continue;
    }
    const [first, ...children] = block.children;
    const material = join(block.body);
    if (!material || !first) fail(block.line, ['questions'], '材料题需要材料正文及至少一道小题', block.label);
    const parent = add(first, material);
    for (const child of children) add(child, undefined, parent);
  }
  return { value: { ...metadata, questions }, locations, labels };
}

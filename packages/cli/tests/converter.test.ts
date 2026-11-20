
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../build.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { convertDocument, summarize } from '../src/document.js';
import { spec } from '../src/spec.js';

const sample = spec.slice(spec.indexOf('\n---\n') + 1);
const header = '---\nentity: bank\nname: 测试\n---\n';
const convert = (body: string) => convertDocument(header + body, '.md');

describe('Markdown', () => {
  it('converts all six types and assigns material relationships', () => {
    const document = convertDocument(sample, '.md');
    expect(document.questions.map(question => question.type)).toEqual([
      'single_choice', 'multiple_choice', 'indefinite_choice', 'strict_fill_in_blank',
      'free_fill_in_blank', 'subjective', 'single_choice', 'strict_fill_in_blank',
    ]);
    expect(document.questions[0]).toMatchObject({ options: [{ content: '4', is_correct: true }, { content: '5', is_correct: false }], explanation: '两个 2 相加得 4。' });
    expect(document.questions[1]).toMatchObject({ score_mode: 'proportional' });
    expect(document.questions[2]).toMatchObject({ score_mode: 'all_or_nothing' });
    expect(document.questions[3]).toMatchObject({ content: '水的化学式是 ____，冰熔化为 ____。', blanks: [{ valid_answers: ['H2O', 'H₂O'] }, { valid_answers: ['液态'] }] });
    expect(document.questions[4]).toMatchObject({ reference_answer: '太阳能' });
    expect(document.questions[6]?.material).toContain('20 人');
    expect(document.questions[7]?.material_parent_id).toBe(document.questions[6]?.id);
    expect(document.tags.map(tag => tag.name)).toEqual(['示例', '数学']);
    expect(summarize(document)).toContain('材料题 1（含 2 小题）');
  });

  it('preserves formulas, links, tables, fenced code and multiline answers', () => {
    const body = [
      '## [严格填空] $f[a]$ ' + '`[code]`' + ' [link](https://example.org) [a\\|b|c]',
      '$$', '## [单选]', 'x_[0]', '$$',
      '~~~md', '## [多选]', '> 解析：示例', '[literal]', '~~~',
      '| a | b |', '| - | - |', '| 1 | 2 |',
      '> 解析：第一行', '> 第二行',
    ].join('\n');
    const [question] = convert(body).questions;
    expect(question?.content).toBe(body.split('\n').slice(0, -2).join('\n').replace('## [严格填空] ', '').replace('[a\\|b|c]', '____'));
    expect(question).toMatchObject({ explanation: '第一行\n第二行', blanks: [{ valid_answers: ['a|b', 'c'] }] });
  });

  it.each(['- [ ] A\n- [ ] B', '- (x) A\n- [x] B'])('rejects an invalid single choice', options => {
    expect(() => convert('## [单选] 题干\n' + options)).toThrow(/第 5 行.*单选.*questions\.0\.options.*Exactly one/);
  });
  it.each([
    ['### [单选] 孤立小题', /第 5 行.*三级/],
    ['## [材料题] 缺少小题', /第 5 行.*材料题.*至少/],
    ['## [未知] 内容', /第 5 行.*未知题型/],
    ['## [主观题] 内容', /第 5 行.*reference_answer/],
    ['## [严格填空] [a|]', /第 5 行.*valid_answers/],
    ['## [多选] 内容\n> 判分：未知', /第 6 行.*score_mode/],
    ['## [填空] 内容\n> 参考答案：答案\n> 参考答案：重复', /第 7 行.*重复/],
    ['## [填空] 内容\n~~~', /第 6 行.*结束/],
  ] as const)('rejects malformed blocks', (body, error) => {
    expect(() => convert(body)).toThrow(error);
  });
});

describe('JSON', () => {
  const draft = { entity: 'paper', name: '套题', paper: { shuffle_options: true }, questions: [
    { type: 'strict_fill_in_blank', content: '____', blanks: [{ valid_answers: ['a'] }] },
    { type: 'subjective', content: '题目', reference_answer: '答案' },
  ] };
  it('adds generated fields, groups sections and preserves existing configuration', () => {
    const document = convertDocument(JSON.stringify(draft), '.json');
    expect(document).toMatchObject({ version: 1, paper: { full_score: 1, shuffle_options: true, shuffle_materials: false } });
    const [question, second] = document.questions;
    expect(question?.owner_id).toBe(second?.owner_id);
    expect(question).toMatchObject({ version: 1, owner_type: 'paper', score_mode: 'all_or_nothing' });
    expect(question?.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(document.paper?.sections[0]?.items[0]?.question_id).toBe(question?.id);
    expect(convertDocument(JSON.stringify(document), '.json')).toEqual(document);
  });

  it('reports the precise line for a nested question field', () => {
    const value = { ...draft, questions: [{ ...draft.questions[1], reference_answer: '' }] };
    const source = JSON.stringify(value, null, 2);
    const line = source.split('\n').findIndex(entry => entry.includes('reference_answer')) + 1;
    expect(() => convertDocument(source, '.json')).toThrow(new RegExp('第 ' + line + ' 行.*主观题.*questions\\.0\\.reference_answer'));
  });

  it('checks material and section references', () => {
    const document = convertDocument(JSON.stringify(draft), '.json');
    document.questions[0]!.material_parent_id = document.questions[0]!.id;
    expect(() => convertDocument(JSON.stringify(document), '.json')).toThrow(/material_parent_id.*Invalid material/);
    document.questions[0]!.material_parent_id = null;
    document.paper!.sections[0]!.items[0]!.question_id = randomUUID();
    expect(() => convertDocument(JSON.stringify(document), '.json')).toThrow(/paper\.sections\.0\.items/);
  });

  it('rejects invalid JSON and malformed frontmatter', () => {
    expect(() => convertDocument('{\n  "name":\n', '.json')).toThrow(/第 3 行/);
    expect(() => convertDocument('---\nname: [\n---', '.md')).toThrow(/第 2 行/);
    expect(() => convertDocument('# Quarry\ninvalid\n', '.md')).toThrow(/JSON 围栏/);
  });
});

describe('CLI executable', () => {
  let directory: string;
  let cli: string;
  let input: string;
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'quarry-cli-'));
    cli = join(directory, 'quarry.mjs');
    input = join(directory, '题目.md');
    bundle(cli);
    writeFileSync(input, sample);
  });
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it('validates and prints the spec', () => {
    expect(run('validate', input)).toMatchObject({ status: 0, stdout: expect.stringContaining('共识别 8 道题目') });
    expect(run('spec')).toMatchObject({ status: 0, stdout: expect.stringContaining('### [严格填空]') });
  });
  it.each(['md', 'json'] as const)('converts to %s and accepts the generated file', format => {
    const output = join(directory, 'output.' + format);
    execFileSync(process.execPath, [cli, 'convert', input, '-o', output, '--format', format]);
    expect(convertDocument(readFileSync(output, 'utf8'), format === 'md' ? '.md' : '.json').questions).toHaveLength(8);
    expect(run('validate', output).status).toBe(0);
  });
  it('returns nonzero on content errors and invalid options', () => {
    const invalid = join(directory, 'invalid.md');
    writeFileSync(invalid, header + '## [单选] 错题');
    expect(run('validate', invalid)).toMatchObject({ status: 1, stderr: expect.stringMatching(/第 5 行.*questions\.0\.options/) });
    expect(run('convert', input).status).toBe(1);
    expect(run('convert', input, '-o', invalid, '--format', 'xml').status).toBe(1);
  });
});

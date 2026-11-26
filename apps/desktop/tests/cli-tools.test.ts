import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cliToolsPaths, createCliTools } from '../src/cli-tools.js';

const skill = '# 题目转换\n';
let root: string;
let cliPath: string;
let skillDirectory: string;
let home: string;

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'quarry-cli-')));
  ({ cliPath, skillDirectory } = cliToolsPaths(root, path.join(root, "Quarry's resources")));
  home = path.join(root, 'home');
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(path.join(skillDirectory, 'SKILL.md'), skill);
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

it('uses the built CLI and canonical Skill from the checkout in development', () => {
  expect(cliToolsPaths(path.join(root, 'apps', 'desktop', 'dist', 'runtime'))).toEqual({
    cliPath: path.join(root, 'packages', 'cli', 'dist', 'index.js'),
    skillDirectory: path.join(root, 'skills', 'question-converter'),
  });
});

it('reports the packaged CLI command and supported Skill paths', async () => {
  const options = { cliPath, skillDirectory, home, pickDirectory: vi.fn() };
  const tools = createCliTools({ ...options, platform: 'win32' });
  expect((await tools.getInfo()).cli).toBeNull();
  await mkdir(path.dirname(cliPath), { recursive: true });
  await writeFile(cliPath, 'export {};');
  const info = await tools.getInfo();
  expect(info.cli).toEqual({ path: cliPath, command: `node '${cliPath.replaceAll("'", "''")}'` });
  expect(info.targets).toEqual([
    { id: 'claude', label: 'Claude Code', path: path.join(home, '.claude', 'skills', 'question-converter') },
    { id: 'codex', label: 'Codex', path: path.join(home, '.codex', 'skills', 'question-converter') },
    { id: 'gemini', label: 'Gemini CLI', path: path.join(home, '.gemini', 'skills', 'question-converter') },
    { id: 'antigravity', label: 'Antigravity', path: path.join(home, '.gemini', 'antigravity', 'skills', 'question-converter') },
  ]);
});

it('installs the Skill directory with its resources and preserves an existing installation', async () => {
  await mkdir(path.join(skillDirectory, 'references'));
  await writeFile(path.join(skillDirectory, 'references', 'example.md'), 'example');
  const pickDirectory = vi.fn();
  const tools = createCliTools({ cliPath, skillDirectory, home, platform: process.platform, pickDirectory });
  const parent = path.join(home, '.codex', 'skills');
  const destination = path.join(parent, 'question-converter');
  const file = path.join(destination, 'SKILL.md');
  await expect(tools.installSkill('codex')).resolves.toEqual({ status: 'installed', path: file });
  expect(await readFile(file, 'utf8')).toBe(skill);
  expect(await readFile(path.join(destination, 'references', 'example.md'), 'utf8')).toBe('example');
  await writeFile(file, 'local changes');
  await expect(tools.installSkill('codex')).rejects.toThrow('目标已存在');
  expect(await readFile(file, 'utf8')).toBe('local changes');
  expect(await readdir(parent)).toEqual(['question-converter']);
  expect(pickDirectory).not.toHaveBeenCalled();
});

it('validates requested targets and installs only into the picked custom directory', async () => {
  const pickDirectory = vi.fn<() => Promise<string | undefined>>();
  const tools = createCliTools({ cliPath, skillDirectory, home, platform: process.platform, pickDirectory });
  await expect(tools.installSkill(root)).rejects.toThrow('无效的 Skill 安装目标');
  await expect(tools.installSkill('constructor')).rejects.toThrow('无效的 Skill 安装目标');
  expect(pickDirectory).not.toHaveBeenCalled();

  pickDirectory.mockResolvedValueOnce(undefined).mockResolvedValueOnce('relative').mockResolvedValueOnce(root);
  await expect(tools.installSkill('custom')).resolves.toEqual({ status: 'canceled' });
  await expect(tools.installSkill('custom')).rejects.toThrow('有效的 Skill 安装目录');
  const file = path.join(root, 'question-converter', 'SKILL.md');
  await expect(tools.installSkill('custom')).resolves.toEqual({ status: 'installed', path: file });
  expect(await readFile(file, 'utf8')).toBe(skill);
});

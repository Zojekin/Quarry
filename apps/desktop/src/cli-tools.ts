import { cp, lstat, mkdir, mkdtemp, realpath, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DesktopCliToolsInfo, SkillInstallResult, SkillPreset } from '@quarry/shared';

const skillName = 'question-converter';
const presets: Record<SkillPreset, { label: string; directory: string[] }> = {
  claude: { label: 'Claude Code', directory: ['.claude', 'skills'] },
  codex: { label: 'Codex', directory: ['.codex', 'skills'] },
  gemini: { label: 'Gemini CLI', directory: ['.gemini', 'skills'] },
  antigravity: { label: 'Antigravity', directory: ['.gemini', 'antigravity', 'skills'] },
};

export function cliToolsPaths(runtimeDirectory: string, resourcesDirectory?: string) {
  if (resourcesDirectory) {
    return {
      cliPath: path.join(resourcesDirectory, 'cli', 'index.js'),
      skillDirectory: path.join(resourcesDirectory, 'skills', skillName),
    };
  }
  const root = path.resolve(runtimeDirectory, '../../../..');
  return {
    cliPath: path.join(root, 'packages', 'cli', 'dist', 'index.js'),
    skillDirectory: path.join(root, 'skills', skillName),
  };
}

interface CliToolsOptions {
  cliPath: string;
  skillDirectory: string;
  home: string;
  platform: NodeJS.Platform;
  pickDirectory(): Promise<string | undefined>;
}

function isPreset(target: unknown): target is SkillPreset {
  return typeof target === 'string' && Object.hasOwn(presets, target);
}

function quoteCliPath(file: string, platform: NodeJS.Platform) {
  // Quote the path literally in PowerShell on Windows and POSIX shells elsewhere.
  return platform === 'win32' ? `'${file.replaceAll("'", "''")}'` : `'${file.replaceAll("'", "'\\''")}'`;
}

async function assertUnoccupied(destination: string) {
  const existing = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing) throw new Error(`目标已存在，请保留或移走原有 Skill 后重试：${destination}`);
}

async function isFile(file: string) {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return false;
  }
}

export function createCliTools(options: CliToolsOptions) {
  function presetDirectory(id: SkillPreset) {
    return path.join(options.home, ...presets[id].directory);
  }

  return {
    async getInfo(): Promise<DesktopCliToolsInfo> {
      return {
        cli: await isFile(options.cliPath)
          ? { path: options.cliPath, command: `node ${quoteCliPath(options.cliPath, options.platform)}` }
          : null,
        targets: Object.keys(presets).filter(isPreset).map(id => ({
          id, label: presets[id].label, path: path.join(presetDirectory(id), skillName),
        })),
      };
    },
    async installSkill(target: unknown): Promise<SkillInstallResult> {
      if (target !== 'custom' && !isPreset(target)) throw new Error('无效的 Skill 安装目标。');
      const parent = target === 'custom' ? await options.pickDirectory() : presetDirectory(target);
      if (parent === undefined) return { status: 'canceled' };
      if (!path.isAbsolute(parent)) throw new Error('请选择有效的 Skill 安装目录。');
      if (!await isFile(path.join(options.skillDirectory, 'SKILL.md'))) {
        throw new Error('找不到随应用提供的 SKILL.md。');
      }
      if (target !== 'custom') await mkdir(parent, { recursive: true });
      const directory = await realpath(parent);
      if (!(await stat(directory)).isDirectory()) throw new Error('请选择有效的 Skill 安装目录。');
      const destination = path.join(directory, skillName);
      await assertUnoccupied(destination);

      // Stage on the same volume so a failed copy never leaves a partial Skill installed.
      const staging = await mkdtemp(path.join(directory, '.quarry-skill-'));
      try {
        const stagedSkill = path.join(staging, skillName);
        await cp(options.skillDirectory, stagedSkill, { recursive: true });
        await assertUnoccupied(destination);
        await rename(stagedSkill, destination);
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
      return { status: 'installed', path: path.join(destination, 'SKILL.md') };
    },
  };
}

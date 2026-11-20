#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Command, Option } from 'commander';
import { convertDocument, summarize } from './document.js';
import { spec } from './spec.js';

async function readDocument(file: string) {
  const extension = extname(file).toLowerCase();
  if (extension !== '.json' && extension !== '.md') throw new Error('输入文件扩展名须为 .md 或 .json');
  try {
    return convertDocument(await readFile(file, 'utf8'), extension);
  } catch (error) {
    throw new Error(`${file} · ${error instanceof Error ? error.message : String(error)}`);
  }
}

const program = new Command().name('quarry').description('校验和转换题匣题目');
program.command('validate').argument('<file>').description('校验题目文件').action(async (file: string) => {
  console.log(summarize(await readDocument(file)));
});
program.command('convert').argument('<file>').description('转换为题匣导入文件')
  .requiredOption('-o, --output <file>', '输出文件')
  .addOption(new Option('--format <format>', '输出格式').choices(['json', 'md']).default('json'))
  .action(async (file: string, options: { output: string; format: 'json' | 'md' }) => {
    const json = JSON.stringify(await readDocument(file), null, 2);
    const content = options.format === 'md' ? `# Quarry\n\n\`\`\`json\n${json}\n\`\`\`\n` : json + '\n';
    await writeFile(options.output, content, 'utf8');
  });
program.command('spec').description('打印 Markdown DSL 规范').action(() => console.log(spec));

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

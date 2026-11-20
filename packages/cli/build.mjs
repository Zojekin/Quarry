import { chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

export function bundle(outfile) {
  buildSync({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    mainFields: ['module', 'main'],
    format: 'esm',
    target: 'node22',
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    outfile,
  });
  chmodSync(outfile, 0o755);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) bundle('dist/index.js');

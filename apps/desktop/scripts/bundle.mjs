import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Workspace manifests point at TS source. Bundle it so Electron never loads TS.
await build({
  absWorkingDir: root,
  entryPoints: ['src/main.ts'], outfile: 'dist/runtime/main.js',
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  external: ['electron', 'better-sqlite3'],
  banner: { js: "import { createRequire as quarryCreateRequire } from 'node:module'; const require = quarryCreateRequire(import.meta.url);" },
});
await build({
  absWorkingDir: root,
  entryPoints: ['src/preload.ts'], outfile: 'dist/runtime/preload.cjs',
  bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'],
});

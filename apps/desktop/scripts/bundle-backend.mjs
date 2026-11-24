import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

export async function loadBackend() {
  const output = new URL('../dist/web-backend.cjs', import.meta.url);
  await build({
    absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
    entryPoints: ['src/backend-manager.ts'],
    outfile: fileURLToPath(output),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['better-sqlite3'],
  });
  return (await import(output.href)).default;
}

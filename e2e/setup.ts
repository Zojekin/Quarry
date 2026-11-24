import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function setup() {
  if (process.env.QUARRY_E2E_PACKAGED === '1') return;
  const web = resolve('apps/web');
  execFileSync(process.execPath, [resolve(web, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: web, stdio: 'inherit',
  });
  execFileSync(process.execPath, [resolve('apps/desktop/scripts/bundle.mjs')], { stdio: 'inherit' });
}

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [
  require.resolve('@playwright/test/cli'), 'test', '--project=electron', ...process.argv.slice(2),
], { env: { ...process.env, QUARRY_E2E_PACKAGED: '1' }, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

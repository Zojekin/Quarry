import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import { startVite } from '../../web/scripts/dev-server.mjs';
import { runDevelopment } from '../../../scripts/dev-lifecycle.mjs';

await runDevelopment(async (signal, onStop, stopped) => {
  const vite = await startVite();
  onStop(vite.stop);
  if (signal.aborted) return;
  await import('./bundle.mjs');
  if (signal.aborted) return;

  const env = { ...process.env, VITE_DEV_SERVER_URL: vite.url };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, ['.'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  onStop(async () => {
    if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
    if (child.connected) child.send('quarry-dev-quit', () => {});
    if (await Promise.race([exited.then(() => false), delay(7_000, true, { ref: false })])) {
      child.kill();
      await exited;
    }
  });
  const code = await Promise.race([exited, stopped]);
  if (!signal.aborted) process.exitCode = typeof code === 'number' ? code : 1;
});

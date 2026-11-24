import { fileURLToPath } from 'node:url';
import { loadBackend } from '../apps/desktop/scripts/bundle-backend.mjs';
import { startVite } from '../apps/web/scripts/dev-server.mjs';
import { runDevelopment } from './dev-lifecycle.mjs';

await runDevelopment(async (signal, onStop, stopped) => {
  const { startLocalBackend } = await loadBackend();
  const userDataDir = fileURLToPath(new URL('../.quarry-dev-data/', import.meta.url));
  let backend;
  for (let port = 48123; port <= 65535 && !signal.aborted; port++) {
    try {
      backend = await startLocalBackend({ userDataDir, port });
      break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || port === 65535) throw error;
    }
  }
  if (!backend) return;
  onStop(backend.stop);
  console.log('Quarry API', backend.url);
  process.env.VITE_API_URL = backend.url;
  if (signal.aborted) return;
  const vite = await startVite();
  onStop(vite.stop);
  await stopped;
});

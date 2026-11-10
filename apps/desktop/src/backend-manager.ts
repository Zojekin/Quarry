import { mkdir } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { serve } from '@hono/node-server';
import { createSqliteDatabase } from '@quarry/database';
import { createQuarryServer } from '@quarry/server';

const HOST = '127.0.0.1';

export interface LocalBackend {
  port: number;
  url: string;
  stop(): Promise<void>;
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => {
      server.removeListener('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Missing backend address'));
      resolve(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    // Drain active requests, but bound shutdown if a renderer leaves a stream open.
    const timeout = setTimeout(() => server.closeAllConnections(), 5_000);
    timeout.unref();
    server.close(error => {
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    });
    server.closeIdleConnections();
  });
}

/** For callers needing a suggested port. Startup itself binds port 0 atomically. */
export async function allocateAvailablePort(): Promise<number> {
  const server = createServer();
  const port = await listen(server, 0);
  await close(server);
  return port;
}

async function waitForHealth(url: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(500),
        headers: { Connection: 'close' } });
      const result = await response.json() as { success?: boolean };
      if (response.ok && result.success) return;
    } catch { /* Listener or connection probe may still be starting. */ }
    await delay(50);
  }
  throw new Error('Local backend health check timed out');
}

export async function startLocalBackend(options: {
  userDataDir: string;
  port?: number;
}): Promise<LocalBackend> {
  const attachmentsDir = path.join(options.userDataDir, 'attachments');
  await mkdir(attachmentsDir, { recursive: true });
  // The factory also runs initializeDatabase, including versioned migrations.
  const database = await createSqliteDatabase(path.join(options.userDataDir, 'quarry.sqlite'));
  let server: Server | undefined;
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= (async () => {
    try { if (server) await close(server); }
    finally { await database.destroy(); }
  })();
  try {
    const app = createQuarryServer({ db: database.db, attachmentsDir,
      recoveryPointsDir: path.join(options.userDataDir, 'recovery-points') });
    // Only this desktop composition permits the opaque origin of loadFile pages.
    server = serve({ hostname: HOST, port: options.port ?? 0, fetch: async request => {
      const response = await app.fetch(request);
      if (request.headers.get('origin') === 'null') {
        response.headers.set('Access-Control-Allow-Origin', 'null');
      }
      return response;
    } }) as Server;
    const port = await new Promise<number>((resolve, reject) => {
      const ready = () => {
        server!.removeListener('error', reject);
        const address = server!.address();
        if (!address || typeof address === 'string') return reject(new Error('Missing backend address'));
        resolve(address.port);
      };
      server!.once('error', reject);
      if (server!.listening) ready();
      else server!.once('listening', ready);
    });
    const url = `http://${HOST}:${port}`;
    await waitForHealth(url);
    return { port, url, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

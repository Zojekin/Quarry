import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { BackendClient } from '../../web/src/api/client.js';
import { allocateAvailablePort, startLocalBackend, type LocalBackend } from '../src/backend-manager.js';

const backends: LocalBackend[] = [];
const directories: string[] = [];
async function userData() {
  const directory = await mkdtemp(path.join(tmpdir(), 'quarry-desktop-'));
  directories.push(directory);
  return directory;
}
async function start(userDataDir: string, port?: number) {
  const backend = await startLocalBackend({ userDataDir, ...(port === undefined ? {} : { port }) });
  backends.push(backend);
  return backend;
}
afterEach(async () => {
  await Promise.all(backends.splice(0).map(backend => backend.stop()));
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('local backend lifecycle', () => {
  it('serves health and BackendClient CRUD, persists and releases sockets/database files', async () => {
    const directory = await userData();
    const backend = await start(directory);
    expect(backend.port).toBeGreaterThan(0);
    expect(backend.url).toBe(`http://127.0.0.1:${backend.port}`);
    const health = await fetch(`${backend.url}/api/health`);
    expect(await health.json()).toMatchObject({ success: true, data: { status: 'ok' } });
    const client = new BackendClient(backend.url);
    const bank = await client.banks.create({ name: 'Desktop bank' });
    expect((await client.banks.get(bank.id)).name).toBe('Desktop bank');
    expect((await client.banks.update(bank.id, { name: 'Updated' })).name).toBe('Updated');
    const deleted = await client.banks.create({ name: 'Delete me' });
    await client.banks.delete(deleted.id);
    expect((await client.banks.list()).map(item => item.id)).toEqual([bank.id]);
    await Promise.all([backend.stop(), backend.stop()]);
    await expect(fetch(`${backend.url}/api/health`)).rejects.toThrow();
    // A new listener binds the exact old port; SQLite can reopen persisted data.
    const reopened = await start(directory, backend.port);
    expect((await new BackendClient(reopened.url).banks.get(bank.id)).name).toBe('Updated');
    await reopened.stop();
    expect(await readdir(directory)).toContain('attachments');
    expect(await readdir(directory)).not.toContain('quarry.sqlite-wal');
    // On Windows removal also verifies no SQLite file handles survive shutdown.
    await rm(directory, { recursive: true });
  });

  it('uses independent random ports and exposes only desktop/local CORS origins', async () => {
    const [first, second] = await Promise.all([userData().then(directory => start(directory)), userData().then(directory => start(directory))]);
    expect(first.port).not.toBe(second.port);
    const response = await fetch(`${first.url}/api/banks`, { method: 'OPTIONS', headers: {
      Origin: 'null', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type',
    } });
    expect(response.headers.get('access-control-allow-origin')).toBe('null');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    const remote = await fetch(`${first.url}/api/health`, { headers: { Origin: 'https://example.com' } });
    expect(remote.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('cleans the database after listener failure and allocates an available loopback port', async () => {
    const port = await allocateAvailablePort();
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject);
      blocker.listen(port, '127.0.0.1', resolve);
    });
    const directory = await userData();
    try {
      await expect(startLocalBackend({ userDataDir: directory, port })).rejects.toMatchObject({ code: 'EADDRINUSE' });
    } finally {
      await new Promise<void>((resolve, reject) => blocker.close(error => error ? reject(error) : resolve()));
    }
    const backend = await start(directory, port);
    await backend.stop();
    await rm(directory, { recursive: true });
  });
});

import { afterEach, expect, it, vi } from 'vitest';

const expose = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld: expose } }));
const originalArguments = [...process.argv];
afterEach(() => {
  process.argv = [...originalArguments];
  expose.mockClear();
  vi.resetModules();
});

it('exposes only the backend URL as a string', async () => {
  process.argv = ['electron', '--quarry-api-url=http://127.0.0.1:54321'];
  await import('../src/preload.js');
  expect(expose.mock.calls).toEqual([['__QUARRY_API_URL__', 'http://127.0.0.1:54321']]);
});

it.each([undefined, 'https://example.com', 'file:///C:/secret', 'http://127.0.0.1:42/path'])(
  'rejects an absent or non-loopback URL: %s', async url => {
    process.argv = url === undefined ? ['electron'] : ['electron', `--quarry-api-url=${url}`];
    await expect(import('../src/preload.js')).rejects.toThrow('Missing or invalid');
    expect(expose).not.toHaveBeenCalled();
  },
);

import { afterEach, expect, it, vi } from 'vitest';

const expose = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld: expose }, ipcRenderer: { send } }));
const originalArguments = [...process.argv];
afterEach(() => {
  process.argv = [...originalArguments];
  expose.mockClear();
  send.mockClear();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('exposes the backend URL and only the narrow titlebar bridge method', async () => {
  process.argv = ['electron', '--quarry-api-url=http://127.0.0.1:54321'];
  await import('../src/preload.js');
  expect(expose.mock.calls).toEqual([
    ['__QUARRY_API_URL__', 'http://127.0.0.1:54321'],
    ['__QUARRY_DESKTOP__', { setTitleBarOverlay: expect.any(Function) }],
  ]);
});

it('preserves existing desktop properties and sends only validated #RRGGBB colors', async () => {
  process.argv = ['electron', '--quarry-api-url=http://127.0.0.1:54321'];
  vi.stubGlobal('__QUARRY_DESKTOP__', { existing: 'preserved' });
  await import('../src/preload.js');
  const bridge = expose.mock.calls[1]![1];
  expect(bridge.existing).toBe('preserved');
  for (const colors of [null, {}, { color: '#abc', symbolColor: '#000000' },
    { color: '#000000', symbolColor: '#ffffff00' }, { color: '#000000\n', symbolColor: '#ffffff' },
    { color: '#000000', symbolColor: 123456 }]) {
    bridge.setTitleBarOverlay(colors);
  }
  expect(send).not.toHaveBeenCalled();
  bridge.setTitleBarOverlay({ color: '#001234', symbolColor: '#AABBCC', height: 99 });
  expect(send.mock.calls).toEqual([
    ['quarry:set-title-bar-overlay', { color: '#001234', symbolColor: '#AABBCC' }],
  ]);
});

it.each([undefined, 'https://example.com', 'file:///C:/secret', 'http://127.0.0.1:42/path'])(
  'rejects an absent or non-loopback URL: %s', async url => {
    process.argv = url === undefined ? ['electron'] : ['electron', `--quarry-api-url=${url}`];
    await expect(import('../src/preload.js')).rejects.toThrow('Missing or invalid');
    expect(expose).not.toHaveBeenCalled();
  },
);

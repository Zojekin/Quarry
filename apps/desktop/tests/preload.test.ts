import { afterEach, expect, it, vi } from 'vitest';
import { updaterChannels } from '../src/updater-channels.js';
import { zoomChannels } from '../src/zoom-channels.js';

const { expose, ipcRenderer } = vi.hoisted(() => ({
  expose: vi.fn(),
  ipcRenderer: { send: vi.fn(), invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
}));
vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld: expose }, ipcRenderer }));
const originalArguments = [...process.argv];
afterEach(() => {
  process.argv = [...originalArguments];
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('exposes the backend URL and one desktop bridge for the titlebar, updater and zoom', async () => {
  process.argv = ['electron', '--quarry-api-url=http://127.0.0.1:54321'];
  await import('../src/preload.js');
  expect(expose.mock.calls).toEqual([
    ['__QUARRY_API_URL__', 'http://127.0.0.1:54321'],
    ['__QUARRY_DESKTOP__', {
      setTitleBarOverlay: expect.any(Function),
      zoom: {
        getLevel: expect.any(Function), setLevel: expect.any(Function), onLevelChange: expect.any(Function),
      },
      updater: {
        getState: expect.any(Function), checkForUpdates: expect.any(Function),
        downloadUpdate: expect.any(Function), quitAndInstall: expect.any(Function),
        setAutoUpdate: expect.any(Function), onStateChange: expect.any(Function),
      },
    }],
  ]);
});

it('invokes zoom channels and forwards only the zoom level to subscribers', async () => {
  process.argv = ['electron', '--quarry-api-url=http://127.0.0.1:54321'];
  await import('../src/preload.js');
  const { zoom } = expose.mock.calls[1]![1];
  ipcRenderer.invoke.mockResolvedValueOnce(100);
  await expect(zoom.getLevel()).resolves.toBe(100);
  await zoom.setLevel(125);
  expect(ipcRenderer.invoke.mock.calls).toEqual([[zoomChannels.getLevel], [zoomChannels.setLevel, 125]]);
  const callback = vi.fn();
  const unsubscribe = zoom.onLevelChange(callback);
  const [channel, listener] = ipcRenderer.on.mock.calls[0]!;
  expect(channel).toBe(zoomChannels.levelChange);
  listener({ sender: 'private' }, 125);
  expect(callback).toHaveBeenCalledExactlyOnceWith(125);
  unsubscribe();
  expect(ipcRenderer.removeListener).toHaveBeenCalledExactlyOnceWith(channel, listener);
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
  expect(ipcRenderer.send).not.toHaveBeenCalled();
  bridge.setTitleBarOverlay({ color: '#001234', symbolColor: '#AABBCC', height: 99 });
  expect(ipcRenderer.send.mock.calls).toEqual([
    ['quarry:set-title-bar-overlay', { color: '#001234', symbolColor: '#AABBCC' }],
  ]);
});

it('invokes named updater channels and forwards only the state to subscribers', async () => {
  process.argv = ['electron', '--quarry-api-url=http://127.0.0.1:54321'];
  await import('../src/preload.js');
  const { updater } = expose.mock.calls[1]![1];
  updater.getState();
  updater.checkForUpdates();
  updater.downloadUpdate();
  updater.quitAndInstall();
  updater.setAutoUpdate(false);
  expect(ipcRenderer.invoke.mock.calls).toEqual([
    [updaterChannels.getState], [updaterChannels.checkForUpdates],
    [updaterChannels.downloadUpdate], [updaterChannels.quitAndInstall],
    [updaterChannels.setAutoUpdate, false],
  ]);
  const callback = vi.fn();
  const unsubscribe = updater.onStateChange(callback);
  const [channel, listener] = ipcRenderer.on.mock.calls[0]!;
  const state = { currentVersion: '1.0.0', status: 'idle', autoUpdate: false, supported: true };
  expect(channel).toBe(updaterChannels.stateChange);
  listener({ sender: 'private' }, state);
  expect(callback).toHaveBeenCalledExactlyOnceWith(state);
  unsubscribe();
  expect(ipcRenderer.removeListener).toHaveBeenCalledExactlyOnceWith(channel, listener);
});

it.each([undefined, 'https://example.com', 'file:///C:/secret', 'http://127.0.0.1:42/path'])(
  'rejects an absent or non-loopback URL: %s', async url => {
    process.argv = url === undefined ? ['electron'] : ['electron', `--quarry-api-url=${url}`];
    await expect(import('../src/preload.js')).rejects.toThrow('Missing or invalid');
    expect(expose).not.toHaveBeenCalled();
  },
);

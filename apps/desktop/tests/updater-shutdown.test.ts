import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { updaterChannels } from '../src/updater-channels.js';

const mocks = vi.hoisted(() => ({
  app: {
    on: vi.fn(), isPackaged: true, whenReady: vi.fn(), getVersion: vi.fn(), getPath: vi.fn(),
    quit: vi.fn(), exit: vi.fn(),
  },
  browserWindow: vi.fn(), fromWebContents: vi.fn(), handle: vi.fn(),
  download: vi.fn(), onUpdaterEvent: vi.fn(), check: vi.fn(), install: vi.fn(), stop: vi.fn(),
}));

vi.mock('electron', () => ({
  app: mocks.app,
  BrowserWindow: Object.assign(mocks.browserWindow, {
    getAllWindows: () => [],
    fromWebContents: mocks.fromWebContents,
  }),
  dialog: { showErrorBox: vi.fn() },
  ipcMain: { handle: mocks.handle },
  Menu: { setApplicationMenu: vi.fn() },
  shell: {},
}));
vi.mock('electron-updater', () => ({
  NsisUpdater: function () {
    return { on: mocks.onUpdaterEvent, checkForUpdates: mocks.check, downloadUpdate: mocks.download, quitAndInstall: mocks.install };
  },
}));
vi.mock('../src/backend-manager.js', () => ({
  startLocalBackend: async () => ({ url: 'http://127.0.0.1:1234', stop: mocks.stop }),
}));

const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const resourcesPath = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
const messageListeners = process.listeners('message');
let directory: string;
let finishStop: () => void;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  directory = mkdtempSync(path.join(tmpdir(), 'quarry-shutdown-'));
  writeFileSync(path.join(directory, 'app-update.yml'), 'provider: github');
  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
  Object.defineProperty(process, 'resourcesPath', { configurable: true, value: directory });
  mocks.app.getPath.mockReturnValue(directory);
  mocks.app.getVersion.mockReturnValue('1.0.0');
  mocks.app.whenReady.mockResolvedValue(undefined);
  mocks.fromWebContents.mockReturnValue({});
  mocks.browserWindow.mockImplementation(function () {
    return {
      loadFile: async () => undefined,
      once: vi.fn(),
      webContents: { ipc: { on: vi.fn() }, setWindowOpenHandler: vi.fn(), on: vi.fn() },
    };
  });
  mocks.stop.mockImplementation(() => new Promise<void>((resolve) => { finishStop = resolve; }));
});

afterEach(() => {
  Object.defineProperty(process, 'platform', platform);
  if (resourcesPath) Object.defineProperty(process, 'resourcesPath', resourcesPath);
  else Reflect.deleteProperty(process, 'resourcesPath');
  for (const listener of process.listeners('message')) {
    if (!messageListeners.includes(listener)) process.removeListener('message', listener);
  }
  rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function load() {
  await import('../src/main.js');
  await vi.waitFor(() => expect(mocks.browserWindow).toHaveBeenCalledOnce());
  const beforeQuit = mocks.app.on.mock.calls.find(([name]) => name === 'before-quit')![1];
  const getHandler = (channel: string) => mocks.handle.mock.calls.find(([name]) => name === channel)![1];
  const frame = {};
  const mainWindow = { senderFrame: frame, sender: { mainFrame: frame } };
  return { beforeQuit, getHandler, mainWindow };
}

it('waits for the backend before starting NSIS and permits the updater’s following quit', async () => {
  const { beforeQuit, getHandler, mainWindow } = await load();
  const quitAndInstall = getHandler(updaterChannels.quitAndInstall);
  await quitAndInstall(mainWindow);
  expect(mocks.stop).not.toHaveBeenCalled();

  const onDownloaded = mocks.onUpdaterEvent.mock.calls.find(([name]) => name === 'update-downloaded')![1];
  onDownloaded({ version: '1.1.0' });
  expect(() => quitAndInstall({ ...mainWindow, senderFrame: {} })).toThrow('Untrusted');
  const restart = quitAndInstall(mainWindow);
  await vi.waitFor(() => expect(mocks.stop).toHaveBeenCalledOnce());
  const earlyQuit = { preventDefault: vi.fn() };
  beforeQuit(earlyQuit);
  expect(earlyQuit.preventDefault).toHaveBeenCalledOnce();
  expect(mocks.install).not.toHaveBeenCalled();
  expect(mocks.app.quit).not.toHaveBeenCalled();

  const updaterQuit = { preventDefault: vi.fn() };
  mocks.install.mockImplementation(() => beforeQuit(updaterQuit));
  finishStop();
  await restart;
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.install).toHaveBeenCalledExactlyOnceWith(true, true);
  expect(updaterQuit.preventDefault).not.toHaveBeenCalled();
  expect(mocks.app.quit).not.toHaveBeenCalled();
});

it('delays normal exit until cleanup so the updater can install on the quit event', async () => {
  const { beforeQuit } = await load();
  const initialQuit = { preventDefault: vi.fn() };
  beforeQuit(initialQuit);
  await vi.waitFor(() => expect(mocks.stop).toHaveBeenCalledOnce());
  expect(initialQuit.preventDefault).toHaveBeenCalledOnce();
  expect(mocks.app.quit).not.toHaveBeenCalled();

  const finalQuit = { preventDefault: vi.fn() };
  mocks.app.quit.mockImplementation(() => beforeQuit(finalQuit));
  finishStop();
  await vi.waitFor(() => expect(mocks.app.quit).toHaveBeenCalledOnce());
  expect(finalQuit.preventDefault).not.toHaveBeenCalled();
  expect(mocks.install).not.toHaveBeenCalled();
});

it('exits with an error and skips installation if the backend cannot close', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.stop.mockRejectedValueOnce(new Error('database close failed'));
  const { getHandler, mainWindow } = await load();
  const onDownloaded = mocks.onUpdaterEvent.mock.calls.find(([name]) => name === 'update-downloaded')![1];
  onDownloaded({ version: '1.1.0' });
  await getHandler(updaterChannels.quitAndInstall)(mainWindow);
  expect(mocks.app.exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(mocks.install).not.toHaveBeenCalled();
});

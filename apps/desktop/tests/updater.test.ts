import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createUpdater } from '../src/updater.js';

const updateInfo = { version: '1.1.0', files: [], path: '', sha512: '' };
let userData: string;

beforeEach(() => {
  vi.useFakeTimers();
  userData = mkdtempSync(path.join(tmpdir(), 'quarry-updater-'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  rmSync(userData, { recursive: true, force: true });
});

function setup(supported = true) {
  const engine = Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    disableDifferentialDownload: false,
    disableWebInstaller: false,
    checkForUpdates: vi.fn(async () => {
      engine.emit('update-available', updateInfo);
      return { updateInfo, isUpdateAvailable: true, downloadPromise: engine.autoDownload ? engine.downloadUpdate() : null };
    }),
    downloadUpdate: vi.fn(async () => ['installer.exe']),
    quitAndInstall: vi.fn(),
  });
  const onStateChange = vi.fn();
  const shutdown = vi.fn(async (install: () => void) => install());
  const service = createUpdater({
    engine: supported ? engine : undefined, currentVersion: '1.0.0', userData, onStateChange, shutdown,
  });
  return { engine, onStateChange, service, shutdown };
}

it('checks once shortly after startup and publishes download progress and readiness', async () => {
  const { engine, onStateChange, service, shutdown } = setup();
  expect(service.getState()).toEqual({ currentVersion: '1.0.0', autoUpdate: true, supported: true, status: 'idle' });
  expect(engine.autoDownload).toBe(true);
  expect(engine.autoInstallOnAppQuit).toBe(true);
  await service.quitAndInstall();
  expect(shutdown).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(4_999);
  expect(engine.checkForUpdates).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(engine.checkForUpdates).toHaveBeenCalledTimes(1);
  expect(engine.downloadUpdate).toHaveBeenCalledTimes(1);
  engine.emit('download-progress', { percent: 63.7 });
  engine.emit('update-downloaded', updateInfo);
  expect(onStateChange.mock.calls.map(([state]) => [state.status, state.percent])).toEqual([
    ['checking', undefined], ['downloading', 0], ['downloading', 64], ['downloaded', undefined],
  ]);
  expect(service.getState()).toMatchObject({ status: 'downloaded', version: '1.1.0' });
  await service.checkForUpdates();
  expect(engine.checkForUpdates).toHaveBeenCalledTimes(1);
  await service.quitAndInstall();
  expect(shutdown).toHaveBeenCalledTimes(1);
  expect(engine.quitAndInstall).toHaveBeenCalledExactlyOnceWith(true, true);
});

it('persists the switch and allows a manual check and download when automatic updating is off', async () => {
  const first = setup();
  first.service.setAutoUpdate(false);
  expect(JSON.parse(readFileSync(path.join(userData, 'updater-settings.json'), 'utf8'))).toEqual({ autoUpdate: false });
  const { engine, service } = setup();
  expect(engine.autoDownload).toBe(false);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(first.engine.checkForUpdates).not.toHaveBeenCalled();
  expect(engine.checkForUpdates).not.toHaveBeenCalled();
  await service.checkForUpdates();
  expect(service.getState()).toMatchObject({ autoUpdate: false, status: 'available', version: '1.1.0' });
  expect(engine.downloadUpdate).not.toHaveBeenCalled();
  await service.downloadUpdate();
  expect(engine.downloadUpdate).toHaveBeenCalledTimes(1);
  expect(service.getState()).toMatchObject({ status: 'downloading', percent: 0 });
  service.setAutoUpdate(true);
  expect(engine.autoDownload).toBe(true);
  expect(setup().service.getState().autoUpdate).toBe(true);
});

it('publishes up-to-date and permits retry after a background download error', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const { engine, service } = setup();
  engine.downloadUpdate.mockRejectedValueOnce(new Error('connection reset'));
  await service.checkForUpdates();
  expect(service.getState().status).toBe('error');
  engine.checkForUpdates.mockImplementationOnce(async () => {
    engine.emit('update-not-available', updateInfo);
    return { isUpdateAvailable: false, updateInfo, downloadPromise: null };
  });
  await service.checkForUpdates();
  expect(service.getState().status).toBe('up-to-date');
});

it('has no network actions in a build without a configured updater', async () => {
  const { engine, service, shutdown } = setup(false);
  await vi.advanceTimersByTimeAsync(5_000);
  await service.checkForUpdates();
  await service.downloadUpdate();
  await service.quitAndInstall();
  expect(service.getState()).toMatchObject({ supported: false, status: 'idle' });
  expect(engine.checkForUpdates).not.toHaveBeenCalled();
  expect(engine.downloadUpdate).not.toHaveBeenCalled();
  expect(shutdown).not.toHaveBeenCalled();
});

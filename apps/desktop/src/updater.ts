import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AppUpdater, BaseUpdater } from 'electron-updater';
import type { DesktopUpdateState } from '@quarry/shared';

type UpdateEngine = Pick<AppUpdater,
  'autoDownload' | 'autoInstallOnAppQuit' | 'disableDifferentialDownload' | 'disableWebInstaller' |
  'on' | 'checkForUpdates' | 'downloadUpdate'> & Pick<BaseUpdater, 'quitAndInstall'>;

function readAutoUpdate(file: string): boolean {
  try {
    const settings = JSON.parse(readFileSync(file, 'utf8'));
    return typeof settings?.autoUpdate === 'boolean' ? settings.autoUpdate : true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Could not read updater settings', error);
    }
    return true;
  }
}

export function createUpdater({
  engine, currentVersion, userData, onStateChange, shutdown,
}: {
  engine: UpdateEngine | undefined;
  currentVersion: string;
  userData: string;
  onStateChange(state: DesktopUpdateState): void;
  shutdown(install: () => void): Promise<void>;
}) {
  const settingsFile = path.join(userData, 'updater-settings.json');
  let state: DesktopUpdateState = {
    currentVersion,
    autoUpdate: readAutoUpdate(settingsFile),
    supported: !!engine,
    status: 'idle',
  };

  function publish(next: DesktopUpdateState) {
    state = next;
    onStateChange(state);
  }

  function fail(error: unknown) {
    if (state.status === 'error') return;
    console.error('Desktop update failed', error);
    publish({ currentVersion, autoUpdate: state.autoUpdate, supported: true, status: 'error' });
  }

  if (engine) {
    engine.autoDownload = state.autoUpdate;
    engine.autoInstallOnAppQuit = true;
    // Releases ship a complete NSIS installer and its checksum, with no differential blockmap.
    engine.disableDifferentialDownload = true;
    engine.disableWebInstaller = true;
    engine.on('update-available', ({ version }) => {
      publish(state.autoUpdate
        ? { ...state, status: 'downloading', version, percent: 0 }
        : { ...state, status: 'available', version });
    });
    engine.on('update-not-available', () => publish({ ...state, status: 'up-to-date' }));
    engine.on('download-progress', ({ percent }) => {
      if (state.status !== 'downloading' || !Number.isFinite(percent)) return;
      const rounded = Math.round(Math.max(0, Math.min(100, percent)));
      if (rounded !== state.percent) publish({ ...state, percent: rounded });
    });
    engine.on('update-downloaded', ({ version }) => {
      publish({ currentVersion, autoUpdate: state.autoUpdate, supported: true, status: 'downloaded', version });
    });
    engine.on('error', fail);

    setTimeout(() => {
      if (state.autoUpdate && state.status === 'idle') void checkForUpdates();
    }, 5_000).unref();
  }

  async function checkForUpdates() {
    if (!engine || state.status === 'checking' || state.status === 'downloading' || state.status === 'downloaded') return;
    publish({ currentVersion, autoUpdate: state.autoUpdate, supported: true, status: 'checking' });
    try {
      const result = await engine.checkForUpdates();
      void result?.downloadPromise?.catch(fail);
      if (!result) publish({ ...state, status: 'idle' });
    } catch (error) {
      fail(error);
    }
  }

  async function downloadUpdate() {
    if (!engine || state.status !== 'available') return;
    publish({ ...state, status: 'downloading', percent: 0 });
    try {
      await engine.downloadUpdate();
    } catch (error) {
      fail(error);
    }
  }

  return {
    getState: () => state,
    checkForUpdates,
    downloadUpdate,
    async quitAndInstall() {
      if (!engine || state.status !== 'downloaded') return;
      // NSIS starts its installer before Electron emits before-quit.
      await shutdown(() => engine.quitAndInstall(true, true));
    },
    setAutoUpdate(enabled: boolean) {
      if (typeof enabled !== 'boolean') throw new TypeError('Expected an automatic update preference');
      if (state.autoUpdate === enabled) return;
      const temporaryFile = `${settingsFile}.${process.pid}.tmp`;
      try {
        writeFileSync(temporaryFile, JSON.stringify({ autoUpdate: enabled }), 'utf8');
        renameSync(temporaryFile, settingsFile);
      } catch (error) {
        try { rmSync(temporaryFile, { force: true }); } catch {}
        console.error('Could not save updater settings', error);
        throw new Error('Could not save updater settings');
      }
      if (engine) engine.autoDownload = enabled;
      publish({ ...state, autoUpdate: enabled });
      if (enabled && state.status === 'available') void downloadUpdate();
      if (enabled && state.status === 'idle') void checkForUpdates();
    },
  };
}

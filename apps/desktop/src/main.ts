import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell, type IpcMainInvokeEvent } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NsisUpdater } from 'electron-updater';
import { isDesktopZoomLevel, type DesktopZoomLevel } from '@quarry/shared';
import { startLocalBackend, type LocalBackend } from './backend-manager.js';
import { isTitleBarColors, titleBarOverlayChannel, type TitleBarColors } from './titlebar-overlay.js';
import { createUpdater } from './updater.js';
import { updaterChannels } from './updater-channels.js';
import { loadZoom, saveZoom, zoomShortcut } from './zoom.js';
import { zoomChannels } from './zoom-channels.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const titleBarHeight = 42;
let backend: LocalBackend | undefined;
let startup: Promise<void> | undefined;
let quitting = false;
let canQuit = false;

async function shutdown(finish: () => void): Promise<void> {
  if (quitting) return;
  quitting = true;
  try {
    // A window load failure must not skip cleanup of an already started backend.
    await startup?.catch(() => undefined);
    await backend?.stop();
  } catch (error) {
    console.error('Desktop shutdown failed', error);
    app.exit(1);
    return;
  }
  canQuit = true;
  finish();
}

function registerUpdater(): void {
  const supported = process.platform === 'win32' && app.isPackaged &&
    existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  const updater = createUpdater({
    engine: supported ? new NsisUpdater() : undefined,
    currentVersion: app.getVersion(),
    userData: app.getPath('userData'),
    onStateChange(state) {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(updaterChannels.stateChange, state);
      }
    },
    shutdown,
  });

  function fromMainWindow<T extends unknown[], R>(action: (...args: T) => R) {
    return (event: IpcMainInvokeEvent, ...args: T) => {
      if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame ||
          !BrowserWindow.fromWebContents(event.sender)) {
        throw new Error('Untrusted updater request');
      }
      return action(...args);
    };
  }

  ipcMain.handle(updaterChannels.getState, fromMainWindow(updater.getState));
  ipcMain.handle(updaterChannels.checkForUpdates, fromMainWindow(updater.checkForUpdates));
  ipcMain.handle(updaterChannels.downloadUpdate, fromMainWindow(updater.downloadUpdate));
  ipcMain.handle(updaterChannels.quitAndInstall, fromMainWindow(updater.quitAndInstall));
  ipcMain.handle(updaterChannels.setAutoUpdate, fromMainWindow(updater.setAutoUpdate));
}

async function createWindow(): Promise<void> {
  if (!backend || quitting) return;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const userData = app.getPath('userData');
  let zoomLevel = loadZoom(userData);
  let titleBarColors: TitleBarColors = { color: '#fafaf7', symbolColor: '#2d5c48' };
  // Scale the native caption with the renderer so its CSS height stays close to 42px.
  const overlayOptions = () => ({ ...titleBarColors, height: Math.round(titleBarHeight * zoomLevel / 100) });
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.resolve(directory, '../../resources/icon.png');
  const window = new BrowserWindow({
    width: Math.min(1440, width), height: Math.min(900, height),
    minWidth: Math.min(900, width), minHeight: Math.min(600, height),
    icon: iconPath,
    autoHideMenuBar: true,
    ...(process.platform === 'win32' ? {
      show: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: overlayOptions(),
    } : {}),
    webPreferences: {
      preload: path.join(directory, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      zoomFactor: zoomLevel / 100,
      additionalArguments: [`--quarry-api-url=${backend.url}`],
    },
  });
  const contents = window.webContents;
  function setZoomLevel(level: DesktopZoomLevel) {
    if (level === zoomLevel) return;
    saveZoom(userData, level);
    zoomLevel = level;
    contents.setZoomFactor(level / 100);
    if (process.platform === 'win32') window.setTitleBarOverlay(overlayOptions());
    contents.send(zoomChannels.levelChange, level);
  }
  function requireMainFrame(event: IpcMainInvokeEvent) {
    if (!event.senderFrame || event.senderFrame !== contents.mainFrame) throw new Error('Untrusted zoom request');
  }
  contents.ipc.handle(zoomChannels.getLevel, event => {
    requireMainFrame(event);
    return zoomLevel;
  });
  contents.ipc.handle(zoomChannels.setLevel, (event, level: unknown) => {
    requireMainFrame(event);
    if (!isDesktopZoomLevel(level)) throw new Error('Invalid zoom level');
    setZoomLevel(level);
  });
  contents.on('before-input-event', (event, input) => {
    const next = zoomShortcut(input, zoomLevel);
    if (next === undefined) return;
    event.preventDefault();
    try {
      setZoomLevel(next);
    } catch (error) {
      console.error('Could not save desktop zoom', error);
    }
  });
  if (process.platform === 'win32') {
    contents.ipc.on(titleBarOverlayChannel, (event, colors: unknown) => {
      if (window.isDestroyed() || event.senderFrame !== contents.mainFrame ||
          !isTitleBarColors(colors)) return;
      titleBarColors = { color: colors.color, symbolColor: colors.symbolColor };
      window.setTitleBarOverlay(overlayOptions());
    });
    window.once('ready-to-show', () => window.show());
  }
  window.webContents.setWindowOpenHandler(({ url }) => {
    const target = URL.parse(url);
    if (target && ['http:', 'https:', 'mailto:'].includes(target.protocol)) {
      void shell.openExternal(url).catch(error => console.error('Could not open external URL', error));
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  if (process.env.VITE_DEV_SERVER_URL) await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await window.loadFile(app.isPackaged
    ? path.join(process.resourcesPath, 'web', 'index.html')
    : path.resolve(directory, '../../../web/dist/index.html'));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
process.on('message', message => {
  if (message === 'quarry-dev-quit') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow().catch(fail);
});
app.on('before-quit', event => {
  if (canQuit) return;
  event.preventDefault();
  void shutdown(() => app.quit());
});

function fail(error: unknown): void {
  console.error(error);
  dialog.showErrorBox('题匣启动失败', error instanceof Error ? error.message : String(error));
  app.quit();
}

void app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerUpdater();
  startup = (async () => {
    const userDataDir = process.env.QUARRY_USER_DATA_DIR || app.getPath('userData');
    backend = await startLocalBackend({ userDataDir });
    await createWindow();
  })();
  return startup;
}).catch(fail);

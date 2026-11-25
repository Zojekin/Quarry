import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalBackend, type LocalBackend } from './backend-manager.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
let backend: LocalBackend | undefined;
let startup: Promise<void> | undefined;
let quitting = false;
let canQuit = false;

async function createWindow(): Promise<void> {
  if (!backend || quitting) return;
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.resolve(directory, '../../resources/icon.png');
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    icon: iconPath,
    autoHideMenuBar: true,
    ...(process.platform === 'win32' ? {
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#f3f3ee', symbolColor: '#2d5c48', height: 42 },
    } : {}),
    webPreferences: {
      preload: path.join(directory, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      additionalArguments: [`--quarry-api-url=${backend.url}`],
    },
  });
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
  if (quitting) return;
  quitting = true;
  void (async () => {
    try {
      // A window load failure must not skip cleanup of an already started backend.
      await startup?.catch(() => undefined);
      await backend?.stop();
    }
    catch (error) { console.error('Desktop shutdown failed', error); process.exitCode = 1; }
    finally { canQuit = true; app.quit(); }
  })();
});

function fail(error: unknown): void {
  console.error(error);
  dialog.showErrorBox('题匣启动失败', error instanceof Error ? error.message : String(error));
  app.quit();
}

void app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  startup = (async () => {
    const userDataDir = process.env.QUARRY_USER_DATA_DIR || app.getPath('userData');
    backend = await startLocalBackend({ userDataDir });
    await createWindow();
  })();
  return startup;
}).catch(fail);

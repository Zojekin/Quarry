import { app, BrowserWindow, dialog } from 'electron';
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
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    webPreferences: {
      preload: path.join(directory, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      additionalArguments: [`--quarry-api-url=${backend.url}`],
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  if (process.env.VITE_DEV_SERVER_URL) await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await window.loadFile(app.isPackaged
    ? path.join(process.resourcesPath, 'web', 'index.html')
    : path.resolve(directory, '../../../web/dist/index.html'));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
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
  startup = (async () => {
    backend = await startLocalBackend({ userDataDir: app.getPath('userData') });
    await createWindow();
  })();
  return startup;
}).catch(fail);

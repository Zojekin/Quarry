import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DesktopUpdaterBridge, DesktopUpdateState, DesktopZoomBridge, DesktopZoomLevel } from '@quarry/shared';
import { isTitleBarColors, titleBarOverlayChannel, type TitleBarColors } from './titlebar-overlay.js';
import { updaterChannels } from './updater-channels.js';
import { zoomChannels } from './zoom-channels.js';

const argument = process.argv.find(value => value.startsWith('--quarry-api-url='));
const url = argument?.slice('--quarry-api-url='.length);
if (!url || !/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) {
  throw new Error('Missing or invalid local backend URL');
}
contextBridge.exposeInMainWorld('__QUARRY_API_URL__', url);

const updater: DesktopUpdaterBridge = {
  getState: () => ipcRenderer.invoke(updaterChannels.getState),
  checkForUpdates: () => ipcRenderer.invoke(updaterChannels.checkForUpdates),
  downloadUpdate: () => ipcRenderer.invoke(updaterChannels.downloadUpdate),
  quitAndInstall: () => ipcRenderer.invoke(updaterChannels.quitAndInstall),
  setAutoUpdate: enabled => ipcRenderer.invoke(updaterChannels.setAutoUpdate, enabled),
  onStateChange(callback) {
    const listener = (_event: IpcRendererEvent, state: DesktopUpdateState) => callback(state);
    ipcRenderer.on(updaterChannels.stateChange, listener);
    return () => { ipcRenderer.removeListener(updaterChannels.stateChange, listener); };
  },
};

const zoom: DesktopZoomBridge = {
  getLevel: () => ipcRenderer.invoke(zoomChannels.getLevel),
  setLevel: level => ipcRenderer.invoke(zoomChannels.setLevel, level),
  onLevelChange(callback) {
    const listener = (_event: IpcRendererEvent, level: DesktopZoomLevel) => callback(level);
    ipcRenderer.on(zoomChannels.levelChange, listener);
    return () => { ipcRenderer.removeListener(zoomChannels.levelChange, listener); };
  },
};

// Publish the preload-owned namespace once so contextBridge freezes the complete API.
const desktop = globalThis as typeof globalThis & { __QUARRY_DESKTOP__?: Record<string, unknown> };
contextBridge.exposeInMainWorld('__QUARRY_DESKTOP__', {
  ...desktop.__QUARRY_DESKTOP__,
  updater,
  zoom,
  setTitleBarOverlay(colors: TitleBarColors) {
    if (isTitleBarColors(colors)) {
      const { color, symbolColor } = colors;
      ipcRenderer.send(titleBarOverlayChannel, { color, symbolColor });
    }
  },
});

import { contextBridge, ipcRenderer } from 'electron';
import { isTitleBarColors, titleBarOverlayChannel, type TitleBarColors } from './titlebar-overlay.js';

const argument = process.argv.find(value => value.startsWith('--quarry-api-url='));
const url = argument?.slice('--quarry-api-url='.length);
if (!url || !/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) {
  throw new Error('Missing or invalid local backend URL');
}
contextBridge.exposeInMainWorld('__QUARRY_API_URL__', url);

// Publish the preload-owned namespace once so contextBridge freezes the complete API.
const desktop = globalThis as typeof globalThis & { __QUARRY_DESKTOP__?: Record<string, unknown> };
contextBridge.exposeInMainWorld('__QUARRY_DESKTOP__', {
  ...desktop.__QUARRY_DESKTOP__,
  setTitleBarOverlay(colors: TitleBarColors) {
    if (isTitleBarColors(colors)) {
      const { color, symbolColor } = colors;
      ipcRenderer.send(titleBarOverlayChannel, { color, symbolColor });
    }
  },
});

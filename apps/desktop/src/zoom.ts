import type { Input } from 'electron';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultDesktopZoom, desktopZoomLevels, isDesktopZoomLevel, type DesktopZoomLevel } from '@quarry/shared';

export function zoomShortcut(input: Pick<Input, 'type' | 'control' | 'alt' | 'meta' | 'key' | 'code'>, level: DesktopZoomLevel) {
  if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return;
  if (input.key === '0' || input.code === 'Numpad0') return defaultDesktopZoom;
  const index = desktopZoomLevels.indexOf(level);
  if (input.key === '+' || input.key === '=' || input.code === 'NumpadAdd') {
    return desktopZoomLevels[Math.min(index + 1, desktopZoomLevels.length - 1)];
  }
  if (input.key === '-' || input.code === 'NumpadSubtract') {
    return desktopZoomLevels[Math.max(index - 1, 0)];
  }
}

export function loadZoom(userData: string): DesktopZoomLevel {
  try {
    const value: unknown = JSON.parse(readFileSync(path.join(userData, 'zoom.json'), 'utf8'));
    return isDesktopZoomLevel(value) ? value : defaultDesktopZoom;
  } catch {
    return defaultDesktopZoom;
  }
}

export function saveZoom(userData: string, level: DesktopZoomLevel): void {
  const file = path.join(userData, 'zoom.json');
  const pending = file + `.${process.pid}.tmp`;
  writeFileSync(pending, JSON.stringify(level));
  renameSync(pending, file);
}

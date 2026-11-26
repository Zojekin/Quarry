export const desktopZoomLevels = [75, 85, 90, 100, 110, 125, 150] as const;
export type DesktopZoomLevel = (typeof desktopZoomLevels)[number];
export const defaultDesktopZoom: DesktopZoomLevel = 100;

export function isDesktopZoomLevel(value: unknown): value is DesktopZoomLevel {
  return desktopZoomLevels.some(level => level === value);
}

export interface DesktopZoomBridge {
  getLevel(): Promise<DesktopZoomLevel>;
  setLevel(level: DesktopZoomLevel): Promise<void>;
  onLevelChange(callback: (level: DesktopZoomLevel) => void): () => void;
}

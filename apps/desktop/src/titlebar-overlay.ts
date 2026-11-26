export const titleBarOverlayChannel = 'quarry:set-title-bar-overlay';

export type TitleBarColors = { color: string; symbolColor: string };

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function isTitleBarColors(value: unknown): value is TitleBarColors {
  if (!value || typeof value !== 'object') return false;
  const { color, symbolColor } = value as Partial<TitleBarColors>;
  return isHexColor(color) && isHexColor(symbolColor);
}

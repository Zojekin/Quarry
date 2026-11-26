import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { loadZoom, saveZoom, zoomShortcut } from '../src/zoom.js';

const input = { type: 'keyDown', control: true, alt: false, meta: false, code: '', key: '' } as const;

it.each([
  ['=', 'Equal', 110],
  ['+', 'Equal', 110],
  ['+', 'NumpadAdd', 110],
  ['-', 'Minus', 90],
  ['-', 'NumpadSubtract', 90],
  ['0', 'Digit0', 100],
  ['Insert', 'Numpad0', 100],
])('handles Ctrl+%s (%s)', (key, code, expected) => {
  expect(zoomShortcut({ ...input, key, code }, 100)).toBe(expected);
});

it('limits zoom to the available levels and handles only Ctrl keydown shortcuts', () => {
  expect(zoomShortcut({ ...input, key: '+' }, 150)).toBe(150);
  expect(zoomShortcut({ ...input, key: '-' }, 75)).toBe(75);
  expect(zoomShortcut({ ...input, type: 'keyUp', key: '-' }, 100)).toBeUndefined();
  expect(zoomShortcut({ ...input, control: false, key: '+' }, 100)).toBeUndefined();
  expect(zoomShortcut({ ...input, alt: true, key: '+' }, 100)).toBeUndefined();
  expect(zoomShortcut({ ...input, meta: true, key: '+' }, 100)).toBeUndefined();
  expect(zoomShortcut({ ...input, key: 'k' }, 100)).toBeUndefined();
});

it('replaces the saved zoom and falls back to 100% for missing or invalid data', () => {
  const data = mkdtempSync(join(tmpdir(), 'quarry-zoom-test-'));
  try {
    expect(loadZoom(data)).toBe(100);
    saveZoom(data, 85);
    expect(loadZoom(data)).toBe(85);
    saveZoom(data, 150);
    expect(loadZoom(data)).toBe(150);
    writeFileSync(join(data, 'zoom.json'), '200');
    expect(loadZoom(data)).toBe(100);
    writeFileSync(join(data, 'zoom.json'), 'invalid');
    expect(loadZoom(data)).toBe(100);
  } finally {
    rmSync(data, { recursive: true });
  }
});

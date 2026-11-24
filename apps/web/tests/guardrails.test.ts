import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('keeps renderer source portable across browsers and Electron loadFile', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const rules = [
    ['native browser dialog', /\b(?:prompt|confirm|alert)\s*(?:\?\.)?\s*\(/],
    ['root-relative asset', /["']\/assets\//],
    ['Electron import', /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'](?:node:)?electron(?:\/[^"']*)?["']/],
  ] as const;
  const violations = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:ts|tsx|css)$/.test(entry.name))
    .flatMap(entry => {
      const path = join(entry.parentPath, entry.name);
      const source = readFileSync(path, 'utf8');
      return rules.filter(([, pattern]) => pattern.test(source)).map(([name]) => relative(root, path) + ': ' + name);
    });
  expect(violations).toEqual([]);
});

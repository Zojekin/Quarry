import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import manifest from '../package.json';

it('configures the release feed for the same NSIS installer and latest.yml uploaded by CI', () => {
  const { build } = manifest;
  expect(manifest.dependencies['electron-updater']).toBeTruthy();
  expect(manifest.scripts.dist).toBe('electron-builder --publish never');
  expect(build.publish).toEqual({ provider: 'github', owner: 'Zojekin', repo: 'Quarry' });
  expect(build.win.target).toContainEqual({ target: 'nsis', arch: ['x64'] });
  expect(build.win.verifyUpdateCodeSignature).toBe(false);
  const workflow = readFileSync(new URL('../../../.github/workflows/release-please.yml', import.meta.url), 'utf8');
  const expected = workflow.match(/\$expected = @\(([\s\S]*?)\)/)?.[1];
  const installer = build.nsis.artifactName
    .replace('${version}', '$env:RELEASE_VERSION').replace('${arch}', 'x64').replace('${ext}', 'exe');
  expect(workflow).toContain(`$releaseDir = "apps/desktop/${build.directories.output}"`);
  expect(expected).toContain(`"${installer}"`);
  expect(expected).toContain('"latest.yml"');
  expect(workflow).toContain('Get-FileHash -LiteralPath $assets[0] -Algorithm SHA512');
  expect(workflow).toContain('gh release upload $env:RELEASE_TAG @assets');
});

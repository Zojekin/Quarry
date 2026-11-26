import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup.ts',
  timeout: 60_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'electron', testMatch: /(?:smoke|workflows|zoom)\.spec\.ts/ },
    { name: 'visual', testMatch: /visual\.spec\.ts/, timeout: 180_000,
      snapshotPathTemplate: '{testDir}/snapshots/{platform}/{arg}{ext}' },
  ],
});

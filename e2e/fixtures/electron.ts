import { _electron, expect, test as base, type ElectronApplication, type Page } from '@playwright/test';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface ElectronFixture {
  page: Page;
  userDataDir: string;
  restart(): Promise<Page>;
  download(path: string, trigger: () => Promise<void>): Promise<void>;
}

const monitors = new WeakMap<Page, () => Promise<string[]>>();
const requireDesktop = createRequire(resolve('apps/desktop/package.json'));
const packaged = process.env.QUARRY_E2E_PACKAGED === '1';

export async function assertPageHealthy(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    await document.fonts.ready;
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility === 'visible';
    };
    const brokenImages = [...document.images].filter(img =>
      (visible(img) || img.checkVisibility()) && (!img.complete || !img.naturalWidth)).map(img => img.src);
    const brokenIcons = [...document.querySelectorAll('svg')]
      .filter(svg => svg.checkVisibility() && !visible(svg)).map(svg => svg.outerHTML.slice(0, 150));
    const font = [...document.fonts].some(face => face.family === 'QuarrySerif' && face.status === 'loaded');
    const root = document.documentElement;
    return { brokenImages, brokenIcons, font, overflow: root.scrollWidth > root.clientWidth + 1 };
  })).toEqual({ brokenImages: [], brokenIcons: [], font: true, overflow: false });
  expect(await monitors.get(page)!(), 'Electron renderer and preload errors').toEqual([]);
}

export async function api<T>(page: Page, route: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const url: unknown = await page.evaluate(() => Reflect.get(window, '__QUARRY_API_URL__'));
  if (typeof url !== 'string') throw new Error('Electron preload did not expose the API URL');
  const response = await fetch(url + '/api/' + route, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  expect(response.ok, route + ': ' + JSON.stringify(result)).toBe(true);
  return result.data as T;
}

export const test = base.extend<{ quarry: ElectronFixture }>({
  quarry: async ({}, use, testInfo) => {
    const data = await mkdtemp(join(tmpdir(), 'quarry-e2e-'));
    const errors: string[] = [];
    let app: ElectronApplication | undefined;
    let active: Page | undefined;
    let launchCount = 0;
    const stop = async () => {
      if (!app) return;
      try {
        const preload = await app.evaluate(() => Reflect.get(globalThis, '__quarryPreloadErrors') as string[] | undefined);
        errors.push(...(preload ?? []));
        if (testInfo.status !== testInfo.expectedStatus && active && !active.isClosed()) {
          await active.screenshot({ path: testInfo.outputPath('electron-failure-' + launchCount + '.png'), timeout: 3_000 })
            .catch(() => {});
        }
      } finally {
        await app.close();
        app = undefined;
      }
    };
    async function launch() {
      launchCount++;
      const executablePath = packaged ? resolve('apps/desktop/release',
        process.platform === 'win32' ? 'win-unpacked/Quarry.exe' :
          process.arch === 'arm64' ? 'linux-arm64-unpacked/Quarry' : 'linux-unpacked/Quarry') : requireDesktop('electron');
      await access(executablePath);
      const env = Object.fromEntries(Object.entries(process.env)
        .filter((entry): entry is [string, string] => entry[1] !== undefined));
      env.QUARRY_USER_DATA_DIR = data;
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.VITE_DEV_SERVER_URL;
      app = await _electron.launch({
        env, executablePath, timeout: 20_000,
        args: [
          '--user-data-dir=' + join(data, 'renderer'),
          ...(testInfo.project.name === 'visual' ? ['--force-device-scale-factor=1'] : []),
          ...(!packaged ? [resolve('apps/desktop/dist/runtime/main.js')] : []),
        ],
      });
      const current = app;
      // Observe new renderers and replay the initial load after installing the preload listener.
      await current.evaluate(({ app, webContents }) => {
        const errors: string[] = [];
        Reflect.set(globalThis, '__quarryPreloadErrors', errors);
        const monitor = (contents: ReturnType<typeof webContents.getAllWebContents>[number]) => contents.on('preload-error',
          (_event, path, error) => errors.push('preload-error: ' + path + ' ' + error.message));
        webContents.getAllWebContents().forEach(monitor);
        app.on('web-contents-created', (_event, contents) => monitor(contents));
      });
      const page = await current.firstWindow();
      await page.waitForLoadState('networkidle');
      const observe = (target: Page) => {
        target.on('console', message => {
          if (message.type() === 'error') errors.push('console.error: ' + message.text());
        });
        target.on('pageerror', error => errors.push('pageerror: ' + error.message));
        target.on('requestfailed', request => errors.push('requestfailed: ' + request.url() + ' ' + request.failure()?.errorText));
        target.on('response', response => {
          if (response.status() >= 400) errors.push('HTTP ' + response.status() + ': ' + response.url());
        });
      };
      current.context().pages().forEach(observe);
      current.context().on('page', observe);
      monitors.set(page, async () => [...errors,
        ...await current.evaluate(() => Reflect.get(globalThis, '__quarryPreloadErrors') as string[])]);
      active = page;
      await page.reload({ waitUntil: 'networkidle' });
      return page;
    }
    try {
      const fixture: ElectronFixture = {
        page: await launch(), userDataDir: data,
        async restart() {
          await assertPageHealthy(fixture.page);
          await stop();
          fixture.page = await launch();
          return fixture.page;
        },
        async download(path, trigger) {
          const current = app!;
          // Electron owns downloads for file:// windows and exposes their completion on the session.
          await current.evaluate(({ BrowserWindow }, target) => {
            Reflect.set(globalThis, '__quarryDownload', 'waiting');
            BrowserWindow.getAllWindows()[0]!.webContents.session.once('will-download', (_event, item) => {
              item.setSavePath(target);
              item.once('done', (_event, state) => Reflect.set(globalThis, '__quarryDownload', state));
            });
          }, path);
          await trigger();
          await expect.poll(() => current.evaluate(() => Reflect.get(globalThis, '__quarryDownload')),
            { message: 'Electron download completion', timeout: 10_000 }).toBe('completed');
        },
      };
      await use(fixture);
      if (testInfo.status === testInfo.expectedStatus) await assertPageHealthy(fixture.page);
    } finally {
      try { await stop(); }
      finally { await rm(data, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }); }
    }
  },
});

export { expect };

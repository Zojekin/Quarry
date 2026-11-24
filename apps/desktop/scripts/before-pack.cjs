const fs = require('node:fs');
const path = require('node:path');

function resolveBetterSqliteReleaseDir() {
  const desktopDir = path.resolve(__dirname, '..');
  let pkgDir;
  try {
    const pkgJsonPath = require.resolve('better-sqlite3/package.json', { paths: [desktopDir] });
    pkgDir = path.dirname(fs.realpathSync(pkgJsonPath));
  } catch {
    const entryPath = fs.realpathSync(require.resolve('better-sqlite3', { paths: [desktopDir] }));
    let cur = path.dirname(entryPath);
    while (cur !== path.dirname(cur)) {
      if (fs.existsSync(path.join(cur, 'package.json'))) {
        pkgDir = cur;
        break;
      }
      cur = path.dirname(cur);
    }
  }
  if (!pkgDir) {
    throw new Error('Unable to resolve better-sqlite3 package directory');
  }
  return path.join(pkgDir, 'build', 'Release');
}

module.exports = async function () {
  await import('./bundle.mjs');
  // Packaging only targets Windows currently; guard platform
  if (process.platform !== 'win32') return;

  // Ensure Electron ABI better_sqlite3 is in place for packaging
  const electronNodePath = path.resolve(__dirname, '../resources/electron-better_sqlite3.node');
  if (fs.existsSync(electronNodePath)) {
    const targetDir = resolveBetterSqliteReleaseDir();
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(electronNodePath, path.join(targetDir, 'better_sqlite3.node'));
  }
};

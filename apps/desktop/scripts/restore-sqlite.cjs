const fs = require('node:fs');
const path = require('node:path');

// This script only applies to Windows where prebuilt ABI mismatch occurs.
// On Linux / macOS (e.g. GitHub Actions ubuntu-latest), better-sqlite3 is compiled natively for ELF.
if (process.platform !== 'win32') {
  process.exit(0);
}

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

const nodePath = path.resolve(__dirname, '../resources/node-better_sqlite3.node');
if (fs.existsSync(nodePath)) {
  const targetDir = resolveBetterSqliteReleaseDir();
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(nodePath, path.join(targetDir, 'better_sqlite3.node'));
}

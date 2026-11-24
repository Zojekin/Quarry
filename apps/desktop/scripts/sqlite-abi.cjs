const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Dynamically resolve the installed `better-sqlite3` package root from `apps/desktop`.
 */
function resolveBetterSqlitePkgDir() {
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
  return pkgDir;
}

function getSqlitePaths() {
  const pkgDir = resolveBetterSqlitePkgDir();
  return {
    pkgDir,
    targetFile: path.join(pkgDir, 'build', 'Release', 'better_sqlite3.node'),
    electronBinary: path.resolve(__dirname, '../resources/electron-better_sqlite3.node'),
    nodeFallbackBinary: path.resolve(__dirname, '../resources/node-better_sqlite3.node'),
    backupFile: path.resolve(__dirname, '../dist/node-better_sqlite3.bak'),
  };
}

/**
 * Probe loading `better-sqlite3` in a short-lived child process so Windows DLL locks are released.
 */
function canLoadBetterSqlite(pkgDir) {
  try {
    execFileSync(
      process.execPath,
      ['-e', "const D = require(process.argv[1]); const db = new D(':memory:'); db.close();", pkgDir],
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  resolveBetterSqlitePkgDir,
  getSqlitePaths,
  canLoadBetterSqlite,
};

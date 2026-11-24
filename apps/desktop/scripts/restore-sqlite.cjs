const fs = require('node:fs');
const path = require('node:path');
const { getSqlitePaths, canLoadBetterSqlite } = require('./sqlite-abi.cjs');

// This script only applies to Windows where prebuilt ABI mismatch occurs.
// On Linux / macOS (e.g. GitHub Actions ubuntu-latest), better-sqlite3 is compiled natively for ELF.
if (process.platform !== 'win32') {
  process.exit(0);
}

const { pkgDir, targetFile, nodeFallbackBinary, backupFile } = getSqlitePaths();

// Avoid overwriting a working Node ABI binary (e.g. Node 22 in CI) with a different Node ABI fallback.
if (canLoadBetterSqlite(pkgDir)) {
  process.exit(0);
}

fs.mkdirSync(path.dirname(targetFile), { recursive: true });
if (fs.existsSync(backupFile)) {
  fs.copyFileSync(backupFile, targetFile);
  fs.rmSync(backupFile, { force: true });
  if (canLoadBetterSqlite(pkgDir)) {
    process.exit(0);
  }
}

if (fs.existsSync(nodeFallbackBinary)) {
  fs.copyFileSync(nodeFallbackBinary, targetFile);
}

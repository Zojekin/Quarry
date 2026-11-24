const fs = require('node:fs');
const path = require('node:path');
const { getSqlitePaths } = require('./sqlite-abi.cjs');

module.exports = async function () {
  await import('./bundle.mjs');
  // Packaging only targets Windows currently; guard platform
  if (process.platform !== 'win32') return;

  const { targetFile, electronBinary, backupFile } = getSqlitePaths();
  if (!fs.existsSync(electronBinary)) return;

  // Preserve the current Node ABI binary (e.g. Node 22 in CI or Node 26 locally) before swapping in Electron's.
  if (fs.existsSync(targetFile) && !fs.readFileSync(targetFile).equals(fs.readFileSync(electronBinary))) {
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.copyFileSync(targetFile, backupFile);
  }

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.copyFileSync(electronBinary, targetFile);
};

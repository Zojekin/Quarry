const fs = require('node:fs');
const path = require('node:path');

module.exports = async function () {
  await import('./bundle.mjs');
  // Ensure Electron ABI better_sqlite3 is in place for packaging
  const electronNodePath = path.resolve(__dirname, '../resources/electron-better_sqlite3.node');
  if (fs.existsSync(electronNodePath)) {
    const targetDir = path.resolve(__dirname, '../../../node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3/build/Release');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(electronNodePath, path.join(targetDir, 'better_sqlite3.node'));
  }
};

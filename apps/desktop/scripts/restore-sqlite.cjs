const fs = require('node:fs');
const path = require('node:path');

// This script only applies to Windows where prebuilt ABI mismatch occurs.
// On Linux / macOS (e.g. GitHub Actions ubuntu-latest), better-sqlite3 is compiled natively for ELF.
if (process.platform !== 'win32') {
  process.exit(0);
}

const nodePath = path.resolve(__dirname, '../resources/node-better_sqlite3.node');
if (fs.existsSync(nodePath)) {
  const targetDir = path.resolve(__dirname, '../../../node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3/build/Release');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(nodePath, path.join(targetDir, 'better_sqlite3.node'));
}

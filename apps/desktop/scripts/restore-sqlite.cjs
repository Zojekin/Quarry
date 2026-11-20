const fs = require('node:fs');
const path = require('node:path');

// Restore Node ABI better_sqlite3 for development & tests
const nodePath = path.resolve(__dirname, '../resources/node-better_sqlite3.node');
if (fs.existsSync(nodePath)) {
  const targetDir = path.resolve(__dirname, '../../../node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3/build/Release');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(nodePath, path.join(targetDir, 'better_sqlite3.node'));
}

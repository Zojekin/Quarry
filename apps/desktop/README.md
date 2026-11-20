# Electron desktop host

The host starts the shared Hono server in the main process on `127.0.0.1`, waits
for its database health probe, then opens the React application. Data lives in
Electron's `userData` directory: `quarry.sqlite`, `attachments/` and durable
`recovery-points/`. Shutdown drains HTTP requests before destroying SQLite;
repeated stop calls share one promise. Default port allocation uses an atomic
OS-assigned listener rather than a probe-and-rebind race.

The sandboxed, isolated preload exposes only the immutable
`window.__QUARRY_API_URL__` string. Node integration is disabled. New windows and
renderer navigation are blocked. The desktop server composition allows the
opaque `null` origin needed by `loadFile`, including preflight; the shared server
keeps its existing loopback-only CORS policy. This is a local single-user service,
without an authentication boundary between programs running as the same user.

From the repository root:

```powershell
npx pnpm --filter @quarry/web build
npx pnpm --filter @quarry/desktop dev
```

For live frontend development, start the web dev server separately and set
`VITE_DEV_SERVER_URL=http://127.0.0.1:5173`. The host always injects the actual
backend URL. `dev` bundles the host before launching Electron.

```powershell
# Run desktop tests
npx pnpm --filter @quarry/desktop test

# Build TypeScript
npx pnpm --filter @quarry/desktop build

# Package unpacked folder for rapid local verification (release/win-unpacked)
npx pnpm package:dir

# Full distribution packaging (NSIS installer, Portable exe, and ZIP archive in release/)
npx pnpm package
```

`build` performs the requested TypeScript compilation. Packaging lifecycle scripts
build the web assets; `beforePack` bundles workspace TypeScript into an ESM main
entry and a CommonJS sandbox-compatible preload under `dist/runtime/`. Web assets are
copied to `resources/web`; Vite uses relative asset URLs for offline file loading.
Application branding uses high-resolution `resources/icon.ico` and `resources/icon.png`
derived from the official transparent logo.

Packaging targets Windows x64 under `release/`:
- **NSIS installer** (`题匣 Setup 0.1.0.exe`): Assisted wizard installation (`oneClick: false`),
  default per-machine installation (`perMachine: false`, `selectPerMachineByDefault: true`, `allowElevation: true`),
  allows user-selected installation path defaulting to `Quarry` (avoiding path encoding issues),
  offers checkboxes for desktop and start menu shortcuts, provides an uninstaller (`Uninstall 题匣.exe`),
  Simplified Chinese UI (`language: "2052"`), and guarantees user question bank databases and
  attachments in AppData are not wiped upon uninstallation (`deleteAppDataOnUninstall: false`).
- **Portable executable** (`题匣 0.1.0.exe`): Single self-contained executable for on-the-go usage.
- **ZIP green archive** (`题匣-0.1.0-win.zip`): Unpack and run `Quarry.exe` directly without setup.

Native SQLite (`better-sqlite3`) ABI switching is fully automated via lifecycle hooks:
`beforePack` stages the Electron ABI native addon, while `postpack`, `postdist`, `pretest`,
and `predev` automatically restore the Node ABI binary (`scripts/restore-sqlite.cjs`).
This eliminates `node-gyp` C++ compilation requirements on Windows build machines.

Integration tests use real TCP listeners, file-backed SQLite and the production
web BackendClient. They cover health, CRUD, persistence, concurrent backends,
desktop CORS, occupied-port failure cleanup, repeated stop and exact-port reuse.
Windows file deletion and absent WAL files verify database handle release.

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
npx pnpm --filter @quarry/desktop test
npx pnpm --filter @quarry/desktop build
npx pnpm --filter @quarry/desktop pack
npx pnpm --filter @quarry/desktop dist
```

`build` performs the requested TypeScript compilation. Packaging lifecycle scripts
build the web assets; `beforePack` bundles workspace TypeScript into an ESM main
entry and a CommonJS sandbox-compatible preload under `dist/runtime/`. This avoids
shipping workspace source entry points as executable code. Web assets are copied
to `resources/web`; Vite uses relative asset URLs for offline file loading.
`better-sqlite3` remains external, is rebuilt by electron-builder for Electron's
ABI and is unpacked from ASAR. Packaging targets Windows x64 NSIS and portable
executables under `release/`.

Packaging rebuilds the native addon for Electron. If subsequent Node-based tests
report an ABI mismatch, run `npx pnpm rebuild better-sqlite3` with your Node runtime
before testing again. Creating release artifacts may require initial downloads
of Electron and builder toolchains; installed application execution is offline.

Integration tests use real TCP listeners, file-backed SQLite and the production
web BackendClient. They cover health, CRUD, persistence, concurrent backends,
desktop CORS, occupied-port failure cleanup, repeated stop and exact-port reuse.
Windows file deletion and absent WAL files verify database handle release.
Installer creation and clean-machine offline GUI acceptance are separate release
checks, beyond these automated backend integration tests.

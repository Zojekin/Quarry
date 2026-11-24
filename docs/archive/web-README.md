# Production web application

Run from the repository root:

```sh
npx pnpm install
npx pnpm --filter @quarry/web dev
npx pnpm --filter @quarry/web test
npx pnpm --filter @quarry/web build
```

The build emits `apps/web/dist/`. Serve that directory with a static HTTP server. Start the Hono service separately; Vite does not create a database or seed production data.

The API origin resolves in this order:

1. `window.__QUARRY_API_URL__`, injected by the host before loading the entry module.
2. `VITE_API_URL`, supplied to the Vite build/dev environment.
3. `http://127.0.0.1:48123`.

`src/api/client.ts` is the only production HTTP adapter. Pages use explicit REST DTO projections, not database rows or the prototype store. Tests under `tests/` include standard-fetch request tests, React interaction tests, and tests against the actual Hono application with isolated in-memory SQLite. No user database is touched.

The React application includes dashboard, folder library, bank/paper management, question editing, paper composition and follow preview, practice/exam, results, mistakes/review-paper creation, records, tag colors/about and trash. Markdown and KaTeX are code-split; raw HTML is disabled. Product metadata comes from root `product-info.json`, version from root `package.json`; rebuild after changing these files. Source Han Serif and its license are bundled under `public/assets/`.

Presentation state belongs to independent workspace tabs in sessionStorage. Initial practice/exam drafts are saved through `/api/sessions/:id/draft`. Reattempt drafts remain local until confirmation because that endpoint deliberately rejects previously submitted practice questions. A confirmation uses the next attempt index; results do not sum multiple attempts for the same question.

The browser countdown uses the immutable session duration and submits expired exams, including after restoration. Existing server limitations remain: it does not enforce expiry independently of a connected client, and does not provide crash/sleep heartbeat timing. Normal frontend departure pauses through a best-effort keepalive request. Portable bank/paper imports and folder exports are supported; folder ZIP import remains unsupported by the existing backend.

Verification commands:

```sh
npx pnpm --filter @quarry/web test
npx pnpm --filter @quarry/web build
npx pnpm test
npx pnpm build
```

Browser evidence from isolated in-memory test data is under `.oil-ui/phase3/` (not a runtime dependency). Desktop-wide and 850px practice screens were visually inspected. See `memory-bank/progress.md` for final test counts.

Final verification (2026-11-10): web tests 25/25, monorepo tests 147/147, web production build and all six workspace builds pass. Core coverage remains 100%.

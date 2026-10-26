# AGENTS.md — SHSID CC Advisor

Guidance for AI coding agents working in this repository. Read this before making changes.

## Project overview

An interactive 4-year course-planning tool for SHSID students (built by students on the Indexademics and Data Science teams). It turns the static school course catalog into a visual map with real prerequisite/move-up rule checking, a shareable plan, offline support, and crowdsourced course ratings. The same repo also ships a public, CORS-enabled JSON API for third-party developers.

The course catalog itself is **not stored in this repo**. It is fetched at runtime from a remote GitHub mirror (`WillUHD/CourseResources`, raw `Courses.catalog` file, proxied through `edgeone.gh-proxy.org`). The file is a lenient JSON dialect: `//` line comments are stripped and trailing commas are removed before parsing.

## Tech stack

- **Frontend**: Vue 3 + TypeScript + Vite + Tailwind CSS + GSAP. The entire UI lives in one large single-file component, `src/App.vue` (~1650 lines).
- **Backend**: TypeScript, two parallel implementations of the same domain logic:
  - `src/backend/` — the browser-side domain layer imported by `App.vue` (solver, controller, catalog updater, persistence, plan codec, ratings client).
  - `api/[[...path]].ts` — a single self-contained Vercel serverless function (~1750 lines) that inlines its own copy of the types, catalog loader, and solver **with zero relative imports**, so nothing can be lost in bundling. When you change rule/solver logic, check whether it needs to change in both places.
- **State**: no Pinia/Vuex — plain reactive state inside `App.vue`, coordinated through `CourseSelectionController`.
- **Ratings persistence**: Upstash Redis / Vercel KV via the REST API (`KV_REST_API_URL` / `KV_REST_API_TOKEN`). Without credentials the API falls back to per-instance in-memory maps, which lose votes on cold start. `GET /api/status` reports which mode is live.
- **Node.js**: v20.19+ or v22.12+ (enforced via `package.json` `engines`).

## Build, test, and run commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server for the frontend only, http://localhost:5173 |
| `npm run api` | Local API harness (`scripts/api-harness.mjs`), http://localhost:8123/api |
| `npm test` | Vitest unit tests for the browser backend (`src/backend/__tests__/`) |
| `npm run test:api` | API smoke suite against an in-process harness (uses the in-memory store; safe anywhere). `npm run test:api -- https://host` runs it against a real deployment |
| `npm run type-check` | `vue-tsc --build` (project references: `tsconfig.app.json` + `tsconfig.node.json`) |
| `npm run build` | Type-check + production build (this is what CI runs) |
| `npm run verify` | type-check + unit tests + build |

Note: CI runs the API smoke suite with `node --experimental-strip-types` so Node 22 can import the TypeScript API handler without a build step.

## Code organization

- `src/App.vue` — the whole frontend UI (department list, grade grid, plan panel, exports, search, ratings UI).
- `src/backend/` — browser domain layer:
  - `Solver.ts` (`CatalogSolver`) — builds the course graph, resolves prerequisite (DNF: outer AND, inner OR) and concurrent rules, conflict groups (one course per department-grade slot), move-ups, and `next`-track locks.
  - `Controller.ts` (`CourseSelectionController`) — the public API `App.vue` calls; translates view events into solver calls and emits `CourseViewModel`s. Important invariant: the solver evaluates only what the student *explicitly* chose (`selectedIds`), never the derived plan with implied courses.
  - `Updater.ts` — fetches the remote catalog, lints it, and caches the last good copy in `localStorage` (`shsid-cc.catalogCache.v1`) so an outage degrades to "yesterday's catalog, clearly labelled".
  - `Linter.ts` — static checks on the catalog (duplicate ids, cycles, type errors, dangling rule references).
  - `PlanCodec.ts` — encodes/decodes a plan into the share-link URL format.
  - `Persistence.ts`, `RatingStore.ts`, `ViewModel.ts`, `CourseModel.ts` — local plan persistence, ratings client, view-model types, catalog types.
- `api/[[...path]].ts` — the Vercel function: inlined types + catalog loader + solver, then rating store (KV with in-memory fallback), third-party description provider, voter identity (`ccvoter` cookie + client echo), rate limiting, structured request logging, CORS allowlist, and a hand-rolled router.
- `scripts/api-harness.mjs`, `scripts/api-smoke.mjs` — local API server and smoke suite.
- `docs/API.md` (public API reference), `docs/DEPLOYMENT.md` (health checks, logs, rate-limit headers, rollback), `docs/input.md` (description-provider contract).

## Conventions and invariants

- **Comment style**: every non-trivial function/module carries a comment explaining *why* it exists and the failure mode it guards against, not just what it does. New backend logic should follow this. Attribution headers on some `src/backend` files (`// written by willuhd on ...`) are historical — keep the style consistent with the surrounding file.
- **Strict TypeScript**: `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `strict`. Tests are excluded from `tsconfig.app.json` and run under Vitest.
- **API error contract**: errors return `{ ok: false, error, code }` with a stable machine-readable `code` (`bad_request`, `not_found`, `method_not_allowed`, `payload_too_large`, `rate_limited`, `upstream_unavailable`, `internal_error`); clients must branch on `code`, not message text. Successes return `{ ok: true, data }`.
- **One ballot per voter per course**; editing a vote shifts the tally *sum* by the delta and never bumps `count`. First write uses `SET NX`, later edits use `GETSET` — preserve this atomicity if you touch `castVote`.
- **Voter identity** is deliberately a browser-profile token, not a fingerprint. The `ccvoter` HttpOnly cookie wins over any client-claimed id. Do not add tracking.
- **The solver is lenient**: it invents missing prerequisites and calls a plan valid, so callers that need the real schedule must read the transitive closure (`resolveSelection` / `impliedCourses` in `POST /api/validate`) rather than trusting `ok` alone.
- **Catalog parsing is lenient**: strip `//` comments and trailing commas before `JSON.parse`.
- **Offline-first frontend**: never let a catalog fetch failure produce a dead screen; fall back to the cached copy with a visible warning.
- **CORS**: credentialed calls (carrying the voter cookie) are only allowed from origins in `ALLOWED_ORIGINS` plus the app's own Vercel URL; everyone else gets the open anonymous API without credentials. Do not echo arbitrary origins with `Allow-Credentials`.
- **Observability**: the API logs exactly one JSON line per request on stdout (method, route, status, duration, request id). Never log request bodies or voter tokens.
- **Rate limits** (`RATE_LIMIT_VOTES`, `RATE_LIMIT_DESCRIPTIONS`, 60 per 10-minute window by default) only meter writes and provider-backed calls; cached reads are free. Responses carry `RateLimit-*` headers.
- Path alias `@/` → `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).

## Testing

- Unit tests live in `src/backend/__tests__/` (Vitest): `Controller`, `Linter`, `Persistence`, `PlanCodec`, `RatingStore`, `Updater`, plus a hand-built `fixture.ts` catalog (prerequisite chain, either/or rule, cross-department corequisite, move-up chain, `next` track lock).
- There are no frontend component tests; the UI is verified through `type-check` + build + the API smoke suite.
- The smoke suite (`scripts/api-smoke.mjs`) exercises ratings and description endpoints end-to-end. Against a real deployment it casts a real vote from a throwaway voter token — it deliberately keeps that behavior minimal (one course, one ballot).

## CI and deployment

- `.github/workflows/ci.yml` — on every push (non-main) and PR: `npm run build` (type-check + build) and the API smoke suite. Nothing touches a deployment or a real rating store.
- `.github/workflows/auto-merge.yml` — every push to a non-main branch that passes unit tests + build is auto-merged into `main` (`--no-ff`, with retries). Put `[skip automerge]` in the commit message to opt out. So **any commit pushed to a feature branch lands on `main` if green** — keep branches clean.
- Deployment: Vercel, configured entirely by `vercel.json` (framework `vite`, SPA rewrite to `index.html` except `/api/*`, security headers, asset caching, 512 MB / 15 s function limits). Import the repo at vercel.com/new and deploy.
- **Before students use a deployment**, attach an Upstash Redis store so ratings persist, then **redeploy** (env vars are read only at cold start). Verify with `curl -s https://<host>/api/status | jq '.data.checks.ratingStore'` — `"durable": true` is the ground truth.
- Optional env vars (description provider, `ALLOWED_ORIGINS`, rate limits, `MAX_BODY_BYTES`) are documented in `.env.example`. Copy to `.env.local` for local use; the dedicated tools here refuse to read `.env` files.

## Security considerations

- Never log voter tokens or request bodies; ballots are anonymous by design.
- Do not weaken the CORS allowlist or the `VOTER_ID_PATTERN` validation.
- Keep the `MAX_BODY_BYTES` pre-parse body check when adding POST endpoints.
- Rate limiting depends on KV in production; in-memory counters are a dev fallback only.
- The API key for the description provider is sent as `Bearer` by default, or raw in a custom header via `DESCRIPTION_API_AUTH_HEADER` — handle both if you touch that code.
- Unofficial tool, not affiliated with SHSID; course data comes from the remote catalog mirror, not this repo.

---
name: Hono Dashboard Auth Seam
domain: dashboard-auth
confidence: medium
tools: [view, rg, vitest]
---

# Hono Dashboard Auth Seam

## When to Use

- A task asks for dashboard auth, a password gate, login/logout, or session protection.
- You need to verify whether a Hono dashboard is already protected or still fully open.
- You want the smallest auth change that fits this repo’s current Hono + SQLite architecture.

## Workflow

1. Start at `src/dashboard/server.ts`:
   - inspect `createApp(...)`
   - verify whether `app.use(...)` only handles static assets or also applies auth middleware
   - trace representative routes like `/`, `/articles/:id`, `/config`, `/api/articles/:id/draft`, `/api/articles/:id/publish`
   - if an issue mentions an existing password gate, verify that the checked-in runtime still contains it before planning around it
2. Check startup/config in `src/config/index.ts`:
   - confirm which env vars are loaded through `loadDotEnv()` / `loadConfig()`
   - verify whether dashboard auth settings already exist
3. Check persistence in `src/db/repository.ts` and `src/db/schema.sql`:
   - look for auth/session/user tables and repository methods
   - if absent, prefer a small `dashboard_sessions` addition over a full user system
4. Check tests before proposing changes:
   - `tests/dashboard/server.test.ts`
   - `tests/dashboard/publish.test.ts`
   - `tests/e2e/live-server.test.ts`
   - `tests/dashboard/config.test.ts`
   - note whether tests hit routes directly without login setup

## Must-Haves

- Prefer a server-enforced Hono middleware seam over per-route ad hoc checks.
- Use an opaque session id in an `httpOnly` cookie; do not store a bare “authenticated=true” flag client-side.
- Fit the first pass to the current single-operator dashboard shape; avoid premature multi-user complexity.
- If issue comments or product guidance choose a local login first, keep the first pass to username/password auth instead of jumping to OAuth/SSO.
- Keep auth opt-in/off for tests and local development unless explicitly enabled, because current test helpers assume open access.

## Current seam map

- `src/dashboard/server.ts` now resolves `dashboardAuth`, exposes `GET/POST /login` plus `POST /logout`, and applies one `app.use('*', ...)` auth middleware before SSE and the dashboard routes.
- `src/dashboard/sse.ts` still exposes `/events`, but the server middleware now covers it, so SSE is part of the same auth boundary as the rest of the dashboard.
- `src/dashboard/server.ts` keeps `/static/*` public and treats `/images/:slug/:file` as protected unless the backing article is already published / Stage 8.
- `src/config/index.ts` exposes `dashboardAuth` on `AppConfig`, parses `DASHBOARD_AUTH_MODE`, `DASHBOARD_AUTH_USERNAME`, `DASHBOARD_AUTH_PASSWORD`, `DASHBOARD_SESSION_COOKIE`, and `DASHBOARD_SESSION_TTL_HOURS`, and defaults secure cookies on in production.
- `src/db/repository.ts` / `src/db/schema.sql` now provide `dashboard_sessions` persistence plus session create/read/delete/expiry cleanup helpers.
- Dashboard tests now cover redirects, login/logout, SSE/API/HTMX/image protection, publish-page protection, and e2e login flow.

## Recommendation

For this repo, keep the dashboard auth seam narrow: single-operator local login, config-driven `off|local` mode, SQLite-backed opaque sessions, and one middleware protecting HTML/API/HTMX/SSE plus unpublished image routes. Treat `/static/*`, login/logout, and published images as the only public surfaces, keep auth opt-in for tests/local workflows, and do not expand to roles or OAuth until product scope changes.

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

- `src/dashboard/server.ts` calls `registerSSE(app, bus)`, serves `/static/*`, then registers all dashboard HTML/API/HTMX routes directly.
- `src/dashboard/sse.ts` exposes `/events`, which means SSE must be covered by the same auth gate instead of being treated as a side channel.
- `src/dashboard/server.ts` also exposes `/images/:slug/:file`, so unpublished article media should be treated as protected dashboard content unless the product explicitly wants public asset URLs.
- `src/config/index.ts` loads repo-root and data-dir `.env` files, but today only exposes NFL runtime and provider/service configuration.
- `src/db/repository.ts` / `src/db/schema.sql` are the natural persistence seam, but currently contain no auth/session schema.
- Dashboard tests construct `createApp(repo, config)` and call routes immediately, which is strong evidence that auth is currently absent.

## Recommendation

For this repo, the minimum viable long-term direction is: add Hono auth middleware plus `GET/POST /login` and `POST /logout`, back the session with a small SQLite `dashboard_sessions` table, and gate all dashboard/API/HTMX/SSE routes plus unpublished image routes except static assets and login. Keep the first pass single-operator and config-driven (`off|local` mode plus username + password hash + session secret), then expand only if the product truly needs per-user roles later.

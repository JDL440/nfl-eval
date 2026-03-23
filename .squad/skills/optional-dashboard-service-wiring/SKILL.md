---
name: Optional Dashboard Service Wiring
domain: dashboard-runtime
confidence: high
tools: [view, rg, vitest]
---

# Optional Dashboard Service Wiring

## When to Use

- A dashboard feature says a service is “not configured,” but env looks correct.
- `createApp(...)` accepts an optional dependency (`substackService`, `twitterService`, etc.) and you need to verify whether startup actually wires it.
- You want to separate a real env/config problem from a startup dependency-injection gap.

## Workflow

1. Start at the app seam:
   - inspect `src/dashboard/server.ts` for `createApp(...)`
   - list optional deps accepted from startup
2. Trace the route guard:
   - find the exact handler returning the config error
   - note whether it checks `!service`, missing env, invalid input, or upstream HTTP failure
3. Inspect startup wiring:
   - go to `startServer()`
   - verify whether the service is instantiated, logged, and passed into `createApp(...)`
   - compare against a working optional service such as `imageService`
4. Confirm env-loading expectations:
   - `src/config/index.ts` for `.env` load order
   - `.env.example` / `README.md` for required vars
5. Only after that decide whether the bug is:
   - true local misconfiguration
   - startup DI gap
   - misleading user-facing error semantics

## Heuristic

Ask these questions in order:

1. **Does the route only check `!service`?** If yes, the message reflects dependency presence, not necessarily env validity.
2. **Does startup build and pass that service?** If not, the route will fail regardless of env.
3. **Are the required vars documented and loaded?** If yes, treat the issue as wiring first, not operator error.

## Current seam map

- `src/dashboard/server.ts` accepts optional runtime deps in `createApp(...)`.
- `src/config/index.ts` loads `.env` from repo root and `~/.nfl-lab/config/.env`.
- `.env.example` is the source of truth for publishing credentials.
- `src/services/substack.ts` validates token/url shape once instantiated, so route handlers should not pretend to diagnose env if startup never built the service.

## Recommendation

For this repo, wire optional dashboard integrations at startup using the same pattern every time: read env once, instantiate if the required vars exist, inject into `createApp(...)`, and log a non-fatal unavailable state. In UX, prefer an actionable unavailable/config state over a generic 500 whenever the condition is expected or operator-fixable.

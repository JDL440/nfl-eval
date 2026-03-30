---
name: Idea Error Trace Surface
domain: dashboard-ux
confidence: high
tools: [typescript, vitest]
---

# Idea Error Trace Surface

## When to Use

- A dashboard form submits to a JSON API that may return operator-facing diagnostics like `traceId` or `traceUrl`.
- The success path should stay unchanged, but failure states need better support/debug visibility.
- The repo already has a canonical trace page, so UX only needs to preserve and present the link.

## Pattern

1. Keep the API envelope intact.
   - If the backend already returns `{ error, traceId, traceUrl }`, do not collapse it to a string in the client.
2. Separate the primary error from support details.
   - Show the human error message first.
   - Show trace metadata in a secondary block labeled as support/debug info.
3. Prefer the existing trace surface.
   - Link to `/traces/:id` (or the returned `traceUrl`) instead of embedding raw trace payloads in the form.
4. Make the enhancement additive.
   - Do not change the success markup, redirect behavior, or button flow.
   - Only enrich the non-OK fetch branch.
   - Prefer a shared formatter/helper that can be imported in tests and serialized into inline dashboard scripts, so the browser path and unit tests exercise the same escaping + trace-link logic.
5. Keep the error state resilient.
   - If only `traceId` exists, render it as text.
   - If `traceUrl` exists, render a link.
   - If neither exists, fall back to the existing plain error copy.
6. Add narrow tests.
   - API test: failure response includes `traceId`/`traceUrl` when the runner fails after a trace starts.
   - View/client test: rendered error status includes the main message plus support details when trace metadata is present.

## Why

This repo already treats `/traces/:id` as the observability surface, so the safest UX move is not a new diagnostics experience. The real problem is usually that the client throws away structured failure fields and reduces everything to `data.error`.

## NFL Lab Evidence

- `src/dashboard/server.ts` — `POST /api/ideas` returns `traceId` and `traceUrl` in the catch path
- `src/dashboard/views/new-idea.ts` — trace-aware formatter is shared between exported test helpers and the inline submit handler
- `src/dashboard/views/traces.ts` — existing operator trace UI
- `tests/dashboard/new-idea.test.ts` — current new-idea coverage and the existing trace attachment route test seam

## Anti-Patterns to Avoid

❌ Reworking the success path just to expose failure diagnostics.  
❌ Dumping raw trace JSON into the form status area.  
❌ Replacing the human error with only a trace ID.  
❌ Adding a new diagnostics route when `/traces/:id` already exists.

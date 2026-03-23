---
name: Dashboard Config Error Copy
domain: dashboard-ux
confidence: high
tools: [view, rg, vitest]
---

# Dashboard Config Error Copy

## When to Use

- An HTMX dashboard panel needs to report a missing optional integration such as Substack, Twitter, or image generation.
- The failure is operator-fixable and should guide recovery without reading like a crash.
- Backend/API responses may need to stay stable while the UI copy gets clearer.

## Pattern

1. Keep the primary alert short and state-based.
   - Example: `Substack publishing is not configured.`
2. Put the action steps in a separate hint/help block directly under the alert.
   - Name the exact env vars.
   - Tell the user to restart if required.
   - Link to the dashboard page that confirms status (here: `/config`).
3. Preserve backend error payloads unless there is a product reason to change API semantics.
4. If the page can detect the missing dependency before the action fires, render the same recovery copy on the initial GET and disable the controls that would just fail.
   - This is especially important for mixed HTMX + `fetch(...)` pages, where one code path may still expose a raw 500 string.

## Why It Works Here

- `src/dashboard/server.ts` returns HTMX publish-missing-config states as a refreshed workflow fragment, so the page should feel recoverable rather than broken.
- `src/dashboard/views/config.ts` already provides the canonical environment-status surface, so publish-panel copy should point there instead of duplicating a full diagnostics UI.
- Short alerts match the rest of the dashboard better than long prose inside the error banner.

## Current Example

- `src/dashboard/views/publish.ts`
- `src/dashboard/server.ts`
- `tests/dashboard/publish.test.ts`

---
name: Artifact Thinking Sidecars
domain: dashboard-observability
confidence: high
tools: [typescript, vitest]
---

# Artifact Thinking Sidecars

## When to use
- A dashboard or artifact viewer needs to surface LLM/debug traces that are already persisted as companion files.
- Main artifacts may also contain inline `<think>` or `<reasoning>` blocks, but those should not outrank the authoritative stored trace.

## Pattern
1. Treat `*.thinking.md` as the authoritative debug source for the sibling `*.md` artifact.
2. In the route/controller seam, load the companion sidecar whenever the main markdown artifact is requested.
3. In the renderer, prefer the persisted sidecar content for the collapsible thinking/debug panel.
4. Still run inline think-tag extraction against the main artifact body so fallback behavior works when no sidecar exists.
5. Make trace availability obvious in the tab/button label instead of hiding it behind a tiny separate control.

## NFL Lab example
- `src/dashboard/server.ts` loads `draft.thinking.md` (or similar) when `/htmx/articles/:id/artifact/draft.md` is requested.
- `src/dashboard/views/article.ts` renders a `Persisted Thinking Trace` details block above the artifact body and uses inline extraction only when the sidecar is absent.
- `tests/dashboard/server.test.ts` and `tests/dashboard/wave2.test.ts` lock in sidecar preference plus fallback extraction.

## Why this works
- The persisted sidecar is the durable seam written by the pipeline, so it is less fragile than parsing mixed model output later.
- Keeping inline extraction as a fallback preserves backward compatibility for older artifacts or providers that only embedded reasoning in-band.

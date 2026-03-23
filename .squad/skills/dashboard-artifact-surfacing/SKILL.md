# Dashboard Artifact Surfacing

## When to use

Use this skill when an article-page dashboard investigation says an artifact or debug output is "missing" even though pipeline or repository code appears to persist it.

## Pattern

1. Start with `src/dashboard/server.ts` to see which article route hydrates the view and which HTMX partial routes are allowed to fetch artifact content.
2. Compare that with `src/dashboard/views/article.ts` to see whether the tab bar is driven by a fixed allowlist, raw `artifactNames`, or both.
3. Trace artifact persistence in `src/pipeline/actions.ts` and any route-local writes in `src/dashboard/server.ts`.
4. Confirm the storage shape in `src/db/repository.ts`, `src/db/artifact-store.ts`, and `src/db/schema.sql` only after the UI read path is understood.

## Common gap

This repo often persists more artifacts than the article page advertises. A file can exist in storage and even appear in context-configuration choices, yet remain invisible on the article page because:

- the tab UI is anchored to `ARTIFACT_FILES`
- the artifact fetch route has a narrower allowlist
- `.thinking.md` files are treated specially

## Quick heuristic

Separate three questions before proposing a fix:

1. **Persisted?** Does pipeline/server code actually write the artifact?
2. **Hydrated?** Does the article route pass enough data to know it exists?
3. **Reachable?** Does the view render a control for it, and will the artifact route allow it to load?

If (1) is yes but (2) or (3) is no, the bug is a dashboard surfacing gap rather than a pipeline persistence bug.

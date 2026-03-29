# Dashboard Surface Retirement Audit

## When to use
Use this when a dashboard/admin surface is being removed or collapsed into another page and you need to verify the cleanup is complete without breaking preserved operational seams.

## Audit checklist
1. Confirm navigation and page copy no longer expose the retired surfaces.
2. Search routes, HTMX fragments, helpers, CSS classes, and tests for dead references to the removed pages or panels.
3. Preserve explicitly approved seams (for example trace pages or maintenance-only POST endpoints) and move any remaining operator affordances onto the surviving admin page.
4. Update tests to assert both sides of the contract: removed routes 404, preserved routes/endpoints still exist.
5. Update docs to describe deprecation honestly: what still exists in storage/runtime, what is disabled, and where operators now go instead.

## Repository examples
- `src/dashboard/views/layout.ts` keeps only Dashboard, New Idea, and Settings in shared navigation.
- `src/dashboard/views/article.ts` should not retain orphaned run/timeline chrome after `/runs` UI removal.
- `src/dashboard/views/config.ts` is the replacement admin surface for memory-status copy and `POST /api/agents/refresh-all`.
- `tests/dashboard/server.test.ts` is the regression seam for removed-route 404s and preserved trace/refresh behavior.

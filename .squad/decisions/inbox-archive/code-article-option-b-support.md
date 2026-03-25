# Code Decision — Article Page Option B Support

## Scope

- `src/dashboard/views/article.ts`
- `src/dashboard/server.ts`
- `src/dashboard/public/styles.css`
- `tests/dashboard/server.test.ts`
- `tests/dashboard/wave2.test.ts`

## Decision

Support Option B by treating the article page header as the only primary stage surface:

1. keep one canonical `Current stage` block at the top
2. add one compact workflow-status line under that block
3. move stage-run history into Advanced diagnostics as `Execution History`
4. keep revision history collapsed by default
5. show only one concise latest-failed-attempt summary in the action card

## Why

The article page was mixing canonical article stage, workflow status, revision loops, and stage-run execution history at the same visual level. That made stage numbers feel inconsistent and forced users to interpret diagnostics as if they were primary workflow state.

Option B works as the smallest safe fix because it preserves existing data seams and HTMX routes while simplifying the rendering hierarchy.

## Implementation Notes

- `renderArticleMetaDisplay()` and `renderLiveHeader()` now share the same `Current stage` + workflow-status rendering so SSE/HTMX refreshes do not drift.
- `renderAdvancedSection()` owns diagnostic run history; the visible label is `Execution History`.
- Execution history badges now render persisted `stage_runs.stage` directly instead of `stage + 1`.
- Revision cards keep their detail content, but the section is a closed disclosure with a summary line (`iterations`, `latest outcome`, `top blocker`).

## Validation

- `npm run test -- tests/dashboard/server.test.ts tests/dashboard/wave2.test.ts`
- `npm run v2:build`

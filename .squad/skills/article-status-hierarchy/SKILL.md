---
name: Article Status Hierarchy
domain: dashboard-ux
confidence: high
tools: [view, rg, styles.css, vitest]
---

# Article Status Hierarchy

## When to use

- The article detail page has too many competing state surfaces.
- A UX request says stage numbers feel inconsistent, noisy, or hard to scan.
- Mobile article detail needs fewer above-the-fold diagnostics without losing access to them.

## Pattern

Use a **one-primary / many-secondary** hierarchy:

1. **Primary:** top `Current stage` block + timeline
2. **Secondary:** one compact workflow status line (`Working`, `Paused for lead review`, `Ready to publish`)
3. **Secondary:** action card with the next operator action
4. **Diagnostic:** revisions, stage runs, audit/advanced details

## Implementation guidance

### 1. Keep canonical stage at the top

- File: `src/dashboard/views/article.ts`
- Render the stage badge from `article.current_stage`
- Label it explicitly as `Current stage`
- Do **not** keep a second raw status badge competing beside it if a plain-text line can explain state better

### 2. Convert workflow status into one compact sentence

- Good examples:
  - `Working`
  - `Paused for lead review`
  - `Ready to publish`
- For Stage 4 with `status='revision'`, make the sentence explicit that the operator is revising toward drafting, not re-running discussion
- Prefer a short line under the stage badge instead of another chip/badge row

### 3. Collapse retrospective content by default

- Revision history should start as a closed `<details>` disclosure
- Summary line should answer:
  - how many iterations?
  - latest outcome?
  - top blocker?

### 4. Move execution diagnostics into Advanced

- Stage runs are useful, but they should not compete with the workflow header
- Keep them inside the existing Advanced disclosure rather than as a separate default sidebar panel
- Prefer a diagnostics label like `Execution History` over another workflow-sounding `Stage Runs` heading
- Render the persisted run stage directly (`stage_runs.stage`), not `stage + 1`

### 5. Keep only one failure summary in the action card

- If stage runs exist, show a single concise line for the latest failed attempt
- Prefer one-line summaries over larger alert boxes that repeat diagnostic history

### 6. Treat editor send-backs as revision work

- If an article is at Stage 4 because Editor regressed it, alias the top-stage label to a revision-oriented term such as `Revision Workspace`
- Prioritize `editor-review.md` and `draft.md` ahead of discussion artifacts in the artifact tabs
- Preserve discussion artifacts, but relabel them as context instead of making them the primary surface

## Mobile-specific rule

If a control is secondary or destructive, it should not sit in the main action scan path on phones.

- Send-back should stack into an inline sheet/card on narrow screens
- Danger Zone should live behind disclosure
- Diagnostics should remain accessible, but closed by default

## Key files

- `src/dashboard/views/article.ts`
- `src/dashboard/public/styles.css`
- `src/dashboard/server.ts`
- `tests/dashboard/server.test.ts`
- `tests/dashboard/wave2.test.ts`

## HTMX parity rule

- Keep the full article header and `/htmx/articles/:id/live-header` on the same renderer so `Current stage` plus the compact workflow-status line stay in sync during SSE refreshes.

## Validation

- `npm run v2:build`
- `npx vitest run tests/dashboard/server.test.ts tests/dashboard/publish.test.ts tests/dashboard/runs.test.ts tests/dashboard/wave2.test.ts`


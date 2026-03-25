---
name: Revision Workspace UX
domain: dashboard-ux
confidence: high
tools: [view, rg, vitest]
---

# Revision Workspace UX

## When to Use

- A pipeline stage technically regresses to an earlier stage, but the operator's real task is revising an existing draft.
- The UI currently risks reading like a return to discussion or ideation instead of a focused draft-fix pass.
- You need to improve the operator mental model without changing backend workflow semantics.

## Pattern

1. Relabel the visible stage/status so the page reads as draft work.
   - Example: keep Stage 4 but render it as `Revision Workspace`.
   - Prefer status copy like `Draft revision in progress` over generic `Revision requested`.
2. Make artifact priority draft-first during revision:
   - `draft.md`
   - `editor-review.md`
   - discussion/context artifacts after that
3. Keep editor feedback and earlier discussion visible, but demote them to supporting context.
4. Reuse one clear send-back control pattern with stage-specific labels and hints instead of cloning multiple dropdown variants.
5. Preserve any existing mobile-width safeguards while changing copy or tab ordering.

## Why It Works Here

- V3 keeps the same stage model underneath, so the UX has to do the work of clarifying that revision is not "back to panel discussion."
- Operators usually need the latest draft first, then the blocking notes, then the historical context.
- Revision UX changes often touch crowded article-detail layouts, so width/overflow protections are easy to regress if they are not treated as part of the pattern.

## Current Example

- `src/dashboard/views/article.ts`
- `src/dashboard/public/styles.css`
- `tests/dashboard/server.test.ts`
- `tests/dashboard/wave2.test.ts`

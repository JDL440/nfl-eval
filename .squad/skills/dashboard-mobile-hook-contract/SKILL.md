---
name: Dashboard Mobile Hook Contract
domain: dashboard-ux
confidence: high
tools: [view, rg, vitest]
---

# Dashboard Mobile Hook Contract

## When to Use

- A dashboard mobile task adds semantic hook classes to Hono views.
- Tests assert mobile class names, but the UI still behaves like the desktop layout.
- You need to audit shared shell/layout behavior across full pages and HTMX fragments.

## Pattern

1. Treat shared mobile classes as a contract, not a fix by themselves.
   - Markup hook examples in this repo:
     - `shared-mobile-header`
     - `shared-mobile-nav`
     - `mobile-detail-layout`
     - `mobile-primary-column`
     - `mobile-secondary-column`
2. Verify the contract in both places:
   - emitted by shared views (`src/dashboard/views/...`)
   - implemented in `src/dashboard/public/styles.css`
3. Prefer shared responsive primitives over page-local patches:
   - shell/nav stacking
   - primary/secondary column ordering
   - filter/toolbar wrapping
   - table/data-surface overflow or card fallback
4. Keep HTMX-safe outer containers stable so fragment swaps do not break the responsive contract.

## Why

This dashboard can appear “mobile ready” in tests because HTML output contains mobile hook classes, while real CSS still ignores them. That gap is easy to miss unless you explicitly verify hook emission and CSS implementation together.

## Current Repo Evidence

- Hook markup:
  - `src/dashboard/views/layout.ts`
  - `src/dashboard/views/article.ts`
  - `src/dashboard/views/publish.ts`
- Hook assertions:
  - `tests/dashboard/server.test.ts`
  - `tests/dashboard/publish.test.ts`
  - `tests/dashboard/runs.test.ts`
  - `tests/dashboard/new-idea.test.ts`
- Missing hook selectors:
  - `src/dashboard/public/styles.css`

## Recommendation

When doing dashboard mobile work here, start by confirming every shared mobile hook has a matching CSS rule and that the responsive behavior lives on stable shared containers, not only on page-local fragments or simulated preview frames.

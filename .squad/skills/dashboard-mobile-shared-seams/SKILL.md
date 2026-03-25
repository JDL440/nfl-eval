# Dashboard Mobile Shared Seams

## When to use

Use this pattern when multiple dashboard pages need mobile/responsive work and the UI is built from shared Hono view templates plus one shared stylesheet.

## Core rule

Start from the shared seams and move outward:

1. shared layout shell
2. shared CSS primitives
3. reused page patterns
4. page-specific exceptions

Do **not** start by patching each page independently unless the issue is narrowly isolated.

## High-leverage seams in this repo

- `src/dashboard/views/layout.ts`
- `src/dashboard/public/styles.css`
- shared grid patterns like `detail-grid`
- shared filter rows like `filter-bar`
- shared table/data wrappers used by `runs`, `memory`, and `config`
- shared preview/detail structure used by `article`, `preview`, and `publish`

## Hidden-coupling check

Before changing shared mobile rules, look for overloaded class names that mean different things on different pages. In this repo, `.agent-grid` is a known example: it is used by both the New Idea picker UI and the Agents directory, so global mobile tweaks can cross-break those screens.

## Safe rollout order

1. table/data presentation
2. filter bars
3. detail-grid/sidebar stacking
4. selector/chip-heavy forms
5. global header/nav shell

This keeps the broadest but lowest-semantic-risk fixes first and leaves the highest blast-radius shell changes for last.

## Testing guidance

Current dashboard tests skew toward route/render behavior, not responsive layout. For mobile work, add assertions around shared markup/class hooks and narrow-screen structural behavior instead of assuming existing route tests will catch layout regressions.

If tests assert new mobile hook classes, also confirm those selectors exist in `src/dashboard/public/styles.css`. In this repo it is possible for views to emit mobile-intent classes and for tests to pass while the stylesheet still has no rules for those hooks, which means the suite is protecting intent rather than real phone behavior.

## Current trap

- Hook classes such as `shared-mobile-header`, `shared-mobile-nav`, `mobile-detail-layout`, `mobile-primary-column`, and `mobile-secondary-column` may appear in views/tests without corresponding CSS selectors.
- When that happens, the real mobile system is still driven by older generic selectors like `detail-grid`, `filter-bar`, `runs-table-wrap`, `memory-table`, and `artifact-table`.
- Audit both markup and stylesheet before concluding that a shared mobile seam has been implemented.

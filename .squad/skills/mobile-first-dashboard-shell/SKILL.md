---
name: Mobile-First Dashboard Shell
domain: dashboard-ux
confidence: high
tools: [view, rg]
---

# Mobile-First Dashboard Shell

## When to Use

- A dashboard page shares the global `renderLayout()` shell and needs to work on phones, not just desktop.
- Multiple pages show the same symptoms: cramped top nav, overflowing tables, crowded action rows, or HTMX swaps that remain desktop-shaped on narrow screens.
- You want the smallest system change before page-by-page cleanup.

## Pattern

1. Start with the shared shell first.
   - Audit `src/dashboard/views/layout.ts` before touching individual pages.
   - Make sure nav/actions can collapse or wrap at phone widths.
2. Add a real mobile layer to `src/dashboard/public/styles.css`.
   - Use explicit phone breakpoints (for example 640px and 480px), not only the existing tablet stack.
   - Add shared rules for action groups, touch targets, and data surfaces.
3. Scope page-specific classes.
   - Do not reuse broad names like `.agent-grid` for incompatible layouts across pages.
   - Prefer page-scoped selectors such as `.new-idea-agent-grid` vs `.agents-directory-grid`.
4. Treat data-heavy surfaces as a shared system.
   - Desktop tables need a mobile card/stacked-row pattern or a clearly intentional compact summary.
   - HTMX fragments should swap into containers that are already mobile-safe.
5. Keep DOM priority aligned with mobile priority.
   - Primary actions should appear early in markup so mobile users reach them first.
6. Verify that new mobile helper classes are actually wired.
   - If views introduce classes like `.mobile-detail-layout` or `.mobile-primary-column`, confirm `src/dashboard/public/styles.css` defines them before assuming the page has a real mobile system.
7. Add a responsive regression seam, not just markup assertions.
   - Existing dashboard tests in this repo mostly check that tables, nav links, and preview containers render.
   - Add at least one focused assertion per shared seam (header shell, detail-page ordering, data-surface fallback) so mobile work does not regress silently.

## Why

In this repo, most dashboard pages inherit the same layout shell, while mobile failures repeat across pages because the CSS system is global and desktop-first. Fixing one page at a time is fragile when the root issues are shared header, action, and table patterns.

## Current Evidence

- `src/dashboard/views/layout.ts`
- `src/dashboard/public/styles.css`
- `src/dashboard/views/{config,memory,runs,new-idea,article,publish}.ts`
- `tests/dashboard/{server,new-idea,publish,runs,wave2}.test.ts`

## Recommendation

For this repo, ship mobile work in this order:

1. shared header/nav + action-stack primitives
2. shared mobile data-surface pattern for tables/HTMX containers
3. scoped class cleanup to prevent cross-page CSS leakage
4. page-specific reorder work only where system primitives are insufficient

## Audit checklist

Before calling a dashboard page "mobile-safe" in this repo, verify these shared seams:

- `src/dashboard/views/layout.ts` header rows actually have CSS for `.header-nav` and a phone breakpoint.
- "Mobile preview" changes the surrounding page chrome too, not only `.preview-container.preview-mobile`.
- Data-heavy views do not rely on three different fallback strategies (`overflow-x`, font shrink, or raw tables) across `/runs`, `/memory`, and `/config`.
- Reused class names are still scoped to one job each; avoid collisions like the current `.agent-grid` split between New Idea chips and Agents directory cards.
- New helper classes added in views are backed by real CSS rules; markup-only mobile classes are not a mobile system.
- Tests verify responsive structure or mobile-specific class/state behavior, not only that the desktop HTML contains expected labels.

## Current contract gaps

These hooks currently appear in view markup/tests and should be treated as the intended shared mobile contract:

- `shared-mobile-header`
- `shared-mobile-nav`
- `header-nav-link`
- `header-env-badge`
- `mobile-detail-layout`
- `mobile-primary-column`
- `mobile-secondary-column`

If those hooks are present but `src/dashboard/public/styles.css` has no selectors for them, the repo is still in a "mobile planned, not mobile implemented" state.

## Extra repo warnings

- `src/dashboard/views/preview.ts` uses `preview-mobile` as a preview simulator, not a shell breakpoint.
- `src/dashboard/views/home.ts`, `publish.ts`, and `login.ts` still use inline layout styles, which makes shared breakpoint tuning harder.
- Missing selectors are themselves a drift signal here. Recent examples include `.page-header`, `.publish-detail-header`, `.article-preview`, `.status-info`, `.publish-workflow-actions`, and `.publisher-form`.

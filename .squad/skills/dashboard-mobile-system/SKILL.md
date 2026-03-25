---
name: Dashboard Mobile System
domain: dashboard-ux
confidence: high
tools: [view, rg, vitest]
---

# Dashboard Mobile System

## When to use

- A dashboard task mentions mobile, responsive design, cramped HTMX panels, or cross-page layout failures.
- Multiple pages share the same shell, tables, toolbars, or sidebar patterns.
- A page-specific bug looks like another symptom of the same CSS/layout system.

## Pattern

1. Audit the shared shell first:
   - `src/dashboard/views/layout.ts`
   - shared header/nav/footer/content wrappers
   - any breakpoint rules in `src/dashboard/public/styles.css`
2. Identify whether the page is reusing shared operational surfaces:
   - data tables (`runs`, `memory`, `config`, markdown tables)
   - action groups / toolbars (`action-bar`, `composer-meta`, `agent-edit-actions`)
   - two-column detail shells (`detail-grid`, sidebar patterns)
3. Check HTMX swap boundaries before proposing fixes:
   - if fragments replace inner containers only, mobile structure must exist inside the fragment renderer too
   - do not rely on one page-level wrapper if `/htmx/*` routes bypass it
4. Prefer system fixes over one-off page patches:
   - mobile-first shell/navigation pattern
   - shared toolbar/action-group pattern
   - shared table-to-card or horizontally-scrollable data-surface pattern
   - scoped class names to avoid collisions between pages

## Current repo heuristics

- `layout.ts` is the single shell for most dashboard pages, so header/nav problems are cross-system by default.
- `styles.css` currently has a thin global mobile layer; many components still rely on desktop flex rows or tables.
- `preview.ts` includes a manual `preview-mobile` toggle, but that is a preview mode, not a substitute for real responsive behavior.
- `new-idea.ts` now uses `.idea-agent-grid` for expert-agent pinning, which is the right isolation move. Treat that as the preferred pattern when a selector grid and a content-card grid would otherwise share a class name.
- `layout.ts` renders `.header-nav`, but the shared stylesheet currently has no dedicated `.header-nav` rule or mobile-nav fallback. Treat header behavior as an unresolved system seam, not a finished component.
- Shared data tables are inconsistent on mobile: `runs.ts` uses `.runs-table-wrap`, while `config.ts` (`.artifact-table`) and `memory.ts` (`.memory-table`) do not share a common responsive wrapper/card strategy.
- `article.ts`, `publish.ts`, and `preview.ts` all rely on toolbar/detail-shell patterns (`.detail-grid`, `.preview-toolbar`, `.usage-summary`) that can still behave like desktop rows even after the main column stacks.
- HTMX/SSE amplifies layout drift here: `renderRunsTable()`, `renderMemoryTable()`, `renderPublishWorkflow()`, and the live article partials all swap independently, so mobile structure must live in shared fragment markup/classes rather than only in full-page wrappers.
- Dashboard tests may assert mobile hook classes without any stylesheet selector for those hooks. In that case the suite is only protecting structural intent; pair hook assertions with `styles.css` checks on the selectors that actually drive the breakpoint behavior.
- Inline layout styles in shared dashboard views are another warning sign. If `home.ts`, `publish.ts`, `login.ts`, or `article.ts` need repeated `style="..."` layout tweaks, the system is missing a reusable shell/action primitive and mobile work should extract that first.

## Recommendation

Treat mobile dashboard work in this repo as a system task: fix shell, data surfaces, and HTMX fragment contracts together. Ship in this order: shell/navigation, shared mobile primitives, fragment contracts, then page-specific follow-through. If the same class or markup pattern appears on more than one page, establish a shared responsive component instead of patching one route at a time.

## Current examples

- Shell/nav: `src/dashboard/views/layout.ts`, `src/dashboard/public/styles.css`
- Detail/preview stack: `src/dashboard/views/article.ts`, `src/dashboard/views/publish.ts`, `src/dashboard/views/preview.ts`
- Dense data surfaces: `src/dashboard/views/runs.ts`, `src/dashboard/views/memory.ts`, `src/dashboard/views/config.ts`
- Selector-density drift risk: `src/dashboard/views/new-idea.ts`, `src/dashboard/views/agents.ts`



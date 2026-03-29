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
- `styles.css` now carries the real shared mobile layer: `.shared-mobile-header`, `.shared-mobile-nav`, `.mobile-detail-layout`, and `.responsive-table` are the main responsive seams for dashboard work.
- `preview.ts` includes a manual `preview-mobile` toggle, but that is a preview mode, not a substitute for real responsive behavior.
- `new-idea.ts` now uses `.idea-agent-grid` for expert-agent pinning, which is the right isolation move. Treat that as the preferred pattern when a selector grid and a content-card grid would otherwise share a class name.
- `layout.ts` now ships the mobile shell contract directly: nav toggle + `.shared-mobile-nav` + active nav state. Reuse that shell before creating page-local nav affordances.
- Mobile shell fixes should preserve a two-step contract: the header controls row must allow the nav to span its own row on phones (grid is safer than nowrap flex here), and the shell should opt into `viewport-fit=cover` with safe-area-aware padding so sticky chrome does not collide with notches or home indicators.
- Shared data tables should prefer `.responsive-table`; `config.ts` is now the reference implementation for table-to-card behavior on narrow screens.
- `article.ts`, `publish.ts`, and `preview.ts` all rely on toolbar/detail-shell patterns (`.detail-grid`, `.preview-toolbar`, `.usage-summary`) that can still behave like desktop rows even after the main column stacks.
- Real browser review can show two different classes of width behavior at once: the page body may be locked to the viewport while local components like `.tab-bar` still require horizontal swipe. Treat those as separate findings instead of declaring mobile width “fixed” too early.
- HTMX/SSE amplifies layout drift here: `renderRunsTable()`, `renderMemoryTable()`, `renderPublishWorkflow()`, and the live article partials all swap independently, so mobile structure must live in shared fragment markup/classes rather than only in full-page wrappers.
- Dashboard tests may assert mobile hook classes without any stylesheet selector for those hooks. In that case the suite is only protecting structural intent; pair hook assertions with `styles.css` checks on the selectors that actually drive the breakpoint behavior.
- Inline layout styles in shared dashboard views are another warning sign. If `home.ts`, `publish.ts`, `login.ts`, or `article.ts` need repeated `style="..."` layout tweaks, the system is missing a reusable shell/action primitive and mobile work should extract that first.

## Recommendation

Treat mobile dashboard work in this repo as a system task: extend the shared shell, shared action/data primitives, and HTMX fragment contracts together. Ship in this order: shell/navigation, shared mobile primitives, fragment contracts, then page-specific follow-through. If the same class or markup pattern appears on more than one page, establish a shared responsive component instead of patching one route at a time.

## Current examples

- Shell/nav: `src/dashboard/views/layout.ts`, `src/dashboard/public/styles.css`
- Detail/preview stack: `src/dashboard/views/article.ts`, `src/dashboard/views/publish.ts`, `src/dashboard/views/preview.ts`
- Dense data surfaces: `src/dashboard/views/runs.ts`, `src/dashboard/views/memory.ts`, `src/dashboard/views/config.ts`
- Selector-density drift risk: `src/dashboard/views/new-idea.ts`, `src/dashboard/views/agents.ts`

## Implementation notes

- Use `.mobile-detail-layout` with `.mobile-primary-column` / `.mobile-secondary-column` for phone-only reordering instead of duplicating article/publish markup.
- Use `.responsive-table` plus `data-label` cells to turn operational tables into stacked mobile cards.
- Keep selector namespaces distinct when a chip-picker grid and a content-card grid need different responsive behavior; for example, `.idea-agent-grid` and `.agents-directory-grid`.
- When the mobile hamburger/nav is part of the shared shell, regression coverage should protect both markup and behavior: unit tests should assert the layout script toggles `aria-expanded`/`.is-open`, stylesheet tests should assert the nav spans the full mobile row, and viewport review scripts should verify the opened nav sits below the control row and stays inside the viewport.
- When article/detail surfaces still blow out the viewport after the layout stacks, patch the shared primitives before touching page markup: add `min-width: 0` to shell/card/detail wrappers, add `overflow-wrap: anywhere` to long-text containers, and make markdown tables inside `.artifact-rendered` scroll inside the pane instead of widening the page.
- If a component avoids page overflow only by turning into a wide horizontal scroller (for example, article artifact pills in `.tab-bar`), treat that as a separate mobile UX debt item. The premium fix is usually a stronger information hierarchy (top 1–2 tabs visible, “More”/disclosure, segmented control, or stacked section nav), not just more overflow suppression.
- When dashboard auth is enabled, browser review scripts must authenticate before auditing protected routes. Otherwise the run mostly validates `/login` redirects and misses the actual dashboard, article, publish, and trace surfaces.
- In this repo, a premium mobile nav should own its own row or sheet on phones. If `.shared-mobile-nav` is still constrained by `.header-controls`, expect a cramped right-aligned menu even if it technically stays inside the viewport.

## Mobile UX Maturity (as of 2026-03-30)

**Foundation (complete):** The dashboard has solid mobile infrastructure from the 2026-03-30 Playwright modernization:
- `html/body/site-header { overflow-x: hidden }` prevents viewport blowout
- `.shared-mobile-header`, `.shared-mobile-nav`, `.nav-toggle` with proper aria/keyboard/close-on-click behavior
- Responsive breakpoints at 767px, 640px, 480px, 420px with grid collapses
- `.responsive-table` stacks tables as cards on mobile
- Safe-area awareness: header/footer use `env(safe-area-inset-*)`
- Button tap targets: `.btn { min-height: 44px; min-width: 44px }`

**Remaining work (design refinement, not foundation fixes):**
1. **Article content width overflow risk:** `.artifact-rendered` markdown containers need aggressive word-break rules and markdown table overflow handling to prevent long URLs, code identifiers, and wide tables from blowing out the viewport.
2. **Hamburger/nav interaction polish:** Nav toggle uses text glyph "☰" instead of proper icon; opened nav lacks visual drawer affordance (no backdrop, no elevation, no animation); nav link sizing is too compact for mobile editorial use.
3. **Premium editorial restyle:** Dashboard reads as "AI app template" instead of "premium editorial product" — needs editorial typography (serif headlines), editorial color system (NFL brand colors), confident visual hierarchy (bold CTAs, larger headlines, breathing room).

**Code-based mobile audits:** Code review is useful for spotting likely failure points, but browser review remains necessary for final confidence. Existing Playwright infrastructure at `tests/ux-playwright-review.ts` is only trustworthy after it authenticates (or the app starts with auth disabled), otherwise protected-route audits collapse into `/login` validation.




## 2026-03-25T03:30:39Z — Dashboard Mobile Audit Session (UX Audit)

**Orchestration log:** .squad/orchestration-log/2026-03-25T03-30-39Z-ux.md  
**Session log:** .squad/log/2026-03-25T03-30-39Z-dashboard-mobile-audit.md

**Status:** ✓ Completed — system-level audit findings documented

**Three-agent audit findings (UX):**
- Shell-level failures: sticky header, primary nav (.header-nav), page layout collapse inconsistently across breakpoints
- Repeated patterns: same data-table, action-group, filter patterns used across multiple pages with no centralized mobile contract
- HTMX fragment mismatch: swapped content from partial renders doesn't inherit shell mobile behavior; needs wrapper scoping
- Mobile-unsafe selectors: .agent-grid overloaded; .card-actions, .quick-actions, .preview-toolbar lack stacking/wrapping rules
- Test gap: current dashboard tests focus on route/copy validation; no viewport-specific assertions for mobile hooks or fragment structure

**Recommended approach:** Treat dashboard mobile work as a **shared-system change**, not page-by-page cleanup.

## Learnings

- 2026-03-27 — Dashboard mobile rework shipped as a shared-system pass instead of page-by-page hacks. The stable pattern is: compact scrollable header nav in `src/dashboard/views/layout.ts`, responsive table-to-card transforms via `.responsive-table` in `src/dashboard/public/styles.css`, and mobile ordering handled by shared detail-layout hooks (`.mobile-detail-layout`, `.mobile-primary-column`, `.mobile-secondary-column`) so article detail can keep artifacts first while publish moves workflow/status ahead of preview on phones.
- 2026-03-27 — The old `.agent-grid` collision is now avoided by keeping the New Idea picker on `.idea-agent-grid` and the Agents directory on `.agents-directory-grid`. Future dashboard/mobile work should avoid reusing selector names across chip pickers and card grids because the responsive layer is global.
- 2026-03-27 — **Dashboard mobile implementation shipped**: `src/dashboard/views/layout.ts` and `src/dashboard/public/styles.css` now carry the real mobile system behind the shared hook classes: compact scrollable nav, tighter phone spacing, 44px tap targets, stacked action/filter/composer rows, responsive table/card treatment, and explicit article/publish column ordering. Supporting markup updates live in `src/dashboard/views/{article,config,home,login,memory,new-idea,preview,publish,runs}.ts`, with focused coverage in `tests/dashboard/{server,new-idea,publish,runs}.test.ts`.
- 2026-03-27 — **Dashboard mobile audit refresh (system contract)**: mobile hook classes now exist in markup (`shared-mobile-header`, `shared-mobile-nav`, `mobile-detail-layout`, `mobile-primary-column`, `mobile-secondary-column`, `publish-workflow-actions`, `idea-agent-grid`), and focused tests in `tests/dashboard/{server,runs,publish,new-idea}.test.ts` assert those hooks. But `src/dashboard/public/styles.css` still has no selectors for most of those hook classes, so the tests currently protect structural intent more than actual responsive behavior. Future mobile work should pair hook-class assertions with shared CSS rules and should move inline layout styles in `home.ts`, `publish.ts`, `login.ts`, and `article.ts` into reusable shell/action primitives before patching individual pages.
- 2026-03-26 — Shared mobile hook classes now exist in markup/tests, but not in the stylesheet. `src/dashboard/views/layout.ts` renders `shared-mobile-header`, `shared-mobile-nav`, `header-nav-link`, and `header-env-badge`; `src/dashboard/views/article.ts` and `publish.ts` render `mobile-detail-layout`, `mobile-primary-column`, and `mobile-secondary-column`; `tests/dashboard/server.test.ts`, `publish.test.ts`, and `runs.test.ts` assert those hooks. `src/dashboard/public/styles.css` has no matching selectors, so current tests protect mobile intent only, not actual narrow-screen behavior.
- 2026-03-26 — Cross-page mobile drift is being driven by shared desktop-first primitives rather than isolated pages: `.site-header`/`.header-inner`/`.btn-header`, `.detail-grid`, `.action-bar`, `.filter-bar`, `.artifact-table`, `.runs-table`, `.memory-table`, `.preview-toolbar`, `.team-grid`, and `.agent-badge` all stay dense or row-oriented on phones. The strongest risks are fixed header crowding, table-only data surfaces, inline-style action rows, and tap targets under 44px in `src/dashboard/public/styles.css`.
- 2026-03-26 — Preview and publish mobile behavior are not the same thing in this repo. `src/dashboard/views/preview.ts` uses a manual `preview-mobile` class toggle to simulate a 375px Substack viewport, while the real page shell still depends on `renderLayout()` and shared CSS. Treat the preview toggle as a content simulation tool, not proof that the surrounding dashboard page works on a phone.
- 2026-03-26 — Several dashboard pages use unscoped or missing style contracts that are easy to mistake for completed mobile work: `runs.ts` uses `.page-header` and `.runs-filter-bar`, `publish.ts` uses `.publish-detail-header`, `.article-preview`, `.status-info`, and `.publish-workflow-actions`, and `login.ts` uses `.publisher-form`, but those selectors are absent from `src/dashboard/public/styles.css`. Future mobile fixes should reconcile class contracts before adding more breakpoint rules.




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

- 2026-03-26 — Shared mobile hook classes now exist in markup/tests, but not in the stylesheet. `src/dashboard/views/layout.ts` renders `shared-mobile-header`, `shared-mobile-nav`, `header-nav-link`, and `header-env-badge`; `src/dashboard/views/article.ts` and `publish.ts` render `mobile-detail-layout`, `mobile-primary-column`, and `mobile-secondary-column`; `tests/dashboard/server.test.ts`, `publish.test.ts`, and `runs.test.ts` assert those hooks. `src/dashboard/public/styles.css` has no matching selectors, so current tests protect mobile intent only, not actual narrow-screen behavior.
- 2026-03-26 — Cross-page mobile drift is being driven by shared desktop-first primitives rather than isolated pages: `.site-header`/`.header-inner`/`.btn-header`, `.detail-grid`, `.action-bar`, `.filter-bar`, `.artifact-table`, `.runs-table`, `.memory-table`, `.preview-toolbar`, `.team-grid`, and `.agent-badge` all stay dense or row-oriented on phones. The strongest risks are fixed header crowding, table-only data surfaces, inline-style action rows, and tap targets under 44px in `src/dashboard/public/styles.css`.
- 2026-03-26 — Preview and publish mobile behavior are not the same thing in this repo. `src/dashboard/views/preview.ts` uses a manual `preview-mobile` class toggle to simulate a 375px Substack viewport, while the real page shell still depends on `renderLayout()` and shared CSS. Treat the preview toggle as a content simulation tool, not proof that the surrounding dashboard page works on a phone.
- 2026-03-26 — Several dashboard pages use unscoped or missing style contracts that are easy to mistake for completed mobile work: `runs.ts` uses `.page-header` and `.runs-filter-bar`, `publish.ts` uses `.publish-detail-header`, `.article-preview`, `.status-info`, and `.publish-workflow-actions`, and `login.ts` uses `.publisher-form`, but those selectors are absent from `src/dashboard/public/styles.css`. Future mobile fixes should reconcile class contracts before adding more breakpoint rules.

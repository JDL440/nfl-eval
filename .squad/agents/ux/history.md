## 2026-03-27T07:30:00Z — V3 Revision-State UX Pass & Mobile Width Fix Implementation

**Orchestration log:** .squad/orchestration-log/2026-03-27T07-30-00Z-ux.md  
**Session log:** .squad/log/2026-03-27T07-30-00Z-v3-workflow-simplify.md

**Status:** ✓ Completed — Revision-state UX simplification and mobile width fix shipped in worktrees/V3

**Article-Detail View Simplification:**
- Canonical current-stage display as primary focus
- Advanced-only stage runs (collapsed by default)
- Latest failed-attempt summary only (removed historical clutter)

**Mobile Width Fix Implementation:**
- Root cause: intrinsic content (image-gallery minmax(280px, 1fr)) expands beyond ~320px phone width
- CSS applied to .detail-grid, .detail-main, .detail-sidebar (min-width: 0)
- .artifact-table now scrolls horizontally instead of pushing viewport
- Padding tightened at 768px breakpoint

**Revision Display Alignment:**
- Revision history now supports compact display (collapsed by default)
- Latest blocker summary only (UX-aligned with simplification goal)
- Escalation metadata preserved for lead-review indication

**Dashboard Mobile Audit Integration:**
- Article-detail view aligns with shared mobile contract (no per-page workarounds)
- Revision display respects mobile-safe selectors and fragment scoping
- HTMX partial-render behavior validated with wrapper scoping

**Files Modified (worktrees/V3):**
- src/dashboard/views/article.ts (mobile CSS + revision display)
- src/dashboard/public/styles.css (grid overflow handling, mobile padding)
- tests/dashboard/wave2.test.ts (mobile viewport validation)
- tests/dashboard/publish.test.ts (revision display and escalation tests)

**Test Validation:**
- Dashboard mobile tests passing (viewport-specific assertions)
- Article-detail view rendering correctly on 320px–768px–1024px breakpoints
- Revision summary and escalation metadata preserved in test assertions

**Decisions Implemented:**
- Article Mobile Width Fix (min-width: 0 on grids, overflow-x: auto)
- Revision-State UX Pass (collapsed revisions, canonical stage display)
- Dashboard Mobile Audit Findings (system-level approach, not page-by-page)

---

## 2026-03-25T06:26:29Z — Mobile Width Fix Proposal

**Orchestration log:** .squad/orchestration-log/2026-03-25T06-26-29Z-ux.md  
**Session log:** .squad/log/2026-03-25T06-26-29Z-mobile-and-preflight-hardening.md

**Status:** ✓ Completed — Mobile overflow root cause identified and CSS fix proposed

**Finding:**
- Article-detail mobile horizontal overflow traced to CSS grid children (.detail-grid, .detail-main, .detail-sidebar) missing min-width: 0.
- Intrinsic content (.image-gallery with minmax(280px, 1fr)) expands beyond usable width on ~320px phones.

**CSS Fix (minimal scope):**
- Add min-width: 0 to grid containers to enable content shrinking.
- Change .artifact-table to display: block; overflow-x: auto (horizontal scroll instead of viewport push).
- Tighten padding at 768px breakpoint.

**Decision:** [Article Mobile Width Fix](../../decisions.md)

---
## 2026-03-25T05-51-20Z — Option B Article-Page Simplification Review

**Orchestration log:** .squad/orchestration-log/2026-03-25T05-51-20Z-ux.md  
**Session log:** .squad/log/2026-03-25T05-51-20Z-option-b-article-plan.md

**Status:** ✓ Completed — Article-page simplification approved

**Recommended approach:**
- Canonical current-stage display as primary.
- Advanced-only stage runs.
- Collapsed revisions.
- Latest failed-attempt summary only.

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

- 2026-03-28 — Finalized the V3 revision workspace copy around the draft-first scan path. In `worktrees\V3\src\dashboard\views\article.ts`, Stage 4 + `status='revision'` now stays consistently framed as `Revision Workspace`, the workflow line reads `Draft revision in progress · Next: Article Drafting`, revision tabs emphasize `Working Draft` and `Editor Feedback` before `Background Context`, and the lead-review send-back hint uses the same wording. Focused regression coverage lives in `worktrees\V3\tests\dashboard\server.test.ts`; `worktrees\V3\tests\dashboard\wave2.test.ts` still guards the earlier mobile-safe article gallery behavior, and `npm run v2:build` is currently blocked by an unrelated existing TypeScript error in `worktrees\V3\src\pipeline\actions.ts`.
- 2026-03-28 — V3 revision-state simplification should stay draft-first even when the canonical stage remains 4. In `worktrees\V3\src\dashboard\views\article.ts`, treat `current_stage === 4 && status === 'revision'` as a `Revision Workspace`, alias the stage timeline/pipeline label away from `Panel Discussion`, and order artifact tabs as `draft.md` → `editor-review.md` → `discussion-summary.md` with a short hint explaining that background context is secondary. Keep the earlier mobile-width hardening in `worktrees\V3\src\dashboard\public\styles.css` intact, and protect the behavior with focused assertions in `worktrees\V3\tests\dashboard\server.test.ts` plus the mobile-safe gallery check in `worktrees\V3\tests\dashboard\wave2.test.ts`.
- 2026-03-25 — Article detail Option B landed as a hierarchy pass, not a redesign: `src/dashboard/views/article.ts` now makes the top `Current stage` block + status line the primary state surface, collapses revision history behind a summary disclosure, and moves Stage Runs into Advanced while keeping only one failed-attempt summary in the action card. Supporting CSS lives in `src/dashboard/public/styles.css`, and focused coverage sits in `tests/dashboard/{server,publish}.test.ts` plus `tests/dashboard/{runs,wave2}.test.ts`.
- 2026-03-27 — Dashboard mobile rework shipped as a shared-system pass instead of page-by-page hacks. The stable pattern is: compact scrollable header nav in `src/dashboard/views/layout.ts`, responsive table-to-card transforms via `.responsive-table` in `src/dashboard/public/styles.css`, and mobile ordering handled by shared detail-layout hooks (`.mobile-detail-layout`, `.mobile-primary-column`, `.mobile-secondary-column`) so article detail can keep artifacts first while publish moves workflow/status ahead of preview on phones.
- 2026-03-27 — The old `.agent-grid` collision is now avoided by keeping the New Idea picker on `.idea-agent-grid` and the Agents directory on `.agents-directory-grid`. Future dashboard/mobile work should avoid reusing selector names across chip pickers and card grids because the responsive layer is global.
- 2026-03-27 — **Dashboard mobile implementation shipped**: `src/dashboard/views/layout.ts` and `src/dashboard/public/styles.css` now carry the real mobile system behind the shared hook classes: compact scrollable nav, tighter phone spacing, 44px tap targets, stacked action/filter/composer rows, responsive table/card treatment, and explicit article/publish column ordering. Supporting markup updates live in `src/dashboard/views/{article,config,home,login,memory,new-idea,preview,publish,runs}.ts`, with focused coverage in `tests/dashboard/{server,new-idea,publish,runs}.test.ts`.
- 2026-03-27 — **Dashboard mobile audit refresh (system contract)**: mobile hook classes now exist in markup (`shared-mobile-header`, `shared-mobile-nav`, `mobile-detail-layout`, `mobile-primary-column`, `mobile-secondary-column`, `publish-workflow-actions`, `idea-agent-grid`), and focused tests in `tests/dashboard/{server,runs,publish,new-idea}.test.ts` assert those hooks. But `src/dashboard/public/styles.css` still has no selectors for most of those hook classes, so the tests currently protect structural intent more than actual responsive behavior. Future mobile work should pair hook-class assertions with shared CSS rules and should move inline layout styles in `home.ts`, `publish.ts`, `login.ts`, and `article.ts` into reusable shell/action primitives before patching individual pages.
- 2026-03-26 — Shared mobile hook classes now exist in markup/tests, but not in the stylesheet. `src/dashboard/views/layout.ts` renders `shared-mobile-header`, `shared-mobile-nav`, `header-nav-link`, and `header-env-badge`; `src/dashboard/views/article.ts` and `publish.ts` render `mobile-detail-layout`, `mobile-primary-column`, and `mobile-secondary-column`; `tests/dashboard/server.test.ts`, `publish.test.ts`, and `runs.test.ts` assert those hooks. `src/dashboard/public/styles.css` has no matching selectors, so current tests protect mobile intent only, not actual narrow-screen behavior.
- 2026-03-26 — Cross-page mobile drift is being driven by shared desktop-first primitives rather than isolated pages: `.site-header`/`.header-inner`/`.btn-header`, `.detail-grid`, `.action-bar`, `.filter-bar`, `.artifact-table`, `.runs-table`, `.memory-table`, `.preview-toolbar`, `.team-grid`, and `.agent-badge` all stay dense or row-oriented on phones. The strongest risks are fixed header crowding, table-only data surfaces, inline-style action rows, and tap targets under 44px in `src/dashboard/public/styles.css`.
- 2026-03-26 — Preview and publish mobile behavior are not the same thing in this repo. `src/dashboard/views/preview.ts` uses a manual `preview-mobile` class toggle to simulate a 375px Substack viewport, while the real page shell still depends on `renderLayout()` and shared CSS. Treat the preview toggle as a content simulation tool, not proof that the surrounding dashboard page works on a phone.
- 2026-03-26 — Several dashboard pages use unscoped or missing style contracts that are easy to mistake for completed mobile work: `runs.ts` uses `.page-header` and `.runs-filter-bar`, `publish.ts` uses `.publish-detail-header`, `.article-preview`, `.status-info`, and `.publish-workflow-actions`, and `login.ts` uses `.publisher-form`, but those selectors are absent from `src/dashboard/public/styles.css`. Future mobile fixes should reconcile class contracts before adding more breakpoint rules.
- 2026-03-27 — **Article mobile width fix**: Added `min-width: 0` to `.detail-grid`, `.detail-main`, `.detail-sidebar`, and `.detail-section` in `src/dashboard/public/styles.css` to prevent grid blowout on narrow screens. Also added `overflow: hidden` on `.detail-section`, `overflow-wrap: break-word` on `.artifact-rendered`, and `display: block; overflow-x: auto` on `.artifact-table` so tables scroll horizontally instead of pushing the viewport. Mobile breakpoint now also tightens `.content` and `.detail-section` padding. This is a CSS-only fix with no markup changes in `article.ts`.
- 2026-03-27 — **Revision send-back UX fix**: Fixed misleading article-detail UX when editor REVISE verdict sends article back to stage 4. Changed `renderArtifactTabs()` default tab logic to show `draft.md` (the artifact that needs work) instead of discussion artifacts when `article.status === 'revision'`. Also updated workflow status line from "Revision requested" to "Draft revision in progress" to clarify what needs attention. Minimal safe change with focused test in `tests/dashboard/server.test.ts`.
- 2026-03-27 — **Revision workspace simplification**: The stable V3 article-detail pattern is now draft-first whenever Stage 4 carries `status='revision'`: `src/dashboard/views/article.ts` aliases stage/tooltips/header copy to `Revision Workspace`, keeps the workflow sentence explicit (`Draft revision in progress · Next: Article Drafting`), orders artifact tabs as draft → editor feedback → discussion context, and uses revision-specific helper copy plus a `Resume Drafting` CTA so the page reads like patching a draft instead of re-running discussion. Supporting UI styling lives in `src/dashboard/public/styles.css`, and focused coverage remains in `tests/dashboard/server.test.ts` while `tests/dashboard/wave2.test.ts` continues protecting the earlier mobile-safe gallery clamp.




## 2026-03-25T07:15:45Z — Frontend-Only V3 Revision-State Simplification Review

**Orchestration log:** .squad/orchestration-log/2026-03-25T07-15-45Z-ux.md  
**Session log:** .squad/log/2026-03-25T07-15-45Z-v3-revision-ux-plan.md

**Status:** ✓ Completed — Frontend review and plan finalized

**Surface reviewed:**
- article.ts
- styles.css
- server.test.ts
- wave2.test.ts
- Research memo guidance

**Outcome:** Concise no-edit plan preserving dirty Stage 4/Stage 6 wording changes, artifact priority, and mobile-safe CSS behavior ready for Code team implementation.


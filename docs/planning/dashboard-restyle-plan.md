# Premium Editorial Dashboard Restyle — Implementation Plan

**Goal:** Transform the dashboard from "generic AI template" to "premium NFL editorial control room" across 3 phases, with no functional changes — CSS + minimal markup only.

**Constraint:** No production code logic changes. CSS variables, style rules, and one `<div>` addition in layout.ts.

**Reviewed by:** GPT 5.4 (2026-04-01). 5 blockers identified and incorporated below.

---

## Approach

The preview page already proves the editorial pattern works (Georgia serif, 1.75 line-height, bold headlines). We extend that to the entire dashboard shell in 3 phases ordered by risk: overflow safety → nav interaction → visual identity.

**Files touched:** `styles.css`, `layout.ts`
**Validation:** `npm run v2:build` + `npm run v2:test` + manual viewport check at 375/768/1280px

---

## Phase 1 — Content Width Overflow Polish

> ⚠️ **Review finding:** Current `min-width: 100%` may already handle the table case correctly. Need a real reproduction before changing. The scroll-hint gradient also needs Safari/iOS verification.

**Todo: reproduce-table-overflow**
Before making any CSS change, reproduce the actual overflow: load an article with a markdown table that fits within 375px viewport. Screenshot. If the table scrolls needlessly, proceed with fix. If it doesn't, skip `fix-table-overflow` and close it.
File: Manual test in browser

**Todo: fix-table-overflow** *(conditional — only if reproduction confirms the bug)*
Change `.artifact-rendered table` from `width: max-content` to `width: 100%; max-width: max-content`. Verify narrow tables don't shrink unexpectedly.
File: `src/dashboard/public/styles.css` lines ~3187-3195

**Todo: add-scroll-hint** *(conditional — needs Safari verification)*
Add subtle shadow gradient to scrollable tables via `background-attachment: local/scroll` trick. Test on Safari/iOS before shipping — fragile on `display: block` tables.
File: `src/dashboard/public/styles.css`

---

## Phase 2 — Nav Drawer UX

> ⚠️ **Review findings:** (1) Animation MUST be scoped to `@media (max-width: 767px)` only — desktop nav is always visible and never gets `.is-open`. (2) Hidden nav links remain keyboard-tabbable with opacity:0 — need `aria-hidden`/`inert` toggle. (3) Backdrop z-index must not cover header controls.

**Todo: add-nav-backdrop**
Add `<div id="nav-backdrop" class="nav-backdrop">` after `</nav>` in layout.ts. Style as fixed overlay with `inset: 0; top: 72px` (below header, not covering it). `z-index: 29` is safe because it's below nav (30) and below header (100). Toggle display via `body.nav-open` class.
Files: `src/dashboard/views/layout.ts` lines 67+, `src/dashboard/public/styles.css`

**Backdrop layering fix:** Use `top: 72px` (header height) instead of `inset: 0` so backdrop never covers the header row. This means the header controls (Menu button, theme toggle) remain clickable while the backdrop is open.

**Todo: animate-nav-drawer**
**MOBILE ONLY** — Inside `@media (max-width: 767px)` only. Replace `display: none/flex` with `opacity: 0; transform: translateY(-12px); pointer-events: none` when closed, reverse when `.is-open`. Desktop `.shared-mobile-nav` is unaffected (stays `display: flex` always).
File: `src/dashboard/public/styles.css` lines ~3559-3580

**Todo: nav-a11y-hidden-state** *(new — from review)*
Update nav toggle JS in layout.ts to set `aria-hidden="true"` and `inert` attribute on `#primary-nav` when closed, remove both when opened. This prevents keyboard/screen-reader access to hidden nav links. Also toggle `aria-hidden` on `#nav-backdrop`.
File: `src/dashboard/views/layout.ts` lines 109-142

**Todo: enlarge-nav-links**
Inside `@media (max-width: 767px)`: increase font-size 0.85→1rem, padding 0.65→0.9rem, border-radius 14px. Active state gets bolder treatment.
File: `src/dashboard/public/styles.css`

**Todo: add-reduced-motion** *(new — from review)*
Add `@media (prefers-reduced-motion: reduce)` block that disables all transitions/animations added in this plan: nav drawer slide, card hover lift, button hover transform. Set `transition: none !important` for affected selectors.
File: `src/dashboard/public/styles.css` — new block at end of file

---

## Phase 3 — Editorial Typography, Color & Spacing

> ⚠️ **Review findings:** (1) `--color-accent` is used everywhere — dozens of hard-coded blues outside the token system too. Need token audit first. (2) Active nav on NFL blue header will be invisible if both are dark blue — use lighter accent or red for active state. (3) Button radius change must be scoped — icon buttons and badges stay pill. (4) Dark theme needs explicit token map for all new variables.

### 3a. Token Audit *(new — from review)*

**Todo: audit-color-tokens**
Before changing any colors: grep `styles.css` for all hard-coded blue values (`#3b82f6`, `#2563eb`, `#1d4ed8`, `#dbeafe`, `rgba(59, 130, 246`) and all uses of `--color-accent`. Produce a checklist of every occurrence. Classify each as: (a) should use new accent token, (b) should stay blue (info/link semantic), (c) hard-coded — must be updated manually. This prevents a mixed palette after the token swap.
File: `src/dashboard/public/styles.css` — full audit

### 3b. Typography

**Todo: add-editorial-font-vars**
Add to `:root`: `--font-headline: Georgia, 'Times New Roman', serif`, `--line-height-body: 1.6`, `--line-height-heading: 1.15`, `--letter-spacing-heading: -0.025em`. Keep `--font-sans` for body/UI text. These are theme-independent (same in light and dark).
File: `src/dashboard/public/styles.css` lines 1-31

**Todo: apply-serif-headlines**
Apply `--font-headline` to all h1/h2 selectors, `.article-title`, `.section-kicker`. Bump h1 from `clamp(1.65rem, 4vw, 2.35rem)` to `clamp(1.85rem, 4.5vw, 2.75rem)`, weight to 800. Bump body line-height to 1.6. Place rules after the UX modernization block (~line 2471) to win specificity.
File: `src/dashboard/public/styles.css` lines ~2704-2714

### 3c. Color

**Todo: add-nfl-color-vars**
Add to `:root`:
- `--nfl-blue: #013369`
- `--nfl-red: #D50A0A`
- `--color-accent: #1a5276` (replaces `#3b82f6`)
- `--color-accent-hover: #013369`
- `--color-editorial-cta: #C8102E`
- `--color-editorial-cta-hover: #D50A0A`
- `--color-nav-active: #e2e8f0` (light text/bg for active nav on dark header — avoids invisible dark-on-dark)

Add to BOTH `@media (prefers-color-scheme: dark)` AND `[data-theme="dark"]`:
- `--color-accent: #4a9eda`
- `--color-accent-hover: #6bb3e8`
- `--color-editorial-cta: #ef4444` (lighter red on dark surfaces)
- `--color-editorial-cta-hover: #f87171`
- `--color-nav-active: rgba(255,255,255,0.2)`

File: `src/dashboard/public/styles.css` `:root` + both dark blocks

**Todo: restyle-header-nfl-blue**
Change `.shared-mobile-header` background from `rgba(15, 23, 42, 0.92)` to `rgba(1, 51, 105, 0.95)`. Update hero gradients. Change `.header-nav-link.is-active` to use `--color-nav-active` background (not `--color-accent`) so active state is visible against NFL blue header.
File: `src/dashboard/public/styles.css` lines ~2516-2520, ~2617-2619, ~2843-2849

**Todo: fix-hardcoded-blues** *(depends on audit-color-tokens)*
Update all hard-coded blue values identified in the audit that should use the new tokens. Skip values that are semantically "info blue" (badges, trace pills) — those stay blue intentionally.
File: `src/dashboard/public/styles.css` — multiple locations

### 3d. Spacing

**Todo: increase-spacing**
Content gaps 1→1.25rem, section padding `clamp(1rem, 2.5vw, 1.4rem)` → `clamp(1.25rem, 3vw, 1.75rem)`, card padding 1rem 1.05rem → 1.15rem 1.25rem, section heading margin 1rem → 1.25rem.
File: `src/dashboard/public/styles.css` — UX modernization section

### 3e. Buttons

**Todo: restyle-cta-buttons**
**Scoped radius change** — only `.btn-primary`, `.btn-success`, `.btn-secondary` get `border-radius: 10px`. Icon buttons (`.btn-icon`, `.icon-button`), nav header buttons (`.btn-header`), badges, and pills stay `border-radius: 999px`.
Primary/success: bg → `--color-editorial-cta`, weight → 700, `box-shadow` + hover lift.
File: `src/dashboard/public/styles.css`

### 3f. Micro-interactions

**Todo: add-card-hover-effects**
Add `transition: transform 0.15s, box-shadow 0.15s` to `.article-card`. Hover: `translateY(-2px)` + shadow. Stage-colored left border using existing classes: `.card-ready` = red border, `.card-published` = green border (no need for `data-stage` attribute — classes already exist in `home.ts`).
File: `src/dashboard/public/styles.css`

---

## Dependency Order

```
Phase 1 (standalone)
  reproduce-table-overflow
  fix-table-overflow → depends on reproduce-table-overflow (conditional)
  add-scroll-hint → depends on reproduce-table-overflow (conditional)

Phase 2 (standalone — parallel with Phase 1)
  add-nav-backdrop
  nav-a11y-hidden-state → depends on add-nav-backdrop
  animate-nav-drawer → depends on add-nav-backdrop
  enlarge-nav-links
  add-reduced-motion → after all Phase 2 transitions added

Phase 3 (after Phase 2 for visual coherence)
  Step 1: audit-color-tokens (prerequisite for all color work)
  Step 2: add-editorial-font-vars + add-nfl-color-vars (parallel)
  Step 3: apply-serif-headlines + restyle-header-nfl-blue + fix-hardcoded-blues (parallel, consume tokens)
  Step 4: increase-spacing + restyle-cta-buttons (parallel)
  Step 5: add-card-hover-effects (last)
```

---

## Validation

After each phase:
1. `npm run v2:build` — TypeScript compile (layout.ts changes in Phase 2)
2. `npm run v2:test` — Full test suite
3. Manual viewport check: 375px (iPhone SE), 768px (iPad), 1280px (desktop)
4. Verify no horizontal page scroll on article detail with long URLs/tables
5. *(Phase 2)* Verify nav is keyboard-inaccessible when closed, accessible when open
6. *(Phase 2)* Verify backdrop doesn't cover header controls (Menu button clickable while nav open)
7. *(Phase 3)* Verify active nav link visible against NFL blue header
8. *(Phase 3)* Verify CTA red vs danger red are visually distinct
9. *(Phase 3)* Test with `prefers-reduced-motion: reduce` enabled — no animations

---

## Review Findings Incorporated

| # | GPT 5.4 Finding | Resolution |
|---|-----------------|------------|
| 1 | Nav animation applied globally hides desktop nav | Scoped to `@media (max-width: 767px)` only |
| 2 | Hidden nav links keyboard-tabbable | Added `nav-a11y-hidden-state` todo: `aria-hidden` + `inert` |
| 3 | Backdrop z-index covers header controls | Changed to `top: 72px` (below header) |
| 4 | `--color-accent` swap too broad, hard-coded blues remain | Added `audit-color-tokens` prerequisite + `fix-hardcoded-blues` |
| 5 | Table width fix may not be needed | Added `reproduce-table-overflow` gating step |
| 6 | Active nav invisible on NFL blue header | Added `--color-nav-active` token (light on dark) |
| 7 | Button radius too broad | Scoped to `.btn-primary`/`.btn-success`/`.btn-secondary` only |
| 8 | Dark theme incomplete | Explicit token list for both dark blocks |
| 9 | No `prefers-reduced-motion` | Added `add-reduced-motion` todo |
| 10 | `data-stage` unnecessary | Using existing `.card-ready`/`.card-published` classes |

---

## Estimated Effort

| Phase | Todos | Lines Changed | Time |
|-------|-------|--------------|------|
| Phase 1 | 3 (1 conditional) | ~10 | 1-2 hours |
| Phase 2 | 5 | ~70 | 3-5 hours |
| Phase 3 | 8 | ~150 | 10-18 hours |
| **Total** | **16** | **~230** | **14-25 hours** |

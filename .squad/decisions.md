# Active Decisions

- **Code: File-write audit — hardcoded script paths** (2026-03-31): Complete audit of file write operations in the pipeline revealed that most writes are safe (DB-backed artifacts, config-resolved paths), but Python data script paths are hardcoded to `process.cwd()/content/data`, which breaks NFL_DATA_DIR isolation when running in PROD from a different working directory. Impact: fact-check, roster validation, stat validation, and data service all break in PROD when CWD ≠ repo root. See code-scriptsdir-config decision for the fix.

- **Code: scriptsDir config for Python data scripts** (2026-03-31): Added `scriptsDir: string` to AppConfig. Resolved from `NFL_SCRIPTS_DIR` env var with fallback to `join(process.cwd(), 'content', 'data')`. Deliberately separate from `dataDir` — Python scripts are source assets in the repo checkout, not user data in `~/.nfl-lab`. Files changed: `src/config/index.ts`, `src/pipeline/fact-check-context.ts`, `src/pipeline/roster-context.ts`, `src/pipeline/validators.ts`, `src/services/data.ts`, `src/pipeline/actions.ts`, `src/dashboard/server.ts`. Build passes, 144 tests pass. Prod setup: Set `NFL_SCRIPTS_DIR=C:\github\nfl-eval\content\data` in NSSM.

- **Code UX: Four-phase content-page pass** (2026-03-30): Keep shared dashboard shell frozen; solve remaining mobile/content issues inside route-local article, publish, and trace surfaces. Don't reopen `layout.ts` or generic nav/header work. Phase 1: Article mobile containment (word-break, table overflow). Phase 2: Publish workflow hierarchy (button sizing, action density). Phase 3: Trace readability polish (spacing, badge hierarchy). Phase 4: Editorial restyle (deferred). Uses route-local artifact hooks + stronger wrapping rather than shell-level redesign.

- **UX: Article page hierarchy** (2026-03-30T21:15:00Z): Treat article detail page as editorial workspace, not pipeline artifact browser. Lead with title, subtitle, workflow sentence, and primary next-step action. De-emphasize raw status chips, equal-weight trace CTAs, and debug/machine content. Reorder artifact tabs to human names and lead with most relevant artifact (draft, review, contract). Move token usage, provider breakdowns, and thinking traces to secondary diagnostics area. Collapse revision history by default. First slice: reorder artifact opening state (avoid `idea.md`), relabel tabs, move trace emphasis lower.

- **Code: Auto-advance handoff banner truthfulness** (2026-03-30): Treat new-idea → article-detail handoff as four-state operator surface: running, paused, failed, complete. Centralize in `getAutoAdvanceArticleFlash()` and check `activeAdvances` before showing completion copy. Preserve existing background launch flow and query-param handoff while preventing misleading completion state. Focused regression coverage in `tests/dashboard/new-idea.test.ts` and `tests/dashboard/server.test.ts`.

- **Code: Normalize tool-loop message envelopes** (2026-03-30): New article idea creation / auto-advance could fail with `LLM response does not match schema` when a provider returned a structured tool-loop envelope using `type: "message"` instead of the app's expected `type: "final"`. Normalize provider/tool-loop structured responses inside `src\agents\runner.ts` before schema validation, mapping compatible `message` final envelopes (and closely related tool-call aliases) onto the app's canonical `final` / `tool_call` contract. This keeps the fix surgical in app/runtime plumbing, avoids weakening unrelated schemas globally, and hardens the dashboard idea + auto-advance flows against provider/runtime contract drift without changing article artifacts or stage logic.

- **User directive: E2E test after new-idea fixes** (2026-03-30T02:23:32Z): After fixes on the new article idea flow, always do an end-to-end test by creating a new article idea on auto advance. Per user request — captured for team memory.

- **Code: Surface idea-creation trace details** (2026-03-30T19:36:30Z): Keep the new-idea success flow unchanged, but render `traceId` and `traceUrl` inside the existing failure status area when `/api/ideas` returns them. The API already preserves trace metadata for LLM/schema failures, so expose that data in the current error surface instead of introducing a broader UI redesign.

- **Blocker tag hardening** (2026-03-30): Treat an editor `REVISE` verdict without at least one valid structured `[BLOCKER type:id]` tag as an explicit contract failure instead of silently recording an unstructured revision. Repeated-blocker detection and downstream runtime reads depend on structured blocker metadata. Tighten Stage 5 editor prompt so `REVISE` explicitly requires `[BLOCKER type:id]` tags. Make `runEditor` fail loudly when a `REVISE` verdict has no parseable blocker tags. Leave the wider state machine and escalation flow unchanged.

- **Code: Blocker read-model slice** (2026-03-29T23:50:54Z): Implemented additive read-model helpers in `src\pipeline\actions.ts` with `getArticleEscalationStatus()` and `getEscalatedArticles()` exports; extended `article_get` response surface in `src\tools\pipeline-tools.ts`; added focused unit tests. Test validation: 111/111 tests passing. No changes to stage transitions, guard outcomes, or auto-advance logic. Detection remains exact-match, consecutive-only. Report detection, hold-state, and handoff-artifact presence separately per guardrails.

- **User directive: Switch coding agents to GPT-5.4** (2026-03-29T23:36:23Z): All coding agents now use GPT-5.4 per user request. Captured for team memory.

- **User directive: Reduce subagent count** (2026-03-29T23:24:34Z): Keep subagents to 5 or fewer due to rate limiting. Captured for team memory.

- **Code: Blocker read-model slice** (2026-03-29): Expose repeated-blocker escalation seams as additive read-model helpers in `src\pipeline\actions.ts`, surface via extended `article_get` response in `src\tools\pipeline-tools.ts`. No changes to stage transitions, guard outcomes, or auto-advance logic. Detection remains exact-match, consecutive-only. Report detection, hold-state, and handoff-artifact presence separately. Test coverage: 111/111 tests passing.

- **Code: Promote article-contract.md to first-class Stage 4 artifact** (2026-03-29): Added contract generation in `runDiscussion()` after discussion summary. Enhanced Stage 4→5 guard with `requireArticleContract()` + `requireDiscussionComplete()`. Kept recovery path in `writeDraft()`. Updated skill docs. All 153 tests passing. Contract generation now appears in Stage 3→4 traces, not Stage 5. One additional LLM call per article in Stage 3→4 flow (200-400 words).

- **DevOps: Stage 4 E2E fixture fix** (2026-03-29): Narrowed e2e fixtures so Stage 4+ flows include `article-contract.md` before 4→5 or later advances. Modified 4 test files (ux-happy-path, edge-cases, pipeline, full-lifecycle). Enhanced `advanceToStage()` helper to auto-write contract fixture. Fixture-only changes; no product code modified. E2E: 91/93 passing, 2 unrelated memory-storage failures.

- **Code: Next app/runtime seams after article-contract** (2026-03-29): Treat next slice as extension of existing revision-summary seam. Keep `revision_summaries` as durable routing source for blocker metadata. Keep `lead-review.md` + `needs_lead_review` for repeated-blocker hold instead of new stage. Risky couplings noted: contract generation currently Stage-5-coupled; regression cleanup doesn't classify `article-contract.md`; Publisher path not contract-aware by default. Recommend #120 read-model hardening pass for next slice.

- **App/runtime + engineering-system split** (2026-03-29T19:07:38.8847972Z): Two separate implementation streams for Anthropic harness follow-up. Stream 1 (app/runtime): src\pipeline\*, src\dashboard\server.ts, article skills (Code + Publisher + UX). Stream 2 (engineering-system): .squad/*, squad agent, ralph-watch, heartbeat workflow (Lead + Ralph + Research + DevOps).

- **UX mobile shell modernization baseline** (2026-03-29T20:19:14Z): Shell audit confirmed current shared-shell routes (/, /ideas/new, /config, /login) are behaving correctly on mobile (375x812, 768x1024, 1280x900 viewports). Do not spend Code cycles on generic shell overlap/overflow for those routes. Preserve current baseline shell contract in layout.ts, styles.css, .header-controls, .shared-mobile-nav. Focus instead on content-heavy routes not tested in live pass: artifact/markdown surfaces (.artifact-rendered table/pre), publish workflow density (.publish-workflow-actions), and traces readability (.trace-card). Premium restyle direction should bias toward quieter neutrals, stronger spacing rhythm, clearer primary/secondary action hierarchy, and less glossy chrome. Implementation order: (1) harden content-heavy routes, (2) premium visual pass, (3) revisit shell only if new regression evidence appears. Use .responsive-table as reference pattern for server-rendered mobile tables.
- **Mobile dashboard test coverage gaps** (2026-03-29T20:19:14Z): Identified 9 critical test gaps in dashboard mobile coverage: (1) hamburger toggle visibility at viewport boundaries, (2) nav close behavior (click-outside, Escape, resize), (3) responsive table mobile transformation, (4) overflow edge cases, (5) safe-area inset behavior, (6) width constraints, (7) mobile column stacking, (8) breakpoint boundary consistency, (9) nav JavaScript unit tests missing entirely. Current tests only check class/string presence; need CSS rule parsing and behavior validation. Prioritize 3 critical additions: nav toggle visibility test, table mobile transformation test, nav close behavior test.
- **UX dashboard mobile audit findings** (2026-03-30T17:00:00Z): Read-only audit identified three critical UX problems: (1) hamburger/nav interaction cramped and lacking visual drawer affordance, (2) article content (long URLs, markdown tables) risks mobile viewport overflow, (3) dashboard reads as generic AI template instead of premium NFL editorial product. Root causes traced to `.artifact-rendered` (needs word-break rules), `.shared-mobile-nav` (needs backdrop overlay and elevation), and editorial identity gap in typography/color/spacing. Implementation sequence: Phase 1 (immediate) width overflow fix in `.artifact-rendered`, Phase 2 (high priority) nav drawer UX with backdrop, Phase 3 (next sprint) premium editorial restyle for typography/color/spacing. Tests must assert mobile hooks and responsive fragment structure.
- **Mobile dashboard shared-shell restyle** (2026-03-29): Treat the live mobile dashboard shell as a shared-system problem. The shell now depends on three shared contracts: (1) `viewport-fit=cover` in dashboard HTML heads, (2) safe-area-aware spacing in `src\dashboard\public\styles.css`, (3) mobile header controls using a grid so `.shared-mobile-nav` can span a full row without overlap. Hamburger/nav row overlap risk sits above individual pages, so the fix belongs in the shared shell and gets protected by cross-route tests.
- **Dashboard mobile restyle directive** (2026-03-29T20-08-26Z): Eliminate hamburger/menu overlap and horizontal overflow on the live dashboard/mobile shell, and restyle the product toward a premium, designed app feel rather than an AI-vibe default.
- **Code UX Modernize** (2026-03-29): Implement the dashboard modernization as a shared mobile-first system first, then layer page polish on top. Shared shell primitives should own responsive header/nav behavior across live routes.
- **Copilot CLI session artifact harvest** (2026-03-29): When harvesting local Copilot CLI artifacts, read from `C:\Users\jdl44\.copilot\session-state` plus root carry-forward docs, `plan.md`, `checkpoints/*.md`, and `research/*.md`; exclude logs, caches, DBs, packaged docs, and machine config, and preserve provenance in repo-owned archive filenames.
- **Dashboard cleanup audit final** (2026-03-29T18:42:53Z): Treat `/config` (Settings) as the only remaining dashboard admin surface. Keep `/articles/:id/traces`, `/traces/:id`, and `POST /api/agents/refresh-all`. Remove/fail closed any leftover references implying retired `/agents`, `/memory`, `/runs`, `/runs/:id`, or article-detail stage-run/timeline chrome still exist. Trace observability lives on trace pages; maintenance lives on Settings; retired admin browsers do not linger through copy, tests, or dead code.

- **Dashboard article cleanup complete** (2026-03-29T11:38:22Z by Code): Removed pipeline-activity bar, stageRuns data, stageRunErrorHtml from article detail. Cleaned dead CSS. All view/test/import artifacts confirmed already removed.

- Runner traces must preserve `availableTools` and merge provider-native tool-loop calls when the app-managed loop is bypassed.

- LM Studio structured output for qwen should use `json_schema` or `text`; `json_object` is not accepted.

- Checked-out `main` should only advance through a fast-forward descendant of the validated target.

- Older detailed decision history has been archived to `.squad/decisions-archive.md`.

---

# UX Mobile Restyle — Decisions for Code

**Date:** 2026-03-30T17:00:00Z  
**Owner:** UX  
**For:** Code  
**Status:** Ready for implementation

---

## Executive Summary

Mobile UX audit completed via code review (no local server run). Dashboard has **solid mobile fundamentals** already in place via the recent Playwright-driven modernization work, but suffers from three critical UX problems:

1. **Hamburger/nav interaction is functional but cramped** — mobile header is tightly packed, nav toggle feels like an afterthought
2. **Article content surfaces have width overflow risks** — rendered markdown, code blocks, and tables can still blow out mobile viewport
3. **Dashboard feels like an AI app, not a premium editorial product** — the design uses safe utility patterns but lacks editorial polish

**Recommendation:** Implement a **premium editorial restyle** focused on breathing room, confident typography, and editorial identity before fixing overflow edge cases.

---

## Current State: What's Working

### ✅ Solid Mobile Infrastructure (from 2026-03-30 Playwright modernization)

The dashboard already has:

- **Overflow prevention primitives:** `html { overflow-x: hidden }`, `body { overflow-x: hidden }`, `.site-header { overflow-x: hidden }`
- **Mobile-first shared shell:** `.shared-mobile-header`, `.shared-mobile-nav`, `.nav-toggle` with proper aria, keyboard, and close-on-click behavior
- **Responsive breakpoints:** `@media (max-width: 767px)`, `@media (max-width: 640px)`, `@media (max-width: 480px)`
- **Mobile grid collapses:** `.dashboard-grid`, `.settings-grid`, `.meta-edit-row-2col` all stack on mobile
- **Mobile-friendly tables:** `.responsive-table` turns Settings/config tables into stacked cards with `data-label` headers
- **Safe-area awareness:** Header/footer use `env(safe-area-inset-*)` for notch/home-indicator padding
- **Button tap targets:** `.btn { min-height: 44px; min-width: 44px }` meets mobile a11y standards

**Result:** Major mobile issues: 0. The Playwright test suite already confirmed horizontal overflow was fixed.

---

## Problems Found

### 1. Header/Nav Feels Cramped and Cluttered (Moderate Issue)

**Files affected:**
- `src/dashboard/views/layout.ts` (lines 57-82)
- `src/dashboard/public/styles.css` (lines 2161-2244, 2841-2897)

**Current behavior:**
- Header packs brand + hamburger + nav + env badge + theme toggle into one row via grid layout
- On mobile (<767px), `.header-controls` becomes `grid-template-columns: auto auto` with nav spanning full width below
- Nav toggle button shows hamburger icon "☰" + "Menu" label inline
- Opened nav (`.shared-mobile-nav.is-open`) displays as stacked column

**Problems:**
- Header feels **too busy** — too many inline elements fighting for space
- Nav toggle button is **visually undersized** — hamburger icon is text glyph, not a proper icon component
- Opened nav **lacks visual hierarchy** — nav links are flat white buttons with minimal differentiation from closed state
- **No clear visual affordance** that the nav is a sheet/drawer — it just appears as stacked links

**Premium restyle direction:**

**Simplify header chrome:**
- Remove tagline ("Editorial workstation") on mobile <480px — *already done*
- Reduce env badge size further or hide on very narrow screens
- Give nav toggle breathing room: larger tap target (52px min), icon-only on narrowest screens

**Redesign hamburger/nav interaction:**
- Replace text "☰" with proper icon (SVG or better emoji sizing)
- Add visual "drawer" treatment to opened nav:
  - Backdrop overlay (semi-transparent dark layer behind nav)
  - Nav surface gets elevation (shadow + border)
  - Slide-in animation from top (or fade + scale)
- Nav links get editorial typography:
  - Larger font (1rem base instead of 0.85rem)
  - More vertical padding (1rem instead of 0.65rem)
  - Active state uses bolder visual (background fill + left border accent)

**Code actions:**
- Update `.nav-toggle` styles: larger icon, better focus state, optional label hide on <420px
- Add `.nav-backdrop` overlay element when nav is open (z-index: 99, dark semi-transparent)
- Update `.shared-mobile-nav.is-open` with card-like elevation, subtle slide-in transition
- Increase `.header-nav-link` mobile font size and padding for editorial feel

---

### 2. Article Content Width Overflow (Major Risk)

**Files affected:**
- `src/dashboard/public/styles.css` (lines 1125-1198: `.artifact-rendered`)
- `src/dashboard/public/styles.css` (lines 2556-2564: `.detail-grid`, `.mobile-detail-layout`)
- `src/dashboard/views/article.ts`, `publish.ts`, `traces.ts` (all render markdown + code blocks)

**Current behavior:**
- `.artifact-rendered` is the container for all rendered markdown (idea.md, draft.md, discussion-summary.md, etc.)
- Images already have `max-width: 100%`
- Code blocks use `.artifact-rendered pre { overflow-x: auto }` — allows horizontal scroll *inside* the pre, not viewport blowout
- Tables are NOT covered by `.responsive-table` when rendered inside markdown

**Problems:**
- **Long unbroken strings** in rendered markdown (URLs, code identifiers, file paths) can still overflow because `word-break` is only applied to `<code>` inside settings tables, not to `.artifact-rendered`
- **Markdown tables** rendered from discussion summaries or draft content are raw `<table>` elements without `.responsive-table` class — they will blow out on mobile
- **Wide pre-formatted blocks** (e.g., ASCII art, wide logs, JSON trees) scroll horizontally *within* the pre, but can push container if `min-width` is not zero on flex/grid parents

**Premium restyle direction:**

**Constrain all rendered content:**
- Apply `word-wrap: break-word; overflow-wrap: break-word;` to `.artifact-rendered` base
- Apply `word-break: break-word;` to `.artifact-rendered p`, `.artifact-rendered li`, `.artifact-rendered blockquote`
- Ensure `.artifact-rendered pre` has `max-width: 100%; overflow-x: auto;` (already done, verify no regressions)
- Add global markdown table handler:
  - `.artifact-rendered table { width: 100%; max-width: 100%; overflow-x: auto; display: block; }`
  - Or wrap rendered markdown tables in a scroll container during server-side render

**Code actions:**
- Update `.artifact-rendered` base styles with aggressive word-break rules
- Add `.artifact-rendered table` defensive overflow rules
- Verify all markdown render paths (`markdownToHtml` in `src/services/markdown.ts`) apply `.artifact-rendered` wrapper
- Test with long URL in idea.md, wide table in discussion-summary.md, and ASCII art in draft.md

---

### 3. Dashboard Feels Like an AI App, Not a Premium Editorial Product (Major UX Issue)

**Files affected:**
- `src/dashboard/public/styles.css` (entire file — typography, spacing, color, button styles)
- All view files (`home.ts`, `new-idea.ts`, `article.ts`, `publish.ts`, `config.ts`, `login.ts`)

**Current behavior:**
- Design uses **safe utility patterns:** rounded corners, subtle shadows, muted colors, compact spacing
- Typography is **functional but uninspiring:** system fonts, tight line-height, no editorial voice
- Buttons are **all equal priority:** primary/secondary distinction exists, but not enough visual weight difference
- Color palette is **blue/gray corporate default:** accent blue, success green, danger red — no editorial personality
- Spacing is **mobile-safe but cramped:** sections feel stacked, not composed
- The shell reads as **"AI-generated dashboard template"** instead of **"NFL editorial control room"**

**Premium restyle direction:**

**Typography:**
- Introduce **editorial headline font** (consider Georgia, Merriweather, or Lora for headlines) — load via CDN or self-host
- Use **larger, bolder headlines** on mobile:
  - Home page h1: bump from 1.5rem to 2rem (mobile), 2.5rem (desktop)
  - Article detail h1: bump from 1.5rem to 1.75rem (mobile), 2.25rem (desktop)
  - Section headings (h2): bump from 1.1rem to 1.3rem (mobile)
- Increase **body line-height** from 1.5 to 1.6 for better mobile readability
- Add **section kickers** (small caps, tracked spacing) as editorial signposts — *already present, lean into them*

**Color & Contrast:**
- Replace generic blue accent with **editorial brand color** — options:
  - Deep NFL shield blue (#013369) for primary actions
  - Bold editorial red (#C8102E) for high-priority CTAs (Publish, Advance)
  - Retain blue for secondary/info states
- Increase **contrast on badges** — current badges are too pastel, hard to scan on mobile
- Add **subtle texture or gradient** to header background (not flat #0f172a) — consider radial gradient or noise texture

**Spacing & Layout:**
- Increase **vertical rhythm** between sections on mobile:
  - `.section { margin-bottom: 1.5rem }` → `2rem` on mobile
  - `.dashboard-grid { gap: 1.5rem }` → `2rem` on mobile
- Add **breathing room inside cards**:
  - `.article-card { padding: 0.75rem 1rem }` → `1rem 1.25rem` on mobile
  - `.detail-section { padding: 1.25rem 1.5rem }` → `1.5rem 1.75rem` on mobile
- Create **visual hierarchy through scale**, not just color — primary actions should be *bigger*, not just different color

**Buttons & Actions:**
- Redesign **primary buttons** as bold editorial CTAs:
  - Increase padding: `0.72rem 1rem` → `1rem 1.5rem`
  - Add subtle shadow or gradient to convey depth
  - Use bolder font-weight (700 instead of 600)
- Reduce **button border-radius** from `999px` (pill shape) to `8px` (modern editorial)
- Differentiate **icon buttons** (theme toggle, edit meta) from text buttons — smaller, squared, subtle bg

**Dashboard Identity:**
- Add **editorial chrome** to page headers:
  - Home hero: add subtle background pattern or image (e.g., faded football field texture)
  - Article detail: add visual distinction between "draft mode" and "published" (color shift, icon, banner)
- Introduce **status indicators** with personality:
  - Stage 7 "Ready to Publish" gets a visual flourish (not just a green badge)
  - Auto-advance flash banner already exists — make it more editorial (not just a spinner)
- Use **micro-interactions** sparingly:
  - Button hover states with subtle scale or shadow shift
  - Card hover with lift effect (not just border color change)

**Code actions:**
- Define new CSS variables for editorial typography: `--font-headline`, `--font-body`, `--line-height-body`, `--line-height-heading`
- Update color variables: replace `--color-accent` with `--color-editorial-primary`, add `--color-editorial-secondary`
- Create new button variants: `.btn-editorial-primary`, `.btn-editorial-cta`, `.btn-icon`
- Increase spacing variables: `--spacing-section`, `--spacing-card-padding`
- Add new section chrome classes: `.section-editorial-hero`, `.page-header-editorial`
- Apply new styles to home, article, publish pages first — Settings/config can stay utility-focused

---

## Implementation Priority

**Phase 1: Fix width overflow (Code, immediate)**
- Apply word-break rules to `.artifact-rendered`
- Add markdown table overflow handling
- Test with long URLs, wide tables, ASCII art

**Phase 2: Improve hamburger/nav interaction (Code, high priority)**
- Redesign nav toggle icon and sizing
- Add nav backdrop overlay
- Update nav drawer styles with elevation and animation

**Phase 3: Premium editorial restyle (Code + UX collaboration, next sprint)**
- Define editorial typography and color system
- Redesign buttons and CTAs
- Increase spacing and visual hierarchy
- Add editorial chrome to key pages (home, article detail)

---

## Files to Edit (Code Agent)

### Immediate (Phase 1):
- `src/dashboard/public/styles.css` — lines 1125-1198 (`.artifact-rendered`)

### High Priority (Phase 2):
- `src/dashboard/public/styles.css` — lines 2161-2244 (header/nav base)
- `src/dashboard/public/styles.css` — lines 2841-2897 (mobile header/nav)
- `src/dashboard/views/layout.ts` — lines 57-82 (nav toggle markup, add backdrop)

### Next Sprint (Phase 3):
- `src/dashboard/public/styles.css` — entire file (new CSS variables, editorial system)
- `src/dashboard/views/home.ts` — apply new section chrome
- `src/dashboard/views/article.ts` — apply new editorial styles
- `src/dashboard/views/publish.ts` — apply new editorial styles

---

## Testing Notes

**Manual mobile testing:**
- Test hamburger open/close on iPhone SE (375px), iPhone 13 (390px), iPad (768px)
- Test article detail with long URL in idea.md, wide table in discussion-summary.md
- Test home page scrolling with all sections expanded
- Verify safe-area padding on iPhone with notch/home indicator

**Playwright automated testing:**
- Run existing `tests/ux-playwright-review.ts` after Phase 1 and Phase 2
- Add new tests for nav drawer backdrop, opened nav elevation

---

## Questions for Code

1. **Typography:** Do we have a preferred editorial font already, or should we use web-safe serif (Georgia) first, then upgrade to web font later?
2. **Color system:** Should editorial brand colors match NFL shield palette (#013369 blue, #C8102E red), or do we have custom league colors in `config.leagueConfig`?
3. **Animation performance:** Are CSS transitions (slide-in nav, button hover scale) acceptable, or do we need to test on low-end devices first?

---

## Expected Outcomes

**After Phase 1:**
- Zero mobile viewport width overflow on article detail, publish preview, and traces pages
- Markdown content (tables, code blocks, long URLs) stays constrained to viewport

**After Phase 2:**
- Hamburger/nav interaction feels intentional and polished
- Nav drawer has clear open/close affordance with backdrop overlay
- Mobile header no longer feels cramped

**After Phase 3:**
- Dashboard reads as premium editorial product, not generic AI app
- Typography, color, spacing convey editorial authority
- CTAs (Publish, Advance, Create Article) feel confident and action-oriented

---

**END OF DECISIONS**


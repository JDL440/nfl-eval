# Active Decisions

- **Code: Depth/panel runtime implementation — compatibility-first preset model** (2026-04-02): Implement the runtime migration as a compatibility-first preset model: keep `depth_level` / `content_profile` writable and derived during migration; treat `feature` as an article-form concern, not a separate "deepest panel" tier; let panel shape + explicit panel constraints drive panel sizing/model policy; recompute preset-era columns whenever legacy-only edits change depth/profile so partial updates cannot leave stale editorial metadata behind. Root issue: legacy depth was overloaded across reader intent, article length, panel sizing, and model choice, but schedules and metadata edits already expose both legacy and preset-era concepts, so preserving compatibility without recomputing derived fields would keep the system internally inconsistent. Files changed: `src\types.ts` keeps `auto + feature` at 3–4 agents; `src\llm\model-policy.ts` picks panel tier from `panel_shape` / `panel_constraints_json` with trade/cohort/market-map shapes as most complex; `src\db\repository.ts` uses dedicated merge helpers so legacy-only updates can legitimately change `preset_id`, `article_form`, and derived compatibility fields; `src\pipeline\idea-generation.ts`, `src\services\article-creation.ts`, `src\services\recurring-scheduler.ts` share one ideation seam. Validation: `npm run v2:build` and `npm run test -- tests/pipeline tests/db tests/llm/model-policy.test.ts tests/dashboard/new-idea.test.ts tests/dashboard/schedules.test.ts tests/dashboard/metadata-edit.test.ts`.

- **UX: Depth/panel redesign — preset-first migration with explicit legacy bridge** (2026-04-02): Treat the depth/panel redesign as a systematic preset-first migration, not as a cosmetic label refresh. Root issue: Storage already supports editorial presets (preset_id, reader_profile, article_form, panel_shape, analytics_mode, panel_constraints_json), but dashboard UX exposes mostly legacy depth_level/content_profile across five misaligned surfaces. Core problems: (1) Ghost Option—depth 4 exists in metadata/schedules but cannot be created via intake or filtered in home queue. (2) Naming inconsistency—camelCase in new-idea/settings vs snake_case in article metadata/legacy schedules. (3) Preset/depth split—new-idea offers depth-only, schedules offer dual-select depth+profile, but storage has full preset columns. (4) Validation seams—settings normalizes through parseEditorialRequest() but legacy API persists raw values. (5) Schedule surface parity failure—/config?tab=schedules (HTMX, preset-aware) and /schedules (full-page forms, raw persist) are two UX contracts over the same model. Implementation phases: Phase 0—stabilize operator truth (prevent silently ignored edits, make every surface preset-first OR clearly legacy-compatibility-only). Phase 1—unify primary UX (replace "Depth Level" with consistent preset vocabulary, add depth 4 to intake/filtering). Phase 2—converge schedules (choose canonical surface, align field names/defaults/validation/persistence). Phase 3—protect advanced state (regression coverage for preset preservation, explicit depth changes, hidden fields not dropped). Test gaps: depth 4 submission parity, home filter depth 4 rendering, schedule content_profile persistence, cross-surface option inventory. Full audit in `.squad/decisions/inbox/ux-depth-panel-audit.md` with implementation guidance, affected surfaces, and evidence line numbers. Decision anchors all future depth/panel UX work to preset-first mental model with explicit compatibility phase.

- **UX: Navigation reset and article layout** (2026-04-01): Keep shared mobile drawer implementation, but fully reset all mobile-only hidden-state properties (opacity, isibility, pointer-events, 	ransform, absolute offsets) at @media (min-width: 768px) to prevent stale mobile state from blocking desktop interaction. Treat article detail page as single-column editorial workspace on desktop by opting it out of shared 2-column detail grid with rticle-detail-single modifier class. Fix active nav link contrast by overriding .btn-header's white text with dark text on accent background. Root cause: responsive state leakage (not broken markup), article width issue came from inheriting publish/detail split (not shell max-width). Surgical desktop reset is lower risk than header restructuring. Files: src\dashboard\public\styles.css, src\dashboard\views\article.ts.

- **Code: Gemini native tools + providerState** (2026-04-01): Use Gemini native `functionDeclarations` when tools are enabled, and preserve Gemini conversation continuity through an opaque `providerState` blob containing raw `contents`. Gemini 3.x emits `thoughtSignature` tokens that must be round-tripped exactly across tool turns. Reconstructing turns from normalized `ChatMessage[]` loses that opaque state, so the runner now threads `providerState` without inspecting it while the Gemini provider owns serialization and replay. Implementation: `src\llm\gateway.ts` adds `providerState?: unknown` to `ChatRequest` and `ChatResponse`; `src\agents\runner.ts` carries providerState through both structured and legacy tool loops; `src\llm\providers\gemini.ts` stores raw Gemini `contents` in providerState, reuses them on follow-up calls, and appends only fresh trailing tool results as `functionResponse` parts. Manual verification via `test-gemini.ts`.

- **Code: File-write audit — hardcoded script paths** (2026-03-31):Complete audit of file write operations in the pipeline revealed that most writes are safe (DB-backed artifacts, config-resolved paths), but Python data script paths are hardcoded to `process.cwd()/content/data`, which breaks NFL_DATA_DIR isolation when running in PROD from a different working directory. Impact: fact-check, roster validation, stat validation, and data service all break in PROD when CWD ≠ repo root. See code-scriptsdir-config decision for the fix.

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






---

# UX Decision Inbox — Depth / Panel Audit

**Date:** 2026-04-02  
**Owner:** UX  
**Status:** Audit ready for implementation planning

## Decision

Treat the depth/panel redesign as a **preset-first migration with an explicit legacy bridge**, not as a cosmetic label refresh.

That means:

1. **One editorial vocabulary** must govern all dashboard surfaces.
   - New idea, home filter, article metadata, settings schedules, and standalone schedules cannot keep showing different names or different option counts for the same stored concept.
2. **Legacy edits must never silently no-op.**
   - If a surface still exposes legacy `depth_level` / `content_profile`, saving those fields must either recompute the preset-derived fields or the UI must stop pretending those controls are editable.
3. **Hidden advanced state must not be overwritten by simple forms.**
   - If `preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`, or `panel_constraints_json` are persisted, any schedule/article form that omits them must preserve them or expose them.
4. **Schedule UX must converge on one contract.**
   - The HTMX settings schedules flow and the standalone `/schedules*` flow currently behave like two products. Either retire the legacy surface or align field names, defaults, validation, and persistence semantics.

## Why

The current implementation already exposes the redesign in storage and server parsing, but not consistently in UI:

- `src\dashboard\views\new-idea.ts` and `src\dashboard\views\home.ts` still expose only three depth choices.
- `src\dashboard\views\article.ts`, `src\dashboard\views\config.ts`, and `src\dashboard\views\schedules.ts` expose four legacy depth choices.
- `src\types.ts` resolves presets and advanced editorial controls, but most dashboard surfaces still render only legacy depth/profile controls.

Two compatibility failures are now visible:

1. **Article metadata depth edits can silently fail.**
   - `src\db\repository.ts:updateArticle()` feeds `updates.depth_level` through `resolveEditorialControls()` while preserving `article.preset_id`.
   - Because `resolveEditorialControls()` prioritizes `preset_id`, an operator can select a new depth in `src\dashboard\views\article.ts` and still persist the old effective depth.
   - This is already surfacing in `tests\dashboard\metadata-edit.test.ts`.

2. **The two schedule surfaces fail in opposite ways.**
   - `src\dashboard\server.ts:/api/settings/article-schedules*` recomputes and writes preset-derived fields from the simple form, so editing a schedule in Settings can wipe richer hidden controls.
   - `src\dashboard\server.ts:/schedules/:id/edit` passes only legacy fields into `repo.updateArticleSchedule()`, which preserves the existing preset and can ignore the operator’s changed depth/profile selection.

## Implementation guidance

### Phase 0 — stabilize operator truth

- Make every live surface either:
  - preset-first with advanced overrides, or
  - clearly legacy/compatibility-only.
- Do not allow a form to show editable legacy fields when those edits will be ignored.

### Phase 1 — unify primary UX

- Replace the public-facing “Depth Level” control on primary surfaces with a consistent preset vocabulary.
- If depth remains temporarily visible, expose all supported values everywhere, including home filters and new-idea creation.

### Phase 2 — converge schedules

- Choose one schedule surface as canonical.
- If `/schedules*` stays live, it must match Settings on:
  - field names
  - copy
  - defaults
  - validation feedback
  - persistence behavior

### Phase 3 — protect advanced state

- Add regression coverage for:
  - preset preservation when simple forms save
  - explicit depth changes actually changing effective values
  - hidden advanced controls not being dropped
  - parity between settings schedules and standalone schedules

## Audit evidence

- `src\dashboard\views\new-idea.ts:239-244`
- `src\dashboard\views\home.ts:82-90`
- `src\dashboard\views\article.ts:134-172`
- `src\dashboard\views\config.ts:301-475`
- `src\dashboard\views\schedules.ts:120-214`
- `src\dashboard\server.ts:1027-1056`
- `src\dashboard\server.ts:1267-1360`
- `src\dashboard\server.ts:2879-2966`
- `src\db\repository.ts:1219-1325`
- `src\db\repository.ts:2348-2564`
- `src\types.ts:189-300`

## Audit addendum — 2026-04-02 (surface consistency)
- Split advanced-controls contract: `new-idea.ts` already exposes `presetId`, `readerProfile`, `articleForm`, `panelShape`, `analyticsMode`, and panel constraints, but the other audited dashboard views do not. Treat that asymmetry as migration debt, not optional polish.
- Mixed legacy schedule values are not stable across surfaces. `/config?tab=schedules` normalizes `contentProfile + depthLevel` through preset resolution, while `/schedules` stores the raw pair. The same operator choice can therefore save as different persisted values depending on which schedule UI they used.
- Partial legacy-only updates are unsafe once preset columns exist. `updateArticle()` and `updateArticleSchedule()` merge incoming `depth_level` with existing `article_form` / preset fields, so changing only the legacy depth on an existing record can round-trip back to the old derived depth.

## Comprehensive Audit Summary — 2026-04-02 UX Depth/Panel Audit

### Affected Surfaces & Inconsistencies

#### 1. New Idea Form (`src/dashboard/views/new-idea.ts:238–244`)
- **Depth range:** 1–3 only (Casual Fan, The Beat, Deep Dive)
- **Form field:** `depthLevel` (camelCase)
- **Limitation:** Cannot create Feature (depth 4) articles via primary UX intake

#### 2. Home Filter (`src/dashboard/views/home.ts:82–90`)
- **Depth range:** 1–3 only (matches new-idea terminology)
- **Query param:** `depth`
- **Limitation:** Hides depth 4 from filtering even though metadata/schedules allow setting it

#### 3. Article Metadata Editor (`src/dashboard/views/article.ts:15–20, 134–172`)
- **Depth range:** 1–4 (Casual Fan, The Beat, Deep Dive, Feature)
- **Form field:** `depth_level` (snake_case — inconsistent with new-idea camelCase)
- **Persistence issue:** Does not sync preset/editorial fields when legacy depth is edited
- **No preset awareness:** Metadata editing stays legacy-only

#### 4. Schedule Configuration (`src/dashboard/views/schedules.ts:147–160` + `config.ts`)
- **Settings tab** (`src/dashboard/views/config.ts`):
  - Field names: camelCase (`depthLevel`, `contentProfile`)
  - Delivery: HTMX/fragments
  - Depth range: 1–4
  - Semantics: Dual-select pattern (`content_profile` as 'accessible' | 'deep_dive' separate from `depthLevel`)
  - Persistence: Normalizes through `parseEditorialRequest()` in `src/dashboard/server.ts:1267–1364`
  
- **Legacy `/schedules` route** (`src/dashboard/views/schedules.ts:147–160`):
  - Field names: snake_case (`depth_level`, `content_profile`)
  - Delivery: Full-page forms with traditional POST/redirect
  - Depth range: 1–4
  - Persistence: Raw `depth_level`/`content_profile` stored directly in `src/dashboard/server.ts:2872–3027` without preset normalization

- **Two distinct UX contracts** over the same model — different field names, different delivery mechanisms, different persistence semantics

#### 5. Server Validation & Persistence Seams (`src/dashboard/server.ts`)
- **`POST /api/ideas:1727`** — Form field `depthLevel` (camelCase), accepts depths 1–4
- **`POST /htmx/articles/:id/edit-meta:1887`** — Form field `depth_level` (snake_case), accepts depths 1–4, persists without preset sync
- **`GET /htmx/filtered-articles:1202`** — Query param `depth`, filters by value
- **`POST /api/settings/article-schedules*:1267–1364`** — Normalizes camelCase through `parseEditorialRequest()`, writes preset-derived fields
- **Legacy `/schedules*:2872–3027`** — Persists raw `depth_level`/`content_profile` directly without preset normalization

### Core Problems

#### Problem 1: Ghost Option (Depth 4)
- **Definition:** Depth 4 ("Feature") is selectable in article metadata and schedules, but cannot be created via new-idea intake or filtered in home queue.
- **Runtime collapse:** `DEPTH_LEVEL_MAP` (src/types.ts:77–82) maps both depth 3 and depth 4 to `deep_dive` orchestration tier, making depth 4 functionally redundant for panel composition and model selection.
- **Operator impact:** Users can set depth 4 in metadata/schedules but the system will not let them create or filter Feature articles, creating confusion and workflow friction.

#### Problem 2: Naming Inconsistency
- **New-idea form:** `depthLevel` (camelCase)
- **Article metadata:** `depth_level` (snake_case)
- **Settings schedules:** `depthLevel` (camelCase)
- **Legacy schedules:** `depth_level` (snake_case)
- **Terminology drift:** "Casual Fan / The Beat / Deep Dive" (new-idea/home) vs "Casual Fan / The Beat / Deep Dive / Feature" (article/schedules)

#### Problem 3: Preset vs Depth Split
- **New-idea:** Depth only (implicit preset defaults)
- **Article metadata:** Depth only (no preset awareness)
- **Schedules:** Both `depth_level` and `content_profile` dual-select (partial two-axis model)
- **Storage:** Full editorial preset fields (`preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`) persisted but not surfaced for edit or display

#### Problem 4: Validation Seam Inconsistency
- Both `/api/ideas` and metadata edit endpoints accept 1–4 regardless of what the UI offers
- Settings schedules normalize through `parseEditorialRequest()` but legacy API does not
- Article metadata edits do not recompute preset-derived fields when legacy depth changes
- Home filter omits depth 4 while backend/metadata still persist it

#### Problem 5: Schedule Surface Parity Failure
- Two schedule routes edit the same underlying records but:
  - Use different field names (camelCase vs snake_case)
  - Use different defaults and copy
  - Use different persistence semantics (one normalizes presets, one preserves raw values)
  - Operators see different choices depending on which route they use

### Required Changes

#### Short-term (Pre-redesign)
1. **Add depth 4 to new-idea and home filter** or explicitly retire it from metadata/schedules
2. **Standardize field naming** to either all snake_case or all camelCase across all surfaces
3. **Clarify depth 4 semantics** — is it truly distinct from depth 3, or should it be relabeled/collapsed?
4. **Make article metadata editing preset-aware** so edits keep preset-derived fields internally consistent

#### Medium-term (Redesign)
1. **Align all surfaces** around one canonical editorial-controls model (presets or legacy)
2. **Converge schedule flows** — either retire legacy `/schedules` or align field names, defaults, validation, terminology with settings
3. **Ensure surface parity** — operators can create/edit/filter the same set of options across all surfaces
4. **Document schedule semantics** — clarify whether `content_profile` is orthogonal to `depth_level` or derived from it

#### Testing & Validation
1. **Expand `tests/dashboard/`** to lock option-set parity (new-idea depth choices must match home filter)
2. **Add regression coverage** for preset preservation when legacy fields are edited
3. **Add coverage** for schedule create/edit flows (settings HTMX vs legacy full-page) to ensure parity
4. **Document legacy compatibility behavior** and deprecation timeline

### Key Files for Implementation
- `src/dashboard/views/new-idea.ts` (form field naming, depth range)
- `src/dashboard/views/home.ts` (filter depth range)
- `src/dashboard/views/article.ts` (metadata edit form, preset awareness)
- `src/dashboard/views/config.ts` (settings schedules tab)
- `src/dashboard/views/schedules.ts` (legacy schedules form)
- `src/dashboard/server.ts` (validation, persistence seams at 1202, 1267–1364, 1727, 1887, 2872–3027)
- `src/types.ts` (DEPTH_LEVEL_MAP, editorial preset model)
- `src/db/repository.ts` (updateArticle, updateArticleSchedule, preset sync logic)
- `tests/dashboard/*.test.ts` (regression coverage for parity and preset preservation)

## Current Branch State Addendum

**As of latest audit:**

### Migration Status: Asymmetric (Some surfaces preset-first, others still legacy)

#### Preset-First Surfaces
- **new-idea.ts:** Exposes preset controls (presetId, readerProfile, articleForm, panelShape, analyticsMode) + depth 1–3 via depthLevel field
- **article.ts:** Renders preset from persistent fields but metadata editor still shows only legacy depth_level (no preset awareness)

#### Hybrid/Legacy Surfaces
- **home.ts:** Shows four preset labels ("Casual Fan", "The Beat", "Deep Dive", "Feature") but form still uses `name="depth"` numeric values — no preset awareness in filter
- **config.ts (schedules tab):** Preset-first with camelCase field normalization (depthLevel, contentProfile) but shows hidden legacy mapping in metadata; normalizes through parseEditorialRequest()
- **schedules.ts (legacy `/schedules` routes):** Fully legacy — snake_case form names (depth_level, content_profile), no preset normalization, persists raw values directly

#### Runtime Collapse
- **types.ts:** DEPTH_LEVEL_MAP still flattens depths 3 and 4 to `deep_dive` orchestration tier
- **Implication:** Depth 4 is selectable in UI but functionally redundant at runtime; not a true fourth editorial tier

### Key Migration Debt
1. **Asymmetric form contracts:** new-idea uses preset fields, article metadata uses legacy-only, home/config/schedules mix both
2. **No preset sync on legacy edits:** Article metadata editor accepts depth_level changes but doesn't update underlying preset fields; edits can silently snap back to preset-derived values
3. **Two schedule surfaces, one model:** Settings tab (HTMX, camelCase, normalized) vs legacy routes (full-page, snake_case, raw) both write to same records with different semantics
4. **Home filter partial migration:** Shows preset labels but queries on numeric depth, blocking full preset-aware filtering
5. **Depth 4 phantom option:** Can be set in metadata/schedules but not created via new-idea, not filtered in home, collapses to depth 3 at runtime

### Next Phase Priorities
1. **Template from preset-first surfaces:** Use new-idea.ts as the template for full preset-first migration (not a depth cosmetic refresh)
2. **Audit before unifying:** Document which surfaces can be safely migrated together (create/edit/filter) vs which must stay legacy until their persistence path is retired
3. **Schedule surface convergence:** Either retire legacy `/schedules` or align both surfaces on one field naming + persistence strategy
4. **Test parity locks:** Add regression tests that assert feature parity across create/filter/edit/schedule flows to prevent asymmetry regressions


---

# Research Decision Inbox: Depth/Panel Dashboard Audit

## Decision / Recommendation

Treat the dashboard work as a **consistency and compatibility repair**, not a fresh architecture design. The split editorial model already exists in the schema, types, repository, and idea-generation/runtime helpers; the immediate work is to make every dashboard/UI surface either fully legacy-consistent or fully split-model-aware.

## What must be true

1. **One primary vocabulary per surface.**
   - If a surface stays legacy for now, it must use the same option set everywhere.
   - If a surface adopts the redesign, it must expose presets as the simple path and advanced split controls as the explicit override path.

2. **Legacy edits must remain authoritative during migration.**
   - When a dashboard route accepts only `depth_level` or `content_profile`, repository update logic must recompute split fields from those legacy inputs instead of letting stale `preset_id` / `article_form` / `reader_profile` values win.

3. **Schedule creation/edit and schedule execution must use the same editorial contract.**
   - The fields accepted in `src\dashboard\server.ts`
   - The values shown in `src\dashboard\views\config.ts` / `src\dashboard\views\schedules.ts`
   - The values passed into `createIdeaArticle()` from `src\pipeline\article-scheduler-service.ts`
   must all describe the same preset/controls.

## Why this matters

- Right now the product is internally split: storage/runtime knows about presets and split controls, but dashboard surfaces still present mostly legacy controls.
- That mismatch is already causing baseline failures in metadata-edit and schedule update tests, which means migration compatibility is not theoretical; it is currently broken on write paths.

## Recommended order

1. Fix legacy write compatibility in repository/update flows.
2. Align all visible dashboard terminology and option sets.
3. Then expose presets + advanced controls where desired.

## Key files

- `src\types.ts`
- `src\db\repository.ts`
- `src\dashboard\server.ts`
- `src\dashboard\views\new-idea.ts`
- `src\dashboard\views\home.ts`
- `src\dashboard\views\article.ts`
- `src\dashboard\views\config.ts`
- `src\dashboard\views\schedules.ts`
- `src\pipeline\article-scheduler-service.ts`


---

# Code — depth/panel redesign compatibility

## Decision

Keep `depth_level` as a compatibility contract while migrating the dashboard to richer editorial controls.

## Context

- `src\dashboard\server.ts` already supports richer editorial inputs through `parseEditorialRequest()`.
- Operator-facing views and specs still rely on legacy fields and labels:
  - `src\dashboard\views\new-idea.ts`
  - `src\dashboard\views\home.ts`
  - `src\dashboard\views\article.ts`
  - `src\dashboard\views\config.ts`
  - `src\dashboard\views\schedules.ts`
  - `tests\dashboard\new-idea.test.ts`
  - `tests\dashboard\metadata-edit.test.ts`
  - `tests\dashboard\schedules.test.ts`
  - `tests\dashboard\settings-routes.test.ts`
  - `tests\dashboard\config.test.ts`

## Implication

The redesign should migrate route/view/test seams in phases, preserving:

1. `depthLevel` and `depth_level` request compatibility
2. schedule `contentProfile` / `content_profile` compatibility
3. HTMX fragment shapes and `HX-Redirect` flows on `/config?tab=schedules`
4. existing SSE event names: `article_created`, `stage_changed`, `stage_working`, `pipeline_complete`

Do not drop or silently reinterpret `depth_level` until home, new-idea, article metadata, config schedules, standalone schedules, and their dashboard tests are aligned.


---

# Lead — Editorial controls architecture / migration plan

## Decision

Adopt the split editorial-controls model as the single canonical contract across storage, runtime, API, and UX:

- `preset_id`
- `reader_profile`
- `article_form`
- `panel_shape`
- `analytics_mode`
- `panel_constraints_json`

Treat legacy `depth_level` and schedule `content_profile` as **derived compatibility fields only** during rollout. They may remain readable/exported temporarily, but they should not stay as independent editable authorities once the migration lands.

## Why

- The research report established that legacy depth is overloaded across reader intent, article size, panel sizing, and runtime/model policy.
- `src\types.ts`, `src\db\schema.sql`, and `src\db\repository.ts` already encode the cleaner split model, so the architectural direction is now clear.
- Remaining drift is mostly at the seams: dashboard labels/forms, route normalization, scheduled article creation, model policy, and tool manifests/tests.

## Rollout rules

1. **Source of truth**
   - Canonical authoring contract lives in `src\types.ts` and is persisted by `src\db\repository.ts`.
2. **Derived compatibility**
   - `depth_level` derives from `article_form`.
   - `content_profile` derives from `reader_profile` + `analytics_mode`.
3. **Deprecated**
   - Any surface that still presents `depth_level` / `content_profile` as primary editable concepts is deprecated and should be migrated.
4. **Runtime**
   - Panel sizing/topology should key off `panel_shape` + `panel_constraints_json`, with `article_form` as the fallback shape-size hint.
   - Reader-facing tone/metrics policy should key off `reader_profile` + `analytics_mode`.
5. **Compatibility exit**
   - Remove legacy write authority last, after UI/API/runtime/tests all consume canonical fields consistently.

## Noted risks

- Manual idea creation and scheduled creation are not yet aligned; `src\pipeline\idea-generation.ts` is more migrated than `src\services\article-creation.ts`.
- Dashboard/API update paths for schedules still show drift risk in focused vitest failures (`tests\dashboard\schedules.test.ts`, `tests\dashboard\settings-routes.test.ts`).
- `src\llm\model-policy.ts` and `src\tools\pipeline-tools.ts` still expose legacy depth semantics, so leaving them untouched would preserve hidden double-authority.

## Approval scope guard

This decision approves the **architecture direction and rollout rules only**. It does not approve a specific implementation diff, field-removal timing, or UX copy package; those should be reviewed by Code/UX against these source-of-truth rules.



---

# UX Depth / Panel Audit

## Context

Backend requested a read-only audit of every dashboard/UI surface touched by the depth/panel redesign.

## Decision

Treat the redesign as **five live UX contracts** that must be migrated together:

1. `src\dashboard\views\new-idea.ts`
2. `src\dashboard\views\home.ts` + `/htmx/filtered-articles`
3. `src\dashboard\views\article.ts` + `/htmx/articles/:id/edit-meta`
4. `src\dashboard\views\config.ts` + `/api/settings/article-schedules*`
5. `src\dashboard\views\schedules.ts` + `/schedules*` / `/api/schedules*`

Do not frame the current state as a single “depth control” rollout. The repo is already split between preset-first surfaces, legacy depth/profile surfaces, and compatibility routes.

## Findings

### New idea

- `src\dashboard\views\new-idea.ts` is preset-first and no longer renders `depthLevel`.
- Its subtitle still tells users to “choose the right depth.”
- `IDEA_TEMPLATE` still asks Lead to output `## Depth Level {1|2|3}`.

### Home filter

- `src\dashboard\views\home.ts` labels the filter as presets (`Casual Explainer`, `Beat Analysis`, `Technical Deep Dive`, `Narrative Feature`).
- `src\dashboard\server.ts` still parses the query as `depth` and filters by legacy `depth_level`.

### Article metadata

- `src\dashboard\views\article.ts` renders preset-first metadata controls.
- `POST /htmx/articles/:id/edit-meta` still ignores those fields and only saves `title`, `subtitle`, `depth_level`, and `teams`.

### Schedules

- `config.ts` schedules are preset-first, HTMX-driven, and camelCase.
- `schedules.ts` remains legacy depth/profile, full-page, and snake_case.
- Both remain live against the same schedule model.

## Recommended direction

1. Pick one visible vocabulary and use it consistently.
2. Either make the home filter a real preset filter or rename it honestly as depth.
3. Align article metadata form fields with the handler before more UX iteration.
4. Retire or fully align legacy `/schedules*`.
5. Keep compatibility messaging explicit wherever legacy depth/profile still appears.

## Test focus

- `tests\dashboard\new-idea.test.ts`
- `tests\dashboard\metadata-edit.test.ts`
- `tests\dashboard\config.test.ts`
- `tests\dashboard\settings-routes.test.ts`
- `tests\dashboard\schedules.test.ts`
- `tests\dashboard\server.test.ts`


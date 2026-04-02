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



---

# Merged from Inbox (2026-04-02T14:03:57Z)

## Decision: code-editorial-followup
# Code — Editorial follow-up compatibility contract

- **Date:** 2026-04-02
- **Decision:** Treat the all-default editorial bundle (`beat_analysis` / `engaged` / `standard` / `auto` / `normal`, with no `panel_constraints_json`) as legacy migration state when it conflicts with stored `depth_level` / `content_profile`, and preserve richer canonical editorial fields on non-editorial schedule PATCHes.
- **Why:** Additive column migrations can silently stamp old rows with defaults before compatibility backfill runs, and unrelated PATCHes can erase intentional overrides if they re-resolve from legacy fallback fields.
- **Files:** `src\db\repository.ts`, `src\dashboard\server.ts`, `tests\db\schedule.test.ts`, `tests\dashboard\schedules.test.ts`, `tests\dashboard\settings-routes.test.ts`, `tests\migration\migrate.test.ts`


## Decision: code-schedules-audit
# Code — schedules UX audit judgment (2026-04-02)

## Decision

Treat `/config?tab=schedules` as the canonical operator editing surface for recurring article schedules. Treat `/schedules` as a compatibility/detail surface until it is converged or retired.

## Why

- `src\dashboard\views\config.ts` renders the preset-first schedule editor used in the current admin surface, with HTMX mutation flows and inline result handling.
- `src\dashboard\server.ts` backs that surface with `/api/settings/article-schedules*`, which uses shared normalization plus admin-style error handling and `HX-Redirect`.
- `src\dashboard\views\schedules.ts` uses the same editorial resolver, so it is not fully stale at the data-model layer, but it still diverges in operator contract: snake_case fields, full-page redirects, different defaults, no create-time enabled toggle, and different provider controls.
- Only `/schedules/:id` currently exposes per-schedule run history, so retirement should preserve that visibility elsewhere before removal.

## Evidence

- `src\dashboard\views\config.ts:368-455,469-555`
- `src\dashboard\views\schedules.ts:53-95,131-245,247-295`
- `src\dashboard\server.ts:1300-1375,2954-3153`
- `tests\dashboard\schedules.test.ts:62-183`


## Decision: lead-depth-panel-review
# Lead review — depth/panel redesign approval

- **Status:** Not approved yet.
- **Why:** The branch makes strong progress on canonical editorial controls, but two functional gaps still block approval:
  1. multi-team intake is not persisted end to end (`src\pipeline\idea-generation.ts` still builds context from `teams[0]`, stores `primary_team: teams[0]`, and `src\db\repository.ts#createArticle()` serializes `teams` from only `primary_team`);
  2. schedules still ship two live operator contracts over the same model (`src\dashboard\views\config.ts` + `/api/settings/article-schedules` using camelCase/defaults, and `src\dashboard\views\schedules.ts` + `/schedules` using snake_case/different defaults).
- **Scope guard:** This is not a rejection of the typed editorial model, repository migration, article metadata work, model-policy wiring, or compose-panel prompt updates. It is a hold on rollout completeness until cross-team persistence and schedule-surface convergence are resolved.
- **Validation evidence:** Focused vitest coverage passed for dashboard/db/pipeline/model-policy suites, but those tests do not prove multi-team persistence or cross-surface schedule parity.


## Decision: lead-editorial-audit
# Lead decision inbox — editorial-state audit follow-up

- **Status:** proposed
- **Date:** 2026-04-03
- **Scope:** dashboard editorial-state redesign; schedules, article metadata, home filtering, regression coverage

## Decision

Do **not** treat the current dashboard/editorial redesign as functionally complete until three seams are closed together:

1. preserve canonical schedule overrides on partial `/api/schedules/:id` PATCH updates,
2. make preset changes hydrate advanced editorial fields on article/config/legacy-schedule editors the way new-idea already does,
3. add regression coverage against the **rendered form contracts**, not only legacy compatibility payloads.

## Why

- The API schedule PATCH path can erase `panel_shape`, `analytics_mode`, and `panel_constraints_json` on non-editorial updates because it recomputes from legacy defaults.
- Article/config/schedule preset-first forms can persist stale advanced values under a new preset label because only intake syncs preset changes into hidden override fields.
- Existing dashboard tests are mostly compatibility-path checks, so the suite can stay green while the live preset-first UX drifts.

## Evidence anchors

- `src\dashboard\server.ts:3133-3152`
- `src\types.ts:231-259`
- `src\dashboard\views\new-idea.ts:438-457`
- `src\dashboard\views\article.ts:176-236`
- `src\dashboard\views\config.ts:396-448,497-548`
- `src\dashboard\views\schedules.ts:197-239`
- `tests\dashboard\settings-routes.test.ts:289-345`
- `tests\dashboard\metadata-edit.test.ts:129-158`
- `tests\dashboard\schedules.test.ts:112-132`


## Decision: lead-editorial-followup-review
# Lead inbox — editorial follow-up prep review

## Constraint to preserve

Keep `pipeline_board` as a single schema contract across live bootstrap and v1→v2 migration paths.

- `src\db\schema.sql` now defines `pipeline_board` with canonical editorial columns (`preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`) in addition to legacy depth fields.
- `src\migration\migrate.ts` still drops and recreates `pipeline_board` with the older league-only projection.

If follow-up code touches migration or schema/view compatibility, preserve one rule: **a migrated database must expose the same `pipeline_board` columns and meanings as a freshly initialized database**. Either mirror schema changes into the migration view every time, or stop hand-maintaining a divergent migration-specific view definition.


## Decision: lead-editorial-followups
# Lead Editorial Follow-ups

- **Date:** 2026-04-04
- **Requested by:** Backend (Squad Agent)
- **Decision:** REJECT current editorial compatibility landing until the schedule legacy contract is fixed.

## Why rejected

1. **Legacy schedule tuple collapse is still live.**
   - `resolveEditorialControls()` plus `createArticleSchedule()` / `updateArticleSchedule()` still writes legacy fields back from preset-derived defaults.
   - Result: valid legacy combinations are mutated on save.
   - Concrete failures observed:
     - `(content_profile='accessible', depth_level=3)` collapses to `(deep_dive, 2)`
     - `(content_profile='deep_dive', depth_level=2)` promotes to `(deep_dive, 3)`

2. **JSON schedule PATCH is not parity-safe yet.**
   - `/api/schedules/:id` preserves advanced editorial fields on non-editorial PATCH bodies, but it still does **not** recompute `next_run_at` when `weekday_utc` / `time_of_day_utc` change.
   - Form-based schedule editors handle this more safely, so the API contract remains split.

## Approval conditions

- Preserve submitted legacy schedule tuples on legacy create/update paths; only derive canonical preset-era columns from them.
- Add regressions for at least:
  - legacy create preserving `(accessible,2)`
  - legacy create preserving `(accessible,3)`
  - legacy update preserving submitted tuple while updating canonical fields
  - JSON `PATCH /api/schedules/:id` recomputing `next_run_at` when timing changes
  - HTMX invalid panel-constraint JSON returning a 400 partial on settings schedule forms
  - migration `pipeline_board` parity with canonical schema view columns + `depth_level = 4 => Feature`

## Scope guard

- This rejection is about the compatibility contract only.
- Form-level preset UX, helper-input ergonomics, and broader schedule-surface convergence remain follow-up work, not blockers for this specific approval once the contract seams above are closed.


## Decision: lead-editorial-state-audit
# Lead editorial-state audit

## Decision
Treat partial schedule updates as non-editorial by default. Any schedule route that does not actually receive editorial fields must preserve existing canonical editorial columns (`preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`, `panel_constraints_json`) instead of rebuilding them from legacy compatibility fields. Preset-first forms that expose optional overrides must also hydrate advanced fields from the currently selected preset before those fields are enabled or submitted.

## Why
- `src\dashboard\server.ts:3133-3152` currently always calls `parseEditorialRequest()` inside `PATCH /api/schedules/:id`, so a name-only or timing-only patch can erase stored overrides and rewrite schedule editorial state from fallback `depth_level` / `content_profile`.
- `src\dashboard\views\new-idea.ts:438-457,529-533` already demonstrates the safe preset-sync interaction; `src\dashboard\views\article.ts:178-236`, `src\dashboard\views\schedules.ts:197-238`, and `src\dashboard\views\config.ts:395-449,496-549` do not, which leaves preset-change + later-override flows vulnerable to stale subordinate-field submission.
- `src\types.ts` and `src\db\repository.ts` already model preset-era controls as canonical and legacy fields as derived compatibility state, so letting non-editorial edits rewrite canonical columns from legacy fallbacks breaks the intended contract.

## Consequence
Future editorial-control rollout work should reject any partial-update route that normalizes canonical editorial state when the request did not touch editorial inputs, and reject any preset-first form that can submit stale advanced values after a preset change.


## Decision: lead-review-findings
# UX-Focused Code Review — Lead Findings (2026-04-02T06:15:00Z)

**Scope:** schedules UX vs canonical editorial state, hidden data loss, field-name mismatches, workflow inconsistencies, regression coverage.

---

## 1. SCHEDULES UX MISALIGNED FROM NEW-IDEA DEFAULTS (Critical)

**Finding:** New-idea form defaults to `beat_analysis` preset (engaged, standard, normal analytics), but schedule new-form defaults to `casual_explainer` (casual, brief, explain-only). Both surfaces control the same editorial state model, but ship different starting assumptions.

**Evidence:**
- `src\dashboard\views\new-idea.ts:188` — `buildEditorialUiState({ preset_id: 'beat_analysis' })`
- `src\dashboard\views\schedules.ts:144` — preset defaults to `casual_explainer`
- Both feed identical `parseEditorialRequest()` in `src\dashboard\server.ts:1027–1056`

**Why it matters:** Recurring schedules created via `/config?tab=schedules` will silently adopt `explain_only` analytics mode and "casual" reader profile instead of the default orchestration assumption (engaged, standard). Users moving between intake (new-idea) and recurring-schedule config will see different editorial defaults, creating hidden migration friction.

**UX decision impact:** ("preset-first migration") requires unified default across all intake surfaces. Schedule form should follow new-idea default.

---

## 2. PANEL CONSTRAINTS HELPER INPUTS IGNORED WHEN JSON FIELD EXISTS (High Priority)

**Finding:** `src\dashboard\server.ts:1003–1026` — `parsePanelConstraintsInput()` checks if `panelConstraintsJson` textarea has content _first_; if it does, function returns that JSON immediately without reading helper inputs (min_agents, max_agents, required_agents, etc.). Users editing helper controls on an existing schedule with a non-empty JSON field will have edits silently no-op.

**Evidence:**
- `src\dashboard\server.ts:1004–1006` — `if (typeof rawJson === 'string' && rawJson.trim()) { return rawJson.trim(); }`
- Lines 1008–1025 — Helper parsing code never executes if JSON field is non-empty
- `src\dashboard\views\config.ts:400` and `src\dashboard\views\schedules.ts:238` — Both render the textarea + helper fields in the same form

**Why it matters:** Contradicts the UI promise of dual edit paths (helpers OR raw JSON). Users may think they've saved panel constraint overrides (min agents, scope mode) when in fact the existing JSON textarea wins. This is a "helper-controls-vs-raw-JSON priority inversion" on an admin form, flagged in Lead history as a risky pattern.

**Validation:** Form UX allows both paths but runtime enforces raw-JSON-wins silently.

---

## 3. SCHEDULES AND NEW-IDEA FIELD-NAME INCONSISTENCY (Medium Priority)

**Finding:** Schedule form uses camelCase input names (`presetId`, `readerProfile`, `articleForm`, `panelShape`, `analyticsMode`) while article metadata edits use snake_case (`preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`). Both eventually feed `parseEditorialRequest()` which normalizes via `getBodyValue()`, so persistence works, but the inconsistency signals UX/backend seam misalignment.

**Evidence:**
- `src\dashboard\views\schedules.ts:198, 216, 220, 224, 228` — camelCase in schedule form
- `src\dashboard\server.ts:1035–1049` — `parseEditorialRequest` handles both via `getBodyValue(...keys)` lookup
- `src\dashboard\views\article.ts` metadata edit form uses snake_case names

**Why it matters:** Operator confusion when reading form HTML or debugging request bodies. Future form rewrites may not notice the dual convention and create dead code paths.

---

## 4. SCHEDULE SURFACE PARITY FAILURE — CONVERGED UX DECISION NOT FULLY APPLIED (Medium Priority)

**Finding:** Two separate schedule UX surfaces persist with misaligned semantics:
  1. `/config?tab=schedules` (HTMX, preset-first, uses editorial-controls.ts helpers)
  2. `/schedules/new` and `/schedules/:id/edit` (full-page forms, legacy raw persist)

The UX decision ("preset-first migration") requires surface convergence and explicit governance of whether schedule creation is preset-aware or raw-depth-aware. Current state: both routes exist, each with its own form implementation and defaults, creating two contracts over one model.

**Evidence:**
- `src\dashboard\views\schedules.ts:131–245` — Full-page schedule form
- `src\dashboard\views\config.ts:328–400` — HTMX schedule card form
- Both target different POST endpoints (`/schedules/new` vs `/api/settings/article-schedules`)
- Different field defaults (lines 144 vs line 396 preset picker)

**Why it matters:** The decisions log explicitly requires "Phase 2—converge schedules (choose canonical surface, align field names/defaults/validation/persistence)." Current branch ships both surfaces, which contradicts that decision scope and leaves operator choice undefined.

**Test gap:** No cross-surface parity tests for schedule creation. Tests that create schedules use one surface (likely config tab based on routes.test patterns), so regressions in the other surface would not be caught.

---

## 5. IMPLICIT LEGACY PERSISTENCE WHEN ONLY DEPTH/PROFILE CHANGE (Medium Priority)

**Finding:** Article metadata edit route (`/htmx/articles/:id/edit-meta`) allows changing `depth_level` or `content_profile` alone (lines 1089–1117 condition checks for any editorial field change). When only legacy fields change, `parseEditorialRequest()` recomputes `preset_id`, `article_form`, and related preset-era columns via `resolveEditorialControls()`. This is intentional per Code decision (recompute to avoid stale metadata), but the roundtrip is hidden from UI and may not be obvious to operators editing depth/profile that the preset ID also changes.

**Evidence:**
- `src\dashboard\server.ts:1089–1117` — Condition catches any preset/depth/profile change
- `src\dashboard\server.ts:1104–1116` — All editorial columns updated via `parseEditorialRequest()`
- The recomputation is correct per Code decision but _implicit_ in the form

**Why it matters:** If an operator edits only `depth_level` to 3 on a `casual_explainer`-preset article, the system will recompute `preset_id` to a derived value that may surprise the operator. The form does not show what preset ID will result from the depth change. This is correct behavior but lack of visibility could trigger confusion ("Why did my preset change?").

**Validation:** The recomputation logic is working as intended per Code decision; this is an observability/transparency concern, not a correctness bug.

---

## 6. MISSING REGRESSION COVERAGE FOR SCHEDULE DEFAULTS (Medium Priority)

**Finding:** The depth/panel redesign introduced new editorial columns (`preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`) and changed how schedules store them. No regression tests verify that:
  - Schedule creation via `/schedules/new` (full-page form) stores the correct defaults
  - Schedule creation via `/config?tab=schedules` (HTMX form) stores the correct defaults
  - Both surfaces produce identical editorial state for the same input
  - Editing helper controls (min agents, required agents) on an existing schedule persists correctly when JSON field is empty

**Evidence:**
- `tests\dashboard\schedules.test.ts` and `tests\dashboard\settings-routes.test.ts` exist but would need specific assertions for default divergence and field-persistence parity
- No test verifies the `parsePanelConstraintsInput()` priority rule (JSON field wins)

**Why it matters:** Current test suite validates that articles can be created and schedules can be created/edited, but does not validate that the two intake surfaces converge on the same defaults or that helper-input persistence works correctly.

---

## Summary for Coordination

Four findings require immediate attention:

1. **Unify schedule defaults** with new-idea form (preset should be `beat_analysis`, not `casual_explainer`)
2. **Fix helper-input priority** in `parsePanelConstraintsInput()` — read helpers first, JSON second, or require explicit choice
3. **Resolve schedule-surface parity** — apply the "converge schedules" phase from UX decision
4. **Add regression coverage** for defaults, field persistence, and cross-surface parity

All findings align with existing team decisions (Code: "compatibility-first preset model", UX: "preset-first migration"). No new design work is required; implementation is applying stated decisions completely.


## Decision: lead-schedules-audit
---
decision_id: lead-schedules-audit-2026-04-03
status: findings-report
created_at: 2026-04-03T13:00:00Z
audience: Backend (Squad Agent)
title: "Architectural Review: Schedule Management Routes & Views"
---

# Lead Architecture Audit: Schedule Management Contract Divergence

**Scope:** Views contract (render/form/input), server handlers (POST/PATCH), persistence (repo/schema), test alignment  
**Focus:** Canonical authority, operator-visible defaults, cross-surface consistency, test-vs-reality alignment  
**Judgment:** DERIVED vs. CANONICAL vs. STALE status for `/schedules` surface

---

## Part 1: Product Truth Architecture — Where Things Live

### Storage / Persistence Truth

**Database Schema** (`src\db\schema.sql:278–300`)
- `article_schedules` table stores: `preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`, `panel_constraints_json` (split editorial fields) **AND** legacy `depth_level`, `content_profile` (derived compatibility fields)
- Both families of columns populated on every insert/update
- Schema validates: `preset_id` NOT NULL DEFAULT 'beat_analysis'

**Repository Layer** (`src\db\repository.ts`)
- `createArticleSchedule()` and `updateArticleSchedule()` persist both legacy and split fields
- No schema-level enforcement of consistency (both can drift independently)

### Type System Truth

**Canonical Editorial Model** (`src\types.ts:61–74`)
```typescript
export interface EditorialControls {
  preset_id: EditorialPresetId;
  reader_profile: ReaderProfile;
  article_form: ArticleForm;
  panel_shape: PanelShape;
  analytics_mode: AnalyticsMode;
  panel_constraints_json: string | null;
}

export interface ResolvedEditorialControls extends EditorialControls {
  panel_constraints: PanelConstraints | null;
  legacy_depth_level: DepthLevel;           // ← derived
  legacy_content_profile: ArticleScheduleContentProfile;  // ← derived
}
```

**Resolution Function** (`src\types.ts:218–261` `resolveEditorialControls()`)
- Takes mixed input (preset_id + depth_level + content_profile + reader_profile + article_form + ...)
- **Line 231–233:** If `preset_id` provided and valid, uses it; else derives from legacy depth/profile via `presetFromLegacy()`
- **Line 235–246:** Derives remaining fields from preset defaults, allowing optional overrides
- **Line 249–260:** Always re-derives `legacy_depth_level` from `article_form` and `legacy_content_profile` from `reader_profile` + `analytics_mode`

**Key insight:** Preset is the source of truth; depth/profile are always derived **outbound**. But input can arrive in either form.

### View/Form Truth

**Schedules view** (`src\dashboard\views\schedules.ts:136–152`)
- Defaults new schedule to: `preset_id: 'casual_explainer'`, `depth_level: 1`, `content_profile: 'accessible'`
- Line 154: Checks `hasEditorialOverrides()` to hide/show advanced fields

**Config/settings view** (`src\dashboard\views\config.ts:400–449`, form-rendering for schedules tab)
- Uses camelCase field names (`presetId`, `weekdayUtc`, `timeOfDayUtc`, etc.)
- Does not hardcode a default preset; inherits from database state or falls back to `beat_analysis`

**New-idea view** (`src\dashboard\views\new-idea.ts:438–457`)
- Defaults preset to `beat_analysis` (engaged reader, standard form, normal analytics)

### Request Handler Truth

**Config/HTMX route** (`src\dashboard\server.ts:1300–1339` POST `/api/settings/article-schedules`)
- Line 1303: `parseEditorialRequest(body, { defaultDepth: 2, contentProfile: null })`
- Falls back to depth 2 (standard) → resolves to `beat_analysis` when no preset given
- Returns HTTP 200 with HTMX `HX-Redirect` header (line 1333)
- Line 1326: Records audit trail via `repo.recordSettingsAudit()`

**Legacy schedules route** (`src\dashboard\server.ts:2963–3002` POST `/schedules/new`)
- Line 2981–2984: `parseEditorialRequest(body, { defaultDepth: 1, contentProfile: 'accessible' })`
- Falls back to depth 1 (casual) → resolves to `casual_explainer` when no preset given
- Line 3001: Returns HTTP 302 redirect (full-page, no HTMX)
- NO audit logging

**Shared helper: parsePanelConstraintsInput()** (`src\dashboard\server.ts:1003–1026`)
- Line 1004–1007: **If JSON textarea populated, returns immediately without reading helper inputs**
- Line 1008–1025: Only parses helper inputs (min_agents, required_agents, scope_mode) if JSON is empty/falsy
- **Both config and schedules routes use this function** (called via parseEditorialRequest, line 1050)

### Test Truth

**tests\dashboard\schedules.test.ts:62–82** (POST /api/schedules)
- Creates schedule with **explicit** depth_level and content_profile
- Does **not** test default preset when none specified
- Does **not** assert derived article_form value matches depth_level

---

## Part 2: Five Audit Questions — Direct Answers

### Question 1: What /schedules exposes that other surfaces do not, or vice versa?

**Exposure difference: Everything is identical**

| Control | `/schedules` view | `/config?tab=schedules` view | 
|---------|-------------------|-------------------------------|
| Preset selector | ✅ Yes (dropdown) | ✅ Yes (dropdown) |
| Reader profile override | ✅ Yes (advanced) | ✅ Yes (advanced) |
| Article form override | ✅ Yes (advanced) | ✅ Yes (advanced) |
| Panel shape override | ✅ Yes (advanced) | ✅ Yes (advanced) |
| Analytics mode override | ✅ Yes (advanced) | ✅ Yes (advanced) |
| Panel constraints JSON | ✅ Yes (textarea) | ✅ Yes (textarea) |
| Provider override | ✅ Yes (dropdown) | ✅ Yes (dropdown) |
| Base prompt | ✅ Yes (textarea) | ✅ Yes (textarea) |

**Verdict:** NO ASYMMETRIC EXPOSURE. Both surfaces expose identical controls for editing the same data. Difference is **not in what can be edited, but in HOW it's edited** (naming convention, interaction model, defaults).

---

### Question 2: Defaults that differ in operator-visible ways?

**Default preset divergence (CONFIRMED):**

| Surface | Create route | Default preset | Line # | Fallback depth |
|---------|-----------|------------------|--------|---|
| New-idea form | (articles table) | `beat_analysis` | implicit via resolveEditorialControls | 2 |
| Schedules view | `/schedules/new` | `casual_explainer` | schedules.ts:144 | 1 |
| Config view | `/api/settings/article-schedules` | `beat_analysis` | server.ts:1303 defaultDepth:2 | 2 |

**Operator impact:** 
- Submit new-idea form with no preset selection → saves `beat_analysis` (engaged, standard form, normal analytics)
- Submit schedules form with no preset selection → saves `casual_explainer` (casual, brief form, explain-only)
- Submit config form with no preset selection → saves `beat_analysis`

**Same repository, different editorial intent per surface. Operator creating recurring schedule via `/schedules` gets different defaults than operator manually creating idea.**

**Time-of-day default:**
- Schedules form: hardcoded `time_of_day_utc: '09:00'` (line schedules.ts:139)
- Config form: uses submitted value, no hardcode
- New-idea: N/A (articles don't have recurring time)

**Verdict:** YES, defaults differ materially and are operator-visible. Preset choice determines reader sophistication (casual vs engaged) and article length (brief vs standard), which are fundamental content decisions.

---

### Question 3: Whether legacy depth/profile labels are misleading now that feature/depth-4 exists?

**Depth-to-form mapping** (`src\types.ts:189–199` `deriveDepthLevelFromArticleForm()`)
```
brief      → depth 1
standard   → depth 2
deep       → depth 3
feature    → depth 4
```

**Label display** (`editorial-controls.ts:17–22`)
```
1: 'Casual Fan'
2: 'The Beat'
3: 'Deep Dive'
4: 'Feature'
```

**Where rendered:** `src\dashboard\views\schedules.ts:111` 
```html
<div class="form-hint">
  ${escapeHtml(formatLegacyDepthLabel(editorial.legacy_depth_level))} · 
  ${escapeHtml(formatContentProfileLabel(editorial.legacy_content_profile))}
</div>
```

**Misleading aspect:** The labels are **accurate but semantically overloaded**. "Depth 4" suggests a numeric progression (deeper → more depth), but depth 4 actually signals **a different article structure** (`feature` form) distinct from depth 3 (`deep` form). 

- Depth 1 → Depth 2: progression (casual → beat)
- Depth 2 → Depth 3: progression (beat → deep dive)
- **Depth 3 → Depth 4: structural shift** (deep dive form → feature form, not a continuity)

**Where it matters:** 
- Operators may assume "go from depth 3 to 4" is a linear progression, not a form-family change
- Schedule table renders depth + profile labels but doesn't show overrides (panel_shape, analytics_mode are hidden), so "3 — Deep Dive" could actually be `panel_shape: 'auto', analytics_mode: 'metrics_forward'` with no visual hint

**Verdict:** Misleading in the sense that depth 4 is not a linear continuation; it's a distinct editorial choice. **Labels are accurate**, but **semantic risk** for future maintainers who may assume linearity. **Low operator impact** because labels are correct; labels don't hide data, they just don't explain the model fully.

---

### Question 4: HTMX consequence where /config behaves as live canonical surface but /schedules behaves as stale full-page contract?

**Interaction model difference (CONFIRMED):**

**Config surface (`/api/settings/article-schedules`)**
- Method: POST (form submission)
- Response handler line 1333: `c.header('HX-Redirect', '/config?tab=schedules')`
- Response code: HTTP 200
- Behavior: HTMX POST succeeds; browser navigates to HX-Redirect; page section updates; no full reload
- State preservation: Scroll position, tab selection, filter state remain

**Schedules surface (`/schedules/:id/edit`)**
- Method: POST (form submission)
- Response handler line 3001: `return c.redirect('/schedules')`
- Response code: HTTP 302
- Behavior: Full-page POST + redirect cycle; browser reloads entire page
- State loss: Scroll position lost, must navigate back manually

**Consequence for operators:**
1. **Create schedule via config:** Instant feedback, stay on settings page, no disruption → feels **live**
2. **Create schedule via schedules:** Full page reload, navigate away, lose context → feels **stale/slow**

**The "stale" aspect:** The `/schedules` surface gives delayed feedback (full page reload), while `/config` surface provides immediate HTMX feedback. Operators perceive `/schedules` as slower and less responsive, even though both write to same database and complete instantly.

**Verdict:** YES. `/config` is live (HTMX-native, immediate visual feedback), `/schedules` is stale-feeling (full-page contract, reload delay). Not a correctness issue, but **UX/perception issue** that compounds defaults divergence. Operator who edits in config sees instant result; same operator who edits in schedules experiences reload wait.

---

### Question 5: Whether tests\dashboard\schedules.test.ts aligns with product truth or legacy depth semantics?

**Test inventory and analysis:**

```typescript
it('POST /api/schedules creates a schedule', ...) {
  body: {
    name: 'Tuesday Test',
    weekday_utc: 2,
    time_of_day_utc: '09:00',
    team_abbr: 'sea',
    prompt: 'Seahawks latest news',
    depth_level: 1,
    content_profile: 'accessible'
  }
  // ✅ Asserts: depth_level === 1
  // ✅ Asserts: content_profile === 'accessible'
  // ❌ Missing: assertion that preset_id was set
  // ❌ Missing: assertion that reader_profile was set
  // ❌ Missing: assertion that article_form was set
})

it('PATCH /api/schedules/:id updates a schedule', ...) {
  PATCH with { name: 'New', depth_level: 3 }
  // ✅ Asserts: depth_level === 3
  // ✅ Asserts: article_form === 'deep' (derived from depth 3)
  // ❌ Missing: assert that preset_id was recalculated
  // ❌ Missing: assert that reader_profile, analytics_mode match preset defaults
  // ❌ Missing: assert that preset overrides survive name-only PATCH
})
```

**Alignment assessment:**

**Tests validate:** Legacy depth/profile API contract (create with snake_case fields, read them back)

**Tests do NOT validate:** 
1. Product truth (when no preset given, what preset should be set?)
2. Derivation (depth 3 → article_form 'deep' is asserted, but is it derived from preset or directly from depth?)
3. Cross-surface defaults (no test comparing `/schedules/new` defaults to `/api/schedules` defaults to `/api/settings/article-schedules`)
4. Override persistence (no test asserts that depth-only PATCH preserves preset overrides)
5. Helper-input priority (no test asserts that JSON textarea wins over helper inputs)

**Verdict:** Tests align with **legacy depth semantics** (snake_case, depth as input), NOT **product truth** (preset-first model, depth as derived output). 

**Example of gap:** Test creates schedule with `depth_level: 1, content_profile: 'accessible'`, then asserts `depth_level === 1`. But product truth says "depth 1 should resolve to preset_id='casual_explainer', reader_profile='casual', article_form='brief'". Test doesn't assert any of the split fields. **If preset resolution broke, test would still pass.**

**Test is green but doesn't validate canonical editorial state.** It validates the API surface (depth persistence) but not the product model (preset resolution).

---

## Part 3: Architectural Judgment

### Where Product Truth Lives (Summary Table)

| Layer | Authority | Evidence |
|-------|-----------|----------|
| **Schema** | Split model (preset + legacy) | `src\db\schema.sql:288` DEFAULT 'beat_analysis'; both columns persist |
| **Types** | Preset-first, with derivation | `src\types.ts:218–261` resolveEditorialControls() always derives depth from preset |
| **Views** | Divergent defaults | schedules.ts:144 ('casual_explainer') vs. new-idea implicit ('beat_analysis') |
| **Routes** | Dual contracts | `/api/settings/*` (depth:2) vs. `/schedules/*` (depth:1) |
| **Tests** | Legacy-only | schedules.test.ts asserts depth/profile, not presets |

**Canonical authority should be:** Types (resolveEditorialControls) + schema (preset NOT NULL), but views/routes contradict each other.

---

### Three-Way Route Comparison

#### /schedules Surface (Legacy Full-Page)
- **Field naming:** snake_case (`preset_id`, `weekday_utc`, `content_profile`, `depth_level`)
- **Create default preset:** `casual_explainer` (line schedules.ts:144)
- **Create default depth:** 1 (line schedules.ts:142)
- **Response type:** HTTP 302 redirect (line server.ts:3001)
- **Interaction:** Full-page POST + reload
- **Audit trail:** NO (no recordSettingsAudit call in schedules route)
- **Preset awareness:** YES (renders override checkboxes)
- **Helper input priority:** JSON > helpers (line server.ts:1005-1007)

#### /config?tab=schedules Surface (HTMX Settings-Driven)
- **Field naming:** camelCase (`presetId`, `weekdayUtc`, `panelConstraintsJson`, `depthLevel`)
- **Create default preset:** `beat_analysis` (implied from defaultDepth:2, line server.ts:1303)
- **Create default depth:** 2 (line server.ts:1303)
- **Response type:** HX-Redirect (line server.ts:1333)
- **Interaction:** HTMX POST + inline update
- **Audit trail:** YES (line server.ts:1326 recordSettingsAudit)
- **Preset awareness:** YES (same controls)
- **Helper input priority:** JSON > helpers (same function)

#### /api/schedules Surface (JSON API)
- **Field naming:** snake_case (same as legacy /schedules)
- **Create default preset:** `casual_explainer` (line server.ts:3111-3112 defaultDepth:1)
- **Create default depth:** 1
- **Response type:** JSON 201 (line server.ts:3130)
- **Interaction:** JSON request/response
- **Audit trail:** NO
- **Preset awareness:** YES
- **Helper input priority:** JSON > helpers

**Commonality:** All three share `parseEditorialRequest()` (line 1027) and `parsePanelConstraintsInput()` (line 1003) functions.

**Divergence:** Defaults differ; naming differs; interaction model differs; audit trail differs.

---

## Final Judgment: /schedules Status

### Canonical, Derived, or Stale?

**VERDICT: /schedules is DERIVED** (legacy full-page view of shared data model)

**Reasons:**

1. **Not canonical:** Uses legacy snake_case naming. Canonical would be camelCase (modern convention used in editorial-controls, new-idea, article views). **Evidence:** schedules.ts form names vs. config.ts form names.

2. **Not canonical:** Creates with depth-1 default instead of depth-2. Canonical default would align with board/product decision (beat_analysis). **Evidence:** schedules.ts:142-144 vs. server.ts:1303.

3. **Not canonical:** No audit trail. Canonical for settings would record decisions via `recordSettingsAudit()`. **Evidence:** server.ts:1326 (config) vs. server.ts:2963-3002 (schedules, no audit).

4. **Not canonical:** Full-page interaction model (302 redirect). Canonical for settings would be HTMX-native (HX-Redirect, inline feedback). **Evidence:** server.ts:1333 (HX-Redirect) vs. 3001 (redirect).

5. **Not stale:** Data persists correctly to same schema. Queries return identical results. Not "broken" or "abandoned."

6. **Is derived:** Derives from same repository/types. Reads/writes same schema. Applies same business logic.

**Therefore:** `/schedules` is a valid **secondary interface** to canonical data, but it is NOT the **primary canonical authority**. The canonical surface is `/config?tab=schedules` (HTMX, camelCase, audit-logged, beat_analysis defaults, settings-integrated).

---

## Recommendation for Backend

**Do not retire /schedules yet.** Operators may prefer full-page workflows. But:

1. **Mark as legacy:** Add JSDoc `@deprecated` and inline comment explaining config is canonical.

2. **Align defaults or document:** Decide:
   - Should /schedules default to beat_analysis (align with product intent)?
   - Or should new-idea default to casual_explainer (align with /schedules)?
   - Current divergence creates hidden friction.

3. **Fix helper-input priority:** `parsePanelConstraintsInput()` (line 1005–1007) should not silently discard helper edits. 
   - Option A: Return validation error if JSON + helpers both populated
   - Option B: Prefer helpers if JSON empty
   - Option C: Document that JSON always wins (current behavior)

4. **Unify naming convention:** Migrate schedules.ts to camelCase (matches editorial-controls convention). Keep both in parseBody via `getBodyValue()` for backward compat.

5. **Add parity tests:** Create `tests\dashboard\schedules-parity.test.ts` asserting:
   - Default preset matches across all three surfaces
   - Helper edits persist when JSON empty
   - Helper edits are silenced when JSON exists (or validation error)
   - Cross-surface create/edit round-trips preserve preset overrides

6. **Add audit logging:** Config route logs settings changes (good); schedules route should too for operator accountability.

---

## Files to Review in Follow-Up

- `src\dashboard\views\schedules.ts` (defaults at line 136-152, field names in form)
- `src\dashboard\server.ts` (routes 1300, 2963, 3091; helpers 993, 1003, 1027)
- `src\dashboard\views\config.ts` (form field names, defaults)
- `tests\dashboard\schedules.test.ts` (add preset/parity assertions)
- `src\types.ts` (resolveEditorialControls logic, derivation direction)

---

## Summary: Evidence-Based Findings

| Finding | Impact | Evidence | Line # |
|---------|--------|----------|--------|
| **Default preset diverges** | HIGH | schedules.ts:144 vs. server.ts:1303 | 144, 1303 |
| **Helper-inputs silenced by JSON** | CRITICAL | parsePanelConstraintsInput returns JSON first | 1005–1007 |
| **Field naming asymmetry** | MEDIUM | form input names snake_case vs camelCase | schedules.ts, config.ts |
| **Interaction model diverges** | MEDIUM | HX-Redirect vs. 302 redirect | 1333, 3001 |
| **No audit trail on legacy route** | MEDIUM | recordSettingsAudit only on config route | 1326 vs. absent |
| **Tests don't assert presets** | MEDIUM | schedules.test.ts only checks depth/profile | 62–82 |
| **Depth 4 semantics overloaded** | LOW | Feature is different form, not just deeper | types.ts:189–199 |



## Decision: ux-depth-panel-implementation
# UX Decision — Depth/Panel Dashboard Implementation

- Date: 2026-04-02
- Agent: UX

## Decision

Implement the dashboard migration as **preset-first with opt-in advanced overrides** across all operator-facing editorial surfaces:

1. Preset is the primary control on new idea, article metadata, config schedules, standalone schedules, and home filtering.
2. Advanced controls stay available, but are disabled until the operator explicitly checks **Override preset defaults**.
3. Legacy `depth_level` / `content_profile` remain compatibility outputs derived through `resolveEditorialControls()` and `parseEditorialRequest()`, not primary UI concepts.

## Why

If preset and advanced fields are always submitted together, a newly selected preset is silently overridden by the old explicit axis values. Disabling advanced inputs until opt-in keeps the simple path trustworthy, preserves migration compatibility, and prevents stale override drift between UI and server handlers.

## Impacted paths

- `src/dashboard/views/new-idea.ts`
- `src/dashboard/views/article.ts`
- `src/dashboard/views/home.ts`
- `src/dashboard/views/config.ts`
- `src/dashboard/views/schedules.ts`
- `src/dashboard/server.ts`

## Notes

- Tuesday-style slots map cleanly to `casual_explainer`.
- Thursday-style analytical slots map cleanly to `technical_deep_dive`.
- Casual-facing copy should explicitly discourage unexplained analytics rather than hoping legacy depth semantics imply it.


## Decision: ux-review-findings
# UX Review Findings — Editorial State Inconsistencies

**Date:** 2025-01-XX  
**Reviewer:** UX  
**Scope:** Dashboard UI for editorial metadata intake, filtering, scheduling, and publishing

---

## CRITICAL FINDINGS

### 1. **Schedules UX Exposes 4 Depth Values While Intake & Filtering Expose Only 3**

**Impact:** Data loss risk on round-trip UX; user confusion about what "Feature" means.

- **new-idea.ts** (line 263-269): `renderPresetOptions()` exposes only 4 presets (`casual_explainer`, `beat_analysis`, `technical_deep_dive`, `narrative_feature`). No explicit depth level selector.
- **schedules.ts** (line 131-244): Form default and rendering show `depth_level: 1..4` with legacy label fallback (line 111: `formatLegacyDepthLabel()`). The form initializes `depth_level: 1` (line 142) but allows 1-4 via the database API.
- **types.ts** (line 77-82): `DEPTH_LEVEL_MAP` collapses depth 4 onto `deep_dive`, same bucket as depth 3. This is the stated architectural problem.
- **home.ts**: No depth filter selector. Home only filters by preset (line 82-88), not by legacy depth.

**Evidence chain:**
- When user creates via new-idea form: they pick a preset (which maps to article_form, which derives depth_level).
- If that article is later scheduled via schedules form: the UI shows `formatLegacyDepthLabel(depth_level)` — depth 4 will say "Feature," depth 3 says "Deep Dive," but pipeline treats them identically (line 81 in types.ts).
- If user tries to filter home articles by depth: no such filter exists. Only preset filter (which is read-only from creation time).

**Recommended action:** Align surfaces to expose the same set of values. Either:
1. Stop offering depth 4 in schedule forms, or
2. Add depth filter to home search, or  
3. Split presentation: show preset in intake/schedules, show derived legacy labels read-only.

---

### 2. **Hidden Data Loss: `depth_level` and `content_profile` Both Persist but UI Maps Them Inconsistently**

**Impact:** When editorial controls are overridden, derived fields may not sync. Metadata edit form can stale panel sizing.

- **article.ts** (removed in diff): Old form had explicit depth level selector (1-4 with word-count hints).
- **new article creation** (server.ts): When creating via new-idea, `depth_level` is derived from `article_form` (types.ts line 189-199), `content_profile` is derived from `reader_profile` + `analyticsMode` (types.ts line 202-208).
- **schedules persistence** (types.ts line 567-589): ArticleSchedule stores all six fields: `depth_level`, `content_profile`, AND the new four-axis controls (`reader_profile`, `article_form`, `panel_shape`, `analytics_mode`).
- **editorial-controls.ts** (line 40-61): `buildEditorialUiState()` resolves legacy fields ON READ. If user changes preset in schedules form, `legacy_depth_level` is re-derived, potentially differing from what was saved.

**Scenario where data desync occurs:**
1. Schedule created with preset `technical_deep_dive` → auto-derives `depth_level: 3`, `content_profile: 'deep_dive'`.
2. Admin manually edits schedule: changes `analytics_mode` to `explain_only` (keeping everything else).
3. On re-render, `deriveContentProfileFromControls()` (line 202-208) now returns `'accessible'`, but `depth_level` stays 3.
4. User sees `"3 — Deep Dive · Accessible"` hint (line 199), but runtime behavior may expect `depth_dive` content profile.

**Recommended action:** 
- Store a `precomputed_legacy_depth` and `precomputed_legacy_profile` snapshot in DB on schedule save (alongside the new four-axis fields).
- OR: Make editorial-controls.ts derivation deterministic per preset, not per individual axis (i.e., don't let `analyticsMode` alone flip content_profile if preset choice is already explicit).

---

### 3. **Preset Label Mismatch: "narrative_feature" Preset But "Feature" Depth Display**

**Impact:** Semantic confusion; preset names don't match UI labels.

- **editorial-controls.ts** (line 21): `LEGACY_DEPTH_LABELS[4] = 'Feature'`.
- **types.ts** (line 34-38): `EditorialPresetId` enum has `'narrative_feature'` as the label.
- **schedules.ts** (line 110): Renders preset via `formatPresetLabel(s.preset_id)` from types.ts, which will show "Narrative Feature", not "Feature".
- But editorial-controls.ts line 103-104 shows in form hint: "Legacy compatibility stays at {depth label} · {profile}" — so if preset is `narrative_feature`, the hint will say "Feature" (derived from depth 4).

**User perspective:** In schedules table, they see "Narrative Feature" (preset name), but in the form hint they see "Feature" (legacy depth name). No clear signal that these are the same thing.

**Recommended action:**
- Rename preset to match: either `feature` or `narrative_feature_deep_dive`, OR
- In schedules table row, render both the preset name AND the legacy depth label for clarity (e.g., "Narrative Feature (Feature, Deep Dive)").

---

### 4. **Metadata Edit Form Removed: No Path to Change Depth After Stage 1**

**Impact:** Users cannot adjust article ambition/panel sizing after intake; forced to re-submit or manually edit DB.

- **article.ts diff**: Old form (deleted in this changeset) had explicit depth selector with warning: _"Changing depth level after Stage 1 may desync prompts/panel sizing"_ (line 127 in old code).
- **New article.ts** (currently): No depth/preset controls in `renderArticleMetaEditForm()`. Only title, subtitle, teams.
- **server.ts**: Routes still accept PATCH to `/api/articles/:id` with `depth_level` and `preset_id` (grep shows these are whitelisted fields), but the UI has no form to edit them.

**Scenario:** User realizes depth 2 idea should be depth 3 after seeing discussion prompt. Can't change it in UI. Must use API or contact admin.

**Recommended action:**
- Either restore preset/form selector in article edit form (with strong warning), OR
- Document that depth changes post-Stage-1 require API calls, not UI (and surface that in help text).

---

### 5. **Inconsistent Field Names Across Surfaces (camelCase vs snake_case)**

**Impact:** Client-side form submission logic must translate; harder to debug, easier to miss fields.

- **server.ts**: Accepts both `depthLevel` (camelCase) and `depth_level` (snake_case) in form bodies via `getBodyValue(body, 'depthLevel', 'depth_level')` (grep output).
- **new-idea.ts** (line 263): Form field `name="presetId"` (camelCase).
- **schedules.ts** (line 198): Form field `name="preset_id"` (snake_case).
- **editorial-controls.ts**: Internal helper `buildLegacyFields()` returns `{ depthLevel, contentProfile }` (camelCase).

**Consequence:** When new-idea form POSTs, it sends `{ presetId, articleForm, readerProfile, ... }` (camelCase). Server must normalize. When schedules form POSTs, field names are snake_case. This is error-prone; if a field is forgotten in the translation, it silently doesn't update.

**Recommended action:**
- Standardize on one convention in form submission (recommend snake_case to match DB).
- Validate all expected fields in server route and reject if missing, rather than silently defaulting.

---

## LOWER-PRIORITY FINDINGS

### 6. **Panel Constraints JSON Not Exposed in New-Idea Form**

- **schedules.ts** (line 236-238): Advanced panel constraints JSON editor exists in schedule form.
- **new-idea.ts** (line 284-327): No such field in idea form, even though editorial-controls.ts supports it.
- User cannot pin specific agents or enforce multi-team scope at idea time; must manually edit schedule later.
- _Impact: Moderate._ Presets handle common cases; expert users can override in schedules. No data loss.

---

### 7. **No Preset Reordering / Prioritization for Intake**

- **types.ts** (line 84-89): `EDITORIAL_PRESET_ORDER` is hardcoded: `casual_explainer` → `beat_analysis` → `technical_deep_dive` → `narrative_feature`.
- **editorial-controls.ts** (line 72-76): Renders presets in order.
- If org's most common preset changes (e.g., narratives become most popular), form UX doesn't adapt.
- _Impact: Low._ Order can be re-hardcoded if needed. No runtime issue.

---

## SUMMARY TABLE: Which Surfaces Expose Which Values?

| Surface | depth_level (1-4) | preset | article_form | reader_profile | panel_shape | content_profile | analytics_mode |
|---------|-------------------|--------|--------------|-----------------|-------------|-----------------|-----------------|
| **new-idea** form | Derived only | ✅ Explicit | Conditional override | Conditional | Conditional | Derived | Conditional |
| **schedules** form | ✅ Explicit (default 1) | ✅ Explicit | Conditional | Conditional | Conditional | Derived | Conditional |
| **home** filters | ❌ No filter | ✅ Filter exists | ❌ No filter | ❌ No filter | ❌ No filter | ❌ No filter | ❌ No filter |
| **article** detail (old) | ✅ Shown, editable | — | — | — | — | — | — |
| **article** detail (new) | ✅ Shown (read-only badge) | ✅ Shown badge | — | — | — | — | — |
| **DB schema** | ✅ Persisted | ✅ Persisted | ✅ Persisted | ✅ Persisted | ✅ Persisted | ✅ Persisted | ✅ Persisted |

**Key:** ✅ = Exposed / ❌ = Not exposed / Derived = Computed on read

---

## TEST COVERAGE GAPS

1. **Round-trip UX test:** Create article via new-idea with preset X → navigate to schedules → verify depth/profile match.
2. **Metadata edit test:** When schedule depth changes from 3→2, verify that derived content_profile is recalculated and saved correctly.
3. **Filter consistency test:** Filter home articles by preset; verify that no depth-4 articles are silently hidden.

---

## NEXT STEPS FOR ARCHITECTURE TEAM

1. Decide on canonical editorial state: Is it the four-axis model (reader_profile, article_form, panel_shape, analytics_mode) or the legacy (depth_level, content_profile)?
2. If migrating to four-axis: migrate all form surfaces (intake, schedules, article detail) to expose four-axis controls; deprecate depth_level from UI payloads (can remain in DB as derived field for backward compat).
3. If keeping legacy: remove the four-axis fields from schedule UI to reduce confusion; derive them server-side only.
4. Update tests to verify round-trip consistency: creation → schedule → publish, all fields stable.


## Decision: ux-schedules-audit-detailed
---
title: Schedule Routes Audit — Operator Mental Models & Evidence
author: UX
date: 2026-04-03
status: audit-complete
tags: [dashboard, schedules, htmx, dual-contract, canonical-vs-stale, mental-models]
---

# UX Audit: /schedules vs /config?tab=schedules — Five Questions Answered

## Charter Context
UX owns dashboard UI, HTMX views, user experience, and frontend work. This audit focuses on **what operators see and interact with**, not internal wiring. The five critical questions below are answered with **operator-visible evidence** and file/line citations.

---

## Question 1: What /schedules Exposes That Other Surfaces Do Not?

### Answer
`/schedules` exposes a **full-page isolated schedule management workflow** that other surfaces deliberately do not provide. This creates mental-model risk because operators experience two entirely different interaction patterns for the same task.

| Exposure | `/schedules` | `/config?tab=schedules` | Operator Experience |
|----------|-----------|--------|---------|
| **Scope** | Schedules only (full page) | Schedules + providers + secrets (tabbed page) | "Settings page" (integrated) vs "Schedule management page" (standalone) |
| **Discovery** | Standalone in nav (unclear) | Nav → Settings → Schedules tab | Schedules discoverable from settings; settings always discoverable |
| **Edit affordance** | Click row → full page edit form | Inline editable card in-place | "I'm making a change" (full context) vs "I'm tweaking a setting" (contextual) |
| **Recent runs** | Visible table (schedules.ts:247–296) | NOT visible | Debug-able (see execution history) vs blind (no visibility) |
| **Provider selection** | Single dropdown (schedules.ts:166–171) | Batch provider profiles on same page | "Pick a provider" vs "Manage providers AND assign to schedule" |
| **Form layout** | Vertical stacked grid (schedules.ts:177–244) | Horizontal settings form (config.ts:368–430) | Different cognitive load; different scanning patterns |

### Evidence
- **`/schedules` unique rendering:** `src/dashboard/views/schedules.ts:46–99` (full page layout) vs `src/dashboard/views/config.ts:328–430` (tabbed card)
- **Full-page routes:** `src/dashboard/server.ts:2954–3027` (GET /schedules, POST /schedules/new, GET /schedules/:id, GET /schedules/:id/edit, POST /schedules/:id/edit)
- **Settings routes:** `src/dashboard/server.ts:1300–1390` (POST /api/settings/article-schedules)
- **Recent runs table:** `src/dashboard/views/schedules.ts:270–292` (only in /schedules)

### Operator Mental Model Risk
An operator may think:
- **Via `/schedules`:** "I'm managing schedules in isolation. This is a dedicated tool."
- **Via `/config`:** "Schedules are one part of the settings ecosystem alongside providers and secrets."

These are incompatible mental models of the same feature. An operator alternating between surfaces will have to context-switch and may forget which surface edits the canonical data.

---

## Question 2: Defaults That Differ in Operator-Visible Ways

### Answer
**Critical mismatch:** `/schedules` form hard-codes editorial defaults (`depth_level: 1, content_profile: 'accessible'`) but **does NOT render these fields to operators**. Operators cannot see what they're committing.

| Aspect | Evidence | Operator-Visible Impact |
|--------|----------|---------|
| **Field rendering — Depth** | `/schedules`: Lines 142–161 (form inputs for `weekday_utc`, `time_of_day_utc`, `team_abbr`, `preset_id`, `provider` only—**no depth input**). `/config`: Lines 378–399 (camelCase field name labels with hints). | Operator sees preset only in `/schedules`. Has no way to edit or even see depth. In `/config`, depth is also hidden but camelCase naming suggests advanced/preset-derived model. |
| **Field rendering — Content Profile** | `/schedules`: Lines 142–161 (**not rendered**). `/config`: Lines 378–399 (**not rendered**). | Neither surface exposes content_profile as an operator-visible control. Both persist it via hard-coded defaults. |
| **Hidden defaults** | `/schedules:136–152` sets `depth_level: 1, content_profile: 'accessible', preset_id: 'casual_explainer'` as form defaults (lines 142–144). | When operator submits form without touching these fields, they persist invisibly. Operator never consented to "depth 1" or "accessible"—the form never asked. |
| **Preset rendering** | Both surfaces render `preset_id` dropdown (schedules.ts:198, config.ts:396). | Operator thinks they're setting a preset; the system is also locking in legacy depth/profile. |
| **Error feedback** | `/schedules`: Line 2975 redirects to `?error=missing+fields`. `/config`: Line 1337 returns HTMX badge `badge-verdict-reject`. | Operator sees error in URL bar (late feedback) vs inline badge (immediate feedback). Different timing, different affordance. |
| **Success feedback** | `/schedules`: Line 3001 redirects to `?flash=Schedule+created`. `/config`: Line 1334 sends `HX-Redirect: /config?tab=schedules` + inline `badge-verdict-approved`. | `/schedules` shows success via redirect + page reload. `/config` shows inline badge first, then reload. `/config` operator gets immediate feedback; `/schedules` operator waits for page. |

### Evidence
- **Hidden defaults in `/schedules` form:** `src/dashboard/views/schedules.ts:136–152`
  ```typescript
  const v = schedule ?? {
    name: '',
    weekday_utc: 2,  // Tuesday default
    time_of_day_utc: '09:00',
    team_abbr: teams[0]?.abbr ?? '',
    prompt: '',
    depth_level: 1,                           // ← HIDDEN DEFAULT
    content_profile: 'accessible' as const,   // ← HIDDEN DEFAULT
    preset_id: 'casual_explainer' as const,   // ← VISIBLE (dropdown)
    ...
  };
  ```
- **Rendered form controls:** `src/dashboard/views/schedules.ts:177–244` (preset dropdown only; no depth/profile controls)
- **Config camelCase naming:** `src/dashboard/views/config.ts:380–399` (teamAbbr, weekdayUtc, timeOfDayUtc, presetId)
- **Error/success routes:** `src/dashboard/server.ts:2975, 3001, 3069` (full-page redirects) vs `src/dashboard/server.ts:1337, 1333–1334` (HTMX badges + HX-Redirect)

### Operator Mental Model Risk
An operator may think:
- **Via `/schedules`:** "I'm setting a preset. The form doesn't ask for depth or profile, so they don't matter."
- **Reality:** Depth and profile are being set to hardcoded values (1 + accessible) every time the form is submitted.

An operator who later inspects the schedule database or checks created article properties will be confused: "I set 'Beat Analysis' preset, but the article says depth 1 and accessible. What happened?"

---

## Question 3: Whether Legacy Depth/Profile Labels Are Misleading Now That Feature/Depth-4 Exists

### Answer
**Yes, depth labels are deeply misleading** because:

1. **Depth 4 is a ghost option:** Stored but never exposed to operators in any form.
2. **Neither surface renders depth controls:** Operators cannot intentionally set any depth level, rendering all depth-related defaults invisible.
3. **Labels exist but fields don't:** `formatLegacyDepthLabel()` and `LEGACY_DEPTH_LABELS` (editorial-controls.ts:17–22) suggest depth is a first-class choice, but it's actually a phantom persistence detail.

### Evidence
- **Depth labels defined:** `src/dashboard/views/editorial-controls.ts:17–22`
  ```typescript
  const LEGACY_DEPTH_LABELS: Record<number, string> = {
    1: 'Casual Fan',
    2: 'The Beat',
    3: 'Deep Dive',
    4: 'Feature',
  };
  ```
- **Both surfaces show depth in schedules list:** `src/dashboard/views/schedules.ts:110–112` (formatLegacyDepthLabel + formatContentProfileLabel in the table)
- **Neither surface renders depth form control:** 
  - `/schedules:142–161` — no depth input
  - `/config:378–399` — no depth input
- **Depth 4 runtime collapse:** `src/types.ts:77–82`
  ```typescript
  export const DEPTH_LEVEL_MAP: Record<DepthLevel, DepthName> = {
    1: 'casual_fan',
    2: 'the_beat',
    3: 'deep_dive',
    4: 'deep_dive',  // ← Depth 4 collapses to same tier as depth 3
  };
  ```

### Operator Mental Model Risk
An operator may think:
- **Via the label:** "Feature (depth 4) is a distinct scheduling strategy."
- **Via the labels shown in the table:** "I can see and choose feature-level schedules."
- **Reality:** Depth 4 exists only in the database. Operators cannot set it, cannot see it in forms, and if they could set it, it would collapse to "deep_dive" at runtime, making it functionally identical to depth 3.

The table rendering (`schedules.ts:110–112`) shows `formatLegacyDepthLabel()` output, making it look like depth is a visible, intentional choice—but operators have no way to make that choice in the form.

---

## Question 4: HTMX Consequence — /config as Live Canonical, /schedules as Stale Full-Page

### Answer
**Clear contrast:** `/config` is **live and canonical** (HTMX + immediate feedback); `/schedules` is **stale and decoupled** (full-page POST redirects, no inline feedback).

### Evidence — The Two Contracts Side by Side

**CANONICAL: `/config?tab=schedules` (HTMX-driven, live feedback)**

- **Form rendering:** `src/dashboard/views/config.ts:368–430`
  ```html
  <form class="settings-form" 
    hx-post="/api/settings/article-schedules/${id}" 
    hx-target="#schedule-result" 
    hx-swap="innerHTML">
  ```
  (camelCase field names: `teamAbbr`, `weekdayUtc`, `timeOfDayUtc`, `presetId`, `providerMode`)

- **Route handler:** `src/dashboard/server.ts:1300–1340` (POST /api/settings/article-schedules)
  ```javascript
  const editorial = parseEditorialRequest(body as Record<string, unknown>, 
    { defaultDepth: 2, contentProfile: null });
  const schedule = repo.createArticleSchedule({ ... });
  c.header('HX-Redirect', '/config?tab=schedules');
  return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Created</span> Schedule added</div>');
  ```

- **Operator feedback:** Inline result badge appears instantly (line 1334), then page reloads via HX-Redirect. **Operator sees success before the page changes.**

- **Error handling:** `src/dashboard/server.ts:1337` returns inline error badge, not a redirect.

- **Semantic:** Form submit → HTMX POST → server response HTML badge → client-side HX-Redirect → page reload. **Feedback is synchronous and local.**

---

**STALE: `/schedules` (full-page POST, no inline feedback)**

- **Form rendering:** `src/dashboard/views/schedules.ts:177–244`
  ```html
  <form method="POST" action="/schedules/new" class="form-grid">
  ```
  (snake_case field names: `team_abbr`, `weekday_utc`, `time_of_day_utc`, `preset_id`, `provider`)

- **Route handler:** `src/dashboard/server.ts:2963–3002` (POST /schedules/new)
  ```javascript
  const editorial = parseEditorialRequest(body as Record<string, unknown>, 
    { defaultDepth: 1, contentProfile: 'accessible' });
  repo.createArticleSchedule({ ... });
  return c.redirect(`/schedules?flash=${encodeURIComponent('Schedule created')}`);
  ```

- **Operator feedback:** Form submits → server processes → **entire page redirects** → browser reloads → operator sees flash message in query param. **Feedback is delayed and requires full page load.**

- **Error handling:** `src/dashboard/server.ts:2975` redirects to `?error=missing+fields`. Operator must wait for full-page reload to see the error.

- **Semantic:** Form submit → POST → server redirect → browser GETs new page → page renders. **Feedback is asynchronous and requires full navigation.**

### Operator Experience Divergence

| Scenario | `/config` (canonical) | `/schedules` (stale) |
|----------|--------|---------|
| **Create schedule** | Fill form → submit → see inline "Created" badge instantly → page reloads → new schedule visible | Fill form → submit → wait for page to load → see "Schedule created" in URL bar → new schedule visible |
| **Error (missing field)** | Fill form → submit → see inline red error badge instantly | Fill form → submit → wait for page → see "?error=missing+fields" in URL |
| **Mental model** | "I'm tweaking a setting in real-time" | "I'm submitting a form and waiting for confirmation" |
| **Next action** | Can immediately edit another schedule inline (same page) | Must click to navigate to edit page or create form |

### Evidence — Line-by-Line Proof
- **HTMX canonical request:** `src/dashboard/views/config.ts:368` hx-post to `/api/settings/article-schedules`
- **HTMX canonical response:** `src/dashboard/server.ts:1334` returns badge + HX-Redirect header
- **Full-page request:** `src/dashboard/views/schedules.ts:177` form method="POST" action="/schedules/new"
- **Full-page response:** `src/dashboard/server.ts:3001` returns c.redirect()
- **Feedback timing:** config sends result badge before redirect; schedules redirects first, shows flash after

### Operator Mental Model Risk
An operator may think:
- **Via `/config`:** "Settings are live and immediate. I submit and see results right away."
- **Via `/schedules`:** "Schedules are traditional forms. I submit and wait for the page to reload."

These operators are using the same feature but experiencing it as two different products. An operator who learns schedules via `/config` will be confused by `/schedules`' slower, less responsive UX. An operator who only uses `/schedules` might think the system is sluggish.

---

## Question 5: Do Tests Align with Product Truth or Legacy Depth Semantics?

### Answer
**Tests are misaligned:** They validate the intermediate JSON API (`/api/schedules`) and legacy full-page routes, but **NOT the new HTMX canonical surface** (`/api/settings/article-schedules`). This means:

1. **No coverage for the canonical operator surface** — if `/api/settings/article-schedules` breaks, tests won't catch it.
2. **Legacy semantics are locked in by tests** — depth_level and content_profile validation is tested (schedules.test.ts:62–83), so refactoring those fields is harder.
3. **Product truth (editorial presets) is not tested** — preset_id, reader_profile, article_form, panel_shape, analytics_mode are persisted (via parseEditorialRequest) but tests don't assert them.

### Evidence

**Test coverage present (legacy/intermediate API):**
- `tests/dashboard/schedules.test.ts:54–60` tests `GET /api/schedules` (JSON list)
- `tests/dashboard/schedules.test.ts:62–83` tests `POST /api/schedules` (JSON create with depth_level, content_profile, preset_id)
  ```javascript
  it('POST /api/schedules creates a schedule', async () => {
    const res = await app.request('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tuesday Test',
        depth_level: 1,          // ← Legacy field
        content_profile: 'accessible',  // ← Legacy field
      }),
    });
    expect(body.depth_level).toBe(1);
    expect(body.content_profile).toBe('accessible');
  });
  ```

**Test coverage absent (canonical HTMX surface):**
- No tests for `POST /api/settings/article-schedules` (new HTMX route at server.ts:1300)
- No tests for `POST /api/settings/article-schedules/:id` (new HTMX update at server.ts:1341)
- No assertions on camelCase field parsing (`teamAbbr`, `weekdayUtc`, etc.)
- No assertions on HTMX response format (badges, HX-Redirect header)

**Test coverage absent (full-page `/schedules` operator surface):**
- No tests for `GET /schedules` (list page)
- No tests for `POST /schedules/new` (full-page create)
- No tests for `GET /schedules/:id/edit` (edit page)
- No tests for `POST /schedules/:id/edit` (full-page update)
- No assertions on form rendering or field visibility

### Product Truth vs Test Truth

| Aspect | Product Truth | Test Truth |
|--------|--------|--------|
| **Field naming** | Canonical uses camelCase (`teamAbbr`); legacy uses snake_case (`team_abbr`) | Tests only validate snake_case |
| **Defaults** | Canonical defaults via `parseEditorialRequest({ defaultDepth: 2, contentProfile: null })` (server.ts:1303). Legacy defaults via hardcoded form values (schedules.ts:142–144). | Tests hardcode defaults in test payloads; don't test form-level defaults |
| **Editorial controls** | Preset-first model (preset_id + reader_profile + article_form + panel_shape + analytics_mode are atomic) | Tests only assert depth_level + content_profile (legacy proxies) |
| **Response format** | Canonical returns HTML badge + HX-Redirect. Legacy returns HTTP redirect. | Tests only check JSON response bodies |

### Evidence — Missing Test Cases

Looking at `tests/dashboard/schedules.test.ts`, there are NO test cases for:

- `POST /api/settings/article-schedules` (canonical HTMX route, server.ts:1300)
- camelCase field parsing (`teamAbbr`, `weekdayUtc`, `timeOfDayUtc`, `presetId`, `providerMode`)
- Preset-first persistence (`preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`)
- HTMX response contract (check for badge HTML, HX-Redirect header)
- Full-page route behavior (`GET /schedules`, `POST /schedules/new`, `POST /schedules/:id/edit`)
- Form rendering validation (check that depth_level and content_profile are NOT rendered in forms)

### Operator Mental Model Risk
A product manager or editor reviewing the test suite might think:
- **Via the tests:** "Schedules use depth_level and content_profile as first-class, tested fields."
- **Reality:** The canonical operator surface (`/config`) doesn't expose these fields in forms; they're persisted only via hidden defaults. The tests validate legacy semantics, not the intended preset-first model.

An engineer maintaining schedules might think:
- **Via the tests:** "The /api/schedules endpoint is the canonical API."
- **Reality:** `/api/settings/article-schedules` is the canonical operator surface, and it's not tested.

---

## JUDGMENT: Is /schedules Canonical, Derived, or Stale?

### Final Verdict

**`/schedules` is STALE.**

| Dimension | Status | Evidence |
|-----------|--------|----------|
| **Interaction model** | Stale | Full-page POST redirects (server.ts:2963–3027) vs canonical HTMX live feedback (server.ts:1300–1390). No inline error/success affordances. |
| **Field semantics** | Stale | Snake_case form names (schedules.ts:177–244) vs canonical camelCase (config.ts:368). Hidden editorial defaults (schedules.ts:142–144) vs explicit preset-first rendering (config.ts:396). |
| **Operator mental model** | Stale | `/schedules` suggests "schedule management in isolation" vs `/config` suggests "schedules as part of settings ecosystem." |
| **Discoverability** | Stale | Standalone nav link (location unclear). `/config?tab=schedules` is findable from Settings page. |
| **Editorial controls** | Stale | Depth/profile hidden in form defaults vs preset-first checkbox + fieldset in config. |
| **Test alignment** | Stale | Tests validate legacy routes and JSON API (intermediate) but not canonical HTMX routes (server.ts:1300–1390). |
| **Error affordances** | Stale | URL redirect `?error=` (schedules.ts:2975) vs inline badge (server.ts:1337). |

### Why Stale, Not Deprecated
`/schedules` is not yet fully deprecated because:
1. It serves full-page scheduled history visibility (renderScheduleDetailPage, schedules.ts:247–296) that `/config` tab doesn't expose
2. Legacy tests and JSON API still rely on it
3. There may be external integrations expecting `/api/schedules` JSON contract

### Canonical Surface
**`/config?tab=schedules`** is canonical because it:
- Uses HTMX (modern dashboard interaction pattern)
- Provides live feedback before navigation
- Integrates schedules into settings ecosystem
- Exposes editorial preset controls explicitly
- Returns proper HTMX response headers (HX-Redirect)

### Derived Surface
**`/api/schedules`** is derived because it:
- Is an intermediate JSON API used by tools, not operators
- Persists through the same shared `parseEditorialRequest()` normalizer as canonical
- Has test coverage but less operational relevance than either full UI surface

---

## Recommendations (Prioritized by Operator Impact)

### 🔴 Immediate (Breaks Operator Mental Models)

1. **Mark `/schedules` as compatibility-only in UI** — Add banner: "Use Settings → Schedules for the latest schedule management experience."
2. **Render depth_level + content_profile controls explicitly in `/schedules` form** OR document why they're hidden as hard-coded defaults. Operators should never persist data they cannot see.
3. **Test `/api/settings/article-schedules*` canonical HTMX routes** — Add test suite validating camelCase parsing, badge responses, and HX-Redirect headers.

### 🟡 Short-Term (Clarify Semantics)

1. **Deprecate full-page `/schedules` routes** with 2-sprint notice. Redirect to `/config?tab=schedules`.
2. **Unify field naming** — Adopt camelCase everywhere or snake_case everywhere. Currently the two surfaces use different conventions over identical data.
3. **Render schedule recent-runs history in `/config` tab** (currently only in `/schedules` detail page) so operators lose no visibility when migrating.
4. **Document schedule content_profile behavior** — "This setting affects generated article sizing but does not persist to created articles."

### 🟢 Long-Term (Consolidation)

1. **Retire `/schedules` entirely** — Redirect all traffic to `/config?tab=schedules`.
2. **Consider read-only `/api/schedules` endpoint** — Keep for external tools; remove from operator UI.
3. **Migrate schedule tests to `/api/settings/*` suite** — Test the canonical surface, not intermediate API.

---

## Evidence Summary

**Form rendering (hidden defaults):**
- `src/dashboard/views/schedules.ts:136–152` (form defaults v = schedule ?? {...})
- `src/dashboard/views/schedules.ts:177–244` (form inputs; only team_abbr, weekday_utc, time_of_day_utc, preset_id, provider visible)

**Canonical form (preset-first camelCase):**
- `src/dashboard/views/config.ts:328–430` (renderSchedulesTab)
- `src/dashboard/views/config.ts:368–399` (form with teamAbbr, weekdayUtc, timeOfDayUtc, presetId, providerMode)

**Route handlers (stale full-page vs canonical HTMX):**
- `src/dashboard/server.ts:2954–3027` (legacy /schedules routes, POST redirects)
- `src/dashboard/server.ts:1300–1390` (canonical /api/settings/article-schedules HTMX routes, HX-Redirect)

**Shared persistence:**
- `src/dashboard/server.ts:1027–1050` (parseEditorialRequest normalizer, shared by both surfaces)

**Depth labels & runtime collapse:**
- `src/dashboard/views/editorial-controls.ts:17–22` (LEGACY_DEPTH_LABELS, all 4 levels labeled)
- `src/types.ts:77–82` (DEPTH_LEVEL_MAP, depths 3 and 4 collapse to same tier)

**Test coverage gaps:**
- `tests/dashboard/schedules.test.ts:54–100` (validates /api/schedules JSON API and legacy routes only)
- Missing: tests for /api/settings/article-schedules*, camelCase parsing, HTMX response format, full-page /schedules routes

---

**Conclusion:** `/schedules` is **STALE**. Operators experience it as a separate full-page product with hidden defaults, no inline feedback, and no visual integration with settings. The canonical surface is `/config?tab=schedules` (HTMX-driven, live, preset-first). Recommend deprecation with operator-friendly migration path.


## Decision: ux-schedules-audit-evidence
# Schedule Audit — Compact Evidence Appendix

## 1. What /schedules Exposes That Other Surfaces Do Not

- **Full-page isolation vs integrated settings:** `/schedules` renders standalone schedule list + detail + edit pages (server.ts:2954–3027). `/config?tab=schedules` renders as one card in a tabbed settings page (views/config.ts:328–430). **Operator mental model:** Different feature boundaries and discoverability.
- **Recent runs visibility:** `/schedules` detail page shows schedule execution history (views/schedules.ts:270–292). `/config` tab has no runs visibility. **Impact:** Operator using `/schedules` can debug schedule execution; `/config` operator cannot.
- **Provider picker design:** `/schedules` single dropdown (views/schedules.ts:166–171). `/config` manages provider profiles on same page as schedule assignment (views/config.ts:338–343). **Impact:** Different mental model: "pick provider" vs "manage AND assign."

## 2. Defaults That Differ in Operator-Visible Ways

- **Hidden form defaults in `/schedules`:** Lines 136–152 set `depth_level: 1, content_profile: 'accessible', preset_id: 'casual_explainer'` but form renders only preset_id dropdown (lines 177–244). **Operator sees no depth/profile controls; commits invisible defaults.**
- **Field naming divergence:** `/schedules` form uses snake_case (`team_abbr`, `weekday_utc`, `time_of_day_utc`, `depth_level`, `content_profile`). `/config` form uses camelCase (`teamAbbr`, `weekdayUtc`, `timeOfDayUtc`, `presetId`, `contentProfile`) (views/config.ts:380–399). **Mental model:** Different naming suggests different data models to operator.
- **Error feedback timing:** `/schedules` redirects to `?error=missing+fields` (server.ts:2975; full-page reload required). `/config` returns inline HTMX badge `badge-verdict-reject` (server.ts:1337; instant feedback). **Operator experience:** Wait vs see-immediately.
- **Success feedback:** `/schedules` redirect + page reload with flash in query param (server.ts:3001). `/config` inline success badge, then HX-Redirect (server.ts:1334). **Operator perception:** Slow confirmation vs fast confirmation.

## 3. Legacy Depth/Profile Labels Misleading with Depth-4

- **Depth labels defined but no form control:** `LEGACY_DEPTH_LABELS` all four levels (1–4) in editorial-controls.ts:17–22. Neither `/schedules` nor `/config` renders depth input field (views/schedules.ts:142–161; views/config.ts:378–399). **Operator cannot set depth despite seeing labels.** Depth is phantom persistence.
- **Depth-4 ghost option:** Both surfaces persist `depth_level: 1–4` to same table but no form exposes depth choice. Depth 4 collapses to "deep_dive" at runtime (types.ts:77–82 `DEPTH_LEVEL_MAP`), identical to depth 3. **Operator sees Feature label in table (schedules.ts:110–112) but cannot create Feature schedules.**

## 4. HTMX Consequence: /config Canonical, /schedules Stale

- **Request/response contract divergence:** `/config` form: `hx-post="/api/settings/article-schedules"` (views/config.ts:368). Handler: `parseEditorialRequest(body, defaultDepth:2, contentProfile:null)` + returns HTMX badge + HX-Redirect (server.ts:1300–1334). `/schedules` form: `method="POST" action="/schedules/new"` (views/schedules.ts:177). Handler: direct field access + `parseEditorialRequest(body, defaultDepth:1, contentProfile:'accessible')` + `c.redirect()` (server.ts:2963–3001). **Live feedback vs page reload.**
- **Persistence defaults differ:** Canonical parses editorial from form fields with `defaultDepth: 2, contentProfile: null`. Legacy form hard-codes `depth_level: 1, content_profile: 'accessible'` before sending (views/schedules.ts:142–144). **Mental model mismatch:** Operator submitting legacy form commits values they never chose.

## 5. Tests Align with Legacy Depth, Not Canonical HTMX

- **Test coverage present (legacy only):** `GET /api/schedules` (schedules.test.ts:54–60). `POST /api/schedules` validates `depth_level`, `content_profile`, `preset_id` (schedules.test.ts:62–83). **Tests lock in legacy field semantics, not product truth.**
- **Test coverage absent (canonical):** No tests for `POST /api/settings/article-schedules` (server.ts:1300). No assertions on camelCase parsing (`teamAbbr`, etc.), badge responses, or HX-Redirect headers. **Canonical operator surface is untested.**
- **Test coverage absent (full-page UX):** No tests for `GET /schedules`, `POST /schedules/new`, `POST /schedules/:id/edit`, or form rendering (views/schedules.ts:177–244). **What operators actually see is not tested.**

---

## JUDGMENT

**`/schedules` is STALE**

| Dimension | Evidence |
|-----------|----------|
| **Interaction model** | Full-page POST redirects (server.ts:2963–3027) vs HTMX live feedback (server.ts:1300–1390). No inline affordances. |
| **Field semantics** | Snake_case hidden defaults vs camelCase explicit preset-first. |
| **Operator mental model** | "Isolated scheduling tool" vs "integrated settings component." Incompatible. |
| **Test alignment** | Tests validate legacy routes, not canonical operator surface. |

**Canonical surface:** `/config?tab=schedules` (HTMX-driven, live feedback, preset-first, integrated into settings ecosystem, tested operator contracts needed).


## Decision: ux-schedules-audit
# UX Schedules Audit — canonicality judgment

- **Decision:** Treat `/config?tab=schedules` as the canonical operator surface for schedule editing. Treat standalone `/schedules*` and `/api/schedules*` as compatibility/stale contracts until they are explicitly converged or retired.
- **Why:** Settings schedules is the only live surface aligned with the preset-first editorial model (`presetId`, `readerProfile`, `articleForm`, `panelShape`, `analyticsMode`, `panelConstraintsJson`, provider mode/override split, HTMX result handling, HX-Redirect back to the schedules tab). Standalone `/schedules*` edits the same records through a full-page contract with snake_case naming, redirect-only feedback, a collapsed provider field, different create defaults, and legacy compatibility copy that overstates depth/profile as primary truth.
- **Evidence:** `src/dashboard/views/config.ts:345-557`, `src/dashboard/views/schedules.ts:101-245`, `src/dashboard/server.ts:1257-1432`, `src/dashboard/server.ts:2954-3156`, `src/types.ts:76-127,218-260`, `tests/dashboard/schedules.test.ts:62-182`, `src/db/schema.sql:26-32,278-295`.
- **Operator impact:** The same schedule can be created or edited through two different mental models, with different defaults and different feedback loops. That increases training cost, weakens trust in “saved” state, and leaves tests anchored to the legacy route family instead of the canonical HTMX settings flow.
- **Follow-up guidance:** Future UX or Code work on schedule/editorial controls should audit `/config?tab=schedules` and `/schedules*` together, but take the Settings route family as product truth.


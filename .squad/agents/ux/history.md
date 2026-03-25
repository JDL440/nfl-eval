# History — UX

## Core Context

**Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform  
**Stack:** Hono, HTMX, SSE, CSS | **Port:** 3456 | **Owner:** Joe Robinson | **Repo:** JDL440/nfl-eval

**Key architectural facts:**
- Dashboard is primary human interface with editorial workflow
- Cover images: 1920×1080 (16:9) via Gemini 3 Pro in `src/services/image.ts` (STYLE_GUIDE controls prompts)
- Social OG images: controlled by Substack from ProseMirror draft_body first image2 node
- Publishing flow: Two-step (Draft → Publish) with explicit state transitions  
- Article detail: Status hub ("No draft yet" / "Draft ready" / "Published") with routing to richer preview or Substack draft
- Publish page: Single workflow container with Create Draft + Publish Now as distinct primary actions
- Agent selector (New Idea): Server-side filtering of expertAgents (10 NFL-wide specialists) from PROD (7) + TEAMS (32 team agents)
- Platform cropping varies: Twitter/X 2:1, LinkedIn 1.91:1 — center-weight critical elements
- Substack API may support separate `cover_image` field (future enhancement opportunity)

## Publish-Overhaul Team Coordination (2026-03-24)

**Team session:** Coordinated with Code, Publisher, Validation, and Coordinator agents on Stage 7 publish-flow architecture.

**Two-step UX model decision:** Submitted to `.squad/decisions.md`. Recommendation treats Stage 7 as explicit two-step workflow:
- Article detail: Clean status hub ("No draft yet" / "Draft ready" / "Published live") with routing actions
- Publish page: Single workflow panel with "Create Draft" and "Publish Now" as distinct primary actions

**Key UX improvements:**
- Richer preview reuse: Embed `/articles/:id/preview` rendering on publish page (cover, inline images, mobile toggle)
- Single workflow container: Fix HTMX target split (`#publish-actions` vs `#publish-result`) so draft creation and publish stay together
- Clearer copy: Action-first language ("No draft yet — create one to continue" vs "publish workspace")
- Error clarity: Explicit next-step guidance for each state (no draft, draft ready, published, error)

**Mental model improvements:**
- Distinguish lab preview page (local sanity check) from Substack draft (editable account) from go-live action (published)
- Remove redundant disabled-state tooltips that the page itself gates
- One unified "Publish" section on article detail instead of overlapping controls across detail + publish pages

**Status:** Recommendations merged to `.squad/decisions.md` as "Decision: Publish Flow UX — Two-Step Model with Explicit Workflow". Coordinator implemented all findings. Regressions passing.

- 2026-03-23T22:44:04Z — **Stage Badge Mismatch Investigation**: Investigated dashboard display inconsistency: article header badge used rticle.current_stage while Stage Runs panel showed stage + 1 from stored value. Investigation completed and handed off to Code for implementation. Decision: render Stage Runs using persisted stage_runs.stage directly, aligning with article/dashboard semantics. See .squad/orchestration-log/2026-03-23T22-44-04Z-ux.md.
- 2026-03-23T02-30-59Z — **Ralph Round 2 session**: Stage 7 publish-flow mental models and terminology review completed. Key findings: "publish workspace" is ambiguous/jargon; warning copy conflicts with intended two-step workflow; success states need stronger language. UX decision merged into decisions.md. Recommendations: rename/clarify workspace term, strengthen warnings, upgrade publish preview, add draft status indicator. Implementation pending Code's create-draft validation and Publisher's draft-first model adoption.
- 2026-03-23 — Publish config-error review: `src/dashboard/server.ts` intentionally returns HTTP 200 HTMX fragments for missing Substack config via `renderMissingSubstackConfig(...)`, while non-HTMX callers still receive JSON 500s.
- 2026-03-23 — `src/dashboard/views/publish.ts` follows the better dashboard pattern for operator-fixable publish failures when the primary alert stays terse (`Substack publishing is not configured.`) and the recovery steps live in a separate hint with the exact env vars and `/config` link.
- 2026-03-23 — Relevant files for publish error UX are `src/dashboard/views/publish.ts`, `src/dashboard/server.ts`, `src/dashboard/views/config.ts`, and `tests/dashboard/publish.test.ts`; the Config page is the established place to confirm env status for publishing integrations.

- 2026-03-23T04:12:59Z — **UX Dashboard Publish Review (read-only)**: Conducted exploratory review of dashboard publish/draft missing Substack configuration messaging. Examined HTMX vs JSON error surfacing patterns and adjacent dashboard conventions. **Findings:** (1) HTMX 500 responses do not swap publish panel—operators see raw failure instead of recovery guidance; (2) Adjacent panels use inline state messages for setup guidance (config status, missing credentials); (3) Recommended smallest actionable message: combine current error text with environment setup hints inline, no additional modals or redirects. **Outcome:** Read-only review completed. No code edits requested. Findings documented for Code decision on publish workflow error handling. See orchestration-log/2026-03-23T04-12-59Z-ux.md.
- 2026-03-23 — Accepted publish-page error handling pattern: for operator-fixable Substack config failures, keep JSON callers on HTTP 500 with the raw machine-readable error, but return an HTMX-swappable publish-workflow fragment with the short alert, exact env vars (`SUBSTACK_PUBLICATION_URL`, `SUBSTACK_TOKEN`), restart guidance, and `/config` link.
- 2026-03-23 — Exact validation commands for the final scoped publish fix: `npx vitest run tests/dashboard/publish.test.ts -t "creates the startup Substack service when publish env vars are present|returns an actionable HTMX message when Substack is not configured|returns error when SubstackService not configured|returns error when publishing without an existing linked Substack draft|shows empty state when no draft exists|renders publish preview page with article content"` and `npm run v2:build`.

### 2026-03-24T22-10-02Z: Scribe Cross-Agent Update — V3 Stage 1 Dashboard Audit

**Status:** All audit slices complete. Orchestration logs written. Session summary documented.

**Findings for UX:**
- Legacy `/htmx/recent-ideas` path (Stage-1-only) exists alongside `/htmx/continue-articles`
- `renderRecentIdeas()` delegates to `renderContinueArticles()` showing functional duplication
- No breaking issues; paths are fully examined in collaboration with Code slice
- Session log: `.squad/log/2026-03-24T22-10-02Z-dashboard-audit.md`
- Orchestration: `.squad/orchestration-log/2026-03-24T22-10-02Z-ux.md`

### 2026-03-23T04-16-31Z: Scribe Cross-Agent Update — Publish Config Fix Coordination

**Coordinated Session:** Multi-agent Publish Config investigation  

**UX decisions finalized and merged:**

1. **Publisher — Substack Dashboard Config UX Decision:** Detect service availability before rendering publish actions. Distinguish missing configuration from service-unavailability-despite-config. Use appropriate copy for each state (env-setup vs. editor-language).

2. **UX Decision — Publish Missing Config Copy:** Primary alert text should be short ("Substack publishing is not configured.") with actionable recovery details in separate hint (env var names, /config link, restart guidance).

**Design guidance:**
- Short error labels match adjacent dashboard patterns (scannable, repeatable)
- Separate alert from recovery hints prevents cluttered UI
- Consistent copy across publish page, config page, and error states
- HTMX responses enable in-panel error handling instead of raw 500s

**Validation:** Focused publish and server tests passed. Full build blocked by pre-existing src/cli.ts errors (unrelated). Both decisions merged to .squad/decisions.md.

- **2026-03-24: Generate Idea Page Inspection — Agent Selector Architecture**

**Focus:** UI/rendering path for the agent pin-selector on the New Idea page.

**Findings:**
- **Rendering files:** `src/dashboard/views/new-idea.ts` (renderNewIdeaPage, renderIdeaSuccess) and `src/dashboard/server.ts` (route `/ideas/new`)
- **Data source:** Expert agents list populated from `AgentRunner.listAgents()` filtered server-side (lines 849–860 in server.ts)
- **Filter logic:** Excludes two categories—PROD agents (lead, writer, editor, scribe, coordinator, panel-moderator, publisher) and TEAMS agents (32 lowercase team abbreviations: ari, atl, bal, buf, etc.)
- **NFL-wide agents (expert agents) visible in selector:** analytics, cap, collegescout, defense, draft, injury, media, offense, playerrep, specialteams (10 specialists)
- **Team agents:** 32 separate file-based agents with lowercase 3-letter abbreviations (sea, sf, gb, kc, etc.); separately selected via team grid (lines 166–172)
- **UI pattern:** Client-side JS toggle mechanics (toggleAgent, renderAgentChips) persist selection in hidden input `#pinned-agents`; CSS `.agent-badge` (lines 1017–1041 in styles.css) uses border-based chip design with selected state highlight
- **Mental model clarity:** Expert agents are labeled "Pin Expert Agents" (optional); teams are labeled separately as checkboxes; mental model is clear — agents pinned at idea-generation time, but teams are context separate from panel selection
- **No architectural issues found:** Selector properly gates NFL-wide agents, team agents remain available as roster context, no UI redress or logic errors detected
- **Data freshness:** Agent list is live from runner state; no stale agent names in markup — rendering happens fresh each request
- 2026-03-24 — Generate Idea selector UI path is still anchored in `src/dashboard/server.ts` GET `/ideas/new` and `src/dashboard/views/new-idea.ts`; the selector is server-rendered as plain buttons from `expertAgents`, then maintained client-side with `toggleAgent()`, `renderAgentChips()`, and `removeAgent()`.
- 2026-03-24 — The selector list is driven by `AgentRunner.listAgents()` against `config.chartersDir` (`<dataDir>\agents\charters\nfl`), not by a hardcoded frontend constant. Default seeded repo charters live in `src/config/defaults/charters/nfl/`, and the visible specialist set is whatever remains after the route excludes PROD names plus 32 team abbreviations.
- 2026-03-24 — New Idea does not sort `expertAgents` before rendering, so chip order follows filesystem / `readdirSync` order from the charters directory. If deterministic UX ordering matters, Code should sort in the route before calling `renderNewIdeaPage()`.
- 2026-03-24 — `src/dashboard/public/styles.css` defines `.agent-grid` twice: once for the New Idea chip row (`flex` layout at lines 1010–1015) and later globally for the Agents directory cards (`grid` layout at line 2009). Because the later selector is unscoped, it can override the selector layout on `/ideas/new`.
- 2026-03-24 — Current automated coverage in `tests/dashboard/new-idea.test.ts` verifies the page generally renders, but does not specifically assert expert-agent filtering, ordering, or chip rendering. Focused route/view tests would be needed to lock down selector behavior.

## Generate Idea Selector — Architecture Inspection (2026-03-24T05:37:47Z)

**Status:** Confirmed / No issues found

**Render path:** src/dashboard/views/new-idea.ts (renderNewIdeaPage, renderIdeaSuccess)  
**Server filtering:** src/dashboard/server.ts lines 847–861 (expert agents, live from runner)  
**Styling:** src/dashboard/public/styles.css (.agent-badge, .agent-grid)

**Assessment:** ✅ Clean architecture. No UX gaps. Mental model clear. Selector correctly separates NFL-wide specialists from production and team agents.

**Recommendation:** No changes required. Ready for implementation.

- 2026-03-24T05:41:29Z — **Generate-Idea Selector Trace Complete**: Full render-path investigation completed. Team picker source confirmed: static `NFL_TEAMS` in `src/dashboard/views/new-idea.ts`. Expert picker source confirmed: server-side `runner.listAgents()` filter in `src/dashboard/server.ts` lines 847–861. Render path clean from GET `/ideas/new` → `renderNewIdeaPage()` → team-grid + expert-grid templates. No UX gaps. Styling/layout watch-outs noted for responsive mobile. UX validation complete; handed off to Code for implementation. See `.squad/orchestration-log/2026-03-24T05-41-29Z-ux.md`.


## Learnings

- 2026-03-27 — **Dashboard mobile system audit refresh**: two cross-page drift sources are still especially important. First, preview mobile is mostly simulated rather than truly responsive: `src/dashboard/views/preview.ts` and `publish.ts` only toggle `.preview-container.preview-mobile`, while `src/dashboard/public/styles.css` leaves `.preview-toolbar`, `.detail-header`, and the outer publish/article shell desktop-shaped. Second, operator data surfaces diverge by page: `/runs` gets `.runs-table-wrap { overflow-x:auto; }`, `/config` renders raw `.artifact-table` blocks with no wrapper, and `/memory` only shrinks table font size at 768px. Treat preview chrome and data-surface behavior as shared mobile primitives, not page-by-page exceptions.
- 2026-03-26T00:00:00Z — **Dashboard mobile system audit (read-only)**: The biggest mobile failures are shared shell/CSS architecture gaps, not isolated page bugs. `src/dashboard/views/layout.ts` renders every page through one header shell, but `src/dashboard/public/styles.css` has no `.header-nav` rules and no mobile nav breakpoint, so all pages inherit the same cramped top bar. The stylesheet is also collision-prone: `.agent-grid` is defined both for New Idea chips and Agents directory cards, and the later global rule can override the earlier selector behavior. Across data-heavy pages, `src/dashboard/views/config.ts`, `src/dashboard/views/memory.ts`, and `src/dashboard/views/runs.ts` rely on desktop tables, while tests in `tests/dashboard/{server,new-idea,publish,runs,wave2}.test.ts` assert rendering/state flows but do not cover mobile layout, touch targets, or breakpoint behavior.

- 2026-03-26 — **Mobile dashboard audit complete** (`ux-dashboard-mobile-audit.md`). Root cause: dashboard is **desktop-first system**, not individual page bugs. Shell (fixed 56px header with 6 inline buttons) has no responsive breakpoint; grids stack on 768px but shell remains locked. Missing shared mobile patterns: header collapse/hamburger, table-to-card transforms, button tap targets (currently 6px 14px = <40px). HTMX partials inherit no mobile context. Minimum change set: responsive header in `layout.ts`, consolidated media-query system in `styles.css`, reusable mobile CSS library (cards, sidebars, buttons). Implementation sequence split UX (days 1–2: design patterns) and Code (days 3–7: shell, CSS system, page overrides, testing). No action taken yet; this is audit-only output.
- 2026-03-26 — Mobile dashboard audit: the shared dashboard failure is not one broken page but one desktop-first system. `src/dashboard/views/article.ts`, `home.ts`, `publish.ts`, `preview.ts`, `runs.ts`, `memory.ts`, `config.ts`, `agents.ts`, `new-idea.ts`, and `login.ts` all inherit the same tight horizontal toolbars, small action targets, large table surfaces, and inconsistent stacked hierarchy from `src/dashboard/public/styles.css`.
- 2026-03-26 — The article detail page needs page-specific mobile restructuring, not just a smaller grid. The action panel, stage timeline, artifact tabs, diagnostics sidebar, and send-back flow all compete at phone widths, so mobile should prioritize summary → primary action → current artifact, with usage/stage runs/advanced content collapsed behind secondary disclosures.
- 2026-03-26 — A reusable dashboard mobile pattern exists for this repo: compact sticky shell, page-header stack, full-width action groups, chip/toolbar horizontal scrollers only when intentional, and table-to-card transforms for operational data. Future dashboard work should treat mobile as the default layout and layer desktop density back in with wider breakpoints.
- 2026-03-26 — Shared shell evidence: `src/dashboard/views/layout.ts` renders six header controls plus the env badge in one `header-nav`, while `src/dashboard/public/styles.css` styles `.site-header`, `.header-inner`, `.btn-header`, and `.env-badge` but does not define `.header-nav` or any header breakpoint behavior. The fixed 56px header therefore remains a desktop-first row across every dashboard page.
- 2026-03-26 — Shared CSS-system gap: the main responsive layer in `src/dashboard/public/styles.css` is only the small `@media (max-width: 768px)` block around `.dashboard-grid`, `.detail-grid`, `.form-row`, `.checklist`, `.stage-timeline`, and `.form-row-2col`, plus a later memory-only tweak. Core mobile pain points on `/runs`, `/memory`, `/config`, `/publish`, `/articles/:id`, `/agents`, and `/ideas/new` trace back to missing shared patterns for nav, toolbars, action groups, and operational data surfaces rather than isolated page bugs.
- 2026-03-26 — HTMX composition amplifies system-level mobile issues: `renderRunsTable()`, `renderMemoryTable()`, `renderPublishWorkflow()`, `renderArticlePreviewFrame()`, and the live article partials are swapped independently, so mobile wrappers/patterns must live in shared fragments and CSS, not in page-only fixes. Current tests cover route behavior and workflow copy well, but the named dashboard suites do not assert mobile classes, breakpoints, overflow handling, or viewport-specific markup; a targeted dashboard test run also still has two unrelated failing auto-advance assertions in `tests/dashboard/new-idea.test.ts`.

### System-Level Mobile Findings (2026-03-26 Detailed Audit)

**5 Biggest Failures (in order of impact):**

1. **Header never shrinks** — `layout.ts` lines 44–56 render 7 items in one 56px row; `styles.css` lines 90–133 define zero mobile rules; `.header-nav` class is unstyled. Result: buttons overlap on 320px screens.

2. **Tables have no card fallback** — `styles.css` line 1660 `.runs-table-wrap { overflow-x: auto; }` is only mobile handling; zero card patterns. `/memory`, `/config` tables unprotected. Users scroll sideways to see stage/status columns.

3. **Single @media block covers 6 components** — Lines 827–835 only touch `.dashboard-grid`, `.detail-grid`, `.form-row`, `.checklist`, `.stage-timeline`, `.form-row-2col`. Missing: header, tables, filters, actions, agent chips, toolbars, composers.

4. **HTMX fragments bypass mobile context** — `/htmx/runs`, `/htmx/memory` return table-only; inherit `.content { max-width: 1280px; }` even at 320px. No fragment variants for mobile.

5. **Agent selector too small & collided** — `.agent-badge { padding: 5px 10px; }` = 24px height; below 44px tap minimum. Also `.agent-grid` defined twice (line 1010 flex, line 2009 grid) causes style collision when mobile rules added.

**CSS System Gaps:**

- No `@media (max-width: 480px)` for header collapse
- No `@media (max-width: 640px)` for table-to-card, button stacking
- No touch-target minimum rule (`min-height: 44px`)
- No mobile data-surface pattern

**Test Coverage:**

- Zero mobile class assertions in `tests/dashboard/*.test.ts`
- No breakpoint regression tests
- No touch-target size validation
- Two unrelated auto-advance failures in `new-idea.test.ts` (pre-existing)

**Concrete Files & Line Numbers:**

- Header: `layout.ts` 44–56, `styles.css` 90–133
- Responsive: `styles.css` 827–835 (single @media block)
- Tables: `styles.css` 1660–1676 (runs), 1740–1800 (memory)
- Actions: `styles.css` 569–570, 839–874
- Agents: `styles.css` 1010–1041 (new-idea), 2009 (agents, collision)
- Filters: `styles.css` 1594–1657

**Recommendation:** Phase 1 (UX) adds shared mobile CSS layer; Phase 2 (Code + UX) reorders article detail, publish workflow, HTMX fragments. No backend changes needed for Phase 1.

Full report: `.squad/decisions.md` (merged into "Decision: Dashboard Mobile Audit — Shared System Approach")

## 2026-03-25T03:29:17Z — Dashboard Mobile Audit (Read-Only, Merged)

**Status:** Complete audit, findings merged into `.squad/decisions.md`

**Scope:** UX conducted parallel read-only audit of dashboard mobile system across views, styles, HTMX fragments, responsive behavior, and test coverage.

**Findings (UX):**
- Shell-level failures: sticky header, primary nav collapse, page layout inconsistency
- Repeated patterns: data-table, action-group, filter patterns appear across pages without centralized mobile contract
- HTMX mismatch: partial renders don't inherit shell mobile behavior
- Overloaded selectors: `.agent-grid` used in two contexts with no mobile override
- Test gap: no viewport-specific assertions

**Key audit artifacts:**
- Orchestration log: `.squad/orchestration-log/2026-03-25T03-29-17Z-ux.md`
- Session log: `.squad/log/2026-03-25T03-29-17Z-dashboard-mobile-audit.md`
- Decision merged: ".squad/decisions.md" under "Dashboard Mobile Audit — Shared System Approach"

**Handoff:** Code audit ran in parallel; both audit outputs converged on same finding: mobile work is system-wide, not page-by-page. Recommendation: treat as shared-system rollout with explicit phase sequencing (shell → CSS primitives → HTMX fragments → page follow-through).

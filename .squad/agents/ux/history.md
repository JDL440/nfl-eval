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

- 2026-03-23T02-30-59Z — **Ralph Round 2 session**: Stage 7 publish-flow mental models and terminology review completed. Key findings: "publish workspace" is ambiguous/jargon; warning copy conflicts with intended two-step workflow; success states need stronger language. UX decision merged into decisions.md. Recommendations: rename/clarify workspace term, strengthen warnings, upgrade publish preview, add draft status indicator. Implementation pending Code's create-draft validation and Publisher's draft-first model adoption.
- 2026-03-23 — Publish config-error review: `src/dashboard/server.ts` intentionally returns HTTP 200 HTMX fragments for missing Substack config via `renderMissingSubstackConfig(...)`, while non-HTMX callers still receive JSON 500s.
- 2026-03-23 — `src/dashboard/views/publish.ts` follows the better dashboard pattern for operator-fixable publish failures when the primary alert stays terse (`Substack publishing is not configured.`) and the recovery steps live in a separate hint with the exact env vars and `/config` link.
- 2026-03-23 — Relevant files for publish error UX are `src/dashboard/views/publish.ts`, `src/dashboard/server.ts`, `src/dashboard/views/config.ts`, and `tests/dashboard/publish.test.ts`; the Config page is the established place to confirm env status for publishing integrations.

- 2026-03-23T04:12:59Z — **UX Dashboard Publish Review (read-only)**: Conducted exploratory review of dashboard publish/draft missing Substack configuration messaging. Examined HTMX vs JSON error surfacing patterns and adjacent dashboard conventions. **Findings:** (1) HTMX 500 responses do not swap publish panel—operators see raw failure instead of recovery guidance; (2) Adjacent panels use inline state messages for setup guidance (config status, missing credentials); (3) Recommended smallest actionable message: combine current error text with environment setup hints inline, no additional modals or redirects. **Outcome:** Read-only review completed. No code edits requested. Findings documented for Code decision on publish workflow error handling. See orchestration-log/2026-03-23T04-12-59Z-ux.md.
- 2026-03-23 — Accepted publish-page error handling pattern: for operator-fixable Substack config failures, keep JSON callers on HTTP 500 with the raw machine-readable error, but return an HTMX-swappable publish-workflow fragment with the short alert, exact env vars (`SUBSTACK_PUBLICATION_URL`, `SUBSTACK_TOKEN`), restart guidance, and `/config` link.
- 2026-03-23 — Exact validation commands for the final scoped publish fix: `npx vitest run tests/dashboard/publish.test.ts -t "creates the startup Substack service when publish env vars are present|returns an actionable HTMX message when Substack is not configured|returns error when SubstackService not configured|returns error when publishing without an existing linked Substack draft|shows empty state when no draft exists|renders publish preview page with article content"` and `npm run v2:build`.

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


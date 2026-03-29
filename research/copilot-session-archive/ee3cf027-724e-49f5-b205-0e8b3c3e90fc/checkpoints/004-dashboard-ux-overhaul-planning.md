<overview>
The user requested a complete v2 replatform of the nfl-eval project (NFL Content Intelligence Platform), moving from a Copilot CLI-coupled architecture to a proper TypeScript application with separated data/source, deterministic pipeline logic, pluggable LLM providers, a rich dashboard, and multi-sport extensibility. After the initial 762-test implementation was complete, the user found bugs in the live dashboard and requested fixes, e2e tests, and now a major dashboard UX overhaul. I've been executing this as a phased fleet deployment, fixing bugs as discovered, and am now planning the next iteration focused on dashboard UX improvements.
</overview>

<history>
1. User asked for a holistic architectural analysis and v2 replatforming plan
   - Explored entire repository: content/, dashboard/, mcp/, shared/, .squad/, .github/, ralph/
   - Produced 46K-char research report identifying 6 structural problems, 47 agents, 23 skills, 17 business rules
   - Proposed v2 architecture: Pipeline Engine (state machine), LLM Gateway (multi-provider), Agent Runner, Service Layer, Dashboard v2

2. User refined the plan with specific feedback
   - Local-first priority, NOT Kanban dashboard — centered on idea submission + publish actions
   - Agent history: simplify 47 history.md files to structured SQLite memory.db
   - Charters & skills should move to data dir for versioning
   - Multi-sport extensibility: "league" as first-class concept
   - Created refined plan.md with 29 todos across 6 phases

3. User approved plan and requested full fleet implementation
   - **Wave 1 (Foundation):** 5 agents — project setup, data dir, DB layer, artifact scanner, model policy → 141/141 tests
   - **Wave 2 (Core):** 9 agents — engine, LLM gateway, agent memory, dashboard, services → 510/510 tests
   - **Wave 3 (Integration):** 8 agents — agent runner, scheduler, audit, SSE, providers, MCP, migration → 664/664 tests
   - **Wave 4 (Final):** 5 agents — article detail, idea form, publish workflow, stage actions, CLI → 751/751 tests
   - **Wave 5 (E2E):** 1 agent — end-to-end integration test → 762/762 tests

4. User tried running the dashboard, got "idea.md does not exist" error when advancing
   - Diagnosed root cause: THREE idea creation endpoints had bugs:
     a. `POST /htmx/ideas` legacy inline form — created DB record but never wrote idea.md to disk
     b. `POST /api/articles` — same issue, no idea.md written
     c. The home page inline form sends `id`+`title` without `description`, triggering the legacy code path
   - Fixed both server.ts code paths to create directory + write idea.md
   - Also fixed the user's stuck article (`strength-of-schedule-made-them`) by creating its missing idea.md
   - Created `tests/e2e/live-server.test.ts` — 20 tests exercising HTTP lifecycle
   - All 782/782 tests passing

5. User asked for a test that advances through ALL stages
   - Created `tests/e2e/full-lifecycle.test.ts` — 43 tests covering:
     - Happy path Stage 1→8 with every guard tested (positive and negative)
     - Editor review variants (numbered files, bold format, emoji format, REVISE/REJECT blocking)
     - JSON API advance lifecycle
     - Draft word count boundary (799 rejected, 800 accepted)
     - Publisher pass granularity (12 individual check field failures)
     - Concurrent articles without cross-contamination
   - Fixed two minor test assertion issues (slug generation, response shape)
   - All 825/825 tests passing across 29 files

6. User asked about moving artifacts from filesystem to DB-only storage
   - Explored all read/write locations for .md artifacts across codebase
   - Recommended hybrid approach (DB source of truth + optional export)
   - User wasn't available to confirm; left architecture unchanged

7. User's LATEST request (current — not yet implemented):
   - Dashboard "doesn't work nearly like it's supposed to" — more bugs exist
   - Wants to DROP filesystem artifact files entirely (they cause issues)
   - Major dashboard UX overhaul requested:
     a. **Idea submission**: No slug/title needed — write a prompt, LLM generates title+slug
     b. **Team selection**: Better multi-team add/remove control
     c. **Auto-advance**: Toggle to auto-advance from Stage 1→7
     d. **Rich publish view**: Preview article, compose Substack Note + Twitter post, submit
     e. **Missing v1 features**: Token usage/cost tracking, artifact viewing, pipeline visualization
     f. **Multiple iterations** to make it a great experience
   - Explored old v1 dashboard to catalog missing features (token telemetry, browser validation, artifact tabs, batch publishing, notes/Twitter tracking, search/filter, KPI strip, drift detection)
</history>

<work_done>
## Files Created in v2 (40+ source files, ~10K lines):

### Foundation
- `src/types.ts`, `src/config/index.ts`, `src/config/defaults/models.json`, `src/config/defaults/leagues.json`
- `src/db/schema.sql` (255 lines — articles, stage_transitions, article_runs, stage_runs, usage_events, article_panels, discussion_prompts, editor_reviews, publisher_pass, notes, pipeline_board view)
- `src/db/repository.ts` (~480 lines — full port of pipeline_state.py)
- `src/pipeline/artifact-scanner.ts`, `src/llm/model-policy.ts`

### Pipeline Engine
- `src/pipeline/engine.ts` — 8 guard functions, TRANSITION_MAP, PipelineEngine class
- `src/pipeline/scheduler.ts`, `src/pipeline/audit.ts`, `src/pipeline/actions.ts`

### LLM Gateway
- `src/llm/gateway.ts`, `src/llm/providers/stub.ts`, `src/llm/providers/anthropic.ts`
- `src/llm/providers/openai.ts`, `src/llm/providers/copilot.ts`, `src/llm/providers/gemini.ts`, `src/llm/providers/local.ts`

### Agent System
- `src/agents/memory.ts`, `src/agents/memory-schema.sql`, `src/agents/runner.ts`

### Dashboard
- `src/dashboard/server.ts` — Hono app with HTML pages, API routes, htmx partials, publish workflow
- `src/dashboard/views/layout.ts`, `src/dashboard/views/home.ts`, `src/dashboard/views/article.ts`
- `src/dashboard/views/new-idea.ts`, `src/dashboard/views/publish.ts`
- `src/dashboard/sse.ts`, `src/dashboard/public/styles.css`

### Services
- `src/services/substack.ts`, `src/services/prosemirror.ts` (37.8KB), `src/services/twitter.ts`
- `src/services/image.ts`, `src/services/data.ts`

### Integration
- `src/mcp/server.ts`, `src/migration/migrate.ts`, `src/cli.ts`, `src/index.ts`
- `services/data-sidecar/main.py`, `services/data-sidecar/requirements.txt`

### Tests (29 files, ~10K lines, 825 tests)
- All passing: 825/825 across 29 test files

## Files Modified:
- `src/dashboard/server.ts` — Fixed idea.md creation bug in legacy htmx form path (lines ~350-364) and `/api/articles` endpoint (lines ~154-161). Added `mkdirSync` + `writeFileSync` for idea.md in both paths.
- `package.json` — Added v2 scripts and dependencies
- `tsconfig.json`, `vitest.config.ts` — Created for v2

## Current State:
- ✅ 825/825 tests passing
- ✅ TypeScript compiles clean
- ✅ Pipeline engine works correctly through all 8 stages (verified by 43-test lifecycle suite)
- ❌ Dashboard UX is bare-bones — missing many v1 features
- ❌ Filesystem artifacts still causing issues (user wants DB-only)
- ❌ Idea form requires manual slug/title (user wants LLM-generated)
- ❌ No auto-advance feature
- ❌ Missing: token usage, rich artifact viewer, publish preview with Note/Twitter
</work_done>

<technical_details>
### Architecture
- **CJS project** — `package.json` has `"type": "commonjs"`, tsconfig `"module": "NodeNext"`. All imports MUST use `.js` extensions. Use `__dirname` not `import.meta.url`.
- **node:sqlite** (Node 22+ built-in `DatabaseSync`) — zero-dependency SQLite
- **Hono + htmx** for dashboard — server-rendered HTML, no JS framework
- **$DATA_DIR abstraction** — default `~/.nfl-lab/`, configurable via `NFL_DATA_DIR` env var
- **League as first-class concept** — `league` column in articles, `leagues/{league}/` in data dir

### Key Path Architecture
- `config.articlesDir` = `$DATA_DIR/leagues/{league}/articles/`
- `config.dbPath` = `$DATA_DIR/pipeline.db`
- PipelineEngine: `join(this.articlesDir, articleId)` for each article dir

### Pipeline Stage Model (8 stages)
1. Idea Generation → 2. Discussion Prompt → 3. Panel Composition → 4. Panel Discussion → 5. Article Drafting → 6. Editor Pass → 7. Publisher Pass → 8. Published

### Guard Chain (each transition requires):
- 1→2: idea.md exists and non-empty
- 2→3: discussion-prompt.md exists
- 3→4: panel-composition.md exists
- 4→5: discussion-summary.md exists
- 5→6: draft.md ≥800 words
- 6→7: editor-review*.md with APPROVED verdict (supports numbered files, bold/emoji format)
- 7→8: publisher_pass with all 12 boolean checks=1 AND publish_datetime set

### Critical Bug Found & Fixed
- **Root cause**: Home page inline form sends `id`+`title` (no `description`), triggering `isLegacyForm` path in `/htmx/ideas` that created DB record but never wrote idea.md or created the article directory
- **Fix**: Added `mkdirSync` + `writeFileSync` to legacy form path and `/api/articles` endpoint
- **Lesson**: Filesystem-based artifact storage is fragile — user wants to move to DB-only

### DB Schema Includes (already created but underused)
- `usage_events` table with prompt_tokens, output_tokens, cached_tokens, cost_usd_estimate, image_count — ready for token tracking display
- `notes` table with article_id, note_type, content, substack_note_url — ready for Notes/Twitter tracking
- `article_runs` and `stage_runs` tables — ready for run tracking

### Editor Verdict Parsing
- Regex patterns in artifact-scanner.ts lines 98-104: supports `## Final Verdict: APPROVED`, `**APPROVED**`, `✅ APPROVED`
- Uses highest-numbered editor-review file (editor-review-3.md > editor-review.md)

### Publisher Pass Checks (12 boolean fields + publish_datetime)
- title_final, subtitle_final, body_clean, section_assigned, tags_set, url_slug_set, cover_image_set, paywall_set, email_send, names_verified, numbers_current, no_stale_refs

### V1 Dashboard Features Missing from V2 (from detailed exploration)
- Token/cost telemetry (comprehensive breakdowns by surface/stage)
- Browser validation (editor schema + mobile rendering checks)
- Rich article preview with Substack-like styling and warnings
- Notes/Twitter tracking and display
- KPI strip, drift detection, batch publishing
- Search/filter/status organization
- Rich artifact tabs (Overview, Panel, Draft, Assets, Publish, Validation)

### Table Separator Regex
- MUST be `/^:?-+:?$/` (1+ dashes). Short separators like `:--` and `--:` are valid GFM.
</technical_details>

<important_files>
- `src/dashboard/server.ts`
   - Central dashboard server — ALL routes: HTML pages, JSON API, htmx partials, publish workflow
   - Fixed idea.md creation bug in legacy form path (~line 356) and /api/articles (~line 162)
   - `createApp(repo, config)` factory, `startServer()` entry point
   - This file will need MAJOR changes for the UX overhaul

- `src/pipeline/engine.ts`
   - Deterministic state machine — guards at lines 73-189, TRANSITION_MAP at 193-236, PipelineEngine at 244+
   - Guards currently check FILESYSTEM for artifacts — will need to change if moving to DB-only
   - `requireIdea()` line 73, `requireDraft()` line 115 (800-word check), `requireEditorApproval()` line 135

- `src/dashboard/views/home.ts`
   - Home page rendering — 4 sections: Ready to Publish, Pipeline, Recent Ideas, Published
   - Inline idea form at line 191 — sends `id`, `title`, `primary_team` (will be replaced with prompt-based form)

- `src/dashboard/views/new-idea.ts`
   - Full idea form with validation — team dropdown, depth selector
   - `generateSlug()` at line 23, `validateIdeaForm()` at line 49
   - Will need complete redesign for prompt-based idea submission

- `src/dashboard/views/article.ts`
   - Article detail with stage timeline, artifact tabs, action panel, audit log
   - ARTIFACT_FILES constant at line 14
   - Will need enrichment: token usage, richer artifact display

- `src/dashboard/views/publish.ts`
   - Publish preview and workflow — currently basic
   - Needs: article preview, Note composition, Twitter compose

- `src/dashboard/public/styles.css`
   - Light theme CSS with custom properties (26 vars)
   - Will need significant expansion for new UX components

- `src/db/schema.sql`
   - Full v2 schema (255 lines) — articles, usage_events, notes, publisher_pass, etc.
   - Will need new `artifacts` table if moving to DB-only storage

- `src/db/repository.ts`
   - ~480 lines, all DB mutations
   - Key methods: createArticle, advanceStage, recordPublisherPass, getPublisherPass
   - Will need artifact CRUD methods if moving to DB storage

- `tests/e2e/full-lifecycle.test.ts`
   - 43 tests advancing article through all 8 stages with every guard variant
   - Tests both htmx and JSON API paths
   - Publisher pass granularity: all 12 check fields individually tested

- `tests/e2e/live-server.test.ts`
   - 20 tests exercising HTTP lifecycle — idea creation via all 3 endpoints, advance, validation

- `src/pipeline/actions.ts`
   - Stage transition actions using AgentRunner — reads/writes artifact files
   - Will need updating if moving to DB-only artifacts

- `src/llm/gateway.ts`
   - LLMGateway with chat(), chatStructured(), provider routing, fallback
   - Needed for the new prompt→title/slug LLM feature
</important_files>

<next_steps>
## The user's explicit latest request (NOT yet started):

Major dashboard UX overhaul with multiple iterations:

### Priority 1: Core UX Fixes
1. **Move artifacts to DB** — Add `artifacts` table, update engine guards to check DB instead of filesystem, update actions to write to DB, eliminate filesystem path bugs entirely
2. **Prompt-based idea submission** — Replace slug+title form with a freeform prompt textarea; use LLM gateway to generate title and slug from the prompt
3. **Multi-team selector** — Replace single dropdown with tag-style add/remove control for multiple teams
4. **Auto-advance toggle** — When enabled, automatically advance article from Stage 1→7 (stop before publish)

### Priority 2: Publish Experience
5. **Rich publish preview** — Render article with Substack-like styling, show warnings
6. **Note + Twitter compose** — Compose and submit Substack Note and Twitter post from publish page
7. **Publish workflow completion** — Handle Stage 7→8 transition with all publisher pass checks

### Priority 3: Missing v1 Features
8. **Token usage display** — Show cost/usage from `usage_events` table (schema already exists)
9. **Rich artifact viewer** — Tabbed view with rendered markdown, file metadata
10. **Pipeline visualization** — KPI strip, drift detection, better stage summary

### Approach
- Work iteratively — implement each priority group, test, show user, get feedback
- Start by understanding what's currently broken in the UX beyond what we already fixed
- The user explicitly said "multiple iterations" — expect feedback loops

### Blockers/Questions
- How should the LLM-generated title work? Immediate API call on form submit? Or async with loading state?
- Which LLM provider should be used for title generation? (Stub for tests, but what for prod — Copilot?)
- Should auto-advance run synchronously or as a background job with progress updates via SSE?
- Does "auto-advance" mean the LLM actually generates each artifact, or just advances stages when artifacts already exist?
</next_steps>
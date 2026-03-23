# History — Lead

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/config/defaults/charters/nfl/` (47 pipeline agents), `src/dashboard/` (Hono UI), `src/pipeline/` (article pipeline), `tests/` (vitest)

## Learnings

- Team initialized 2025-07-18 with functional role names (Lead, Code, Data, Publisher, Research, DevOps, UX)
- @copilot enabled with auto-assignment for well-scoped issues
- Joe Robinson is the human Product Owner / Tech Lead with final decision authority

### 2026-03-22: Issue #85 — Structured Domain Knowledge Scope Lock

- Issue #85 is intentionally limited to static proof-of-concept assets plus docs/tests: glossary YAML files under `src/config/defaults/glossaries/` and initial team sheets under `content/data/team-sheets/`.
- Keep #85 out of runtime code paths: no `src/agents/runner.ts`, `src/pipeline/actions.ts`, or refresh automation changes unless strictly needed for lightweight references or validation.
- Treat `tests/config/` as the likely home for structure-validation tests, since this slice validates seeded/static knowledge assets rather than pipeline behavior.
- The repo currently has no YAML dependency in `package.json`, so glossary structure should stay simple enough for lightweight validation without introducing runtime integration.
- Deferred Phases 4-5 are now tracked in GitHub issue `#91` (runtime glossary/team-sheet injection plus refresh automation).

### 2025-07-19: Triage Round 1 — 5 non-article project issues

**Closed as complete (already implemented in v2):**
- **#73** (nflverse integration) — Fully shipped: 11 MCP tools, 11 Python query scripts, TypeScript DataService, 20+ cached parquet files. Every research question answered.
- **#72** (Substack Notes) — Fully shipped: `publish_note_to_substack` MCP tool, `SubstackService.createNote()`, `notes` DB table, dashboard Note composer, API endpoint.

**Routed for work:**
- **#81** (Token Usage UX broken) → `squad:ux`. Usage tracking infrastructure exists (`usage_events` table, `renderUsagePanel`) but likely has display/accuracy bugs, especially with multi-provider cost reporting. Imagen provider throws runtime error.
- **#76** (Mass Document Update Service) → `squad:code`. Significant 4-phase feature. Some batch processing exists (PipelineScheduler, migration) but not the full catalog-wide find-and-replace with Substack sync described in the issue.
- **#70** (Social link image generation) → `squad:ux`. Cover image generation works (Gemini 3 Pro) but needs style standardization using Witherspoon article as reference, plus platform-specific OG preview auditing.

**Key finding:** The v2 platform is more capable than the backlog reflects. Two major research spikes (#72, #73) were fully implemented but never closed. Future triage should cross-check the codebase before assuming issues are still open work.

### 2026-03-22: Issue #88 — Pipeline Conversation Context (Investigation & Triage)

**By:** Lead (🏗️)

**What:** Created comprehensive GitHub issue (#88) for a 4-phase feature to add persistent per-article conversation history and agent context reuse across revision cycles.

**Investigation Findings:**
- **Current revision flow (actions.ts lines 605-850):** Detects revision by checking if `editor-review.md` exists, includes current editor feedback in writer prompt, but no multi-iteration history. When editor sends back REVISE, system regresses to stage 4 but rebuilds entire context from scratch on next writer call—losing the trail of "what did editor say in iteration 1, 2, 3?"
- **AgentRunner prompt composition (runner.ts lines 279-381):** Rebuilds system prompt from scratch on every call by loading charter, skills, and global agent memories. Messages array (lines 378-381) contains only `[system, user]`—no conversation history. No per-article context stack mechanism.
- **Database schema (schema.sql):** `editor_reviews` table tracks review number (line 169) but doesn't store full review text or context. `stage_runs` records execution metadata but not per-iteration agent context or conversation state. No table for "conversation thread" or "agent context stack" per article.
- **Agent memory (src/agents/memory.ts):** Stores learnings globally by agent, not per-article. Recall doesn't prioritize article-specific context.

**Problem Statement:**
1. Writer doesn't see editor's *previous* feedback—only current feedback
2. Editor doesn't see its own prior reviews ("I already flagged this in iteration 1")
3. Context re-injected on every call (re-reads panel discussion, draft, feedback, roster)—wastes ~30% of tokens per agent call
4. No mechanism to maintain coherent feedback loops across iterations

**Proposed Solution (4 phases):**
1. **Schema:** Add `article_conversations` (store per-article message history), `article_context_stack` (per-iteration context), `revision_summaries` (iteration outcomes)
2. **Agent Runner:** Accept `conversationHistory` parameter, pass full message chain to LLM Gateway instead of just system + user
3. **Pipeline Actions:** Update `writeDraft()` and `runEditor()` to load/store conversation, build revision summary context block
4. **Observability:** Add conversation view to dashboard, track iteration count, measure token savings

**Scope:** Affects ALL agents and stages (writer, editor, publisher, future research agents)—not just editor pass.

**Goals:**
1. Improve article generation quality—coherent feedback across iterations
2. Reduce revision count—better context → fewer back-and-forth cycles
3. Reduce token usage—conversation history vs. re-injection saves ~30% per call
4. Increase observability—see full revision history

**Status:** Issue #88 created and triaged. Labeled `squad:lead,squad:code`. TLDR comment posted per team decision. Ready for architectural review before assignment.

### 2026-03-22: Session Completion & Issue #88 Status

**Session context:** 7-agent spawn manifest completed. Code implemented 2 issues (#82 publish fix, #83 fact-check pipeline). Research/DevOps/UX completed investigations for issues #85, #83, #76, #70 — all labeled go:yes.

**Issue #88 status:** Created and triaged. Awaiting architectural review and PO decision on 4-phase approach before assignment.

### 2026-03-22: Issue #85 Scope Split — Runtime Integration and Refresh Deferred

**By:** Lead (🏗️)

**What:** Joe explicitly narrowed `#85` to Phases 1-3 plus docs/testing (Phase 6). Created follow-up issue `#91` to hold the deferred Phase 4 runtime integration work and Phase 5 monthly refresh automation.

**Phases deferred to #91:**
- **Phase 4:** Load glossaries in `src/agents/runner.ts`, generate/inject `team-identity.md` from `src/pipeline/actions.ts`, and route that artifact through `src/pipeline/context-config.ts` so runtime prompts actually receive the new knowledge assets.
- **Phase 5:** Add `scripts/refresh-domain-knowledge.ts` plus scheduled workflow automation and refresh audit logging so glossary/index facts can be kept current without manual edits.

**Pattern to reuse:** When a multi-phase architecture issue is intentionally narrowed midstream, keep the active issue tightly scoped to the approved phases, create a separate linked backlog issue for the deferred phases, and leave a short TL;DR comment on the parent issue so future implementers do not blur the boundaries.

### 2026-03-22T18-23-26Z: Issue #85 decision sync
- Scribe completed the decision inbox merge, archived old decision history, and logged the session/orchestration notes.
- The active #85 record now stays centered on static KB assets and their validation surface.
- Deferred runtime integration remains outside the current scope boundary.

### 2026-03-23: Issue #110 triage — stage-run total timing
- Confirmed the request is a UI aggregation pass over existing `stage_runs` timestamps, not a persistence problem.
- The next implementation owner should be UX once #109 lands, because the change belongs in the article detail timing presentation rather than new backend storage.
- Keep the scope limited to a clear article-level total, with any per-state breakdown treated as optional follow-up if it stays cheap.
### 2026-03-23T01:23:06Z: Issue #110 routing follow-up
- Routed #110 as a UX dashboard follow-up after #109, with no new schema work required.
- Kept the timing-total work aligned with the existing article-detail implementation seam.

### 2026-03-23T02:17:46Z: Issue #102 auth direction locked

**By:** Lead (🏗️)

Research completed comprehensive analysis of issue #102 (dashboard auth hardening). Decision submitted to `.squad/decisions.md`:

**Direction:** Single-operator local login with Hono middleware, opaque session cookies, SQLite persistence, and config-driven enable/disable.

**Why:** Current dashboard has no auth seam. Recommendation aligns with owner's preference ("simple local login for now"), fits Hono + SQLite architecture, and defers OAuth/RBAC to future.

**Deferred for Code:** Implementation tracked as Issue #102 follow-up after decision lock.

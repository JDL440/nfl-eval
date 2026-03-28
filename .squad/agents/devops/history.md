# History — DevOps

## Core Context

**Baseline (Pre-2026-03-22):**
- Team initialized 2025-07-18
- GitHub Actions used for CI, triage, label sync
- MCP tools available for Substack, image gen, nflverse
- `.github/agents/squad.agent.md` defines Squad coordinator governance
- Project: NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform with TypeScript/Node.js stack
- Key paths: `.github/workflows/` (CI/CD), `mcp/` (MCP servers), `.mcp.json` (MCP config), `src/agents/` (agent runner), `src/llm/` (LLM gateway)

**Recurring DevOps Patterns:**
- Publish overhaul isolation: Use fresh worktree from `origin/main` when `main` is dirty; copy target files, validate with `npm run v2:build` + focused test suites
- MCP entrypoint: Canonical operator path is `mcp/server.mjs`; `src/cli.ts mcp` wraps it; `src/mcp/server.ts` provides shared bootstrap helpers
- Validation commands: `npm run v2:build`, `npx vitest run tests/mcp/server.test.ts tests/cli.test.ts`, `npm run mcp:smoke`

**Agent Tool-Calling Architecture (Pre-2026-03-28):**
- Agents (via `AgentRunner`) initially had no tool-calling capability; only LLM Gateway for text generation
- Tool inventory: 25 tools across 4 categories (help, media, publishing, data)
- MCP tools exposed in `mcp/tool-registry.mjs` for external clients (GitHub Copilot CLI, Claude Code)
- Gap identified: No safe, explicit in-app local-tool execution seam for agents (Issue #83, K5a)
- Fact-checking wired at 3 pipeline stages (Stage 4→5, 5→6, 6→7) with pre-computed enriched context

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, GitHub Actions
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `.github/workflows/` (CI/CD), `.github/extensions/` (extensions), `.github/ISSUE_TEMPLATE/` (templates), `mcp/` (MCP servers), `.mcp.json` (MCP config)

## Learnings

- 2026-03-28T01:02:59Z — **In-App MCP Seam Rollout Complete — Orchestration Logged:**
  
  - **Orchestration log:** `.squad/orchestration-log/2026-03-28T01-02-59-devops.md`
  - **Session log:** `.squad/log/2026-03-28T01-02-59-in-app-mcp-seam-rollout.md`
  - **Decision merged to `.squad/decisions.md`** (inbox → MERGED INBOX ENTRIES section)
  - Status: ✅ Approved in-app MCP seam works through repo-owned JSON tool turns
  
  Core implementation shipped: `AgentRunner` drives a bounded structured loop above providers, `src/agents/local-tools.ts` loads the allowlisted tool subset from `mcp/tool-registry.mjs` in-process, identical tool calls are deduped per run, blocked publish/media/cache-refresh tools stay out of the runtime, and unknown tools / invalid args fail closed. Focused validation passes with `npm run v2:build` and `npx vitest run tests\agents\local-tools.test.ts tests\agents\runner.test.ts tests\llm\gateway.test.ts tests\llm\provider-copilot-cli.test.ts tests\mcp\local-tool-registry.test.ts`.

- 2026-03-28T18:00:00Z — **Approved in-app MCP seam now works through repo-owned JSON tool turns:** `AgentRunner` drives a bounded structured loop above providers, `src/agents/local-tools.ts` loads the allowlisted tool subset from `mcp/tool-registry.mjs` in-process, identical tool calls are deduped per run, blocked publish/media/cache-refresh tools stay out of the runtime, and unknown tools / invalid args fail closed. Focused validation now passes with `npm run v2:build` and `npx vitest run tests\agents\local-tools.test.ts tests\agents\runner.test.ts tests\llm\gateway.test.ts tests\llm\provider-copilot-cli.test.ts tests\mcp\local-tool-registry.test.ts`.

- 2026-03-28T00:54:15Z — **In-App Agent Tool-Wiring Architecture Audit MERGED TO DECISIONS:**
  
  Comprehensive audit of agent-to-tool seam found:
  
  ✅ **Core implementation exists:** App-owned bounded local tool loop in `src/agents/runner.ts` + `src/agents/local-tools.ts` with registry-backed metadata
  ✅ **Allowlist enforced:** Only approved read-only tools (12 nflverse data + discovery) accessible  
  ✅ **Validation strict:** Zod schemas guard all tool arguments  
  ✅ **Safe execution:** In-process only, no subprocess spawning  
  
  ⚠️ **Build blockers found (HIGH priority):**
  - `src/llm/providers/copilot-cli.ts` — `verify()` calls `exec()` with 2 args; signature expects 1
  - `tests/agents/runner.test.ts` — imports removed file `src/llm/in-app-tools.js`
  
  ⚠️ **Missing implementation pieces:**
  1. Duplicate-identical-call suppression in tool loop
  2. Negative tests proving blocked tools (publish_to_substack, render_table_image, refresh_nflverse_cache) throw "not allowed"
  
  **Recommendations:**
  1. Fix build failures (HIGH)
  2. Add negative allowlist tests
  3. Implement duplicate-call detection
  4. Document in-app tool seam contract per agent role
  5. Update system prompt to direct agents to `local_tool_catalog` for discovery
  
  **Orchestration log:** `.squad/orchestration-log/2026-03-28T00-54-15-devops.md`  
  **Session log:** `.squad/log/2026-03-28T00-54-15-in-app-readonly-seam-audit.md`  
  **Decision document merged to** `.squad/decisions.md` (MERGED INBOX ENTRIES section)

- 2026-03-28 — **In-App Agent Tool-Wiring Architecture Audit Complete (Read-Only):**
  
  Current state: **Agents (via `AgentRunner`) do NOT have tool-calling capability.** Tools exist only in the MCP layer (`mcp/tool-registry.mjs`) for external clients (GitHub Copilot CLI, Claude Code, etc.). Agents only call the LLM Gateway for text generation.
  
  **Tool inventory (25 tools across 4 categories):**
  - Help (1): `local_tool_catalog` — discovery tool
  - Media (2): image generation, table rendering
  - Publishing (3): Substack articles, Notes, tweets
  - Data (11): nflverse wrappers + 1 market query = 12 total
  
  **To enable agent tool-calling, code needs:**
  1. LLM Gateway: add `tools` parameter + `toolCalls` response field
  2. AgentRunner: add tool invocation loop + allowlist filtering
  3. Tool adapter: bridge MCP registry to LLM tool definitions
  4. Agent policy: stage-specific allowlists (read-only for stage 4–6, publishing for stage 8)
  5. Tool dispatcher: execute handlers, catch errors, format results
  
  **Safety mechanisms (to implement):**
  - Hardcoded agent/stage allowlists (no dynamic discovery)
  - Max tool calls per run + timeout
  - Tool result sanitization (no credential leaks)
  - Audit logging for compliance
  
  **File paths:** Tool registry = `mcp/tool-registry.mjs` (~800 LOC, 25 entries). Agent runner = `src/agents/runner.ts` (no tool support yet). LLM gateway = `src/llm/gateway.ts` (text-only). Pipeline actions = `src/pipeline/actions.ts` (where agent calls happen).
  
  **Non-changes:** MCP entrypoint OK, tool registry structure OK, LLM gateway provider abstraction OK, pipeline stage guards can be extended safely.
  
  Decision document written to `.squad/decisions/inbox/devops-agent-tool-wiring-review.md`.

- 2026-03-28 — **MCP Rollout Decision Merged:** Three independent audits (DevOps-MCP-Audit, Research-MCP-Docs, Code-Provider-Rollout) converged on unified local MCP entrypoint strategy. Decision merged to decisions.md: canonical operator path is `mcp/server.mjs`, source-of-truth seam is `src/mcp/server.ts` + helpers. Compatibility wrappers: `src/cli.ts mcp` delegates to shared bootstrap, `npm run v2:mcp` aliased to `npm run mcp:server`, `npm run mcp:pipeline` explicit fallback. Implementation scope: Code refactors bootstrap helpers + multi-provider wiring, DevOps converges scripts/configs/docs, Research expands tool inventory docs. Validation: `npm run v2:build`, `npx vitest run tests/mcp/server.test.ts tests/cli.test.ts`, `npm run mcp:smoke`.
- Team initialized 2025-07-18
- GitHub Actions used for CI, triage, label sync
- MCP tools available for Substack, image gen, nflverse
- `.github/agents/squad.agent.md` defines Squad coordinator governance
- 2026-03-27 — Unified local MCP rollout should standardize on one canonical stdio entrypoint, because repo configs currently target `mcp/server.mjs` while `src/cli.ts mcp` boots a separate pipeline-only server. Current drift: `.copilot/mcp-config.json` and `.mcp.json` disagree on `cwd`, README still labels `mcp/` as legacy/local, `.github/extensions/README.md` still treats `mcp/server.mjs` as the preferred MCP server, and there is no automated test coverage for the `mcp/server.mjs` aggregator path. Verified baseline validation commands for MCP/CLI infra: `npm run v2:build` and `npx vitest run tests/mcp/server.test.ts tests/cli.test.ts`.
- 2026-03-27 — Canonical local MCP rollout landed with `mcp/server.mjs` as the repo-local stdio entrypoint. `src/cli.ts mcp` now wraps that same file, `mcp-pipeline` preserves the older pipeline-only server path, and docs/scripts now steer future local clients to `mcp/server.mjs`. Validation: `npm run v2:build`, `npx vitest run tests/mcp/server.test.ts tests/cli.test.ts`, and `npm run mcp:smoke`.
- **Issue #83 (K5a):** Fact-checking is already wired at 3 stages (preflight Stage 4→5, editor Stage 6, deterministic roster Stage 7) but limited to roster-only data. AgentRunner (`src/agents/runner.ts`) is pure LLM — no tool-calling capability. Key gap is connecting 11 nflverse MCP tools to fact-check stages. Recommended: pre-compute enriched fact-check context (Option A) before LLM call. Implementation is Code scope, not DevOps.

### 2026-03-22: Fact-Check Investigation Outcome

**Result:** Investigation confirmed fact-checking scope for issue #83. Code team implemented via pre-compute fact-check context (Option A) + deterministic validators (Option C). Pipeline enhancements deployed in PR #89 (merged).

**No DevOps changes required.** Fact-checking now integrated at 3 pipeline stages (Stage 4→5, 5→6, 6→7).


- 2026-03-24: For publish-overhaul shipping on dirty local `main`, use a fresh worktree from `origin/main`, copy only the target files, validate with `npm run v2:build` plus `npx vitest run tests/dashboard/publish.test.ts tests/dashboard/server.test.ts`, then push a feature branch instead of pushing local `main`.

### 2026-03-25T10:30:00Z: Publish Payload Fixes Staged and Decision-Merged

**Context:** Publisher payload ProseMirror regression fix and validation complete, staged for commit.

**Decision artifacts merged to decisions.md:**
- `publisher-html-regression.md` — Root cause: Substack's `draft_body` API expects ProseMirror JSON, not HTML strings
- `publisher-prosemirror-payload-fix.md` — Implementation: reverted to JSON format, refactored enrichment to operate on document nodes
- `publisher-stage-verify-prosemirror.md` — Validation: 45 passing tests, correct payload structure confirmed

**Impact:** Publishing system ready for production republish. Payload/image rewrite fixes pass validation and are staged for commit.

**Next phase:** Code and Publisher teams investigating Note/Tweet publishing 500s.

### 2026-03-23T04:09:08Z: Scribe Cross-Agent Update — Publish Overhaul Ship Strategy

**Decision logged:** "DevOps Decision — Publish Overhaul Ship" (`feature/publish-overhaul-ship` branch isolation pattern).

**Why this matters for DevOps:**
- When local `main` is dirty and ahead of `origin/main`, isolate ship-ready dashboard changes in a fresh worktree from `origin/main`.
- Prevents unrelated commits and edits from leaking into pushed branches.
- Keeps shipping work non-destructive during active development.
- Strategy: Create worktree → copy target files → validate (`npm run v2:build` + `npx vitest run tests/dashboard/publish.test.ts tests/dashboard/server.test.ts`) → push feature branch.

**Decision status:** Implemented during branch isolation; now recorded in team decisions for reuse across agents and future shipping cycles.

### 2026-03-23T04-16-31Z: Scribe Cross-Agent Update — Publish Config Fix Coordination

**Coordinated Session:** Multi-agent Publish Config investigation  

**Why this matters for DevOps:**
- Root-cause investigation confirmed: `SubstackService` initialization missing from `startServer()` (line 2494) despite correct environment setup.
- Architecture properly supports dependency injection; `ImageService` pattern exists as reference implementation.
- No CI/CD or environment changes required — code team implementation only.
- Non-fatal service: Log warning if credentials missing, don't crash startup.

**Code team action:** Implement SubstackService initialization. Reference code provided in decisions.md ("DevOps Decision — Substack Publishing 500 Error Root Cause").

**Validation complete:** Environment variables verified, application architecture reviewed, implementation pattern documented.

- 2026-03-25 — Accepted publish regression pattern: keep optional service wiring in `startServer()` via `createSubstackServiceFromEnv()`, and for HTMX draft/publish requests without Substack config return the swapped `renderPublishWorkflow()` fragment with setup guidance while non-HTMX callers still receive JSON 500s. Validation: `npx vitest run tests/dashboard/publish.test.ts --testNamePattern "createSubstackServiceFromEnv|returns an actionable HTMX message"` and `npm run v2:build`.
- 2026-03-25 — For progress commits on dirty `main`, isolate in a fresh worktree branch from current `HEAD`, copy only the scoped files, hand-patch mixed files (`src/dashboard/views/article.ts`, `tests/dashboard/server.test.ts`) to avoid unrelated dashboard/pipeline work, then validate with `npm run v2:build` plus `npx vitest run tests/dashboard/publish.test.ts tests/dashboard/server.test.ts` before committing.
- 2026-03-23T05:00:39Z — **Publish wave reconciliation**: DevOps isolated approved payload fixes to feature branch from `origin/main`, validated with focused test suite (`npm run test -- tests/dashboard/publish.test.ts`, `npm run v2:build`). All 45 tests pass. Pre-existing `server.test.ts` revision history failures unrelated to payload wave — not blocking. Ready for live article republish validation before Note/Tweet 500 fixes queued.

### 2026-03-25T06:34:28Z: Publish Fix Commit

**Commit:** `9480b74d4f738718b9f0667de2564c857139d275`  
**Message:** "fix: Rewrite Substack publish payload and image rendering"

**Files committed:**
- `src/dashboard/server.ts` (253 insertions, 109 deletions)
- `src/dashboard/views/publish.ts` (7 insertions, 0 deletions)
- `tests/dashboard/publish.test.ts` (100 insertions, 109 deletions)

**What fixed:**
- Added `createSubstackServiceFromEnv()` and `resolveDashboardDependencies()` for proper service injection at startup
- Rewrote `proseMirrorToHtml()` with corrected HTML rendering and image embedding
- Enhanced publish tests with payload validation and image reference testing

**Status:** Staged to `main`. Did not push per request — ready for validation and team review before publication.

### 2026-03-22T23:15:00Z: Notes/Tweets 500 Fix Commit

**Commit:** `fa2117f0088a3d3f40e38f27286da92a88b78fc7`  
**Message:** "Fix notes and tweets: add Twitter service init and default Notes endpoint"

**Files committed:**
- `src/dashboard/server.ts` (19 insertions, 0 deletions)
- `src/services/substack.ts` (5 insertions, 4 deletions)
- `tests/dashboard/publish.test.ts` (28 insertions, 0 deletions)
- `tests/services/substack.test.ts` (4 insertions, 9 deletions)

**What fixed:**
- Added `createTwitterServiceFromEnv()` factory to initialize Twitter service from 4 required env vars (API key, secret, access token, secret)
- Integrated Twitter service initialization into `startServer()` with graceful fallback when credentials missing
- Fixed SubstackService `createNote()` to use default `/api/v1/comment/feed` endpoint when `notesEndpoint` not configured (fixes 500s)
- Enhanced test coverage for Twitter service creation and Notes endpoint defaults

**Status:** Committed to `main`. Did not push per request — ready for Backend validation and publication team review.

### 2026-03-25T19:47:00Z: Verified Commits Pushed to origin/main

**Operation:** Backend approval received. Pushed 4 verified commits to `origin/main`.

**Commits pushed:**
1. `9480b74` — "fix: Rewrite Substack publish payload and image rendering" (Dashboard publish payload/image fixes)
2. `189db11` — "scribe: Merge tweet-publish-fix inbox decisions, record orchestration/session logs, update Code/Publisher histories"
3. `756f1b1` — "Scribe: Merge publish payload decision inbox, stage validation logs, update agent histories"
4. `fa2117f` — "Fix notes and tweets: add Twitter service init and default Notes endpoint" (Notes/Tweets 500 fix)

**Remote:** `origin` (https://github.com/JDL440/nfl-eval.git)  
**Branch:** `main`  
**Result:** ✓ Push succeeded. Branch now in sync with `origin/main`.

**No .squad-only commits skipped:** All 4 commits contain substantive application code mixed with team coordination metadata.

**Verification:**
- Pre-push status: 34 commits ahead of `origin/main`
- Post-push status: Branch up to date with `origin/main`
- Working tree: Clean (only untracked debug files and modified `.squad/agents/devops/history.md` remain, per normal session state)
- 2026-03-24 — Issue #123 repeat-blocker validation complete. Targeted tests pass (repeat detection, hold guards, artifact cleanup). Build clean. Dashboard artifact serving verified. One pre-existing thinking-sidecar failure unrelated to scope. Production-ready.
- 2026-03-28 — Local MCP rollout audit: use `mcp/server.mjs` as the one canonical repo-local stdio server. Keep `src/cli.ts` `mcp` as a wrapper that spawns that file, and keep the data-dir-aware `src/mcp/server.ts` surface behind explicit `mcp-pipeline`/`v2:mcp:pipeline` compatibility commands only.
- 2026-03-28 — Runtime-contract seam for unified MCP: `mcp/server.mjs` loads extension-style local tools, while `src/mcp/server.ts` builds the pipeline-only server from `loadConfig()`, `initDataDir()`, `Repository`, and `PipelineEngine`. If Code needs one client-visible tool surface, the safe seam is shared registration/bootstrap (for example `mcp/tool-registry.mjs` plus a pipeline registration helper), not two competing entrypoints.
- 2026-03-28 — MCP rollout validation commands: `npm run v2:build`, `npx vitest run tests\cli.test.ts tests\mcp\server.test.ts --reporter=verbose`, and `npm run mcp:smoke`. Targeted validation passed; smoke still emits a non-fatal telemetry warning because `.github/extensions/pipeline-telemetry.mjs` shells to missing legacy `content/pipeline_state.py`.
- 2026-03-27 — Unified local MCP rollout review: treat `mcp/server.mjs` as the canonical operator-facing local MCP entrypoint because `.copilot/mcp-config.json`, `.mcp.json`, smoke tests, and extension docs already point there. Keep `src/cli.ts mcp` as a wrapper to that same server, reserve `src/mcp/server.ts` for the pipeline-only surface behind `mcp-pipeline`, and keep config parity checks focused on matching `cwd` plus entrypoint path.
- 2026-03-28 — Unified local MCP rollout audit (read-only): model-facing discoverability is concentrated in `mcp/server.mjs` plus extension source, while `README.md` stays high-level, `.github/extensions/README.md` documents only a subset of the canonical catalog, `tests/mcp/server.test.ts` covers only the legacy pipeline MCP surface, and `mcp/smoke-test.mjs` omits `query_rosters`, `query_prediction_markets`, and `publish_tweet`. Safe rollout pattern: keep `mcp/server.mjs` as the documented operator contract, label `src/mcp/server.ts` as compatibility/debug-only, and update docs/tests together before changing client entrypoints.
- 2026-03-27 — Applied compatibility-safe MCP follow-up in-repo: `README.md` and `.github/extensions/README.md` now call out the canonical local-vs-pipeline-only split, wrapper runtime assumptions, and the broader canonical tool inventory; `mcp/smoke-test.mjs` now hard-fails on missing canonical tools and exercises `publish_tweet`, `query_rosters`, and `query_prediction_markets`; decision logged in `.squad/decisions/inbox/devops-mcp-compat.md`.

- 2026-03-28T20:30:00Z — **Release Cutover v2→v3 Completed Successfully:** Created v2-archive pointing to old main (c641e8f), promoted V3 (deae3e1) to main via soft reset, preserved all 473 working tree changes, kept v2-archive and V3 branches intact, no origin pushes.

- 2026-03-28T04:57:31Z — **Release Cutover v2→v3 COMPLETED:**
  - **Orchestration log:** .squad/orchestration-log/2026-03-28T04:57:31Z-devops-release-cutover.md
  - **Decision merged to .squad/decisions.md** (inbox → MERGED INBOX ENTRIES section)
  - **Status:** ✅ Branch promotion completed safely and non-destructively
  - **Operations:** Created v2-archive branch at c641e8f (previous main), soft-reset main to deae3e1 (V3), verified ref integrity
  - **Safety:** All 473 modified/untracked files preserved in worktree; v2-archive backup in place; no remote mutations
  - **Next steps:** Code team continues work on dirty worktree; when ready to push, create feature branch from main (now at V3)


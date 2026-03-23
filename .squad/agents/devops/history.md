# History — DevOps

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, GitHub Actions
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `.github/workflows/` (CI/CD), `.github/extensions/` (extensions), `.github/ISSUE_TEMPLATE/` (templates), `mcp/` (MCP servers), `.mcp.json` (MCP config)

## Learnings

- Team initialized 2025-07-18
- GitHub Actions used for CI, triage, label sync
- MCP tools available for Substack, image gen, nflverse
- `.github/agents/squad.agent.md` defines Squad coordinator governance
- **Issue #83 (K5a):** Fact-checking is already wired at 3 stages (preflight Stage 4→5, editor Stage 6, deterministic roster Stage 7) but limited to roster-only data. AgentRunner (`src/agents/runner.ts`) is pure LLM — no tool-calling capability. Key gap is connecting 11 nflverse MCP tools to fact-check stages. Recommended: pre-compute enriched fact-check context (Option A) before LLM call. Implementation is Code scope, not DevOps.

### 2026-03-22: Fact-Check Investigation Outcome

**Result:** Investigation confirmed fact-checking scope for issue #83. Code team implemented via pre-compute fact-check context (Option A) + deterministic validators (Option C). Pipeline enhancements deployed in PR #89 (merged).

**No DevOps changes required.** Fact-checking now integrated at 3 pipeline stages (Stage 4→5, 5→6, 6→7).


- 2026-03-24: For publish-overhaul shipping on dirty local `main`, use a fresh worktree from `origin/main`, copy only the target files, validate with `npm run v2:build` plus `npx vitest run tests/dashboard/publish.test.ts tests/dashboard/server.test.ts`, then push a feature branch instead of pushing local `main`.

### 2026-03-25: Substack Publishing 500 Error Investigation

**Reported issue:** "Getting 500 error trying to publish draft or article: Substack publishing is not configured for this environment."

**Root cause:** Code bug in `src/dashboard/server.ts:2494`. The `startServer()` function:
- ✅ Initializes `imageService` (lines 2455–2471)
- ❌ Does NOT initialize `SubstackService` (missing entirely)
- ✅ User's `.env` is correctly configured (SUBSTACK_TOKEN, SUBSTACK_PUBLICATION_URL both present)

The application architecture supports passing `substackService` as optional dependency to `createApp()`, but `startServer()` never creates it. Handlers for `/api/articles/:id/draft` and `/api/articles/:id/publish` check `if (!substackService)` and return HTTP 500 with "Substack publishing is not configured for this environment."

**User impact:** Publishing feature is unavailable despite correct environment configuration.

**Recommendation:** Code team should add SubstackService initialization pattern (lines 2455–2471 as reference) to `startServer()` at same location as imageService. Check `SUBSTACK_TOKEN` && `SUBSTACK_PUBLICATION_URL` before instantiation. Non-fatal service (like imageService) — log warning if missing, don't crash startup.

**Dev action required:** Issue for Code team. No env/CI changes needed from DevOps.

### 2026-03-23T04:09:08Z: Scribe Cross-Agent Update — Publish Overhaul Ship Strategy

**Decision logged:** "DevOps Decision — Publish Overhaul Ship" (`feature/publish-overhaul-ship` branch isolation pattern).

**Why this matters for DevOps:**
- When local `main` is dirty and ahead of `origin/main`, isolate ship-ready dashboard changes in a fresh worktree from `origin/main`.
- Prevents unrelated commits and edits from leaking into pushed branches.
- Keeps shipping work non-destructive during active development.
- Strategy: Create worktree → copy target files → validate (`npm run v2:build` + `npx vitest run tests/dashboard/publish.test.ts tests/dashboard/server.test.ts`) → push feature branch.

**Decision status:** Implemented during branch isolation; now recorded in team decisions for reuse across agents and future shipping cycles.

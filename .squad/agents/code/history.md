## 2026-03-28T00:54:15Z — In-App Agent Tool-Wiring Architecture DECISION MERGED

**Status:** DECISION MERGED TO `.squad/decisions.md` — Ready for Code implementation

**Orchestration log:** `.squad/orchestration-log/2026-03-28T00-54-15-devops.md`

**Key Finding:** Agent system and MCP tool system are completely decoupled. Lead has approved a 4-phase implementation plan.

**Architecture Pattern:**
- Agent system: stateless LLM orchestrator with skills/memories + provider abstraction
- Tool system: standalone MCP server with catalog + safe read-only NFL data
- Gap: No bridge between TS agents and JS tool registry
- Approved Solution: Extract tool catalog to shared TypeScript module; inject into system prompts; allow agents to invoke via tool_use XML

**Lead-Approved 4-Phase Implementation:**
1. **Phase 1 (Foundation):** Extend ChatRequest with tool capability; extend AgentRunParams; inject tool catalog into system prompt
2. **Phase 2 (Catalog Extraction):** Export tool registry as TypeScript module; define safe-list of read-only tools
3. **Phase 3 (Agent Access):** Determine allowlist per agent role; pass tools to gateway; update ChatRequest call
4. **Phase 4 (Execution):** Tool execution handler + multi-turn tool refinement (deferred)

**Decision Points:**
1. Tool allowlist is role-based: Writer→data-query; Editor→data only; Publisher→all safe + publishing
2. Inject full tool catalog into system prompt
3. Start with Phases 1–3; Phase 4 deferred until agents reliably format tool_use tags
4. No breaking changes; tool access is opt-in

**Build Blockers (HIGH priority):**
- `src/llm/providers/copilot-cli.ts` — `verify()` calls `exec()` with 2 args; signature expects 1
- `tests/agents/runner.test.ts` — imports removed file `src/llm/in-app-tools.js`

**Detailed Plan:** See `.squad/decisions.md` (MERGED INBOX ENTRIES section) — multiple reviews document exact file changes, test plan, risks + mitigations

---

## 2026-03-28T08:41:23Z — MCP Rollout Decision Merged


**Orchestration logs:** 
- .squad/orchestration-log/2026-03-26T08-41-23Z-devops-mcp-audit.md
- .squad/orchestration-log/2026-03-26T08-41-23Z-research-mcp-docs.md
- .squad/orchestration-log/2026-03-26T08-41-23Z-devops-mcp-review-2.md

**Status:** ✓ Decision merged to .squad/decisions.md — Ready for Code implementation

**Three-Agent Convergence:** DevOps-MCP-Audit, Research-MCP-Docs, Code-Provider-Rollout all recommended unified local MCP entrypoint.

**Decision Summary:**

- **Canonical operator path:** `mcp/server.mjs`
- **Source-of-truth seam:** `src/mcp/server.ts` + registration/bootstrap helpers
- **Compatibility wrappers:** `src/cli.ts mcp` delegates to shared bootstrap (not separate pipeline server); `npm run v2:mcp` aliased to `npm run mcp:server`; `npm run mcp:pipeline` explicit fallback
- **Multi-provider wiring:** Additive registration at startup, carry article/provider intent as routing hint (`prefer` by default, not `require`), persist requested provider separately from actual execution telemetry

**Code Scope:**

1. Refactor `src/mcp/server.ts` into reusable registration/bootstrap helpers
2. Make `src/cli.ts mcp` delegation/wrapper (not separate pipeline server)
3. Document contract seam in `src/mcp/` for both pipeline and extension tools
4. Wire multi-provider startup registration in `src/dashboard/server.ts`
5. `articles.llm_provider` / `articles.preferred_llm_provider` for requested intent capture
6. `stage_runs.requested_provider` for execution telemetry separation

**DevOps + Research Follow-Up:**

- Converge `package.json` scripts semantics
- Consolidate config file alignment (`.copilot/mcp-config.json`, `.mcp.json`)
- Expand `.github/extensions/README.md` with complete local tool inventory table
- Extend `mcp/smoke-test.mjs` coverage (prediction-market, rosters, publishing)
- Add canonical-local MCP tests for tool registration and schema parity
- Update `README.md` to describe one local MCP startup path

**Validation:**
- `npm run v2:build`
- `npx vitest run tests/mcp/server.test.ts tests/cli.test.ts`
- `npm run mcp:smoke` (artifact side-effects acceptable)

**Guardrails:**
- Unset provider must behave exactly like current auto routing
- Do not describe MCP as "unified" in docs until canonical inventory is fully validated
- Article override is a preference, not hard requirement, unless caller asks for `require`

---

## 2026-03-27T07:30:00Z — V3 Workflow Simplification Pass Implementation (Phase 1 Shipped)

**Orchestration log:** .squad/orchestration-log/2026-03-27T07-30-00Z-code.md  
**Session log:** .squad/log/2026-03-27T07-30-00Z-v3-workflow-simplify.md

**Status:** ✓ Completed — Phase 1 shipped and validated in worktrees/V3; Phases 2–6 ready for next iteration

**Phase 1: Warner Preflight Hardening**
- Added "Lose" to BANNED_FIRST_TOKENS in writer-preflight.ts
- Release-context verbs: Lose, Cut, Release, Drop (action-verb blocklist extended)
- Test case: filters release-context action verbs before name checks
- Validation: preflight test suite passing in worktrees/V3

**Supporting Implementation (worktrees/V3):**
- Writer support artifact scaffolding (writer-support.ts prep)
- Preflight minimization guard logic
- Editor accuracy-only blocker enforcement
- Revision cap at 2; escalate on 3rd (findConsecutiveRepeatedRevisionBlocker reused)
- Context reduction (roster, factcheck, preflight deduplication)
- Mobile width fix: min-width: 0 on grid containers, overflow-x: auto on tables

**Files Modified:**
- src/pipeline/writer-preflight.ts (BANNED_FIRST_TOKENS + "Lose")
- src/pipeline/writer-support.ts (artifact scaffolding)
- src/dashboard/views/article.ts (mobile CSS, revision display)
- src/dashboard/views/runs.ts (revision simplification)
- src/dashboard/public/styles.css (grid overflow handling)
- tests/pipeline/writer-preflight.test.ts (release-context verb test)
- tests/dashboard/wave2.test.ts (mobile viewport validation)
- tests/dashboard/publish.test.ts (revision escalation validation)

**Rollback Triggers Guarded:**
- Structure blockers will fail fast if Editor logic regresses
- Stage regression (6→4) wired and tested
- Repeated blocker escalation metadata preserved

**Validation Results:**
- npm run v2:build — passed
- Vitest dashboard + pipeline tests — passed
- worktrees/V3 focused regression suite — passed
- Mobile viewport tests (320px, 768px, 1024px) — passed

**Decisions Implemented:**
- V3 Workflow Simplification — Implementation-Pass Checklist (Lead-approved phases)
- Warner Last-Name Heuristic Boundary Review (added "Lose" to BANNED_FIRST_TOKENS)
- Article Mobile Width Fix (min-width: 0 on grids, overflow-x: auto for tables)

**Next:** Implement Phases 2–3 (writer-support artifact, preflight minimization), then Phases 4–6 (revision cap, context reduction, UX alignment).

---

## 2026-03-27T06-46-06Z — Warner Preflight Hardening Implementation

**Orchestration log:** .squad/orchestration-log/2026-03-27T06-46-06Z-code.md  
**Session log:** .squad/log/2026-03-27T06-46-06Z-warner-preflight-hardening.md

**Status:** ✓ Completed — Preflight hardening implemented and validated in worktrees/V3

**Implementation:** Add "Lose" to BANNED_FIRST_TOKENS in writer-preflight.ts
- Release-context verbs: Lose, Cut, Release, Drop (extending the action-verb blocklist)
- Test case: filters release-context action verbs before checking names
- Validation: preflight test suite passing in V3 worktree

**Decision:** [Warner Last-Name Heuristic Boundary Review](../../decisions.md)

---

## 2026-03-25T05-51-20Z — Option B Article-Page Review

**Orchestration log:** .squad/orchestration-log/2026-03-25T05-51-20Z-code.md  
**Session log:** .squad/log/2026-03-25T05-51-20Z-option-b-article-plan.md

**Status:** ✓ Completed — Option B server/rendering/test wiring reviewed

**Findings:**
- Article-view-only implementation approved by Lead.
- No type system changes required.
- Server wiring for transient status only.
- Smallest-safe pass confirmed.

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Core Context

**Stage & Architecture:**
- Issue #107: `substack-article` contract (TLDR/image).
- Issue #108: Post-Stage-7 retrospective persistence + `revision-retrospective-rN.md`.
- Issue #109: Revision history from conversation/revision seams. Issue #110: Stage timing as dashboard aggregation.
- Dashboard: Hono + HTMX + SSE on port 3456.
- Issue #115–118: Manual retrospective digest CLI + promotion rules via `src/cli.ts` + repository persistence.
- Issue #120: Blocker metadata on `revision_summaries` (`blocker_type` + JSON `blocker_ids`).
- Issue #123: Repeated-blocker escalation at Stage 6 with Lead-review hold.
- Issue #125: Writer fact-check via `src/pipeline/writer-factcheck.ts` (policy, runtime enforcement, Editor consumption).
- Writer support (2026-03-27): `writer-support.md` normalizes names/facts/cautions from `writer-factcheck`, `roster-context`, `writer-preflight`.
- Optional services via dependency injection in `src/dashboard/server.ts`.
- Writer revision retry: `## Failed Draft To Revise` seam in `writeDraft()`.
- Writer revision handoff: `buildRevisionSummaryContext()` + `editor-review.md` + previous `draft.md` injected into `articleContext`.
- Publish: HTML→ProseMirror document-node refactoring.
- Stage 5 context seam: `src/pipeline/context-config.ts` for new Writer artifacts.

## Recent Learnings & Critical Seams

- 2026-03-28 — V3 workflow simplification implementation complete. Applied simplifications to prompt contracts, engine/preflight behavior, and focused test suite in worktrees/V3. Validation: 184 tests passing. Decision inbox merged. Orchestration log: .squad/orchestration-log/2026-03-28T06-46-06Z-code.md.
- 2026-03-27 — Warner Preflight Hardening Implementation: added "Lose" to BANNED_FIRST_TOKENS in writer-preflight.ts. Release-context verbs extended with action-verb blocklist.
- 2026-03-25 — Option B Article-Page Review: approved article-view-only implementation, no type system changes required, server wiring for transient status only.
- Article detail Option B: `src/dashboard/views/article.ts` should keep one canonical `Current stage` block plus one compact workflow-status line. Put run diagnostics under `renderAdvancedSection()` as `Execution History`, render persisted `stage_runs.stage` directly (not `stage + 1`), keep revisions collapsed, and mirror header/status changes through `renderLiveHeader()` + `src/dashboard/server.ts`. Validation seam: `tests/dashboard/server.test.ts`, `tests/dashboard/wave2.test.ts`, `npm run v2:build`.
- Writer preflight opener false-positive: `writer-preflight.ts` + `writer-support.ts` sentence-opener filtering must stay synchronized (25+ conjunctions: Because, Since, Due, Given, If, When, While, Before, After, During, Following, Although, However, Furthermore, Moreover, Thus, Therefore, Consequently, As, Or, And, But, Yet, Unless, Except, Unlike, Regarding, Concerning, Considering).
- Roster parquet current-snapshot: Missing `week` field signals current snapshot. Skip week filtering; render "Current snapshot" in `roster-context.ts`.
- Dashboard mobile: Shell/nav → data-surface → detail/preview → page cleanup → regression coverage. Markup hooks exist; CSS selectors incomplete.
- Article detail mobile width: Stage 5+ overflow came from `src/dashboard/public/styles.css` `.image-gallery` using `minmax(280px, 1fr)` inside padded `.detail-section` cards. Fix the root cause with `minmax(min(100%, 280px), 1fr)` and lock it with `renderImageGallery()` + `tests/dashboard/wave2.test.ts` rather than hiding overflow globally.
- Stage 5 coverage: writer-support.test.ts, writer-preflight.test.ts, roster-context.test.ts, actions.test.ts all carry focused regression paths.

## Core Context Summary

**Architecture & Patterns:**
- Stage 5/6/7 contracts: `substack-article.md` (structure/TLDR/image), `writer-fact-check.md` (verification), `editor-review.md` (review). Context via `context-config.ts` + `actions.ts`.
- Issue #102 (Auth): Config-driven mode with SQLite sessions, Hono middleware, secure defaults (opaque ids, httpOnly/SameSite, 24h TTL).
- Issue #123 (Repeated Blocker): Normalized fingerprint, escalates at Stage 6, blocks loop bypass only on repeat.
- Optional services (Substack, Twitter): Dependency injection via `resolveDashboardDependencies()` in `src/dashboard/server.ts`.
- Writer revision retry: Self-heal via `## Failed Draft To Revise` seam in `writeDraft()`.
- Publish: HTML→ProseMirror document-node refactoring (45+ tests).
- Stage 5 context seam: `src/pipeline/context-config.ts` provides Writer scope without expanding Editor/Publisher.

**Recent Work (2026-03-24 to 2026-03-25):**
- Audited writer-support/preflight/roster integration for runtime regressions; coverage adequate via focused test paths.
- Fixed preflight opener false-positive: synchronized 25+ conjunctions in BANNED_FIRST_TOKENS across preflight + writer-support; preflight now trusts canonical names first.
- Mobile width: identified gallery card minmax root cause, implemented CSS fix with regression coverage.
- Sentence-starter: expanded BANNED_FIRST_TOKENS with action verbs (Take, Hit, Draft, Grab, Pick, Select, Land, Sign, Ink, Target, Pursue, Add, Trade, Watch, Build, Keep, Leave, Get).


## Learnings

- 2026-03-28 in-app MCP tool wiring: for Copilot CLI, `--available-tools` controls tool visibility while `--allow-tool` controls non-interactive approval. Safe repo-local MCP enablement should expose only the explicit read-only subset and keep tool-enabled runs on the workspace root so `.copilot\mcp-config.json` can load.

### 2026-03-28 Agent Tool-Wiring Inspection
- **Current tool exposure architecture:** Three-layer system: (1) MCP tools exposed via stdio in `src/mcp/server.ts`, (2) Agent charters/skills loaded from markdown at runtime in `src/agents/runner.ts`, (3) prompt-injected instructions. Agents receive tool documentation as text in system prompt, NOT as structured manifests or through native MCP client.
- **No tool discovery mechanism:** Agents have no ability to query available tools at runtime. Tool awareness is purely text-based in skills markdown (e.g., `src/config/defaults/skills/nflverse-data.md` documents 10 MCP tools as a markdown table).
- **No explicit allowlists:** Tool access is implicit through skill loading (`runner.run(params.skills)`). No charter-level or agent-level allowlist structure. No safety classification (read-only vs. side-effect).
- **Proposed wiring cost:** 6–8 surgical edits across `src/agents/runner.ts` (parse `## Tools` from charter, inject manifest into system prompt), `src/services/tool-catalog.ts` (new centralized registry), `src/config/defaults/charters/nfl/*.md` (add `## Tools` sections), `src/mcp/server.ts` (add `tools_list` discovery tool), tests (parse validation, prompt injection, MCP discovery). No architectural changes; purely additive.
- **Backward-compatible approach:** Extend charters with optional `## Tools` section; inject only if present and catalog provided. Existing agents without tool allowlists receive same behavior as today (no tool block in prompt).
- **Safety enforcement seam:** Tool allowlist lives in charter markdown (audit-friendly), validation happens at MCP invocation time in `src/mcp/server.ts`. Prevents caller-identity spoofing while keeping allowlist visible to code review.
- **Tool catalog design recommendation:** Build from MCP schema definitions, not manual duplication. Add category + safety level as first-class fields. Populate examples field to improve agent UX. Test schema parity between catalog and actual tools.

- 2026-03-28 MCP contract finish: the safest automated coverage seam for canonical local-tool discoverability is `tests\mcp\local-tool-registry.test.ts` calling `registerLocalTools()` directly and exercising `tools/list` plus `tools/call` handlers in-process. That locks catalog filters, example suppression, read-only vs mutating annotations, and exported inventory parity without relying on stdio smoke or credentialed integrations.
- 2026-03-28 local MCP contract audit: canonical repo-local client entrypoint is `mcp\server.mjs` via `.copilot\mcp-config.json`, `.mcp.json`, `npm run mcp:server`, and CLI `handleMcp()` in `src\cli.ts`; the separate pipeline-only seam remains `handlePipelineMcp()` + `src\mcp\server.ts` (`npm run mcp:pipeline`). Validation: `npm run mcp:smoke` passed tool registration but surfaced a telemetry-path warning from `.github\extensions\pipeline-telemetry.mjs` still shelling to `content\pipeline_state.py`, and `npx vitest run tests\cli.test.ts tests\mcp\server.test.ts --silent` passed.
- 2026-03-28 unified local MCP rollout planning: the rollout contract spans four surfaces together — client configs (`.mcp.json`, `.copilot\mcp-config.json`), CLI wrapper (`src\cli.ts`), canonical stdio server (`mcp\server.mjs`), and docs/validation (`README.md`, `.github\extensions\README.md`, `mcp\smoke-test.mjs`). Keep `src\mcp\server.ts` explicitly labeled pipeline-only/compatibility until Code decides whether to fold those tools into the canonical local server.
- 2026-03-28 MCP smoke-test caution: `.github\extensions\README.md` describes `npm run mcp:smoke` as safe/no-side-effects, but `mcp\smoke-test.mjs` currently renders a local table image and invokes image/publishing tools (stage targets or expected auth failures). Treat smoke-test wording as a contract seam that must match actual script behavior.
- 2026-03-28 multi-provider dashboard rollout: in `src\dashboard\server.ts`, provider-mode copy must prefer the actual registered provider list over `MOCK_LLM` fallback flags when multiple providers are available, or `/config` will incorrectly say `Mock only` even while the article metadata form and runtime can route across more than one provider.
- 2026-03-28 additive provider rollout: the clean seam for local/default-model providers is `supportsPreferredRouting()` in `src\llm\gateway.ts` + provider implementation, so article-level `prefer` routing can target LM Studio without letting auto-routing steal model-first traffic away from providers that truly support the resolved policy model.
- 2026-03-28 preview/Substack packaging bug: the shared publish seam in `worktrees\V3\src\dashboard\server.ts` was converting raw `draft.md` straight to preview/Substack body and reading subtitle only from `articles.subtitle`, so preview repeated the H1/deck in-body and drafts lost the real subtitle field when DB metadata was blank. Fix by extracting markdown meta once at packaging time, stripping it from `bodyMarkdown`, and using extracted subtitle as the packaging fallback for preview/Substack fields.
- 2026-03-28 second-pass workflow simplification: the live Seahawks JSN article was not stuck on Stage 5 structure anymore; it was stuck in Stage 6 because Editor kept issuing blockerless `REVISE` passes for missing comp ladders, source-label polish, and teaser specificity, which exhausted the revision cap and escalated to Lead review.
- In `worktrees\V3\src\pipeline\actions.ts`, the safest runtime seam for this class of churn is after canonical verdict extraction: if Editor returns `REVISE` without any `[BLOCKER type:id]` lines, force one blocker-only normalization pass and treat any still-blockerless result as advisory approval instead of another revision loop.
- 2026-03-28 writer/editor churn research: Stage 5 churn is concentrated in `worktrees\V3\src\pipeline\actions.ts` (`buildWriterTask`, `buildDraftRepairInstruction`, `writeDraft`) plus deterministic guards in `writer-preflight.ts` and `engine.ts`.
- Stage 6 churn surfaces also live in `worktrees\V3\src\pipeline\actions.ts` (`EDITOR_APPROVAL_GATE_TASK`, `runEditor`, auto-advance regression/force-approve paths) and prompt policy files under `worktrees\V3\src\config\defaults\charters\nfl\{writer,editor}.md` plus skills `substack-article.md` and `editor-review.md`.
- Shared revision-loop state is persisted through `worktrees\V3\src\pipeline\conversation.ts` (`RevisionSummary`, `buildRevisionSummaryContext`, repeated-blocker helpers), so simplifying Editor to a lightweight accuracy pass may allow pruning blocker metadata, lead-review escalation, and retrospective churn logic if the team chooses a less loop-heavy model.
- Targeted V3 validation command: `npx vitest run tests\pipeline\writer-preflight.test.ts tests\pipeline\engine.test.ts tests\pipeline\actions.test.ts --silent`; current baseline has one failing actions test around name-preflight retry expectations.
- 2026-03-25 send-back UX fix: in `worktrees\V3\src\dashboard\views\article.ts`, Stage 4 + `status='revision'` should render as `Revision Workspace`, prioritize `editor-review.md`/`draft.md` ahead of discussion artifacts, and default the artifact pane to the first persisted revision artifact rather than `idea.md`.
- Lead-review regression controls should frame Stage 4 as a revision destination, not a discussion rollback: the send-back disclosure copy lives in `worktrees\V3\src\dashboard\views\article.ts`, helper styles in `worktrees\V3\src\dashboard\public\styles.css`, and regression coverage in `worktrees\V3\tests\dashboard\server.test.ts` with validation via `npm run test -- tests/dashboard/server.test.ts tests/dashboard/wave2.test.ts && npm run v2:build`.
- 2026-03-28 unified local MCP audit: `mcp/server.mjs` is the actual canonical local tool surface (`.copilot/mcp-config.json`, README, `v2:mcp`, smoke test), while `src/mcp/server.ts` remains a separate pipeline-only MCP server. Treat pipeline MCP as a compatibility/debug surface, not the user-facing local inventory.
- 2026-03-28 unified local MCP audit: model-facing clarity currently drifts because `mcp/server.mjs` manually mirrors extension schemas and the data tools bypass `src/services/data.ts`; required args, default behavior, and script-vs-sidecar fallback semantics already differ for several queries. Prefer one shared contract source plus docs/smoke coverage before renaming tools.

## 2026-03-28T06-46-06Z — Second-Pass Workflow Simplification (Seahawks JSN Stall Fix)

**Orchestration log:** .squad/orchestration-log/2026-03-28T06-46-06Z-code.md  
**Session log:** .squad/log/2026-03-28T06-46-06Z-second-pass-workflow-fix.md

**Status:** ✓ Completed — Second-pass workflow simplification diagnosed and implemented

**Diagnosis:**
- Seahawks JSN article stall is Stage 6 blockerless/advisory revise loop, not Stage 5 hard-block failure
- Article reached APPROVED verdict at pass 2, but looped for third advisory-only cleanup pass
- Root cause: Editor emits blockerless REVISE reviews for missing comp ladders and source-label polish

**Implementation Direction:**
- Runtime normalization seam in worktrees\V3\src\pipeline\actions.ts
- If Editor returns REVISE with no [BLOCKER type:id] lines, force one blocker-only retry
- If still blockerless, treat as APPROVED instead of looping
- Preserve Stage 5 hard rails for shell minimums and placeholder leakage

**Validation:**
- Lead approved direction with explicit guardrails
- Research confirmed issue class is evidence-deficit/editor churn at Stage 6
- Guardrails preserve: minimal Stage 5 shell, placeholder hard guard, approval finality, escalation intact

**Rollback Triggers Guarded:**
- Minimal shell guard weakened, placeholder leakage publish-safe, APPROVED still triggers revision, blocker taxonomy widened, escalation broken, advisory becomes hidden blocker


## 2026-03-26T05:56:52Z — Multi-provider LLM Rollout Architecture Review

**Orchestration log:** .squad/orchestration-log/2026-03-26T05-56-52Z-code.md
**Session log:** .squad/log/2026-03-26T05-56-52Z-multi-provider-llm-review.md

**Status:** ✓ Complete — Architecture review validated, seams and tests confirmed

**Findings:**
- Startup registration is the unlock seam in src/dashboard/server.ts
- Repository/schema/type seams already mostly exist
- Test focus: additive registration, prefer-vs-require behavior, fallback, config truthfulness
- No architectural rewrites needed—wiring completion only

**Code Seams Validated:**
- Gateway: optional provider hint handling requires new semantics
- Runner: provider propagation is additive
- Pipeline: article \llm_provider\ reaches execution path
- Repository: schema and read/write paths exist
- Dashboard: config multi-provider display and metadata editing (JSON + HTMX)

**Key Constraints:**
- Keep \ModelPolicy\ model-first
- Preserve auto/unset behavior exactly
- Treat article override as prefer, not require
- Requested provider is observability, not truth

**Test Priorities:**
- Gateway: auto / prefer / require provider routing
- Runner: provider hint propagation to gateway calls
- Pipeline: article \llm_provider\ reaches execution path
- Repository: new field round-trip and requested-provider stage-run persistence
- Dashboard: config multi-provider display and metadata editing (JSON + HTMX)

**Related Decisions:**
- Lead — Multi-provider LLM review (in decisions.md)
- UX — Multi-provider article controls (in decisions.md)
- Code — Multi-provider dashboard copy alignment (in decisions.md)

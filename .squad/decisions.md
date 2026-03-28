# MERGED INBOX ENTRIES (2026-03-28T18:07:22Z)

## code cli trace analysis:

# Code — Copilot CLI Tool-Access Diagnosis

## Summary

- Stage 1 / `ideaGeneration` showing no Copilot CLI tool access is expected under today's default startup contract.
- The main user-facing issue is observability/labeling confusion, not a confirmed Stage 1 runtime bug.
- There is one nearby real bug in trace metadata: effective execution cwd can be misreported.

## Current Runtime Contract

1. `src\dashboard\server.ts` registers `CopilotCLIProvider` with `toolAccessMode: 'none'` unless `COPILOT_CLI_MODE=article-tools` or legacy tool env flags are set.
2. `src\dashboard\server.ts` sends Stage 1 ideas through `runner.run()` with `stage: 1` and `surface: 'ideaGeneration'`.
3. `src\agents\runner.ts` forwards that stage/surface/article trace metadata into `providerContext`, but does not decide tool access.
4. `src\llm\providers\copilot-cli.ts` uses stage only for session-reuse eligibility (`ARTICLE_STAGE_REUSE = [4,5,6,7]`); tool enablement still comes from provider instance mode plus runtime flags.

## Expected Fields

For a normal Stage 1 no-tools Copilot CLI trace, these are expected:

- `toolAccessMode: "none"`
- `toolAccessConfigured: false`
- `toolsEnabled: false`
- `allowedTools: []`
- `webSearchEnabled: false`
- `repoMcpEnabled: false`
- `mcpServerNames: []`

The prompt may also begin with the app-authored no-tools constraint telling the model to answer directly and avoid tools.

## Suspicious Signals

- Prompt starts with no-tools constraint **but** request envelope says `toolAccessMode: "article-tools"`.
- `toolsEnabled: true` with an empty `allowedTools` array.
- A no-tools run reports repo-root cwd instead of the sandbox cwd.
- Reviewers infer tool policy from Stage 1 vs Stage 5 alone; today only session reuse is stage-gated.

## Minimal Fixes (do not implement here)

1. **UX fix:** rename `Provider Prompt Delta` in `src\dashboard\views\traces.ts` to `Provider Prompt` or `Provider-Composed Prompt`.
2. **Real bug fix:** in `src\llm\providers\copilot-cli.ts`, report `plan.cwd` (effective cwd) instead of `this.workingDirectory ?? plan.cwd` in provider metadata.
3. **Only if product wants stage-aware tools:** move tool-mode selection from provider construction time to request time, derived from `providerContext.stage/surface`.

## Test Follow-ups

- Add a Stage 1 `copilot-cli` test with provider configured for `article-tools` to lock current inheritance behavior.
- Add a trace test proving no-tools mode stores the injected constraint in `incrementalPrompt`.
- Add a metadata test proving no-tools mode reports sandbox cwd.
- Update dashboard trace rendering tests if the prompt label is renamed.

---

## code trace label clarification:

# Code — Trace Label Clarification

## Context

`src\dashboard\views\traces.ts` renders `trace.incremental_prompt` for dashboard trace timelines. For Copilot CLI traces, that field stores the full provider-composed prompt wrapper, not a semantic diff against an earlier prompt.

## Decision

Render that section as **Provider-Wrapped Prompt** instead of **Provider Prompt Delta**.

## Why

- It stays accurate for Copilot CLI traces that prepend wrapper text such as tool-policy or no-tools constraints.
- It avoids implying the stored value is a delta or patch.
- It still leaves room for other providers to store their full provider-side composed prompt in the same field.

---

## devops env sample:

# DevOps Decision — Copilot CLI env sample coverage

## Decision

Document the Copilot CLI runtime surface in `.env.sample`, led by `COPILOT_CLI_MODE`, and include the still-supported compatibility flags that can widen tool access or session reuse.

## Why

`src\dashboard\server.ts` currently treats `COPILOT_CLI_MODE=article-tools` as the preferred switch, but it also honors older flags like `COPILOT_CLI_ENABLE_TOOLS`, `COPILOT_ENABLE_TOOLS`, and `COPILOT_ENABLE_SESSION_REUSE`. If the sample omits those knobs, operators can end up with behavior that looks undocumented when local env files or old runbooks still set legacy flags.

## Scope

- `.env.sample` should show the current preferred knobs and defaults
- compatibility-only flags should stay documented, but clearly labeled as legacy
- no runtime behavior changes are implied by this sample-file update

---

## devops history gitignore:

# DevOps Decision — Local Agent History Files Stay Untracked

## Context

Agent-specific `.squad/**/history.md` files are useful as local working memory, but tracking them in Git creates noisy diffs and accidental churn across branches.

## Decision

Treat `.squad/**/history.md` as local-only artifacts. Keep them on disk for each operator, add the exact ignore rule in `.gitignore`, and remove any already-tracked copies from the Git index with cached deletes so the files remain locally available.

## Guardrails

- Only untrack files whose exact basename is `history.md` under `.squad/`.
- Do not remove or untrack other `.squad` artifacts as part of this cleanup.
- If unrelated local-only `.squad` changes exist, leave them untouched and call them out in the handoff.

---

---

# MERGED INBOX ENTRIES (2026-03-28T17:54:23Z)


---

## code cli trace analysis:

# Code — Copilot CLI Trace Analysis (2026-03-28)

## Summary

Current Copilot CLI trace behavior is mostly expected, not a provider bug.

- `src\llm\providers\copilot-cli.ts` defaults to `toolAccessMode: 'none'`
- `src\dashboard\server.ts` only enables `article-tools` when `COPILOT_CLI_MODE=article-tools` or legacy tool env flags are set
- In `none` mode, the provider intentionally prepends:
  - `<constraint>Output the requested content directly as text. Do NOT read files, create files, run commands, or use any tools.</constraint>`
- The request envelope therefore correctly reports:
  - `allowedTools: []`
  - `toolsEnabled: false`
  - `webSearchEnabled: false`
  - `repoMcpEnabled: false`

## Stage 1 Finding

For Stage 1 / `ideaGeneration`, tool access `none` is expected **today** unless the dashboard process was started with article-tools enabled. There is no stage-based widening rule in the provider; tool access is provider-instance configuration, not surface-specific routing.

## Likely UX Confusion

`src\dashboard\views\traces.ts` renders `trace.incremental_prompt` under the title **Provider Prompt Delta**. For Copilot CLI this value is the full provider-wrapped prompt, not a semantic diff. Renaming that label to something like **Provider Prompt** or **Provider-Wrapped Prompt** would be a tiny, factual clarification if we choose to improve the trace UX.


---

## code commit scope:

# Commit Scope: Provider Persistence Fix (2026-03-28)

## Status
✅ **ALREADY COMMITTED ON `main`** — the provider-persistence product work is present in `HEAD` as commit `1ccc9c4` (`Persist article provider across stages`).

## Current State
- **Branch:** `main`
- **Branch ahead of `origin/main`:** 2 commits
- **Committed provider-persistence scope:** already included in `HEAD`
- **Current unrelated dirty file:** `.squad\agents\code\history.md`

## Minimal Safe Commit Scope
### For the provider-persistence product work
**No new product commit is needed.** The relevant code and tests are already committed together in `1ccc9c4`.

That committed scope covers these 9 product files:
1. `src\types.ts`
2. `src\db\schema.sql`
3. `src\db\repository.ts`
4. `src\dashboard\server.ts`
5. `src\dashboard\views\new-idea.ts`
6. `src\pipeline\actions.ts`
7. `tests\dashboard\new-idea.test.ts`
8. `tests\dashboard\server.test.ts`
9. `tests\pipeline\actions.test.ts`

### Files that should NOT be included in any product commit
- `.squad\agents\code\history.md` — investigation/coordination metadata only

## Merge Decision
**Merge is NOT needed.** The working branch is already `main`, so there is nothing to merge into `main`. The correct next step, if desired, would be to push `main`.

## Decision
For requests framed as "commit and merge to main," first verify whether the product work is already present in `HEAD`. If it is, do **not** create a duplicate commit; exclude any `.squad\` metadata dirt and treat the task as a push/no-op merge situation.


---

## code provider trace:

# Provider Persistence Bug Investigation

**Date:** 2025-01-09  
**Investigator:** Code (Core Dev)  
**Issue:** User selected Copilot Pro+ on the new-idea page, but subsequent article stages still use gpt-4o/lmstudio (default provider)  
**Status:** Root cause identified — provider selection not persisted to pipeline stages

---

## Root Cause

**File: `src/pipeline/actions.ts`, Line 522-533**

The `runAgent()` helper function does NOT accept a provider parameter:

```typescript
function runAgent(
  ctx: ActionContext,
  articleId: string,
  stage: number,
  surface: string,
  params: Omit<AgentRunParams, 'trace'>,
): Promise<AgentRunResult> {
  return ctx.runner.run({
    ...params,
    trace: buildAgentTraceContext(ctx, articleId, stage, surface),
  });
}
```

The function passes params directly to `ctx.runner.run()` at line 529. The `params` parameter is of type `Omit<AgentRunParams, 'trace'>`, which DOES include the `provider` field. However, **ALL calls to `runAgent()` in the stage action functions (generatePrompt, composePanel, runDiscussion, writeDraft, runEditor, runPublisherPass) omit the `provider` field**.

---

## Flow Analysis

### Stage 1 (Idea Generation) — ✅ WORKS
**File: `src/dashboard/server.ts`, Lines 1188-1199**

The idea generation endpoint correctly passes the provider:

```typescript
const result = await actionContext.runner.run({
  agentName: 'lead',
  provider: requestedProvider || undefined,  // ← PROVIDER PASSED
  task,
  skills: ['idea-generation'],
  // ...
});
```

The user selects a provider on the form → `requestedProvider` is captured at line 1140 → passed at line 1190 ✓

---

### Stages 2-7 (generatePrompt, composePanel, etc.) — ❌ BROKEN
**File: `src/pipeline/actions.ts`, Line 818, 890, etc.**

Example from `generatePrompt()` at line 818:

```typescript
const result = await runAgent(ctx, articleId, article.current_stage, 'generatePrompt', {
  agentName: 'lead',
  task: '...',
  skills: ['discussion-prompt'],
  articleContext: { /* ... */ },
  // ← NO PROVIDER FIELD
});
```

This is repeated in every stage action:
- `generatePrompt()` — Line 818
- `composePanel()` — Line 890
- `runDiscussion()` — Multiple calls
- `writeDraft()` — Multiple calls
- `runEditor()` — Multiple calls
- `runPublisherPass()` — Multiple calls

---

## Data Path

### Where Provider IS Stored
- **Table: `usage_events`** — `provider` column captures the LLM provider used for each stage  
- **Table: `llm_traces`** — `provider` column captures provider for full trace

### How to Retrieve It
The provider from Stage 1 can be retrieved via:

```sql
SELECT provider FROM usage_events 
WHERE article_id = ? AND stage = 1 
ORDER BY created_at DESC LIMIT 1;
```

However, **the current code does NOT retrieve or use this value** in subsequent stages.

---

## The Fix Strategy (Not Implemented)

To persist provider selection across stages:

1. **Retrieve provider from Stage 1:** Query `usage_events` to get the LLM provider used in idea generation
2. **Pass to all subsequent stages:** Modify each `runAgent()` call in stage actions to include:
   ```typescript
   provider: getArticleProviderFromStage1(articleId)  // Helper function needed
   ```
3. **Handle null gracefully:** If no provider is found (e.g., for older articles), fall back to `undefined` (gateway default)

---

## Files Involved

### Critical Files
- **`src/pipeline/actions.ts`** — Contains all stage action functions  
  - `runAgent()` function: Line 522
  - `generatePrompt()`: Line 818
  - `composePanel()`: Line 890
  - All other stage actions: Similar pattern

- **`src/dashboard/server.ts`** — Idea generation endpoint  
  - POST `/api/ideas` handler: Line 1129
  - Provider capture: Line 1140
  - Provider passing: Line 1190

### Related Files
- **`src/agents/runner.ts`** — AgentRunner.run() accepts provider at line 470
- **`src/llm/gateway.ts`** — LLMGateway.chat() respects provider parameter

---

## Impact

- **High Impact:** Every article created with a non-default provider will silently revert to the default provider when moving from Stage 1 → 2
- **Silent Failure:** No error or warning is shown to users; they only notice when they check which provider was used in later stages
- **Scope:** Affects ALL articles with non-default provider selection during creation

---

## Validation Points

To confirm the fix works:

1. Create an article with provider = "copilot-pro" on the new-idea page
2. Check `usage_events` for Stage 1 — verify provider is recorded ✓
3. Trigger auto-advance to Stage 2
4. Check `usage_events` for Stage 2 — verify provider matches Stage 1 provider
5. Check `llm_traces` for Stage 2 — verify `provider` field matches selection

---

## Notes for Implementation

- The `runAgent()` signature is already flexible enough to accept the provider
- No database schema changes needed — provider is already being tracked
- The fix is localizable to `src/pipeline/actions.ts` — no breaking changes to the API
- Consider creating a helper function `getArticleDesiredProvider(repo, articleId)` to avoid duplication


---

## copilot directive 20260328T174917Z:

### 2026-03-28T17:49:17.843Z: User directive
**By:** Backend (via Copilot)
**What:** .squad history.md files should be gitignored and removed from git tracking.
**Why:** User request — captured for team memory


---

## devops gitignore history:

# Directive: Gitignore .squad/**/history.md

**Timestamp:** 2026-03-29 (Current)
**Source:** DevOps / Backend request
**Status:** Approved & Implementing

## Directive

Implement a repository policy to **gitignore all `.squad/**/history.md` files** to keep agent memories local and out of version control while preserving them on disk for cross-session agent context.

## Rationale

- Agent histories are **session-local working memory**, not part of the canonical codebase
- Keeping them out of version control reduces noise in diffs and commit history
- Preserves ability for agents to maintain persistent local context across sessions
- Aligns with existing patterns for orchestration logs and inbox (already gitignored)

## Actions

1. ✅ Add `.squad/**/history.md` pattern to `.gitignore`
2. ✅ Remove currently tracked history files from git index (`git rm --cached`)
3. ✅ Preserve files locally (no deletion from disk)
4. ✅ Document decision in orchestration log and Scribe history

## Scope

**Modified files:**
- `.gitignore` — add `.squad/**/history.md` pattern
- 11 tracked history files removed from git index:
  - `.squad/agents/{code,data,devops,lead,publisher,ralph,research,scribe,ux}/history.md`
  - `.squad/log/*-usage-history.md` (2 files)

**Files preserved locally:**
- All 11 history files remain on disk
- No agent working memory lost


---

## devops history gitignore:

# DevOps Decision — Ignore agent history files

- **Date:** 2026-03-28
- **Owner:** DevOps
- **Status:** Proposed

## Decision

Treat .squad/**/history.md as local-only runtime memory. Keep the exact ignore rule in .gitignore and remove already tracked history.md files from Git with cached deletes so local copies remain on each machine.

## Why

- Agent history files churn frequently and are machine-local context, not durable repo source.
- Keeping them tracked creates noisy diffs and accidental commits.
- The cleanup must target only exact history.md files and leave similarly named .squad/log/*usage-history.md files alone.


---

## lead provider fixes approval:

# Decision — Provider Fixes Approved for Mainline Commit

**Date:** 2026-03-29  
**Owner:** Lead (Joe Robinson)  
**Status:** Approved  

## Directive

Ship approved for commit and merge to main:

1. **Provider-persistence fix**: Provider selection now propagates through all pipeline stages (Stage 1 → generatePrompt, composePanel, runDiscussion, writeDraft, runEditor, runPublisherPass).
2. **Provider-label clarification**: Dashboard label mapping consolidated to eliminate confusion between "GitHub Copilot Pro+" (GitHub Models API) and "GitHub Copilot CLI" (separate provider).

## Approval

- **Requested by:** Joe Robinson
- **Approval statement:** "Looks good. commit and merge to main"
- **Implementation status:** Both fixes are already in code and validated.

## Next Action

Coordinator to confirm git state is safe (no conflicts, all tests passing), then execute:

```bash
git add .squad/
git commit -m "Provider fixes approved for mainline: persistence propagation + label clarification"
git push origin main
```


---

## research panel construction:

# Research Inbox — Panel Construction Abstraction

## Context

Research audited current article panel construction for beat-level article generation.

Key source seams:

- `src/pipeline/actions.ts:843-1033`
- `src/config/defaults/skills/panel-composition.md:15-43`
- `src/config/defaults/skills/article-discussion.md:98-127`
- `src/pipeline/context-config.ts:26-43`
- `src/dashboard/server.ts:1167-1186`
- `src/dashboard/views/new-idea.ts:89-118`
- `src/types.ts:20-29`

## Observations

1. Panel composition is **policy-by-prompt**. There is no typed `article_type`, `panel_profile`, or composition schema in article records.
2. Runtime enforcement is weak:
   - `composePanel()` tells Lead the depth-size rules in prose.
   - `runDiscussion()` parses whatever `panel-composition.md` contains and executes it if parseable.
   - `requirePanelComposition()` only checks for non-empty bullet-like lines.
3. Depth and composition guidance are duplicated across UI, prompt skills, and stage tasks:
   - `new-idea.ts` template asks Lead to output a suggested panel.
   - `server.ts` depth labels encode word-count/agent-count copy.
   - `panel-composition.md` and `article-discussion.md` repeat the same size matrix.
4. Depth level 4 (`Feature`) exists in types/UI, but panel-composition logic treats any non-1/non-2 depth as `4-5 agents`, effectively collapsing level 4 into the level-3/deep-dive branch.
5. Pinned agents are stored structurally (`article_panels`) but only as required names/optional roles; they do not define lane templates, quotas, or composition profiles.

## Recommendation

Move panel construction toward a typed, composable contract:

### 1. Add a first-class composition spec

Store per-article structured selection data such as:

- `compositionProfile` (e.g. `contract_extension`, `draft_eval`, `roster_strategy`)
- `panelConstraints`
  - `minPanelists`
  - `maxPanelists`
  - `requiredRoles`
  - `requiredAgents`
  - `preferredRoles`
  - `allowTeamAgents`
  - `allowDuplicateArchetypes`

### 2. Separate depth policy from article-type policy

Depth should control budgets/size ceilings.
Article type should control lane mix.
Today those concerns are blended in prompt prose and a static matrix.

### 3. Generate prompts from structured policy

Keep markdown skills, but render them from typed config so one source of truth feeds:

- dashboard labels
- idea template guidance
- composePanel task text
- validation/guard rails

### 4. Validate composition structurally before discussion

Before Stage 3→4, validate:

- panel size within bounds
- pinned agents included
- required team/specialist presence
- agent names exist in roster
- no duplicate/overlapping lanes if disallowed

### 5. Resolve depth-4 semantics explicitly

Either:

- give Feature its own composition policy, or
- formally alias it to Deep Dive everywhere.

Right now UI and runtime communicate different semantics.

## Suggested Direction

Prefer a small typed “panel policy registry” over more prompt text. Prompts should explain the why; code/config should own the actual rules.


---

## scribe provider label and persistence:

# Provider Label Ambiguity + Persistence Bug Fix

**Date:** 2025-03-28  
**Source:** Session observation + Code investigation (provider-trace)  
**Status:** Decision candidate — requires naming/architecture review  

---

## Issue 1: Dashboard Provider Label Ambiguity

### Problem
The dashboard display label **"GitHub Copilot Pro+"** is ambiguous because it maps to the `copilot` provider, which uses the GitHub Models API path, not the GitHub Copilot CLI.

- **"GitHub Copilot Pro+"** → `copilot` provider (API-based)
- **"GitHub Copilot CLI"** → `copilot-cli` provider with different behavior
- Current labels in `src/dashboard/views/new-idea.ts` do not distinguish these semantically

### Impact
Users selecting "GitHub Copilot Pro+" may not realize they are routing through the Models API gateway rather than the Copilot CLI tool.

### Recommendation
1. Audit all provider labels in dashboard UI for semantic clarity
2. Consider renaming:
   - `"GitHub Copilot Pro+"` → `"GitHub Models API"` or `"Copilot Pro (API)"`
   - Explicitly label CLI-based providers separately if CLI provider is exposed
3. Update type hints / UI enum to reflect provider-to-gateway mapping
4. Document in `src/types.ts` provider enum which routing layer each provider uses

---

## Issue 2: Provider Selection Persistence Bug ✅ (FIXED)

### Problem
User selected a non-default provider on the idea-generation page (Stage 1), but subsequent article stages (generatePrompt, composePanel, runDiscussion, writeDraft, etc.) silently reverted to the default provider.

### Root Cause
Stage 1 (idea endpoint in `src/dashboard/server.ts`) correctly passed `provider: requestedProvider`, but the selected provider was not persisted on the article record. Stage 2+ calls used `runAgent()` without an explicit provider, so they fell back to the gateway default provider.

### Status: FIXED
The fix persists the selected provider on `articles.llm_provider` at article creation time and updates `runAgent()` in `src/pipeline/actions.ts` to inherit `article.llm_provider` when no explicit provider override is supplied. This keeps provider selection attached to the article across the entire pipeline.

### Validation
- ✅ Source and tests confirm `POST /api/ideas` stores `llm_provider`
- ✅ Source and tests confirm later stages inherit `article.llm_provider`
- ⚠️ Live `http://localhost:3456` instance was stale during verification and still showed the pre-fix fallback behavior
- ✅ Restarting the dashboard from current source/build is required to validate the fixed behavior live

---

## Architectural Considerations

### Why This Matters
1. **User Intent:** Provider selection on idea page is a user-facing choice; silent reversion violates user expectations
2. **Data Integrity:** The article record must carry the provider choice so later stages can reproduce Stage 1 routing
3. **Reproducibility:** Same article should use the same LLM provider unless explicitly changed

### Related Code Seams
- `src/dashboard/server.ts:1188-1229` — Provider capture, Stage 1 use, and article persistence
- `src/pipeline/actions.ts:522-533` — `runAgent()` helper inherits `article.llm_provider`
- `src/agents/runner.ts:470` — AgentRunner.run() accepts provider
- `src/llm/gateway.ts` — LLMGateway respects provider routing

---

## Decision Inbox

**Next Steps:**
1. Clarify dashboard provider label semantics (Issue 1)
2. Confirm provider persistence fix is correctly wired through all stages (Issue 2)
3. Consider adding a provider-selection audit rule to catch future omissions
4. Update agent span context to log which provider is active (for observability)



---
# MERGED INBOX ENTRIES (2026-03-28T01:02:59Z)

## DevOps: In-App Read-Only MCP Loop Contract

# DevOps Decision — In-App Read-Only MCP Loop Contract

- **Date:** 2026-03-28
- **Owner:** DevOps
- **Status:** Implemented

## Decision

Keep the first in-app MCP rollout on a repo-owned JSON tool-turn contract:

1. `AgentRunner` asks providers for a JSON decision, not provider-native tool calls.
2. The runtime loads approved tool metadata from `mcp/tool-registry.mjs` in-process.
3. The runtime validates args with the shared schemas, executes only the approved read-only handlers, and feeds normalized results back into the next model turn.
4. Repeated identical tool calls in one run reuse the cached result instead of re-executing.

## Why

- This keeps the seam provider-agnostic and works even when the provider has no native function-calling contract.
- It preserves the Copilot CLI safety posture: the provider stays text-only while the app owns allowlisting, validation, and execution.
- Registry-backed loading keeps the in-app allowlist tied to the same metadata the local MCP server exposes, which reduces drift risk.

## Guardrails

- Allow only `local_tool_catalog` plus the approved read-only query tools.
- Fail closed on unknown tool names, invalid arguments, or non-read-only metadata.
- Keep the tool budget bounded and require a final text answer once the budget is exhausted.

## Implementation Complete (2026-03-28T15:45:00Z)

App-owned tool loop shipped and validated:

- **Runtime** (`src/agents/local-tools.ts` + `src/agents/runner.ts`): Models propose `{type: "tool_call", toolName, args}` in JSON, app validates schemas and executes allowlisted handlers in-process, results fed back to conversation
- **Allowlist enforcement**: 12 approved read-only tools, 6 explicitly blocked tools, non-read-only tools rejected at load time
- **Deduplication**: Identical `{toolName, args}` calls reuse cached results within a run via `stableToolCallKey`
- **Call budget**: Max 3 tool calls per agent run, then agent must provide `{type: "final", content}`
- **Validation**: Zod schemas strict before execution, handler errors wrapped and returned to LLM
- **Test coverage**: Allowlist correctness, blocked-tool enforcement, schema validation, handler errors, dedup logic all passing
- **Provider neutral**: No provider customization needed; contract is JSON-only


---

## Code: MCP Tooling Allowlist Policy

# Decision Inbox — Code Agent MCP Tooling

**Date:** 2026-03-28  
**Owner:** Code  
**Status:** Proposed

## Decision

Enable repo-local MCP access for in-app agents only through an explicit safe subset:

- `local_tool_catalog`
- `query_player_stats`
- `query_team_efficiency`
- `query_positional_rankings`
- `query_snap_counts`
- `query_draft_history`
- `query_ngs_passing`
- `query_combine_profile`
- `query_pfr_defense`
- `query_historical_comps`
- `query_rosters`
- `query_prediction_markets`

Do **not** expose publishing, media-generation, or cache-refresh tools to the in-app agent runtime.

## Implementation seam

Enforce the policy in the app runtime, above providers:

1. **Registry-derived allowlist** — load local tool metadata from `mcp\tool-registry.mjs`, then keep only the explicit approved tool names that are also marked `readOnlyHint: true`.
2. **Bounded tool loop** — let the model request at most three in-process tool calls through a strict JSON contract.
3. **Fail closed** — reject non-allowlisted tools and invalid arguments before any handler runs.
4. **In-process execution only** — call the local tool handlers directly from the app runtime; do not delegate tool permissions to provider-specific CLI flags.

## Why

- The MCP server already exposes both safe read-only tools and mutating tools.
- The in-app runtime previously had no safe, explicit local-tool execution seam.
- An app-owned loop keeps tool policy provider-agnostic and auditable while still enabling factual lookup work.

## Validation

- `npm run v2:build`
- `npx vitest run tests\agents\runner.test.ts tests\llm\gateway.test.ts tests\llm\provider-copilot-cli.test.ts tests\mcp\local-tool-registry.test.ts`



## DevOps Decision — Canonical env template

## Decision

Keep `.env.sample` as the single canonical environment template and remove `.env.example`.

## Why

`.env.sample` already reflects the current Copilot CLI/runtime configuration surface, including `COPILOT_CLI_MODE`, web search, repo MCP, and session reuse flags. Keeping `.env.example` alongside it creates drift and operator confusion.

## Scope

- remove `.env.example`
- keep `.env.sample` as the only template users copy to `.env`
- keep docs and runtime-facing references pointed at `.env.sample`

---

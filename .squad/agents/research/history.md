## Spawn Batch — App/Runtime + Engineering-System Split (2026-03-29T19:07:44.9412166Z)

- **Status:** Two implementation streams launched.
- **Stream 1 (App/Runtime):** surfaces src\pipeline\*, src\dashboard\server.ts, article skills. Owners: Code + Publisher + UX (Lead review).
- **Stream 2 (Engineering-System):** surfaces .squad/*, squad agent, ralph-watch, heartbeat. Owners: Lead + Ralph + Research + DevOps.
- **Validation:** article quality, render QA, publish readiness, board hygiene, reduced coordination drift.

# Research Agent History

## Core Context (Archived 2026-04-02)

**Architectural patterns & team decisions:** LM Studio uses app-managed JSON tool-loop (no native tool API support in OpenAI-compat layer); Gemini moved to native structured tool calling with opaque `providerState` continuation. Depth redesign identified as UI+validation refinement of already-correct architecture: new preset fields (reader_profile, article_form, panel_shape, analytics_mode) already exist in types.ts and are persisted; migration strategy is additive-first (keep depth_level as compatibility alias, backfill new fields, refactor runtime in sequence: model-policy → panel-size → compose-panel → prompt). Key research outputs are captured in decisions.md; no blocking technical debt for redesign.

## 2026-03-28: LM Studio Tool-Use Behavior Audit

### Request
Investigate LM Studio tool-use behavior for intended model `qwen/qwen3.5-35b-a3b`. Determine whether provider-native tool calling exists, trace model string flow, and identify best code path for improvement.

### Key Learnings

#### Architecture Decisions
1. **App-Managed Tool Loop, Not Native:** LM Studio provider relies on OpenAI-compatible `/chat/completions` endpoint which does not support tool definitions. Instead, the agent runner implements a JSON request/response protocol where:
   - Tools are injected as text in system prompt
   - Model returns JSON with `{"type":"tool_call"|"final",...}`
   - Runtime parses and executes tool calls, appends results to conversation
   - This works with any model capable of JSON output (e.g., Qwen 3.5)

2. **Model String Flow is Transparent:** The model identifier `qwen/qwen3.5-35b-a3b` (or any value) flows through the system without rewriting or aliasing. It is:
   - Read from `LMSTUDIO_MODEL` environment variable OR
   - Auto-detected from live LM Studio instance OR
   - Falls back to hardcoded default `qwen-35` (line 54, `src/llm/providers/lmstudio.ts`)

3. **Default Model Divergence:** The hardcoded default `qwen-35` does NOT match the intended model `qwen/qwen3.5-35b-a3b`. This requires explicit environment configuration or auto-detection from a running LM Studio server.

#### User Preferences / Patterns
- **Team uses JSON protocol for tool-use:** Rather than exploring native tool APIs (which LM Studio's OpenAI compat layer doesn't support), the system standardized on prompted JSON responses. This is a deliberate architectural choice, not a limitation.
- **Favor explicit configuration over defaults:** The team configures models via environment variables rather than relying on hardcoded values.

#### Key File Paths
- **Provider:** `src/llm/providers/lmstudio.ts` — chat request, model handling
- **Tool loop:** `src/agents/runner.ts:649–738` — JSON request/response loop, tool execution
- **Tool catalog injection:** `src/agents/local-tools.ts:178–200` — system prompt building
- **Provider registration:** `src/dashboard/server.ts:~2050` — initialization with env vars
- **Model policy:** `src/config/defaults/models.json` — stage-to-model mapping (GPT models, not LM Studio)

#### Test Gaps
- Unit tests for LM Studio provider exist but do NOT test tool-use (JSON loop) behavior
- Agent runner tests use mock provider (not LM Studio)
- **No integration test** validates that LM Studio + Qwen model can execute a full tool-use cycle
- Live testing possible but requires manual LM Studio setup; not automated in CI

#### Recommended Next Action
Add a focused integration test (`tests/integration/lmstudio-tool-loop.test.ts`) that:
- Skips in CI (via `test.skipIf(!process.env.LMSTUDIO_URL)`)
- Validates end-to-end tool loop with actual LM Studio provider
- Confirms JSON response parsing and tool execution work
- Proves the intended model (`qwen/qwen3.5-35b-a3b`) flows correctly
- Acts as confidence baseline for future changes

### Files Analyzed
- `src/llm/providers/lmstudio.ts` — provider implementation
- `src/llm/gateway.ts` — routing abstraction
- `src/agents/runner.ts` — agent orchestration & tool loop
- `src/agents/local-tools.ts` — tool catalog & execution
- `src/dashboard/server.ts` — provider registration & config
- `src/config/defaults/models.json` — model policy (for reference)
- `src/config/index.ts` — config constants
- `tests/llm/provider-lmstudio.test.ts` — provider unit tests
- `tests/agents/runner.test.ts` — agent & tool-use tests
- `tests/agents/local-tools.test.ts` — tool execution tests
- `tests/llm/gateway.test.ts` — gateway & routing tests

### Summary
LM Studio does NOT use native tool-calling (not available in its OpenAI-compatible API). Instead, the runtime implements an app-managed JSON loop where tools are injected as text and models respond with JSON commands. The model string `qwen/qwen3.5-35b-a3b` is not masked or aliased—it flows transparently, but requires explicit environment configuration to override the hardcoded default `qwen-35`. Live evaluation is possible with manual setup; integration tests should be added to build confidence in the tool-use path.

## 2026-03-28: LM Studio live validation follow-up

- Verified the live endpoint exposes the intended model and can emit valid `{"type":"tool_call",...}` JSON without provider-native tool definitions.
- Captured the LM Studio rejection of `response_format: { type: "json_object" }`, which is the key runtime compatibility caveat.
- The app-managed JSON loop remains the correct tool-use contract to document.

## 2026-03-29: Memory Injection Audit

### Request
Verify whether memories are being created and injected into runtime; find the most recent memory injection timestamp, if any.

### Key Findings

**Current State (as of 2026-03-29 09:35 UTC):**
- **0 memories in agent_memory table** — complete empty state
- **All 87 LLM traces have empty memories_json** (value is [], never populated with actual entries)
- **1,198 memories created historically** (SQLite seq counter shows 1198, all now deleted)
- **Last decay/prune operation:** 2026-03-29 09:05:16 UTC
- **Traces created post-prune:** 11 new traces, all with empty memory arrays

**Architecture Verification (Sound):**
1. Memory recall and injection path is correct:
   - AgentRunner.run() line 884: memory.recall(agentName, { limit: 10 })
   - Line 973: memories passed to startLlmTrace({ ... memories })
   - Repository.startLlmTrace() line 952: memories correctly stored via normalizeMetadataJson(params.memories)

2. Memory creation entry points exist but dormant:
   - Dashboard UI: /api/memory/create endpoint (line 2616, server.ts)
   - Domain refresh: LLM-generated knowledge summaries (line 2763, server.ts)
   - Bootstrap: One-time seed from bootstrap-memory.json (line 186, config/index.ts)
   - Roster context: Team roster populated as domain_knowledge (line 507, roster-context.ts)

**Root Cause Identified:**
Memory injection mechanism works flawlessly—memories are correctly injected when present. However, **no code is actively creating new memories** during normal pipeline execution. All 1,198 historical memories were purged by prune() method. System awaits manual dashboard creation or explicit refresh triggers.

**Evidence:**
- Direct DB query + code inspection of src/agents/memory.ts, src/agents/runner.ts, src/db/repository.ts
- Most recent non-empty memory: Never (agent_memory table always empty)
- Most recent attempted injection: 2026-03-29 09:21:04 (writer agent) — contains memories_json = []

### Insight
System does NOT automatically extract learnings from agent execution. Memory creation is opt-in only. No passive hooks record what agents learned, decided, or found during article production.
- 2026-03-29 — New spawn batch queued Research to split the app kickoff into actionable slices after branch sync, with outputs intended to hand directly to Code for implementation start.


## 2026-03-30: Debug/Trace Surface Exposure Audit

### Request
Audit debug/trace surfaces and machine-facing detail exposure. Identify how much session/CWD/request-envelope detail is currently exposed to operators vs. relegated to dedicated diagnostics areas.

### Key Findings

**Trace internals (mostly isolated):**
1. Dedicated trace pages (`src/dashboard/views/traces.ts`) provide structured observability for providers, tool-use, thinking, and errors
2. New-idea trace integration (Code agent) properly surfaces trace links on errors; approved as UX-safe
3. Existing trace infrastructure is solid; good home for debug material

**Machine-facing detail remaining exposed:**
1. Session/CWD/request-envelope details in article-detail chrome
2. Pipeline activity data and stageRun metadata exposed in artifact tabs
3. Provider envelopes mixed into article workflow surfaces
4. Raw system terms (status chips like `needs_lead_review`) in header

**Article detail hierarchy issues:**
1. Defaults to `idea.md` (intermediate pipeline artifact, not editorial artifact)
2. Exposes raw filenames + `💭 trace` badges as tab labels
3. Token usage, provider breakdowns, revision history occupy prime space
4. No plain-language workflow sentence or editorial context

**Recommendations:**
1. De-emphasize machine terms on article detail (remove raw status chips)
2. Reorder artifact tabs to lead with human-facing artifacts (draft, review, contract)
3. Push token/usage/provider data to collapsed secondary area or off-page
4. Preserve trace link access but move out of main action cluster
5. Add plain-language workflow sentence (e.g., "Draft ready for editor review")

### Alignment with UX Findings

Both audits converge: article detail should be editorial-first. Existing trace infrastructure is good; the issue is layout and navigation hierarchy, not trace isolation or observability design.

### Validation Points

- Artifact relabeling covers all stage transitions
- Workflow sentence accuracy across Stages 1-6
- Token/usage/provider data remains accessible (just collapsed/moved)
- Trace links still discoverable but de-emphasized from main flow

### Next Steps

- Coordinate with UX agent on artifact relabeling and workflow sentence copy
- Code agent to implement hierarchy changes with focused view tests
- DevOps to extend e2e fixtures for article-detail state validation

## 2026-04-02: No-Code-Change Depth/Panel Redesign Impact

### Request
Review the depth/panel redesign research note and analyze schedule/depth-level risk areas, compatibility constraints, and existing patterns against current code.

### Key Findings

#### Architecture Status
**The split model is already implemented in production code.** The types system, data model, resolution logic, and model policy all support independent reader_profile, article_form, panel_shape, and analytics_mode controls. No schema changes or runtime rewrites needed.

- **Types.ts is architecture-complete**: EditorialControls, ResolvedEditorialControls, EDITORIAL_PRESETS, deriveDepthLevelFromArticleForm, resolveEditorialControls(), getPanelSizeGuidance()
- **Data model stores both old + new**: Article and ArticleSchedule interfaces have depth_level (legacy) plus all split fields
- **Panel size logic is shape-first**: getPanelSizeGuidance() keys off panel_shape, not depth
- **Model policy is agnostic**: Accepts both legacy (depthLevel) and new params

#### Compatibility Constraints
1. **UI surfaces are inconsistent**: new-idea.ts and home filter expose 3 depth options; schedules.ts exposes 4
2. **Schedule semantics need clarification**: Currently (content_profile + depth_level) pairs; should migrate to presets or explicit controls
3. **Article metadata edit has stage-1 lock**: Currently prevents ANY depth change post-stage-1; should refine to only lock reader_profile + article_form, allow panel_shape/analytics_mode changes
4. **Prompts expect collapsed depth_level**: Idea-gen and composePanel prompts parse depth as single signal; should migrate to separate reader_profile + article_form + panel_shape signals

#### Existing Patterns Preserved
- Presets as UI entry point (EDITORIAL_PRESETS already defined)
- Panel shape driving agent composition (getPanelSizeGuidance() correct)
- Additive migration with depth_level backward-compat
- Content profile as reader-experience summary
- Panel constraints as advanced override

#### Test Coverage
All 235 dashboard tests passing; none use the split fields directly. Tests should extend to cover:
- Legacy (depth_level only) → preset resolution
- Split controls → panel size guidance
- Schedule creation with preset vs explicit controls

### Risk Assessment
- **Data integrity:** LOW — fields already exist, backfill via resolveEditorialControls() is safe
- **Prompt coupling:** MEDIUM — prompts must be updated to parse new controls separately, but model policy already supports both paths
- **UI inconsistency:** LOW — can migrate surface-by-surface without breaking anything
- **Stage-1 lock:** MEDIUM — validation logic must evolve from "don't change depth" to "don't change reader_profile/article_form"

### Implementation Roadmap
1. **Phase 1 (Safe now):** Auto-backfill new fields from legacy depth_level via resolveEditorialControls()
2. **Phase 2 (UI alignment):** Replace depth dropdowns with preset selector + advanced panel (new-idea, schedules, home filter)
3. **Phase 3 (Validation):** Refine post-stage-1 lock to granular field-level rules
4. **Phase 4 (Prompts):** Update Lead/Writer/Editor agent context to parse split controls
5. **Phase 5 (Deprecation):** Mark depth_level deprecated (keep in schema, disallow in new paths)

### Recommendation

## 2026-04-02: Artifact Editing & Send-Back Feedback Loop Research

### Request
Conduct thorough research on two critical gaps:
1. Users cannot directly edit artifacts in the dashboard
2. "Send Back" feature doesn't wire feedback back to agents for incorporation

Produce comprehensive design proposal including data model, routes, UX, agent integration, and rollout plan.

### Key Findings

#### Gap #1: No Direct Artifact Editing in UI
- **Current state:** Artifacts are read-only (displayed via GET /htmx/articles/:id/artifact/:name)
- **Code evidence:** renderArtifactContent() (article.ts:381) only renders HTML; no POST/PUT/PATCH routes exist for edits
- **Impact:** Editors must regress article to ask agent to fix typos, rewrite sections, or incorporate corrections
- **Architecture verified:** ArtifactStore is well-designed (artifacts table has created_at/updated_at; upsert logic is sound)

#### Gap #2: Send-Back Reason Field is Decoupled from Agents
- **Current flow:** User submits "Send Back" form (to_stage, reason) → route handler → engine.regress() → repository.regressStage()
- **Reason storage:** Stored in stage_transitions.notes as `Regression: ${reason}` (server.ts:2259, repository.ts:1888)
- **Agent awareness:** ZERO — agents don't query stage_transitions; they re-run from fresh context (original prompt, no user feedback)
- **Design gap:** No mechanism to inject reason or user edits into agent prompt when re-running
- **Code evidence:** Traced full execution path (server.ts:2244–2267 → engine.ts:430 → repository.ts:1848); no feedback injection anywhere

#### Gap #3: Artifact Deletion on Regress is Destructive
- **Current behavior:** regressStage() calls clearArtifactsAfterStage() which hard-deletes all artifacts from stages > toStage
- **No backup:** Deleted artifacts are gone (no version history, no undo)
- **Implication:** If user had edited artifact and regressed, those edits vanish
- **Code location:** repository.ts:1897–1930 (clearArtifactsAfterStage with pattern-based stage mapping)

#### Downstream Effects (Verified)
1. **Editor experience:** Editor sees artifact, can't edit in-place → must regress → waits for agent → sees agent's fresh output (no user input)
2. **Agent behavior:** Auto-advance loop re-runs stage; agents start with original context; no knowledge that they're in a revision cycle or what the actual problem is
3. **Audit trail weakness:** Reason is logged but useless (not visible to agents or future reviewers)
4. **Quality impact:** Iterations take longer because feedback isn't actionable/embedded in agent context

#### Architecture Verified (Sound)
- ✅ Database schema supports versioning: artifacts(article_id, name, created_at, updated_at, content)
- ✅ Repository pattern is extensible: new tables (artifact_edits, feedback_packets) fit naturally
- ✅ Pipeline already tracks transitions: stage_transitions table can be enhanced with feedback references
- ✅ Agent runner pattern supports context injection: agents receive Repository + custom prompts; feedback context could be injected similar to revision history

### Recommended Design

**Core Model: Artifact Feedback Envelope**

Three new tables:
1. **artifact_edits** — tracks every user/agent edit with reason, category, diff history
2. **artifact_feedback_packets** — groups related edits + regression into atomic feedback submission
3. **articles.feedback_state** — 'none' | 'pending_review' | 'acknowledged' (tracks whether agent has processed feedback)

**Routes (New/Enhanced):**
- POST /articles/:id/artifacts/edit — save artifact edit (with reason + category)
- POST /articles/:id/regress (enhanced) — optional edits array + reason bundled as feedback packet
- POST /articles/:id/feedback-acknowledge (for agents) — report whether feedback was used

**UX Flow:**
1. Editor clicks "Edit This Artifact" button in artifact tab
2. Markdown editor opens (CodeMirror or similar)
3. Editor makes changes, fills in "Reason for change" + "Category" (typo, fact, tone, structure, clarity, other)
4. Saves as draft, OR clicks "Save & Request Revision"
5. If regressing: form appears asking for target stage + allows multi-artifact edit + overall feedback
6. Submits; feedback packet is created, edits are saved, article regresses
7. Agent re-runs; feedback context is injected into prompt ("USER EDITS BELOW: ..."); agent acknowledges receipt
8. Dashboard shows "Agent reviewed your feedback: [incorporated | ignored | noted]"

**Agent Integration:**
- When agents re-run after feedback, pipeline injects markdown block with user edits + reasons
- Explicit instruction: "User feedback below is INFORMATIONAL, not binding—you may incorporate or generate fresh content"
- Agent feedback-acknowledge endpoint tracks decisions (incorporated vs. ignored) for metrics

**Rollout: 4 phases over 3–4 months**
1. **Phase 1 (Foundation):** Schema, basic edit routes, simple textarea UI
2. **Phase 2 (Bundling):** Feedback packets, regress + edits together, enhanced UX
3. **Phase 3 (Injection):** Agent context building, feedback loop, acknowledgment
4. **Phase 4 (Polish):** Versioning UI, metrics, documentation

### Key Design Decisions

1. **User edits are suggestions, not commands** — Agents can generate fresh content or incorporate; explicit in prompt
2. **Feedback is bundled (edits + regression together)** — Ensures feedback reaches agent without requiring separate "instructions" entity
3. **Backward compatible** — No breaking changes; existing regress() method still works; feedback is opt-in
4. **Versioning focused on audit, not undo** — Keep history for comparison; don't resurrect old versions automatically

### Confidence Level

- ✅ **HIGH** on architecture (code traced end-to-end, gaps verified)
- ✅ **HIGH** on schema design (artifact_edits + feedback_packets fit naturally)
- ⚠️ **MEDIUM** on agent integration (assumes agents can handle injected markdown block in prompt; needs Code/Data agent validation)
- ⚠️ **MEDIUM** on UX (assumes CodeMirror + simple form is acceptable; needs UX agent sign-off)

### Next Action

**For Backend agent:** Use this design as input for architecture decision. Recommend starting with Phase 1 (edit routes + basic UI) as early win; Phase 2–4 can be planned once Phase 1 is validated with team.

### Files Analyzed
- src/dashboard/views/article.ts (renderArtifactContent, artifact tabs, send-back form)
- src/dashboard/server.ts (routes: /articles/:id, /htmx/articles/:id/artifact/:name, /htmx/articles/:id/regress)
- src/pipeline/engine.ts (advance, regress methods)
- src/db/repository.ts (regressStage, clearArtifactsAfterStage)
- src/db/artifact-store.ts (ArtifactStore class, artifact read/write)
- src/db/schema.sql (articles, artifacts, stage_transitions tables)
- src/pipeline/conversation.ts (revision history tracking)
- src/types.ts (Article, Stage, ArticleStatus types)

### Recommendation
**Start implementation now; no blocking issues.** The redesign is a UI + validation refinement of an already-correct architecture. Lead the UI phase with new-idea.ts and schedules.ts, coordinate with UX on preset messaging.

### Files Analyzed
- src/types.ts (types, presets, resolution, panel-size logic)
- src/llm/model-policy.ts (model selection, panel-size acceptance)
- src/dashboard/views/new-idea.ts, schedules.ts (UI surfaces)
- src/dashboard/server.ts (API routes)
- tests/dashboard/schedules.test.ts (current test patterns)

## Learnings

- 2026-04-03 — The canonical “new idea” prompt chain is split across three layers: `src/pipeline/idea-generation.ts` builds the live Lead task, `src/dashboard/views/new-idea.ts` provides the canonical markdown output template, and `src/config/defaults/skills/idea-generation.md` supplies freshness/year-accuracy guardrails. For scheduled Tuesday casual slots, the repo’s native framing already points to `casual_explainer` + `reader_profile=casual` + `article_form=brief` + `analytics_mode=explain_only`, with explicit UI hints in `src/dashboard/views/config.ts` and `src/dashboard/views/schedules.ts`. Existing `content/articles/*/idea.md` artifacts are useful for tone/examples but drift structurally, so future prompt-mirroring work should treat runtime/template files as source of truth and use Seahawks discussion-prompt artifacts only as tone/scaling references.

- 2026-03-30 — Debug/trace surfaces are well-segregated; the issue is article-detail hierarchy, not trace isolation. Article page mixes machine metadata with editorial context; moving debug content to secondary areas aligns with existing trace-page strategy. No new trace infrastructure needed; just hierarchy/copy fixes.

- 2026-04-02 — Depth/panel split is architecturally complete in code; migration is UI-forward. The types, data model, and resolution logic already support independent reader_profile/article_form/panel_shape/analytics_mode controls. No schema migration needed; fields exist and can be backfilled from depth_level via resolveEditorialControls(). Focus implementation on: (1) UI surface alignment (new-idea, schedules presets), (2) stage-1 lock refinement (granular field rules), (3) prompt integration with split controls.


## Learnings

### 2026-03-29: Copilot CLI session artifact harvest

- For preserved human-authored research/planning material, the high-signal local root is `C:\Users\jdl44\.copilot\session-state`. The nearby CLI-managed roots (`C:\Users\jdl44\AppData\Local\copilot`, `C:\Users\jdl44\AppData\Local\GitHub CLI`, `C:\Users\jdl44\AppData\Roaming\GitHub CLI`) were inspected and only exposed packaged docs/config, not project research worth archiving.
- The reusable artifact seams inside session-state are:
  - root-level carry-forward docs like `FINAL-SUMMARY.md`, `lead-issue-planning-draft.md`, and cleanup inventories
  - per-session `plan.md`
  - per-session `checkpoints\*.md`
  - per-session `research\*.md`
- Session UUID folders are much easier to triage when paired with session-store summaries (for example: `ee3cf027-724e-49f5-b205-0e8b3c3e90fc` = “Rearchitect Project For Version 2”, `fded7635-6d90-4180-ae1f-02247f6d5b78` = “Add Advanced LLM Inputs Outputs Page”).
- Recommended repo destination for later copy-in: `C:\github\nfl-eval\research\copilot-session-archive\` with collision-safe filenames that preserve date, session summary, session id, and original basename.

### 2026-04-02: Depth/panel redesign handoff rules

- The depth redesign should be treated as a separation-of-concerns migration: reader sophistication, article ambition, panel topology, and analytics intensity must become distinct controls instead of continuing to share `depth_level`.
- `Feature` is not a true orchestration tier in current runtime behavior; research recommends moving it under `article_form`/preset vocabulary rather than keeping it as a fourth depth level.
- Panel construction should key off first-class `panel_shape` intent, with optional panel constraints, instead of using audience depth as a proxy for team composition or agent count.
- Compatibility work must be additive first: keep `depth_level` during migration, backfill new fields from existing depth/content-profile data, and only remove old validators/mappings after UI, API, prompts, and runtime all read the split model.
- Key reference artifact for this handoff is `C:\Users\jdl44\.copilot\session-state\bb1ef496-5028-423f-b95b-62853c89d6c9\research\depth-level-on-scheudling-shows-4-values-while-new.md`.

### 2026-04-02: Dashboard surface audit for depth/panel redesign

- The split editorial model is already live in storage/types/runtime (`src\types.ts`, `src\db\schema.sql`, `src\db\repository.ts`), but the dashboard surfaces named in the audit still mostly expose only legacy controls (`depth_level`, `content_profile`) and do not surface `preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`, or `panel_constraints_json`.
- `src\dashboard\views\new-idea.ts` and `src\dashboard\views\home.ts` still present only three depth choices, while `src\dashboard\views\article.ts`, `src\dashboard\views\config.ts`, `src\dashboard\views\schedules.ts`, and server validators/routes accept four; this is the core user-visible terminology drift.
- The highest-risk compatibility bug is in repository update paths: `src\db\repository.ts` resolves editorial controls during `updateArticle()` and `updateArticleSchedule()`, so legacy-only edits can be silently overridden by already-populated split fields. This is why current baseline tests fail when trying to change `depth_level` or `content_profile` through legacy dashboard routes.
- Schedule execution is still legacy-first end to end: schedule forms/routes in `src\dashboard\server.ts` accept only `depth_level`/`content_profile`, and `src\pipeline\article-scheduler-service.ts` passes only `depthLevel` into `createIdeaArticle()`, even though the schedule record already stores resolved preset/split fields.
- Relevant baseline failures observed during audit: `tests\dashboard\metadata-edit.test.ts`, `tests\dashboard\schedules.test.ts`, and `tests\dashboard\settings-routes.test.ts` currently fail because legacy route edits do not round-trip once split editorial fields exist.

### 2026-04-02: Depth/Panel Redesign Decisions Merged
- **Spawn:** Backend Squad Agent requested impact scans from UX, Code, Research for depth/panel redesign
- **Analysis:** All three agents completed read-only audits
- **Decisions merged:** All inbox findings consolidated to `.squad/decisions/decisions.md` (2026-04-02T05:45:01Z)

#### UX Findings
- Dashboard surfaces split: new-idea/home expose depths 1–3; article/schedules expose 1–4
- Ghost option: Feature depth 4 cannot be created via primary UX, only set in metadata
- Inconsistent labels across surfaces (Casual Fan vs. Quick Take for depth 1)
- Decision: Unify terminology and option sets across all surfaces; migrate to preset-driven UX

#### Code Findings
- Preset model (reader_profile, article_form, panel_shape, analytics_mode) already exists in `src\types.ts` and is persisted
- Current inconsistency: new-idea/home expose 1–3; API/DB accept 1–4; runtime collapses 3–4 to same tier
- No partial changes allowed — all affected surfaces must move together (12 files)
- Decision: Target preset-based model as source of truth; migrate all surfaces deliberately

#### Research Findings
- Migration must be additive-first: keep `depth_level` as compatibility alias while introducing new fields
- Preserve schedule semantics: approachable-vs-deeper behavior must survive as presets
- Runtime refactor sequence: model-policy → panel-size → compose-panel → prompt before removal
- Execution rules documented with non-negotiable compatibility expectations
- Decision: Migration strategy established; ready for staged implementation planning

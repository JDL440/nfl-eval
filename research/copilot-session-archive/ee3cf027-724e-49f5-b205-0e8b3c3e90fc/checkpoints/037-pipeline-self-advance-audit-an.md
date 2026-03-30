<overview>
The user (Joe Robinson) is debugging and hardening the NFL Lab v2 article production pipeline to work as a fully autonomous end-to-end system. The pipeline should advance an article from idea (stage 1) through publish-ready (stage 7) without any manual UX actions or external orchestration. Prior sessions fixed REVISE cycle bugs, editor feedback preservation, image generation timing, and force-approve after max revisions. This session focused on diagnosing why the pipeline can't self-advance completely and identifying every architectural gap that requires manual intervention.
</overview>

<history>
1. **Image regeneration investigation (continuation from prior session)**
   - User reported article reached stage 7 but images weren't refreshed
   - Investigated: `images.json` artifact had fresh content but file timestamps on disk were 7 hours old (from earlier run before code fixes)
   - Root cause: During auto-advance across multiple dashboard restarts, images were generated in an earlier session but never re-generated in the current session because the article got stuck at the editor guard after recovery reset
   - Manually triggered image regen via `/htmx/articles/:id/generate-images` — confirmed it works
   - Fixed `server.ts`: removed hardcoded `maxRevisions: 2` (now uses default 3 from actions.ts)
   - Added safety net in `actions.ts`: generate images at stage 7+ if `images.json` is missing (stage 6 always regenerates)
   - Committed as `54c41a0`
   - Restarted dashboard on port 3456

2. **User asked to fix the E2E test scenario**
   - Initial request: "Make End to End scenario just run work without having dependency on UX page actions"
   - Read all 5 E2E test files: `pipeline.test.ts`, `edge-cases.test.ts`, `full-lifecycle.test.ts`, `live-server.test.ts`, `ux-happy-path.test.ts`
   - Ran failing tests — confirmed 4 failures across 2 files, all with same root cause
   - Root cause: `runDiscussion` (stage 3→4) parses panelist names from LLM-generated `panel-composition.md`, tries to load charter files for those names (e.g., "offensive-line-investment", "cap-economist"), none exist, all panelists fail, throws "All panelists failed"

3. **User clarified the real request** 
   - Not just about tests — about the PRODUCTION pipeline: "the process I just had you do which starts with creating an idea on auto advance. It should be able to advance completely without the UX or external actions."
   - Dispatched an explore agent to audit every blocking point in `autoAdvanceArticle`
   - Agent produced comprehensive analysis of all 6 stage transitions, all 7 guards, and identified 3 categories of stuck points

4. **Comprehensive audit results (completed)**
   - Identified 6 potential stuck points where auto-advance has NO recovery:
     1. **Stage 3→4: All panelists fail** (charter file mismatch) — THIS IS THE PRIMARY BLOCKER
     2. **Stage 4→5: Draft <200 words** (LLM returns short content, guard rejects)
     3. **Stage 5→6: Unparseable editor verdict** (LLM doesn't use expected format)
     4. **Stage 2→3: LLM timeout/error** (no retry mechanism)
     5. **Stage 1→2: LLM timeout/error** (no retry mechanism)
     6. **Stage 3→4: Panel composition format invalid** (guard detects no member lines)
   - Auto-advance ONLY has retry logic for editor REVISE loops (stages 4-5). All other failures = complete stop.
   - Publisher pass (stage 6→7) is a rubber stamp — guard only checks existence, not content quality
</history>

<work_done>
## Commits this session:

| Commit | Description |
|--------|-------------|
| `54c41a0` | fix: image regen safety net + remove hardcoded maxRevisions |

## Files modified:
- `src/dashboard/server.ts` — Removed hardcoded `maxRevisions: 2` at line 204 (now uses default 3)
- `src/pipeline/actions.ts` — Added image gen safety net at stage 7+ if images.json missing (lines 1076-1083)

## Current state:
- **Dashboard**: Running on port 3456 (shellId: `dashboard`), Copilot CLI provider with claude-opus-4.6
- **Test article**: `seahawks-just-showed-their-hand-on-witherspoon-and-jsns-futu` at stage 7, images manually regenerated
- **Test suite**: 1267 pass, 4 fail (same 4 pre-existing failures in pipeline.test.ts and edge-cases.test.ts)
- **Audit complete**: Full analysis of all blocking points in autoAdvanceArticle documented

## Work NOT yet started:
- [ ] Fix `runDiscussion` to fall back to single-moderator when all panelists fail (THE KEY FIX)
- [ ] Fix E2E tests to pass
- [ ] Update "max revisions exceeded" test expectations (force-approve changed behavior)
- [ ] Consider retry mechanisms for other stage failures
</work_done>

<technical_details>
### Pipeline Architecture — Auto-Advance Flow
`autoAdvanceArticle()` in `src/pipeline/actions.ts` is the single orchestrator. It loops `while (current_stage < maxStage)`, calling `executeTransition()` at each stage. Each transition: check guard → run LLM action → write artifact → advance stage.

### The Primary Blocker: `runDiscussion` Panelist Charter Mismatch
1. `composePanel` (stage 2→3) asks the LLM to create a panel composition with analyst names
2. LLM generates creative names: "Cap Economist", "Film Analyst", "Offensive Line Investment"
3. `parsePanelComposition()` (line 109) normalizes to slugs: "cap-economist", "film-analyst"
4. `runDiscussion` (line 450-469) tries to run each as an agent via `ctx.runner.run({agentName: ...})`
5. `AgentRunner` looks for charter file at `chartersDir/${agentName}.md` — doesn't exist
6. All panelists fail → line 474-475 throws "All panelists failed"
7. **Missing fallback**: When `panelists.length === 0` (unparseable), it falls back to single-moderator (line 424-446). But when panelists ARE parsed but ALL fail at runtime, it throws instead of falling back.

### The Fix Design (not yet implemented)
Change line 474-476 from:
```typescript
if (successfulResults.length === 0) {
  throw new Error('All panelists failed — cannot synthesize discussion');
}
```
To: fall back to single-moderator mode (same as the `panelists.length === 0` path). The panel-moderator agent has a charter file and always works.

### Other Stuck Points (lower priority)
- **Draft word count**: `writeDraft` doesn't validate output length. Guard requires ≥200 words. If LLM returns short content, pipeline stops. Could add retry or minimum-length instruction to prompt.
- **Editor verdict format**: `extractVerdict()` has 8 regex patterns + keyword fallback — very permissive. Low risk but possible if LLM writes completely unstructured review.
- **No retry for transient LLM failures**: If any stage's LLM call times out, pipeline stops. No automatic retry.

### Guard-Action Mismatch Pattern
3 guards can fail AFTER the action successfully wrote an artifact:
1. `requirePanelComposition` — artifact exists but no parseable member lines
2. `requireDraft` — artifact exists but <200 words
3. `requireEditorApproval` — artifact exists but no extractable verdict
This creates "stuck" states where the artifact exists, the action "succeeded", but the guard blocks advancement.

### Test Infrastructure
- **StubProvider**: Returns "Stub response for: {message}" — too simple for pipeline, produces garbage panelist names and short drafts
- **MockProvider**: Has canned stage-specific responses with `detectStageContext()`. Panel composition response contains real-looking but non-existent agent names. Has `setResponse()` override and `setMockForStage()` helper in tests.
- **MockProvider detection bug**: `detectStageContext()` scans ALL message content for keywords. When gathered context includes artifacts from prior stages (e.g., discussion-prompt.md content), it matches the wrong stage pattern.

### Force-Approve Behavior (changed from prior session)
After `maxRevisions` (default 3) exhausted:
- Overwrites `editor-review.md` with APPROVED verdict
- Does NOT stop — continues loop so article advances through remaining stages
- The edge-cases test "stops after maxRevisions exceeded" expects the OLD behavior (stops with error) — needs updating

### Image Generation Timing
- Stage 6: Always regenerates images (after editor approves)
- Stage 7+: Generates images only if `images.json` artifact is missing (safety net for restart recovery)
- `images.json` artifact is assigned to stage 5, so it gets cleared during REVISE regression
</technical_details>

<important_files>
- `src/pipeline/actions.ts`
  - Central pipeline actions + auto-advance orchestrator
  - **Lines 407-516**: `runDiscussion` — THE KEY FIX NEEDED at line 474-476 (fall back to single-moderator when all panelists fail)
  - Lines 109-156: `parsePanelComposition()` — extracts panelist slugs from LLM output
  - Lines 519-594: `writeDraft` — revision detection, previous draft injection
  - Lines 597-643: `runEditor` — writes editor-review.md with verdict
  - Lines 646-706: `runPublisherPass` — publisher checklist
  - Lines 923-1085: `autoAdvanceArticle()` — the main orchestration loop
  - Lines 929: `maxRevisions` default (3)
  - Lines 1040-1074: REVISE handling with editor feedback preservation + force-approve
  - Lines 1076-1083: Image generation trigger (stage 6 always, stage 7+ if missing)
  - Lines 738-755: `STAGE_ACTIONS` and `STAGE_ACTION_MAP` — action-to-stage mappings

- `src/pipeline/engine.ts`
  - Pipeline state machine, guards, transitions
  - Lines 175-203: `requireEditorApproval` guard with `extractVerdict()`
  - Lines 122-173: `extractVerdict()` — 8 regex patterns for verdict detection
  - Lines 232-275: TRANSITION_MAP
  - Lines 60-120: Guard functions (requireIdea, requirePrompt, requireDraft, etc.)

- `src/llm/providers/mock.ts`
  - MockProvider with canned stage-specific responses
  - Lines 14-186: `MOCK_RESPONSES` — pre-written content for each stage
  - Lines 193-216: `detectStageContext()` — keyword-based stage detection (has ordering/keyword-overlap bugs)
  - Lines 222-302: `MockProvider` class with `setResponse()` override

- `src/llm/providers/stub.ts`
  - Minimal stub: returns "Stub response for: {msg}". Too simple for pipeline E2E.

- `tests/e2e/pipeline.test.ts`
  - Full pipeline E2E test using `executeTransition` directly (no HTTP)
  - **Fails at line 331**: Stage 3→4 `runDiscussion` with StubProvider (panelist charters missing)
  - Lines 199-268: `buildFixtures()` — creates temp dir, charters, skills, repo, engine, etc.
  - Lines 298-384: Main test — idea through all stages

- `tests/e2e/edge-cases.test.ts`
  - Edge cases including REVISE loops via `autoAdvanceArticle`
  - **3 tests fail** (lines 614-735): All stuck at stage 3 due to runDiscussion panelist failure
  - Lines 596-612: `setMockForStage()` — helper to inject correct mock response per stage
  - Lines 663-690: "stops after maxRevisions" — expects old behavior (stop), needs update for force-approve
  - Lines 737-773: Lightweight mode test — PASSES (pre-writes all artifacts, skips LLM)

- `tests/e2e/full-lifecycle.test.ts` — HTTP-based lifecycle test, PASSES (manually writes artifacts)
- `tests/e2e/live-server.test.ts` — HTTP endpoint tests, PASSES
- `tests/e2e/ux-happy-path.test.ts` — UX flow test, PASSES (manually writes artifacts)

- `src/dashboard/server.ts`
  - Dashboard routes + background auto-advance
  - Line 202: `startBackgroundAutoAdvance` — now uses default maxRevisions (was hardcoded 2)
  - Line 238-261: `autoGenerateImages` function
  - Line 208: passes `generateImages: autoGenerateImages` to autoAdvanceArticle

- `src/agents/runner.ts`
  - `AgentRunner.run()` — loads charter by agentName, throws if not found
  - This is where panelist runs fail: "Agent charter not found: {name}"

- `src/db/repository.ts`
  - Lines 716-757: `clearArtifactsAfterStage` — artifact stage assignments for cleanup
</important_files>

<next_steps>
## Immediate — Fix pipeline self-advance (THE USER'S REQUEST):

### 1. Fix `runDiscussion` fallback (PRIMARY FIX)
- In `src/pipeline/actions.ts` line 474-476, when all panelists fail, fall back to single-moderator mode instead of throwing
- Reuse the existing single-moderator path (lines 426-446) which uses the `panel-moderator` agent (always has a charter)
- This makes the pipeline resilient to LLM-generated panelist names that don't match charter files

### 2. Fix E2E tests
- `pipeline.test.ts`: Should pass after fix #1 (runDiscussion will fall back to single-moderator)
- `edge-cases.test.ts` REVISE loop tests (3 failures): Should pass after fix #1
- `edge-cases.test.ts` "stops after maxRevisions" test: Update expectations — force-approve now means article REACHES stage 7 instead of stopping. Expected: `finalStage === 7`, `revisionCount >= maxRevisions`

### 3. Validate full test suite passes
- Run `npx vitest run` — all 4 previously-failing tests should now pass
- Commit fixes

### 4. Consider additional resilience (lower priority)
- Draft word count: Add minimum-length instruction to writeDraft prompt, or retry if <200 words
- Editor verdict: Add explicit "respond with APPROVED or REVISE" instruction to runEditor prompt
- Transient LLM failure retry: Add configurable retry count for any stage failure (not just REVISE)

## Dashboard state:
- Dashboard running on shellId `dashboard` (port 3456)
- Test article at stage 7 with fresh images
</next_steps>
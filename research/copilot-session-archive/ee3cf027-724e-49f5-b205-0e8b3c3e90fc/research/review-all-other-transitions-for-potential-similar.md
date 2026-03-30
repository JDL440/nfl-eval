# Pipeline Transition Audit: Hardening the State Machine

## Executive Summary

The REVISE-loop bug (article stuck at stage 4 after editor regression) was a symptom of **three systemic design weaknesses**: (1) duplicated auto-advance logic across routes with no shared implementation, (2) a "fire-and-forget" action model where actions always report success regardless of the semantic outcome (e.g., editor writes REVISE but action returns `success: true`), and (3) incomplete artifact lifecycle management during regressions. This audit examines every transition for similar vulnerabilities and proposes a hardening plan that prevents regression through architectural constraints, not just bug fixes.

## Confidence Assessment

- **High confidence**: All findings below are verified against source code with exact file/line citations.
- **High confidence**: The duplicated auto-advance logic is confirmed by comparing the API route (line 743) and HTMX route (line 1128) in `server.ts` — they are near-identical copies.
- **High confidence**: The `clearArtifactsAfterStage` gap is verified by reading the hardcoded map at `repository.ts:667-674`.
- **Medium confidence**: The "action succeeded but outcome was negative" pattern is an architectural assessment — the current system works for the happy path but has no formal mechanism to distinguish "action ran without error" from "action produced the desired outcome."

---

## 1. The Root-Cause Pattern: "Silent Semantic Failure"

The REVISE bug was not a one-off. It's an instance of a broader pattern:

> **An action runs successfully (no exception), writes an artifact, and returns `{ success: true }`. But the artifact's content represents a negative outcome (REVISE, REJECT, parse failure). The pipeline advances the stage number, then the *next* stage's guard fails, leaving the article in a state the auto-advance loop doesn't know how to handle.**

This pattern can recur at every transition where an LLM agent produces content that the pipeline later evaluates with a guard.

### Transitions Vulnerable to This Pattern

| From→To | Action | Guard at Next Stage | Vulnerable? | Risk |
|---------|--------|-------------------|-------------|------|
| 1→2 | `generatePrompt` | `requirePrompt` (existence) | **No** — guard only checks existence[^1] | Low |
| 2→3 | `composePanel` | `requirePanelComposition` (existence) | **Yes** — if composition is unparseable, `runDiscussion` falls back to single-moderator silently[^2] | Medium |
| 3→4 | `runDiscussion` | `requireDiscussionSummary` (existence) | **No** — guard only checks existence[^3] | Low |
| 4→5 | `writeDraft` | `requireDraft` (existence + 200-word min) | **Yes** — LLM could produce <200 words, thinking trace, or garbage[^4] | Medium |
| **5→6** | **`runEditor`** | **`requireEditorApproval` (APPROVED verdict)** | **YES — the bug we fixed** | **Critical** |
| 6→7 | `runPublisherPass` | `requirePublisherPass` (existence) | **No** — guard only checks existence[^5] | Low |
| 7→8 | `publish` | `requireSubstackUrl` (DB field) | **No** — guard checks a DB field, not an artifact[^6] | Low |

[^1]: `src/pipeline/engine.ts:64-69` — `requirePrompt` only checks `store.exists()`
[^2]: `src/pipeline/actions.ts:354-375` — `parsePanelComposition` returns `[]` on unparseable content, triggering fallback
[^3]: `src/pipeline/engine.ts:78-83` — `requireDiscussionSummary` only checks `store.exists()`
[^4]: `src/pipeline/engine.ts:85-99` — `requireDraft` checks existence AND `wordCount >= 200`
[^5]: `src/pipeline/engine.ts:167-176` — `requirePublisherPass` only checks existence
[^6]: `src/pipeline/engine.ts:178-190` — `requireSubstackUrl` checks `article.substack_url` DB field

---

## 2. Issue Catalog: All Identified Vulnerabilities

### 2.1 CRITICAL: Duplicated Auto-Advance Logic (DRY Violation)

The auto-advance loop is **copy-pasted** across two routes with independent evolution:

- **API route**: `src/dashboard/server.ts:743-842` (`POST /api/articles/:id/auto-advance`)[^7]
- **HTMX route**: `src/dashboard/server.ts:1128-1210` (`POST /htmx/articles/:id/auto-advance`)[^8]

Both contain identical `while` loops, REVISE handling, regression logic, image generation triggers, SSE emissions, and step tracking. Any future fix to one must be manually duplicated to the other.

**Additionally**, the `PipelineScheduler.advanceSingle()` at `src/pipeline/scheduler.ts:101-141`[^9] is a third advance pathway that has **no REVISE handling at all** — it calls `executeTransition` and returns the result without any regression logic. If a scheduler batch job advances an article to stage 6 and the editor returns REVISE, the scheduler silently reports failure with no regression.

[^7]: `src/dashboard/server.ts:743-842`
[^8]: `src/dashboard/server.ts:1128-1210`
[^9]: `src/pipeline/scheduler.ts:101-141`

### 2.2 HIGH: Incomplete Artifact Cleanup on Regression

`clearArtifactsAfterStage` in `src/db/repository.ts:666-687`[^10] has a **hardcoded** artifact-to-stage map:

```typescript
const ARTIFACT_STAGE: Record<string, number> = {
  'idea.md': 1,
  'discussion-prompt.md': 2,
  'panel-composition.md': 3,
  'discussion-summary.md': 4,
  'draft.md': 5,
  'editor-review.md': 6,
};
```

**Missing artifacts**:
- `publisher-pass.md` (stage 7) — not cleaned up on regression from stage 7
- `panel-*.md` (individual panelist artifacts from `runDiscussion`) — never cleaned up
- `editor-review-N.md` (numbered reviews from revision loops) — only `editor-review.md` is listed
- `*.thinking.md` (thinking traces for each artifact) — never cleaned up
- `_config.json` (per-article context overrides) — never cleaned up (though this is arguably correct)

When regressing from stage 6 to stage 4, stale `panel-*.md` artifacts persist. On re-run, the moderator may synthesize old panelist contributions with new ones, producing incoherent results.

[^10]: `src/db/repository.ts:666-687`

### 2.3 HIGH: Guard Weakness at Stage 2→3 (Panel Composition)

The guard for stage 3→4 (`requirePanelComposition`) only checks existence[^11]. If `composePanel` produces unparseable output (which happens — the user reported this exact issue), the pipeline advances to stage 3, then `runDiscussion` at stage 3→4 silently falls back to single-moderator mode[^12].

This isn't technically a "stuck" bug, but it degrades quality without user visibility. The article proceeds through the entire pipeline with a less rigorous discussion because the panel composition was garbage.

[^11]: `src/pipeline/engine.ts:71-76`
[^12]: `src/pipeline/actions.ts:356-374`

### 2.4 MEDIUM: `executeTransition` Does Double Guard Check

`executeTransition` checks the guard at step 1 (line 627)[^13], then calls `engine.advance()` at step 3 (line 697)[^14] which checks the guard **again** internally. This is wasteful but also creates a TOCTOU (time-of-check-time-of-use) window: if an artifact is modified between the two checks (e.g., by a concurrent request), the second guard check could fail after the action already ran.

[^13]: `src/pipeline/actions.ts:627-647`
[^14]: `src/pipeline/actions.ts:696-705` — `engine.advance()` calls `canAdvance()` internally at `engine.ts:281`

### 2.5 MEDIUM: No Max-Stage Protection in Lightweight Mode

In the lightweight auto-advance path (no `ActionContext`)[^15], there is no REVISE handling or regression logic at all. If someone manually writes an `editor-review.md` with a REVISE verdict while the dashboard runs in lightweight mode, auto-advance simply stops with an error and never regresses. This is the identical class of bug to the original REVISE issue, just on a different code path.

[^15]: `src/dashboard/server.ts:807-828` (API route) and `src/dashboard/server.ts:1177-1189` (HTMX route)

### 2.6 MEDIUM: `runEditor` Action Has No Semantic Awareness

The `runEditor` action writes the editor review artifact and returns `success: true` unconditionally[^16]. It doesn't inspect the verdict. This means:

1. `executeTransition` reports success
2. The stage advances from 5 to 6
3. Only when the *next* `executeTransition` call checks the guard for 6→7 does the REVISE surface
4. The auto-advance loop must pattern-match the guard failure error string (`/REVISE|PIVOT|not APPROVED/i`) to decide whether to regress

This is fragile — the regex could fail to match if the guard error message wording changes.

[^16]: `src/pipeline/actions.ts:478-508`

### 2.7 LOW: MCP Server Has No REVISE Handling

The MCP `article_advance` tool at `src/mcp/server.ts:297-324`[^17] performs a single guard-check-and-advance. It has no REVISE detection, no regression, and no retry logic. An external MCP client calling `article_advance` at stage 6 would get a guard failure with no automatic recovery.

[^17]: `src/mcp/server.ts:297-324`

### 2.8 LOW: `regressStage` Deletes Editor Reviews Unconditionally

At `src/db/repository.ts:647`[^18], regression to any stage < 5 deletes **all** `editor_reviews` rows. But the REVISE regression goes to stage 4, which IS less than 5. This means the structured editor review data (verdict, error_count, etc.) is lost even though the editor-review artifact should be preserved as context for the next draft (which is why we added `editor-review.md` to `writeDraft`'s includes).

Wait — this is the `editor_reviews` *table* in the DB, not the artifact. The artifact in `clearArtifactsAfterStage` is handled separately. But the DB row loss means the dashboard's editor review UI loses its structured data on regression.

[^18]: `src/db/repository.ts:646-648`

---

## 3. Architecture Diagram: Current State

```
                                 ┌──────────────────┐
                                 │  Dashboard UI     │
                                 │  (Hono + htmx)    │
                                 └────┬───────┬──────┘
                                      │       │
                    ┌─────────────────┤       ├─────────────────┐
                    │                 │       │                 │
                    ▼                 ▼       ▼                 ▼
          /htmx/.../advance   /htmx/.../    /api/.../    /api/.../
          (single step,       auto-advance  auto-advance  advance
           guard-only)        ┌──────────┐  ┌──────────┐  (single,
                              │ COPY #1  │  │ COPY #2  │   guard+
                              │ while()  │  │ while()  │   to_stage)
                              │ + REVISE │  │ + REVISE │
                              │ handling │  │ handling │
                              └────┬─────┘  └────┬─────┘
                                   │              │
                                   ▼              ▼
                          ┌───────────────────────────┐
                          │   executeTransition()     │
                          │   actions.ts:601-722      │
                          │                           │
                          │  1. Check guard            │
                          │  2. Run action (agent)     │
                          │  3. Advance stage          │
                          │  4. Audit log              │
                          └───────────┬───────────────┘
                                      │
                        ┌─────────────┼─────────────┐
                        ▼             ▼             ▼
                  PipelineEngine  AgentRunner  PipelineAuditor
                  (guards, FSM)  (LLM calls)  (structured log)
                        │
                        ▼
                  Repository (SQLite)
                  + ArtifactStore (blob table)
```

**Problem**: The REVISE handling lives in the dashboard routes (boxes labeled "COPY #1" and "COPY #2"), not in `executeTransition` or `PipelineEngine`. This means every new advance pathway (scheduler, MCP, future CLI) must independently implement REVISE detection and regression.

---

## 4. Hardening Recommendations

### 4.1 Extract a Single `autoAdvanceArticle()` Function (Priority: Critical)

**Problem**: Auto-advance logic is copy-pasted across 2 routes, and the scheduler has a third variant without REVISE handling.

**Solution**: Extract the while-loop into a standalone function in `src/pipeline/actions.ts`:

```typescript
export interface AutoAdvanceResult {
  steps: Array<{ from: number; to: number; action: string; duration?: number }>;
  finalStage: number;
  error?: string;
  revisionCount: number;
}

export async function autoAdvanceArticle(
  articleId: string,
  ctx: ActionContext,
  options?: {
    maxStage?: number;       // default: 7
    maxRevisions?: number;   // default: 2
    onStageChange?: (from: number, to: number, action: string) => void;
    onError?: (stage: number, error: string) => void;
  },
): Promise<AutoAdvanceResult> { ... }
```

Both dashboard routes and the scheduler would call this single function. SSE emissions would use the callback hooks.

**Test**: A single test suite for `autoAdvanceArticle` would cover all three callers.

### 4.2 Move REVISE Detection Into `executeTransition` (Priority: High)

**Problem**: `runEditor` returns `success: true` even when the editor says REVISE. The caller must pattern-match error strings to detect this.

**Solution**: After running `runEditor`, `executeTransition` should inspect the newly-written artifact:

```typescript
// After action succeeds at stage 5 (runEditor writes editor-review.md)
if (fromStage === 5) {
  const review = ctx.repo.artifacts.get(articleId, 'editor-review.md');
  if (review) {
    const verdict = extractVerdict(review);
    if (verdict && verdict !== 'APPROVED') {
      return {
        success: false,
        error: `Editor verdict: ${verdict}`,
        verdict,  // new field on ActionResult
        duration: Date.now() - start,
      };
    }
  }
}
```

Add a `verdict?: string` field to `ActionResult` so callers can programmatically detect REVISE without regex matching on error strings. This is more composable than the current approach.

### 4.3 Make `clearArtifactsAfterStage` Dynamic (Priority: High)

**Problem**: Hardcoded artifact-to-stage map misses panelist artifacts, numbered reviews, thinking traces, and publisher-pass.md.

**Solution**: Replace the hardcoded map with a pattern-based approach:

```typescript
const ARTIFACT_STAGE_PATTERNS: Array<{ pattern: RegExp; stage: number }> = [
  { pattern: /^idea\.md$/, stage: 1 },
  { pattern: /^idea\.thinking\.md$/, stage: 1 },
  { pattern: /^discussion-prompt\.md$/, stage: 2 },
  { pattern: /^discussion-prompt\.thinking\.md$/, stage: 2 },
  { pattern: /^panel-composition\.md$/, stage: 3 },
  { pattern: /^panel-composition\.thinking\.md$/, stage: 3 },
  { pattern: /^discussion-summary\.md$/, stage: 4 },
  { pattern: /^discussion-summary\.thinking\.md$/, stage: 4 },
  { pattern: /^panel-.*\.md$/, stage: 4 },        // individual panelist artifacts
  { pattern: /^draft\.md$/, stage: 5 },
  { pattern: /^draft\.thinking\.md$/, stage: 5 },
  { pattern: /^editor-review(-\d+)?\.md$/, stage: 6 },
  { pattern: /^editor-review(-\d+)?\.thinking\.md$/, stage: 6 },
  { pattern: /^publisher-pass\.md$/, stage: 7 },
  { pattern: /^publisher-pass\.thinking\.md$/, stage: 7 },
];
```

Then iterate all artifacts for the article and delete any whose `stage > toStage`.

### 4.4 Add Guard Quality Checks (Priority: Medium)

**Problem**: Most guards only check artifact existence, not content quality. A 1-word `discussion-prompt.md` passes the guard.

**Solution**: Add minimum quality thresholds to key guards:

| Guard | Current Check | Proposed Addition |
|-------|--------------|-------------------|
| `requirePrompt` | existence | Min 50 words |
| `requirePanelComposition` | existence | Must parse to ≥1 `PanelMember` |
| `requireDiscussionSummary` | existence | Min 100 words |
| `requireDraft` | existence + 200 words | Already good |
| `requireEditorApproval` | APPROVED verdict | Already good |
| `requirePublisherPass` | existence | Min 50 words |

The `requirePanelComposition` enhancement is especially important because unparseable compositions silently degrade the pipeline.

### 4.5 Add Integration Tests for REVISE Loop (Priority: High)

**Problem**: The existing E2E test at `tests/e2e/edge-cases.test.ts:330-403`[^19] tests REVISE handling via **manual** htmx steps (advance, check, regress, rewrite, advance again). It does NOT test the auto-advance REVISE loop, which is where the bug lived.

**Solution**: Add tests that exercise the auto-advance loop with a mock that returns REVISE on the first editor call and APPROVED on the second:

```typescript
describe('Auto-advance REVISE retry loop', () => {
  it('retries after REVISE regression and succeeds on second attempt', async () => {
    // Set up article at stage 4 with discussion-summary.md
    // Mock writer to produce draft, editor to return REVISE first, APPROVED second
    // Call auto-advance
    // Assert: article ends at stage 7, revision count = 1
  });

  it('stops after maxRevisions exceeded', async () => {
    // Mock editor to always return REVISE
    // Call auto-advance
    // Assert: article ends at stage 4, error contains "revisions 2 times"
  });

  it('includes editor-review.md in writer context on retry', async () => {
    // Mock writer, capture what context it receives on second call
    // Assert: context includes editor-review.md content
  });
});
```

[^19]: `tests/e2e/edge-cases.test.ts:330-403`

### 4.6 Add an `ActionOutcome` Type (Priority: Medium)

**Problem**: `ActionResult.success` conflates "action ran without error" with "action produced a positive outcome." There's no way for `executeTransition` to know whether the action produced the desired result without inspecting artifacts.

**Solution**: Extend `ActionResult`:

```typescript
export interface ActionResult {
  success: boolean;
  error?: string;
  duration: number;
  artifactPath?: string;
  outcome?: 'positive' | 'negative' | 'neutral';  // NEW
  verdict?: string;                                   // NEW (for editor)
}
```

Then `runEditor` can return `{ success: true, outcome: 'negative', verdict: 'REVISE' }` and the caller doesn't need regex heuristics.

### 4.7 Add Transition Audit Assertions (Priority: Low)

Add a compile-time or startup-time check that every `STAGE_ACTION_MAP` entry has a corresponding `TRANSITION_MAP` entry, and every `CONTEXT_CONFIG` key maps to a valid action:

```typescript
// Startup validation
for (const [stage, actionName] of Object.entries(STAGE_ACTION_MAP)) {
  assert(STAGE_ACTIONS[actionName], `Missing action: ${actionName}`);
  assert(CONTEXT_CONFIG[actionName], `Missing context config: ${actionName}`);
  const transition = TRANSITION_MAP.find(t => t.from === Number(stage));
  assert(transition, `No transition from stage ${stage}`);
  assert(transition.action === actionName, `Action mismatch at stage ${stage}`);
}
```

This prevents silent drift between the three parallel registries (`TRANSITION_MAP`, `STAGE_ACTION_MAP`, `CONTEXT_CONFIG`).

---

## 5. Remaining Transitions: Detailed Analysis

### 5.1 Stage 1→2: `generatePrompt`

- **Guard**: `requireIdea` — checks existence AND non-empty content[^20]
- **Action**: Calls `lead` agent with `idea-generation` skill, writes `discussion-prompt.md`[^21]
- **Risk**: **Low**. The guard is strong (checks content, not just existence). The action can fail if the LLM errors, but that's handled by the try/catch returning `success: false`.
- **Potential issue**: If the LLM returns an empty or trivial prompt (e.g., "Write about football"), the next guard (`requirePrompt`) would still pass because it only checks existence.

[^20]: `src/pipeline/engine.ts:53-62`
[^21]: `src/pipeline/actions.ts:258-289`

### 5.2 Stage 2→3: `composePanel`

- **Guard**: `requirePrompt` — existence only[^22]
- **Action**: Calls `lead` agent with `panel-composition` skill, passes agent roster, writes `panel-composition.md`[^23]
- **Risk**: **Medium**. The LLM frequently produces panel compositions that `parsePanelComposition()` can't parse. The pipeline falls back to single-moderator mode silently. The user reported this happening.
- **Recommended fix**: Make `requirePanelComposition` validate that the content parses to ≥1 panel member.

[^22]: `src/pipeline/engine.ts:64-69`
[^23]: `src/pipeline/actions.ts:291-341`

### 5.3 Stage 3→4: `runDiscussion`

- **Guard**: `requirePanelComposition` — existence only[^24]
- **Action**: Parses panel, runs panelists in parallel, synthesizes via moderator, writes `discussion-summary.md`[^25]
- **Risk**: **Medium**. If ALL panelists fail (line 401-402), the action throws and returns `success: false`. But if some fail and some succeed (line 399), the discussion proceeds with a partial panel. This is probably fine but not surfaced to the user.
- **Potential issue**: The individual `panel-*.md` artifacts are written but never listed in `ARTIFACT_STAGE` for cleanup. On regression from stage 5 to stage 3, these stale artifacts persist.

[^24]: `src/pipeline/engine.ts:71-76`
[^25]: `src/pipeline/actions.ts:343-442`

### 5.4 Stage 4→5: `writeDraft`

- **Guard**: `requireDiscussionSummary` — existence only[^26]
- **Action**: Gathers context (discussion-summary.md + idea.md + editor-review.md), calls `writer` agent, writes `draft.md`[^27]
- **Risk**: **Medium**. If the writer produces a short draft (<200 words), the next guard (`requireDraft`) will fail. This isn't catastrophic — auto-advance stops — but the article gets stuck at stage 5 with an inadequate draft and no automatic retry.
- **Potential issue**: The writer's task prompt is generic: "Write the full article draft from the panel discussion summary." On a revision pass, this doesn't mention that the editor requested changes. The `editor-review.md` content IS included via the context config (after our fix), but the task prompt doesn't explicitly tell the writer "this is a revision — address the editor's feedback." This could lead to the writer ignoring the editor review and producing a similar draft.

[^26]: `src/pipeline/engine.ts:78-83`
[^27]: `src/pipeline/actions.ts:445-475`

### 5.5 Stage 5→6: `runEditor` (THE BUG)

- **Guard**: `requireDraft` — existence + 200-word minimum[^28]
- **Action**: Calls `editor` agent, writes `editor-review.md`[^29]
- **Status**: **FIXED** in commit `ef75d88` — auto-advance now retries after REVISE regression
- **Remaining risk**: The fix is applied in the dashboard route layer, not in `executeTransition`. If the scheduler or MCP server triggers this transition, they don't get the REVISE handling.

[^28]: `src/pipeline/engine.ts:85-99`
[^29]: `src/pipeline/actions.ts:477-508`

### 5.6 Stage 6→7: `runPublisherPass`

- **Guard**: `requireEditorApproval` — checks editor review verdict[^30]
- **Action**: Calls `publisher` agent, writes `publisher-pass.md`, creates DB row[^31]
- **Risk**: **Low**. The guard is the strongest in the pipeline (semantic content check). The action creates both the artifact and the DB row.
- **Potential issue**: The guard reads `editor-review.md` or `editor-review-N.md` (numbered). If a stale `editor-review.md` with REVISE coexists with a newer `editor-review-1.md` with APPROVED, the sort logic correctly picks the highest-numbered file. But if someone manually creates `editor-review-99.md`, it would override all previous reviews.

[^30]: `src/pipeline/engine.ts:137-165`
[^31]: `src/pipeline/actions.ts:510-548`

### 5.7 Stage 7→8: `publish`

- **Guard**: `requirePublisherPass` — existence only[^32]
- **Action**: Checks `substack_url` is set, returns success[^33]
- **Risk**: **Low**. This is a no-op action — publishing is handled externally via the Substack API. The guard just checks the publisher-pass artifact exists.
- **Potential issue**: The action checks `substack_url` but the *guard* at this transition checks `requirePublisherPass`. There's a mismatch: the guard passes (publisher-pass.md exists) but the action fails (substack_url not set). This returns `success: false` with an error that the auto-advance loop doesn't special-case, leaving the article at stage 7 forever.

[^32]: `src/pipeline/engine.ts:167-176`
[^33]: `src/pipeline/actions.ts:550-573`

---

## 6. Testing Strategy for Non-Regression

### 6.1 Property-Based Tests for the Transition Map

```typescript
describe('TRANSITION_MAP consistency', () => {
  it('every action in STAGE_ACTION_MAP has a TRANSITION_MAP entry', () => { ... });
  it('every action has a CONTEXT_CONFIG entry', () => { ... });
  it('every TRANSITION_MAP guard is a function', () => { ... });
  it('transitions are contiguous (no gaps)', () => { ... });
  it('ARTIFACT_STAGE_PATTERNS covers all artifacts created by actions', () => { ... });
});
```

### 6.2 Guard Boundary Tests

For each guard, test the exact boundary conditions:

```typescript
describe('Guard boundary tests', () => {
  it('requireDraft fails at 199 words, passes at 200', () => { ... });
  it('requireEditorApproval parses all known LLM verdict formats', () => { ... });
  it('requirePanelComposition validates parseable content', () => { ... }); // NEW
});
```

### 6.3 Auto-Advance Integration Tests

```typescript
describe('autoAdvanceArticle (extracted function)', () => {
  it('advances from stage 1 to 7 in happy path', () => { ... });
  it('retries after REVISE and succeeds', () => { ... });
  it('stops after maxRevisions', () => { ... });
  it('handles REJECT (no retry)', () => { ... });
  it('handles action failure at any stage', () => { ... });
  it('handles guard failure at any stage', () => { ... });
  it('emits callbacks for SSE integration', () => { ... });
  it('records stage_run for every action', () => { ... });
});
```

### 6.4 Regression Artifact Cleanup Tests

```typescript
describe('clearArtifactsAfterStage (dynamic)', () => {
  it('clears panel-*.md on regression to stage 3', () => { ... });
  it('clears editor-review-N.md on regression to stage 4', () => { ... });
  it('clears *.thinking.md alongside their parent artifacts', () => { ... });
  it('preserves _config.json on any regression', () => { ... });
  it('clears publisher-pass.md on regression to stage 6', () => { ... });
});
```

---

## 7. Prioritized Implementation Plan

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Extract `autoAdvanceArticle()` from duplicated routes | Medium | Eliminates DRY violation, single place for all advance logic |
| **P0** | Add REVISE-loop auto-advance integration test | Small | Prevents regression of the specific bug we just fixed |
| **P1** | Make `clearArtifactsAfterStage` pattern-based | Small | Prevents stale artifact contamination |
| **P1** | Add `outcome`/`verdict` to `ActionResult` | Small | Eliminates fragile regex matching |
| **P1** | Add REVISE handling to `PipelineScheduler` | Small | Prevents identical bug in batch mode |
| **P2** | Add quality thresholds to weak guards | Medium | Prevents silent quality degradation |
| **P2** | Update `writeDraft` task prompt for revision awareness | Small | Improves revision quality |
| **P2** | Add startup validation for map consistency | Small | Catches configuration drift early |
| **P3** | Add REVISE handling to MCP `article_advance` | Small | Prevents API consumer surprises |

---

## 8. Key Files Reference

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/pipeline/engine.ts` | State machine: guards, transitions, advance/regress | Guards: 53-190, TRANSITION_MAP: 194-237, PipelineEngine: 245-346 |
| `src/pipeline/actions.ts` | Action implementations + executeTransition | Actions: 258-573, executeTransition: 601-722, STAGE_ACTION_MAP: 589-597 |
| `src/pipeline/context-config.ts` | Per-action upstream artifact configuration | CONTEXT_CONFIG: 23-30 |
| `src/dashboard/server.ts` | Dashboard routes including duplicated auto-advance | API auto-advance: 743-842, HTMX auto-advance: 1128-1210 |
| `src/pipeline/scheduler.ts` | Batch scheduler (no REVISE handling) | advanceSingle: 101-141 |
| `src/mcp/server.ts` | MCP article_advance (no REVISE handling) | 297-324 |
| `src/db/repository.ts` | DB operations: advance, regress, artifact cleanup | advanceStage: 551-613, regressStage: 617-663, clearArtifacts: 666-687 |
| `src/types.ts` | Stage definitions, type aliases | VALID_STAGES, STAGE_NAMES: 1-14 |
| `tests/pipeline/engine.test.ts` | Guard + engine unit tests | 30-640+ |
| `tests/e2e/edge-cases.test.ts` | REVISE loop E2E test (manual steps only) | 327-403 |

---

## Footnotes

[^1]: `src/pipeline/engine.ts:64-69`
[^2]: `src/pipeline/actions.ts:354-375`
[^3]: `src/pipeline/engine.ts:78-83`
[^4]: `src/pipeline/engine.ts:85-99`
[^5]: `src/pipeline/engine.ts:167-176`
[^6]: `src/pipeline/engine.ts:178-190`
[^7]: `src/dashboard/server.ts:743-842`
[^8]: `src/dashboard/server.ts:1128-1210`
[^9]: `src/pipeline/scheduler.ts:101-141`
[^10]: `src/db/repository.ts:666-687`
[^11]: `src/pipeline/engine.ts:71-76`
[^12]: `src/pipeline/actions.ts:356-374`
[^13]: `src/pipeline/actions.ts:627-647`
[^14]: `src/pipeline/actions.ts:696-705`
[^15]: `src/dashboard/server.ts:807-828`
[^16]: `src/pipeline/actions.ts:478-508`
[^17]: `src/mcp/server.ts:297-324`
[^18]: `src/db/repository.ts:646-648`
[^19]: `tests/e2e/edge-cases.test.ts:330-403`
[^20]: `src/pipeline/engine.ts:53-62`
[^21]: `src/pipeline/actions.ts:258-289`
[^22]: `src/pipeline/engine.ts:64-69`
[^23]: `src/pipeline/actions.ts:291-341`
[^24]: `src/pipeline/engine.ts:71-76`
[^25]: `src/pipeline/actions.ts:343-442`
[^26]: `src/pipeline/engine.ts:78-83`
[^27]: `src/pipeline/actions.ts:445-475`
[^28]: `src/pipeline/engine.ts:85-99`
[^29]: `src/pipeline/actions.ts:477-508`
[^30]: `src/pipeline/engine.ts:137-165`
[^31]: `src/pipeline/actions.ts:510-548`
[^32]: `src/pipeline/engine.ts:167-176`
[^33]: `src/pipeline/actions.ts:550-573`

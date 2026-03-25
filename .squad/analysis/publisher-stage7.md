# Analysis — Stage 7 (Publisher) Flow

**Date:** 2026-03-24T22:04:25Z  
**Agent:** Publisher  
**Scope:** Analysis-only review of stage 7 inputs, seams, minimum change set, tests, constraints, and dashboard impacts

## Stage 7 Inputs

**Primary Artifact:** `draft.md`  
**Advisory Artifact:** `editor-review.md`  
**Readiness Marker:** `publisher-pass.md`  
**Dashboard State:** Article status, current stage, linked Substack draft URL

**Configuration:**
- `src/config/defaults/skills/substack-article.md` (article structure contract)
- `src/config/defaults/skills/publisher.md` (role-specific skill)
- `src/config/defaults/charters/nfl/publisher.md` (persona and authority)

## Integration Seams

### Upstream (Stage 6 Editor → Stage 7 Publisher)
- **Guard:** `requireEditorApproval()` in `src/pipeline/engine.ts` — only APPROVED verdicts advance
- **Artifact handoff:** `editor-review.md` + shared `revision-summary.md`
- **Semantic:** Publisher expects the draft to be Editor-approved and ready for publication

### Downstream (Stage 7 Publisher → Stage 8 / Dashboard)
- **Guard:** `requirePublisherPass()` + `requireSubstackUrl()` in `src/pipeline/engine.ts`
- **Readiness marker:** `publisher-pass.md` signals publication readiness
- **Actual publish:** Dashboard routes in `src/dashboard/server.ts` own draft creation and Substack publish actions
- **Semantic:** Publisher validates readiness; dashboard performs actual Substack operations

## Test Coverage

**Covered:**
- `tests/pipeline/actions.test.ts` — Publisher pass artifacts and context composition
- `tests/dashboard/publish.test.ts` — Dashboard publish page and Substack draft/publish flows
- `tests/dashboard/server.test.ts` — Publish routes (draft creation, error handling)
- `tests/pipeline/engine.test.ts` — Publish-readiness guards and stage 7→8 transitions

**Adequacy:** Tests currently lock the two-step flow (draft creation separate from publish) and validate Publisher readiness checks.

## Constraints & Dashboard Impact

**Dashboard Ownership:**
- Draft creation via `createDraft()` → Substack service call
- Publish operation via `updateDraft()` → Substack publish endpoint
- Dashboard UI controls publish workflow, not Publisher agent

**Non-Blocking Optional Actions:**
- Substack Note creation
- Tweet posting via X
- "Publish All" multi-article flow

**Stage 7 Readiness Requirements:**
- Draft exists and is structurally valid
- Linked Substack draft URL is set
- Editor verdict is APPROVED
- Roster mentions validated
- Stat/draft claims validated

## Critical Finding: Skill/Code Semantics Mismatch

**Issue:** `src/config/defaults/skills/substack-article.md` describes Stage 7 as **tool-driven publish** (e.g., "call Substack API to publish"), but the actual code treats Stage 7 as a **readiness validation stage** with dashboard-owned publish actions.

**Impact:**
- If Publisher prompt is read and expected to execute publish actions, it will fail (no tools available).
- Operators may misunderstand Stage 7 responsibility (Publisher validates, dashboard publishes).
- Potential confusion during debugging if skill description does not match code behavior.

**Recommendation:** Update `src/config/defaults/skills/substack-article.md` to clarify that:
- Stage 7 Publisher validates readiness only
- Dashboard owns actual Substack draft creation and publish operations
- Publisher prompt should focus on validation and handoff, not orchestration

## Minimum Change Set

**To align skill with code semantics:**
1. Update `src/config/defaults/skills/substack-article.md` Stage 7 section to remove references to tool-driven publish
2. Clarify that Publisher is a dashboard handoff stage, not an execution stage
3. Consider updating `src/config/defaults/charters/nfl/publisher.md` to reinforce this boundary

**No code changes required** for stage 7 pipeline/dashboard logic; only documentation alignment.

## Publish Readiness Assessment

✅ **Ready for core article publish flow as currently implemented**

- Two-step architecture (draft creation + publish) is sound
- Deterministic readiness guards are in place
- Dashboard UI properly separates optional actions from required publish
- Tests adequately cover both happy path and error cases

⚠️ **Documentation gap** — skill/code semantics mismatch should be resolved to prevent operator confusion.

## Next Steps

1. **Immediate:** Review and approve skill documentation update to reflect dashboard ownership of publish actions
2. **Short-term:** If simplifying Stage 5-7 context per Lead decision, ensure Publisher prompt focuses on readiness validation, not orchestration
3. **Long-term:** Consider separating Substack Note/Tweet features from core publish readiness to reduce scope creep

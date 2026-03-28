# Session Log — Second-Pass Workflow Fix

**Date:** 2026-03-28T06:46:06Z  
**Scope:** Seahawks JSN article stall diagnosis and Stage 6 blockerless/advisory revise fix  

## Session Summary

Three-agent investigation diagnosed the live Seahawks JSN article's remaining stall as **post-approval advisory churn at Stage 6**, not a surviving Stage 5 shell gate. Code implemented a focused runtime fix in `worktrees\V3\src\pipeline\actions.ts` to treat blockerless `REVISE` reviews as advisory and downgrade them to `APPROVED` after a blocker-only retry, with explicit guardrails from Lead to preserve minimal Stage 5 shell, placeholder hard guard, approval finality, and escalation machinery.

## Agents & Outcomes

### Code Agent (code-diagnose-second-pass)
**Status:** ✓ Completed  
**Output:** Second-pass workflow simplification diagnosis and implementation direction  
**Key Finding:** Blockerless `REVISE` feedback is workflow noise (evidence-deficit/editorial suggestions), not a real revision gate

**Artifact Chain Evidence:**
- Pass 1: `editor-review.md` mixes true blockers with suggestions
- Pass 2: `editor-review-2.md` fixes all blockers, verdict `APPROVED`
- Pass 3: `editor-review-3.md` exists only for yellow cleanup, adds HTML TODO to draft

**Implementation Seam:** `worktrees\V3\src\pipeline\actions.ts`
- If Editor returns `REVISE` with no `[BLOCKER type:id]` lines → force blocker-only normalization
- If still no blocker → treat as `APPROVED` instead of looping

### Lead Agent (lead-second-pass-guardrails)
**Status:** ✓ Completed  
**Output:** Explicit guardrails and rollback triggers for second-pass fix  
**Approval:** Validated Code's diagnosis and approved runtime seam direction

**Preserved Behaviors:**
1. Minimal Stage 5 shell stays hard (headline, subtitle, TLDR, empty draft guard)
2. Placeholder leakage stays hard (TODO/TBD/TK must not pass)
3. Warnings remain advisory (Stage 5 warnings don't block advancement)
4. Writer revises in place (no draft restarts)
5. Stage 6 approval is terminal (only true `REVISE`/`REJECT` reopens)
6. Escalation machinery intact (repeated blocker fingerprinting, `needs_lead_review` hold)
7. Editor remains accuracy gate (name, stat, quote, staleness only)

**Rollback Triggers:**
- Minimal shell guard weakened
- Placeholder leakage becomes publish-safe
- `APPROVED` still triggers another revision
- Editor blocker taxonomy widens again
- Escalation contract breaks
- Advisory findings become hidden blockers

### Research Agent (research-reviewer)
**Status:** ✓ Completed  
**Output:** Validation of issue class diagnosis  
**Finding:** Seahawks JSN stall is evidence-deficit/editorial churn at Stage 6, not Stage 5 failure

**Runtime Evidence:**
- Article at Stage 6 / `needs_lead_review` after three `REVISE` verdicts
- `writer-factcheck.md`: zero verified claims
- `writer-support.md`: absent
- Blocker metadata: null (escalation couldn't classify loop)

**Confirmation:** Stage 5 is already narrow; remaining issue is post-approval advisory churn

## Deliverables

1. ✓ **Diagnosis:** Blockerless `REVISE` feedback identified as advisory, not hard-block
2. ✓ **Implementation direction:** Runtime seam in `actions.ts` with blocker-only retry logic
3. ✓ **Guardrails:** Explicit preservation of Stage 5 shell, placeholder guard, approval finality, escalation
4. ✓ **Rollback triggers:** Six conditions for rejection/reversion defined
5. ✓ **Team sign-off:** Code (implementation ready), Lead (guardrails), Research (confirmation)

## Files Affected

- `worktrees\V3\src\pipeline\actions.ts` (runtime normalization seam)
- `src/config/defaults/charters/nfl/editor.md` (editor prompt contract — may need refinement)

## Next Steps

1. Code implements runtime seam in `actions.ts`
2. Monitor first 20 articles post-fix
3. Validate blockerless `REVISE` reviews convert to advisory approval
4. Confirm no Stage 5 regression or placeholder leakage
5. Verify escalation machinery still functional

## Decision Outcomes

**Merged from inbox:**
- `code-second-pass-workflow.md` → `decisions.md`
- `lead-second-pass-guardrails.md` → `decisions.md`

**Status:** Ready for main-branch merge once Code commits changes


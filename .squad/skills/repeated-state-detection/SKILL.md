---
name: Repeated State Detection and Escalation
domain: pipeline
confidence: high
tools: [typescript, vitest]
---

# Repeated State Detection and Escalation

## When to Use

- A process loops through retry/revision cycles, and you need to detect when the same problem occurs consecutively.
- Instead of infinite retry loops, you want to escalate to a different path (e.g., human review) after N repetitions.
- The detection should be deterministic and exact-match (not fuzzy heuristics).

## Pattern

1. **Fingerprint the state** — Normalize a state signature (e.g., blocker type + IDs) into a comparable form.
2. **Compare consecutive instances** — Look at the immediately previous and current state; skip stale/old history.
3. **Trigger escalation on match** — When signatures are identical, create an escalation artifact (e.g., `lead-review.md`) and transition to a holding state.
4. **Keep holding state minimal** — Use a status flag (e.g., `needs_lead_review`) rather than adding a new pipeline stage.
5. **Define post-escalation outcomes** — Document what happens after human/external review: rework, wait, abandon.
6. **Add focused tests** — Prove the detection logic fires and the old loop path does not.

## NFL Lab example

**Issue #123 — Repeated Blocker Escalation**

When Editor returns a `REVISE` with the same blocker signature as the immediately previous revision:

1. **Fingerprint:** Normalize `blocker_type` + `blocker_ids` into a deterministic hash/string.
2. **Compare:** In `autoAdvanceArticle()`, extract blocker signatures from last two consecutive editor `REVISE` summaries.
3. **Escalate on match:** Write `lead-review.md` with repeated blocker fingerprint + latest editor feedback + next-action menu.
4. **Hold state:** Add article status `needs_lead_review` (stays at Stage 6, no new stage).
5. **Skip old paths:** Do not regress to Stage 4 or invoke force-approve.
6. **Define outcomes:** `REFRAME` → Stage 4 regression; `WAIT`/`PAUSE` → remain Stage 6; `ABANDON` → archive.

**Implementation seams:**
- Detection helpers: `src/pipeline/conversation.ts` — normalize `blocker_type` + `blocker_ids`, then compare only the last two editor `REVISE` summaries
- Escalation seam: `src/pipeline/actions.ts` — `maybeEscalateRepeatedRevisionBlocker()` writes `lead-review.md` and flips the article to `needs_lead_review`
- Visibility seam: `src/dashboard/views/article.ts` + `src/db/repository.ts` — treat `lead-review.md` as a first-class Stage 6 artifact and clear it automatically on regressions below Stage 6
- Tests: `tests/pipeline/actions.test.ts` + `tests/pipeline/conversation.test.ts` — prove the exact-match detection fires and the old regress/force-approve path does not

## Why This Works

- **Exact match prevents false positives** — No fuzzy heuristics means the escalation triggers reliably.
- **Consecutive comparison is fast** — No need to scan full history; just compare last two.
- **Holding state avoids stage explosion** — Reuses existing Stage 6 with a minimal status flag.
- **Clear post-escalation path** — Documentation defines all possible outcomes so human reviewers know what to do.
- **Tests lock it in** — Regression suite proves the detection and blocking behavior persist.

## Anti-Patterns to Avoid

❌ **Fuzzy similarity detection** — Leads to false positives and unpredictable escalation.  
❌ **Scanning full history** — Expensive and fragile; compare only consecutive instances.  
❌ **Creating new pipeline stages** — Ripples across dashboard, scheduler, and many tests. Use status flags instead.  
❌ **Infinite escalation paths** — Always define what happens after escalation (e.g., who reviews, what are the outcomes).  
❌ **Under-tested detection** — Add explicit tests for the match/no-match cases.

## See Also

- **Post-Stage Retrospective Artifact** — When to use artifacts instead of new stages
- **Bounded Prompt History** — If your escalation seam needs historical context

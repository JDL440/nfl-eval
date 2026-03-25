---
name: revision-escalation
domain: pipeline
confidence: high
tools: [typescript, vitest]
---

# Revision Escalation

## When to use

- A workflow currently force-approves work after repeated automatic revision loops.
- Repeated retries are hiding unresolved risk instead of fixing it.
- There is already a durable human-review seam you can reuse.

## Pattern

1. Keep one or two automatic revision attempts for clear, cheap fixes.
2. Detect churn with either repeated blocker signatures or a simple revision cap.
3. When the cap is hit, write a durable handoff artifact that summarizes the latest blocker and next-action menu.
4. Set explicit review-hold state instead of mutating the latest review into a fake approval.
5. Lock the behavior with focused tests that prove escalation happens and force-approval does not.

## NFL Lab example

- `src/pipeline/actions.ts` keeps the Stage 6 repeated-blocker escalation seam and adds a revision-cap escalation path.
- The handoff artifact is `lead-review.md`, and the hold state is article status `needs_lead_review`.
- Focused regression coverage lives in `tests/pipeline/actions.test.ts`.

## Why this works

- Escalation makes churn visible instead of papering over it with an auto-approved artifact.
- Reusing an existing hold seam keeps the runtime change surgical while still improving operator honesty.

---
name: Lead Escalation Over Force Approve
domain: pipeline
confidence: high
tools: [typescript, vitest, view, rg]
---

# Lead Escalation Over Force Approve

## When to use

- A staged content workflow keeps bouncing between review and revision.
- The old fallback was to auto-approve after a max revision count.
- You want the pipeline to surface unresolved churn honestly instead of pushing risk downstream.

## Pattern

1. Keep the normal revise-and-regress path for the first bounded retry window.
2. Detect special repeated-blocker cases early and escalate immediately when the same blocker fingerprint repeats.
3. When the generic revision cap is exhausted, write a concise `lead-review.md` handoff with the current blocker and next-action choices.
4. Mark the article status as `needs_lead_review` and stop auto-advancing.
5. Keep focused tests for both paths: repeated-blocker escalation and generic revision-limit escalation.

## Why this works

- It removes silent force-approval from the runtime while preserving a bounded automatic retry loop.
- Operators can distinguish “same blocker repeating” from “general churn never converged.”
- The pipeline state becomes easier to audit because escalation is explicit in both status and artifact history.

## NFL Lab example

- `src/pipeline/actions.ts` uses `maybeEscalateRepeatedRevisionBlocker()` for exact repeated Editor blockers.
- The same file uses a revision-limit handoff (`lead-review.md`) plus `needs_lead_review` when Stage 5/6 churn exceeds the retry cap.
- Focused regression coverage lives in `tests/pipeline/actions.test.ts`, including repeated-blocker escalation and revision-cap escalation without any `Auto-approved after ...` artifact rewrite.

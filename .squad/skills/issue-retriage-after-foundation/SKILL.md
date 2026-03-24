---
name: Issue Re-Triage After Foundation Lands
domain: workflow
confidence: high
tools: [view, rg, vitest]
---

# Issue Re-Triage After Foundation Lands

## When to Use

- An issue was previously blocked behind foundation work.
- The foundation seams now exist in the repo and need a bounded re-triage.
- You need to decide whether the issue is now actionable without reopening prerequisite issues.

## Workflow

1. Restate the original blocker decision in one sentence.
2. Verify the prerequisite seams directly in code and tests, not just in issue text.
3. Decide whether the blocked issue can now start on top of the existing seam.
4. Name the **narrowest safe seam** that uses the prerequisite work as-is.
5. Route the issue to the first lane that owns the remaining work (often policy/design before code).
6. Reopen prerequisite issues only if you find a real defect in their delivered seam.

## NFL Lab Example

**Issue #124 — fallback to opinion-framed mode**

- Prior decision: blocked behind `#120` structured blocker tracking and `#123` repeated-blocker escalation.
- Re-triage check:
  - `src/pipeline/conversation.ts` now carries structured blocker metadata.
  - `src/pipeline/actions.ts` now escalates repeated blockers into `lead-review.md` plus `needs_lead_review`.
  - `src/dashboard/views/article.ts` and `src/dashboard/server.ts` already expose the paused Lead-review seam.
- Result: the issue becomes actionable, but the next lane is **Research**, not Code.
- Safe seam: define fallback policy on top of the existing Stage 6 Lead-review hold instead of changing blocker detection/state mechanics.

## Anti-Patterns to Avoid

❌ Reopening foundation issues just because a downstream issue is now active.  
❌ Letting the downstream issue re-specify or widen the already-approved prerequisite seam.  
❌ Jumping straight to runtime implementation when the remaining work is still policy-first.  
❌ Treating issue comments as proof; always verify the repo state and focused tests.

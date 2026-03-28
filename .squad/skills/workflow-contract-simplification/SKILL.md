---
name: Workflow Contract Simplification
domain: pipeline-architecture
confidence: high
tools: [typescript, vitest]
---

# Workflow Contract Simplification

## When to use

- A multi-stage workflow has become noisy because multiple roles enforce overlapping rules.
- Prompt tweaks are no longer enough because churn is structural.
- You need to simplify behavior without rewriting the whole state machine.

## Pattern

1. **Reassign ownership clearly**
   - Upstream creator owns draft/package quality.
   - Runtime owns only deterministic safety rails.
   - Downstream reviewer owns a narrow gate, not every quality dimension.

2. **Shrink blockers before deleting them**
   - Keep only checks code can enforce reliably.
   - Downgrade softer findings to warnings or side artifacts.

3. **Replace silent exhaustion with honest escalation**
   - Remove auto-approve / force-pass paths.
   - Preserve structured blocker metadata.
   - Escalate repeated failures to a higher-review role.

4. **Preserve UI truth**
   - Revision UX should describe the real next work.
   - Do not let product copy imply users are returning to an older stage conceptually when they are really fixing the current draft/output.

## NFL Lab example

- Writer should own draft quality with a compact support artifact.
- Engine should keep only minimal deterministic draft guards.
- Editor should become accuracy-only.
- `autoAdvanceArticle()` should escalate after repeated failures instead of force-approving.
- Article-page revision UX should stay draft-first.

## Evidence-deficit stall check

Before removing more Stage 5 blockers, confirm what class of stall is actually happening:

1. **If the article reached Stage 6 multiple times, the stall is usually not a remaining Stage 5 shell blocker.**
   - Inspect runtime state, latest `draft.md`, `writer-factcheck.md`, and `editor-review.md`.
   - If Editor keeps rejecting for missing contract facts, missing comp set, unlabeled stats, or unsupported thesis evidence, you have an **evidence-deficit loop**, not a malformed-draft loop.

2. **Check whether the upstream support seam actually exists at runtime.**
   - If the charter says Writer should use a compact support artifact but the context wiring or artifacts only include raw fact-check notes, loosening Stage 5 further will not solve the stall.
   - Missing `writer-support.md` / exact-fact allowlist is a stronger root-cause signal than a remaining headline/TLDR guard.

3. **Check whether repeated-blocker metadata is still structured.**
   - If revision summaries carry null blocker metadata because Editor output drifted away from tagged blockers, the workflow will escalate only on revision-count exhaustion.
   - That is a reviewer risk: the visible Lead handoff still works, but the intended repeated-blocker classification seam is effectively broken.

4. **Check for runtime contract drift before trusting source-file simplifications.**
   - In NFL Lab, `seedKnowledge()` only copies default charters/skills when the runtime files are missing, and `AgentRunner` loads prompts directly from `config.chartersDir` / `config.skillsDir`.
   - That means a live article can still be following an older Editor/Writer contract even after `src/config/defaults/...` was simplified in source. If runtime reviews still emit legacy sections like `## 🔴 ERRORS / 🟡 SUGGESTIONS / 🟢 NOTES`, fix the runtime contract sync problem before blaming the remaining Stage 5 shell.

## Review checklist

- Are warnings truly advisory in code flow?
- Did the downstream reviewer lose overlapping responsibilities?
- Is any force-pass branch still reachable?
- Are repeated blockers still structured for escalation?
- Does the UI reflect the simplified workflow honestly?
- Does `APPROVED` actually end the required review loop, or are advisory follow-ups still reopening the draft?

## Anti-pattern: post-approval advisory churn

If an approval gate already returned `APPROVED`, the system should treat that as terminal for required workflow unless a new blocking defect is introduced. Do **not** schedule another required pass just to clean up suggestions, yellow notes, or "nice-to-have" polish.

### Safe handling

- Keep advisory items in the review artifact or a follow-up queue.
- Do not reopen Stage 4/5/6 automatically for non-blocking cleanup.
- Do not let advisory cleanup inject visible TODO/placeholder text into the publish draft.

### Why it matters

This failure mode looks like "we're almost done" but still consumes the same churn budget as a real blocker. It also hides ownership: the reviewer approved the draft, but the runtime keeps acting as if approval was provisional.

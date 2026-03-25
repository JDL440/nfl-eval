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

## Review checklist

- Are warnings truly advisory in code flow?
- Did the downstream reviewer lose overlapping responsibilities?
- Is any force-pass branch still reachable?
- Are repeated blockers still structured for escalation?
- Does the UI reflect the simplified workflow honestly?

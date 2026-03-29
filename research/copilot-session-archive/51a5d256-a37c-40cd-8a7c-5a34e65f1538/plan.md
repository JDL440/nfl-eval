## Goal

Run Ralph against the JDL440/nfl-eval backlog, maximize parallel issue pickup, keep the GitHub Project board in sync, and auto-merge safe work when ready.

## Steps

1. Resolve squad context, routing, and board workflow skill.
2. Scan open issues/PRs and separate actionable work from pending-user/blocked items.
3. Launch a parallel wave:
   - Lead triage for unassigned squad issues
   - Assigned agents for clearly actionable issues
   - Scribe for orchestration logging
4. Collect results, verify any file/PR outputs, and queue follow-up agents immediately.
5. Repeat Ralph board scan until no actionable work remains, then report idle status.

## Constraints

- Update project-board status for every touched issue.
- Start issue comments with `TLDR:`.
- Auto-merge safe PRs; auth/secrets/deployment changes require human review.
- Do not modify pipeline charters or unrelated pipeline code unless work is explicitly tracked by a Squad issue.

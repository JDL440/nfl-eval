# History — Ralph

## Session 1 — Team Initialization
- **Date:** 2026-03-22
- **Context:** Squad initialized for NFL Lab (nfl-eval). TypeScript/Node.js platform with 8-stage article pipeline, Hono+HTMX dashboard, multi-provider LLM gateway, MCP tools for Substack/image gen/nflverse.
- **Repo:** JDL440/nfl-eval
- **Owner:** Joe Robinson (Product Owner / Tech Lead)
- **Note:** Ralph operates as the background work monitor. Runs via both GitHub Actions (squad-heartbeat.yml — lightweight triage) and local ralph-watch.ps1 (heavy agent work, 5-minute interval). The article pipeline agents in src/config/defaults/charters/ are separate from the Squad team.

## Learnings
- 2026-03-22: Board drift can happen after merged work; Ralph should reconcile issue state, merged PR state, and GitHub Project status together. In this repo, #81, #82, #83, and #85 needed explicit board moves to Done even after the issues/PRs were already closed or merged.
- 2026-03-22: When one issue fans out into multiple simultaneous PRs, Ralph should not leave it as generic in-progress work. For nfl-eval, the correct pattern is: summarize the competing PRs in a TLDR issue comment, mark the issue `pending-user`, and move the board item to `Pending User` until one PR is selected and the rest are closed.
- 2026-03-22: If an issue is sitting in `For Review` but the owner asks a new blocking question, Ralph should move it back to `In Progress`. The board should reflect the next real action (author response/update), not the previous state.
- 2026-03-22: Investigation-only issues should not stay `In Progress` once research is done. If no implementation slice has been chosen and there is no active PR, Ralph should move the item to `Pending User` and ask Joe to pick the first shippable slice.
- 2026-03-22: Joe's standing directive is that Ralph should merge reviewed, verified PRs without waiting for another nudge. If review/merge uncovers additional work, Ralph should ensure it is captured as a tracked GitHub issue instead of leaving it in comments or local notes.
- 2026-03-22: If an owner follow-up knocks an issue out of For Review, Ralph should verify the question against code + tests before leaving it parked In Progress. If the implementation already answers the question and no new change is required, move the board item back to For Review with a TLDR comment that cites the governing path.
- 2026-03-22: New squad issues can get duplicate `squad:*` labels when issue triage and heartbeat overlap. Ralph should collapse the issue back to the intended domain label, add any missing project card, and leave a TLDR note with the resulting board status.
- 2026-03-22: Verified PRs should be merged as soon as they are reviewed, and any extra work discovered during the merge should become a tracked issue immediately.
- 2026-03-22: When board state reflects stale momentum instead of the next real action, Ralph should move the item to `In Progress` or `Pending User` so the project board stays aligned with current blockers.
- 2026-03-22: For issue #93, keep a single canonical `main`-based PR and treat stacked or reused branches as retarget/rebase/close candidates; the board should not advance until that choice is explicit.

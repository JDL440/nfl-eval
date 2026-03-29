Problem: Ralph was activated and needs to continuously work the squad backlog for this repository.

Approach:
- Resolve squad team root and current roster/routing.
- Scan GitHub issues and PRs for actionable work.
- Prioritize unblocked items and spawn the appropriate agents in parallel.
- Collect results, log through Scribe, and repeat until the board is clear or Ralph is stopped.

Todos:
- Scan the current backlog and categorize work.
- Launch the first batch of actionable agents.
- Collect results and trigger Scribe logging.
- Re-scan and continue the Ralph loop.

Notes:
- Prefer actionable `go:yes` work without `pending-user`.
- Skip blocked items unless the user specifically wants them unblocked.

## Goal
Run Ralph against `JDL440/nfl-eval`: inspect open squad issues, update project-board statuses, spawn parallel agents for all actionable work, review/merge safe PRs, and archive stale done items.

## Steps
1. Inspect `.squad` routing/state and GitHub backlog/board data.
2. Classify open issues by actionability, labels, and constraints.
3. Move actionable issues to `In Progress` and spawn the right agents in parallel.
4. Collect results, review/merge safe PRs, update board/issue comments, and repeat until the board is clear or blocked.

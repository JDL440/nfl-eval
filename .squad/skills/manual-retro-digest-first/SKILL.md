---
name: Manual Retro Digest First
domain: pipeline-learning
confidence: high
tools: [view, rg, gh]
---

# Manual Retro Digest First

## When to use

- A system already records structured retrospective or postmortem findings per item.
- The missing capability is cross-item synthesis into process improvements or learning updates.
- It is unclear whether a scheduled job or GitHub workflow is worth the maintenance cost yet.

## Pattern

1. **Lock v1 to a manual CLI trigger.**
   - Avoid cron/workflow automation until the operator cadence and output shape are proven.
2. **Treat structured tables as the source of truth.**
   - Prefer persisted fields (role, finding type, priority, article metadata, timestamps) over scraping markdown artifacts.
3. **Emit a bounded human-review digest.**
   - Markdown first; optional JSON if it helps later automation.
4. **Keep side effects manual.**
   - Surface issue-ready and learning-ready candidates, but do not auto-open issues or mutate team knowledge in v1.
5. **Split work cleanly.**
   - Research defines grouping/promotion heuristics.
   - Code implements cross-item queries, CLI output, and tests.
   - Lead locks scope and reviews promotion rules.

## Why this works

- It preserves signal quality while the team learns which findings are genuinely reusable.
- It avoids baking weak heuristics into scheduled automation too early.
- It gives a clear promotion path: manual CLI now, workflow wrapper later if the digest proves useful.

## NFL Lab example

- Per-article retrospective findings are generated in the retrospective branch implementation.
- The right v1 follow-up is a manual digest over `article_retrospectives` and `article_retrospective_findings`.
- Candidate output should separate **process-improvement** follow-ups from **learning-update** follow-ups, while keeping final approval manual.

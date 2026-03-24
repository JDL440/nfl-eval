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
   - If the runtime seam is already present and research closes first, unblock the **digest scaffold** issue before the **promotion-layer** issue; do not keep either one blocked on a stale port task.
6. **After the scaffold ships, narrow the parent issue to docs/operational closeout.**
   - If the manual trigger, structured query, and bounded digest already exist, the remaining parent-issue gap is usually operator guidance, not more heuristics or automation.
   - Route that closeout slice to Code unless product scope explicitly changes.

## Why this works

- It preserves signal quality while the team learns which findings are genuinely reusable.
- It avoids baking weak heuristics into scheduled automation too early.
- It gives a clear promotion path: manual CLI now, workflow wrapper later if the digest proves useful.
- It keeps execution order concrete: scaffold first, promotion second, instead of letting closed research or already-landed runtime work keep the chain artificially blocked.

## NFL Lab example

- Per-article retrospective findings are generated in the retrospective branch implementation.
- The right v1 follow-up is a manual digest over `article_retrospectives` and `article_retrospective_findings`.
- Candidate output should separate **process-improvement** follow-ups from **learning-update** follow-ups, while keeping final approval manual.

## Implementation notes

- Pull the digest input through one joined repository query that returns findings plus article metadata for the latest N retrospectives; keep the CLI itself read-only.
- Group findings first by `role + finding_type`, then dedupe repeated wording with normalized lowercase text (punctuation stripped) so markdown and JSON can share the same aggregation pass.
- Bound the report explicitly: cap candidate sections and per-category examples, and prefer evidence fields that help human review (`articleCount`, `priorityCounts`, latest timestamp, sample article titles).
- When promotion heuristics are layered on later, keep the promoted candidate arrays explicit and human-reviewable: emit separate process-improvement vs learning-update lists, include deterministic `promotionReasons`, and prefer disjoint candidate classes so one normalized finding does not appear in both sections of the same digest.
- If the approved process-improvement rule is “lead-authored OR repeated across 2+ items,” encode repeated `process_improvement` promotion directly instead of relying on stricter churn/repeated-issue heuristics; otherwise repeated non-lead process fixes can fall through to weaker learning thresholds or disappear entirely.
- If the repo already ships a manual digest trigger plus typed markdown/JSON output, treat the trigger surface as settled for v1 and focus research on operator workflow, promotion thresholds, and side-effect boundaries instead of proposing a new scheduler or stage.
- Once the scaffold + promotion layer are in mainline, close the umbrella issue by documenting operator usage (`how to run`, `when to review`, `what to do with candidates`) before considering any workflow wrapper or scheduled automation.

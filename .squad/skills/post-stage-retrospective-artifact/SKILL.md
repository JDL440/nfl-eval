---
name: Post-Stage Retrospective Artifact
domain: pipeline
confidence: high
tools: [view, rg, gh]
---

# Post-Stage Retrospective Artifact

## When to Use

- A new workflow step should run after an article or pipeline slice completes.
- The current stage model is already hard-coded across several surfaces.
- The new step mainly produces learnings, audits, or summaries rather than gating the main happy-path execution.

## Pattern

1. Check whether the pipeline stage model is fixed in a central type/constant file (for NFL Lab, `src/types.ts`).
2. If adding a new numbered stage would ripple across dashboard, scheduler, MCP, tests, and artifacts, prefer a post-stage artifact/process instead.
3. Reuse existing completion signals and revision/history data rather than inventing a parallel trigger system.
4. Store two outputs:
   - a human-readable artifact for operators
   - structured DB records for later querying and aggregation
5. If a future cross-article or system-wide analyzer is requested, scope that as follow-up work unless it is strictly required for the first slice.

## Must-Haves

- Be explicit that the work is **not** a new numbered stage unless the repo truly needs stage-level gating.
- Define idempotence expectations so reruns do not create duplicate artifacts.
- Require structured findings, not just one markdown blob, when downstream analysis is expected.
- Name likely file seams up front: pipeline trigger, persistence schema/repository, and any optional dashboard surface.
- When porting from an older branch into a fast-moving checkout, cherry-pick only the retrospective-specific helper block and persistence seams; do not overwrite newer prompt-handoff or validation logic that happens to live in the same file.
- Re-check adjacent repository/index behavior before copying DB hunks. In NFL Lab, retrospective code can ride along with `src/db/repository.ts`, but unrelated `usage_events` ordering/index logic is a separate invariant and must not regress.
- If mainline already contains the full retrospective slice at those seams, a **no-op port decision** is valid. Treat branch-only differences in neighboring guardrails, prompts, or indexing logic as drift to avoid, not as work to merge.

## NFL Lab example

- Issue `#108` adds a writer/editor/Lead retrospective for articles with at least one revision iteration.
- The issue was scoped as a post-Stage-7 artifact/process because `src/types.ts` hard-codes stages `1..8`.
- Likely implementation seams are `src/pipeline/actions.ts`, `src/pipeline/conversation.ts`, `src/db/schema.sql`, `src/db/repository.ts`, and focused tests, with dashboard surfacing kept optional/minimal.
- In a later port triage, the safe merge plan was to preserve current `buildRevisionSummaryContext()`/writer-structure-guard behavior and bring over only the retrospective helpers plus SQLite persistence, explicitly excluding older branch changes that weakened `usage_events` ordering determinism.

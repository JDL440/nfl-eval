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

## NFL Lab example

- Issue `#108` adds a writer/editor/Lead retrospective for articles with at least one revision iteration.
- The issue was scoped as a post-Stage-7 artifact/process because `src/types.ts` hard-codes stages `1..8`.
- Likely implementation seams are `src/pipeline/actions.ts`, `src/pipeline/conversation.ts`, `src/db/schema.sql`, `src/db/repository.ts`, and focused tests, with dashboard surfacing kept optional/minimal.
- A durable idempotence pattern is: trigger from the existing auto-advance completion path once `current_stage >= 7`, write a deterministic artifact name (for example `revision-retrospective-r{revisionCount}.md`), upsert the parent DB row on `(article_id, completion_stage, revision_count)`, then replace the child findings rows for that parent.

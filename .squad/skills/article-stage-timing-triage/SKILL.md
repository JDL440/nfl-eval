---
name: Article Stage Timing Triage
domain: dashboard-observability
confidence: high
tools: [view, rg, vitest, github]
---

# Article Stage Timing Triage

## When to use

- A dashboard issue asks for total time spent on an article or per-stage/per-state timing.
- The stage-runs sidebar already exists, but it is unclear whether the missing metric is a UI aggregation gap or a persistence gap.
- You need to decide whether a timing request is independent from other article-detail observability work.

## Workflow

1. Start at the article-detail seam:
   - `src/dashboard/server.ts` for `/articles/:id`, `/htmx/articles/:id/stage-runs`, and `/htmx/articles/:id/live-sidebar`
   - confirm whether `repo.getStageRuns(id)` is already passed into the page/sidebar
2. Inspect the renderer:
   - `src/dashboard/views/article.ts`
   - look at `renderStageRunsPanel()` and any local `formatDuration()` helper
3. Verify the data shape:
   - `src/types.ts` for `StageRun` and `StageTransition`
   - `src/db/repository.ts` for ordering, limits, and whether the reads already include timestamps
4. Check retry/regression semantics before calling it UI-only:
   - `src/pipeline/actions.ts` for where `startStageRun()` / `finishStageRun()` happen
   - confirm whether revision loops create additional `stage_runs` rows or only transition/audit entries
5. Run focused dashboard tests:
   - `tests/dashboard/wave2.test.ts`
   - `tests/dashboard/server.test.ts`

## Heuristic

Ask these questions in order:

1. **Already hydrated?** If the article page already receives `stageRuns`, the missing metric is probably not a routing gap.
2. **Already computable?** If the renderer already computes per-run `completed_at - started_at`, a total article clock is usually just an aggregation gap.
3. **Needs attribution?** If product wants time “per state,” “per revision,” or “per retry,” check whether `stage_runs` alone can express that cleanly.

## Practical read for this repo

- **Article total time:** usually a presentation-layer feature. `StageRun` already has `started_at` and `completed_at`, and `renderStageRunsPanel()` already formats durations.
- **Per-stage totals across reruns:** may still be view-led if summing repeated stage-run rows is acceptable.
- **Per-state or retry-aware timing:** likely mixed. `StageTransition` gives stage-change timestamps and notes, but not a fully modeled state-duration ledger.

## Current seam map

- `src/dashboard/server.ts` loads `repo.getStageRuns(id)` into `renderArticleDetail(...)` and `renderLiveSidebar(...)`.
- `src/dashboard/views/article.ts` renders stage runs in `renderStageRunsPanel(...)` and already shows per-run elapsed time.
- `src/db/repository.ts` returns stage runs ordered by `started_at DESC`.
- `src/pipeline/actions.ts` wraps stage actions with `startStageRun()` / `finishStageRun()`, while revision loops also create `stage_transitions` through regression/advance flow.

## Recommendation

For the first pass, treat “total time spent on an article” as a UX aggregation over existing `stage_runs`. Do not block it on unrelated article-detail observability issues unless the request explicitly needs revision-aware or state-aware timing semantics.

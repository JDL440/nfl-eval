## Problem

Turn research items 2, 3, and 4 into an implementation plan for `nfl-eval`:

1. Add a repo-local attribution ledger to `pipeline.db`
2. Instrument the existing article pipeline control points
3. Make `.squad/config/models.json` executable instead of documentation-only

The plan must also add a supported-model catalog grouped into `low`, `medium`, and `high` tiers with an explicit order of precedence so the repo has one policy for model building/selection.

## Current status

Implemented and validated.

- Added usage-ledger schema in `content/schema.sql`
- Extended `content/pipeline_state.py` with article/stage run helpers and `record-usage-event` CLI
- Added executable model policy in `content/model_policy.py`
- Expanded `.squad/config/models.json` with supported tiers, precedence, task families, and override policy
- Instrumented `.github/extensions/gemini-imagegen/extension.mjs`
- Instrumented `.github/extensions/substack-publisher/extension.mjs`
- Instrumented `.github/extensions/table-image-renderer/extension.mjs`
- Added shared telemetry shim at `.github/extensions/pipeline-telemetry.mjs`
- Synced `.squad/skills/article-lifecycle/SKILL.md` and `.squad/skills/article-discussion/SKILL.md`

## Validation completed

- `python -m py_compile .\\content\\pipeline_state.py .\\content\\model_policy.py`
- `node --check` on the modified extension files
- `python .\\content\\model_policy.py select --stage-key writer`
- `python .\\content\\model_policy.py start-stage-run ...`
- `python .\\content\\pipeline_state.py check`

## Follow-up notes

- `content/pipeline.db` was migrated in place during validation so the runtime schema now includes the new telemetry tables.
- Monthly quota truth still comes from provider-side GitHub/Gemini analytics; the repo now provides article/stage/surface attribution locally.

## Proposed approach

1. Extend the pipeline schema and `PipelineState` so the repo can persist article-scoped usage events and stage runs.
2. Instrument the easiest definitive surfaces first: image generation, Substack publishing, table rendering, and stage transitions.
3. Expand `models.json` into a real model-policy file with:
   - supported model tiers
   - precedence lists
   - task-to-tier mapping
   - output-budget policy
4. Add a shared model-selection helper/wrapper for article-stage spawns so Lead / Ralph / future automation all resolve models through one runtime path.
5. Defer provider reconciliation and direct-API migration; keep this implementation focused on repo-local attribution plus executable model policy.

## Proposed implementation scope

### A. Usage ledger and schema cleanup

- Update `content/schema.sql` to fix drift around `substack_draft_url`
- Add article-scoped telemetry tables, likely:
  - `article_runs`
  - `stage_runs`
  - `usage_events`
- Extend `content/pipeline_state.py` with helper methods such as:
  - `start_article_run()`
  - `start_stage_run()`
  - `record_usage_event()`
  - `finish_stage_run()`

### B. Instrumentation points

- `content/pipeline_state.py`
  - emit stage-level usage markers alongside stage transitions
- `.github/extensions/gemini-imagegen/extension.mjs`
  - persist article slug, model used, prompt hash, image count, output paths
- `.github/extensions/substack-publisher/extension.mjs`
  - persist draft create/update events, target, draft URL, tag count
  - continue routing DB writeback through `PipelineState`
- `.github/extensions/table-image-renderer/extension.mjs`
  - persist render events and output file paths
- Lead orchestration surfaces
  - persist planned/completed events for panel composition, panel execution, Writer, and Editor runs

### C. Executable model policy

- Expand `.squad/config/models.json` so it becomes the single source of truth for:
  - stage defaults (`writer`, `editor`, `lead`, `panel_*`, `lightweight`)
  - model tier catalog (`low`, `medium`, `high`)
  - precedence order within each tier
  - allowed overrides
  - task-family mapping (`lightweight`, `balanced`, `deep_reasoning`, `agentic_code`)
- Add a shared selector helper (likely Python first, with JS parity if needed) that:
  - reads `models.json`
  - resolves requested model by stage/task family
  - returns selected model, tier, precedence rank, and token budget
  - records the requested model in `usage_events`

## Proposed supported model catalog

This is the policy to encode into `models.json` for text-model selection in this repo.

### Low tier

Use for classification, extraction, metadata, small summaries, slot-filling, and other low-reasoning tasks.

1. `gpt-5-mini`
2. `gpt-5.4-mini`
3. `claude-haiku-4.5`
4. `gpt-4.1`

### Medium tier

Use for balanced coding, orchestration, scoped analysis, and tasks that need stronger reasoning but should avoid the highest-cost models by default.

1. `claude-sonnet-4.6`
2. `claude-sonnet-4.5`
3. `gpt-5.2`
4. `gpt-5.1`
5. `claude-sonnet-4`

### High tier

Use for final article-quality reasoning, difficult synthesis, and cases where quality is more important than cost.

1. `claude-opus-4.6`
2. `gpt-5.4`
3. `claude-opus-4.6-fast`
4. `gpt-5.3-codex`
5. `gemini-3-pro-preview`
6. `claude-opus-4.5`

### Specialized code-model precedence

Use only when a task is explicitly code-agentic and benefits from Codex-style behavior more than prose reasoning.

1. `gpt-5.3-codex`
2. `gpt-5.2-codex`
3. `gpt-5.1-codex-max`
4. `gpt-5.1-codex`
5. `gpt-5.1-codex-mini`

## Task-family selection policy

- `lightweight`
  - default tier: `low`
  - use for Stage 1 viability triage, Stage 3 panel composition recommendation, Stage 7 metadata extraction, Stage 8 history drafting
- `balanced`
  - default tier: `medium`
  - use for orchestration, structured synthesis, and non-final article support work
- `deep_reasoning`
  - default tier: `high`
  - use for Lead synthesis, Writer, Editor, and high-stakes panel work
- `agentic_code`
  - default precedence: specialized code-model list, then medium tier fallback

## Todos

- Add telemetry tables and schema drift fixes in `content/schema.sql`
- Extend `content/pipeline_state.py` with usage-ledger helpers
- Instrument extension surfaces (`gemini-imagegen`, `substack-publisher`, `table-image-renderer`)
- Add article-stage spawn logging for panel, Writer, and Editor runs
- Expand `.squad/config/models.json` with tiered supported-model catalog and precedence order
- Add shared model-selection helper and runtime wrapper
- Update docs/skills so procedural text matches executable model policy

## Notes

- This plan intentionally focuses on repo-local attribution plus executable model policy, not nightly provider reconciliation.
- GitHub enterprise metrics and premium-request analytics remain the external source of truth for monthly quota and CLI-wide usage.
- Gemini / Imagen spend should remain a separate provider bucket even when logged in the same local ledger.
- Human-led interactive sessions may still rely on policy discipline until a centralized spawn wrapper is in place.

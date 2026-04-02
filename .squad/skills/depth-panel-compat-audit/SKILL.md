# Skill: Depth/Panel Compatibility Audit

## When to use

Use this when a split data model has already landed underneath a dashboard or admin UI, but product surfaces still expose legacy fields or mixed terminology.

## Audit checklist

1. Compare **storage/runtime truth** vs **visible UI controls**.
2. Check every create/edit route for whether it accepts:
   - legacy fields only,
   - split fields only,
   - or both.
3. Verify repository update logic recomputes derived fields in the same direction the UI writes them.
4. Trace scheduled/background flows separately from manual UI flows; they often lag behind interactive surfaces.
5. Compare option sets and labels across:
   - intake/new-item forms,
   - list/filter surfaces,
   - detail/edit surfaces,
   - settings/schedule surfaces,
   - tests.
6. Run the relevant test slice and classify failures as:
   - terminology drift,
   - option-set drift,
   - compatibility write bug,
   - missing coverage.

## Pattern

In additive migrations, the most dangerous bug is not missing UI polish; it is **legacy writes being overridden by already-populated split fields** during update normalization. When a repo layer resolves new controls from a mix of old and new fields, stale split values can silently defeat a user's legacy dashboard edit unless the update path explicitly treats the submitted legacy fields as authoritative.

## Repository example

- `src\types.ts` and `src\db\schema.sql` already store `preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`, and `panel_constraints_json`.
- `src\dashboard\views\new-idea.ts`, `home.ts`, `article.ts`, `config.ts`, and `schedules.ts` still expose mostly legacy depth/profile controls.
- `src\db\repository.ts` update paths show how mixed legacy/split normalization can create silent write incompatibilities.
- `src\pipeline\article-scheduler-service.ts` is the runtime seam to check after auditing schedule forms/routes.

## Output shape

Return findings in four buckets:

1. affected surfaces,
2. observed inconsistencies,
3. exact non-code recommendations,
4. test gaps and current failing seams.

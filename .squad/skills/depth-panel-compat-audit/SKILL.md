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

### Asymmetric Migration Anti-Pattern

When migrating surfaces to a new data model (e.g., depth_level → preset_id + reader_profile + article_form + panel_shape), **do not migrate surfaces piecemeal**. Create/filter/edit/schedule flows form a coupled set; if new-idea.ts becomes preset-aware but article.ts stays legacy, editors can:

1. Create an article with preset choices (new-idea preset fields write correctly)
2. Edit metadata on that article with legacy fields (article.ts depth_level ignored by updateArticle due to preset preservation)
3. Filter the home queue by legacy depth (home.ts numeric depth works but is decoupled from preset)

This creates three incompatible mental models over one persistence layer. **Solution:** Either migrate all surfaces together or explicitly mark some as legacy/compatibility-only with clear deprecation timelines and warnings.

### Schedule Surface Convergence Failure

When the same model is edited through multiple routes (e.g., `/config?tab=schedules` + `/schedules/:id`), verify they:
- Use identical field names (both camelCase or both snake_case)
- Share the same defaults
- Execute the same validation logic
- Persist using the same code path

If any of these differ, operators see different results from equivalent UI choices. **Example:** Settings schedules route normalizes through `parseEditorialRequest()` while legacy `/schedules` route persists raw fields directly → equivalent depth/profile edits save different internal representations.

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

## Reusable Audit Workflow

When a UI redesign involves adding new fields alongside existing legacy fields:

1. **Inventory all mutation surfaces** — create, read, update, delete, list/filter, settings, schedules
2. **Map each surface to persistence paths** — which route handlers, which repo methods, which DB columns
3. **Classify each surface** — preset-aware, legacy-only, or hybrid (both)
4. **Run full test suite** — depth-related tests will expose field-naming drift, option-set drift, and compatibility bugs
5. **Trace roundtrips** — create in surface A, edit in surface B, filter in surface C; verify the values stay consistent
6. **Identify deprecation seams** — which surfaces can be migrated first (usually new/create flows) and which must stay until consumers are ready (usually legacy routes/APIs)
7. **Document the strategy** — mark surfaces as migration-ready, active-migration, or compatibility-only with clear retirement timelines

When surfaces cannot migrate together, **create an explicit compatibility layer** that either:
- Warns operators that their edits may be ignored (deprecation path)
- Syncs between old and new field representations (bridge pattern)
- Locks legacy fields read-only to prevent silent no-ops (safety pattern)


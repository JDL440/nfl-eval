---
name: Legacy Editorial Control Sync
domain: runtime-migration
confidence: high
tools: [view, rg, vitest]
---

# Legacy Editorial Control Sync

## When to use

- A repo is migrating from one overloaded legacy field to several preset-era fields.
- Old routes or forms can still PATCH only the legacy field (`depth_level`, `content_profile`, etc.).
- You need compatibility without letting derived columns drift stale.

## Pattern

1. **Resolve from explicit legacy input, not stale stored overrides.**
   - If a patch changes `depth_level`, do not feed the old `preset_id` / `article_form` back into resolution unless the caller explicitly changed them too.
   - If a patch changes `content_profile`, do not keep old `reader_profile` / `analytics_mode` blindly if they were only derived before.

2. **Preserve truly advanced overrides.**
   - Keep stored `panel_shape` / `panel_constraints_json` unless the patch explicitly changes them.
   - Legacy compatibility should recompute derived editorial defaults, not erase intentional advanced controls.

3. **Backfill additive columns from legacy semantics, not ALTER TABLE defaults.**
   - If old rows gain new editorial columns with default values (`beat_analysis`, `engaged`, `standard`, `auto`, `normal`), treat that bundle as "untouched migration state" when it contradicts legacy `depth_level` / `content_profile`.
   - Recompute from `resolveEditorialControls(...)` so rows like `depth_level=2` + `content_profile='deep_dive'` promote to `technical_deep_dive` instead of staying stuck on default beat-analysis values.

4. **If legacy state is a tuple, preserve that tuple on legacy writes.**
    - When compatibility input is a pair like `content_profile + depth_level`, do not write the legacy columns back from preset defaults unless the caller explicitly edited preset-era fields.
    - A single preset cannot safely round-trip every legacy tuple; writing back `legacy_depth_level` / `legacy_content_profile` from preset-derived controls can silently mutate valid inputs like `(accessible, 3)` or `(deep_dive, 2)`.
    - If a route first resolves canonical preset-era fields and then the repository resolves again before insert/update, persist the caller's explicit legacy tuple separately on write or the second pass will collapse it back to preset defaults.
    - `panel_shape` alone should not be treated as canonical editorial intent for deciding whether to preserve legacy compatibility values; it is an advanced override that can coexist with preserved `depth_level` / `content_profile`.

5. **Test create and partial-update paths separately.**
   - Create is not automatically safe; it can silently collapse legacy tuples while still producing "reasonable" canonical preset fields.
   - Partial updates are where stale preset-era columns usually survive unnoticed.

6. **Skip editorial normalization on unrelated PATCHes.**
   - If a schedule PATCH only changes name, time, provider, or enabled state, preserve the stored canonical editorial fields as-is.
   - Re-running resolution from fallback `depth_level` / `content_profile` during a non-editorial PATCH can silently erase `panel_shape`, `analytics_mode`, or `panel_constraints_json` overrides.

7. **Do not reschedule on editorial-only edits.**
   - Settings/config schedule saves often post weekday/time fields every time, even when the operator only changed name, prompt, provider, or editorial controls.
   - Recompute `next_run_at` only when `weekday` or `time_of_day` actually changed versus the stored row; otherwise preserve the existing claim window.

## Repo Example

- `src\db\repository.ts`
  - `resolveArticleEditorialUpdate(...)`
  - `resolveScheduleEditorialUpdate(...)`

These helpers recompute preset-era fields from legacy `depth_level` / `content_profile` changes while preserving explicit advanced overrides like `panel_shape` and `panel_constraints_json`.

## Validation targets

- `tests\db\schedule.test.ts`
- `tests\dashboard\schedules.test.ts`
- `tests\dashboard\metadata-edit.test.ts`
- `tests\dashboard\settings-routes.test.ts`

Add at least one assertion that a legacy-only update also changes the derived preset-era fields (`article_form`, `preset_id`, etc.), not just the legacy integer/string.
Add a second assertion that a non-editorial schedule PATCH (for example `name` only) preserves existing canonical overrides such as `panel_shape` and `panel_constraints_json`.
Add a third assertion that a config schedule edit with unchanged weekday/time keeps the prior `next_run_at`.
Add a fourth assertion that legacy schedule create/update paths preserve submitted tuple combinations like `(accessible,2)`, `(accessible,3)`, and `(deep_dive,2)` instead of rewriting them from preset-derived defaults.

# Multi-Surface Consistency Audit Pattern

**Skill Type:** UX / Architecture Review  
**Applicable to:** Dashboard UI redesigns, cross-surface form changes, refactoring shared controls  
**Value:** Prevents breaking changes, identifies hidden coupling, enables staged migrations

## What This Pattern Addresses

When a single concept (e.g., "depth level", "status", "priority") appears across multiple UI surfaces and routes, small inconsistencies can create:
- **Ghost options:** Users can set a value in one surface but not create it in another
- **Hidden inventory:** Filter dropdowns don't show all possible values
- **Form field naming chaos:** Same concept uses different field names (`depthLevel` vs `depth_level`)
- **Validation asymmetry:** API accepts 1–4, form UI only offers 1–3
- **Test brittleness:** Fixture updates required across multiple test files

## The Audit Process

### 1. Map All Surfaces

For each concept that appears in multiple places, document:

| Surface | File | Form Field | Options | Route | HTTP Method | Validation |
|---------|------|-----------|---------|-------|-------------|-----------|
| New idea form | new-idea.ts | depthLevel | 1–3 | /api/ideas | POST | accepts 1–4, default 2 |
| Home filter | home.ts | depth | 1–3 | /htmx/filtered-articles | GET (query param) | optional, parsed int |
| Article metadata | article.ts | depth_level | 1–4 | /htmx/articles/{id}/edit-meta | POST | 1–4, warn if stage > 1 |
| Schedule config | schedules.ts | depth_level | 1–4 | /api/settings/article-schedules | POST | 1–4 validated |

When the repo has both a “new” admin surface and an older full-page/API surface for the same records, map them as separate rows even if they hit the same table. In this repo, the settings schedules flow (`config.ts` + `/api/settings/article-schedules*`) and the legacy schedules flow (`schedules.ts` + `/schedules*` + `/api/schedules*`) are a paired contract and should be audited together.

### 2. Identify Inconsistencies

Check for:
- **Form field naming:** Camel vs snake case? (depthLevel vs depth_level)
- **Options offered:** Do all surfaces show same choices? (1–3 vs 1–4)
- **Default values:** Are defaults consistent?
- **Validation logic:** Is validation same everywhere?
- **Label text:** Do labels explain the concept uniformly?
- **Legacy/live duplication:** Is there a still-live legacy route or admin page editing the same model with different copy, defaults, or validation?

### 3. Trace Backend Integration

For each route:
- What handler processes the form? (server.ts line numbers)
- What validation function is called? (normalizeScheduleDepth, etc.)
- What database operation happens? (repo.listArticles, repo.updateArticle, etc.)
- Does validation match UI options offered? (API allows 1–4 but form only offers 1–3?)

### 4. Document Coupling Points

Identify where the concept flows:
- **Database:** Column name, constraint, allowed values
- **Type system:** TypeScript interfaces, enums, types
- **Pipeline:** Does the concept affect downstream orchestration? (DEPTH_LEVEL_MAP collapse)
- **Tests:** How many test files reference this concept? (grep needed)
- **Parallel route families:** Does one route family normalize into the new model while another still persists legacy fields directly?

### 5. Check for Dual-Control Patterns

Look for cases where multiple related controls exist:
- Example: `depth_level` (1–4) **AND** `content_profile` ('accessible' | 'deep_dive')
- This suggests the underlying concept wants to split into multiple axes (reader sophistication + orchestration shape)
- Dual-control pattern is a signal for future design

### 6. Create Impact Inventory

Produce a table showing:
- Number of surfaces affected
- Number of test files with assertions
- Route handlers that need updates
- Type definitions that need changes
- Known breaking changes required

## Output Format

Create a human-readable report with:

1. **Executive Summary** — what's inconsistent and why it matters
2. **Surface Inventory** — one section per UI surface with all details
3. **Data Contract Seams** — route handlers and validation
4. **Risk Areas** — coupling, asymmetries, hidden impacts
5. **File Impact Checklist** — views, routes, types, tests, styles
6. **Recommended Implementation Sequence** — phases and unblocking order

## Implementation Sequence Template

### Phase 0 (Unification, Low Risk)
- Add missing options to restricted surfaces (e.g., depth 4 to new-idea form)
- Standardize form field names across all surfaces
- Update tests to reflect new naming
- Verify no business logic breaks

### Phase 1 (Schema, Medium Risk)
- Add new concept columns to database (e.g., panel_shape)
- Create migration to backfill existing data
- Update type definitions to support both old and new
- Render both legacy and new UI (backward compat)

### Phase 2 (Surface Migration, High Risk)
- Update surfaces one at a time to use new concept
- Keep old concept alive as fallback
- Test at each surface transition

### Phase 3 (Deprecation, Cleanup)
- Remove legacy concept from UI
- Archive (don't delete) old columns
- Update tests to use new concept exclusively

## Key Questions to Ask

1. **Exposure asymmetry:** Can users set a value in one place but not create it in another? (e.g., depth 4 in metadata but not new-idea form)
2. **Hidden inventory:** Can users filter to see all values that exist in the database? (e.g., home filter shows 1–3 but depth 4 articles exist)
3. **Naming consistency:** Is the form field named the same everywhere? (camelCase vs snake_case?)
4. **Validation consistency:** Does the API accept the same range as the UI offers? (API 1–4 but form 1–3?)
5. **Label consistency:** Is the concept explained uniformly across all surfaces?
6. **Dual-control precedent:** Are there related controls that suggest this concept should split? (e.g., depth + content_profile)

## Red Flags

- 🚩 Form field named differently across surfaces
- 🚩 API accepts range wider than UI offers
- 🚩 Filter dropdown doesn't show all possible values in the database
- 🚩 Replacement surface and legacy surface both remain live but drift in labels/defaults
- 🚩 Runtime collapse (e.g., values 3 and 4 map to same orchestration tier)
- 🚩 More than two form field names for the same concept
- 🚩 Test files hardcoding payloads with inconsistent field names
- 🚩 Warning text about changing value after a certain stage (suggests ordering dependency)

## New Failure Mode: Derived-Control Priority Inversion

When a redesign introduces derived fields like `preset_id`, `reader_profile`, `article_form`, or `panel_shape`, legacy forms can fail in **two opposite ways**:

1. **Preserved preset overrides explicit legacy edits**
   - Example: a form submits `depth_level=4`, but update logic keeps the old `preset_id`.
   - If the resolver prioritizes `preset_id`, the user-visible depth change silently no-ops.
2. **Simple form overwrites hidden advanced state**
   - Example: a settings form only renders `depthLevel` + `contentProfile`, then the server recomputes and rewrites `preset_id`, `panel_shape`, `analytics_mode`, and `panel_constraints_json`.
   - Operators think they edited a simple field, but actually erased richer configuration they could not see.

### Audit check

For every derived-control migration, inspect both:

- **update paths that preserve existing derived fields** (`repo.update*`, compatibility bridges)
- **update paths that recompute derived fields from partial forms** (`server.ts` request parsers)

If both patterns exist in the same product area, the UI surfaces are almost certainly diverging.

## New Failure Mode: Rendered Form / Handler Mismatch

A redesign can appear complete in the UI while the route still persists the old contract.

Example in this repo:

- `src\dashboard\views\article.ts` renders `presetId`, `readerProfile`, `articleForm`, `panelShape`, `analyticsMode`, and `panelConstraintsJson`
- but `POST /htmx/articles/:id/edit-meta` in `src\dashboard\server.ts` still only saves legacy metadata fields

### Audit check

For every redesigned form:

1. inspect the rendered field names
2. inspect the exact handler receiving them
3. inspect the repository write path
4. verify tests assert both render parity and persistence parity

If the form and handler speak different vocabularies, treat that as a higher-priority regression than copy drift.

## New Failure Mode: Alias-Labeled Filters

Sometimes the UI adopts new editorial labels while the backend still filters on an older field.

Example in this repo:

- `src\dashboard\views\home.ts` labels the filter with preset names
- `/htmx/filtered-articles` still accepts `depth` and filters by `depth_level`

### Audit check

Verify whether:

- the visible control is filtering the real new concept
- multiple new-state combinations collapse into one legacy value
- the label overpromises precision the backend cannot honor

If yes, recommend either renaming the control honestly or upgrading the backend filter before more UI rollout.

## New Failure Mode: Dual Live Contracts

If both a replacement settings surface and a legacy full-page surface remain live, treat them as separate contracts until proven otherwise.

Checklist:

- Do they use different field names? (`teamAbbr` vs `team_abbr`)
- Different interaction models? (HTMX + `HX-Redirect` vs full-page redirect)
- Different defaults? (for example `accessible + depth 3` vs `accessible + depth 2`)
- Different validation/error affordances? (inline result vs redirect/500 risk)
- Different persistence semantics? (preserve existing preset vs recompute from legacy fields)

If yes, audit them independently and recommend convergence or retirement rather than assuming they are interchangeable skins.

## Reusability

This pattern applies to any concept that appears in multiple UI surfaces:
- Status fields (published, draft, reviewing)
- Priority or urgency levels
- Scope or audience designation
- Complexity or effort estimates
- Content type or article form
- Any enumerated choice with >1 surface

---

**Example Application:** Depth/Panel Redesign Impact Analysis (`.squad/decisions/inbox/ux-depth-panel-impact.md`)

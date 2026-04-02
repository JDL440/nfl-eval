---
name: Editorial Contract Split Rollout
domain: dashboard-runtime
confidence: high
tools: [view, rg, vitest]
---

# Editorial Contract Split Rollout

## When to use

- A repo already added split editorial fields in types/schema/repository, but UI/runtime still speak legacy depth language.
- Operators can still edit both the new and old models, creating double-authority risk.
- You need an architecture or rollout plan before implementation.

## Pattern

Treat the migration as a **canonical-contract rollout**, not a fresh schema design.

1. **Find the canonical contract**
   - Usually `src\types.ts` plus persistence in `src\db\schema.sql` and `src\db\repository.ts`.
2. **Classify every field**
   - **Source of truth:** canonical split fields.
   - **Derived compatibility:** legacy aliases kept for old readers/routes/tests.
   - **Deprecated:** any surface still letting operators author through the legacy model.
3. **Trace every seam**
   - dashboard views
   - HTTP normalization in `src\dashboard\server.ts`
   - scheduled/manual creation services
   - runtime prompt/model-policy consumers
   - tests that freeze old vocabulary or payload shapes
4. **Remove double authority last**
   - keep read compatibility first
   - move runtime behavior second
   - retire legacy write controls only after the stack agrees

## Canonical vs derived rules

- `preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`, `panel_constraints_json` should be canonical.
- `depth_level` should be derived from `article_form`.
- schedule `content_profile` should be derived from `reader_profile` + `analytics_mode`.
- If runtime still keys panel/model behavior off legacy depth, the migration is incomplete even if schema columns already exist.

## Checklist

1. Compare UI surfaces for vocabulary drift.
2. Compare route payloads for legacy-vs-canonical write paths.
3. Check scheduled creation separately from manual idea creation.
4. Check runtime panel/model policy separately from storage.
5. Run focused tests and note pre-existing failures that reveal drift.

## Output

A good review or plan should explicitly name:

1. which contract is canonical,
2. which fields are derived,
3. which surfaces are deprecated,
4. which rollout order prevents double authority,
5. which test failures already prove the drift.

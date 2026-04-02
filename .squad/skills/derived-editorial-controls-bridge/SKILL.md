---
name: Derived Editorial Controls Bridge
domain: workflow-architecture
confidence: high
tools: [view, rg]
---

# Derived Editorial Controls Bridge

## When to Use

- A single legacy enum/int is overloaded across UX labels, runtime policy, prompts, and storage.
- The repo is introducing a richer multi-axis model but still has old clients, old routes, or old tests.
- Schema/types may already contain the new fields, while dashboard/runtime code still speaks the old vocabulary.

## Pattern

Treat the redesign as a **canonical-controls + derived-compatibility** rollout.

1. Declare the new typed controls as canonical.
   - Example: preset, reader profile, article form, panel shape, analytics mode, optional constraints.
2. Keep legacy fields alive only as derived aliases.
   - They exist to protect old callers, not to stay conceptually primary.
3. Derive legacy values at the repository/API boundary.
   - Do not scatter depth/content backfill logic separately across UI, routes, and runtime prompts.
4. Move runtime policy to the correct axis.
   - prose/readability on reader controls
   - ambition/length on article form
   - roster topology on panel shape
5. Remove legacy vocabulary only after every dependent seam migrates together.

## Critical Compatibility Rule

If legacy state is a **tuple** (for example `content_profile + depth_level`), do not assume a preset ID alone can round-trip it.

When the legacy tuple has more states than the preset enum:

- preserve the tuple through explicit overrides or derivation logic
- add round-trip tests for each supported combination
- do not rename UI controls until those tests pass

Otherwise you silently collapse valid old behavior during create/update flows.

## Review Checklist

1. **Source-of-truth tiers**
   - Which fields are canonical?
   - Which are derived compatibility only?
   - Which user-facing labels are now deprecated?
2. **Persistence**
   - Are create/update paths resolving canonical controls once and writing derived legacy fields from that resolution?
3. **Runtime**
   - Does model/panel policy still key off the old depth enum?
   - Does panel composition use topology-specific inputs rather than article-depth shortcuts?
4. **UX**
   - Do all surfaces share one vocabulary?
   - Are advanced overrides hidden behind a simple preset-first flow?
5. **Tests**
   - legacy round-trip
   - canonical round-trip
   - UI consistency
   - runtime policy behavior

## Watch-outs

- Partial rollouts are the main failure mode: schema + types can be “done” while routes/views/prompts still drift.
- “Feature” often belongs to article form, not orchestration depth.
- A derived helper that works for articles may still be wrong for schedules if schedules carry extra editorial state.
- Once records persist `preset_id`, legacy-only PATCH or form-update flows can silently no-op if the route sends only `depth_level` / `content_profile` into a resolver that prioritizes the stored preset. Resolve canonical controls at the route boundary, then persist both canonical and legacy-compat fields together.
- Default legacy tuples are part of the compatibility contract. If a form defaults to a visible `content_profile + depth_level` pair that cannot round-trip through canonical derivation, the saved record will drift from what the operator thought they submitted.

## Key files to inspect

- `src\types.ts`
- `src\db\schema.sql`
- `src\db\repository.ts`
- `src\dashboard\server.ts`
- `src\pipeline\actions.ts`
- `src\llm\model-policy.ts`

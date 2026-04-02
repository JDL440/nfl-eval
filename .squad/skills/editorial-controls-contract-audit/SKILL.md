---
name: Editorial Controls Contract Audit
domain: dashboard-runtime
confidence: high
tools: [view, rg, vitest]
---

# Editorial Controls Contract Audit

## When to use

- A redesign is replacing legacy `depth_level` controls with presets or multi-axis editorial controls.
- Dashboard pages, schedule flows, and runtime orchestration all reference the same concept with different labels.
- You need to explain what must change without editing product code yet.

## Pattern

Audit the contract in four layers, not just one screen:

1. **Operator-facing surfaces**
   - `src\dashboard\views\new-idea.ts`
   - `src\dashboard\views\home.ts`
   - `src\dashboard\views\article.ts`
   - `src\dashboard\views\config.ts`
   - `src\dashboard\views\schedules.ts`
2. **HTTP validation / defaults**
   - `src\dashboard\server.ts`
3. **Persistence / compatibility**
   - `src\db\repository.ts`
   - `src\types.ts`
4. **Runtime consumers**
   - `src\pipeline\idea-generation.ts`
   - `src\pipeline\article-scheduler-service.ts`
   - `src\llm\model-policy.ts`

## Checklist

1. Compare every exposed option set.
   - Look for 3-value vs 4-value depth menus.
   - Check whether labels match (`Casual Fan` vs `Quick Take`, `Feature` vs `Deep Dive` mapping).
2. Trace defaults through the stack.
   - UI default
   - route fallback
   - repository default
   - runtime prompt/model-policy interpretation
3. Verify schedule semantics separately from idea-entry semantics.
   - schedules often already split editorial intent (`content_profile`) from depth/length.
   - confirm whether schedule runtime actually preserves that distinction.
4. Check legacy compatibility claims.
   - if preset-style fields already exist in types/repository, confirm whether the dashboard actually uses them.
   - flag any “new model exists in storage but old model still drives the UI” drift.
5. Review tests for contract coverage.
   - view tests may lock old labels/options in place.
   - route tests may miss invalid combinations or cross-surface consistency.

## High-value findings to call out

- **Terminology drift:** same concept named differently on different pages.
- **Option-set drift:** some surfaces allow values that others hide.
- **Behavior drift:** runtime collapses supposedly distinct UI choices into the same orchestration behavior.
- **Legacy drift:** compatibility fields exist, but operators still edit the old model directly.
- **Schedule drift:** schedule forms and scheduled article creation use different semantics from manual idea creation.
- **Persistence drift:** legacy-only edits may leave preset-era editorial columns stale even when the UI appears to have “saved” successfully.

## Output

A good audit should return:

1. affected surfaces,
2. exact inconsistencies,
3. recommended non-code changes grouped by surface/runtime/test,
4. test gaps and any pre-existing failures that limit confidence.

## Watch-outs

- In this repo, `src\types.ts` and `src\db\repository.ts` may already be migrated further than the dashboard views.
- Verify whether `updateArticle()` and `updateArticleSchedule()` recompute preset/editorial fields when only `depth_level` or `content_profile` changes. If not, report that as contract drift, not just copy drift.

## Additional audit notes

- Check for **split advanced controls**: if one surface exposes preset-era fields but sibling surfaces only expose legacy depth/profile controls, call that out as contract drift.
- Check for **mixed legacy defaults** on create forms. A default `content_profile` + `depth_level` combination can normalize into a different saved value once preset resolution runs.
- When repositories already store preset-era columns, test both **create** and **partial update** paths. Create may derive correctly from legacy fields while updates silently preserve stale `article_form` / preset values.
- If intake or scheduling supports **trade / cohort / multi-team** stories, trace team scope end to end. In this repo the high-risk seam is `src\pipeline\idea-generation.ts` → `src\db\repository.ts#createArticle()`; UI can accept multiple teams while persistence still collapses to `teams[0]`.
- When schedules have both `/config` and `/schedules` surfaces, compare them as separate products: field naming, create defaults, route families, and test coverage. Approval should wait until one surface is canonical or both are demonstrably parity-locked.


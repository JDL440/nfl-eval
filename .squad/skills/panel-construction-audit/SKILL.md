---
name: Panel Construction Audit
domain: pipeline
confidence: high
tools: [view, rg]
---

# Panel Construction Audit

## When to Use

- An article-generation flow selects panelists through prompts and markdown artifacts.
- You need to find where panel size/composition rules actually live.
- You suspect depth labels, article types, or pinned-agent UI affordances drift from runtime behavior.

## Workflow

1. Start at `src/pipeline/actions.ts`:
   - inspect `composePanel()`
   - inspect `runDiscussion()`
   - inspect `parsePanelComposition()`
2. Trace upstream prompt/spec inputs:
   - `src/pipeline/context-config.ts`
   - `src/config/defaults/skills/panel-composition.md`
   - `src/config/defaults/skills/article-discussion.md`
   - `src/config/defaults/skills/discussion-prompt.md`
3. Trace operator-side inputs:
   - `src/dashboard/server.ts`
   - `src/dashboard/views/new-idea.ts`
   - `src/dashboard/views/article.ts`
4. Check schema/runtime storage:
   - `src/db/schema.sql`
   - `src/db/repository.ts`
5. Compare tests against runtime seams:
   - `tests/pipeline/actions.test.ts`
   - `tests/db/repository.test.ts`
   - dashboard tests that encode depth labels or suggested panel copy

## What to Look For

1. **Policy-by-prompt vs typed config**
   - Are rules only written in markdown skills/task prose?
   - Is there any structural article-type or panel-profile schema?
2. **Depth drift**
   - Do UI labels, stored depth enums, and runtime branching agree?
   - Watch especially for depth levels accepted in UI but collapsed in runtime logic.
   - Check whether richer editorial controls already exist in `src/types.ts` / `src/db/repository.ts` (`preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`, `panel_constraints_json`) but are still hidden behind legacy `depth_level` controls in the dashboard.
3. **Validation gaps**
   - Does the system verify panel size, role mix, pinned-agent inclusion, and roster validity structurally?
   - Or does it only check for non-empty markdown?
4. **Duplication**
   - Are size limits and recommended panels repeated across UI, prompts, and tests?
5. **Roster assumptions**
   - Are specialists/team agents filtered by hard-coded lists instead of capability metadata?

## Output Pattern

Summaries should cite:

- the stage-action seam
- the skill/prompt source of truth (or lack of one)
- schema/storage limits
- UI/runtime mismatches
- exact hard-coded list-size or roster assumptions

## Watch-outs

- `article_panels` may sound like full panel state but can still be only pinned-agent storage.
- `discussion_prompts` can exist in schema without driving runtime composition.
- A parseable `panel-composition.md` is not the same as a validated composition contract.
- If the redesign is preset-first, verify `resolveEditorialControls()` remains the single compatibility seam that derives legacy `depth_level` / `content_profile` for old routes, schedules, and MCP tools.

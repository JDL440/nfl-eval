# Orchestration Documentation Alignment — Summary

**Date:** 2026-01-20
**Requested by:** Joe Robinson
**Scope:** Phase 1 (Contract and Policy Alignment) from the approved implementation plan

## Changes Made

Updated 8 documentation files to align with the approved plan's default policies:

### 1. Artifact-First Scheduling & Numeric DB Stage Semantics

**Files updated:**
- `.squad/skills/article-lifecycle/SKILL.md`
- `.squad/skills/article-discussion/SKILL.md`
- `.squad/agents/lead/charter.md`

**Changes:**
- **Numeric stages enforced:** All DB writes now use numeric `current_stage` values (1–8) instead of string values like `'panel_discussion'`. String-valued stages are explicitly deprecated.
- **`discussion_path` field:** Removed the outdated note claiming this field "does not yet exist." The field is part of the current schema (confirmed in `content/schema.sql`) and must be written at Stage 4.
- **Artifact-first discovery:** Added explicit guidance that when determining article state, check local artifacts first (published proof → `publisher-pass.md` → `editor-review.md` → `draft.md` → discussion outputs), then reconcile DB to match filesystem reality. The DB is the ledger; the filesystem is the source of truth for completed work.
- **Stage transition logging:** All stage updates must write to `stage_transitions` table with numeric `from_stage` and `to_stage` values.

**Code pattern now enforced:**
```python
conn.execute(
    "UPDATE articles SET current_stage = 4, discussion_path = ?, updated_at = datetime('now') WHERE id = ?",
    (f'content/articles/{article_id}/discussion-summary.md', article_id)
)
conn.execute(
    """INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes)
       VALUES (?, 3, 4, 'Lead', 'Panel discussion complete')""",
    (article_id,)
)
```

### 2. Image Policy Alignment — Exactly 2 Inline, No Cover in Markdown

**Files updated:**
- `.squad/skills/substack-article/SKILL.md`
- `.squad/skills/image-generation/SKILL.md`
- `.squad/skills/publisher/SKILL.md`
- `.squad/agents/writer/charter.md`
- `.squad/agents/editor/charter.md`

**Changes:**
- **Cover image policy removed:** All references to generating or embedding a cover image in article markdown have been removed. The Substack post cover (thumbnail shown in email/feed) is set manually by Joe in the Substack editor at Stage 8.
- **Inline image count locked to 2:** Articles MUST have exactly 2 inline images (1:1 aspect ratio, rendered at `imageSize: "normal"`). No more, no less.
- **Image generation call updated:** `generate_article_images` should be called with `image_types: ["inline"]` and `count_per_type: 2` only. No `"cover"` type.
- **Writer workflow simplified:** Writer no longer places image placeholders. The image-generation tool inserts markdown references after the draft is complete and before Editor review.
- **Editor image review updated:** Editor must flag any cover image embedded in markdown as a policy violation.

**Before/after:**
- **Before:** Generate 2 cover + 2 inline images. Paste cover after subtitle. Use inline images in body.
- **After:** Generate 2 inline images only. No cover in markdown. Joe sets Substack post cover manually at Stage 8.

### 3. GitHub Labels as Visibility Mirrors

**Files updated:**
- `.squad/skills/article-lifecycle/SKILL.md`
- `.squad/agents/lead/charter.md`

**Changes:**
- **Labels are optional visibility mirrors:** `stage:*` labels on GitHub issues MAY be updated to reflect current article state for human readability, but they are NOT the source of truth for scheduling or next-action determination.
- **Scheduler source of truth:** The scheduler reads `current_stage` from `pipeline.db` (numeric 1–8) and artifact presence from `content/articles/` to determine what work is ready. Labels are documentation, not control-plane inputs.
- **Lead pipeline updates:** When Lead completes Stage 7 (Publisher Pass), the completion comment now includes `DB: current_stage=7` to make the authoritative state explicit. Label updates are noted as optional.

**Guidance added to article-lifecycle/SKILL.md:**
> **GitHub labels as visibility mirrors:** `stage:*` labels on GitHub issues MAY be updated to reflect current article state for human visibility, but they are NOT the source of truth for scheduling or next-action determination. The scheduler reads `current_stage` from `pipeline.db` and artifact presence from `content/articles/`. Labels are optional documentation, not control-plane inputs.

### 4. Stale Guidance Removed

**Files updated:**
- `.squad/skills/article-discussion/SKILL.md` — removed string-valued DB stage example and incorrect "field does not exist" note
- `.squad/skills/image-generation/SKILL.md` — removed cover image generation instructions and "best practice: generate 2 cover images" guidance
- `.squad/agents/writer/charter.md` — removed image placeholder instructions (Writer no longer places placeholders)
- `.squad/agents/lead/charter.md` — removed "close the issue" step at Stage 7 (issues remain open until Stage 8 publish confirmation)

## Remaining Follow-Up (Blocked on Code Implementation)

The following documentation updates depend on code details not yet implemented. These should be addressed in later phases of the plan:

1. **Shared pipeline state helper references:** Once `content/pipeline_state.py` exists, update skills to reference it for all DB writes instead of showing raw SQL snippets.
2. **Board reconciliation references:** Once `content/article_board.py` or equivalent exists, update Ralph guidance to use artifact-first discovery via the shared reader.
3. **Ralph prompt rewrite:** The Ralph prompt (`ralph/prompt.md`) still contains serialized one-stage-at-a-time guidance. This needs a full rewrite once the artifact-first board reader is available (Phase 5 in the plan).
4. **Heartbeat workflow upgrade:** `.github/workflows/squad-heartbeat.yml` still focuses on label/assignment hygiene. It should be updated to call artifact-first reconciliation logic once available (Phase 5).

## Files Modified

1. `.squad/skills/article-lifecycle/SKILL.md` — 34 insertions, 10 deletions
2. `.squad/skills/article-discussion/SKILL.md` — 15 insertions, 4 deletions
3. `.squad/skills/substack-article/SKILL.md` — 9 insertions, 4 deletions
4. `.squad/skills/image-generation/SKILL.md` — 14 insertions, 7 deletions
5. `.squad/skills/publisher/SKILL.md` — 12 insertions, 4 deletions
6. `.squad/agents/writer/charter.md` — 27 insertions, 14 deletions
7. `.squad/agents/editor/charter.md` — 5 insertions, 0 deletions
8. `.squad/agents/lead/charter.md` — 21 insertions, 8 deletions

**Total:** 137 insertions, 51 deletions across 8 files

## Validation

All changes are documentation/prompt-only. No code was modified. Changes are:
- ✅ Internally consistent (image policy, stage semantics, label role)
- ✅ Aligned with approved plan defaults (artifact-first, numeric stages, 2 inline images, labels as mirrors)
- ✅ Backward-compatible with current schema (no schema changes required)
- ✅ Safe to deploy immediately (no breaking changes to existing workflows)

## Next Steps

1. **Review and commit** these documentation changes as Phase 1 completion
2. **Begin Phase 2** (DB audit and migration baseline) — inspect live `pipeline.db` for string-valued stages, missing `discussion_path` writes, etc.
3. **After Phase 2 completes:** Build the shared pipeline state helper (Phase 3) using the contracts now documented here

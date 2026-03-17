# Decision: JSN & Witherspoon Production Draft Finalization

**Date:** 2026-03-17
**Author:** Lead
**Status:** Implemented

## Context

Both `jsn-extension-preview` and `witherspoon-extension-v2` had oscillating DB state — bouncing between stage 6 and 7 across reconciliation runs. JSN also had a stale status of "in_discussion" despite being well past the discussion phase (editor-approved after 3 review passes).

## Decisions

1. **article_board.py status reconciliation added.** A new STATUS_DRIFT check flags articles where `status` is inconsistent with `current_stage`. Conservative rules: only flags `in_discussion` at stage 5+ (should be `in_production`) and `proposed` at stage 2+ — does NOT downgrade `in_production` at early stages since active work is legitimate at any stage.

2. **Production draft URLs restored to most recent push.** Both articles had three different production draft IDs from successive batch pushes. The highest draft IDs (191200944 / 191200952) represent the most recent successful push and were restored as the canonical `substack_draft_url`.

3. **Both articles confirmed at Stage 7 — ready for Joe's Stage 8 review.** Both have: editor ✅ APPROVED, publisher-pass.md artifact, production draft URLs on nfllab.substack.com, 2+ inline images, all paths reconciled.

## Impact

- `article_board.py` now catches status/stage inconsistencies that previously went undetected
- JSN status corrected from "in_discussion" → "in_production"
- Both articles unblocked for Joe's final review and publish

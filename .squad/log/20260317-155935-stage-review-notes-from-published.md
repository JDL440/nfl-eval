# Session Log — stage-review-notes-from-published
- **Timestamp:** 2026-03-17T15:59:35

## Overview
- Captured the Writer copy pattern for stage review notes that renders cards via published `/p/` links and the Lead decision to post five such notes on `nfllabstage`.
- Logged orchestration for Writer and Lead agents and merged the two inbox decisions into `.squad/decisions.md`.
- Documented cleanup instructions so Joe can remove the temporary stage review notes after his approval.

## Decisions Recorded
- **2026-07-28:** Stage-Review Notes — Copy Pattern (card-first caption + prod URL requirements).
- **2026-03-18:** Stage Review Notes with Prod Published URLs (five Notes linked to real `/p/` URLs with card-first bodies).

## Next Steps
- Confirm the missing `substack_url` values in `pipeline.db` before posting any additional stage review Notes.
- After Joe's review, run `node delete-notes-api.mjs` to remove the five temporary Notes (IDs 229372212, 229372239, 229372275, 229372305, 229372344).

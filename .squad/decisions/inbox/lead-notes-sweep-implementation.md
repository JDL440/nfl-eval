# Decision: Notes Sweep Report Implementation

**Date:** 2025-07-28
**Author:** Lead
**Status:** Shipped

## Context

The Notes cadence (Phase 5 of the Notes feature design) specifies a daily sweep that detects articles missing expected Notes. The rollout plan called for step 2: "Add sweep eligibility report to `article_board.py` (report only)."

## Decision

Implemented `notes-sweep` as a new CLI command in `article_board.py` rather than a standalone script. The sweep is report-only — it detects gaps but does not auto-post any Notes.

### Detection rules

| Gap Type | Trigger | Severity |
|----------|---------|----------|
| `MISSING_TEASER` | Stage 7+ article with no teaser or promotion Note | info |
| `MISSING_PROMOTION` | Stage 8 published article with no prod promotion Note | warning |
| `STALE_PROMOTION` | Published >48h with no prod promotion Note | urgent |

### Why `article_board.py` (not a new file)

- `article_board.py` is the existing operator reconciliation surface — all pipeline health checks live there.
- It already has note-count awareness and `PipelineState` integration.
- Operators already run `reconcile` and `board` — adding `notes-sweep` to the same CLI is zero onboarding cost.
- The reconcile output now cross-references notes gaps automatically.

### Why report-only

- Production Note posting requires Joe's approval (design doc constraint).
- Auto-posting would bypass the editorial gate.
- Report-only is the safe automation boundary for this phase.

## Alternatives considered

1. **Standalone `notes-sweep.py`** — rejected; would fragment the operator surface.
2. **Inline in reconcile output** — rejected; notes gaps are semantically different from DB drift and would clutter reconciliation.
3. **Full auto-post with dry-run flag** — rejected; premature for this phase.

## Follow-up

Next slice (step 3): Semi-auto stage teasers — auto-post teaser Notes to nfllabstage for Stage 7 articles. Still report-only on prod.

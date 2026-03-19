# Lead — Lead / GM Analyst History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Data Sources:** overthecap.com, spotrac.com, ESPN/NFL.com, PFR (blocked), PFF, The Athletic, mock draft sites
- **Rumor Mode:** Dual-track (⚠️ RUMOR inline + separate track)
- **2026 cap:** $301.2M
- **Pipeline:** 8-stage article lifecycle (Idea → Discussion → Panel → Draft → Editor → Publisher → Stage/Prod → Published)
- **Key tools:** `article_board.py` (artifact-first truth), `pipeline_state.py` (DB writes), `batch-publish-prod.mjs` (Substack publishing), `audit-tables.mjs` / `fix-dense-tables.mjs` (table pipeline)
- **Agents created:** Media, Analytics, CollegeScout, PlayerRep + 4 data skills (OTC, Spotrac, NFL roster, knowledge format)
- **Ralph loop:** Autonomous pipeline driver — sweeps all unblocked lanes, max parallel throughput, artifact-first discovery
- **Stage review Notes:** Stage review Notes are card-first bodies that link to production `/p/` URLs on `nfllabstage`; cleanup uses `delete-notes-api.mjs` after Joe's review (2026-03-18 decision).

## Summarized History (2026-03-18 and Earlier)

> Condensed by Scribe on 2026-03-19T02:31:01Z. Detailed session notes preserved in `history-archive.md`.

**Sessions consolidated:**
- 2026-03-18: Dashboard Implementation Session + Sprint (board/detail APIs, preview wiring, validation integration)
- 2026-03-18: Teaser Flow Disablement (Stage 7 teaser disabled per Joe; API endpoint fixed; cleanup verified)
- 2026-03-18: Token-Usage Telemetry Test (usage events recorded for DEN/MIA; Stage 4 synthesis created)
- 2026-03-17: Notes Card Render Fix & URL Backfill (ProseMirror link marks; stage→prod pattern established)
- 2026-03-17: Notes Workflow + Issue #75 & #78 (mobile table landing; Waddle trade article full pipeline)
- 2026-03-12 through 2026-03-17: Earlier archived work (See `history-archive.md` for details)

## Recent Sessions

### nflverse Detailed Implementation Plan (2026-03-19T02:31:01Z)
**Status:** ✅ APPROVED — Lead converted 5-tier research proposal into actionable Phase A scope with explicit Phase B+ defer triggers.

- Phase A scope locked: `requirements.txt` + cache script + 3 query scripts + skill doc + Analytics charter patch
- Timeline: 2-3 sessions max (must not delay article publication)
- No new agents; Analytics absorbs upgrade
- Deferred Tiers 2-5 with explicit entry triggers: frequency bottleneck, article throughput, custom Python, regular season
- 📌 Team update (2026-03-19T02:31:01Z): nflverse Phase A approved — build next 2-3 sessions, defer advanced tiers, decided by Lead
- Session log: `.squad/log/2026-03-19T02-31-01Z-nflverse-detailed-plan.md`

### nflverse Platform-Fit Review (2026-03-19T02:20:14Z)
**Status:** ✅ LOGGED — Lead assessed nflverse/nflreadpy integration report against platform state; recommended Tier 0–1 (data cache script + 3 query scripts), deferred Tiers 2–5 (DataScience agent, extension, gameday pipeline).

- Reviewed 5-tier proposal: determined Analytics gap is data access (PFR blocked), not scope.
- Recommended immediate: `pip install nflreadpy` + cache script + 3 query scripts (EPA, efficiency, positional comparison).
- Deferred DataScience agent (premature; no evidence Analytics will bottleneck; Phase 2+ investment).
- Flagged two-runtime overhead (Python + Node) — mitigate via `.squad/skills/nflverse-data/SKILL.md` + isolated `content/data/`.
- Identified Stage 2 integration point: data anchors for discussion prompts (automated aggregation replaces hand-assembly).
- Captured risk: offseason data is static; real value is historical comparisons for current articles (Witherspoon, JSN, draft).
- 📌 Team update (2026-03-19T02:20:14Z): nflverse Tier 0–1 integration strategy — do now + defer 2–5 until Phase 1 goals proven, decided by Lead.

### Teaser Flow Disablement & Notes Cleanup (2026-03-18T03:18:41Z – 2026-03-18)
**Status:** ✅ LOGGED — Disabled Stage 7 teaser Notes flow per Joe directive; fixed API endpoint in cleanup scripts; verified teaser deletion and audit trail closure.

- Merged directive (teaser disablement, notes flow active) + two follow-up decisions (endpoint fix + cleanup verification).
- Confirmed teaser note c-229449096 deleted (GET returns 404); updated `now.md` status.
- Fixed wrong DELETE endpoint in `cleanup-stage-notes.mjs` and `retry-stage-notes.mjs`: `/api/v1/notes/{id}` → `/api/v1/comment/{id}`.
- Updated feature design doc (Phase 5 cadence); disabled `post-stage-teaser.mjs`.
- Verified `notes-sweep` clean — zero gaps remaining; promotion Notes still active.
- Session log: `.squad/log/2026-03-18T02-24-01Z-lead.md`

### Token-Usage Telemetry Test — Issue #54 (2026-03-18T22:30Z)
**Status:** ✅ LOGGED — Telemetry instrumentation verified, the missing Stage 4 synthesis created, and Backend received the summary totals.

- Added `content/model_policy.py`, `usage_events`, and `stage_runs`, then recorded 10 usage events apiece for DEN (~80,850 tokens) and MIA (~78,400 tokens).
- Created `content/articles/den-2026-offseason/discussion-summary.md` and updated `pipeline.db` so `discussion_path` points to the new artifact.
- Logged the decision entry (`2026-03-18: Token-Usage Telemetry Test — Issue #54`) plus the session log (`.squad/log/2026-03-18T223000Z-den-telemetry-test.md`) and orchestration trace (`.squad/orchestration-log/2026-03-18T223000Z-lead.md`).

## Learnings

### nflverse Integration & Platform Prioritization
- **Approved Tier 0–1 roadmap:** Foundation (cache script, `requirements.txt`) + selective Tier 1 (3 query scripts). Build in 2–3 sessions starting immediately.
- **Integration point:** Stage 2 discussion prompt Data Anchors. Query scripts replace hand-assembled web-scraped tables. No schema changes needed.
- **Risks:** Python+Node dual-runtime, offseason data is static (limits near-term value), token budget implications for large datasets, ~300MB parquet cache.
- **Why Tier 2–5 deferred:** No evidence Analytics will bottleneck before Phase 1 publishing goals are met. Deferred work has explicit entry triggers (frequency, cadence, regular season).
- **DataScience agent decision:** Do NOT create. Extend Analytics instead — it owns the analytical domain; it lacks data access, not scope.

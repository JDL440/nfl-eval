# Decisions

This is the team's shared decision log. All agents read this to understand current direction, constraints, and non-negotiables.

---

### 2026-03-18T03:18:41Z: User directive — Teaser flow disablement

**By:** Joe Robinson (via Copilot)

**What:** Disable the teaser flow for now; keep the notes flow in place so that after a draft article is published we ask about publishing a note, or we can run the sweep later.

**Why:** User request — captured for team memory

**Status:** Approved

---

### 2026-03-18: Disable Stage 7 Teaser Notes Flow

**By:** Lead

**What:**
1. Disable `MISSING_TEASER` gap detection in `article_board.py notes-sweep`. Sweep now only tracks `MISSING_PROMOTION` and `STALE_PROMOTION`.
2. Deprecate `post-stage-teaser.mjs` — exits immediately with deprecation notice.
3. Preserve promotion-note flow (`publish-prod-notes.mjs`, extension tool, Stage 8 logic).
4. Delete live teaser note `c-229449096` (confirmed 404 via GET).
5. Update feature design doc (Phase 5 cadence + rollout order).

**Why:**
- Teaser Notes need design iteration; deprioritize until Phase 2.
- Promotion Notes (post-publish) are the higher-value flow; keep active.
- Teaser at `c-229449096` already externally deleted; close audit trail.

**Status:** Implemented

**Files changed:**
- `content/article_board.py` — removed MISSING_TEASER detection
- `post-stage-teaser.mjs` — deprecated
- `cleanup-stage-notes.mjs` — removed teaser protection
- `docs/substack-notes-feature-design.md` — updated cadence
- `.squad/identity/now.md` — updated focus

---

### 2026-03-18: Teaser Disablement Fixup — Note Deletion + Endpoint Correction

**By:** Lead

**What:**
1. Verified teaser note `c-229449096` deletion (GET returns 404; already deleted).
2. Fixed wrong API endpoint in `cleanup-stage-notes.mjs` and `retry-stage-notes.mjs`: `/api/v1/notes/{id}` → `/api/v1/comment/{id}`.
3. Updated `now.md` to reflect deletion (was "queued for cleanup", now "confirmed deleted").
4. Verified date annotations already correct at `2026-03-18`.
5. Confirmed notes-sweep clean — zero gaps remaining.

**Why:**
- Silent delete failures on future operations if endpoint not corrected.
- Audit trail closure: confirm what was actually deleted vs. what script thinks it deleted.
- Teaser disablement is complete only when cleanup endpoint verified.

**Status:** Implemented

**Files changed:**
- `cleanup-stage-notes.mjs` — fixed DELETE endpoint
- `retry-stage-notes.mjs` — same endpoint fix
- `.squad/identity/now.md` — c-229449096 status updated

---

### 2026-03-18: Stage Teaser Post + Superseded Notes Cleanup

**By:** Lead

**What:**
1. Posted `witherspoon-extension-v2` Stage 7 teaser to nfllabstage (ID `c-229449096`).
2. Cleaned up 12 superseded stage-review Notes (IDs 229399257–229402366; all already gone externally).
3. Marked 12 pipeline.db rows as `[DELETED]` for audit trail.
4. Protected teaser and 12 production promotion Notes.

**Why:**
- Closed last remaining `MISSING_TEASER` gap.
- Stage-review Notes are temporary artifacts; prod Notes are the permanent record.
- Audit trail: mark what was actually deleted to distinguish from prior cleanup.

**Status:** Executed

**Key data:**
- Teaser Note ID: 229449096
- Teaser permalink: https://substack.com/@joerobinson495999/note/c-229449096
- Cleanup count: 12 stage notes marked deleted
- Prod notes: 12 (untouched)

---

### 2026-03-19: nflverse Integration — Platform-Fit Recommendation

**By:** Lead

**What:**
1. **Do now (Tier 0):** `pip install nflreadpy` + `requirements.txt` + `content/data/fetch_nflverse.py` cache script + `.squad/skills/nflverse-data/SKILL.md` + update Analytics charter (PFR → nflverse).
2. **Do next session (Tier 1):** Cherry-pick 3 query scripts: `query_player_epa.py`, `query_team_efficiency.py`, `query_positional_comparison.py`.
3. **Defer (Tiers 2–5):** DataScience agent, Copilot Extension, Tier 2 charter overhaul, gameday pipeline.

**Why:**
- **Analytics gap is data access, not scope.** nflreadpy fills the gap without a new agent.
- **Offseason data is static.** Real value is historical comparisons for current articles (Witherspoon extension, JSN contract, draft strategy), not live updates.
- **Token budget constraint.** Pre-aggregated tables only (10–20 rows max); large datasets blow the 1,500-token cap per panelist.
- **Two-runtime overhead.** Python deps (nflreadpy, Polars) in a Node project add infrastructure complexity. Keep isolated to `content/data/`, manage via `requirements.txt`.
- **Phase 1 bottleneck is publishing & audience, not analytics sophistication.** 5-tier full ladder is Phase 2–3 investment. Validate current publishing model first (5–8 articles, engagement data, multi-team proof).

**Risks flagged:**
- Python + Node infrastructure: mitigate with `.squad/skills/nflverse-data/SKILL.md` + isolated `content/data/`
- Cache size ~300MB (local only, .gitignore)
- Offseason limitations: expectation management in article output

**Status:** Proposed — awaiting Joe Robinson review

**Integration point:**
- **Stage 2 (Discussion Prompt → Data Anchors).** Lead currently hand-assembles data; Tier 1 scripts enable automated aggregation.
- **Analytics panel positions.** When Analytics is on a panel, it can invoke query scripts to back claims with real data.
- No pipeline schema changes needed. No new stages. No new DB tables. Data-quality upgrade to existing artifacts.

**Files affected:**
- New: `requirements.txt` (root)
- New: `content/data/fetch_nflverse.py`
- New: `content/data/.gitignore`
- New: `.squad/skills/nflverse-data/SKILL.md`
- New: `content/data/query_*.py` (3 scripts minimum, 2–3 others deferred)
- Update: `.squad/agents/analytics/charter.md` (PFR section → nflverse)

---

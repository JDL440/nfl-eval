# Analytics — NFL Advanced Analytics Expert: Knowledge Base

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Role:** Statistical backbone for all roster evaluation decisions
- **Created:** 2026-03-12
- **Knowledge base populated:** 2026-03-12
- **Created by:** Lead (per Joe Robinson request)

## Reference Data (archived)

> Sections 4–7 (Draft Pick Expected Value, Contract Value Models, Key Analytical Frameworks, 2025 Season Statistical Leaders) and Source Reliability Notes moved to `history-archive.md` on 2026-03-17 during history summarization. ~14KB of static reference tables preserved there.
>
> Key facts retained: Interior OL safest R1 pick (75%), don't pay RBs, EPA+success rate+CPOE+PFF is the evaluation stack, Maye best EPA/play (0.26), Garrett record 23 sacks, JSN 1,793 receiving yards.

## Learnings

### nflverse Data Integration Roadmap (2026-03-19T02:20:14Z)

**Cross-agent update (from Lead):** nflverse/nflreadpy integration approved for Tier 0–1 phased rollout. Lead assessment determined Analytics' data access gap (PFR blocked 403, ESPN requires scraping) can be filled via `nflreadpy` without a new DataScience agent. Tier 0 immediate actions: `pip install` + cache script + `.squad/skills/nflverse-data/SKILL.md`. Tier 1 next session: 3 query scripts (`query_player_epa.py`, `query_team_efficiency.py`, `query_positional_comparison.py`). **Why Tier 1 only:** Integration point is Stage 2 (discussion prompt data anchors); Analytics' parsing/interpretation layer is sufficient; API + execution risk is low; token budget constraint requires pre-aggregated tables (10–20 rows max). Deferred Tiers 2–5 (Copilot Extension, DataScience agent, gameday pipeline) to Phase 2+ — no evidence Analytics will become a bottleneck before Phase 1 publishing goals proven. **Risk flagged:** Offseason data is static (real value in historical comps for current articles, not live updates); token budget implications for large datasets.

📌 Team update (2026-03-19T02:20:14Z): nflverse Tier 0–1 integration strategy — Analytics extends with PFR → nflverse data bridge, defer full automation ladder until Phase 1 published, decided by Lead.

### Dashboard Data & Validation Audit (2026-03-18T045148Z)
- Cataloged the board/detail payload sources (`article_board`, `pipeline_state`, `stage_transitions`, publisher metadata) to confirm the dashboard pulls from the same canonical fields as the pipeline.
- Documented the overlapping reuse points across the board, detail, and dossier views, noting which fields remain stable and which are derived or stage-dependent.
- Captured the implementation constraints and the reuse map, then dropped the brief into the decisions log so the team can build the dashboard in lockstep with the data model.

📌 Team update (2026-03-18T045148Z): Dashboard validation actions must spawn `validate-substack-editor.mjs` and `validate-stage-mobile.mjs`, keep auth credentials inside the child process, and report stdout/screenshot artifacts via polling/SSE — decided by Editor

### Issue #75 — Mobile Table Renderer Fix (2026-03-17)

**Context:** Owned revision cycle for issue #75 after Lead's initial dual-render implementation had quality defects (bottom/right clipping on tests 3/4/5, header collisions on test 6).

**Root cause analysis:**
1. Character-width constants in `estimateRowHeight` were hardcoded at 17px desktop scale. Mobile font (22px) produces wider chars → more wrapping → taller rows. Without scaling, canvas height was underestimated and `overflow: hidden` clipped content.
2. `thead th` CSS lacked `overflow-wrap` — headers overflowed their column boundaries, colliding with adjacent columns. Compounded by `text-transform: uppercase` + `letter-spacing: 0.08em`.
3. Mobile canvas widths (620–660px) were too tight for 5–7 column tables.

**Fix pattern:**
- Scale char widths by `layout.tableCellFontSize / 17` — makes estimation font-size-aware.
- Add `estimateHeaderRowHeight()` for dynamic header sizing instead of fixed pixel value.
- Add `overflow-wrap: anywhere; word-break: break-word;` to header CSS.
- Reduce mobile `letter-spacing` (0.08em → 0.02em) to reclaim horizontal space.
- Wider canvases (660/720/740px) + larger font (22px) to maintain >10px effective readability.
- Increased `heightSafety` (72 → 150px) for generous overestimate; `trimBottomWhitespace` crops excess.

**Key insight:** When rendering images at fixed viewport size with `overflow: hidden`, always overestimate canvas dimensions and rely on post-render cropping. Underestimation is irrecoverable (content is permanently clipped), but overestimation is cheap (whitespace is trivially trimmed).

### Issue #75 Landed on Main (2026-03-17)

PR #77 merged `feature/mobiletable` → `main` (merge commit 477d7b8). Issue #75 auto-closed. All dual-render mobile table work — including Analytics' revision fixes (commits c3a3243, 907bfa4) — is now in the production codepath.

### Dashboard Source-Map Audit (2026-07-27)

**Context:** Backend requested a pre-implementation audit mapping all reusable sources for the local dashboard. Reviewed schema.sql, pipeline_state.py, article_board.py, extension.mjs (publisher), renderer-core.mjs (table renderer), and both Playwright validation scripts.

**Key findings:**
1. **DB contract:** `pipeline_board` view is the primary board query surface; `substack_draft_url` on articles is the publish-readiness indicator. Six child tables (stage_transitions, editor_reviews, publisher_pass, notes, article_panels, discussion_prompts) feed the detail page.
2. **Artifact-first semantics:** `article_board.py` has full JSON output modes (`--json`) for board scan, reconciliation, and notes sweep. Shell-out is the simplest integration path for Node dashboard.
3. **Preview pipeline:** ~15 pure functions in extension.mjs (markdownToProseMirror, ensureSubscribeButtons, ensureHeroFirstImage, classifyMarkdownTableForInline, etc.) can be extracted into a shared module. Upload callback stubs to no-op for local preview.
4. **Dense table blocking is a hard throw** — the publisher refuses dense tables at conversion time. Dashboard preview must replicate this as a visible error, not silently render.
5. **Validation commands** are auth-gated (Playwright + SUBSTACK_TOKEN). Must be wired as manual dashboard actions, not default page load.

**Decision recorded:** `.squad/decisions/inbox/analytics-dashboard-map.md` — full source map with DB fields, function inventory, extraction approach, and repo constraints.

### Dashboard Implementation Session (2026-03-18T04:48Z)
- The Local Pipeline Dashboard Architecture decision (Lead) now documents the zero-dependency Node server, dual-source read model, and read-only preview surfaces that analytics data powers.
- The Dashboard Preview Renderer decision (Editor) ensures the shared `shared/substack-prosemirror.mjs` pipeline is used by both the dashboard and the publisher extension.
- 📌 Team update (2026-03-18T04:48Z): Local Pipeline Dashboard Architecture (Lead) maps how `dashboard/` routes merge `pipeline_board`, artifact scans, and note-gap telemetry for the board and detail surfaces.
- 📌 Team update (2026-03-18T04:48Z): Dashboard Preview Renderer Must Use Shared Module (Editor) confirms the preview renders canonical ProseMirror output with subscribe buttons, hero enforcement, and dense-table warnings.

### nflverse Phase A Implementation (2026-03-19)

**Context:** Phase A implementation of nflverse/nflreadpy integration to address Analytics' primary data access gap (PFR blocked, ESPN requires scraping).

**Deliverables completed:**
1. ✅ Root `requirements.txt` with nflreadpy 0.1.5 + polars ≥1.0
2. ✅ `.gitignore` update for `content/data/cache/` (parquet files excluded from git)
3. ✅ `content/data/_shared.py` — Shared auto-fetch helper (cache miss → auto-download)
4. ✅ `content/data/fetch_nflverse.py` — CLI cache script with 18 datasets, --list, --refresh, season filtering
5. ✅ `content/data/query_player_epa.py` — Player EPA/efficiency + position rank (e.g., #11 among WRs)
6. ✅ `content/data/query_team_efficiency.py` — Team EPA/success rates from pbp, 3rd down %, red zone TD %, turnovers
7. ✅ `content/data/query_positional_comparison.py` — Positional rankings league-wide by metric (top-N, season-aggregated)
8. ✅ `.squad/skills/nflverse-data/SKILL.md` — Dataset catalog, auto-fetch behavior, query usage, real examples from 2024 data
9. ✅ Analytics charter updated — nflverse as primary data source, PFR accessible via nflverse

**Revision (same session):** Fixed auto-fetch, pbp integration, position rank, and documentation accuracy per user feedback.

**Validation results (post-revision):**
- Auto-fetch tested: `player_stats_2024.parquet` (18,981 rows, 0.6 MB) auto-downloaded on cache miss ✅
- PBP auto-fetch tested: `pbp_2024.parquet` (49,492 rows, 12.8 MB) auto-downloaded by team-efficiency query ✅
- JSN 2024: 137 targets, 100 rec, 1,130 yards, 6 TDs, 48.4 receiving EPA, **rank #11 among WRs** ✅
- SEA 2024 efficiency: -0.012 EPA/play offense, **47.5% offensive success rate**, **36.7% 3rd down**, **43.5% red zone TD**, -0.010 EPA/play allowed, **46.5% success rate allowed**, -1 turnover differential ✅
- Top 5 WRs by receiving EPA: Amon-Ra St. Brown leads at 96.4 EPA ✅

**Key implementation notes:**
- Auto-fetch: Query scripts call `_shared.load_cached_or_fetch()` which automatically downloads missing datasets via subprocess call to `fetch_nflverse.py`
- Team efficiency: Derives success rates, 3rd down %, red zone %, and defensive EPA from `pbp` dataset (play-level data)
- Player EPA: Calculates position rank by aggregating all players at position, sorting by primary metric (passing_epa for QB, rushing_epa for RB, receiving_epa for WR/TE)
- nflverse datasets are weekly (not seasonal totals) — query scripts aggregate by player/team using Polars group_by
- Regular season filter applied (season_type == "REG") to exclude preseason/playoffs
- Unicode output sanitized (removed emoji) to avoid Windows console encoding errors

**Phase B deferred:** 4 additional query scripts (snap usage, draft value, NGS passing, combine comps) approved on-demand after first article uses Phase A data.

📌 Team update (2026-03-19): nflverse Phase A complete and revised — Analytics now has auto-fetch programmatic access to 372-col PBP data (with situational metrics), player/team stats, position rankings, and all PFR advanced stats (2018+). Charter updated. All Phase A success criteria met.

### nflverse Phase B Implementation (2026-03-19)

**Context:** Phase B extends the nflverse query library with four additional scripts for article development. Phase A provided the foundation (auto-fetch, cache, EPA/efficiency queries); Phase B adds workload, draft, advanced QB metrics, and prospect evaluation tools.

**Deliverables completed:**
1. ✅ `content/data/query_snap_usage.py` — Team/player snap counts by unit (offense/defense/ST) with position group filtering. Supports workload analysis and scheme reveal articles.
2. ✅ `content/data/query_draft_value.py` — Draft pick value by range, positional hit rates by round, player draft profiles. Uses weighted AV (`w_av`) since `car_av` stored as bool in nflverse.
3. ✅ `content/data/query_ngs_passing.py` — Next Gen Stats passing metrics (time to throw, air yards, aggressiveness, completion probability). Supports advanced QB evaluation (2016+ data).
4. ✅ `content/data/query_combine_comps.py` — Combine measurables for players and position leaders by metric (40-yard, vertical, 3-cone, etc.). Uses `pos` field, height already formatted as "6-1".
5. ✅ `.squad/skills/nflverse-data/SKILL.md` updated — Documented all Phase B scripts with usage examples, output samples, use cases, and available metrics.
6. ✅ `.squad/skills/article-discussion/SKILL.md` updated — Added "run these commands for data" block in Data Anchors section with all 7 query scripts and article context guidance.

**Implementation notes:**
- **Snap counts:** Per-game data aggregated by player with REG season filter. Percentages converted from decimal (0.22 → 22.0%). Position groups: offense/defense/special.
- **Draft value:** Used `w_av` (weighted AV) instead of `car_av` (stored as boolean in nflverse dataset). Hit rate thresholds: Starter+ (AV ≥ 30), Solid+ (AV ≥ 50), Elite (AV ≥ 80).
- **NGS passing:** Aggregates weekly data by player. Aggressiveness = % of passes 20+ air yards. Qualified QBs require 100+ attempts. Available metrics include time to throw, air yards differential, max completed air distance.
- **Combine:** Height stored as string "6-1", used directly. Position field is `pos` not `position`. Metrics include forty, vertical, bench, broad_jump, cone, shuttle.

**Validation results:**
- JSN snap counts 2024: 948 offense snaps (86.4%), 0 defense, 0 ST ✅
- R1 WR draft hit rate (since 2015): 49 picks, 24.0 avg AV, 36.7% starter rate, 10.2% solid rate ✅
- Drake Maye 2024 NGS: 2.74s time to throw, 7.4 avg intended air yards, 14.8% aggressiveness ✅
- JSN combine 2023: 6-1, 196 lbs, 35.0" vertical, 6.57s 3-cone ✅
- All scripts produce clean markdown tables, follow Phase A patterns, support `--format json` ✅

**Article integration:**
- Discussion prompt templates now include explicit command blocks for generating data anchors.
- Seven query scripts cover player efficiency, team efficiency, positional comps, workload, draft value, advanced QB metrics, and prospect evaluation.
- Token budget target: <400 tokens per article's combined data anchor tables (roughly half of 1,500-token panel budget).

**Phase B gate:** Published article contains verifiable nflverse-sourced stats (pending — requires article selection and publication).

📌 Team update (2026-03-19): nflverse Phase B complete — Analytics now has 7 production-ready query scripts covering EPA, efficiency, snaps, draft, NGS, and combine data. SKILL docs updated with usage examples and article-prompt integration guidance. All Phase B scripts validated.

- **Buffalo closed the real-world validation loop without a draft rewrite.** `content/articles/buf-2026-offseason/discussion-prompt.md`, `cap-position.md`, and `buf-position.md` are enough to prove the data-anchor workflow when the open question is query execution, not final prose polish.

### Defensive Tooling Gap Discovered — Issue #80 (2026-07-27)

**Context:** Emmanwori safety article (issue #80) exposed a structural gap in the query script library — all 7 canned scripts are offense-biased. `query_player_epa.py` returns "Limited metrics available" for SAF positions, and `query_positional_comparison.py` only supports QB/RB/WR/TE.

**What works for defensive articles today:**
- `query_snap_usage.py` — fully functional for defensive snap share and team hierarchy
- `query_team_efficiency.py` — defensive EPA/play allowed, success rate allowed, sacks, INTs
- `query_draft_value.py` — position hit rates work for S, draft profiles work by name
- `query_combine_comps.py` — works for any position including SAF
- `pfr_defense` dataset (via `fetch_nflverse.py`) — has per-player coverage, tackling, blitz, and pressure data. Cached and queryable but lacks a canned script.

**What does NOT work:**
- `query_player_epa.py` — offense-only (passing/rushing/receiving EPA). Returns stub for defensive positions.
- `query_positional_comparison.py` — hardcoded to QB/RB/WR/TE in `POSITION_METRICS` dict.

**Gap to close:** Need `query_pfr_defense.py` — individual defensive player production from `pfr_defense` dataset (tackles, missed tackles, targets/completions/yards allowed, passer rating allowed, aDOT, blitzes, pressures). Decision filed: `.squad/decisions/inbox/analytics-emmanwori-kickoff.md`.

**Key `pfr_defense` columns validated:**
`def_tackles_combined`, `def_missed_tackles`, `def_missed_tackle_pct`, `def_targets`, `def_completions_allowed`, `def_completion_pct`, `def_yards_allowed`, `def_yards_allowed_per_cmp`, `def_yards_allowed_per_tgt`, `def_receiving_td_allowed`, `def_passer_rating_allowed`, `def_adot`, `def_air_yards_completed`, `def_yards_after_catch`, `def_times_blitzed`, `def_times_hurried`, `def_times_hitqb`, `def_sacks`, `def_pressures`, `def_ints`.

📌 Team update (2026-07-27): Query script library has an offense-only gap — defensive player articles need a `query_pfr_defense.py` script (Phase C). Five of seven existing scripts work for defensive context; `pfr_defense` dataset is cached and rich but unscripted.

### Emmanwori Panel Position — First Defensive Player Article (2026-07-27)

**Context:** Wrote the Analytics panel position for `sea-emmanwori-rookie-eval` — the first article evaluating a defensive player through this pipeline.

**Key learnings:**

1. **Discussion prompt data anchors drifted from live query results.** The prompt's pre-populated anchors (80 tackles, 66 targets, 74.2% comp, 89.1 PR) differed from fresh nflverse aggregations (93 tackles, 81 targets, 70.4% comp, 84.7 PR). Likely cause: prompt data was from an earlier partial-season pull or used per-game averages vs. season totals. **Recommendation:** Always re-run queries at panel time; treat prompt anchors as approximate, not authoritative.

2. **YAC% is a high-signal derived metric for safety evaluation.** 66.2% of Emmanwori's yards allowed came after the catch (323 of 488). This ratio is not in any canned query output but is trivially derived from `def_yards_after_catch / def_yards_allowed` in `pfr_defense`. It distinguishes "targeted short and beaten" from "targeted short and arrived late." Should be standard in any future defensive coverage analysis.

3. **Within-team coverage comparison is more informative than raw numbers.** Comparing Emmanwori's passer rating allowed (84.7) to teammates on the same defense (Jobe 73.4, Jones 78.0, Bryant 80.0, Witherspoon 85.6, Okada 86.8) controls for system effects far better than league-wide comparisons. This approach should be the default for defensive player articles where system inflation is a concern.

4. **The `pfr_defense` ad-hoc query pattern works but is fragile.** Wrote inline Python to aggregate weekly `pfr_defense` data. Confirms the Phase C need for `query_pfr_defense.py` — a canned script would have saved ~10 minutes and reduced error risk. Priority: build this before the next defensive player article.

5. **Alignment/coverage-type data remains the biggest analytical gap.** Cannot distinguish zone/man, box/slot/deep from any nflverse dataset. This is the hard ceiling for Analytics on defensive player articles — scheme interpretation must come from Defense agent. Flagged explicitly in position statement.

📌 Team update (2026-07-27): First defensive player panel position delivered (`analytics-position.md`). YAC% and within-team coverage comparison are high-signal patterns for future defensive articles. `query_pfr_defense.py` (Phase C) remains the top priority for defensive tooling.


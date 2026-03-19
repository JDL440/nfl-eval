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

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

### nflverse Phase A Implementation Complete (2026-03-19T02:40:09Z)
**Status:** ✅ SHIPPED — Analytics delivered Phase A: requirements.txt, fetch_nflverse.py, _shared.py helper, 3 query scripts (player EPA, team efficiency, positional comparison), SKILL.md, charter update, and validation via smoke tests.

- All Phase A artifacts produced and validated (auto-fetch, pbp integration, position rank, ambiguous name safety)
- Validation: JSN 2024 rank #11 among WRs (137 tgt, 100 rec, 1,130 yds, 6 TD, 48.4 EPA); SEA offense -0.012 EPA/play, 47.5% success; defense -0.010 EPA/play allowed, 44 sacks, 13 INTs
- Coordinator follow-up fixes: ambiguous player match safety, red-zone drive per-game grouping, text sync to verified output
- 📌 Team update (2026-03-19T02:40:09Z): nflverse Phase A implementation complete — ready for Stage 2 data anchor integration, decided by Analytics with Lead approval
- Orchestration log: `.squad/orchestration-log/2026-03-19T02-40-09Z-analytics-phase-a.md`
- Session log: `.squad/log/2026-03-19T02-40-09Z-nflverse-phase-a.md`
- Decision brief merged to `.squad/decisions.md`

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

### Phase B Step 1 Execution Complete — Discussion Prompt Updated (2026-03-19T04:00:00Z)
**Status:** ✅ DONE — `buf-2026-offseason` discussion prompt now includes Phase B data query instructions.

**Change summary:**
- **File:** `content/articles/buf-2026-offseason/discussion-prompt.md`
- **Section added:** "## Data Query Instructions" (new, 35 lines)
- **Location:** After "Allen's 2025 Season vs. Career Context" table, before "The Paths" section
- **Content:** Three-tier command block:
  - **Required (all panelists):** `query_team_efficiency.py --team BUF --season 2025` — Buffalo's actual EPA/efficiency vs. league
  - **Highly recommended (Cap/Defense):** `query_snap_usage.py --team BUF --season 2025` + `query_draft_value.py --position CB --position EDGE --since 2015` — supports rebuild cost + replacement archetype arguments
  - **Optional (if relevant):** `query_positional_comparison.py --position C ...` — OL market context
- **Guidance included:** Each command explains what it returns and which tension it supports (team efficiency, defensive exodus, OL questions)
- **Scope:** No rewrites of core question, tensions, paths, or panel instructions. Pure instruction addition.
- **Next step:** Rerun Cap + BUF agents with updated prompt (Step 2, ~10 min parallel)

### Phase B Step 1 Revision Complete: Discussion Prompt Refreshed for Factual Consistency (2026-03-19T04:15:00Z)
**Status:** ✅ DONE — Prompt now internally consistent with Cap + BUF positions + current March 2026 Buffalo reality.

**Two-pass update completed:**
1. **Phase B integration (prior turn):** Added "## Data Query Instructions" with 3 required + 1 optional Phase B commands
2. **Factual consistency refresh (this turn):** Updated stale pre-March framing to align with executed moves

**Targeted corrections made:**
- **Title & core question:** "Can the Bills Retool at $11M Over?" → "Did Beane's March Moves Preserve or Distort Allen's Window?"
- **All 4 key tensions rewritten:**
  - Removed hypothetical options (pending decisions)
  - Focused on executed moves: restructures (Allen, Brown, Oliver), pay-cut (Knox), trades (Moore), free agent signings (Chubb, Gardner-Johnson, McGovern re-sign)
  - Shifted evaluation to consequences: 2027 cap invoice, secondary readiness as single-point-of-failure
- **Data anchors completely refreshed:**
  - Cap situation: ~$11M over → ~$12.5M under (post-restructures)
  - Knox: cut for $9.7M → reworked deal, $8.55M
  - Allen cap hit: $43.6M → $44.2M; dead money $173M
  - Added 3 new tables: March 2026 moves (with 2026 + 2027 impact), defensive departure snap analysis, 2027 cap consequence invoice
  - Removed stale UFA projections table, outdated Allen trajectory table
- **The Paths:** Changed from 4 hypothetical options to 4 post-hoc evaluation frames (Beane's choice, 2027 consequence, secondary bet, scheme validation)
- **All panel instructions refocused for post-March framing:**
  - Cap: "evaluate restructure paradox + void-year mechanics + 2027 invoice"
  - BUF: "defend/critique Beane's aggressive retool choice"
  - Defense: "does Leonhard's 3-4 + young secondary work?"

**Result:** Discussion prompt is now fully consistent with Cap + BUF positions and current Buffalo reality. Ready for Cap + BUF re-run with Phase B queries.

### Phase B Validation Strategy

### GitHub Issue #80 — Nick Emmanwori Rookie Season Article (2026-03-19)
**Status:** ✅ CREATED — Issue #80 opened via `gh` CLI with full template-aligned body.

- **Title:** "Article: Nick Emmanwori's Rookie Season — What the Analytics Say About Seattle's Defensive Chess Piece"
- **Labels:** `squad`, `squad:lead`, `article`, `article:beat`, `go:needs-research` (Depth Level 2)
- **Panel:** SEA + Analytics + Defense (3 agents)
- **Key convention:** Issue title uses `Article:` prefix for triage routing; body populates all template fields from `article-idea.yml`
- **Data queries specified:** 4 nflverse commands (snap usage, team efficiency, draft value, combine comps)
- **⚠️ Correction:** Original issue was created with Jacksonville context; corrected to Seattle per issue body note
- **URL:** https://github.com/JDL440/nfl-eval/issues/80

### Issue #80 Kickoff — Article Pipeline Stages 1–2 (2026-03-19)
**Status:** ✅ DONE — Full kickoff artifact set created; article at Stage 2 (Discussion Prompt written).

- **Slug:** `sea-emmanwori-rookie-eval`
- **Path:** `content/articles/sea-emmanwori-rookie-eval/`
- **Artifacts:** `idea.md`, `panel-composition.md`, `discussion-prompt.md`
- **DB:** Article record inserted at `current_stage=2`, 3 panel members (SEA, Analytics, Defense), discussion prompt record, 2 stage transitions
- **Decision brief:** `.squad/decisions/inbox/lead-emmanwori-kickoff.md`
- **GitHub comment posted:** Kickoff status on issue #80
- **Key design choice:** Data anchors are command stubs (not populated tables) — no stats fabricated. Analytics must run 4 nflverse queries to populate anchors before panel spawn.
- **Panel lanes:** SEA owns roster/depth chart; Analytics owns numbers/benchmarks; Defense owns scheme interpretation. Explicit lane boundaries documented in `panel-composition.md`.
- **Next:** Analytics runs data queries → Lead populates data anchors → Panel spawn (Stage 3→4)

### Issue #80 Sharpening — Specialist Data Integrated (2026-03-19)
**Status:** ✅ DONE — All three kickoff artifacts rewritten with real Analytics/SEA/Defense specialist outputs. Data anchors now populated, not command stubs.

- **Analytics integration:** 768 defensive snaps (84.9%, 6th on SEA), team efficiency (-0.121 EPA/play), on-ball production (80 TKL, 90.9% efficiency, 74.2% comp allowed, 89.1 PR allowed, 5.6 aDOT, 34 blitzes), R2 S benchmark (26 picks, 30.8% starter+), draft value (R2 #35, AV 4)
- **SEA input:** Championship-defense shelter tension, Woolen/Bryant secondary changes, draft capital fork (#32/#64 goes to CB/EDGE if Emmanwori is real)
- **Defense input:** Macdonald disguise-rotation framing, post-snap rotation trust, big-nickel breadth, misleading-evidence warnings (raw tackles, low INTs, simplistic snap%)
- **Key upgrade:** Discussion prompt now has populated data tables, "Metrics NOT To Use" warning table, scheme-aware tensions, deployment-specific panel instructions. Ready for panel spawn — only combine measurables remain as a query stub.
- **Decision brief updated:** `.squad/decisions/inbox/lead-emmanwori-kickoff.md` now documents all specialist inputs and remaining steps

## Learnings

### nflverse Integration & Platform Prioritization
- **Approved Tier 0–1 roadmap:** Foundation (cache script, `requirements.txt`) + selective Tier 1 (3 query scripts). Build in 2–3 sessions starting immediately.
- **Integration point:** Stage 2 discussion prompt Data Anchors. Query scripts replace hand-assembled web-scraped tables. No schema changes needed.
- **Risks:** Python+Node dual-runtime, offseason data is static (limits near-term value), token budget implications for large datasets, ~300MB parquet cache.
- **Why Tier 2–5 deferred:** No evidence Analytics will bottleneck before Phase 1 publishing goals are met. Deferred work has explicit entry triggers (frequency, cadence, regular season).
- **DataScience agent decision:** Do NOT create. Extend Analytics instead — it owns the analytical domain; it lacks data access, not scope.
- **Phase B validation strategy:** Use in-flight article work (Stage 6+) to prove nflverse integration, not new test articles. Grounds abstract capability in real publishing workflow. `buf-2026-offseason` is ideal: complex roster story, multiple data anchor types, benefits from snap counts + draft history + team efficiency queries.
- **Silent-success merge repairs must normalize the canonical decision, not append another plan.** Once validation lands, update the Lead path to say Buffalo is complete, note the exact validation artifacts, and move draft refresh + stale-article planning into deferred work with the lockout stated explicitly.

### Data-First Discussion Prompts for Defensive Player Evaluations
- **Offensive-only nflverse queries don't work for defensive players.** `query_player_epa.py` and positional comparison scripts are WR/QB/RB-oriented. For safety/DB evaluations, use `snap_counts` + `pfr_defense` datasets directly, plus `query_snap_usage.py --position-group defense` and `query_draft_value.py --position S`.
- **Command stubs > fabricated stats.** When data queries haven't been run yet, write the commands as placeholders in the discussion prompt and mark them as required anchors. Never invent numbers to fill anchor tables. This preserves reviewer-gate integrity.
- **Lane boundaries in panel-composition.md prevent duplicate work.** Explicitly stating what each agent owns and what they should NOT do (e.g., "Analytics: don't interpret scheme fit — that's Defense's lane") produces better panel output than vague instructions.

### Emmanwori Discussion Synthesis (2026-03-19)
- **Scheme-expert reframes are the article's highest-value material.** Defense's reinterpretation of the 5.6 aDOT (short = harder assignment in Macdonald's system, not sheltered) was the single most counter-intuitive insight in the panel. In future panels with a scheme specialist, explicitly prompt for "reframe one metric the other panelists will misread." This produces the non-obvious insights that differentiate the article.
- **"Conditionally earned" framing resolves tension better than averaging.** When one panelist says Path 1 and another says Path 2, don't split the difference — name the precise condition that separates them. Defense's two-tier/three-tier framework (big-nickel proven, full chess piece projected) gave the synthesis its structure. This is reusable for any "label vs. evidence" evaluation.
- **Analytics YAC rate finding (66.2%) was the best specific-metric contribution.** It kept the synthesis honest by providing a concrete weakness even within a positive overall picture. Future panels should ask Analytics to identify one metric that challenges the prevailing narrative, not just confirm it.
- **Witherspoon ecosystem dependency was under-engaged by the panel.** SEA raised it; Analytics and Defense didn't pick it up. In future panels where one agent identifies a cross-domain risk (roster dependency affecting scheme evaluation), Lead should flag it in the synthesis as an open question rather than letting it get lost.
- **Three-agent panels at Level 2 produce good tension with lower cost.** The SEA/Analytics/Defense trio covered roster, numbers, and scheme with no overlap and genuine disagreement. This is the template for future defensive-player evaluations.

### Emmanwori Editor-Revision Pass (2026-07-26)
- **Lead owns post-Editor surgical revisions.** When Editor flags factual errors and low-risk cleanups, Lead applies them directly — no round-trip to Writer. This keeps the pipeline moving and avoids re-entering the draft loop.
- **Seahawks first-name cross-contamination is a recurring pattern.** Devon Woolen (should be Tariq), Uchenna Mafe (should be Boye) — both borrowed first names from teammates (Witherspoon, Nwosu). Future SEA articles should include a name-verification checklist in the Writer prompt.
- **One-year contracts should never use "AAV" formatting.** AAV implies multi-year; use "1yr / $XM" for consistency with how multi-year deals are formatted in tables.

### Mobile Table Right-Edge Clipping Fix (2026-07-26)
- **`tableFramePaddingX: 4` was insufficient for mobile renders at 22px body font.** Chrome's subpixel column-width rounding at 2× DPR plus `border-radius` anti-aliasing on the `overflow: hidden` frame consumed the 4px buffer. Increased to 10px — the `chooseMobileCanvasWidth()` auto-compensates so effective table content area stays constant.
- **Always pair `overflow-wrap: anywhere` with `word-break: break-word` on table cells.** Header (`thead th`) already had both; body cells (`tbody td`) only had `overflow-wrap`. Adding the defensive `word-break` ensures consistent wrapping across all browser edge cases.
- **When diagnosing table rendering bugs, render the exact same table markdown at the same options.** Reconstructing the source markdown from the image content is necessary when the draft has already been patched to reference image files instead of inline tables.

### Mobile Table Image Right-Edge Clipping Fix (2026-07-26)
- **Root cause:** `border-collapse: collapse` + `table-layout: fixed` in Chrome causes subpixel column-width rounding that can overflow the `.table-frame` by 1-4px. With `overflow: hidden` and zero frame padding, the rightmost column's text gets clipped.
- **Fix:** Added `tableFramePaddingX` (4px mobile, 0 desktop) to layout constants, switched to `border-collapse: separate; border-spacing: 0`, increased mobile canvas width by `2 × framePadding` to compensate. Updated height estimation functions to account for frame border + padding.
- **Reusable:** Fix applies to all future mobile table renders automatically — not article-specific.
- **Re-rendered:** Emmanwori "Tier" and "Position Need" mobile PNGs regenerated and verified.
### Stage 7/8 Operator Guidance Cleanup (2026-03-19)
- **Stage 7 is a dashboard-ready pause — no Substack publish happens in the autonomous pipeline.** The dashboard article page is the final review surface. The dashboard publish action performs live publish and can dispatch the Substack Note.
- **Stage 8 means truly live published only** — reached only after the dashboard publish flow records a live `substack_url`. Lead should treat Stage 7 as the handoff boundary and Stage 8 as the proof-of-publication state.
- **Key files corrected in this pass:**
  - `README.md` — Publishing setup, pipeline summary, and dashboard section now describe dashboard review as the default stop point before live publish.
  - `ralph/prompt.md` — Ralph now aims for dashboard-ready Stage 7 or live-published Stage 8, and no longer instructs the main loop to call `publish_to_substack`.
  - `ralph/AGENTS.md` — Stage labels and lifecycle summary now frame Stage 7 as dashboard handoff and Stage 8 as the live-published state.
  - `.squad/skills/publisher/SKILL.md` — Joe-facing checklist, Note fallback, and cover-image guidance now match dashboard-led publish semantics.
  - `.squad/agents/lead/charter.md` — Lead's GitHub issue pipeline contract now explicitly ends autonomous work at Stage 7 and hands Stage 8 to Joe on the dashboard.
- **Verified aligned and left unchanged:** `.squad/skills/article-lifecycle/SKILL.md`.
- **`publish_to_substack` role:** Draft helper and manual fallback only. It is not the default Stage 7 step; the dashboard publish action is the live-publish entry point.


### Stage 7/8 Operator Guidance Audit (2026-03-19T05:08:13Z)
**Status:** ✅ COMPLETED — Scribe merged 3 inbox decisions. Lead completed surgical audit of operator-facing pipeline docs; corrected 4 files (charter, skills, AGENTS) to enforce dashboard-first Stage 7 architecture.
- Decision merged to \.squad/decisions.md

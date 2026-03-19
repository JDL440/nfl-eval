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

### Dashboard Fact-Check UI Plumbing (2026-03-19T05:00:14Z)
**Status:** ✅ COMPLETED — Dashboard UI now classifies `panel-factcheck.md` artifact with verification badge.

- Updated `dashboard/data.mjs`: `panel-factcheck.md` classified into new `"verify"` document group (sort key 85, between editor-image-review and publisher-pass)
- Updated `dashboard/templates.mjs`: Renders Fact-Check Verification section in Draft & Edits tab; green "✓ Fact-Checked" badge on overview tab
- `inferStage()` unchanged — artifact-first pipeline fully preserved
- 📌 Team update (2026-03-19T05:00:14Z): Dashboard fact-check UI complete, decided by Lead
- Orchestration log: `.squad/orchestration-log/2026-03-19T05-00-14Z-lead.md`
- Session log: `.squad/log/2026-03-19T05-00-14Z-dashboard-factcheck-ui.md`
- Decision merged to `.squad/decisions.md`

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

### Dashboard Fact-Check UI Plumbing
- **`panel-factcheck.md` classified as `"verify"` group** in `dashboard/data.mjs` — sort key 85 (between editor-image-review at 80 and publisher-pass at 90). This places it in the pipeline timeline after editor review but before publisher pass.
- **Not stage-defining:** `inferStage()` is completely untouched. `panel-factcheck.md` does NOT gate or change stage inference.
- **Rendering:** Dashboard `draftTab` renders a "Fact-Check Verification" section (between Draft and Editor Reviews); overview tab shows a green "✓ Fact-Checked" badge on the stage-inference line when the artifact exists.
- **Key files:** `dashboard/data.mjs` (`classifyDocumentGroup`, `documentSortKey`), `dashboard/templates.mjs` (`overviewTab`, `draftTab`).
- **Wiring pattern:** New document group requires 4 touch points: (1) `classifyDocumentGroup` group name, (2) `documentSortKey` stable key, (3) filter in `articlePage`, (4) pass-through to tab renderer. Missing any one silently drops the artifact into "other."
- **Phase 2 complete.** Decision: `.squad/decisions/inbox/lead-dashboard-factcheck-ui.md`

### Fact-Checking Phase 1 Rollout (2026-03-15)
- **Skill created:** `.squad/skills/fact-checking/SKILL.md` — lightweight preflight verification gate between Stage 4 (Panel) and Stage 5 (Writer).
- **Artifact standardized:** `panel-factcheck.md` — saved to `content/articles/{slug}/`, documents verified/unverified/contradicted claims, source conflicts, exact quotes, unsafe details.
- **Non-numeric gate design:** Fact-check preflight is a visible gate between Stage 4 and Stage 5, preserving the numeric 8-stage model unchanged. DB `current_stage` remains 1–8; preflight is a gate, not a new stage.
- **Writer uses preflight, doesn't duplicate:** Writer receives `panel-factcheck.md` summary (not full artifact) and shapes prose around flagged issues. Editor remains final fact-check gate at Stage 6.
- **Phase 1 scope (lightweight):** Focuses on high-risk categories (contracts, stats, injury, draft, direct quotes). Identifies contradictions, missing sources, unsafe details in panel outputs. Does NOT replace Editor's full fact-check.
- **Updated skills:** `article-lifecycle/SKILL.md` (added Stage 4→5 gate section, updated stage table), `substack-article/SKILL.md` (updated production pipeline + Writer spawn instructions).
- **README updated:** Added preflight as step 2 in high-level pipeline overview; maintained simplicity.
- **Decision record:** `.squad/decisions/inbox/lead-factcheck-rollout.md` — rationale, design decisions, risks, Phase 2–4 roadmap.
- **Why non-numeric:** Preserves existing 8-stage DB model; avoids migration burden; makes preflight visible without changing stage semantics.
- **Future phases:** Phase 2 (dashboard), Phase 3 (injury verification), Phase 4 (automated source lookups).

### Fact-Check Rollout Phase 1 Finalized (2026-03-19T05:10:46Z)
**Status:** ✅ COMPLETED — Phase 1 fact-checking rollout delivered: non-numeric gate, standardized artifacts, 8-stage model preserved.

- Created `.squad/skills/fact-checking/SKILL.md` — lightweight preflight skill (10–15 min per article, high-risk categories)
- Updated `.squad/skills/article-lifecycle/SKILL.md` — integrated Stage 4 → Stage 5 gate (non-numeric, visible)
- Updated `.squad/skills/substack-article/SKILL.md` — production pipeline clarity
- Updated `README.md` — high-level overview with preflight step
- 📌 Team update: Fact-checking Phase 1 complete — preflight skill defined, Writer/Editor workflow clarified, decided by Lead
- Orchestration log: `.squad/orchestration-log/2026-03-19T05-10-46Z-lead.md`
- Session log: `.squad/log/2026-03-19T05-10-46Z-factcheck-rollout.md`
- Decision merged to `.squad/decisions.md`

### Dashboard Fact-Check UI Phase 2 (2026-03-19T05:19:32Z)
**Status:** ✅ COMPLETED — Dashboard Phase 2 implementation and approval received.

- Updated `dashboard/data.mjs`: `panel-factcheck.md` classified into new `"verify"` document group (sort key 85, between editor-image-review and publisher-pass)
- Updated `dashboard/templates.mjs`: Renders Fact-Check Verification section in Draft & Edits tab; green "✓ Fact-Checked" badge on overview tab
- `inferStage()` unchanged — artifact-first pipeline fully preserved
- 📌 Team update (2026-03-19T05:19:32Z): Dashboard fact-check UI complete, decided by Lead
- 📌 Team approval (2026-03-19T05:19:32Z): Editor approved Phase 2 implementation — constraints respected, no regressions, decided by Editor
- Orchestration logs: `.squad/orchestration-log/2026-03-19T05-19-32Z-lead.md`, `.squad/orchestration-log/2026-03-19T05-19-32Z-editor.md`
- Session log: `.squad/log/2026-03-19T05-19-32Z-dashboard-factcheck-ui.md`
- Decisions merged to `.squad/decisions.md`: lead-dashboard-factcheck-ui.md (implementation), editor-dashboard-factcheck-review.md (approval)

### Fact-Check Rollout Surgical Cleanup (2026-03-19T05:19:32Z)
**Status:** ✅ COMPLETED — Verified Phase 1 rollout is surgical, feature-essential changes only.

- Validated README.md, fact-checking/SKILL.md, and supporting documentation
- Reverted non-feature session logging from editor/history.md
- Confirmed all remaining changes are feature-essential: writer/charter.md guardrails, article-lifecycle/SKILL.md gate, substack-article/SKILL.md production integration, decisions.md log
- Zero non-feature changes; all changes committed or staged
- Decision merged to `.squad/decisions.md`: lead-factcheck-cleanup.md

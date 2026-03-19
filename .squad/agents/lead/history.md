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

## Summarized History (2026-03-17)

> Condensed by Scribe on 2026-03-17T23:21:21Z. Older details moved to `history-archive.md`.

- Archived section: Summarized History (2026-03-12 through 2026-03-17)
- Archived section: Phase 2Target Selection (2026-03-17T13:24Z)
- Archived section: Phase 2 Live Result (2026-03-17T20:28Z)
- Archived section: Phase 2 Review Synthesis (2026-03-18T14:30Z)
- Archived section: Phase 3 Execution (2026-03-17T20:52Z)
- Archived section: Branch Cleanup & Push (2026-03-18)
- Archived section: Phase 3 Investigation & Correction (2026-03-17T21:00Z)
- Archived section: Notes Cleanup & Phase 2 Cadence (2026-03-17/18)

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
### Dashboard Implementation Session (2026-03-18T04:48Z)
- Merged the Local Pipeline Dashboard Architecture, Dashboard Implementation Source Map, and Dashboard Preview Renderer decisions into `.squad/decisions.md`, capturing the zero-dependency Node server architecture, dual-source read model, and canonical preview requirements.
- Created orchestration logs for Lead, Analytics, Editor, and Backend, then updated this session's log after archiving older decision blocks to keep the ledger lean.
- 📌 Team update (2026-03-18T04:48Z): Dashboard Implementation Source Map (Analytics) now governs the DB views, artifact heuristics, and validation commands feeding the board/detail surfaces.
- 📌 Team update (2026-03-18T04:48Z): Dashboard Preview Renderer Must Use Shared Module (Editor) mandates shared/substack-prosemirror.mjs across `dashboard/render.mjs` and the publisher extension so local previews mirror production behavior.

### Dashboard Implementation Sprint (2026-03-18T045148Z)
- Completed the local dashboard foundation: board/detail APIs, shared preview wiring, package scripts, documentation, and an initial validation check run.
- Routed preview rendering through `shared/substack-prosemirror.mjs` so the detail preview matches the canonical article rendering, and surfaced the dossier tab content.
- Captured Editor's validation integration requirements (child-process execution, auth isolation, result contract) while auditing the latest dashboard flows.

📌 Team update (2026-03-18T045148Z): Dashboard validation actions must spawn `validate-substack-editor.mjs` and `validate-stage-mobile.mjs` as child processes, keep credentials internal, and report results/logs via polling or SSE — decided by Editor

### Notes Card Render Fix & URL Backfill Verification (2026-03-17T16:28Z)
**Status:** ✅ LOGGED — Session artifacts captured by Scribe
- Backfilled `substack_url` for `seahawks-rb1a-target-board` and `witherspoon-extension-cap-vs-agent`, then replaced the five broken stage-review Notes so they include the new link-marked bodies.
- Documented the `parseNoteInline()` helper that wraps inline URLs in ProseMirror link marks and linked the resulting Lead decision with Joe’s article-card directive.
- Coordinator verification confirmed pipeline.db now stores the live `/p/` URLs and the `parseNoteInline()` change yields card-able payloads, so cards remain durable across future Notes postings.

### Notes workflow consolidation (2026-03-17 to 2026-03-18)
- Selected `jsn-extension-preview` as the Phase 2 Notes target and preserved the stage draft URL for Joe's review before any production posting.
- Reframed the Notes rollout toward shorter card-first bodies, with explicit ProseMirror link marks for article-card rendering and payload-level attachments for images.
- Posted five stage review Notes on nfllabstage pointing at production `/p/` URLs, then replaced the broken plain-link versions once the link-mark root cause was confirmed.
- Durable follow-through: missing `substack_url` values can be backfilled from the production archive API, and stage/prod draft URLs should be tracked separately to avoid future provenance drift.
- **Issue #75 landed on main (2026-03-17):** PR #77 merged `feature/mobiletable` → `main` (merge commit 477d7b8). Issue #75 auto-closed. All dual-render mobile table work now in production codepath. Stage draft validated at nfllabstage prior to merge. Traceability comment posted on issue. Learning: `Closes #N` in PR body auto-closes issues on merge — no manual close needed.
- **Waddle trade article issue created (2026-07-26):** Issue #78 — "Article: DEN/MIA — The Jaylen Waddle Trade — Denver's Bold Bet, Miami's Full Reset". Confirmed trade fact-checked via ESPN/CBS/SI before issue creation. Dual-team article (DEN primary, MIA secondary). Labels: article, squad, squad:lead, go:yes. Lead posted kickoff comment advancing to Stage 2. Key learning: for trade-reaction articles, fact-check the trade details via web search BEFORE creating the issue — confirmed trades get a real angle, not the generic "IDEA GENERATION REQUIRED" template. Also: PowerShell here-strings (`@"..."@`) eat `$` signs as variable interpolation — use plain strings or escape them.
- **Issue #78 — Full pipeline execution (2026-07-26):** Ran Stages 2→7 end-to-end in a single session. 4-agent panel (Cap, DEN, MIA, Offense) on `claude-opus-4.6`. Writer produced ~3,100 words. Editor caught two 🔴 errors: "three 1,000-yard seasons" should be four (per article's own data table — appeared 4 times), and a Saints historical comp that conflated Thomas/Henderson eras. Both fixed. Three dense tables simplified to pass the publisher's inline density blocker (4+ column tables with numeric/comparison headers like "Cap Hit" and "Guaranteed" trigger the threshold). Published to prod: `https://nfllab.substack.com/publish/post/191309007`. Key learnings: (1) Dense table blocker catches tables with "Cap Hit" or "Guaranteed" headers + 2+ numeric columns — simplify to ≤3 columns or render to PNG. (2) For dual-team trade articles, the Panel Composition Matrix recommends: Cap + Team(acquiring) + Team(trading) + scheme specialist — this produced excellent structured disagreement. (3) `.env` must be copied to worktrees — it doesn't inherit from the main repo.
- **Issue #78 — Missing image fix (2026-07-26):** Root cause: image generation step was skipped during the original single-session pipeline run (Stages 2→7). The `generate_article_images` tool was never called — draft went straight from Writer → Editor → Publisher with zero images. Fix: generated 2 inline images via Gemini 3 Pro Image API (hero-safe inline-1 at 999KB, editorial inline-2 at 706KB), inserted references at lines 23 and 125 in draft.md, republished to existing prod draft 191309007 via PUT (images uploaded to Substack CDN, ProseMirror body rebuilt with `captionedImage` nodes). Verified both S3 URLs return HTTP 200. The `batch-publish-prod.mjs` script skips articles that already have prod drafts (unless slug === "den-2026-offseason"), so a one-off Node.js script was needed to force-update. Key learning: **Image generation is a mandatory step between Stage 5 (Writer) and Stage 6 (Editor).** The pipeline must not skip it. When running all stages in a single session, explicitly call `generate_article_images` after the draft is saved. The Editor review's "No images present" note should have been treated as a pipeline gap, not an expected state.
- **Issue #78 — Stage 8 closeout (2026-07-27):** Joe confirmed the Waddle trade article is live. Closeout: (1) pipeline.db updated to Stage 8 / `published` with `published_at` timestamp and stage_transition record; (2) GitHub issue #78 closed with `stage:published` label and closing comment; (3) `article-ideas.md` updated to reflect published status; (4) NYJ follow-on issue #79 created ("Two Bites at the Apple — Jets #2 and #16") — the piece teased in the Waddle article footer. NYJ article already at Stage 3 in pipeline.db (`nyj-two-firsts-qb-decision`). Key learning: Stage 8 closeout checklist = DB writeback + stage_transition + issue close + label + follow-on issue + article-ideas.md update.
### Notes Card Render Fix + URL Backfill Logged (2026-03-17)
- Scribe merged the Lead decision for published-URL backfill + Note card-render fix into `decisions.md`, cleared the decision inbox, and recorded the session artifacts under `.squad/log/` and `.squad/orchestration-log/`.
- Shared memory now reflects the durable rule: Note URLs need ProseMirror link marks for article-card rendering, and missing `substack_url` values can be backfilled from the production archive API.

## Summarized Sessions (2026-03-17 and Earlier)

> Condensed by Scribe on 2026-03-19T02:20:14Z. Detailed session notes for Dashboard (2026-03-18), Notes workflow (2026-03-17/18), and earlier work preserved in `history-archive.md`.

Sessions archived:
- Dashboard Implementation Session (2026-03-18T04:48Z) — Dashboard architecture, source-map audit, shared preview wiring
- Dashboard Implementation Sprint (2026-03-18T045148Z) — Dashboard foundation completion, validation integration
- Notes Card Render Fix & URL Backfill Verification (2026-03-17T16:28Z) — ProseMirror link marks, URL backfill
- Notes workflow consolidation (2026-03-17 to 2026-03-18) — Card-first bodies, stage → prod pattern, Issue #75 mobile table, Issue #78 Waddle article (full pipeline), Issue #79 NYJ follow-on
- Notes Card Render Fix + URL Backfill Logged (2026-03-17) — Scribe merge of published-URL decision
- Stage vs. Production Notes Lifecycle Pattern (2026-03-18) — Stage as temporary review artifacts, prod as permanent engagement
- Production Notes Rollout — All 12 Articles (2026-03-18) — 12 promotion Notes posted to prod (IDs 229406564–229406730)
- Stage Note Retry — Idempotent Cleanup (2026-03-18) — 5-note repost, article-card rendering
- Stage-review note retry logged (2026-03-17T17:07Z) — Attachment-backed flow verification
- Stage Notes Cleanup Scope (2026-03-18) — Cleanup go/no-go checks, delete patterns, cleanup list scope
- Stage Teaser Posted + Stage Cleanup Executed (2026-03-18T02:30Z) — Teaser c-229449096 posted + protected, 12 superseded notes marked deleted, DELETE endpoint fixed
- Post-Stage-7 Cleanup Scope Verification (2026-03-18T02:24:01Z) — Team updates, 10 decision merges, orchest logs
- Stage 7 Teaser Flow Disabled (2026-03-18) — Deprecate post-stage-teaser.mjs, remove MISSING_TEASER, teaser deletion (endpoint fix)
- Local Pipeline Dashboard (2026-03-17T21:23Z) — Zero-dependency Node server, JS stage-inference, markdown preview, routes/tabs
- nflverse Platform-Fit Review (2026-03-19) — *See Recent Sessions for full details*

## Recent Sessions

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

### nflverse Platform-Fit Review (2026-03-19)
- **Research report reviewed:** Backend's 5-tier nflverse integration proposal (Tiers 0–5: Foundation → Gameday Review). Report at `session-state/.../research/i-want-to-add-another-expert-for-more-advanced-dat.md`.
- **Key decision:** Approve Tiers 0 + selective Tier 1 now. Defer Tiers 2–5 until Phase 1 publishing goals are met. Decision filed at `.squad/decisions/inbox/lead-nflverse-platform-fit.md`.
- **Analytics vs. DataScience:** Extend Analytics (add data access) — do NOT create DataScience agent yet. Analytics' charter already owns the analytical domain; it lacks access, not scope. Split only when code-writing demands exceed what pre-built query scripts can serve.
- **Pipeline integration point:** Stage 2 discussion prompt Data Anchors. Query scripts replace hand-assembled web-scraped tables. No schema changes, no new pipeline stages needed.
- **Risks flagged:** Python+Node dual-runtime management, offseason data is static (limits near-term uplift), token cost of large data tables in 1,500-token panel budget, ~300MB parquet cache needs `.gitignore`.
- **Quick wins:** `requirements.txt`, `content/data/fetch_nflverse.py`, `.squad/skills/nflverse-data/SKILL.md`, Analytics charter PFR→nflverse update, 2–3 query scripts (`query_player_epa.py`, `query_team_efficiency.py`, `query_positional_comparison.py`).
- **Platform bottleneck today:** Publishing and audience validation, not data sophistication. Content quality upgrades matter but shouldn't distract from getting articles live.

### nflverse Detailed Implementation Plan (2026-03-19)
- **Upgraded research → plan:** Converted the 5-tier nflverse research report into an execution-ready implementation plan with phased rollout (Phase A/B/C), concrete deliverables per step, file locations, validation checkpoints, risk register, and dependency sequencing.
- **Phase A = build-ready:** 6 steps (Python env → fetch script → 3 query scripts → SKILL.md → Analytics charter patch → smoke test). Capped at 2-3 sessions. Gate: first article uses real nflverse data in a discussion prompt.
- **Phase B = on-demand:** 4 more query scripts + first published article with nflverse-sourced stats. Triggered after Phase A proves out.
- **Deferred tiers (C+):** Each tier now has an explicit entry trigger (Analytics bottleneck, 2+/week article cadence, regular season start). No premature investment.
- **Decision filed:** `.squad/decisions/inbox/lead-nflverse-detailed-plan.md`
- **Open questions flagged:** Python version requirement, cache warm-up scope (2025 only vs. 2020-2025), FTN charting copyleft license, DVOA gap in nflverse.
- **Key constraint:** Phase A must not delay next article publication. If it blocks article production, stop and reassess.

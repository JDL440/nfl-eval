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

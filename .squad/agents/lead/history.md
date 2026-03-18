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

## Learnings

### Stage vs. Production Notes Lifecycle Pattern (2026-03-18)
- Stage Notes are **always temporary review artifacts** — posted for Joe's editorial review on nfllabstage, then deleted after approval
- Production Notes are **permanent engagement tools** — posted to nfllab.substack.com after Joe approves stage batch, kept live indefinitely
- Pattern: Post to stage → Joe reviews → Delete stage → Post to production (if approved)
- Reusable scripts: `retry-stage-notes.mjs` (delete + repost), `delete-notes-api.mjs` (cleanup), `publish-prod-notes.mjs` (production posting)
- Decision history lives in `.squad/decisions/inbox/lead-notes-lifecycle-pattern.md` (to be created for future reference)

### Production Notes Rollout — All 12 Articles (2026-03-18)
- Posted 12 production promotion Notes to nfllab.substack.com using card-first mechanism (registerPostAttachment + attachmentIds). Note IDs: 229406564–229406730.
- Reused approved stage-review teaser copy; lightly improved den-mia-waddle-trade and welcome-post teasers that were placeholder-short.
- Script: `publish-prod-notes.mjs` — adapted from `retry-stage-notes.mjs` but targets PROD (SUBSTACK_PUBLICATION_URL), has no delete phase, and reuses a single Playwright browser session across all 12 posts for speed.
- pipeline.db notes table: 12 new rows (IDs 18–29) with target='prod', preserving stage rows (6–17) as audit trail. Both stage and prod notes coexist per article.
- Key pattern: `registerPostAttachment()` does NOT require CF bypass — plain fetch works. But the `POST /api/v1/comment/feed` (note creation) DOES require Playwright browser context to pass Cloudflare.
- 1.5s delay between posts prevents rate limiting. Full batch ran in ~90s.
- Results JSON: `publish-prod-notes-results.json`. Decision: `.squad/decisions/inbox/lead-prod-notes.md`.

### Stage Note Retry — Idempotent Cleanup (2026-03-18)
- Previous note batch (229384944–229385077) returned HTTP 404 on delete — they were already cleaned up in an earlier session. DELETE on non-existent notes is harmless (not 500-class).
- Fresh 5-note batch posted with `registerPostAttachment()` + `attachmentIds` on nfllabstage. All 5 rendered article cards (hero image + NFL Lab logo + title). Verified via web fetch on c-229399257.
- The `retry-stage-notes.mjs` script is a parameterized fork of `replace-stage-notes-v2.mjs` — change the `PREVIOUS_NOTES` array to target any batch. Two-phase (delete-all-first, then post-all) avoids interleaving failures.
- Pipeline.db `notes` table updated with new URLs in-place (same row IDs 6–10, new `substack_note_url` values).
### Stage-review note retry logged (2026-03-17T17:07Z)
- Reran the nfllabstage stage-review Notes through the attachment-backed article-card flow and confirmed the five replacements render as cards.
- Durable architecture recorded in .squad/decisions.md under 2026-03-18: Stage-Review Note Retry — Two-Phase Delete-then-Post; orchestration trace saved at .squad/orchestration-log/20260317T170758Z-lead.md.

### Stage Notes Cleanup Scope (2026-03-18)
- `python content/article_board.py notes-sweep --json` is the go/no-go check for Notes cleanup timing. Current state still shows `witherspoon-extension-v2` at Stage 7 with `MISSING_TEASER`, so stage-note cleanup should wait until that teaser is posted to nfllabstage.
- Once a matching prod promotion Note exists, the stage Note itself is disposable review residue — delete the external nfllabstage Note, but keep both stage and prod `pipeline.db` rows plus `publish-prod-notes-results.json` as the audit trail.
- Current first-pass cleanup list is the 12 live nfllabstage Note IDs `229399257, 229399279, 229399303, 229399326, 229399346, 229402275, 229402289, 229402302, 229402322, 229402343, 229402254, 229402366`; each already has a paired prod Note row (`18`–`29`).
- `delete-notes-api.mjs` is still the referenced cleanup mechanism in decisions/history, but it is absent from the current working tree. Restore or recreate that delete-only helper before executing stage-note cleanup.

### Post-Stage-7 Cleanup Scope Verification (2026-03-18T02:24:01Z)
- 📌 **Team update:** Verified stage teaser status and documented reusable Notes lifecycle pattern. Stage review batch (5 articles, IDs 229399257/279/303/326/346) is **PENDING Joe's review** on nfllabstage. Production promotion batch (12 articles, IDs 229406564–229406730) is **already live** on nfllab.substack.com. Cleanup is safe after Joe approves. Merged 10 decision artifacts into `.squad/decisions.md` covering: Stage vs. Production Notes lifecycle, Production rollout execution, Full backlog coverage, Cleanup scope + archival recommendations, Telemetry infrastructure design, and Production conventions. Orchest ration logs created at `.squad/orchestration-log/{timestamp}-lead.md` and `.squad/orchestration-log/{timestamp}-writer.md`. Session log created at `.squad/log/2026-03-18T02-24-01Z-notes-cleanup-scope.md`.

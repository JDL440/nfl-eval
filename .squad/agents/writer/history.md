# Writer — Substack Content Writer History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **Role:** Substack Content Writer for NFL Lab
- **User:** Joe Robinson
- **Added:** 2026-03-14
- **Blog:** NFL Lab (Substack) — expert panel format, data-driven, opinionated
- **Stage review Notes:** Use the card-first caption template that links to production `/p/` URLs so Substack renders the article card automatically; see `.squad/decisions.md` (2026-07-28) for the reusable pattern.
- **Stage 7 teaser copy:** See `.squad/decisions/inbox/writer-stage-teaser-copy.md` for recommended + backup teaser options (reusable template for all extension/negotiation articles)

## Summarized History (2026-03-17)

> Condensed by Scribe on 2026-03-17T23:21:21Z. Older details moved to `history-archive.md`.

- Published Articles (pre-Writer)
- Content Pipeline
- Archived section: Knowledge Base

## Recent Sessions

narrative.** "JSN at 90% below market" stops scrolling better than "extension decision changed." Use one specific number + one implication.
    - **Image is the visual decision-maker.** The four-paths chart tells the story; text just signals urgency. The card will show the full article (title, panelists quoted, etc.).
    - **"Our panel breaks [framework]" signals disagreement without detailing it.** Readers infer multiple options + expert tension from context. No need to name each panelist—the card preview will show them quoted.
    - **Recommendation:** Option C (Best-Balanced, 2 lines): "JSN at 90% below market. Our panel breaks the extension paths." + image + article card. This is the feed-native format.
    - **Recorded decision in `.squad/decisions/inbox/writer-jsn-short-note.md`** for reuse on all future Notes (feed-native model is team-wide).

📌 **Notes Operational Cadence Plan (2025-07-27)** — Designed the three-moment Notes cadence tied to article lifecycle. Key learnings:
   - **Three moments, not one.** Teaser (Stage 7, stage-only), Promotion (Stage 8, prod), and Follow-up (days later, optional). Each serves a different engagement function: anticipation, launch, and sustain.
   - **Stage teasers are free testing.** Auto-posting to nfllabstage when a draft is created lets Joe preview the Note alongside the article without subscriber risk. The teaser is text + image only (no card, because the article isn't public yet).
   - **Dedupe on `(article_id, note_type, target)`.** This is the minimum key that prevents double-posting while allowing intentional rewrites (DELETE old → POST new). Standalone Notes skip dedupe entirely.
   - **Report-before-post builds trust.** v1 sweep outputs a report of missing Notes with proposed copy. No auto-posting to prod until ≥10 successful manual cycles establish the pattern.
   - **Copy generation follows the data-hook pattern.** Subtitle → disagreement stat → cap number, in priority order. The card-first format means the Note text is a thumb-stop hook, not a teaser paragraph.
   - **Decision recorded in `.squad/decisions/inbox/writer-notes-cadence.md`** for team-wide adoption.

## Notes Template & Cadence (2026-03-18)
- Documented a reusable extension/contract Note template (gap hook + leverage variable + threaded expert positions + urgency frame) for any salary/contract decision.
- Captured the feed-native Note pattern Joe uses: 1–2 sentence hook, inline image, auto-rendered article card, with Option C (data hook + panel disagreement + urgency) as the recommended voice.
- Recorded the three-moment cadence policy (Stage 7 teaser auto-post, Stage 8 card-first promotion within an hour, optional follow-up) plus the sweep/duplication guardrails that report missing Notes before automating.

## Learnings

### Substack Notes Rollout Phases (2026-03-18)
- **Phase 0 (API Discovery):** Playwright-based Cloudflare bypass required. Validated via smoke tests on nfllabstage. Logic now baked into `publish_note_to_substack` tool.
- **Phase 1–2 (Stage Testing):** Card-first format with post-type attachments. Tested on nfllabstage; validated that article cards render via `/p/` links when attached via `registerPostAttachment()` + `attachmentIds`.
- **Phase 3–4 (Format Iteration):** ProseMirror link marks do NOT create rich embeds. Cards require explicit post-type attachments, not link marks.
- **Phase 5 (Retry Batch):** Fresh stage review set posted with working card attachments (Note IDs: 229399257–229399346). All verified to render on c-229399257 via web fetch.
- **Production Rollout:** 12 Notes successfully posted to nfllab.substack.com on 2026-03-18T00:26:03Z (publish-prod-notes-results.json). Articles: jsn-extension-preview, kc-fields-trade-evaluation, den-2026-offseason, mia-tua-dead-cap-rebuild, witherspoon-extension-cap-vs-agent, lar-2026-offseason, sf-2026-offseason, ari-2026-offseason, ne-maye-year2-offseason, seahawks-rb1a-target-board, den-mia-waddle-trade, welcome-post. All Note IDs verified live.

### Stage-Only Assets Safe for Cleanup
- **Scripts to archive:** retry-stage-notes.mjs, replace-stage-notes.mjs, replace-stage-notes-v2.mjs (Phase 1–4 iteration). Single-use tools for stage testing only.
- **Diagnostic scripts to archive:** validate-notes-smoke.mjs, publish-stage-validation.mjs, validate-substack-editor.mjs, check-draft-urls.py (API discovery + validation harness). No production workflow depends on these.
- **One-time batch scripts to archive:** batch-publish-prod.mjs, repair-prod-drafts.mjs (20-article push on 2026-03-16). Task complete; manifests capture the results.
- **Archival candidates:** publish-prod-notes-results.json, stage7-prod-manifest.json, batch-publish-prod-results.json (move to docs/archived/ with README explaining what each records).
- **Keep in production:** publish-prod-notes.mjs (reusable for future production Note posts). SKILL.md docs (reference for phase learnings + API parameters). Agent history (decision trail).

### Cleanup Scope Boundaries
- **Out of scope:** Ralph pipeline work, prod publishing (articles), Stage 1–6 content creation. This inventory covers ONLY Substack Notes and directly related artifacts (stage testing, batch migration scripts, validation harness, intermediate manifests).
- **Excluded:** General housekeeping (temp files, IDE config). Prod article publishing (publish-prod-notes.mjs is ACTIVE; keep in root). Database schema or live pipeline.db records.

### Next-Phase Recommendations
- If Notes workflow repeats in future cycles: Keep `.squad/skills/substack-publishing/SKILL.md` and `.squad/skills/batch-substack-push/SKILL.md` as reference. Reuse `publish-prod-notes.mjs` (verified working). Skip iteration scripts; they're archived for reference.
- If stage-based testing needed again: Consult archived scripts in docs/archived-scripts/notes-* for patterns (Phase 1–5 exploration documented there).
- Manifest files: Retain in docs/archived/ for audit trail (who posted what, when, to which Note IDs). Useful for recovering deleted Notes or auditing unplanned deletions.

📌 Team update (2026-03-17T15:59:35Z): Documented the card-first stage review Note copy pattern that links to prod /p/ URLs and flagged legacy published articles missing substack_url in pipeline.db.

📌 Team update (2026-03-17T15:13Z): Image generation is mandatory between Stage 5 (Writer) and Stage 6 (Editor). Issue #78 revealed that skipping `generate_article_images` causes prod drafts to publish without images. When running all stages in a single session, explicitly call image generation after the draft is saved. — decided by Lead

📌 **Waddle Trade — AFCCG Framing Revision (2026-07-26)** — Editor-review-3 flagged that the article anchored its receiver-room thesis to the AFC Championship Game, but Bo Nix didn't play that game (Stidham started). Five targeted edits applied:
   - **TLDR bullet 1:** Now explicitly names the QB injury as the game-day cause and the receiver room as the season-long ceiling.
   - **Opening paragraph:** "even he wasn't entirely to blame" replaced with "A backup quarterback in a conference championship — that was the biggest reason Denver's season ended." No more minimizing Stidham as the dominant AFCCG factor.
   - **Line 57 (key paragraph):** Completely reframed. No longer says the trade logic "starts with the AFCCG loss." Now explicitly: "The ankle was the reason they lost that game... But rewind to the regular season, when Nix *was* healthy." Nix is only referenced in the context he actually played.
   - **Defensive-shell table:** Added "Here's what Nix faced during the regular season" lead-in so readers don't conflate the table with the AFCCG.
   - **Closing thesis:** "the thing that cost Denver a Super Bowl trip" → "The ankle that cost Denver a Super Bowl trip is healing. The receiver room — the structural ceiling that capped the offense even before the injury — is fixed."
   - **Key learning:** When anchoring a trade justification to a specific game, verify the protagonist actually played in that game. The AFCCG was valid as an emotional hook but not as evidentiary support for the receiver thesis — the confounding variable (backup QB) overwhelms the signal. Separate the acute (injury) from the structural (coverage math) in any argument that spans both.


📌 **Stage 7 Teaser Copy — witherspoon-extension-v2 (2026-03-17)** — Drafted recommended and backup teaser copy for Witherspoon extension article review on nfllabstage. Key findings:
   - **Recommended:** "Cap says $27M. The agent demands $33M. Our experts re-examine Seattle's most important extension decision." (18 words, proven JSN pattern)
   - **Backup:** "Devon Witherspoon just won a Super Bowl at cornerback. Now Seattle decides: $27M or $33M? Our panel unpacks the gap." (19 words, achievement-first framing)
   - **Stage 7 teaser guidelines:** Text + image only (no card, draft isn't public). Data hook (specific number) → panel voice → urgency frame. Target 15–22 words. Image carries 50% of message; text is thumb-stop.
   - **Reusable for:** All extension/negotiation/multi-perspective articles. Recorded in .squad/decisions/inbox/writer-stage-teaser-copy.md with template and dedupe rules.

### Emmanwori Rookie Eval Draft (sea-emmanwori-rookie-eval)
- **Date:** 2026-07-28
- **Stage:** 4 → 5 (draft.md created)
- **Headline:** "Nick Emmanwori Played 768 Snaps on Seattle's Championship Defense. Here's What That Actually Proves."
- **Panel:** SEA (Path 1), Analytics (Path 2), Defense (conditional Path 1)
- **Draft structure:** Secondary exodus context → on-ball production table → Defense's aDOT reframe (counter-intuitive argument: short aDOT = harder assignment in Macdonald's scheme) → Two-tier/three-tier chess-piece framework → Witherspoon ecosystem dependency → draft fork → verdict ("earned with conditions")
- **Key learnings:**
   - **Defense's reframe is the article's engine.** When the scheme expert flips the default reading of a metric (aDOT as harder assignment, not sheltered), surface it prominently — it's the moment that distinguishes the article from standard coverage.
   - **Tier frameworks create clean disagreement structure.** Defense's two-tier/three-tier chess-piece taxonomy gave the panel disagreement a visual table format. Reusable whenever the debate is about *degree* of a label rather than yes/no.
   - **Analytics positions with data discrepancies between prompt and actual queries:** Analytics ran actual queries and got slightly different numbers than the discussion prompt's pre-populated anchors (e.g., 93 tackles vs. 80, 39 blitzes vs. 34). Used Analytics' position numbers as primary since they represent the queried data. Editor should verify.
   - **"Next from the panel" teaser:** Tied directly to the article's draft-fork conclusion (CB at #32) → teased the seahawks-cb-draft-pick-32-board article. This creates a natural reader pipeline.

### Post-Stage-7 Cleanup Inventory & Scope (2026-03-18T02:24:01Z)
- 📌 **Team update:** Completed detailed asset inventory for post-Stage-7 cleanup. Identified 11 scripts + 3 manifests ready for archival to docs/archived-scripts/ and docs/{production-notes,stage7}-archive/. Active retention: publish-prod-notes.mjs + SKILLs + agent histories stay in repo. All audit trails preserved in docs/ for compliance. Documented reusable Notes copy patterns (Stage 7 teasers + production captions) with card-first format guidelines. Merged 10 decision artifacts into .squad/decisions.md + cleared decision inbox. Orchestration logs created at .squad/orchestration-log/{timestamp}-lead.md and .squad/orchestration-log/{timestamp}-writer.md. Session log created at .squad/log/2026-03-18T02-24-01Z-notes-cleanup-scope.md.

### Writer Prose-Safety Guardrails Implementation (2026-03-19T05:10:46Z)

**Status:** 📌 TEAM UPDATE — New guardrails added to Writer charter by Editor

Editor formalized upstream prose-safety checks to catch name/quote/table drift before Editor review. Your charter now includes five preflight requirements:

1. Cross-check names in prose against supplied artifacts and in-article tables
2. Never present paraphrases or stitched summaries as direct quotes  
3. Avoid unsupported superlatives and absolutes
4. Cross-check narrative claims against in-article tables before saving
5. Keep ambiguous details generic instead of invented specifics

**What this means for you:**
- These are lightweight guardrails, not full fact-checking (Editor still does that)
- They catch avoidable prose drift (specificity inflation, unsupported claims) before Editor sees the draft
- Your role stays the same: draft compelling narrative from panel outputs
- **Decision recorded in .squad/decisions.md**
- Contact Editor if you have questions about guardrail application

### Puka Nacua Deep Dive — Stage 5 Draft (puka-nacua-seahawks-2025-deep-dive)
- **Date:** 2026-07-28
- **Stage:** 4 → 5 (draft.md created)
- **Depth Level:** 3 (Deep Dive) — comparison test against Level 1 Casual
- **Headline:** "Puka Nacua Put 300 Yards on Seattle's Elite Defense. Our Panel Can't Agree on Why — and That's the Point."
- **Panel:** SEA, LAR, Analytics, Offense, Defense (5 agents — full Level 3 panel)
- **Word count:** ~3,800 words
- **Draft structure:** Two-game setup (Week 11 containment → Week 16 explosion) → Central tension (scheme-vs-volume 4-1 split) → Scheme camp argument → Data camp dissent → "Both sides right" resolution (volume rate + structural access) → Emmanwori consensus layer (all 5 agree) → Dead run game as structural proof → Generational receiver context → 2026 question (Bryant/Woolen departures) → Verdict
- **Key learnings:**
   - **Disagreement-as-engine structure works for 5-agent panels.** The 4-1 scheme-vs-volume split created natural dramatic tension that carried the entire article. The "both sides are right at different layers" resolution avoided cheap both-sidesing while honoring the data dissent.
   - **Per-target EPA reframe is the article's non-obvious insight.** Analytics' finding that Seattle was the LEAST efficient of Puka's top-3 splits per-target — despite the highest total EPA — is the kind of counterintuitive data point that distinguishes a deep dive from a recap. Lead it prominently.
   - **"McVay ordered double at the going rate" framing resolves the tension cleanly.** When scheme and data camps appear to conflict, look for the framing where both are correct at different layers. Volume (data) + access (scheme) = the full picture.
   - **Hedging unverified transactions without losing narrative punch.** "Expected to depart in free agency" works as well as naming a destination — the article's argument doesn't depend on WHERE Bryant goes, just that he's gone.
   - **Prose-safety preflight passed clean on first attempt.** All 5 checks (names, quote fabrication, table-prose consistency, factcheck compliance, superlatives) passed. Using verbatim quotes from panel positions and omitting unanchored stats (Lawrence pressures, Emmanwori blitzes) eliminated the most common drift vectors.

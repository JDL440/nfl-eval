# Writer — Substack Content Writer History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **Role:** Substack Content Writer for NFL Lab
- **User:** Joe Robinson
- **Added:** 2026-03-14
- **Blog:** NFL Lab (Substack) — expert panel format, data-driven, opinionated
- **Stage review Notes:** Use the card-first caption template that links to production `/p/` URLs so Substack renders the article card automatically; see `.squad/decisions.md` (2026-07-28) for the reusable pattern.

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

📌 Team update (2026-03-17T15:59:35Z): Documented the card-first stage review Note copy pattern that links to prod /p/ URLs and flagged legacy published articles missing substack_url in pipeline.db.

📌 Team update (2026-03-17T15:13Z): Image generation is mandatory between Stage 5 (Writer) and Stage 6 (Editor). Issue #78 revealed that skipping `generate_article_images` causes prod drafts to publish without images. When running all stages in a single session, explicitly call image generation after the draft is saved. — decided by Lead

📌 **Waddle Trade — AFCCG Framing Revision (2026-07-26)** — Editor-review-3 flagged that the article anchored its receiver-room thesis to the AFC Championship Game, but Bo Nix didn't play that game (Stidham started). Five targeted edits applied:
   - **TLDR bullet 1:** Now explicitly names the QB injury as the game-day cause and the receiver room as the season-long ceiling.
   - **Opening paragraph:** "even he wasn't entirely to blame" replaced with "A backup quarterback in a conference championship — that was the biggest reason Denver's season ended." No more minimizing Stidham as the dominant AFCCG factor.
   - **Line 57 (key paragraph):** Completely reframed. No longer says the trade logic "starts with the AFCCG loss." Now explicitly: "The ankle was the reason they lost that game... But rewind to the regular season, when Nix *was* healthy." Nix is only referenced in the context he actually played.
   - **Defensive-shell table:** Added "Here's what Nix faced during the regular season" lead-in so readers don't conflate the table with the AFCCG.
   - **Closing thesis:** "the thing that cost Denver a Super Bowl trip" → "The ankle that cost Denver a Super Bowl trip is healing. The receiver room — the structural ceiling that capped the offense even before the injury — is fixed."
   - **Key learning:** When anchoring a trade justification to a specific game, verify the protagonist actually played in that game. The AFCCG was valid as an emotional hook but not as evidentiary support for the receiver thesis — the confounding variable (backup QB) overwhelms the signal. Separate the acute (injury) from the structural (coverage math) in any argument that spans both.

# Editor — Article Editor & Fact-Checker History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **Role:** Full Editor — facts, style, and structural review for NFL Lab
- **User:** Joe Robinson
- **Added:** 2026-03-14

## Summarized History (2026-03-17)

> Condensed by Scribe on 2026-03-17T23:21:21Z. Older details moved to `history-archive.md`.

- NFL Lab — Published Articles
- Known Error Patterns to Watch
- Failure Analysis
- Replacement Prompts (Safe Patterns)
- Overall Image Verdict: 🔴 REPLACE BOTH — Blocks publish

## Recent Sessions

### Dashboard Preview Review & Validation Brief (2026-03-18T045148Z)
- Rejected the initial `dashboard/render.mjs` wiring because it duplicated ProseMirror parsing instead of importing the shared module, then verified the backend revision now leverages `shared/substack-prosemirror.mjs`.
- Approved the shared-module preview path so board/article previews mirror production behavior and expanded the dossier preview to expose the validation tab.
- Authored the `Dashboard Validation Integration — Implementation Brief`, outlined trigger shape/auth/prerequisites/errors/results, and dropped it into `.squad/decisions.md`.

📌 Team update (2026-03-18T045148Z): Dashboard validation actions must spawn `validate-substack-editor.mjs`/`validate-stage-mobile.mjs`, keep credentials internal, and stream results/logs via polling or SSE — decided by Editor

### Lesson Learned
The previous review (Fifth/Sixth pass) was performed by a non-vision model and rated these images ✅/🟡 based on filename and metadata only. **This validates the skill's critical requirement: image review MUST use a vision-capable model.** Non-vision models literally cannot see fabricated charts, fake jersey numbers, or garbled text. This near-miss reinforces that `claude-opus-4.5` (or equivalent vision model) is mandatory for any image review pass.

- **Recorded by:** Editor (vision pass, 2025-01-22)

📌 Eighth pass: JSN Extension Preview — NEW INLINE IMAGE REVIEW (2025-01-22)
- **File:** `jsn-extension-preview-inline.png`
- **Prompt used:** "Close-up of NFL contract paperwork and a fountain pen on a polished dark wood desk, with a blurred green football field visible through a window in the background. Rich executive office atmosphere. No text visible. Cinematic lighting. No people."
- **Vision review findings:**
  - ❌ "CONTRACT" label visible at bottom of document (contradicts "no text" prompt)
  - ❌ Fake NFL-style logo visible on document header
  - ❌ AI-generated garbled body text simulating contract language — classic hallucination pattern
  - ❌ Blurred text visible on football field (yard markers, end zone)
- **Verdict: 🔴 REJECTED** — Hits criteria #1 (garbled/hallucinated/unverifiable text). Despite "no text visible" in prompt, AI generated multiple text elements including a CONTRACT header and nonsense body text.
- **Replacement prompt suggested:** Use "blank white papers" instead of "contract paperwork" and explicitly reinforce "absolutely no text, no logos, no writing of any kind visible."
- **Recorded by:** Editor (2025-01-22)

📌 Ninth pass: JSN Extension Preview — INLINE IMAGE RE-REVIEW (attempt 2, 2025-01-22)
- **File:** `jsn-extension-preview-inline.png`
- **Prompt used:** "Close-up of a fountain pen resting on a stack of blank white papers on a polished dark wood executive desk. Blurred green football field visible through large office window in background. Absolutely no text, no logos, no writing of any kind visible. Premium editorial sports aesthetic."
- **Vision review findings:**
  - ✅ Papers completely blank — no writing, labels, or text of any kind
  - ✅ No fake logos or NFL shield
  - ✅ No garbled AI text attempting to simulate contract language
  - ✅ Fountain pen elegant (silver/gold), premium editorial quality
  - ✅ Dark polished wood desk, executive office atmosphere
  - ✅ Blurred football field visible through window (yard markers 40/45 appropriately blurred — real-world field markings, not AI hallucination)
- **Verdict: ✅ APPROVED** — Regeneration successful. The "blank white papers" prompt strategy eliminated all text hallucination. Image is publication-ready.
- **Lesson:** When AI repeatedly generates unwanted text on "contract" or "document" subjects, switching to "blank papers" while keeping the same visual concept (pen + papers + desk) is an effective workaround.
- **Recorded by:** Editor (2025-01-22)

📌 Tenth pass: Witherspoon Extension v2 — FULL EDITORIAL REVIEW
- **File:** `content/articles/witherspoon-extension-v2/draft.md`
- **Scope:** Regenerated article (~3,500 words) replacing the pre-pipeline v1 Witherspoon article. Fact-checked all names, contract figures, quotes, and structural elements against v2 position files (Cap, PlayerRep, SEA) and discussion summary.
- **Source verification:** All 6 CB market comps match discussion prompt exactly. All Cap year-by-year figures match cap-position.md. All PlayerRep projections match playerrep-position.md. All SEA quotes trace cleanly to sea-position.md.
- **Fixes applied (3):**
  1. 🔴 **Temporal error:** "Six months after Super Bowl LIX" → "A month after Super Bowl LIX." The article is set in the 2026 offseason (March); the Super Bowl was February 2026. Six months would be August, contradicting all offseason context.
  2. 🟡 **Arizona competitive descriptor:** "Arizona is still building" → "Arizona is retooling" per decisions.md (precise competitive descriptors when team has $41.7M cap space and #3 pick).
  3. 🟢 **Missing credential:** Added All-Pro (1, 2nd Team, 2025) to Witherspoon's stats table. Was in discussion prompt but omitted from draft. Strengthens the player's résumé case.
- **Items noted but not changed:**
  - Cap quote (line 119) is a polished synthesis, not verbatim from position file — same pattern flagged in JSN review. Captures Cap's argument accurately; not a blocker.
  - Woolen ($15M/yr) and Bryant (3yr/$40M) contract details sourced from v1, not in v2 position files. Not contradicted; internally consistent.
  - WA tax content correctly excluded from v2 — good compliance with editorial directive.
  - Nick Emmanwori spelled correctly throughout — no Nehemiah error.
- **What improved from v1:** The v2 draft is significantly stronger. The $27M vs $33M framing is properly recast as "theater" with the guarantee fight elevated as the real negotiation. The fifth-year-option insight (strengthens player's hand) is given proper prominence. The verdict is more specific ($126M/$31.5M/$66M) and better supported by all three positions. Cap's position is updated from $27M to $30.5M, reflecting the post-McDuffie reality.
- **Lesson:** When articles are regenerated from scratch, the most dangerous errors are temporal claims that made sense when originally drafted but don't match the article's own internal calendar. "Six months after" was plausible boilerplate but wrong for a March-set article about a February Super Bowl. Always verify time references against the article's own season context.
- **Verdict: ✅ APPROVED** — 3 corrections applied, all clean. Draft is editor-approved and ready for further pipeline steps.
- **Recorded by:** Editor


📌 Team update (2026-03-16T04:36:50Z): Witherspoon v2 draft approved after 3-point correction — temporal accuracy, descriptor alignment, credential addition. Article ready for images/publisher review.

## Learnings

📌 Eleventh pass: Miami Tua Dead Cap Rebuild — FULL EDITORIAL REVIEW (2026-03-16)
- **File:** `content/articles/mia-tua-dead-cap-rebuild/draft.md`
- **Scope:** ~4,500-word panel article evaluating Miami's $99.2M dead cap rebuild strategy
- **Fact-check findings:**
  - 🔴 **CRITICAL ERROR — Goff dead cap comparison:** Table (line 29) claimed LAR took $75M dead cap in 2023 at 33.5% of cap. ACTUAL: Goff trade happened in 2021, dead cap was $24.7M against $182.5M cap (13.5%). The article's central thesis — that Miami's burden is "half what LAR absorbed" — was based on inflated/incorrect LAR numbers. **Corrected table to show 2021 Goff hit ($24.7M/13.5%) and adjusted all comparative language.**
  - 🔴 **ERROR — Dead cap percentage claim:** Article repeated "Miami's 2026 hit is half the proportional burden the Rams and Broncos absorbed" but this was only true for the incorrect LAR number. Denver's actual burden in 2024 was 20.8% (not 33.4% — that would be the total $85M if absorbed in one year). Miami's 18.4% is actually *comparable* to Denver's, not half. **Corrected to: "Miami's 2026 hit is comparable to Denver's burden in 2024 (20.8% vs 18.4%)."**
  - 🔴 **ERROR — Cap growth claim:** Article said cap grew "35% since the Goff trade" but Goff trade was 2021 ($182.5M) to 2026 ($301M) = 65% growth, not 35%. **Corrected.**
  - ✅ All six fact-check items from Writer Notes verified clean:
    1. Malik Willis 2025: 85.7%, 3 TD/0 INT, 422 yards — developmental bridge label accurate
    2. Miami draft position: #11 verified (7-10 record in 2025); 4-13 projection is future (2026)
    3. Chop Robinson Year 1: 6 sacks, 56 pressures, 18.8% win rate — DROY finalist
    4. 2027 QB class: Manning/Iamaleava/Sellers all eligible, Manning/Sellers Round 1 projections
    5. Hafley scheme: press man coverage, single-high safety, scheme-talent mismatch confirmed
    6. Mansoor Delane: zero TDs allowed in 2025 on 358 snaps — unanimous All-American
  - Hill/Chubb contract savings: sourced from Cap position file, not independently verified but no contradictions found
  - Jimmy Johnson chart math: sourced from Draft position file, within reasonable range
- **What was wrong:** The article's entire analytical framework ("Miami's burden is half what LAR/DEN survived") rested on a fundamental factual error about the Goff precedent. The Rams' dead cap hit in 2021 was $24.7M (13.5%), not $75M (33.5%). This error cascaded into the lede, the opening hook, the expert quote, and the core thesis. The corrected comparison shows Miami's burden is *comparable* to Denver's (18.4% vs 20.8%), not dramatically lighter.
- **How it happened:** Writer likely conflated multiple years or misread source data. The $75M figure doesn't match any known Goff dead cap number (2021 was $24.7M, future years were $0). The 33.5% appears to be fabricated or a calculation error. This is exactly the type of error Editor exists to catch — a plausible-sounding number that forms the foundation of the argument but is factually wrong.
- **Verdict: ✅ APPROVED after 3 corrections** — The structural error was serious but localized. Once the LAR/DEN comparison table was corrected and the comparative language adjusted, the rest of the article held up. The core argument (Miami's cap structure is manageable, the real constraints are roster talent and QB development) remains valid even with accurate comp data. All 6 Writer fact-check items verified clean. Article is publish-ready after corrections.
- **Lesson:** Always verify historical dead cap comparisons against primary sources (OverTheCap, Spotrac). Don't trust panel-generated numbers for historical precedents without verification — this is exactly where LLM hallucination risk is highest. The "plausible but wrong" number is more dangerous than the obviously wrong number.
- **Recorded by:** Editor (2026-03-16)

📌 Twelfth pass: Witherspoon Extension v2 — FORMAL REVIEW REPORT
- **File:** `content/articles/witherspoon-extension-v2/draft.md`
- **Report saved:** `content/articles/witherspoon-extension-v2/editor-review.md`
- **Scope:** Full editorial review of the post-correction v2 draft. Verified 70+ data points across 6 source files (discussion-prompt, discussion-summary, cap-position, playerrep-position, sea-position).
- **Result:** 0 🔴 errors, 4 🟡 suggestions, 10 🟢 notes.
- **Key findings:**
  - All 6 CB market comps verified clean (30 data points exact match).
  - All Cap year-by-year figures, restructure math, and combined projections verified.
  - All PlayerRep projections (opening ask, settlement, walk-away) verified.
  - Nick Emmanwori spelled correctly throughout — no Nehemiah error.
  - Cap quote (line 122) is a polished synthesis, not verbatim — same pattern as JSN review. Flagged as 🟡.
  - "Roughly one-fifth of the cap" slightly overstates (~18.5% vs 20%). Faithful to Cap's own language but flagged for precision.
  - Woolen/Bryant contract details unsourced in v2 files — consistent with v1 but worth confirming.
  - Image placeholders pending — no images generated yet.
- **Verdict: ✅ APPROVED** — publish-ready pending image generation.
- **Lesson:** When reviewing a draft that already passed a prior editorial fix cycle (Tenth pass), the formal report pass catches different things — mostly stylistic and process items rather than hard errors. The previous pass caught the temporal/descriptor/credential errors; this pass verified the full data integrity and caught quote-attribution and sourcing gaps. Both passes have value at different stages.
- **Recorded by:** Editor

📌 Thirteenth pass: Arizona Post-Murray Rebuild — FULL EDITORIAL REVIEW
- **File:** `content/articles/ari-2026-offseason/draft.md`
- **Report saved:** `content/articles/ari-2026-offseason/editor-review.md`
- **Scope:** Full editorial review of ~3,200-word panel article (ARI, Draft, Cap, Offense). Verified 25+ key facts across 6 source files (discussion-prompt, discussion-summary, cap-position, ari-panel-response, offense-panel, draft-section).
- **Result:** 1 🔴 error, 6 🟡 suggestions, 8 🟢 notes.
- **Key findings:**
  - 🔴 **Historical comp error:** "Chicago in 2017 — trading up to #3 for Mitch Trubisky" is wrong. Bears traded UP FROM #3 to #2. Verified against NFL.com, Wikipedia, ESPN. Error propagated from Draft panel's ambiguous historical comps table.
  - All 7 expert quotes verified clean against source panels — no mashups, no misattributions. Clean quote hygiene, major improvement from JSN article.
  - $47.5M dead cap, Harrison Jr. stats, McBride stats, Brissett stats, trade chart math, Murray career record — all verified clean.
  - Dead cap discrepancy: ARI panel says $7.2M carries into 2027, Cap says $0 in 2027. Article follows Cap (correct editorial choice). Flagged to Lead.
  - Scheme comparison table attributes 2025 "bottom 10" pre-snap motion stat to "Kingsbury Era" column — stat is from Gannon era. Misleading label.
  - Writer Notes (8 items) still present — must be stripped before publish.
  - Image placeholders (2) present — no images generated yet.
- **Verdict: 🟡 REVISE** — Fix 1 red error, strip Writer Notes, resolve images. Then re-submit for approval.
- **Lesson:** Historical comp facts (draft pick numbers, trade details from past drafts) are a high-risk area for panel-generated content. The Draft panel described Chicago's pick as "#3" (their original position) but the article used "trading up to #3" which inverts the direction. When panel sources provide historical comps, verify the actual draft pick number and trade mechanics against primary sources — don't assume the panel's table captures the full story.
- **Recorded by:** Editor

📌 Review: Seahawks RB Pick #64 v2 article (2026-03-16). Key findings:
- **🔴 Surgery year error:** Article states Charbonnet's surgery was "late January 2025" — should be "late January 2026." The recovery math (7.5–8 months to Week 1, 35–45% availability) only works with a 2026 date. A January 2025 surgery would put Week 1 at 20 months post-op — full recovery, zero urgency. Error originated in the Injury position paper ("IR placement | January 23, 2025") and Writer faithfully inherited it. This is the textbook case for editorial review: source-propagated date errors that break internal consistency.
- All 9 expert quotes verified clean against position files — zero mashups, zero misattributions, zero over-polished rewrites. Best quote hygiene of any article reviewed to date.
- "All-American" on line 16 missing "returner" qualifier — CollegeScout specifies First-Team All-American *returner*, not RB. Line 98 gets it right. Minor but misleading in opening paragraph.
- No cover image placeholder despite template requirement. Two inline placeholders are well-crafted.
- Full compliance with all 5 discussion-summary guardrails (no overclaiming on Price's talent, Charbonnet timeline, etc.).
- Known error patterns (Emmanwori/Pritchett name confusion, first-name invention) did NOT recur.
- **Verdict: 🟡 REVISE** — 1 🔴 error (surgery year), 4 🟡 suggestions. After fixing the year, article is near publish-ready.
- **Lesson:** Date/year errors from position papers are an emerging pattern. The Injury position paper had "January 23, 2025" when the recovery math demands 2026. Cross-referencing stated dates against the article's own timeline math (recovery window × stated availability = implied surgery date) is a reliable catch mechanism. Add this to the standard editorial checklist: **verify that any stated injury date + recovery window = the availability claim.**
- **Recorded by:** Editor

📌 Team update (2026-03-16 094957): Writer established dense table rendering pattern for Substack. Tables ≥5 columns with financial/comparison headers → PNG via renderer-core.mjs before publish. Applies to all future articles with dense tables (e.g., cap-comparison, draft-board templates). — decided by Writer

## 2026-03-16: Team Retro — Tua Publish Workflow Process Fixes

📌 **Team update (2026-03-16T16:59:13Z):** Lead completed concurrent retro on Miami Tua Substack draft publish flow. Three fixes identified:
1. **Draft URL persistence gap** — Extension returns URL only in ephemeral tool response; needs durable write to pipeline.db + publisher-pass.md before Stage 7 complete.
2. **Pre-flight table audit missing** — Dense markdown tables cause Substack parser to fail at publish time; should catch upstream in Editor/Publisher checklists (which Lead supported).
3. **Stale escape-hatch language** — Publisher-pass.md template still reflects auth-failure workaround; should be removed per reliabilty improvements.

Lead prioritized #1 (URL persistence) for Publisher skill implementation. Editor's upstream table audit (recommendation #1 & #2) directly supports this by preventing publish-time rework. **Decisions merged to decisions.md:**
- lead-tua-publish-retro.md
- editor-publisher-readiness-retro.md

**Next steps:** Coordinate with Lead on Publisher skill updates. URL persistence is priority; table pre-check is supporting improvement.

## Stage 7 Quality Gate Audit (2025-07-25)

📌 **Stage 7 Production-Readiness Audit** — Full quality gate check across all 22 Stage 7 articles.

### Image Fixes: ✅ VERIFIED
- 94 image references across 22 articles — ALL resolve to valid files on disk
- 0 broken references
- 60 table-image PNGs rendered (from Phase 1 + Phase 2 dense table cleanup)
- All inline JPG/PNG images in `content/images/{slug}/` directories present and referenced correctly

### Table Fixes: ✅ VERIFIED
- `audit-tables.mjs --stage 7` confirms: 108 remaining markdown tables, **0 blocked, 0 borderline**
- All 108 pass density classifier as inline-safe (will convert to clean bullet lists in Substack)
- 60 table images already rendered for the dense/borderline tables from prior fix passes
- No further table rendering work required

### Quality Blockers for Production Push:

**Tier 1 — APPROVED and production-ready (2 articles):**
1. `den-2026-offseason` — ✅ Editor APPROVED, publisher_pass complete (names/numbers/stale refs verified)
2. `witherspoon-extension-v2` — ✅ Editor APPROVED, publisher_pass complete

**Tier 2 — Editor-approved in history but DB shows REVISE (2 articles, need DB reconciliation):**
3. `mia-tua-dead-cap-rebuild` — Editor APPROVED after 3 corrections (history pass 11), publisher_pass complete, but DB still shows REVISE with 17 errors (stale DB record)
4. `jsn-extension-preview` — Editor APPROVED content (history pass 3), image issues resolved (passes 7-9), but DB still shows REVISE with 14 errors (stale)

**Tier 3 — Editor-reviewed with outstanding REVISE (6 articles, corrections not confirmed):**
5. `ari-2026-offseason` — 1 🔴 (Trubisky pick direction), Writer Notes not stripped
6. `seahawks-rb-pick64-v2` — 1 🔴 (Charbonnet surgery year 2025→2026)
7. `hou-2026-offseason` — 1 🔴 (Sonny Styles draft projection wrong)
8. `lv-2026-offseason` — 2 🔴 (cap math + draft pick count stale)
9. `ne-maye-year2-offseason` — 2 🔴 (Doubs stats, Mason Thomas name)
10. `jax-2026-offseason` — 6 🔴 (worst shape: cap deficit, trade structure, missing panelist)

**Tier 4 — REJECTED (1 article, needs rewrite):**
11. `buf-2026-offseason` — Core premise stale (Knox cut scenario outdated), cap tables invalid, major March 2026 moves omitted

**Tier 5 — Never editor-reviewed (11 articles, must complete Stage 6 before prod):**
car, dal, gb, kc-mahomes-return-roster-gamble, lar, no, nyg, phi, sf, ten-ward-vs-saleh-draft-identity, wsh

### Publisher Pass Gaps:
- Only 3 articles have `names_verified=1, numbers_current=1, no_stale_refs=1`: den, mia, witherspoon
- Remaining 19 have these verification flags at 0 — publisher-pass fact checks are incomplete

### Lesson:
- Confirms Lead's own audit finding (lead-stage7-audit.md): DB stages are inflated from batch table cleanup that advanced metadata without completing the full editorial/publisher pipeline
- `pipeline.db` editor_reviews table is stale for at least 2 articles (mia, jsn) where corrections were applied but DB wasn't updated
- Image and table fixes are genuinely complete across all 22 articles — those are not blockers
- The real blockers are: (a) 11 articles with no editor review, (b) 7 articles with unresolved REVISE/REJECT, (c) 19 articles with incomplete publisher-pass fact checks
- **Recorded by:** Editor (2025-07-25)

📌 Technical handoff: imageCaption & parser analysis (2025-07-25)
- **Scope:** Full audit of `markdownToProseMirror()` parser in both `batch-publish-prod.mjs` and `.github/extensions/substack-publisher/extension.mjs`.
- **Key finding:** `buildCaptionedImage()` emits `captionedImage > [image2]` only. Caption text goes into `image2.attrs.title` (tooltip), but no `imageCaption` child node is created. Captions from `![alt|caption](url)` syntax silently vanish in rendered Substack articles.
- **Fix proposed:** Add `imageCaption` node with text content when caption is non-empty. Low risk — articles without captions unaffected. Both files need the same fix.
- **Parser node coverage:** 9 block-level node types handled (heading, horizontal_rule, blockquote, TLDR, bullet_list, ordered_list, captionedImage, youtube2, paragraph) plus table→list conversion. 4 inline marks (bold, italic, bold+italic, link). NOT handled: code blocks, inline code, footnotes, nested lists, task lists.
- **Dense table guard:** `assertInlineTableAllowed()` fail-fast is working as designed. All 108 remaining markdown tables in Stage 7 pass the classifier. 60 dense tables already rendered as PNGs.
- **Post-publish validation:** 5 opportunities identified (image URL check, caption presence, node count parity, title/subtitle echo, draft accessibility). Image URL check recommended first.
- **Decision written:** `.squad/decisions/inbox/editor-imagecaption-handoff.md`
- **Recorded by:** Editor (2025-07-25)



📌 Team update (2026-03-17T00:37:26Z): imageCaption investigation session completed. Lead investigation synthesized with Editor analysis: extension.mjs has uncommitted imageCaption fix + pre-publish validation; batch-publish-prod.mjs (untracked) includes imageCaption but lacks pre-publish validation; stage7-prod-push.mjs absent from working tree. Witherspoon draft: 6 images (2 inline captioned, 4 table uncaptioned). Editor-to-Lead handoff proposed for parser hardening (dense table guard, pre-publish assertImageCaptions). — decided by Coordinator


📌 Team update (2026-03-16T20:44Z): KC Fields trade evaluation — 2 inline editorial images generated (inline-1 hero-safe stadium, inline-2 dual-QB silhouette). Images ready for review. MD5 verified unique. — decided by Writer

## JSN Note Review Insights (2026-03-18)
- Trimmed the JSN Phase 2 note to 150–180 words (image + article card supply structure) and kept only the must-have facts ($3.4M gap, $33M cost of waiting, ticking clock framing) before filing the recommendation.
- Approved the Phase 2 promotion Note after a fact-check sweep; the reusable pattern is data hook + unexpected leverage point + expert disagreement + urgency frame, which the team can copy for future Notes.
📌 Waddle Trade (den-mia-waddle-trade) — IMAGE POLICY REVIEW (2026-07-26)
- **File:** `content/articles/den-mia-waddle-trade/draft.md`
- **Report saved:** `content/articles/den-mia-waddle-trade/editor-image-review.md`
- **Scope:** Post-repair image policy verification — confirm 2 inline images, no cover in markdown, files exist, no AI failure patterns.
- **Findings:**
  - ✅ Exactly 2 inline images at lines 23 and 125. No cover image in markdown.
  - ✅ Both `.jpg` files exist in `content/images/den-mia-waddle-trade/`.
  - ✅ Inline 1: Empower Field at Mile High — empty stadium, dramatic sky, Broncos orange/blue. No text/chart/jersey issues.
  - ✅ Inline 2: NFL football + Broncos jacket + open book on desk — front-office analysis atmosphere. Wilson/NFL branding is real product marking. No fabricated data visible.
  - ✅ Alt text accurate for both images. Placement contextually appropriate.
  - ❓ Substack draft rendering not verified (outside tooling scope — Joe confirms at Stage 8).
- **Verdict: ✅ APPROVED** — images satisfy policy. No blockers.
- **Lesson:** For trade articles with a clear team identity (DEN), stadium + front-office-desk is a reliable 2-image pairing that avoids all AI failure patterns (no players, no jerseys, no charts). Worth noting as a reusable image concept template.
- **Recorded by:** Editor (2026-07-26)

### Dashboard Implementation Session (2026-03-18T04:48Z)
- Verified `dashboard/render.mjs` now imports `shared/substack-prosemirror.mjs` so the preview runs through the canonical markdownToProseMirror → subscribe buttons → hero-first → validation pipeline, and recorded the Dashboard Preview Renderer Must Use Shared Module decision.
- 📌 Team update (2026-03-18T04:48Z): Local Pipeline Dashboard Architecture (Lead) defines the zero-dependency Node server, dual-source read model, and read-only preview built on `dashboard/`.
- 📌 Team update (2026-03-18T04:48Z): Dashboard Implementation Source Map (Analytics) enumerates the DB views, artifact heuristics, preview functions, and validation commands that guide dashboard implementation.

📌 Waddle Trade (den-mia-waddle-trade) — AFCCG FRAMING RE-REVIEW (2026-07-26)
- **File:** `content/articles/den-mia-waddle-trade/draft.md`
- **Report saved:** `content/articles/den-mia-waddle-trade/editor-review-3.md`
- **Scope:** Targeted re-review of AFCCG framing and argumentative fairness, requested by human editor. The article anchors its trade justification to the 10-7 AFCCG loss but Bo Nix didn't play that game (fractured ankle, Stidham started).
- **Findings:**
  - 🔴 **Line 57 — Internal contradiction:** Paragraph says trade logic "starts with the AFCCG loss" then describes "Nix forced into check-downs" in what reads as the championship game. But the article's own opening (line 15) says Nix was on the sideline in a walking boot. Places Nix in a game he didn't play.
  - 🔴 **Line 208 — Causal misattribution:** "the receiver room — the thing that cost Denver a Super Bowl trip — is fixed." The backup QB was the primary factor in the 10-7 AFCCG loss. Attributing the playoff exit to the receiver room contradicts the article's own facts.
  - 🟡 **Systemic AFCCG framing issue:** The article uses the AFCCG result as both emotional hook AND evidentiary base for the receiver-room argument. But a backup-QB game cannot isolate receiver limitations. The regular-season argument (Sutton drawing brackets all year) is the actual evidence and stands on its own — the AFCCG should be the hook, not the proof.
  - 🟡 **TLDR bullet 1:** "The offense had a ceiling problem, not a talent problem" minimizes the backup QB as the dominant AFCCG factor.
- **Verdict: 🟡 REVISE** — Previous ✅ APPROVED superseded. Five targeted passage edits needed. Core analysis (scheme fit, cap math, Miami rebuild) unaffected. Recommended next reviser: Writer.
- **Lesson: When an article uses a specific game as its narrative anchor, verify that the argument matches who actually played in that game.** The article correctly reported Nix's absence but then built its case as if Nix's regular-season limitations were the AFCCG problem. This is a logic error, not a data error — and logic errors are harder to catch than wrong numbers because the individual facts are correct. Add to editorial checklist: **when a game result anchors an argument, verify the argument matches the personnel who played, not just the score.**
- **Recorded by:** Editor (2026-07-26)

📌 Substack Notes Card Rendering — INDEPENDENT AUDIT AND FIX (2026-03-18)
- **Scope:** Audited 5 stage review Notes (229378039, 229378074, 229378102, 229378151, 229378200) reported as missing article cards.
- **Root cause (verified independently):** Article cards in Substack Notes are NOT generated from ProseMirror link marks. They require a **post-type attachment** registered via `POST /api/v1/comment/attachment` with `{ url: "<article-url>", type: "post" }`, then included as `attachmentIds: ["<uuid>"]` in the Note POST payload. Prior diagnosis (link marks trigger card rendering) was incorrect — link marks produce hyperlinks, not cards.
- **Evidence:** Compared working Note (c-228989056) vs broken Notes via API. Working Note had `attachments: [{ type: "post", publication: {...}, post: {...} }]`. Broken Notes had `attachments: []`.
- **Fix applied:**
  1. Updated `extension.mjs`: added `registerPostAttachment()`, updated `createSubstackNote()` to accept `attachmentIds`, updated tool handler to auto-register post attachments for linked articles.
  2. Deleted 5 broken Notes, reposted with post attachments via `replace-stage-notes-v2.mjs`.
  3. All 5 new Notes verified rendering article cards (hero image + NFL Lab logo + title).
- **New Note IDs:** 229384944 (JSN), 229384978 (KC Fields), 229385012 (Denver), 229385048 (Miami), 229385077 (Witherspoon)
- **Lesson:** Substack Notes attachments follow a uniform model — images, posts, and likely other embed types all use the same `POST /api/v1/comment/attachment` → `attachmentIds` flow. ProseMirror body is purely text; rich embeds are always attachments. Always verify assumptions against a working reference (compare known-good to known-bad).
- **Recorded by:** Editor (2026-03-18)

📌 Waddle trade article — FINAL AFCCG-framing verification (editor-review-4)
- **Scope:** Verified Writer's fixes to all 5 deliverables from editor-review-3: line 57 (AFCCG separation), line 208 (causal attribution), TLDR bullet 1 (acute vs structural), opening paragraph (Stidham framing), defensive-shell table (regular-season anchor).
- **Findings:** All 5 fixes implemented correctly. The article now cleanly separates the AFCCG emotional hook from the regular-season evidentiary argument. Nix is no longer placed in the championship game. The closing thesis attributes the playoff exit to the ankle, not the receiver room. Image state unchanged from approved image review.
- **Verdict: ✅ APPROVED** — Article is publish-ready. Substack draft at prod URL should be updated with revised text before Stage 8 review.
- **Lesson:** Writer's fix pattern was effective: (1) explicit disclaimer ("it doesn't start with the AFCCG"), (2) temporal anchor ("rewind to the regular season, when Nix *was* healthy"), (3) causal reframing in closing ("The ankle that cost Denver a Super Bowl trip is healing. The receiver room — the structural ceiling that capped the offense even before the injury — is fixed."). This three-part pattern — disclaim, anchor, reframe — is a reusable template for any article where a narrative hook event and the actual evidentiary argument are different.
- **Recorded by:** Editor (2026-07-26)
- **2026-03-18 — notes-attachment-card-fix:** Re-opened the stage review Note rendering issue after the prior fix still produced plain-text article promos. Confirmed the durable requirement: attachment-backed article cards require registering each published URL via /api/v1/comment/attachment, passing the returned ID(s) as attachmentIds, and replacing the 5 affected notes with attachment-backed versions. User feedback is now clear: article-promotion Notes must ship as real article cards, never plain links.


📌 Dashboard Implementation Review (2026-07-26)
- **Scope:** Full code review of dashboard/ implementation against approved plan (plan.md)
- **Files reviewed:** server.mjs, data.mjs, ender.mjs, 	emplates.mjs, public/style.css, package.json, README.md
- **Cross-referenced:** shared/substack-prosemirror.mjs, .github/extensions/substack-publisher/extension.mjs, .github/extensions/table-image-renderer/renderer-core.mjs
- **Runtime validation:** All modules import cleanly. Server starts on :3456. Board (75 rows), article detail, preview, and JSON API routes all return 200. Zero external dependencies.
- **Findings:**
  - ✅ **(1) Overview board + article detail pages** — Board page has KPI strip, filters (text/stage/status), and full article table. Detail page has left-rail summary + 7 tabs (Overview, Prompt & Panel, Draft & Edits, Assets, Preview, Publish/Notes, Timeline). Both render against live data.
  - ✅ **(2) Read-only v1** — DB opened with { readOnly: true }. No write operations, no POST handlers, no mutation forms. Footer labels "Read-only."
  - 🟡 **(3) Reuse canonical preview logic** — shared/substack-prosemirror.mjs was extracted specifically for dashboard + publisher reuse (its header says so), but ender.mjs builds its own markdown-to-HTML renderer from scratch. Neither the dashboard nor the publisher extension imports the shared module. THREE copies of markdown parsing logic now exist (publisher, shared, dashboard) — the exact fragmentation the plan warned about. Dashboard renderer misses TLDR callout handling, subscribe buttons, hero-image enforcement, dense-table blocking, and YouTube embeds.
  - ✅ **(4) Run commands and docs** — 
pm run dashboard and 
pm run dashboard:dev work. README has concise Dashboard section with requirements, commands, pages, and API.
  - ✅ **(5) Validation** — Server starts clean, all routes respond, data model correct.
- **Verdict: 🟡 REVISE** — Dashboard is functional and valuable. 4 of 5 plan requirements met cleanly. Requirement #3 (canonical preview reuse) is the blocker: ender.mjs must be refactored to use shared/substack-prosemirror.mjs (converting ProseMirror JSON to HTML), or an explicit decision must be logged accepting the approximate renderer and the drift risk.
- **Blocking artifact:** dashboard/render.mjs — needs Backend to refactor to import shared/substack-prosemirror.mjs instead of reimplementing markdown parsing.
- **Recommended agent:** Backend (to wire shared/substack-prosemirror.mjs into ender.mjs as ProseMirror→HTML converter, or to make a conscious decision to accept the approximate renderer with documented rationale).
- **Lesson:** When a plan says "extract and reuse" and someone creates the extracted module but nobody imports it, the result is worse than not extracting — you now have three divergent copies instead of two. Always verify the shared module is actually wired in before marking extraction complete.
- **Recorded by:** Editor (2026-07-26)


📌 Dashboard Re-Review — Post Backend Revision (2026-07-26)
- **Scope:** Re-review of blocking artifact `dashboard/render.mjs` and related files after Backend revision. Focused on plan requirement #3 (reuse/extract existing JS preview logic).
- **Files reviewed:** `dashboard/render.mjs`, `dashboard/server.mjs`, `dashboard/templates.mjs`, `shared/substack-prosemirror.mjs`, `.github/extensions/substack-publisher/extension.mjs`, `README.md`
- **Previous verdict:** 🟡 REVISE — `render.mjs` reimplemented markdown parsing instead of using `shared/substack-prosemirror.mjs`
- **Findings (all 5 plan requirements):**
  - ✅ **(1) Overview board + article detail** — Unchanged and still clean (75 rows, all routes 200).
  - ✅ **(2) Read-only v1** — Unchanged, still clean.
  - ✅ **(3) Reuse canonical preview logic** — **RESOLVED.** `render.mjs` now imports `markdownToProseMirror`, `ensureSubscribeButtons`, `ensureHeroFirstImage`, `extractMetaFromMarkdown`, and `getNodeText` from `shared/substack-prosemirror.mjs`. Publisher extension also imports from shared (confirmed: no local `markdownToProseMirror` definition remains in extension). Single source of truth achieved for the two primary consumers. `renderPreview()` runs the full pipeline: meta extraction → ProseMirror parse → subscribe buttons → hero-image enforcement → ProseMirror-to-HTML conversion. Dense-table warnings and YouTube embeds also wired through. Preview banner updated from "Approximate preview" to "Canonical ProseMirror preview."
  - ✅ **(4) Run commands and docs** — `npm run dashboard` works. README repo structure tree updated (line 166: "Canonical ProseMirror preview (uses shared/substack-prosemirror.mjs)").
  - ✅ **(5) Validation** — Server starts clean, all routes respond 200. Preview route renders canonical HTML with subscribe widgets present. 404 handling correct. Error handling for preview failures added (try/catch in server.mjs line 137-146).
- **Runtime verification:**
  - Board: 200, 42656 bytes, KPI strip + filters + table present
  - Article detail: 200, 14250 bytes, tabs present
  - Preview (jsn-extension-preview): 200, 21389 bytes, canonical banner, subscribe widget present, subtitle rendered
  - Preview (witherspoon-extension-v2): 200, 24419 bytes, canonical banner, subscribe widget present
  - API endpoints: both 200
  - 404 route: correct 404 response
- **Remaining notes (🟢, non-blocking):**
  - README lines 177 and 188 still say "approximate preview" / "approximate HTML (not Substack-exact)" — stale text from pre-revision. The repo structure tree (line 166) and the actual preview banner are correct. Minor doc inconsistency; not a blocker.
  - Three batch utility scripts (`batch-publish-prod.mjs`, `publish-stage-validation.mjs`, `repair-prod-drafts.mjs`) still define their own `markdownToProseMirror`. These are one-off scripts, not the core consumers the plan targeted. Consolidation is a separate cleanup task.
- **Verdict: ✅ APPROVED** — All 5 plan requirements now satisfied. The blocking artifact (`render.mjs`) has been properly refactored to use `shared/substack-prosemirror.mjs`. The publisher extension was also migrated, achieving the plan's goal of a single canonical source. Dashboard is plan-complete.
- **Recorded by:** Editor (2026-07-26)

### Emmanwori Rookie Eval — Full Editorial Review (2026-07-26)

- **File:** `content/articles/sea-emmanwori-rookie-eval/draft.md`
- **Scope:** ~3,800-word panel article evaluating Nick Emmanwori's rookie season and its draft implications
- **Fact-check findings:**
  - 🔴 **CRITICAL — "Devon Woolen" should be "Tariq Woolen":** Draft used Devon Witherspoon's first name on Tariq Woolen (2 instances). Classic first-name cross-contamination between two Seahawks DBs. Confirmed via NFL.com, ESPN, FOX 13 Seattle.
  - 🔴 **CRITICAL — "Uchenna Mafe" should be "Boye Mafe":** Draft used Uchenna Nwosu's first name on Boye Mafe (2 instances). Same cross-contamination pattern — two Seahawks edge rushers. Confirmed via MyNorthwest Sports, Pro Football Rumors.
  - 🟡 Woolen contract labeled "$15M AAV" but it's a 1-year deal; AAV misleading for single-year contracts.
  - 🟡 Coby Bryant listed as "CB/S" in departures table; he signed with Chicago as a safety (S).
  - 🟡 DeMarcus Lawrence listed as "34" but is 33 during March 2026 offseason (born April 1992).
  - 🟡 Only 1 inline image generated; policy requires exactly 2.
  - ✅ Nick Emmanwori name, draft position (R2 #35), combine measurables (6-3/220/4.38) all verified.
  - ✅ All stats in the draft match the Analytics position paper. No stat discrepancies between draft and canonical source.
  - ✅ Contract figures verified: Woolen to PHI ($15M/1yr), Bryant to CHI (3yr/$40M), Mafe to CIN (3yr/$60M).
  - ✅ Analytics framing honest — YAC rate flagged as concern, base rate prominently featured, chess-piece label properly tiered.
- **Images:** Cover ✅ (atmospheric, "768" on scoreboard verified). Inline-1 ✅ (bench-side Seahawks gear, Nike branding acceptable). Inline-2 🟡 MISSING.
- **Verdict: ✅ APPROVED after 2 name corrections.** Article structure, panel framing, and analytics honesty are excellent.
- **Pattern:** First-name cross-contamination between same-team DBs/EDGEs is now a 3x repeat pattern (Nehemiah/Nick Emmanwori, Devon Woolen/Witherspoon, Uchenna Mafe/Nwosu). This is the Editor's highest-value catch category for Seahawks articles.

📌 **Lesson:** Seahawks secondary/edge articles require explicit first-name verification for every player. The Writer consistently borrows first names from teammates at the same position group. This is not a one-off — it's a systemic pattern. Future Seahawks panel articles should include a name-verification checklist in the Writer prompt.

### Emmanwori Rookie Eval — R2 Re-Review (2026-07-27)
- **Scope:** Focused re-review verifying all 6 fixes from R1 (2 mandatory, 4 recommended) plus image placement.
- **Revision applied by:** Lead (per reviewer-gate rules — Writer cannot self-approve).
- **Findings:**
  - ✅ "Devon Woolen" → "Tariq Woolen" — FIXED. Zero residual instances.
  - ✅ "Uchenna Mafe" → "Boye Mafe" — FIXED. Zero residual instances.
  - ✅ Woolen contract "`$`15M AAV" → "1yr / `$`15M" — FIXED.
  - ✅ Coby Bryant "CB/S" → "S" — FIXED.
  - ✅ Lawrence age "34" → "33" — FIXED.
  - ✅ Second inline image generated and both images embedded in markdown at appropriate section breaks.
  - ✅ No new name cross-contamination or regressions introduced.
- **Image review (vision):** inline-1 ✅ (Seahawks equipment at goal line, #22 jersey visible but generic art — not a player portrait, flagged as minor/non-blocking). inline-2 ✅ (helmets on bench, no text/numbers, clean).
- **Verdict: ✅ APPROVED — ready for Substack draft step (Phase 7).**

📌 **Lesson:** Lead-applied revision passes (per reviewer-gate) produce clean, regression-free fixes. The separation between Writer and fix-applier reduces the chance of introducing new errors during corrections.
### Writer Prose-Safety Guardrails Formalized (2026-03-19T05:10:46Z)
**Status:** ✅ COMPLETED — Upstream prose-safety guardrails formalized to catch name/quote/table drift before Editor review.

- Updated `.squad/agents/writer/charter.md` with five preflight requirements:
  - Cross-check names against artifacts and tables
  - Never present paraphrases/stitched summaries as direct quotes
  - Avoid unsupported superlatives and absolutes
  - Cross-check narrative claims against tables before saving
  - Keep ambiguous details generic instead of invented-specific
- Rationale: Upstream guardrails reduce avoidable prose drift while preserving Writer/Editor separation
- Constraints: Writer is not the fact-checker; Editor remains mandatory final gate
- 📌 Team update: Writer guardrails formalized — prose-safety preflight added to Writer charter, decided by Editor
- Orchestration log: `.squad/orchestration-log/2026-03-19T05-10-46Z-editor.md`
- Session log: `.squad/log/2026-03-19T05-10-46Z-factcheck-rollout.md`
- Decision merged to `.squad/decisions.md`


📌 Puka Nacua Deep Dive — FULL EDITORIAL REVIEW (Stage 6) (2026-03-19)
- **File:** `content/articles/puka-nacua-seahawks-2025-deep-dive/draft.md`
- **Report saved:** `content/articles/puka-nacua-seahawks-2025-deep-dive/editor-review.md`
- **Scope:** Depth Level 3 Deep Dive. Cross-checked 65+ stat claims, verified 14 derived calculations independently, reviewed 2 AI-generated images with vision.
- **Result:** 0 🔴 errors, 4 🟡 suggestions, 10 🟢 notes.
- **Key findings:**
  - All stats verified clean against data anchors — zero factual errors on first pass (first time in pipeline history)
  - All 14 derived calculations (EPA/target, percentages, fold-increases) independently reproduced and confirmed
  - Nick Emmanwori spelled correctly throughout — no Nehemiah error
  - All ⚠️ preflight items properly hedged (Bryant/Woolen departures as "expected," scheme claims use "film suggests")
  - All unanchored stats from preflight correctly excluded (Lawrence pressures, Emmanwori blitzes, Woolen aDOT)
  - 2 unverified claims flagged: "25 points clear of next man" (EPA gap), "38-37 shootout" (game score)
  - Image 2 shows "EMMANWORI #34" nameplate — number unverified, needs confirmation before publish
  - Headline comment block (lines 1-5) must be stripped before publish
  - Table rounding inconsistency: +4% in table vs 4.3% in text
- **What went right:** This is the cleanest first-pass draft in the pipeline. Writer's internalization of the panel-factcheck.md preflight was exceptional — every unanchored stat was excluded, every caution item was hedged. The 4-1 panel structure is expertly balanced.
- **Verdict: ✅ APPROVED** — publish-ready pending 4 minor suggestions and image jersey number verification.
- **Lesson:** The preflight-to-Writer-to-Editor pipeline is maturing. When Writer receives a thorough panel-factcheck.md, the editorial review finds process/polish issues rather than factual errors. The preflight investment pays off downstream.
- **Recorded by:** Editor (2026-03-19)

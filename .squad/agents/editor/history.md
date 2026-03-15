# Editor — Article Editor & Fact-Checker History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **Role:** Full Editor — facts, style, and structural review for NFL Lab
- **User:** Joe Robinson
- **Added:** 2026-03-14

## Knowledge Base

### NFL Lab — Published Articles
1. **"The Seahawks Have a Hole at RB"** — RB1A target board (Jadarian Price, Brian Robinson Jr.)
   - Published: 2026-03-14
   - Status: Published WITHOUT editorial review (pre-Editor)
   - Known error: "Nehemiah Emmanwori" should be "Nick Emmanwori" — corrected post-publish

2. **"Our Cap Expert Says $27 Million..."** — Witherspoon extension (Cap vs PlayerRep)
   - Published: 2026-03-14
   - Status: Published WITHOUT editorial review (pre-Editor)
   - Known error: "Nehemiah Emmanwori" should be "Nick Emmanwori" — corrected post-publish

### Known Error Patterns to Watch
- **Name confusion between similar players** — Nehemiah Pritchett (CB) vs Nick Emmanwori (S) on Seattle
- **Contract figures can drift** — restructures change cap hits after initial reporting
- **FA availability** — 35% of initial FA target board was already signed (Media caught this)
- **Simulated vs real universe** — this project operates in a 2026 simulated offseason; verify details against the project's own data sources, not real-world 2024/2025 data

## Learnings

📌 First lesson: The Emmanwori error happened because expert agents generated content from memory/research and nobody verified names against the official roster before publish. Editor must ALWAYS cross-reference names with the team agent's history.md roster section as a first pass.

📌 Second review: JSN Extension Preview article (2026-03-15). Key findings:
- **Name error caught: "Ryan Havenstein" → "Rob Havenstein"** — same pattern as Emmanwori. Writer added a first name not in the source material and got it wrong. The SEA position file correctly said just "Havenstein" without the first name. Lesson: when source material omits a first name, verify before adding one. Non-roster names (opponents, retired players) are just as risky as roster names.
- **Quote mashup caught:** Writer blended Cap's comp analysis with PlayerRep's draft-slot argument into a single quote attributed to Cap. In a panel-format article, attribution accuracy is non-negotiable. Each quote must trace cleanly to one panelist's position file.
- **Superlative error:** "Best any Shanahan-tree receiver has ever produced" ignores Kupp's 1,947-yard outlier, which the Offense position file explicitly acknowledges. Always check superlatives against the source material's own caveats.
- **Quote polish pattern:** Multiple quotes were enhanced/paraphrased from position files but presented in quotation marks. "Optionality theater" (article) vs "a trap" (position file). Not factually wrong, but a credibility risk if readers compare to source material. Flag this pattern in future reviews.
- **DK Metcalf AAV discrepancy in discussion-summary.md:** States ~$24M/yr but project data shows $30M/yr (5yr/$150M). The draft correctly avoided including this figure, but the discussion summary has a stale number. Worth flagging to Lead for correction.
- **Political/tax compliance:** Writer correctly excluded WA SB 6346 content from draft despite it appearing in discussion summary. Good adherence to user directive.
- **Stat specificity gap:** "1,800 yards" used repeatedly without supporting stats (catches, TDs, target share). For articles built on "how good is this player?", the stat line is the evidence. Always flag when production claims lack supporting numbers.
- **Verdict: 🟡 REVISE** — 3 🔴 errors (name, attribution, superlative), multiple 🟡 suggestions. Article is ~90% publish-ready. Strong structure, voice, and data accuracy otherwise (22/23 facts verified clean).

📌 Third review (re-review): JSN Extension Preview article (2026-03-15). All 3 🔴 errors fixed correctly:
- "Rob Havenstein" name corrected (was "Ryan").
- Cap/PlayerRep quote properly split — Cap keeps comp analysis, PlayerRep gets draft-slot argument. Clean transition added.
- Shanahan-tree superlative now qualified with "since Cooper Kupp's 1,947-yard outlier in 2021."
- Bonus: Line 169 "financial malpractice" quote re-attributed from SEA to PlayerRep (correct source).
- Full 8-quote attribution audit: all clean.
- No new factual errors found. Remaining 🟡 items (stat specifics, vague record claim) are recommendations, not blockers.
- **Verdict: ✅ APPROVED** — article is publish-ready.

📌 **Decision finalized (2026-03-15T21:17:13Z)**: JSN Extension Preview article approved for publication. All 3 red errors fixed, full 8-quote attribution audit clean, no new factual errors. Article is publish-ready.

📌 Fourth pass: JSN Extension Preview — 4 🟡 yellow-item fixes applied:
- "franchise-record receiving numbers" → "franchise-record receiving yardage" (defensible narrowing; discussion-summary supports yards as the metric).
- Added HTML placeholder for JSN 2025 specific stats (catches, TDs, target share, YAC) — source material explicitly flags these as unavailable (Open Question #1 in discussion-summary.md).
- Added cap table footnote clarifying $35.0M includes $8M Day 1 roster bonus vs. $27.0M base.
- "Arizona is rebuilding" → "Arizona is retooling" per decisions.md ($41.7M cap space, pick #3).
- **Lesson:** When source data explicitly flags a stat gap, use HTML comment placeholders rather than inventing specifics. Narrowing vague claims ("numbers" → "yardage") is preferable to leaving them vague when the supporting data points one direction.


📌 Article milestone (2026-03-15T21:45:00Z): JSN Extension Preview article approved for publication. All 4 yellow-item fixes applied. Ready for Publisher pass. Recorded by: Editor

📌 Fifth pass: JSN Extension Preview — IMAGE REVIEW (2026-03-15T22:00:00Z)
- **5 images examined:** cover + 4 inline images across article sections
- **Relevance check:** All images placed in correct sections, directly supporting panel arguments (market comps, injury timeline, cap structure, deal closure)
- **Alt text audit:** All 5 alt text entries accurately describe image contents. No mismatches.
- **Tone alignment:** All images consistent with NFL Lab's "analytical, premium" brand. Cover field visualization (risk/opportunity zones) is sophisticated, not generic promo. Inline images are purposeful data-forward visuals, not decorative filler.
- **Technical flags:** 
  - Cover image contains intentional embedded text labels ("RISK WINDOWS", "OPPORTUNITY ZONES") — this is purposeful diagram labeling, not AI hallucination artifact. Appropriate for analytical tone.
  - No aspect ratio issues.
  - No quality issues detected.
  - No duplicate/near-identical images.
- **Verdict: ✅ APPROVED** — All 5 images are publication-ready. No replacements or revisions needed.

📌 Sixth pass: JSN Extension Preview — COMPREHENSIVE IMAGE REVIEW including surplus files (2025-01-22)
- **Scope expansion:** Complete inventory of 7 images (5 active + 2 surplus) evaluated against charter criteria
- **Surplus file assessment:**
  - **cover-2.png:** Duplicate detection completed. Visually identical/near-identical to cover-1 (same Seahawks player #11, stadium setting, pose, lighting). Indicates rejected variant rather than intentional design choice. Verdict: 🔴 Archive (redundant; do not publish)
  - **jsn-extension-preview-inline.png:** Fresh candidate image (action shot: JSN mid-catch, full stadium background). Technical evaluation: No embedded text, proper aspect ratio, high rendering quality. Tone alignment: Strong—action shot consistent with NFL Lab analytical/premium voice, purposeful not decorative. Relevance: Content relevant to JSN article subject matter, but all 5 active images already approved and optimally placed; no placement need in current article structure. Verdict: 🟡 Archive as alternative candidate (high-quality backup; retain for future JSN-related content or revisions)
- **Learnings:**
  - Duplicate detection methodology: Compare cover variants visually for composition, subject pose, lighting, framing—identical/near-identical covers indicate rejected alternates or unnecessary variants
  - Surplus candidate evaluation framework: Assess technical quality + relevance + tone alignment independently, then cross-reference against current article placement needs. High-quality images without placement are not publication blockers but good candidates for project library/future reuse
  - Charter compliance: All 7 images evaluated against charter criteria (Relevance, Tone alignment, Technical flags). Verdict system applied: 5 ✅ Keep (active), 1 🟡 Archive (alternative candidate), 1 🔴 Archive (duplicate)
- **Final verdict: ✅ ARTICLE APPROVED FOR PUBLICATION** — All active images cleared. Surplus files assessed and archived with clear disposition. Article ready for publisher pass.
- **Recorded by:** Editor (2025-01-22)


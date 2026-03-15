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

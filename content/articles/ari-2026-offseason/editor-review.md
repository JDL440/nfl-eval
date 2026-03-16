# Editor Review — Arizona Post-Murray Rebuild Article

**Article:** "Arizona Just Released Kyler Murray and Ate $47.5M in Dead Cap. Here's Why They Still Won't Draft a QB at #3."
**Reviewer:** Editor (Article Editor & Fact-Checker)
**Date:** 2026 offseason, pre-draft
**Sources checked:** draft.md, discussion-summary.md, discussion-prompt.md, cap-position.md, ari-panel-response.md, offense-panel.md, draft-section.md

---

## 🔴 ERRORS

### 1. Chicago 2017 Trubisky draft position — factually wrong

**Location:** Draft section, paragraph beginning "The historical cautionary tale is Chicago in 2017..."

**Article says:** "Chicago in 2017 — trading up to #3 for Mitch Trubisky while Patrick Mahomes and Deshaun Watson sat right there."

**Fact:** The Bears held pick #3 and traded UP one spot to **#2 overall** with the San Francisco 49ers, then selected Trubisky at #2. "Trading up to #3" is incorrect — #3 was their starting position, not their destination. The pick was #2.

**Fix:** Change to "Chicago in 2017 — trading up from #3 to #2 for Mitch Trubisky while Patrick Mahomes and Deshaun Watson sat right there." Alternatively: "...using a top-3 pick on Mitch Trubisky..."

**Note:** The Draft panel's historical comps table (draft-section.md) also lists this incorrectly as "Pick: #3" — that's the original position, not the trade destination. The draft panel source propagated the ambiguity.

---

## 🟡 SUGGESTIONS

### 1. Dead cap discrepancy between ARI panel and Cap panel — resolve at source

The article correctly follows Cap (the designated SME) in stating the $47.5M dead cap "evaporates completely in 2027" with $0 Murray dead cap in 2027. However, **ARI's panel response (line 27) lists dead cap as "$47.5M (2026) + $7.2M (2027)"** — implying a two-year tail. If the $7.2M figure is real, the 2027 projected cap space ($105–115M) should decrease by $7.2M, and the claim that dead cap disappears in 2027 is incorrect.

**Recommendation:** No article change needed (Cap is authoritative on cap figures). Flag to Lead that the ARI panel response contains a potentially stale or incorrect dead-cap figure that contradicts Cap's analysis.

### 2. Scheme comparison table mixes coaching eras

The table in the "Scheme Reset" section labels one column "Kingsbury Era" and attributes "Bottom 10" pre-snap motion to it. However, the Offense panel's source for this stat is Arizona's **2025** season — which was under Jonathan Gannon, not Kingsbury (2019–2022).

**Fix:** Relabel the column as "Pre-LaFleur" or "2019–2025 Cardinals" to avoid implying the stat is from Kingsbury's specific tenure. Alternatively, add a footnote: "2025 season data; reflects continuation of low-motion tendencies post-Kingsbury."

### 3. Strip Writer Notes before publish

Lines 209–218 contain a "Writer Notes (for Editor — remove before publish)" section with 8 verification flags. These are internal notes and must be deleted before the article goes live.

### 4. Image placeholders need resolution

Two `<!-- IMAGE PLACEHOLDER -->` tags remain in the article (after the draft board section and before the Harrison Jr. projection table). Per the SKILL.md production pipeline, images should be generated via `generate_article_images` and placed before publication. These are currently blocking publish.

### 5. Murray contract precision

The opening uses "$230 million" for Murray's total contract. ARI panel source says "5yr/$230.5M ($160M gtd)." While $230M is acceptable narrative rounding, consider "more than $230 million" or "$230.5 million" for precision — especially since the opening hook uses this number for dramatic weight. The more precise figure strengthens credibility.

### 6. Shanahan-tree superlative claim

The article states the Shanahan coaching tree has "the best QB development record in modern football." This is a strong unqualified superlative. Consider softening to "arguably the best" or "one of the strongest" — or attribute it explicitly to the Offense panel (which is its source) rather than presenting it as article-level assertion.

---

## 🟢 NOTES

### Structure & Template Compliance ✅

Article follows the SKILL.md structure template in full:
- ✅ Clickbait-adjacent, honest headline (names team, includes specific numbers, creates tension)
- ✅ TLDR with 4 bullet points covering situation, assets, verdict, and central debate
- ✅ Byline with panel tag (ARI · Draft · Cap · Offense)
- ✅ Opening hook (3 paragraphs, visceral, urgent)
- ✅ Themed sections: Situation → Expert angles → Disagreement → Verdict
- ✅ Closing paragraph ties back to big picture
- ✅ Boilerplate + CTA + next article tease
- ✅ Length: ~3,200 words (within 2,000–4,000 target)

### Quote Attribution — All 7 Expert Quotes Verified Clean ✅

| # | Quote (abbreviated) | Attributed to | Source file | Status |
|---|---------------------|--------------|-------------|--------|
| 1 | "Dead cap is just a receipt..." | Cap | cap-position.md | ✅ Exact match |
| 2 | "You don't pay a bridge QB $8.25M..." | Cap | cap-position.md | ✅ Exact match |
| 3 | "Arizona has the single most valuable asset..." | Draft | draft-section.md | ✅ Exact match |
| 4 | "LaFleur's offense doesn't need a superhero..." | Offense | offense-panel.md | ✅ Exact match |
| 5 | "Every week Harrison Jr. spends catching..." | Offense | offense-panel.md | ✅ Exact match |
| 6 | "This is a 2-year rebuild with a 1-year fuse..." | ARI | ari-panel-response.md | ✅ Exact match |
| 7 | "Arizona didn't just break up with Kyler Murray..." | ARI | ari-panel-response.md | ✅ Exact match |

No mashups, no misattributions, no invented quotes. Major improvement over prior articles (cf. JSN Extension quote mashup error).

### Key Facts Verified ✅

| Claim | Source | Verified |
|-------|--------|----------|
| Murray 38-48-1 record in 7 seasons | ARI panel | ✅ |
| $47.5M dead cap from release | Cap + ARI panels | ✅ |
| #3 overall pick | All panels | ✅ |
| 2026 salary cap $301.2M | Cap position | ✅ |
| Harrison Jr. 41 rec / 608 yds / 4 TD (2025) | ARI + Offense panels | ✅ |
| McBride 126 rec / 1,239 yds / 11 TD / First-Team All-Pro | ARI panel | ✅ |
| Seumalo 3yr/$31.5M | Discussion prompt + Cap | ✅ |
| Allgeier 2yr/$12.25M | Discussion prompt + Cap | ✅ |
| Minshew 1yr/$8.25M | Discussion prompt + Cap | ✅ |
| Brissett 94.1 passer rating / 41.2 QBR | Offense panel | ✅ |
| Arizona 30 sacks (T-28th) in 2025 | ARI panel | ✅ |
| JJ trade chart: #34 (560) + #104 (130) = 690 → ~#27-28 (660-680) | Draft section | ✅ |
| 2027 QB class: Manning, Iamaleava, Sellers | Draft section | ✅ |
| Simpson 15 college starts | Draft + Offense panels | ✅ |
| Harrison Jr. drafted 2024, #4 overall | ARI + Cap panels | ✅ |

### Expert Position Characterizations — Accurate ✅

The four-expert timeline table (Section 5) correctly represents each panelist's position:
- **Draft:** Bain at #3 + Simpson trade-back ✅
- **Offense:** Same plan, shorter Brissett leash ✅
- **Cap:** Bridge year, QB in 2027 (Path D) ✅
- **ARI:** Trade-down from #3 for multiple picks ✅

### Table Density & Credibility ✅

8 data tables across the article. Cap table, prospect menu, scheme comparison, Harrison Jr. Year 2 comps, QB trait matrix, Harrison Jr. projections, expert timeline, and verdict risk matrix. This is the "credibility backbone" the style guide demands.

### Narrative Strengths

- The opening hook ("Seven seasons. $230 million. One Wild Card loss.") is tight, memorable, and accurate.
- Murray's farewell quote is woven naturally into the narrative — not dropped in as a gotcha.
- The "photographic negative of the Air Raid" framing is excellent — visual, clear, and used consistently.
- Expert disagreement is elevated as content, not buried. The four-timeline table is the strongest section.
- The closing paragraph successfully ties the dead-cap crater to the franchise's emotional arc.

### Image Review Status

⚠️ **No images to review.** Two placeholder comments exist; no generated images found in the article directory. Image generation and review are blocked until placeholders are resolved.

---

## Verdict: 🟡 REVISE

**One 🔴 factual error** (Trubisky draft position) must be fixed. Six 🟡 suggestions range from mandatory pre-publish cleanup (strip Writer Notes, resolve image placeholders) to polish items (contract precision, superlative qualification, scheme table labeling).

### Required before publish:
1. Fix Trubisky draft position (#2, not #3)
2. Strip Writer Notes section (lines 209–218)
3. Generate and place images (or remove placeholder comments)

### Recommended before publish:
4. Relabel scheme comparison table column
5. Tighten Murray contract figure
6. Qualify Shanahan-tree superlative

After fixing the 🔴 error and completing the mandatory cleanup items, re-submit for final approval.

---

*Review by: Editor — NFL Lab Article Editor & Fact-Checker*

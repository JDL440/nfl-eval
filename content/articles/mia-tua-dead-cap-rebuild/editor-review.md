# Editor Review — $99 Million Ghost: How Miami Rebuilds With the Largest Dead Cap Hit in NFL History

**Article:** mia-tua-dead-cap-rebuild
**Reviewer:** Editor
**Review Date:** 2026-03-16
**Draft Version:** v1

---

## 🔴 ERRORS (Must Fix Before Publish)

### ERROR 1: Dead Cap Percentage Math Inconsistency

**Location:** Lines 27-34 (historical comp table) vs. Cap position source data

**What's wrong:**
The article's historical comp table shows LAR (Goff trade) in 2021 with 13.5% dead cap percentage. However, the Cap position source file (line 15) shows LAR (Goff) in 2023 with 33.5% dead cap percentage. These are contradictory data points — same team/transaction but different years and massively different percentages.

**Impact:**
The entire core thesis rests on Miami's proportional burden (18.4%) being "half what LAR and DEN survived." If the LAR number is wrong, the central claim collapses.

**Required fix:**
Verify the correct LAR data:
- Which year did the Goff trade dead money actually hit? (Goff was traded in 2021, but dead cap may have been structured across multiple years)
- What was the actual dead cap percentage?
- If the Cap position file is correct (33.5% in 2023), update the article table AND revise the claim that Miami's burden is "half" what LAR survived — 18.4% vs 33.5% is roughly half, but 18.4% vs 13.5% would be higher, not lower

**Source to verify:** OverTheCap historical dead money tracker for LAR 2021-2023

---

### ERROR 2: Calais Campbell Age Reference

**Location:** Line 69

**What's wrong:**
"Calais Campbell turns 40 this year"

Campbell was born January 31, 1986. He is 40 years old in 2026 (turned 40 in January 2026), not "turns 40 this year."

**Required fix:**
Change to "Calais Campbell is 40 years old" or "Calais Campbell turned 40 this offseason"

**Source:** Pro Football Reference (Calais Campbell DOB: 1986-01-31)

---

## 🟡 SUGGESTIONS (Strong Recommendations)

### SUGGESTION 1: Clarify "Green Bay Slow Build" Path Label

**Location:** Throughout (lines 7, 83-89, 167, 193-212)

**Issue:**
The article refers to "Path 3 (Green Bay Slow Build)" without ever defining what Paths 1, 2, and 4 are. The reader is told "all three panelists rejected Path 1, 2, and 4" (line 22 in discussion summary) but has no idea what those paths entail.

**Why it matters:**
The reader doesn't know what Miami *isn't* doing. Saying "unanimous on Path 3" loses impact if the alternatives are unknown.

**Suggested fix:**
Add a callout box or brief section early in the article (after line 21) that defines all four paths:
- Path 1: Rams scorched-earth (trade all picks for veteran talent, compete immediately)
- Path 2: Texans aggressive trade-up (sell future to get franchise QB now)
- Path 3: Green Bay slow build (draft defense, develop, hold for 2027 QB class)
- Path 4: Hail Mary veteran QB (sign a Cousins/Stafford/Carr type to bridge)

Then the reader understands what the panel rejected and why unanimity on Path 3 is meaningful.

---

### SUGGESTION 2: Add Context for "Post-June 1 Designation"

**Location:** Line 37

**Issue:**
The article states "The post-June 1 designation was the right structural move" but doesn't explain what a post-June 1 designation is or why it matters. Casual fans won't understand the reference.

**Suggested fix:**
Add one sentence explaining: "The post-June 1 designation splits the cap hit across two years instead of accelerating it all into 2026, preserving roster flexibility at the cost of extended dead money."

---

### SUGGESTION 3: Image Placeholder Count

**Location:** None present in the draft

**Issue:**
The draft contains **zero image placeholders**. Per Writer charter (lines 34-50), every article must include exactly 2 inline `<!-- IMAGE: ... -->` placeholders.

**Required action:**
Add 2 image placeholders at natural text breaks. Suggested placements:
1. After line 63 (end of cap math section, before roster reality section) — visual break before major topic shift
2. After line 95 (end of win projection, before draft strategy section) — another major topic shift

Example format:
```
<!-- IMAGE: Split-screen graphic showing Miami's dead cap burden vs LAR/DEN historical comparisons
     Placement: inline
     Tone: analytical infographic with team colors
     Key elements: Bar chart comparing dead cap percentages (18.4% MIA vs 33.5% LAR vs 20.8% DEN), clean data visualization
-->
```

---

## 🟢 NOTES (Minor / Optional)

### NOTE 1: Quote Attribution Format

**Location:** Lines 35, 62, 78, 112, 143, 158, 183

**Observation:**
All expert quotes are correctly attributed and formatted as blockquotes. Formatting is consistent throughout. Good work.

---

### NOTE 2: Expert Disagreement Framing

**Location:** Lines 165-188 ("The Panel Disagreement" section)

**Observation:**
This is excellent structural work. The article doesn't smooth over the disagreement about competitive timeline — it frames the disagreement as the central tension and makes it the climax of the piece. The table at lines 171-175 is particularly effective at visualizing the split without forcing false consensus.

---

### NOTE 3: TLDR Quality

**Location:** Lines 5-9

**Observation:**
Strong TLDR. Hits all key points: record-breaking number, panel consensus, debunking of headline, central debate. The bullet format makes it scannable. No changes needed.

---

### NOTE 4: Headline Options

**Current headline:** "$99 Million Ghost: How Miami Rebuilds With the Largest Dead Cap Hit in NFL History"

**Alternative options to test:**
- "Miami's $99M Dead Money Isn't a Death Sentence — It's a Trade Market"
- "How Miami Turns $99M in Dead Cap Into a Competitive Advantage"
- "The $99M That Doesn't Matter: Inside Miami's Non-Obvious Rebuild Path"

The current headline works, but consider whether emphasizing the counter-intuitive angle (dead cap as advantage) might drive more clicks.

---

### NOTE 5: "Next from the panel" Teaser Quality

**Location:** Line 224

**Current teaser:** "The Jets' Aaron Rodgers succession plan — and why the 2026 draft may force their hand earlier than they want."

**Assessment:**
Strong teaser. Creates curiosity (what succession plan?), implies conflict (draft forcing their hand), and targets a high-interest team/player. This reads like a real next article, not generic housekeeping.

**Follow-on verification needed:**
Lead should confirm this teaser corresponds to an actual planned article (NYJ issue #45 in the pipeline). If not, revise to match a real planned topic.

---

## FINAL VERDICT

**🟡 REVISE — Fix errors, add image placeholders, then publish**

### Required before publish:
1. ✅ Fix LAR dead cap data inconsistency (ERROR 1) — verify correct year and percentage
2. ✅ Fix Calais Campbell age reference (ERROR 2) — "is 40" not "turns 40"
3. ✅ Add exactly 2 inline image placeholders (SUGGESTION 3)

### Strongly recommended:
4. Add Path 1-4 definitions early in article (SUGGESTION 1) — makes "unanimous on Path 3" meaningful
5. Add one-sentence explainer for "post-June 1 designation" (SUGGESTION 2) — accessibility for casual fans

### Optional polish:
6. Test alternative headlines emphasizing counter-intuitive angle (NOTE 4)
7. Verify NYJ teaser corresponds to real pipeline article (NOTE 5)

---

## Editor Sign-Off

**Overall quality:** Strong article with excellent structure and clear expert disagreement framing. The core thesis (dead cap percentage vs nominal total) is compelling and well-supported. Two factual errors need immediate correction, and image placeholders are required per Writer charter. After fixes, this is publication-ready.

**Estimated time to fix:** 15-20 minutes for required changes

**Next step:** Writer applies ERROR fixes + adds image placeholders → Editor spot-checks corrections → Publisher pass

---

**Reviewed by:** Editor
**Date:** 2026-03-16
**Draft status:** REVISE (errors identified, fixable within one iteration)

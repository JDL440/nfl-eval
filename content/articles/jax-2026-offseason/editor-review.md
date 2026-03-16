# Editor Review — Jacksonville Bet Its Future on Travis Hunter

**Reviewer:** Editor
**Draft:** `content/articles/jax-2026-offseason/draft.md`
**Date:** 2026-03-17
**Sources cross-checked:** `cap-position.md`, `jax-position.md`, `offense-position.md`, `discussion-prompt.md`, `panel-composition.md`

---

## 🔴 ERRORS

### 1. Cap deficit figure is inconsistent with source ($15.9M vs. $8.3M)

The draft states Jacksonville "opened the 2026 offseason roughly $15.9M over the cap" (TLDR, paragraph 3, and the summary table). The Cap panelist's analysis — the article's own source — puts the figure at **$8.3M over** (Cap position, "2026 Cap Reality" table: $273.0M cap, $281.3M active contracts, −$8.3M space). The $15.9M number appears nowhere in any panel output and has no cited source. This figure recurs at least four times in the draft and must be reconciled with the Cap source or re-sourced from OTC/Spotrac.

**Lines affected:** ~10, ~22, ~38, ~134

---

### 2. Hunter's 2026 cap hit is wrong ($10.6M vs. $7.8M)

The draft's summary table says Hunter's 2026 cap hit is "$10.6M." The Cap panelist's contract breakdown shows **$7.8M** (Year 2 of a 4yr/$35.1M rookie deal with annual hits of $6.1M / $7.8M / $9.5M / $11.7M). Off by $2.8M. This number also feeds into the "Normal top-five-pick money" framing in the same table — the logic still holds at $7.8M, but the figure itself is factually wrong per the source.

**Lines affected:** ~35

---

### 3. Trade structure contradicts source material

The draft describes the trade as "A move from No. 5 to No. 2 in 2025, plus picks No. 36, No. 126, and the 2026 first-rounder." The Cap panelist describes a different trade: Jacksonville sent picks #41 (2nd round), #104 (4th round), the 2026 1st-round pick (#19), and a 2027 3rd-round pick to Cleveland in exchange for the #5 overall pick and a 7th-rounder (#238). These are incompatible:

- **Direction:** Cap says JAX traded UP to #5 (from a lower position). Draft says JAX moved from #5 to #2.
- **Pick numbers:** Draft says #36 and #126. Cap says #41 and #104.
- **Missing component:** The 2027 3rd-round pick (part of the trade per Cap) is absent from the draft's trade description.

This is the article's foundational fact. It must match the source or be independently re-verified.

**Lines affected:** ~34

---

### 4. Restructured players don't match Cap source

The draft names Jakobi Meyers, Robert Hainsey, Patrick Mekari, Eric Murray, and Jourdan Lewis as players whose contracts have "already" been restructured. The Cap panelist's restructure menu proposes entirely different targets: Christian Kirk ($12M savings), Cam Robinson ($8M), Foyesade Oluokun ($6M), a Josh Hines-Allen extension ($5M), and an Evan Engram June 1 cut ($9.5M). The five names in the draft appear in no panel source as restructure candidates. If these restructures are independently sourced (e.g., from a separate OTC check), the article needs to say so. If they were invented by the Writer, they must be removed and replaced with the Cap panel's analysis.

**Lines affected:** ~134, ~138–140

---

### 5. Missing Defense panelist

The panel composition (panel-composition.md) specifies four agents: JAX, Cap, **Defense**, and Offense. No `defense-position.md` file exists in the article directory, and the draft has no dedicated section representing the Defense panelist's analysis. The article-lifecycle skill (Stage 5, "Done when") requires "All panelists' analysis is represented (none dropped)." Defensive concepts surface through JAX and Offense, but the Defense agent's distinct angle — Campanile's scheme survivability, the CB1 gap when Hunter is on offense — has no dedicated voice.

**Action:** Either (a) generate the Defense position and incorporate it into the draft, or (b) formally reduce the panel to three agents and update `panel-composition.md` to match.

---

### 6. No cap/contract source citations (Gate 3 failure)

Accuracy Gate 3 requires: "Contract figures are sourced (OTC/Spotrac citation in text or table)." The draft contains no OTC or Spotrac citations for any contract figure — Lawrence's $24M hit, Hunter's rookie deal, the cap deficit, or any restructure amount. At minimum, the summary table and the cap section need source attribution.

---

## 🟡 SUGGESTIONS

### 1. Christian Kirk and Evan Engram are significant omissions

The Cap panelist identifies Kirk ($22.5M cap hit, $24M dead cap if cut) as the team's third-highest cap commitment and a "sunk cost" that limits flexibility. Engram ($13.5M hit, potential $9.5M savings via June 1 cut) is flagged as an actionable cap lever and the TE1 in Udinski's scheme. Neither player appears in the draft at all. Both are important to the cap narrative and would strengthen the "stress-fracture economics" framing. Consider adding Kirk to the cap constraints discussion and Engram to the restructure/lever section.

### 2. Red zone total rate arithmetic

The Offense panelist's source data shows 9 TDs in 13 trips (69.2%) + 8 TDs in 22 trips (36.4%) = 17 TDs in 35 trips = **48.6%**. The draft says 48.3%. Minor but should match the source math or cite an independent figure.

### 3. Verdict snap range introduces ambiguity

The verdict section recommends "ideally in the 55–60% range on offense" while the TLDR and JAX section focus on the specific 55/25 model. The 5-point range (55–60%) and the unstated defensive percentage create slight ambiguity about the total workload recommendation. Consider specifying the defense number in the verdict (e.g., "55–60% offense, 20–25% defense, staying under 80% total").

### 4. The 2027 3rd-round pick should be part of the trade cost narrative

Even after the trade structure is corrected per 🔴 #3, the 2027 3rd-rounder is a meaningful cost that the Cap panelist emphasizes. The draft's "opportunity cost" section discusses the missing 2026 1st but never acknowledges the 2027 3rd. Adding it would strengthen the "compounded cost" argument.

### 5. "Next from the panel" tease

The tease at line 215 promises a Day 2 draft board article for Jacksonville. Verify this corresponds to an actual planned article in `content/article-ideas.md`. Per the Publisher Pass checklist, this must "point to a real upcoming article."

---

## 🟢 NOTES

### 1. Writing quality is excellent

The prose is sharp, the panel voices are distinct, and the narrative arc — from paradox statement to three-angle analysis to verdict — flows naturally. The Ferrari/Honda Civic analogy is memorable. The headline is strong and earns its length.

### 2. TLDR passes Gate 2

The `> **📋 TLDR**` callout is present immediately after the hook, with four well-structured bullets covering situation, tension, debate, and verdict. ✓

### 3. Temporal accuracy passes Gate 1

Year references (Year 1 = 2025 played, Year 2 = 2026 upcoming), stat seasons (2024 and 2025 for BTJ), and cap figures all refer to the correct temporal frame. ✓

### 4. Player/staff names verified (Gate 3 partial pass)

All player and staff names are real people. No invented names detected. Brian Thomas Jr., Trevor Lawrence, Jakobi Meyers, Parker Washington, Grant Udinski, Anthony Campanile, Josh Hines-Allen, Foyesade Oluokun, etc. are all correctly named. The name accuracy component of Gate 3 passes; the citation component does not (see 🔴 #6).

### 5. Image placeholders are well-specified

Both `<!-- IMAGE -->` blocks include placement, tone, and key visual elements. Ready for the Publisher pass.

### 6. BTJ target-share analysis is internally consistent

The 6.1 → 5.4 targets/game comparison, the "Hunter helps BTJ" conclusion, and the underlying data match across JAX position, Offense position, and the draft. This section is solid.

### 7. Word count is within range

Estimated ~3,200 words, within the 2,500–3,500 target for Depth Level 2.

---

## Verdict: 🟡 REVISE

**Rationale:** The draft's narrative structure, writing quality, and panel-disagreement framing are strong. However, six factual errors — including the cap deficit, Hunter's cap hit, the trade mechanics, and the restructure targets — run through the article's core financial argument. These are correctable (they require reconciling with the Cap panelist's numbers or independently re-sourcing from OTC), but they must be fixed before this article can publish. The missing Defense panelist also needs resolution.

**Recommended revision path:**
1. Fix all 🔴 errors using Cap source data (or re-verify independently from OTC/Spotrac and update the Cap source if it was wrong).
2. Add OTC/Spotrac citations to satisfy Gate 3.
3. Resolve the Defense panelist gap (generate the position or formally reduce the panel).
4. Address 🟡 suggestions at Writer's discretion.
5. Return for Editor re-review.

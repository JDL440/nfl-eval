# Cap — Salary Cap Expert History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Data Sources:** overthecap.com, spotrac.com, ESPN/NFL.com
- **Rumor Mode:** Dual-track (⚠️ RUMOR inline + separate track)

---

## Free Agent Market Context (2026)

_Last updated: 2026-03-12 via Spotrac_

**Total 2026 FA Class:** 212 players signed, $3.178B total value, $9.0M average AAV

### Top Signings by Position (market-setters)
| Player | Pos | From → To | Years | Total Value | AAV |
|--------|-----|-----------|-------|-------------|-----|
| Jaelan Phillips | ED | PHI → CAR | 4 | $120M | $30.0M |
| Alec Pierce | WR | IND → IND | 4 | $114M | $28.5M |
| Trey Hendrickson | ED | CIN → BAL | 4 | $112M | $28.0M |
| Odafe Oweh | ED | LAC → WAS | 4 | $100M | $25.0M |
| Tyler Linderbaum | C | BAL → LV | 3 | $81M | $27.0M |
| Alontae Taylor | CB | NO → TEN | 3 | $58M | $19.3M |
| Jaylen Watson | CB | KC → LAR | 3 | $51M | $17.0M |
| Rashid Shaheed | WR | SEA → SEA | 3 | $51M | $17.0M |

### NFC West FA Movement Summary
**Departed:**
- Boye Mafe (SEA → CIN): 3yr/$60M ED
- Kenneth Walker III (SEA → KC): 3yr/$43.05M RB
- Coby Bryant (SEA → CHI): 3yr/$40M S
- Jalen Thompson (ARI → DAL): 3yr/$33M S

**Acquired:**
- Jaylen Watson (KC → LAR): 3yr/$51M CB
- Mike Evans (TB → SF): 3yr/$42.4M WR
- Isaac Seumalo (PIT → ARI): 3yr/$31.5M G
- Rashid Shaheed (re-signed SEA): 3yr/$51M WR
- Josh Jobe (re-signed SEA): 3yr/$24M CB

---

## Positional Market Benchmarks

_Last updated: 2026-03-12 via OverTheCap_

### Edge Rusher Market (Top Contracts by AAV)
| Player | Team | AAV | Total GTD |
|--------|------|-----|-----------|
| Micah Parsons | GB | $46.5M | $136M |
| Aidan Hutchinson | DET | $45.0M | $141M |
| T.J. Watt | PIT | $41.0M | $108M |
| Myles Garrett | CLE | $40.0M | $123.6M |
| Nick Bosa | SF | $34.0M | $122.5M |
| Jaelan Phillips | CAR | $30.0M | $80M |
| Boye Mafe | CIN | $20.0M | $19M |
| Josh Sweat | ARI | $19.1M | $41M |
| Bryce Huff | SF | $17.0M | $34M |
| Uchenna Nwosu | SEA | $9.76M | $7M |

**NFC West Edge Context:** Bosa ($34M AAV) is well below the new Parsons/Hutchinson tier. Sweat ($19.1M) and Nwosu ($9.76M) are value contracts. Seattle lost Mafe ($20M AAV) — significant gap to fill.

---

## Learnings

### 2026-03-12: Data Source Reliability
- OTC team cap pages (`/salary-cap/{team}`) are the **gold standard** for cap hit breakdowns, dead money, and multi-year projections ✅
- Spotrac FA tracker (`/nfl/free-agents/signed/`) returns comprehensive signed-FA data including GTD at signing ✅
- OTC free agency page is JS-rendered — use Spotrac instead ⚠️
- OTC franchise tag page returned outdated content (2020 era articles) — not reliable for current tag values ⚠️
- PFR returns 403 on all automated requests — blocked ⚠️

### 2026-03-12: NFC West Strategic Insights
- **Cap Flexibility Tiers:** ARI/SEA (flex) >> LAR (constrained) >> SF (crisis mode)
- **Dead Money Story:** SF ($36.2M) is paying heavily for past moves; SEA ($484K) has clean slate
- **QB Cost Divergence:** Purdy ($24.4M) vs. Murray ($52.7M) is a $28M gap — SF's key structural edge
- **2027 Warning:** SF projected over the cap; LAR projected at ~$3M — only ARI and SEA have comfortable 2027 runways
- **Seattle's Paradox:** Cleanest cap sheet BUT lost 3 quality starters (Mafe, Walker, C. Bryant) — cap space means nothing if not deployed wisely

---

## Extension Modeling: JSN & Devon Witherspoon

_Analysis date: 2026-03-13 | Requested by: Joe Robinson_

### Executive Summary

Seattle can afford both extensions simultaneously. The combined 2027 cap hit of ~$36M is absorbable given $75.9M effective space. Darnold/Williams restructures create an additional ~$19.8M in 2026 breathing room if needed. The championship window (2026-2029) remains intact with proper sequencing.

**Recommended approach:** Extend both players this offseason (summer 2026), before the 2026 season. This locks in prices before another year of production potentially inflates them, and allows the signing bonus proration to begin immediately for maximum cap efficiency.

---

### Player Profiles

**Jaxon Smith-Njigba (WR)**
- Age: 24 (2026 season) | Entry: 2023 R1 #20
- Current deal: 4yr/$14.4M rookie contract, 2026 cap hit $4,587,325 (final year)
- 2025 production: 119 rec, 1,793 yds, 10 TD — elite WR1 output
- OTC Valuation: $34,238,000 vs. $3,604,327 APY — **massive surplus value**
- Free agency: UFA 2027 (5th-year option available, ~$24-28M projected value)

**Devon Witherspoon (CB)**
- Age: 26 (2026 season) | Entry: 2023 R1 #5
- Current deal: 4yr/$31.9M rookie contract, 2026 cap hit $10,137,639 (final year)
- 2025: Pro Bowl caliber when healthy, missed 5 games (12 GP)
- OTC Valuation: $11,763,000 vs. $7,965,288 APY — surplus value
- Free agency: UFA 2027 (5th-year option available, ~$20-22M projected value for top-10 pick)
- ⚠️ Injury history is a negotiation factor — may reduce total guarantees slightly

---

### WR Market Comps (for JSN)

| Player | Team | Year | Yrs | Total | AAV | Total GTD | Fully GTD | Context |
|--------|------|------|-----|-------|-----|-----------|-----------|---------|
| Ja'Marr Chase | CIN | 2025 | 4 | $161M | $40.25M | $109.8M | $73.9M | Market-setter, elite production |
| Justin Jefferson | MIN | 2024 | 4 | $140M | $35.0M | $110M | $88.7M | Elite WR, set market in 2024 |
| CeeDee Lamb | DAL | 2024 | 4 | $136M | $34.0M | $100M | $77.5M | WR1 deal |
| Garrett Wilson | NYJ | 2025 | 5 | $130M | $32.5M | $90M | $60M | Less production than JSN |
| Amon-Ra St. Brown | DET | 2024 | 4 | $120M | $30.0M | $77M | $58M | Slot/versatile, PPR machine |
| Alec Pierce | IND | 2026 | 4 | $116M | $29.0M | $84M | — | 2026 FA market-setter |
| Jameson Williams | DET | 2025 | 3 | $80M | $26.67M | $66.1M | $44M | Less proven than JSN |
| DeVonta Smith | PHI | 2024 | 3 | $75M | $25.0M | $51M | — | WR2 deal |

**JSN's comp tier:** $32-35M AAV. His 119/1,793/10 season at age 23 is comparable to Chase/Jefferson production levels. However, it's one elite season vs. multi-year track records for those players. He slots between Garrett Wilson ($32.5M) and CeeDee Lamb ($34M). **Projected AAV: $33.5M.**

---

### CB Market Comps (for Witherspoon)

| Player | Team | Year | Yrs | Total | AAV | Total GTD | Fully GTD | Context |
|--------|------|------|-----|-------|-----|-----------|-----------|---------|
| Sauce Gardner | IND | 2025 | 4 | $120.4M | $30.1M | $84.65M | $40.5M | Market-setter, traded to IND |
| Derek Stingley | HOU | 2025 | 3 | $90M | $30.0M | $89M | — | Near-full GTD, elite CB |
| Jaycee Horn | CAR | 2025 | 4 | $100M | $25.0M | $70M | — | Injury history factored in |
| Pat Surtain II | DEN | 2024 | 4 | $96M | $24.0M | $77.5M | $40.7M | Gold standard CB deal |
| DaRon Bland | DAL | 2025 | 4 | $90M | $22.5M | $50M | — | Ball-hawk specialist |
| A.J. Terrell | ATL | 2024 | 4 | $81M | $20.25M | $65.8M | — | Solid CB1 |
| Alontae Taylor | TEN | 2026 | 3 | $58M | $19.33M | — | — | 2026 FA CB market |

**Witherspoon's comp tier:** $24-27M AAV. His talent is Gardner/Stingley caliber, but the injury concern (missed 5 games in 2025) will moderate guarantees. The Surtain ($24M) and Horn ($25M) deals are the most relevant structural comps — both are elite young CBs with some durability questions. **Projected AAV: $26M.**

---

### Extension Model: Jaxon Smith-Njigba

**Deal: 4 new years (2027-2030), $134M new money, $33.5M AAV**
- Signed: Summer 2026 (layered onto final rookie year)
- Signing bonus: $45M ($9M/yr proration over 2026-2030)
- Fully guaranteed at signing: $65M
- Total guarantees (rolling): $95M
- New base salaries (2027-2030): $89M

| Year | Age | Base Salary | SB Proration | Orig Proration | Cap Hit | Projected Cap | Cap % |
|------|-----|-------------|-------------|----------------|---------|---------------|-------|
| 2026 | 24 | $2,716,000 | $9,000,000 | $1,871,325 | **$13,587,325** | $301,200,000 | 4.5% |
| 2027 | 25 | $12,000,000 | $9,000,000 | — | **$21,000,000** | $327,000,000 | 6.4% |
| 2028 | 26 | $19,000,000 | $9,000,000 | — | **$28,000,000** | $352,000,000 | 8.0% |
| 2029 | 27 | $26,000,000 | $9,000,000 | — | **$35,000,000** | $375,000,000 | 9.3% |
| 2030 | 28 | $32,000,000 | $9,000,000 | — | **$41,000,000** | $400,000,000 | 10.3% |

**2026 cap impact:** +$9.0M over current ($4.59M → $13.59M)
**Key cap feature:** The 2027 hit of $21M is extremely favorable — only 6.4% of the projected cap. By the time the deal peaks at $41M in 2030, the cap is projected at ~$400M, keeping it at ~10% — market rate.

**Why now vs. after 2026:**
| Factor | Extend Now (Summer 2026) | Wait (After 2026 Season) |
|--------|--------------------------|--------------------------|
| Projected AAV | $33.5M | $35-38M (market inflation + another big year) |
| Signing bonus proration | Starts in 2026 (extra year of spread) | Starts in 2027 (1 fewer year to spread) |
| Risk for team | Pays before confirming 2025 wasn't a fluke | Higher price if he repeats |
| Risk for player | Leaves money on table if market jumps | Risk of injury in 2026 |
| **Recommendation** | **✅ Strongly prefer** | ⚠️ Only if negotiations stall |

---

### Extension Model: Devon Witherspoon

**Deal: 4 new years (2027-2030), $104M new money, $26M AAV**
- Signed: Summer 2026 (layered onto final rookie year)
- Signing bonus: $35M ($7M/yr proration over 2026-2030)
- Fully guaranteed at signing: $50M
- Total guarantees (rolling): $75M
- New base salaries (2027-2030): $69M
- Note: 5th-year option should be exercised in May 2026 as insurance during negotiations

| Year | Age | Base Salary | SB Proration | Orig Cap Components | Cap Hit | Projected Cap | Cap % |
|------|-----|-------------|-------------|---------------------|---------|---------------|-------|
| 2026 | 26 | $1,755,477 | $7,000,000 | $8,382,162 (orig) | **$17,137,639** | $301,200,000 | 5.7% |
| 2027 | 27 | $8,000,000 | $7,000,000 | — | **$15,000,000** | $327,000,000 | 4.6% |
| 2028 | 28 | $15,000,000 | $7,000,000 | — | **$22,000,000** | $352,000,000 | 6.3% |
| 2029 | 29 | $22,000,000 | $7,000,000 | — | **$29,000,000** | $375,000,000 | 7.7% |
| 2030 | 30 | $24,000,000 | $7,000,000 | — | **$31,000,000** | $400,000,000 | 7.8% |

**2026 cap impact:** +$7.0M over current ($10.14M → $17.14M)
**Key cap feature:** The 2027 hit of only $15M is exceptional — lower than the 5th-year option value ($20-22M) would have been. This is the primary cap advantage of extending early.

**Guarantee discount for injury risk:** The $50M fully guaranteed at signing is lower than Surtain's $54.2M new guarantee and well below Gardner's structure, reflecting Witherspoon's 5-game absence in 2025. If he plays a full 2026, future rolling guarantees vest via standard March roster date triggers.

**5th-Year Option Strategy:**
Exercise the option in May 2026 as a negotiating bridge. If the extension is finalized, the option year gets rolled into the new deal. If negotiations stall, the option guarantees Witherspoon is under contract for 2027 at ~$20-22M (fully guaranteed for injury only). This is the standard approach for first-round CBs.

---

### Combined Cap Impact: Year-by-Year Comparison

#### Scenario 1: Baseline (No Extensions — Both Walk as UFAs)

| Year | Projected Cap | Current Committed | Effective Space | Key Notes |
|------|---------------|-------------------|-----------------|-----------|
| 2026 | $301,200,000 | $263,930,635 | **$37,269,365** | 53-man roster, 65 under contract |
| 2027 | $327,000,000 | $231,613,465 | **$75,856,535** | Only 30 under contract; need ~21 fill |
| 2028 | $352,000,000 | $109,871,202 | **$207,996,000** | Only 16 under contract; massive open space |
| 2029 | $375,000,000 | ~$40,000,000 | ~$290,000,000 | Extremely few committed |

⚠️ In this scenario, JSN and Witherspoon leave in FA. Replacement cost at WR1 + CB1 is likely $35-50M combined AAV anyway — so "saving" money by letting them walk is illusory.

#### Scenario 2: Witherspoon Extension Only

| Year | New Witherspoon Hit | 2026 Change | Remaining Space |
|------|---------------------|-------------|-----------------|
| 2026 | $17,137,639 | +$7,000,000 | **$30,269,365** |
| 2027 | $15,000,000 | +$15,000,000 | **$60,856,535** |
| 2028 | $22,000,000 | +$22,000,000 | **$185,996,000** |
| 2029 | $29,000,000 | +$29,000,000 | ~$261,000,000 |

#### Scenario 3: Both Extensions ✅ RECOMMENDED

| Year | JSN Hit | Witherspoon Hit | Combined Add | Remaining Space |
|------|---------|-----------------|--------------|-----------------|
| 2026 | $13,587,325 | $17,137,639 | **+$16,000,000** | **$21,269,365** |
| 2027 | $21,000,000 | $15,000,000 | **+$36,000,000** | **$39,856,535** |
| 2028 | $28,000,000 | $22,000,000 | **+$50,000,000** | **$157,996,000** |
| 2029 | $35,000,000 | $29,000,000 | **+$64,000,000** | ~$226,000,000 |

**Key takeaway:** Even with BOTH extensions, Seattle has $21.3M effective space in 2026 and $39.9M in 2027. That's more than SF has TODAY ($12M). The math works comfortably.

#### Scenario 4: Both Extensions + Darnold/Williams Restructures 💪 MAX FLEXIBILITY

| Year | Extension Add | Restructure Savings | Net Change | Remaining Space |
|------|---------------|---------------------|------------|-----------------|
| 2026 | +$16,000,000 | **-$19,758,000** | **-$3,758,000** | **$41,027,365** |
| 2027 | +$36,000,000 | +$8,342,000 | +$44,342,000 | **$31,514,535** |
| 2028 | +$50,000,000 | +$8,342,000 | +$58,342,000 | **$149,654,000** |

---

### Restructure Detail

#### Sam Darnold (QB) — 2026 Restructure

| Metric | Current | After Restructure | Change |
|--------|---------|-------------------|--------|
| 2026 cap hit | $37,900,000 | **$28,675,000** | **-$9,225,000** |
| 2027 cap hit | $44,900,000 | $47,975,000 | +$3,075,000 |
| 2028 void | $12,800,000 | $15,875,000 | +$3,075,000 |
| 2029 void | $0 | $3,075,000 | +$3,075,000 |

**Mechanism:** Convert $12.3M base salary to signing bonus, prorating over 4 remaining years (2026-2029 including void years). Creates $9.225M in 2026 cap space at the cost of $3.075M/yr in future dead money.

**Risk assessment:** Low. Darnold's 2027 contract year ($44.9M → $48M) is already his peak cap hit. The added void year dead money ($15.9M in 2028, $3.1M in 2029) is manageable against projected caps of $352M and $375M.

#### Leonard Williams (DT) — 2026 Restructure

| Metric | Current | After Restructure | Change |
|--------|---------|-------------------|--------|
| 2026 cap hit | $29,636,250 | **$19,103,250** | **-$10,533,000** |
| 2027 void | $9,372,500 | $14,639,500 | +$5,267,000 |
| 2028 void | $0 | $5,267,000 | +$5,267,000 |

**Mechanism:** Convert $15.8M base salary to signing bonus, prorating over 3 remaining years (2026-2028 including void years). Creates $10.533M in 2026 cap space.

**Risk assessment:** Moderate. Williams' void year dead money increases significantly ($14.6M in 2027). However, since he's already on a void-year structure, this is just accelerating guaranteed money. The $14.6M in 2027 dead money against a $327M cap is only 4.5%.

**⚠️ Note:** Williams was already restructured once (2025, $18.745M conversion). A second restructure is unusual but permissible. The team should weigh whether Williams is a long-term piece before adding more dead money.

#### Combined Restructure Impact

| Year | Darnold Savings | Williams Savings | Total Savings |
|------|-----------------|------------------|---------------|
| 2026 | **$9,225,000** | **$10,533,000** | **$19,758,000** |
| 2027 | -$3,075,000 | -$5,267,000 | -$8,342,000 |
| 2028 | -$3,075,000 | -$5,267,000 | -$8,342,000 |
| 2029 | -$3,075,000 | — | -$3,075,000 |

---

### Championship Window Analysis (2026-2029)

#### The Core Question: Can Seattle extend both AND win?

**YES.** Here's the year-by-year math with both extensions and available restructures:

| Year | Cap | Committed (w/ extensions) | True Usable Space | Window Status |
|------|-----|---------------------------|-------------------|---------------|
| 2026 | $301.2M | $279.9M | **$21.3M** ($41M w/ restructures) | 🟢 OPEN — can add FA starters |
| 2027 | $327M | $267.6M | **$39.9M** ($31.5M w/ restructures) | 🟢 OPEN — tightest year, still flexible |
| 2028 | $352M | $159.9M | **$158M** | 🟢 WIDE OPEN — Darnold off books, massive space |
| 2029 | $375M | ~$104M | **~$226M** | 🟢 WIDE OPEN — reset opportunity |

#### Key Window Dynamics

1. **2026 is the action year.** With $21-41M in space, Seattle can:
   - Sign 2-3 quality starters on 1-2 year deals to replace Mafe/Walker/Bryant
   - Address EDGE rusher need (market: $15-20M AAV for quality starter)
   - Add RB depth ($3-5M range)
   - Still have room for draft picks ($5-7M for class)

2. **2027 is the tightest year** but still workable at $31-40M effective space. Key factors:
   - Darnold's peak hit ($44.9-48M) is the primary constraint
   - Extensions produce favorable Year 1 hits ($21M JSN + $15M Witherspoon)
   - If Seattle drafts a QB in 2026, the rookie would cost only $3-7M in 2027

3. **2028 is the financial reset.** Darnold comes off the books (only $15.9M dead money). Williams is gone. The cap jumps to $352M. Seattle will have $150M+ to build around JSN (28M hit), Witherspoon ($22M hit), and whoever replaces Darnold.

4. **2029 and beyond** — with a projected $375M cap and only ~$104M committed (extensions + a few young players), Seattle has extraordinary flexibility to build the next iteration of the roster.

#### The Sequencing Recommendation

| Priority | Action | Timing | Cap Impact |
|----------|--------|--------|------------|
| 1 | Extend Witherspoon | May-June 2026 | Exercise 5th-year option first as insurance |
| 2 | Extend JSN | June-July 2026 | Lock in before 2026 season |
| 3 | Restructure Darnold | If needed for FA signings | Only if $21M space insufficient |
| 4 | Restructure Williams | Last resort | Only if 2026 spending requires it |
| 5 | Address EDGE/RB in FA | March-April 2026 | 1-2 year deals, avoid long-term commitments |

**Do the extensions first, restructures second.** The extensions are the long-term investments; restructures are tactical cap tools to increase 2026 spending if needed. Don't restructure unless specific FA targets require the extra room.

---

### Risk Factors

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| JSN regresses after 2025 breakout | Low (20%) | Overpay by $3-5M AAV | Structure with performable incentives in Year 3-4 |
| Witherspoon's injury recurrence | Moderate (35%) | Dead cap if cut/traded | Lower fully-GTD ($50M vs. $65M for healthy CB), per-game roster bonuses |
| Cap growth slows (< $25M/yr) | Low (15%) | 2029-2030 contracts pinch harder | Void year in JSN deal provides escape valve |
| Darnold underperforms / replaced early | Moderate (30%) | $12-16M dead money in 2028 | Already priced in; 2028 cap ($352M) absorbs it easily |
| Both players demand top-of-market | Low-Moderate (25%) | Combined $65M+ AAV | Negotiate JSN first (cleaner comp set), use as leverage for Witherspoon |

---

### Bottom Line

Seattle is in a **rare and enviable position**: two franchise-caliber players on expiring rookie deals, the cleanest cap sheet in the NFL, and 4 years of rising salary caps ahead. The math doesn't just "work" — it works comfortably.

- **Extend both now** at a combined ~$59.5M AAV ($33.5M JSN + $26M Witherspoon)
- **2026 remains flexible** with $21-41M to address roster holes
- **2027 is manageable** at $31-40M effective space despite Darnold's peak hit
- **2028-2029 are wide open** for the next phase of roster building
- **Use restructures tactically**, not preemptively — save them for specific FA acquisitions

The bigger risk is NOT extending these players and watching them walk into a WR/CB market that's inflating 8-10% annually. Every year Seattle waits, it costs $2-4M more per player.

---

### 2026-03-13: Extension Modeling Learnings

- **OTC player pages** (`/player/{name}/{id}/`) return complete year-by-year contract breakdowns including base salary, prorated bonus, roster bonuses, option bonuses, per-game bonuses, and void year details ✅
- **OTC cap space projections** for 2027-2028 reflect only currently signed players — must mentally account for roster-filling costs (~$1.1M × missing players to reach 51)
- **Cap % of hit is the best comparison metric** — raw dollar amounts are misleading across years with different cap ceilings
- **Signing bonus proration** is the primary tool for front-loading cap efficiency: $45M SB over 5 years = $9M/yr proration, keeping Year 1 hits dramatically below AAV
- **Restructure math with void years:** Darnold's 4-year spread (2026-2029 including voids) creates $9.225M savings; Williams' 3-year spread (2026-2028 including voids) creates $10.533M savings
- **The "replacement cost fallacy":** When modeling "no extension" scenarios, must account for the cost of replacing departed players in FA — the savings are largely illusory since WR1/CB1 replacements cost $25-35M AAV anyway
- **5th-year option as bridge strategy:** For 2023 first-rounders, exercise the option in May 2026 as insurance while negotiating the extension; if the extension is finalized, the option year gets rolled in

---

## League-Wide Cap Landscape (All 32 Teams)

**Timestamp:** 2026-03-13 (OverTheCap snapshot)  
**2026 Salary Cap:** $301,200,000 ✅ confirmed  
**2027 Projected Cap:** $327,000,000 📊 reliable source  
**Franchise Tag Data:** OTC tag values were JS-rendered and returned outdated content during collection ❓ unverified

### Top 10 Cap Space

| Rank | Team | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|------|-----------|---------------------|------------|------|
| 1 | WAS | $66,354,397 | $59,610,242 | $20,692,736 | Most space in NFL |
| 2 | LAC | $63,587,408 | $59,282,433 | $5,548,177 | Clean contender books |
| 3 | BAL | $55,070,187 | $49,052,216 | $18,198,715 | Premium flexibility |
| 4 | IND | $50,517,289 | $48,512,590 | $9,593,644 | Clean top-tier room |
| 5 | TEN | $50,268,372 | $38,901,526 | $17,069,272 | Big room, lower effective cushion |
| 6 | NE | $50,149,044 | $46,028,520 | $33,690,382 | Room despite notable dead |
| 7 | ARI | $41,678,185 | $30,153,792 | $23,268,104 | Flexible, but not clean |
| 8 | SEA | $40,451,262 | $37,269,365 | $483,723 | Near-cleanest books in NFL |
| 9 | LV | $37,925,609 | $25,169,525 | $52,012,266 | Space masked by heavy dead |
| 10 | NYJ | $37,124,446 | $21,194,266 | $91,246,438 | Massive dead-money drag |

### Bottom 10 Cap Space

| Rank | Team | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|------|-----------|---------------------|------------|------|
| 23 | PIT | $13,877,382 | $8,254,197 | $12,221,838 | Middle-class flexibility |
| 24 | TB | $12,874,177 | $7,313,725 | $13,329,591 | Manageable but tight |
| 25 | NYG | $12,083,735 | $1,984,435 | $11,368,472 | Thin effective margin |
| 26 | PHI | $11,520,188 | $6,373,697 | $52,031,852 | Heavy dead-money load |
| 27 | MIN | $8,913,599 | $3,884,590 | $19,473,074 | Little operating room |
| 28 | CHI | $6,806,499 | $2,132,621 | $19,355,493 | Tight despite no QB mega-hit |
| 29 | MIA | $6,336,786 | -$1,030,564 | $89,603,387 | Effectively underwater |
| 30 | CLE | $1,876,833 | -$10,252,708 | $77,141,821 | Watson + dead money squeeze |
| 31 | JAX | -$1,108,711 | -$3,577,742 | $53,340,647 | Over the cap |
| 32 | BUF | -$4,725,450 | -$8,393,836 | $46,378,219 | Over the cap |

### Dead Money Leaders

| Rank | Team | Dead Money | Primary Drivers |
|------|------|------------|-----------------|
| 1 | NO | $113,971,682 | Derek Carr $36.7M, Cameron Jordan $18.8M, Demario Davis $14.3M, Taysom Hill $13.7M |
| 2 | NYJ | $91,246,438 | Aaron Rodgers $35.0M, Ahmad Gardner $11.0M, Quinnen Williams $9.8M |
| 3 | MIA | $89,603,387 | Tyreek Hill $28.2M, Jalen Ramsey $20.9M, Minkah Fitzpatrick $13.0M |
| 4 | CLE | $77,141,821 | Joel Bitonio $23.5M, Jack Conklin $12.4M, Dalvin Tomlinson $12.1M |
| 5 | HOU | $66,366,709 | Tytus Howard $23.7M, Christian Kirk $11.4M, Shaquille Mason $7.3M |
| 6 | JAX | $53,340,647 | Tyson Campbell $19.5M, Gabriel Davis $14.6M |
| 7 | PHI | $52,031,852 | Bryce Huff $16.6M, Darius Slay $13.3M, James Bradberry $7.7M |
| 8 | LV | $52,012,266 | Christian Wilkins $29.8M, Geno Smith $16.2M |
| 9 | BUF | $46,378,219 | Matt Milano $11.1M, Taron Johnson $9.5M, Joey Bosa $7.2M |
| 10 | DAL | $42,744,177 | Zack Martin $16.5M, Osa Odighizuwa $16.0M |

### League-Level Observations

- **New Orleans is the clear dead-money outlier** at $114.0M, roughly $22.7M worse than the next-closest team (NYJ) and easily the worst cap cleanup in the league.
- **Washington leads the NFL in cap space** at $66.4M and still sits above $59.6M in effective room.
- **Buffalo and Jacksonville are over the cap** already, while Miami and Cleveland are effectively underwater even before deeper roster work.
- **Denver and Seattle have the cleanest dead-money structures** among viable contenders, with DEN at $1.2M and SEA at just $483,723.
- **Cleveland remains structurally compromised** by Deshaun Watson's $45.0M cap hit and a broader $77.1M dead-money burden.

### AFC East

| Team | NFL Rank | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|----------|-----------|---------------------|------------|------|
| BUF | 32 | -$4,725,450 | -$8,393,836 | $46,378,219 | Over the cap |
| MIA | 29 | $6,336,786 | -$1,030,564 | $89,603,387 | Effectively underwater |
| NE | 6 | $50,149,044 | $46,028,520 | $33,690,382 | Best position in division |
| NYJ | 10 | $37,124,446 | $21,194,266 | $91,246,438 | Heavy dead-money drag |

#### Top 5 Cap Hits

- **BUF:** Josh Allen $44.2M, Dion Dawkins $24.8M, D.J. Moore $24.5M, Dawson Knox $17.1M, Ed Oliver $13.7M
- **MIA:** Tua Tagovailoa $56.3M, Bradley Chubb $31.2M, Jaylen Waddle $11.6M, Zach Sieler $11.3M, Jordyn Brooks $10.9M
- **NE:** Milton Williams $28.4M, Michael Onwenu $25.0M, Carlton Davis $22.0M, Christian Barmore $17.1M, Harold Landry $16.4M
- **NYJ:** Justin Fields $23.0M, Minkah Fitzpatrick $15.6M, Breece Hall $14.3M, Brandon Stephens $14.0M, Jamien Sherwood $11.5M

#### Dead Money Detail

- **BUF:** Matt Milano $11.1M, Taron Johnson $9.5M, Joey Bosa $7.2M drive a $46.4M dead-money total.
- **MIA:** Tyreek Hill $28.2M, Jalen Ramsey $20.9M, Minkah Fitzpatrick $13.0M are the core of an $89.6M dead-money bill.
- **NE:** Kyle Dugger $12.2M and Stefon Diggs $9.7M headline $33.7M dead.
- **NYJ:** Aaron Rodgers alone counts $35.0M dead, with Ahmad Gardner $11.0M and Quinnen Williams $9.8M pushing the club to $91.2M.

#### Key Observations

- **New England has the division's healthiest balance sheet** and can be aggressive without immediate restructures.
- **Buffalo is over the cap** and lacks easy relief because the room issue sits alongside $46.4M already dead.
- **Miami's nominal cap space is misleading**; effective space is negative once minimum roster accounting is applied.
- **The Jets carry top-10 raw space but bottom-tier cap health** because $91.2M dead money erodes flexibility.

### AFC North

| Team | NFL Rank | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|----------|-----------|---------------------|------------|------|
| BAL | 3 | $55,070,187 | $49,052,216 | $18,198,715 | Strongest contender posture |
| CIN | 15 | $24,182,216 | $17,055,650 | $11,248,222 | Adequate, not abundant |
| CLE | 30 | $1,876,833 | -$10,252,708 | $77,141,821 | Structurally squeezed |
| PIT | 23 | $13,877,382 | $8,254,197 | $12,221,838 | Manageable middle tier |

#### Top 5 Cap Hits

- **BAL:** Lamar Jackson $34.5M, Roquan Smith $32.7M, Nnamdi Madubuike $31.0M, Marlon Humphrey $26.3M, Kyle Hamilton $10.7M
- **CIN:** Joe Burrow $48.0M, Tee Higgins $26.5M, Ja'Marr Chase $26.2M, Orlando Brown Jr. $22.0M, Boye Mafe $17.0M
- **CLE:** Deshaun Watson $45.0M, Denzel Ward $30.9M, Myles Garrett $23.7M, Tytus Howard $18.0M, David Njoku $10.8M
- **PIT:** T.J. Watt $42.0M, D.K. Metcalf $31.0M, Michael Pittman Jr. $24.0M, Alex Highsmith $20.1M, Jalen Ramsey $19.5M

#### Dead Money Detail

- **BAL:** Marcus Williams $6.0M and Justin Tucker $4.6M are the main dead-money charges within an $18.2M total.
- **CIN:** Trey Hendrickson $6.5M and Logan Wilson $4.0M lead a relatively light $11.2M dead figure.
- **CLE:** Joel Bitonio $23.5M, Jack Conklin $12.4M, and Dalvin Tomlinson $12.1M make the $77.1M dead figure one of the league's worst.
- **PIT:** Minkah Fitzpatrick $6.9M and Jonnu Smith $3.9M drive a modest $12.2M dead tally.

#### Key Observations

- **Baltimore has both contending talent and premium cap optionality**, a dangerous combination.
- **Cleveland is pinned down by Watson's $45.0M cap hit plus $77.1M dead money**, leaving almost no practical flexibility.
- **Cincinnati can support the Burrow-Chase-Higgins core**, but the effective cushion is already down to $17.1M.
- **Pittsburgh has workable room**, though its veteran-heavy top end limits how far that flexibility stretches.

### AFC South

| Team | NFL Rank | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|----------|-----------|---------------------|------------|------|
| HOU | 14 | $27,502,831 | $21,790,529 | $66,366,709 | Dead-money heavy |
| IND | 4 | $50,517,289 | $48,512,590 | $9,593,644 | Cleanest division setup |
| JAX | 31 | -$1,108,711 | -$3,577,742 | $53,340,647 | Over the cap |
| TEN | 5 | $50,268,372 | $38,901,526 | $17,069,272 | Big nominal room |

#### Top 5 Cap Hits

- **HOU:** Nico Collins $27.5M, Danielle Hunter $16.1M, Azeez Al-Shaair $15.2M, C.J. Stroud $11.5M, Will Anderson Jr. $11.2M
- **IND:** DeForest Buckner $26.6M, Quenton Nelson $24.2M, Charvarius Ward $20.2M, Jonathan Taylor $15.6M, Cam Bynum $15.0M
- **JAX:** Trevor Lawrence $24.0M, Josh Hines-Allen $23.4M, Arik Armstead $19.4M, Foyesade Oluokun $17.1M, Travon Walker $15.2M
- **TEN:** Calvin Ridley $26.5M, Dan Moore Jr. $26.3M, Jeffery Simmons $25.7M, L'Jarius Sneed $19.6M, Alontae Taylor $14.0M

#### Dead Money Detail

- **HOU:** Tytus Howard $23.7M, Christian Kirk $11.4M, and Shaquille Mason $7.3M drive a $66.4M dead-money load.
- **IND:** Michael Pittman Jr. $5.0M and Zaire Franklin $2.5M headline a very manageable $9.6M dead total.
- **JAX:** Tyson Campbell $19.5M and Gabriel Davis $14.6M are the biggest pieces of $53.3M dead money.
- **TEN:** Lloyd Cushenberry $9.1M and Arden Key $4.6M lead a moderate $17.1M dead charge.

#### Key Observations

- **Indianapolis is the clean winner on cap health**, combining top-five room with sub-$10M dead money.
- **Tennessee has top-five cap space**, but its effective cushion drops meaningfully once minimum roster costs are applied.
- **Houston's room is respectable, yet the $66.4M dead-money drag is a real constraint beneath the surface.**
- **Jacksonville is over the cap and carrying $53.3M dead**, making it one of the tougher 2026 cleanup jobs.

### AFC West

| Team | NFL Rank | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|----------|-----------|---------------------|------------|------|
| DEN | 19 | $18,623,570 | $14,586,793 | $1,218,922 | Cleanest dead-money sheet after SEA |
| KC | 16 | $21,351,968 | $11,356,301 | $9,773,977 | Contender, tighter cushion |
| LAC | 2 | $63,587,408 | $59,282,433 | $5,548,177 | Elite cap posture |
| LV | 9 | $37,925,609 | $25,169,525 | $52,012,266 | Dead-money distorted |

#### Top 5 Cap Hits

- **DEN:** Mike McGlinchey $23.8M, Ben Powers $18.2M, Patrick Surtain II $16.8M, Zach Allen $16.5M, D.J. Jones $14.6M
- **KC:** Chris Jones $44.9M, Patrick Mahomes $34.7M, Trey Smith $24.5M, Nick Bolton $19.3M, Jaylon Moore $18.7M
- **LAC:** Justin Herbert $46.3M, Derwin James $24.6M, Rashawn Slater $23.8M, Khalil Mack $18.0M, Joe Alt $9.0M
- **LV:** Maxx Crosby $35.8M, Kolton Miller $22.5M, Tyler Linderbaum $16.7M, Malcolm Koonce $11.0M, Jeremy Chinn $9.6M

#### Dead Money Detail

- **DEN:** Only $1.2M total dead money, the cleanest position in the league outside Seattle's nearly spotless sheet.
- **KC:** Jawaan Taylor's $7.4M is the main dead-money charge within a reasonable $9.8M total.
- **LAC:** Only $5.5M total dead money, supporting one of the most flexible books in football.
- **LV:** Christian Wilkins $29.8M and Geno Smith $16.2M account for most of a massive $52.0M dead-money total.

#### Key Observations

- **The Chargers own one of the league's best cap situations**: top-two space, top-two effective room, and low dead money.
- **Denver's balance sheet is exceptionally clean**, giving the club unusual freedom even without elite raw cap space.
- **Kansas City remains viable, but the stars-and-contenders tax is real** with only $11.4M effective room.
- **Las Vegas is a reminder that raw space can lie** when $52.0M is already trapped in dead money.

### NFC East

| Team | NFL Rank | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|----------|-----------|---------------------|------------|------|
| DAL | 22 | $15,209,634 | $7,295,503 | $42,744,177 | OTC discrepancy noted |
| NYG | 25 | $12,083,735 | $1,984,435 | $11,368,472 | Thin operating room |
| PHI | 26 | $11,520,188 | $6,373,697 | $52,031,852 | Heavy dead-money carry |
| WAS | 1 | $66,354,397 | $59,610,242 | $20,692,736 | Most space in NFL |

#### Top 5 Cap Hits

- **DAL:** Dak Prescott $43.5M, George Pickens $27.3M, Quinnen Williams $21.6M, CeeDee Lamb $19.8M, Rashan Gary $19.5M
- **NYG:** Brian Burns $36.6M, Dexter Lawrence $27.0M, Paulson Adebo $24.2M, Andrew Thomas $24.0M, Jevon Holland $18.5M
- **PHI:** Jalen Hurts $32.0M, A.J. Brown $23.4M, Dallas Goedert $20.5M, Lane Johnson $20.3M, Jordan Mailata $15.9M
- **WAS:** Daron Payne $28.0M, Laremy Tunsil $24.9M, Samuel Cosmi $20.3M, Terry McLaurin $18.0M, Javon Kinlaw $16.2M

#### Dead Money Detail

- **DAL:** Zack Martin $16.5M and Osa Odighizuwa $16.0M are the biggest pieces of a $42.7M dead-money bill. OTC also displayed a conflicting $1,149,634 figure elsewhere; cap-space page value used here.
- **NYG:** Bobby Okereke $5.5M is the largest dead-money hit in an otherwise manageable $11.4M total.
- **PHI:** Bryce Huff $16.6M, Darius Slay $13.3M, and James Bradberry $7.7M push dead money above $52.0M.
- **WAS:** Deebo Samuel $12.3M and Tyler Biadasz $8.1M headline a moderate $20.7M dead figure.

#### Key Observations

- **Washington has the best cap position in football** and can attack roster construction from strength.
- **Dallas is workable but not clean**, especially if the higher $15.2M cap-space figure is the operative number.
- **The Giants have almost no effective room**, despite technically sitting above water.
- **Philadelphia is still functional, but $52.0M dead money limits how aggressively it can pivot.**

### NFC North

| Team | NFL Rank | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|----------|-----------|---------------------|------------|------|
| CHI | 28 | $6,806,499 | $2,132,621 | $19,355,493 | Tight budget |
| DET | 11 | $35,944,651 | $30,923,104 | $26,468,791 | Core is expensive but healthy |
| GB | 13 | $29,099,808 | $27,339,690 | $39,199,303 | Strong room, heavier dead |
| MIN | 27 | $8,913,599 | $3,884,590 | $19,473,074 | Limited flexibility |

#### Top 5 Cap Hits

- **CHI:** Montez Sweat $25.1M, Jaylon Johnson $24.5M, Joe Thuney $21.5M, Dayo Odeyingbo $20.5M, Jonah Jackson $19.5M
- **DET:** Jared Goff $37.6M, Amon-Ra St. Brown $33.1M, Alim McNeill $29.0M, Penei Sewell $28.0M, D.J. Reed $17.9M
- **GB:** Jordan Love $36.1M, Micah Parsons $19.2M, Josh Jacobs $14.5M, Devonte Wyatt $12.9M, Nate Hobbs $12.8M
- **MIN:** Jonathan Allen $23.9M, Brian O'Neill $23.1M, Jonathan Greenard $22.2M, Justin Jefferson $21.2M, Andrew Van Ginkel $19.3M

#### Dead Money Detail

- **CHI:** D.J. Moore $12.0M and Drew Dalman $4.0M make up most of a $19.4M dead-money total.
- **DET:** Taylor Decker $9.4M and David Montgomery $4.9M are the biggest charges inside $26.5M dead.
- **GB:** Rashan Gary $17.0M and Kenny Clark $17.0M are the central drivers of a $39.2M dead-money load.
- **MIN:** Javon Hargrave $10.5M and Harrison Phillips $3.5M are the leading dead-money hits in a $19.5M total.

#### Key Observations

- **Detroit has successfully paid its core and still preserved strong flexibility**, a notable win for its cap management.
- **Green Bay has healthy room, but the $39.2M dead-money number is the caution flag.**
- **Chicago and Minnesota are both operating with thin effective cushions**, limiting discretionary moves.
- **The NFC North is not cap-broken, but only Detroit and Green Bay have meaningful maneuvering room.**

### NFC South

| Team | NFL Rank | Cap Space | Effective Cap Space | Dead Money | Flag |
|------|----------|-----------|---------------------|------------|------|
| ATL | 18 | $20,267,624 | $18,443,656 | $16,285,354 | Stable structure |
| CAR | 12 | $29,450,804 | $24,608,467 | $16,442,844 | Quietly healthy books |
| NO | 20 | $16,102,740 | $8,504,981 | $113,971,682 | Worst dead-money load in NFL |
| TB | 24 | $12,874,177 | $7,313,725 | $13,329,591 | Tight but manageable |

#### Top 5 Cap Hits

- **ATL:** Chris Lindstrom $26.3M, Jessie Bates III $24.8M, Kirk Cousins $24.6M, A.J. Terrell $22.5M, Drake London $16.8M
- **CAR:** Robert Hunt $24.3M, Jaycee Horn $24.0M, Trevon Moehrig $21.3M, Taylor Moton $21.1M, Tershawn Wharton $18.6M
- **NO:** Carl Granderson $18.1M, Chris Olave $15.5M, Cesar Ruiz $14.2M, Alvin Kamara $10.4M, Erik McCoy $10.3M
- **TB:** Baker Mayfield $40.0M, Tristan Wirfs $36.3M, Chris Godwin $33.7M, Antoine Winfield Jr. $27.5M, Luke Goedeke $22.7M

#### Dead Money Detail

- **ATL:** Darnell Mooney's $11.0M is the clear leader within a manageable $16.3M dead total.
- **CAR:** Austin Corbett $4.4M and Adam Thielen $3.3M headline a reasonable $16.4M dead-money number.
- **NO:** Derek Carr $36.7M, Cameron Jordan $18.8M, Demario Davis $14.3M, Taysom Hill $13.7M, Ryan Ramczyk $12.0M, and Tyrann Mathieu $7.2M create a staggering $114.0M dead-money bill.
- **TB:** Mike Evans $13.1M drives most of Tampa Bay's $13.3M dead total.

#### Key Observations

- **New Orleans is the league's cap warning label**: $114.0M dead money, by far the NFL's worst cleanup, and only $8.5M effective room.
- **Carolina quietly owns one of the healthier books in the conference**, with top-12 space and moderate dead money.
- **Atlanta has usable flexibility without severe structural damage**, unusual for a team carrying Kirk Cousins at $24.6M.
- **Tampa Bay is tight but not distressed**, with a concentrated veteran top end rather than a dead-money crisis.

### Learnings

- **Data collection timestamp:** 2026-03-13 from OTC cap-space and player contract pages 📊
- **League cap baseline:** OTC confirms a 2026 salary cap of $301,200,000 ✅
- **Forward planning baseline:** OTC currently points to a 2027 cap projection of $327,000,000 📊
- **Dead money remains the fastest shorthand for cap health** — raw cap space alone misses situations like MIA, NYJ, CLE, and NO.
- **Franchise tag values remain unresolved** because OTC's tag content rendered inconsistently and surfaced outdated data during collection ❓

�� Team update (2026-03-16T04:36:50Z): Multiple article decisions merged — Editor (Witherspoon), BUF, NYJ, DEN, HOU, IND, JAX, KC, LAC, LV, TEN, AFC North batch, Ralph loop retarget.

### 2026-03-15: KC Panel Position — Cap Crisis Analysis

- **One-year windows are real** — KC's 2026-2027 cap structure demonstrates the consequences of sustained can-kicking: $130.1M committed to two players (Mahomes + Jones) before filling 49 roster spots
- **The Mahomes 2027 megahit ($85.25M) was engineered as a renegotiation trigger** — teams build intentionally unsustainable cap years to force extensions; but this only works if you preserve cap flexibility to negotiate from strength
- **Trading All-Pro talent on rookie deals for cap space is usually a talent downgrade** — McDuffie ($13.5M 2026 savings) → Kohou ($9M AAV) saved money but created a competitive gap; elite corners on cost-controlled deals are assets, not liabilities
- **Multi-year cap modeling must account for dead money acceleration** — KC cleared $98M through trades/cuts/restructures in 2026, but much of that becomes 2027 dead money (void years, accelerated bonuses)
- **Chris Jones contract decision tree analysis** — at $44.85M/year for a 32-year-old DT, teams face three bad options: (1) accept the hit and gut depth, (2) extend and push the problem to 2028-2030, or (3) trade/cut and eat $27M dead money. This is the structural endpoint of cap can-kicking.
- **Kenneth Walker signing ($14.35M AAV RB) makes cap sense in context** — when your QB is post-ACL and can't extend plays, an explosive RB isn't a luxury; it's scheme insurance. Cap analysis must evaluate positional spending against offensive/defensive structure, not just positional value tiers.
- **Article panel work — financial trajectory analysis** — wrote position statement for KC Mahomes article mapping 2026-2027 cap structure, Jones decision tree, and McDuffie trade cap efficiency. Core recommendation: this is a one-year championship push; 2027's cap explosion forces restructuring or teardown.

### 2026-03-16: DEN Panel Position — TE Investment vs. Cap Flexibility

- **Post-June 1 designations create split-year dead money leverage** — Engram cut post-June 1 spreads $10.4M dead across 2026 ($5.2M) and 2027 ($5.2M), creating $3.8M usable space in 2026 while deferring half the pain to a year with better cap projections
- **Rookie-deal QB windows require cap-timeline discipline** — Nix at $5M/year through 2027 creates $45M annual surplus vs. market-rate QB; that surplus evaporates when extension hits in 2028, making every 2026-2027 dollar strategically valuable
- **R1 vs. R2 TE draft cost gap is material at scale** — #30 pick TE costs ~$3.1M/year vs. #62 pick at ~$1.8M/year; $1.3M annual savings over 4 years = $5.2M total, equivalent to retaining a rotational starter in 2027
- **First-round TE hit rate skepticism is data-driven** — Recent R1 TEs (Pitts, Kincaid, Hockenson) rarely produce elite Year 1 impact; rookie tight ends typically break out Year 2-3, misaligned with Denver's 2026-2027 championship window urgency
- **McGlinchey 2027 decision is the real cap constraint** — $23.8M cap hit for a 30-year-old RT in 2027 forces trade/cut decision; clearing that space enables early Nix extension (2027 vs. 2028) which saves 10-15% on total deal cost due to market timing
- **Early QB extensions reduce total cost via market-timing arbitrage** — Extending Nix in summer 2027 at projected $50M AAV beats waiting until 2028 when market inflation pushes rate to $55M AAV; $5M/year difference across 5-year deal = $25M saved
- **Sunk cost discipline on aging veterans** — Engram at 31 with declining production (50/461/1) and coaching trust issues (benched in playoffs) is a clear cut candidate; age curves for TEs show sharp decline post-30, making "one more year" bets statistically poor
- **Article panel work — TE investment vs. cap runway analysis** — wrote position for DEN Broncos TE article modeling three Engram scenarios, R1/R2 draft cost comparison, and 2027 McGlinchey trade strategy. Core recommendation: cut Engram post-June 1, draft ILB at #30, bank savings for in-season flexibility, preserve cap runway for Nix extension.


### 2026-03-XX: Titans Draft Analysis — Ridley Cut Math and Ward Window Arithmetic

Wrote Cap position for 	en-ward-vs-saleh-draft-identity article. Core tension: EDGE at #4 + cut Ridley (Path A, Saleh-aligned) vs. WR at #4 + keep Ridley (Path B, Ward-development-aligned).

**Key cap findings:**
- **Path A (EDGE + cut Ridley post-June-1):** Saves \.45M in 2026, creates \ remaining cap space, BUT leaves Ward with zero proven WR1s (bottom-5 supporting cast). Hidden cost: \ dead money acceleration into 2027.
- **Path B (WR at #4 + keep Ridley):** Costs \.45M more in 2026, BUT gives Ward two WR1s (Tate + Ridley) and functional supporting cast (middle-of-pack, rank 15-20). Clean 2027 exit: Ridley expires with \ dead money.
- **Cap space reality:** TEN has \.7M (5th in NFL), but current allocation favors defense once Ridley's albatross contract (\.45M for 822 yards) is removed.

**Recommendation:** Trade down to #7-11, draft Carnell Tate (WR), keep Ridley through 2026, use extra R2 pick on interior OL or developmental EDGE. This maximizes Ward's Year 2 support while preserving 2027 flexibility.

**Reusable insight:** Post-June-1 cuts aren't "free money" — they create dead money acceleration into the following year. For a franchise QB in Year 2-3, that future-year cap hit can constrain the exact window where you need flexibility for extensions. Always model the 2-year cap impact, not just Year 1 savings.

**Data sources:** OverTheCap team salary cap page (verified \.7M space, \.2M dead money, Ridley \.45M cap hit), panel positions from TEN/Draft/Defense agents.


### 2026-03-16: HOU Panel Position — Extension Sequencing Strategy

- **Extension timing is a market-timing decision** — waiting on QB extensions doesn't save money if the market escalates faster than cap growth; Stroud at $55M AAV in 2026 vs. $62M AAV in 2027 = $28M net savings over 4 years
- **Fifth-year options are bridges, not solutions** — using the 5th-year option on both Stroud ($26.5M) and Anderson ($21.5M) in 2027 creates one clean year, but defers the cap explosion to 2028 when both extensions hit simultaneously
- **Positional hierarchy dictates extension sequencing** — franchise QBs are irreplaceable; elite edge rushers are rare but draftable every 1-2 years. Extend the QB first, wait on EDGE to see if the market stabilizes or if injury/regression changes the calculus
- **Restructures are short-term cap loans with interest** — converting salary to signing bonus saves money in Year 1 but creates 2-3 years of dead money; acceptable for young core players (Stroud), dangerous for aging veterans (Tunsil at 30, Diggs at 32)
- **The "two-player cap crunch" threshold is 28-30%** — once QB+EDGE consume >30% of the cap ($90M+ of $300M), teams must operate with rookie-heavy rosters and minimal veteran depth; this is the Chiefs/Bengals/Bills model post-Mahomes/Burrow/Allen extensions
- **Draft capital value spikes before extension windows close** — Houston's 8 picks in 2026 (including 28, 38, 59, 69) are the last cost-controlled talent infusion before the cap compresses; a Day 2 DT starter costs $1.5M/year vs. $15M/year in 2027 free agency
- **Market comp selection matters more than player comparison** — Stroud's extension comp isn't "what is Stroud worth?" but "what tier is he in?" (Dak tier = $60M, Love/Burrow tier = $55M, Goff tier = $53M). A 1-tier miscalculation = $20M+ over 4 years.
- **Article panel work — multi-year cap modeling** — wrote position statement for HOU offseason article modeling Stroud + Anderson extensions across 2027-2030, restructure opportunities, and dead-money risks. Core recommendation: extend Stroud in 2026 at $55M AAV (saves $7M/year vs. waiting), use Anderson's 5th-year option, extend him in 2027 at $35M AAV.

### 2026-03-16: JAX Panel Discussion — Two-Way Player Cap Implications

**Article:** jax-2026-offseason (Travis Hunter Paradox)
**Panel role:** Cap specialist analyzing trade cost and 2026 cap crunch

**Key cap dynamics of two-way players:**
- Hunter's $7.8M 2026 cap hit is locked (Year 2 rookie deal, non-restructurable until Year 3)
- The trade cost (four picks including 2026 1st-rounder #19) created roster holes at RB/CB2/WILL LB that would have been filled with ~$3.5M rookie contracts
- Net cap inefficiency: paying $7.8M for part-time usage at two positions vs. $3.5M for full-time starter at one position
- Required restructures (Kirk $12M, Robinson $8M, Oluokun $6M) mortgage 2027 cap by $14M to solve 2026 crunch
- Trevor Lawrence's contract structure ($24M → $35M → $47M from 2026-2028) creates closing championship window that Hunter experiment must hit immediately

**Panel insight that made it into the position:**
The "missing 1st-round pick scenario analysis" — mapping pick #19 to specific prospects (Jeanty/Rivers/Walker) with exact contract costs showed the opportunity cost in dollars and roster composition, not just abstract "draft capital." This made the trade-off tangible: Jacksonville is paying $4M+ more for Hunter's part-time dual role than they would have paid for a full-time starter at RB/CB/LB.

**Cross-panel tension points:**
- JAX agent will argue Hunter's dual-threat value justifies the cost; Cap showed the math says it only works if he plays 17 games
- Defense will want more Hunter snaps at CB; Cap showed the salary allocation doesn't support CB1 usage given his WR salary tier
- Offense will argue maximize WR snaps; Cap agreed because that's where Hunter grades higher (82 PFF vs. 71 PFF), making it a better ROI

**Reusable pattern for future two-way player analysis:**
1. Calculate total cap hit for the two-way player
2. Map opportunity cost (what the draft picks/cap space would have bought instead)
3. Divide cap hit by actual snap % at each position to get "effective position cost"
4. Compare effective cost to market rates for full-time starters at those positions
5. If effective cost > market rate at both positions, the allocation is inefficient


### 2026-03-16: BAL Panel Position — Crosby Trade Cap Math and Two-Year Consequences

- **QB balloon payments destroy roster-building flexibility** — Lamar Jackson's escalating cap structure (.5M in 2026 → .5M in 2027 →  in 2028) consumes 26% of 2027 cap BEFORE any other moves; this creates a "zero-restructure zone" where any base-to-bonus conversion in 2026 compounds 2027 cap disaster
- **Elite positional players lost to cap triage have actual market values** — Linderbaum to LV at  AAV (NFL's best center) and Likely to NYG at .3M AAV ( total) demonstrate that "we couldn't afford them" translates to + in actual annual value forfeited to preserve future cap runway
- **Crosby trade math: .7M EDGE +  Hendrickson +  cap shortfall = lost offensive infrastructure** — Baltimore chose pass rush over center/TE retention, creating  total commitment to defensive front vs.  replacement cost for Linderbaum (rookie C Bullock) +  for Smythe (TE2); the math "works" only if 55+ sacks (vs. 30 in 2025) offset offensive regression from downgraded interior OL and TE depth
- **Two-year cap runway analysis reveals the real cost of win-now trades** — 2026 cap space at .2M (6th in NFL) looks healthy, but 2027 projects to only .3M with existing roster; the Crosby trade preserved 2027 flexibility by NOT restructuring to retain Linderbaum/Likely, betting that one elite pass-rush year (2026) is worth two years of championship-window constraint (2026-2027)
- **Strategic cap triage: center vs. TE2 isn't equal** — Linderbaum loss ( saved but immediate offensive impact) vs. Likely loss (.3M saved, mitigated by Andrews still at TE1) shows positional value asymmetry; Lamar Jackson's entire offensive ecosystem depends on center-QB chemistry, making Linderbaum the non-negotiable retention target in any scenario modeling
- **Scenario modeling must account for compounding dead money** — Scenario 1 (retain both) required  in restructures (Lamar .4M, Roquan .6M), pushing Lamar's 2027 hit from .5M to .9M (30% of cap) and Roquan to .3M; combined .2M for two players before filling 49 roster spots is roster-construction suicide
- **Post-June 1 designations weren't an option** — Baltimore had no "safe cut" candidates with >  savings; the dead-money table (.2M total) shows no single player with enough cap hit to create meaningful space without crippling a position group
- **Historical first-rounder trades create draft-pick opportunity cost** — Two consecutive years (2026 + 2027) without first-round picks = zero cheap rookie contracts at premium positions, zero trade-up ammunition, and zero margin for EDGE injury; if Crosby misses 2026 with injury, Baltimore has no draft capital to pivot
- **Article panel work — three-scenario cap modeling for trade analysis** — wrote position for BAL Crosby article modeling (1) retain Linderbaum+Likely [impossible without 2027 cap destruction], (2) retain Linderbaum only [viable but tight], (3) retain neither [actual outcome]. Core finding: the hardest cap constraint wasn't Crosby's .7M hit — it was Lamar's .5M 2027 balloon payment that made every 2026 restructure a future-cap poison pill.

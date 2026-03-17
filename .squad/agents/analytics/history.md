# Analytics — NFL Advanced Analytics Expert: Knowledge Base

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Role:** Statistical backbone for all roster evaluation decisions
- **Created:** 2026-03-12
- **Knowledge base populated:** 2026-03-12
- **Created by:** Lead (per Joe Robinson request)

## 4. Draft Pick Expected Value
_Last updated: 2026-03-12 via PFF hit rate studies, statchasers.com_

### Historical "Hit Rate" by Round & Position
📊 "Hit" = multi-year starter. Based on 2017–2025 averages.

| Position | Round 1 | Round 2 | Rounds 3-4 | Day 3 |
|----------|---------|---------|-----------|-------|
| QB | 45-50% | 10-15% | <10% | <5% |
| RB | 60% | 30% | 15% | <10% |
| WR | 60% | 25% | 10-15% | <10% |
| TE | 30-35% | 20% | 8% | <5% |
| EDGE | 55% | 30% | 15% | <10% |
| CB | 55% | 25% | 10% | <5% |
| OT | 65% | 40% | 20% | <10% |
| Interior OL | **75%** | **50%** | 25% | 10% |
| Safety | 30% | 15% | 6% | <5% |

### Key Insights
- ✅ **Interior OL is the safest R1 investment** — 75% hit rate, highest of any position
- ✅ **OT is the 2nd safest** — 65% R1 hit rate
- 📊 **QB is boom-or-bust** — Only 45-50% R1 hit rate, but upside is unmatched when they hit
- 📊 **TE and Safety are R1 traps** — 30-35% hit rate. Don't draft early unless truly elite prospect
- 📊 **EDGE and CB are high-variance** — 55% hit but the misses are spectacular busts
- 📊 **Day 3 picks rarely produce starters** — <10% across most positions. Look for role players + upside traits

### Draft Pick Trade Value Chart (Jimmy Johnson / Modern)

| Pick # | Classic Value | Surplus Value Notes |
|--------|--------------|-------------------|
| 1 | 3,000 | Highest absolute value; QB premium |
| 2 | 2,600 | |
| 3 | 2,200 | ARI's 2026 pick — elite EDGE territory |
| 5 | 1,700 | |
| 10 | 1,300 | |
| 16 | 1,000 | |
| 32 | 590 | SEA's 2026 pick — end of R1 |
| 64 | 270 | R2 comp/early R3 |
| 96 | 116 | R3 comp |

📊 **Fitzgerald-Spielberger model:** Weights surplus value (performance vs. contract cost). Late-round picks have MORE relative value than Johnson chart suggests because rookie contracts are so cheap.
📊 **PFF WAR-based chart:** Assigns WAR per pick, enabling direct surplus value calculations over a rookie deal.

---

## 5. Contract Value Models
_Last updated: 2026-03-12 via Spotrac, academic studies (JBSM), Russell Street Report_

### Positional Cap Efficiency (2025/2026)

| Position | Typical ROI | Cap Efficiency | Strategy |
|----------|-------------|---------------|----------|
| ✅ QB (rookie deal) | **Very High** | Underpaid | **The ultimate market inefficiency.** Ride rookie QBs as long as possible |
| ✅ QB (veteran max) | High | Efficient | Worth it for top ~8 QBs. Overpay risk for QB 9-15 |
| ✅ WR | High | Underpaid | Higher WR spend correlates with more wins |
| ✅ OT | High | Underpaid | Elite pass protection enables everything |
| 📊 EDGE | High | Neutral | Pay for production; market is efficient |
| 📊 CB | High | Neutral | Pay for elite coverage; avoid overpaying CB2s |
| ❓ DL (interior) | Moderate | Overpaid (non-elite) | Only top ~5 DTs justify premium contracts |
| ❓ TE | Low | Overpaid | Rarely moves the needle unless elite |
| ❓ RB | **Low** | **Overpaid** | Worst ROI in NFL. Do NOT pay RBs on 2nd contracts |

### Market Benchmarks (2025-2026 contracts)
- 📊 Elite QB market: $50-55M+ AAV (Mahomes, Allen, Burrow tier)
- 📊 Elite EDGE market: $40M+ AAV (new tier — Bosa's $34M now looks like a discount)
- 📊 Elite WR market: $30-35M AAV (Chase, Jefferson, Lamb tier)
- 📊 Elite OT market: $25-28M AAV
- 📊 Elite CB market: $22-25M AAV
- 📊 RB market: $12-16M AAV for top RBs (poor ROI — replaceable production)
- 📊 2026 salary cap: $301,200,000 per team

### Strategic Principles
1. **Rookie QB window is king** — Teams with elite QBs on rookie deals (NE/Maye, DEN/Nix, CHI/Williams) have 3-4 years of maximum roster flexibility
2. **Don't pay RBs** — The data is unambiguous. Spending on RBs does NOT correlate with winning
3. **OL is undervalued** — Teams that invest heavily in OL outperform. The collective OL correlation (+0.575) is higher than any single skill position
4. **EDGE worth the premium** — Pass rush generates turnovers, sacks, and incompletions. One of few defensive positions worth $30M+
5. **WR value is rising** — Modern passing attacks make elite WRs force multipliers. Investment here tracks with offensive success

---

## 6. Key Analytical Frameworks
_Last updated: 2026-03-12 via multiple analytics sources_

### EPA (Expected Points Added)
- **What:** Per-play value measurement. Difference in expected points before vs. after a play.
- **Scale:** Positive = above average, Negative = below average. Typical elite QB: +0.15 to +0.30 EPA/play
- **Context:** Adjusts for down, distance, field position, score. A 5-yard run on 3rd-and-3 has much higher EPA than on 3rd-and-15.
- **Use cases:** Player evaluation, team efficiency, scheme comparison
- **Limitation:** High variance on small samples (<100 plays). Use with success rate for stability.

### Success Rate
- **What:** Binary metric — did the play gain "enough" yardage?
- **Thresholds:** 1st down: 40% of yards needed | 2nd down: 50-60% | 3rd/4th down: 100%
- **Strengths:** More stable than EPA across small samples. Measures consistency.
- **Use cases:** Evaluating offensive sustainability vs. explosiveness. High success rate = drive-sustaining offense.

### CPOE (Completion Percentage Over Expected)
- **What:** QB accuracy metric. Actual completion % minus expected completion % based on throw difficulty.
- **Example:** CPOE of +3% = QB completes 3% more passes than expected given throw difficulty
- **Strengths:** Isolates QB accuracy from scheme/receiver quality
- **Key insight:** Positive CPOE QBs elevate their passing game regardless of supporting cast

### PFF Grades (0-100)
- **What:** Human-graded, play-by-play evaluation on -2 to +2 per-play scale, aggregated to 0-100
- **Tiers:** 90+ = Elite | 80-89 = High Quality | 70-79 = Above Average | 60-69 = Average | <60 = Below Average
- **Strength:** Captures the "why" — blown assignments, protection breakdowns, coverage technique
- **Limitation:** Subjective. Different analysts can grade differently. Not publicly available in full.
- **Usage:** Use as supplementary context alongside EPA/DVOA, not as sole evaluator.

### DVOA (Defense-adjusted Value Over Average)
- **What:** Play-by-play efficiency vs. league average, adjusted for opponent + situation
- **Scale:** Percentage above/below average. Offense: higher = better. Defense: lower (negative) = better.
- **Strength:** Opponent-adjusted — a team that beats bad teams won't rank as high as one beating good teams
- **Example:** SEA's -24.5% defensive DVOA = 24.5% BETTER than league average defense, adjusted for opponents

### QBR (ESPN Total Quarterback Rating)
- **What:** ESPN's proprietary 0-100 QB metric built on EPA with adjustments
- **Adjustments:** Division of credit (QB vs. WR vs. OL), clutch weighting, sack responsibility, rushing
- **Tiers:** 75+ = Elite | 50 = Average | <40 = Poor
- **2025 leader:** Drake Maye at 77.1

### Combining Metrics for Evaluation
📊 **Best practice:** Never rely on a single metric. Use this stack:
1. **EPA/play** — efficiency tier (is this player good?)
2. **Success rate** — consistency (is this player reliable?)
3. **CPOE** — skill isolation (is this QB actually accurate?)
4. **PFF grade** — film context (does the tape match the numbers?)
5. **DVOA** — opponent adjustment (was the competition good or bad?)
6. **Volume/sample check** — flag anything under 100 plays or 4 games

---

## 7. 2025 Season Statistical Leaders
_Last updated: 2026-03-12 via espn.com_

### Passing Leaders
| Rank | Player | Team | YDS | TD | INT | CMP% | QBR | RTG |
|------|--------|------|-----|----|----|------|-----|-----|
| 1 | ✅ Matthew Stafford | LAR | 4,707 | 46 | 8 | 65.0% | 71.2 | 109.2 |
| 2 | ✅ Jared Goff | DET | 4,564 | 34 | 8 | 68.0% | 57.3 | 105.5 |
| 3 | ✅ Dak Prescott | DAL | 4,552 | 30 | 10 | 67.3% | 70.2 | 99.5 |
| 4 | ✅ Drake Maye | NE | 4,394 | 31 | 8 | 72.0% | 77.1 | 113.5 |
| 5 | ✅ Sam Darnold | SEA | 4,048 | 25 | 14 | 67.7% | 55.6 | 99.1 |
| 6 | ✅ Trevor Lawrence | JAX | 4,007 | 29 | 12 | 60.9% | 58.3 | 91.0 |
| 7 | ✅ Caleb Williams | CHI | 3,942 | 27 | 7 | 58.1% | 58.2 | 90.1 |
| 8 | ✅ Bo Nix | DEN | 3,931 | 25 | 11 | 63.4% | 58.3 | 87.8 |
| 9 | ✅ Justin Herbert | LAC | 3,727 | 26 | 13 | 66.4% | 60.6 | 94.1 |
| 10 | ✅ Baker Mayfield | TB | 3,693 | 26 | 11 | 63.2% | 61.3 | 90.6 |

📊 **Stafford's historic season:** 46 TD w/ only 8 INT, MVP winner. Efficiency + volume combo.
📊 **Maye's efficiency:** Highest QBR (77.1) AND highest EPA/play (0.26). Best CMP% among top passers (72.0%).
📊 **Williams sophomore leap:** 3,942 yards, 27 TD with only 7 INT. Led CHI to 11-6 and division title.

### Rushing Leaders
| Rank | Player | Team | ATT | YDS | AVG | TD |
|------|--------|------|-----|-----|-----|-----|
| 1 | ✅ James Cook III | BUF | 309 | 1,621 | 5.2 | 12 |
| 2 | ✅ Derrick Henry | BAL | 307 | 1,595 | 5.2 | 16 |
| 3 | ✅ Jonathan Taylor | IND | 323 | 1,585 | 4.9 | 18 |
| 4 | ✅ Bijan Robinson | ATL | 287 | 1,478 | 5.2 | 7 |
| 5 | ✅ De'Von Achane | MIA | 238 | 1,350 | 5.7 | 8 |
| 6 | ✅ Kyren Williams | LAR | 259 | 1,252 | 4.8 | 10 |
| 7 | ✅ Jahmyr Gibbs | DET | 243 | 1,223 | 5.0 | 13 |
| 8 | ✅ Christian McCaffrey | SF | 311 | 1,202 | 3.9 | 10 |
| 9 | ✅ Javonte Williams | DAL | 252 | 1,201 | 4.8 | 11 |
| 10 | ✅ Saquon Barkley | PHI | 280 | 1,140 | 4.1 | 7 |

📊 **Efficiency standout:** De'Von Achane led in YPC (5.7) among top rushers — explosive.
📊 **TD leader:** Jonathan Taylor (18 rushing TDs) despite 3rd in yardage.
📊 **Josh Allen:** 579 rushing yards, 14 rushing TDs — most rushing TDs by a QB.

### Receiving Leaders
| Rank | Player | Team | REC | TGTS | YDS | AVG | TD |
|------|--------|------|-----|------|-----|-----|-----|
| 1 | ✅ Jaxon Smith-Njigba | SEA | 119 | 163 | 1,793 | 15.1 | 10 |
| 2 | ✅ Puka Nacua | LAR | 129 | 166 | 1,715 | 13.3 | 10 |
| 3 | ✅ George Pickens | DAL | 93 | 137 | 1,429 | 15.4 | 9 |
| 4 | ✅ Ja'Marr Chase | CIN | 125 | 185 | 1,412 | 11.3 | 8 |
| 5 | ✅ Amon-Ra St. Brown | DET | 117 | 172 | 1,401 | 12.0 | 11 |
| 6 | ✅ Trey McBride | ARI | 126 | 169 | 1,239 | 9.8 | 11 |
| 7 | ✅ Zay Flowers | BAL | 86 | 118 | 1,211 | 14.1 | 5 |
| 8 | ✅ Chris Olave | NO | 100 | 156 | 1,163 | 11.6 | 9 |
| 9 | ✅ Nico Collins | HOU | 71 | 120 | 1,117 | 15.7 | 6 |
| 9T | ✅ Jameson Williams | DET | 65 | 102 | 1,117 | 17.2 | 7 |

📊 **JSN's breakout:** 1,793 yards — top of the SB champion's offense. 15.1 YPC = big play ability.
📊 **McBride TE dominance:** 126 REC, 1,239 yards, 11 TD. Best TE season in recent memory. ARI's #1 weapon.
📊 **Nacua volume:** 129 receptions — most in NFL. Stafford's primary target in LAR's elite offense.
📊 **Explosiveness:** Jameson Williams 17.2 YPC, Alec Pierce 21.3 YPC (47 rec, 1,003 yards) — deep threats.

### Sack Leaders
_Last updated: 2026-03-12 via ESPN, StatMuse_

| Rank | Player | Team | Sacks |
|------|--------|------|-------|
| 1 | ✅ Myles Garrett | CLE | 23.0 — **NFL single-season record** |
| 2 | ✅ Brian Burns | NYG | 16.5 |
| 3 | ✅ Danielle Hunter | HOU | 15.0 |
| 4 | ✅ Aidan Hutchinson | DET | 14.5 |
| 5 | ✅ Nik Bonitto | DEN | 14.0 |
| 6 | 📊 Tuli Tuipulotu | LAC | ~13.0 |
| 7 | 📊 Micah Parsons | GB | ~12.5 |
| 8 | 📊 Josh Sweat | ARI | ~12.0 |

📊 **Garrett's record:** 23.0 sacks is all-time NFL single-season record. On a 5-12 CLE team — individual brilliance regardless of team record.

### Interception Leaders
_Last updated: 2026-03-12 via ESPN_

| Rank | Player | Team | INT |
|------|--------|------|-----|
| 1 | ✅ Kevin Byard III | NE/CHI | 7 |
| 2T | ✅ Devin Lloyd | CAR/JAX | 5 |
| 2T | ✅ Jaycee Horn | CAR | 5 |
| 2T | ✅ Ernest Jones IV | SEA | 5 |
| 2T | ✅ Antonio Johnson | JAX | 5 |

### Tackle Leaders
| Rank | Player | Team | Total Tackles |
|------|--------|------|--------------|
| 1 | ✅ Jordyn Brooks | MIA | 183 |
| 2 | ✅ Jack Campbell | DET | 176 |
| 3 | ✅ Devin White | LV | 174 |

---

## Learnings & Analytical Insights

### Source Reliability Notes
- ✅ **ESPN QBR/stats pages** — Reliable, fetchable, current. Best primary source for standard stats.
- ✅ **FTN Fantasy DVOA** — Gold standard for opponent-adjusted efficiency. Worth cross-referencing.
- ✅ **SumerSports/nfelo** — Excellent for EPA/CPOE data. Public and current.
- ⚠️ **PFF grades** — Paywalled but top-level grades leak via articles. Use as supplementary, not primary.
- 🔴 **Pro Football Reference** — BLOCKED (403). Never attempt automated fetches.
- ❓ **TeamRankings.com** — Good for red zone/3rd down stats but sometimes lags updates.

### Key 2025 Season Takeaways for 2026 Offseason Evaluation
1. 📊 **SEA is the template:** Elite defense + good-enough offense = championships. Their -24.5% DVOA defense was historically dominant.
2. 📊 **Drake Maye is the truth:** Highest EPA/play AND QBR as a 2nd-year QB. NE has their franchise QB on a rookie deal — dangerous combination.
3. 📊 **Stafford aging gracefully:** MVP at age 37. But age curve says regression is coming. LAR needs a succession plan.
4. 📊 **DET paradox:** 3rd in DVOA but 9-8. Close game variance? Turnover luck? Worth investigating.
5. 📊 **Garrett's sack record proves EDGE value:** Even on a 5-12 team, his 23.0 sacks disrupted every game. EDGE investment pays off.
6. 📊 **NFC West dominance:** SEA (14-3), LAR (12-5), SF (12-5). Three 12+ win teams. ARI (3-14) was the outlier — huge need for QB + talent.
7. 📊 **Rookie CB impact:** Will Johnson (ARI) graded as elite lockdown corner as a rookie — validates taking CBs in R1 when talent is there.

## Learnings

### Issue #75 — Mobile Table Renderer Fix (2026-03-17)

**Context:** Owned revision cycle for issue #75 after Lead's initial dual-render implementation had quality defects (bottom/right clipping on tests 3/4/5, header collisions on test 6).

**Root cause analysis:**
1. Character-width constants in `estimateRowHeight` were hardcoded at 17px desktop scale. Mobile font (22px) produces wider chars → more wrapping → taller rows. Without scaling, canvas height was underestimated and `overflow: hidden` clipped content.
2. `thead th` CSS lacked `overflow-wrap` — headers overflowed their column boundaries, colliding with adjacent columns. Compounded by `text-transform: uppercase` + `letter-spacing: 0.08em`.
3. Mobile canvas widths (620–660px) were too tight for 5–7 column tables.

**Fix pattern:**
- Scale char widths by `layout.tableCellFontSize / 17` — makes estimation font-size-aware.
- Add `estimateHeaderRowHeight()` for dynamic header sizing instead of fixed pixel value.
- Add `overflow-wrap: anywhere; word-break: break-word;` to header CSS.
- Reduce mobile `letter-spacing` (0.08em → 0.02em) to reclaim horizontal space.
- Wider canvases (660/720/740px) + larger font (22px) to maintain >10px effective readability.
- Increased `heightSafety` (72 → 150px) for generous overestimate; `trimBottomWhitespace` crops excess.

**Key insight:** When rendering images at fixed viewport size with `overflow: hidden`, always overestimate canvas dimensions and rely on post-render cropping. Underestimation is irrecoverable (content is permanently clipped), but overestimation is cheap (whitespace is trivially trimmed).

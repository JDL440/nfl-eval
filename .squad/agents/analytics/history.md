# Analytics — NFL Advanced Analytics Expert: Knowledge Base

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Role:** Statistical backbone for all roster evaluation decisions
- **Created:** 2026-03-12
- **Knowledge base populated:** 2026-03-12
- **Created by:** Lead (per Joe Robinson request)

## Data Sources & Access

| Source | Primary Use | Access Status |
|--------|------------|---------------|
| PFF | Player grades (0–100), snap counts, pressures, coverage | ⚠️ Paywalled — cite from public references |
| ESPN | QBR, team/player stats, win probability, schedules | ✅ Fetchable via web_fetch |
| Pro Football Reference | AV, career stats, historical comps | 🔴 HTTP 403 — blocked for automated access |
| Next Gen Stats (NFL.com) | Tracking data: separation, speed, completion probability | ⚠️ Limited to NFL.com articles |
| FTN Fantasy (fmr Football Outsiders) | DVOA, DYAR, opponent-adjusted efficiency | ⚠️ Partial public access |
| SumerSports / nfelo | EPA, CPOE, advanced QB stats | ✅ Public |
| OTC / Spotrac | Cap data for contract value analysis | ✅ Fetchable (see skills/) |

---

## 1. Team Efficiency Rankings (2025 Season)
_Last updated: 2026-03-12 via FTN Fantasy (DVOA), ESPN (team stats)_

### Total DVOA Rankings (Top 10)
📊 Source: FTN Fantasy final 2025 DVOA ratings

| Rank | Team | Total DVOA | Off DVOA | Def DVOA | Notes |
|------|------|-----------|----------|----------|-------|
| 1 | ✅ SEA | +41.3% | +4.6% | -24.5% | SB LX Champions. Best D since 1978 by DVOA |
| 2 | ✅ LAR | +39.9% | +33.5% | -9.2% | Top 10 all-time DVOA. Led NFL in scoring (518 pts) |
| 3 | ✅ DET | +21.5% | — | -8.5% | 9-8 record; didn't make playoffs despite elite DVOA |
| 4 | ✅ HOU | +19.0% | — | -18.4% | 2nd-best defense by DVOA |
| 5 | ✅ IND | +18.9% | — | — | Highest DVOA ever for a team with losing record (8-9) |
| 6 | ✅ JAX | +17.7% | +6.4% | -11.0% | 13-4, AFC South champs |
| 7 | ✅ DEN | +14.5% | — | — | 14-3, AFC West champs |
| 8 | ✅ BUF | +12.6% | +13.0% | — | 12-5, perennial contender |
| 9 | ✅ NE | +10.6% | +22.3% | — | 14-3. Drake Maye breakout. Won AFC |
| 10 | ✅ SF | +9.9% | +20.6% | — | 12-5, WC loss to SEA |

**Other notable offensive DVOA:** GB +20.7% (6th off), SF +20.6% (7th off)
**Worst defensive DVOA:** CIN (historically poor — worst through 11 games since 1978)

### Offensive Team Rankings (ESPN — Total Yards)
_Last updated: 2026-03-12 via espn.com_

| Rank | Yards | YDS/G | Pass YDS | Rush YDS | PTS | PTS/G |
|------|-------|-------|----------|----------|-----|-------|
| 1 | 6,709 | 394.6 | 4,557 | 2,152 | 518 | 30.5 |
| 2 | 6,663 | 391.9 | 4,527 | 2,136 | 471 | 27.7 |
| 3 | 6,449 | 379.4 | 4,258 | 2,191 | 490 | 28.8 |
| ❓ Note: ESPN did not include team names in scraped output — ranked by total yards

**Top scoring offenses:** #1 at 30.5 PPG (likely LAR), #2 at 28.8 PPG, #3 at 28.4 PPG
**Bottom offenses:** 14.2 PPG (32nd), 16.4 PPG (31st), 16.7 PPG (30th)

### Defensive Team Rankings (ESPN — Yards Allowed)
_Last updated: 2026-03-12 via espn.com_

**Top 5 defenses (yards allowed):**
| Rank | YDS | YDS/G | Pass YDS Allowed | Rush YDS Allowed | PTS Allowed | PTS/G |
|------|-----|-------|-----------------|-----------------|-------------|-------|
| 1 | 4,713 | 277.2 | 3,120 | 1,593 | 295 | 17.4 |
| 2 | 4,730 | 278.2 | 3,182 | 1,548 | 311 | 18.3 |
| 3 | 4,804 | 282.6 | 2,694 | 2,110 | 333 | 19.6 |
| 4 | 4,822 | 283.6 | 2,843 | 1,979 | 379 | 22.3 |
| 5 | 4,849 | 285.2 | 3,058 | 1,791 | 340 | 20.0 |

📊 Cross-referencing DVOA: SEA (best DVOA D at -24.5%), HOU (2nd at -18.4%), JAX (-11.0%)

### Red Zone Efficiency (2025)
_Last updated: 2026-03-12 via teamrankings.com, shurzy.com_

| Team | RZ TD% | Notes |
|------|--------|-------|
| ✅ PHI | 70.97% | League leader — elite finishing |
| 📊 GB | ~65% | Top 3 |
| 📊 LAR | ~64.4% | Stafford/weapons elite in RZ |
| 📊 BUF | ~67.1% | Josh Allen RZ monster |
| ❓ NO | ~41.2% | Worst — settled for FGs too often |

### 3rd Down Conversion Rate (2025)
_Last updated: 2026-03-12 via teamrankings.com, foxsports.com_

| Rank | Team | 3rd Down % |
|------|------|-----------|
| 1 | ✅ SF | 50.0% |
| 2 | ✅ GB | 48.8% |
| 3 | ✅ BUF | 46.4% |
| 4 | ✅ LAC | 45.8% |
| 5 | ✅ CHI | 43.8% |
| 6 | 📊 CIN | 43.4% |
| 7 | 📊 IND | 42.6% |
| 8 | 📊 NE | 42.9% |
| Bottom | ❓ MIN | 31.8% |

### Turnover Differential (2025)
_Last updated: 2026-03-12 via espn.com_

| Rank | DIFF | Takeaways (INT/FUM) | Giveaways (INT/FUM) |
|------|------|---------------------|---------------------|
| 1 | +22 | 33 (23 INT, 10 FUM) | 11 (7 INT, 4 FUM) |
| 2 | +17 | 29 (19 INT, 10 FUM) | 12 (9 INT, 3 FUM) |
| 3 | +13 | 31 (22 INT, 9 FUM) | 18 (12 INT, 6 FUM) |
| 4 | +12 | 27 (15 INT, 12 FUM) | 15 (9 INT, 6 FUM) |
| 5 | +11 | 26 (16 INT, 10 FUM) | 15 (8 INT, 7 FUM) |
| Worst | -19 | 4 (0 INT, 4 FUM) | 23 (13 INT, 10 FUM) |

📊 The +22 leader had 33 takeaways vs only 11 giveaways — elite ball security + opportunistic D.

### 2025 Final Standings & Playoff Results
_Last updated: 2026-03-12 via multiple sources_

**Division Champions:**
- ✅ AFC East: New England (14-3)
- ✅ AFC North: Pittsburgh (10-7)
- ✅ AFC South: Jacksonville (13-4)
- ✅ AFC West: Denver (14-3)
- ✅ NFC East: Philadelphia (11-6)
- ✅ NFC North: Chicago (11-6)
- ✅ NFC South: Carolina (8-9) — weakest division winner
- ✅ NFC West: Seattle (14-3)

**Wild Cards:** BUF, HOU, LAC (AFC) | LAR, GB, SF (NFC)

**Super Bowl LX:** ✅ Seattle 29, New England 13
- SEA dominated with historically great defense (-24.5% DVOA)
- NE's Drake Maye couldn't overcome SEA pass rush

**Awards:**
- ✅ MVP: Matthew Stafford (LAR) — 4,707 yards, 46 TD, 8 INT
- ✅ OROY: Tetairoa McMillan
- ✅ DROY: Carson Schwesinger

---

## 2. Positional Value Analysis
_Last updated: 2026-03-12 via PFF WAR research, Bleacher Report, ESPN positional rankings_

### Position Correlation with Team Wins (WAR-equivalent model)

| Rank | Position | Correlation w/ Wins | Tier |
|------|----------|-------------------|------|
| 1 | 📊 QB | +0.655 | **Premium** — By far most valuable. Elite QB play adds ~3-4 WAR |
| 2 | 📊 OL (collective) | +0.575 | **Premium** — Protects the QB, enables run game |
| 3 | 📊 CB | +0.420 | **Premium** — Pass-first league makes shutdown corners critical |
| 4 | 📊 DL/EDGE | +0.398 | **Premium** — Pressure = turnovers + incompletions |
| 5 | 📊 LB | +0.380 | **Above Average** — Modern coverage LBs more valuable |
| 6 | 📊 WR | +0.350 | **Above Average** — Value surging; shapes schemes |
| 7 | 📊 RB | +0.250 | **Replaceable** — Elite RBs exist, but position is fungible |
| 8 | 📊 TE | +0.180 | **Replaceable** — Unless you have a Kelce/McBride type |
| 9 | 📊 K | +0.120 | **Minimal** |
| 10 | 📊 P | +0.050 | **Minimal** |

### Key Takeaways for Team Building
- ✅ **"Premium 5" positions:** QB, OT, CB, EDGE, WR — these should consume 65-70% of cap
- 📊 **Trenches > Skill:** OL + DL correlations combined (~0.97) exceed all skill positions
- 📊 **RB is replaceable:** Consistently the worst ROI at premium contracts. Find Day 2/3 draft value
- 📊 **TE is boom-or-bust:** Only the top ~5 TEs league-wide meaningfully impact wins
- 📊 **Passing game positions dominate:** QB + WR + CB + EDGE = the modern NFL value chain

---

## 3. Top Players by Advanced Metrics (2025 Season)

### QB EPA Leaders
_Last updated: 2026-03-12 via SumerSports, nfelo, ESPN QBR_

| QB | Team | EPA/play | Total EPA | Pass YDS | TD | INT | QBR |
|----|------|---------|-----------|----------|----|----|-----|
| ✅ Drake Maye | NE | 0.26 | 113.9 | 4,394 | 31 | 8 | 77.1 |
| ✅ Jordan Love | GB | 0.24 | 86.5 | 3,381 | 23 | 6 | 72.7 |
| ✅ Brock Purdy | SF | 0.23 | 52.8 | 2,549 | 21 | 7 | 72.8 |
| ✅ Matthew Stafford | LAR | 0.17 | 99.8 | 4,707 | 46 | 8 | 71.2 |
| ✅ Josh Allen | BUF | 0.17 | 83.2 | 3,668 | 25 | 10 | 65.4 |
| ✅ Daniel Jones | IND | 0.17 | 57.6 | 3,101 | 19 | 8 | 63.0 |

**QBR Season Rankings (ESPN):**
1. Drake Maye (NE) — 77.1
2. Brock Purdy (SF) — 72.8
3. Jordan Love (GB) — 72.7
4. Matthew Stafford (LAR) — 71.2
5. Dak Prescott (DAL) — 70.2
6. Patrick Mahomes (KC) — 68.5
7. Josh Allen (BUF) — 65.4
8. Daniel Jones (IND) — 63.0
9. Lamar Jackson (BAL) — 62.7

📊 **Maye's breakout is real:** Highest EPA/play AND highest QBR in the league. Elite efficiency with volume (662 action plays).
📊 **Stafford's MVP case:** Volume king — 4,707 yards, 46 TD with only 8 INT. Lower EPA/play than Maye but massive total EPA.
📊 **Purdy small sample:** Only 13 games / 344 plays, but elite efficiency when healthy.

### PFF Grade Leaders by Position (2025)
_Last updated: 2026-03-12 via PFF public articles_

**EDGE Rushers:**
| Player | Team | PFF Grade | Notes |
|--------|------|-----------|-------|
| ✅ Will Anderson Jr. | HOU | 93.1 | Best EDGE grade in NFL |
| ✅ Myles Garrett | CLE | 92.7 | NFL single-season sack record (23.0) |
| ✅ Micah Parsons | GB | 92.0 | Elite despite new team |
| 📊 Maxx Crosby | LV | ~90+ | Consistent top-5 EDGE |
| 📊 Aidan Hutchinson | DET | ~90+ | 14.5 sacks before injury impact |
| 📊 T.J. Watt | PIT | ~88+ | Still producing at elite level |

**Cornerback:**
| Player | Team | PFF Grade | Notes |
|--------|------|-----------|-------|
| ✅ Will Johnson | ARI (R) | Elite | Only 65 yards allowed into coverage — lockdown rookie |

**Offensive Line:**
| Player | Team | PFF Grade | Notes |
|--------|------|-----------|-------|
| ✅ Penei Sewell | DET | Historic | Highest PFF grade ever for OL through first 5 games |
| 📊 Zack Martin | DAL | Elite | Perennial top-graded IOL |

---

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

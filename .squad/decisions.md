# Squad Decisions

## Active Decisions

### 2026-03-14: Phase 2 Automation — Scale & Quality Gates
**By:** Joe Robinson (via Copilot)
**Status:** Adopted
**What:** 
1. Upgrade all Phase 2 coding agents (Backend, Frontend) to use claude-opus-4.6 for implementation (was auto/Sonnet)
2. Upgrade Lead reviewer to claude-opus-4.6 for code review + PR approval authority
3. Add Playwright E2E testing framework for Dashboard UI + integration validation
4. Automate CI with GitHub Actions (phase2-ci.yml) — tests run on every PR/push to squad/* branches
5. Agents validate locally before pushing: run tests, confirm pass, summarize results in PR description
6. Fix .gitignore to include Playwright artifacts, database WAL files, test results, env files
7. Split large PRs into smaller units: 1-2 features per PR, incremental commits, continuous validation

**Why:** Large monolithic PRs are hard to review. Opus 4.6 improves code quality. Local testing + CI creates feedback loop before human review. Lead can make decisions based on objective test results, not guesswork. Smaller PRs unblock faster iteration.

**Impacts:** All Phase 2 agents (Backend/Frontend/Tester), Lead reviewer, GitHub Actions CI, new Playwright test suite

### 2026-03-12: User directive — Model override
**By:** Joe Robinson (via Copilot)
**What:** All agents should use claude-opus-4.6 model. No exceptions.
**Why:** User request — premium tier for maximum quality on NFL domain analysis.

### 2026-03-12: User directive — Role-based agent names
**By:** Joe Robinson (via Copilot)
**What:** Rename specialist agents from Ocean's Eleven cast names to role-based names: Danny→Lead, Rusty→Cap, Livingston→Injury, Linus→Draft, Basher→Offense, Turk→Defense, Virgil→SpecialTeams. Easier to remember.
**Why:** User request — role-based names are more intuitive for an NFL domain team.

### 2026-03-12: User directive — 1M context fallback
**By:** Joe Robinson (via Copilot)
**What:** If agents hit context window limits or compaction, switch them to claude-opus-4.6-1m (1M context) model.
**Why:** User request — agents doing heavy research may need larger context windows to avoid data loss.

### 2026-03-12: NFC West 2026 Cap Landscape — Strategic Findings
**By:** Cap (Salary Cap Specialist)
**Status:** Proposed
**Affects:** ARI, LAR, SF, SEA team agents; Draft agent; Trade agent

**What:**
1. **SF faces a cap crisis** — $16.1M effective space, $36.2M dead money, projected $13.7M OVER the 2027 cap. Worst multi-year position in the NFC West. Purdy's $24.4M cap hit is SF's one structural advantage.
2. **SEA has cap ammo but lost key starters** — Cleanest cap in NFL ($483K dead money), $40.5M space. Lost Mafe, Walker III, Bryant in free agency. Can make 2-3 more signings or trade up in draft.
3. **ARI is best positioned for sustained competitiveness** — $41.7M raw space (7th in NFL), healthy 2027 outlook (~$17.2M projected). Buying window.
4. **LAR is cap-constrained with aging core** — $20.5M space (17th), 63% of cap on offense. Stafford ($48.3M) and Adams ($28M at 34) create aging-core risk. Only ~$3.2M projected for 2027.
5. **Edge rusher market diverged** — Elite tier now $40M+ AAV. Bosa's $34M AAV aging well relative to market. SEA's Nwosu at $9.76M is below market.

**Why:** Based on OTC and Spotrac data, cross-verified with ✅ confidence tags. 2027 projections from OTC multi-year models.

### 2026-03-12: 2026 NFL Draft Class — NFC West Implications
**By:** Draft (Draft Expert Specialist)
**Status:** Proposed
**Affects:** ARI, LAR, SF, SEA team agents

**What:**
1. **ARI holds pick #3** — Elite EDGE available (Bain Jr., Bailey). Full 7-round capital.
2. **LAR at #13** (acquired from ATL) — Access to top WR, OT, or CB talent.
3. **SF at #27** — Missing R3 pick (sent to DAL). Late first-round BPA approach likely.
4. **SEA at #32** — Mostly intact capital through R1-R3. Classic BPA spot.
5. **Defense-heavy class** — EDGE, LB, S, CB dominate top 15. Only consensus R1 QB is Mendoza (#1 to LV).
6. **Combine risers:** Sadiq (TE, Oregon), Styles (LB, Ohio State), Iheanachor (OT, Arizona State).

**Why:** Draft is April 23–25, 2026. Team agents need prospect-to-need mapping at their respective draft positions.

### 2026-03-12: Data Source Strategy for Web Research
**By:** Lead (Team Lead Specialist)
**Status:** Proposed
**Affects:** All 32 team agents, all 7 specialists

**What:**
- **Primary sources:** OTC for salary cap, Spotrac for free agents/contracts, ESPN for rosters/depth/transactions, NFL.com for UFA/RFA/ERFA tags.
- **Blocked:** Pro Football Reference returns 403 on all URLs — do NOT attempt PFR fetches.
- **Constraints:** OTC free agency page is JS-rendered (use Spotrac). OTC player IDs can't be guessed. Use `max_length=10000+` for cap/roster pages.

**Why:** Probed 15+ URLs across 5 data sources on 2026-03-12. PFR blocks automated access. Documented in `.squad/skills/`.

### 2026-03-13: User directive — Verify FA availability before recommending
**By:** Joe Robinson (via Copilot)
**What:** When trades/signings are reported by multiple outlets, consider them high confidence (🟢 Likely). Agents should check availability before recommending FA targets — don't suggest players who are already signed or traded.
**Why:** User request — avoid recommending unavailable players. Accuracy over speculation.

### 2026-03-13: FA Availability Alert — Seahawks targets revised
**By:** Media (NFL Media & Rumors Specialist)
**Status:** Proposed
**Priority:** HIGH
**Affects:** SEA team agent, Lead, all specialists who contributed to Seahawks FA analysis

**What:**
Of 20 players recommended in Seahawks FA analysis, 7 are confirmed unavailable (signed or traded). Key removals: Hendrickson (BAL), Koonce (LV re-sign), Awuzie (BAL), T. Johnson (traded LV), Kohou (KC), R. White (WSH), Deebo Samuel (contract voided — now UFA again). Still available: Bosa, Clowney, Von Miller, Calais Campbell, Lattimore, Douglas, Hobbs, Tre'Davious White, Najee Harris, Bobby Wagner, D.J. Reader, Jauan Jennings. EDGE, CB, and RB groups need revision.
**Why:** FA market moves fast. Several recommendations were outdated within hours of publication. All future target boards must verify current availability.

### 2026-03-13: Washington State Millionaires Tax changes Seattle's tax advantage
**By:** PlayerRep (Player Advocate & CBA Expert)
**Status:** Proposed
**Priority:** HIGH
**Affects:** SEA team agent, Cap, Lead, all specialists who referenced Seattle's "zero income tax" advantage

**What:**
WA passed SB 6346 on 2026-03-12 — 9.9% income tax on all personal income over $1M/yr, effective 2028-01-01. Applies to W-2 salary and visiting-athlete jock tax. Constitutional challenge likely (40–60% chance struck down). For 2026–2027, Seattle retains zero-tax advantage. For 2028+, a $20M/yr SEA contract loses ~$1.88M/yr to state tax — dropping the "$20M in SEA = $23M in SF" narrative to approximately "$20M in SEA ≈ $20.8M in SF." Short-term deals unaffected; multi-year deals need front-loading. Rookie contracts under $1M/yr unaffected regardless.
**Why:** Fundamentally changes Seattle's FA recruiting pitch for contracts extending past 2027. All prior analyses claiming zero-tax advantage need asterisks. TX/FL/TN/NV teams now have unambiguous tax edge over SEA.

### 2026-03-13: Media Daily Sweep — FA Wave 1 (22+ signings, Crosby trade voided, Tua to ATL)
**By:** Media (NFL Media & Rumors Specialist)
**Status:** Proposed
**Priority:** HIGH
**Affects:** ATL, PIT, IND, LV, BAL, SF, BUF, NYG, DAL, PHI, CAR, WSH, ARI, MIA, KC, SEA, LAR, MIN team agents; Cap, Draft, Injury, Offense, Defense, Lead specialists

**What:**
Full 24-hour sweep (March 12-13) during FA Wave 1. 22+ confirmed signings, 2 trades (1 voided), 2 releases, 1 retirement. Key moves:
- Tua Tagovailoa → ATL (1yr/$1.3M vet min). Kirk Cousins released outright by ATL.
- Maxx Crosby → BAL trade **VOIDED** (failed physical). LV keeps Crosby + #1 pick.
- Alec Pierce extended by IND (4yr/$116M). Michael Pittman Jr. traded to PIT (3yr/$59M ext).
- PIT also signed Dean (3yr/$36.75M), Dowdle (2yr/$12.5M), Brisker (1yr/$5.5M). Major win-now build.
- Rumor resolutions: Tua confirmed, Crosby voided, Cousins released (not traded), Garrett Wilson trade debunked, ARI #3 pick trade cooling, Minshew to ARI (not KC).

**Why:** Comprehensive free agency tracking ensures all agents have accurate, current roster data. 7 rumor resolutions prevent recommending unavailable players. Dashboard updated at `.squad/agents/media/history.md`.

### 2026-03-14: Media Daily Sweep — FA Day 3 (24+ new moves, Rodgers downgrade, mega-deals)
**By:** Media (NFL Media & Rumors Specialist)
**Status:** Proposed
**Priority:** HIGH
**Affects:** CAR, WSH, LV, NE, CIN, CHI, CLE, DAL, DEN, TB, NYJ, MIA, DET, SF, PHI, NYG, LAC, BUF, PIT, ARI team agents; Cap, Draft, Injury, Offense, Defense, Lead specialists

**What:**
Comprehensive 48-hour sweep (March 13-14) covering Day 2-3 of free agency. 24+ new confirmed transactions:
- Jaelan Phillips → CAR (EDGE, 4yr/$120M). Odafe Oweh → WSH (EDGE, 4yr/$100M). EDGE market now $25-30M AAV.
- Tyler Linderbaum → LV (C, 3yr/$81M). Romeo Doubs → NE (WR, 4yr/$68-80M).
- Bryan Cook → CIN (S, 3yr/$40.25M). Devin Bush → CHI (LB, 3yr/$30M). Jedrick Wills → CHI (OT, 1yr).
- Elgton Jenkins → CLE (OL, 2yr/$24M). Rashan Gary → DAL (DE, 2yr/$32M). Javonte Williams → DAL (RB, 3yr/$24M).
- J.K. Dobbins re-signed by DEN (RB, 2yr/$20M). Kenneth Gainwell → TB (RB, 2yr/$14M).
- NYJ acquired Geno Smith (trade from LV) + Minkah Fitzpatrick (trade from MIA, 3yr/$40M ext).
- MIA traded Fitzpatrick to NYJ. Full rebuild mode ($67M dead cap).
- Rodgers return to PIT DOWNGRADED to 🟡 Possible (was 🟢 Likely). Retirement probable. No contract offer.
- ARI #3 pick trade buzz UPGRADED to 🟡 Active. ESPN mocks show EDGE at #3, possible trade back for Ty Simpson.
- Total confirmed FA transactions tracked: 65+. Active rumors: 14.

**Why:** Day 3 FA sweep ensures all agents have accurate rosters. Rodgers downgrade is biggest strategic shift — PIT win-now plan at risk. EDGE market ($120M Phillips, $100M Oweh) resets benchmarks. NYJ becoming dark horse via trades. MIA in full rebuild.

### 2026-03-14: M3 Test Strategy — End-to-End Test Suite
**By:** Tester (QA & Test Automation Engineer)
**Status:** Proposed
**Priority:** P0 (blocks M4 production deployment)
**Affects:** Backend (M1), Frontend (M2), Lead (M4 deployment decision)

**What:**
M3 test architecture uses 5-phase approach, scaffold-ready now (mocks require no M1/M2 blockers):

**Phase Structure:**
1. **Scaffolding (1 day, now):** Jest project setup, package.json, configuration
2. **Mock Infrastructure (2 days, week 1):** Mock Media API, Mock Substack API, token counter, sample articles
3. **Test Suites (3 days, week 1-2):** 5 Jest test suites covering workflow, costs, safety, edge cases, performance
4. **Execution & Reporting (1 day, week 2):** Test runner, custom assertions, report generation
5. **Integration Tests (2 days, week 3):** Full E2E with real M1+M2 components

**Test Coverage:**
- Workflow: PROPOSED → DRAFTING → REVIEWING → APPROVED → PUBLISHED (state machine correctness)
- Cost Tracking: Haiku vs Opus pricing, cumulative costs, daily budget alerts at 70% spend
- Safety Gates: Manual approval mandatory (zero auto-publishes), significance threshold enforcement
- Edge Cases: Rate limits (429), API failures (5xx), timeout recovery, retry logic with backoff
- Performance: 100+ articles/hour throughput, <5 min test execution, <2s dashboard response

**Sample Articles (5-10):**
- High significance (Seahawks starter signing) → auto-draft
- Medium significance (backup depth) → borderline, manual decision
- Low significance (practice squad) → archived (not article-worthy)
- Division rival news (ARI major signing) → auto-draft
- Injury reporting (key player IR) → auto-draft

**Acceptance Criteria Covered:**
✓ Integration test: full article flow (cron → draft → approve → publish)
✓ Test: article rejection → manual resubmission
✓ Test: unpublish → revert to drafted state
✓ Test: token cost tracking accuracy (vs. predicted, ±5%)
✓ Test: Haiku for drafts, Opus for reviews (cost model validation)
✓ Test: significance threshold rules (auto-draft vs. manual approval)
✓ Performance: queue throughput (100+ articles/hour at scale)
✓ Edge cases: rate limits, API failures, retry exhaustion
✓ Manual approval gate enforced (zero auto-publishes)
✓ Local tests (mock APIs, no external dependencies)
✓ 5-10 sample articles (various significance levels)
✓ Cost report: cumulative tokens, remaining quota, projection
✓ Daily budget validation (alert at 70% spend)

**Exit Criteria (all required before M4):**
- [ ] All workflow state transitions pass tests
- [ ] Token cost accuracy within 5% of predicted
- [ ] Zero articles auto-publish in any scenario
- [ ] Daily budget alert fires at 70% threshold
- [ ] Unpublish/revert works safely in all scenarios
- [ ] Edge cases (rate limits, retries, failures) handled gracefully
- [ ] Performance: >100 articles/hour validated
- [ ] Test execution <5 minutes
- [ ] Coverage >80% on queue + cost modules

**Key Decision — Cost Model:**
Haiku draft cost (~$0.0016) + Opus review cost (~$0.045) = ~$0.047 per article. GitHub Pro+ budget ($1.30/day) allows ~27 articles/day. Daily alert triggers at 70% ($0.91).

**Why:** M3 gates M4 deployment. Cannot launch production without proof that cost tracking is accurate, manual approval is enforced, and state machine is correct. Mock-first approach allows parallel work — Backend (M1) and Frontend (M2) build independently; tests integrate everything.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

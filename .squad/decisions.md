# Squad Decisions

## Active Decisions

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


### 2026-03-14: Article Lifecycle Skill — Architectural Decisions

**By:** Lead  
**Status:** Proposed  
**Affects:** Lead, Writer, Editor, future Publisher agent, all panel-eligible agents

**Decision 1: Discussion Prompt as a Required Pre-Panel Artifact**
- Every article must have a completed Discussion Prompt (Stage 2) before panel composition begins
- The prompt defines the central question, the tension/conflict, and what makes the article worth reading
- Forces the angle up front, cascading to better panel selection and stronger articles

**Decision 2: Publisher Pass (Stage 7) as a Distinct Stage**
- New stage between Editor approval and Substack publish
- Covers final formatting, metadata (title, subtitle, tags, URL slug, section, cover image), scheduling, and distribution planning
- Previously invisible work now codified as a checklist, manually usable today and parseable by future Publisher agent

**Decision 3: Panel Composition Rules (2–5 Agents, Selection Matrix)**
- Formalized panel composition: always include relevant team agent(s), always include at least one specialist, 2–4 is sweet spot, 5 is maximum
- Selection matrix maps article types to recommended panels
- RB article used 6 agents successfully, but that's near the upper limit

**Decision 4: Lifecycle Skill Wraps (Does Not Replace) Substack-Article Skill**
- Article-lifecycle skill is coordinator-level orchestration
- Substack-article skill remains authoritative for drafting mechanics (template, formulas, style guide, editorial protocol)
- Both skills maintained in parallel to avoid duplication

**Decision 5: Confidence Level — Low (Needs End-to-End Validation)**
- Skill starts at confidence `low` despite incorporating proven patterns
- Stages 4–6 validated (two published articles)
- Stages 2, 3, 7 are new and untested
- Promote to `medium` after one article passes through all 8 stages, to `high` after 3+ articles


### 2026-03-15: Media Daily Sweep — FA Day 4 (50+ new moves, Rodgers upgraded, TEN $270M spree)
**By:** Media (NFL Media & Rumors Specialist)
**Status:** Proposed
**Priority:** HIGH
**Affects:** SEA, TEN, LV, NYG, NE, WSH, HOU, CLE, LAR, CAR, CHI, LAC, DAL, IND, KC, NO, NYJ, BAL, DET, PHI, BUF, TB, SF, ARI, CIN team agents; Cap, Draft, Injury, Offense, Defense, Lead specialists

**What:**
Comprehensive Day 3-4 sweep (March 14-15) during FA Wave 1. 50+ new confirmed transactions, 1 trade, 2 restructures. Key moves:
- TEN spending spree: Robinson ($78M), Franklin-Myers ($63M), Taylor ($58M), Flott ($45M), Bellinger ($24M) = $270M+ total. Biggest FA spender in the league.
- SEA re-signed Shaheed ($51M WR) and Jobe ($24M CB) but lost Coby Bryant to CHI ($40M S). $44M cap remains.
- LV defensive overhaul: Paye ($48M), Walker ($40.5M), Dean ($36M), Stokes ($30M) = $154M+ on defense around Mendoza (draft).
- NYG building under Harbaugh: Likely ($40M TE), Eluemunor ($39M RT), Mooney ($10M WR), Newsome ($8M CB).
- NE adds Vera-Tucker ($42M OL) + Dre'Mont Jones ($36.5M EDGE) to protect Maye.
- LAR adds Watson ($51M CB) — NFC West secondary upgrade.
- SF restructures Nick Bosa (cleared $17.172M) — signals imminent Joey Bosa signing.
- David Montgomery traded DET→HOU with new 2yr/$16.5M deal.
- Rodgers → PIT UPGRADED to 🟢 Likely (insiders "near-certain" of return, decision before draft).
- Diggs market: BAL now consensus frontrunner. No deal.
- Total confirmed FA transactions tracked: 115+. Active rumors: 15.

**Why:** Day 4 FA sweep ensures all agents have accurate rosters. Rodgers upgrade is biggest strategic shift — PIT win-now plan back on track. TEN $270M spree creates new AFC contender. NFC West arms race intensifying (Watson→LAR, Bosa restructure→SF, Shaheed/Jobe→SEA). 3 article candidates identified (TEN spree, SEA window, Rodgers decision).


### 2026-03-15: README.md Structure and Tone

**By:** Writer  
**Status:** Delivered

**Structural Choices:**
1. Agent roster as condensed table (14 rows) instead of listing all 47; full roster in `.squad/team.md`
2. Pipeline section uses text flowchart (numbered steps, not Mermaid) — readable without dependencies
3. "What's Next" is a checklist — Joe can tick off as capabilities ship
4. No VISION.md content leaks — revenue projections stay there, README references it but doesn't quote
5. Tone: Direct, energetic, zero fluff — internal engineering docs, not marketing copy

**Rationale:** Joe needs a doc answering "what is this, how do I use it" in under 2 minutes. Everything else is noise.


### 2026-03-15: Add `discussion_path` Field to Articles Table
**By:** Lead  
**Status:** Proposed  
**Affects:** pipeline.db schema, article lifecycle tooling, Scribe, Writer, Lead

**What:**
Add a `discussion_path` field (TEXT, nullable) to the `articles` table in `pipeline.db`. After any article's panel discussion phase completes, populate this field with the relative path to the discussion directory (e.g., `'content/articles/jsn-extension-preview/'`). This enables:
1. **Traceability** — Any agent can query the DB and immediately find discussion artifacts
2. **Automation readiness** — Writer agent reads `discussion_path` to know where discussion summary and position statements live
3. **Future flexibility** — Handles non-standard locations (e.g., imported external research)
4. **Alignment with existing pattern** — Table already has `article_path` and `substack_url`; `discussion_path` is the logical companion

**Schema change:**
```sql
ALTER TABLE articles ADD COLUMN discussion_path TEXT;
UPDATE articles SET discussion_path = 'content/articles/jsn-extension-preview/' WHERE id = 'jsn-extension-preview';
```

Also update `content/schema.sql` to include this column in the `CREATE TABLE articles` definition for future `init_db.py` runs.

**Why:** Needed before the next article reaches `panel_discussion` stage at scale. Currently manageable with path convention inference, but should be added before Phase 2 automation is built. Enables Writer agent to operate independently.

**Priority:** Medium — non-blocking but foundational for automation.


### 2026-03-15: Lead Intel Brief — Editorial Priority Changes
**By:** Lead  
**Status:** Proposed  
**Priority:** HIGH  
**Affects:** Writer, Editor, SEA, Cap, Defense, Draft, Media

**What:**
Based on the March 14-15 Media sweep (50+ new transactions, 115+ total tracked), the following editorial priority changes are proposed:

1. **Priority #1 ("Seattle Lost Half Its Defense") — CONFIRMED ON SCHEDULE (Mar 17).** Bryant loss to CHI ($40M) is the 4th major departure. Shaheed ($51M) and Jobe ($24M) re-signs provide counterbalance. This article is now more urgent and richer with new data.

2. **Priority #2 ("The Free Agent Nobody's Talking About") — CONFIRMED ON SCHEDULE (Mar 18).** Jennings (WR, ESPN projects SEA) and Asante Samuel Jr. (CB, injury discount) are the strongest candidates. Bryant departure makes the CB angle especially compelling.

3. **NEW — "Tennessee's $270M Spending Spree" — ADD TO PIPELINE (Mar 19-20).** Media scored 5/5 significance. First non-SEA article. Massive audience potential. Panel: TEN, Cap, Offense, Defense, Draft.

4. **NEW — "The Rodgers Decision" — ADD TO PIPELINE (preview Mar 21, or reactive publish when decision drops).** Media scored 4/5. Time-sensitive — decision expected before draft. Panel: PIT, Cap, Offense, Lead.

5. **"NFC West Power Rankings" (Evergreen) — PROMOTE TO MARCH WINDOW.** All 4 NFC West teams made significant moves this week. Could publish as an NFC West FA recap. Panel: ARI, LAR, SF, SEA.

6. **Media's "Seattle Championship Window" candidate — MERGE with Priority #1** rather than a separate article. The "retention vs. exodus" angle strengthens the defensive departures piece.

**Why:** The news cycle is moving fast. Three new article candidates emerged from today's sweep alone. TEN and Rodgers pieces expand beyond SEA-only coverage (growth play). NFC West recap leverages our division expertise. All existing pipeline items remain on schedule — this is additive, not disruptive.

**Decision requested:** Approve adding TEN spree + Rodgers decision to the pipeline, and promoting NFC West Power Rankings to March.

---


### 2026-03-15: Article Candidates from Daily News Sweep
**By:** Media  
**Status:** Proposed  
**Affects:** Lead, Writer, Editor

**What:**
Five article candidates identified from March 14-15 news sweep, scored by significance:

**Score 5 — Must-Write:**
- "Tennessee's $270M Spending Spree: Are the Titans Instant AFC Contenders?" — TEN signed Robinson ($78M), Franklin-Myers ($63M), Taylor ($58M), Flott ($45M), Bellinger ($24M). Biggest FA spender in NFL. Panel: TEN, Cap, Offense, Defense, Draft.

**Score 4 — Strong Candidates:**
- "Seattle's Championship Window: Retention Strategy vs. Free Agent Exodus" — Re-signed Shaheed/Jobe while losing Walker III, Mafe, Bryant. $44M cap, pick #32. Panel: SEA, Cap, Defense, Draft.
- "Las Vegas' Defensive Masterclass" — Paye, Walker, Dean, Stokes ($154M+ on D) around rookie Mendoza. Panel: LV, Cap, Defense, Draft.
- "The Rodgers Decision" — Status upgraded to 🟢 Likely. Decision before draft. PIT's entire win-now plan depends on this. Panel: PIT, Cap, Offense, Lead.

**Score 3 — Monitor:**
- "Harbaugh's Giants" — Likely, Eluemunor, Mooney signings. Early patterns; monitor 1 more week.
- "NFC West Arms Race Update" — All 4 teams moved (Watson→LAR, Bosa restructure→SF, Shaheed/Jobe→SEA). Best as section in broader FA recap.
- "The Free Agent Dead Zone" — Elite FAs still unsigned (Diggs, Bosa, Jennings). Best at Day 7-10 when patterns clear.

**Recommendation:** Articles #1 (Titans), #2 (Seahawks), and #4 (Rodgers) are strongest for immediate publication. #2 is highest priority given Seahawks focus.

**Why:** Comprehensive news tracking ensures article pipeline reflects current, high-impact topics. Titans and Rodgers pieces expand beyond SEA-only coverage (audience growth). Timing critical — Rodgers decision expected within 2 weeks.

---


### 2026-03-15: Media Intel Drop — League-Wide (50+ New Transactions)
**By:** Media  
**Status:** Proposed  
**Priority:** HIGH  
**Affects:** All 32 team agents, all specialists

**What:**
Comprehensive Day 3-4 free agency sweep (March 14-15). 50+ new confirmed transactions documented in detail:

**Headline Moves:**
- **TEN:** Robinson ($78M WR), Franklin-Myers ($63M DL), Taylor ($58M CB), Flott ($45M CB), Bellinger ($24M TE) = $270M+ spree
- **LV:** Paye ($48M EDGE), Walker ($40.5M LB), Dean ($36M LB), Stokes ($30M CB) = $154M+ defensive overhaul
- **NYG:** Likely ($40M TE), Eluemunor ($39M RT), Mooney ($10M WR), Newsome ($8M CB) building under Harbaugh
- **NE:** Vera-Tucker ($42M OL), Dre'Mont Jones ($36.5M EDGE) protecting Maye
- **LAR:** Watson ($51M CB) — NFC West secondary upgrade
- **SF:** Bosa restructure cleared $17.172M — signals Joey Bosa signing
- **Rodgers → PIT:** UPGRADED to 🟢 Likely (insiders "near-certain")
- Plus 40+ additional confirmed FA signings and depth moves

**Database Update:**
- Total confirmed FA transactions tracked: 115+
- Active rumors: 15
- All moves verified via Spotrac, OTC, ESPN, NFL.com

**Why:** Comprehensive tracking ensures all agents have current roster data. Day 4 sweep reveals biggest strategic shifts: TEN building new contender, LV defensive pivot, Rodgers likely returns to PIT. Three article candidates identified (TEN spree, SEA retention, Rodgers decision). All team agents should update roster knowledge with current moves and cap impacts.

---


### 2026-03-15: Media Intel Drop — SEA (Priority)
**By:** Media  
**Status:** Proposed  
**Priority:** HIGH  
**Affects:** SEA team agent, Cap, Defense, Draft, Lead

**What:**
Seahawks-focused intel from Day 3-4 sweep (March 14-15):

**Confirmed Moves:**
- ✅ Rashid Shaheed RE-SIGNED — WR, 3yr/$51M ($34.735M gtd, $23M at signing). Explosive deep threat + return specialist locked in as WR2/3. $17M AAV.
- ✅ Josh Jobe RE-SIGNED — CB, 3yr/$24M ($14.25M gtd, $9.5M at signing). Press-man specialist, 15/16 starts in 2025, 54 tackles, 12 PDs. CB2 alongside Witherspoon. $8M AAV.
- ❌ Coby Bryant LOST to CHI — S, 3yr/$40M ($25.75M gtd). Fourth significant departure (Walker III→KC, Mafe→CIN, Bryant→CHI). Secondary now thin at safety.
- ✅ Depth: Brady Russell (TE), Emanuel Wilson (RB) signed. Tyler Hall (DB) released. D'Anthony Bell (DB) re-signed.

**NFC West Context:**
- Nick Bosa restructure (SF) cleared $17.172M — signals imminent Joey Bosa signing, NFC West EDGE arms race escalates
- Jaylen Watson → LAR ($51M CB). Rams adding McDuffie (trade) + Watson in secondary
- Jalen Thompson → DAL ($33M S, from ARI). NFC West rival loses key safety

**SEA Situation:**
- **Cap Space:** $44.08M remaining — 6th most in NFL. Room for 1-2 more significant signings.
- **Safety Need (CRITICAL):** Bryant loss leaves safety group thin. Draft intel has SEA mocked for Notre Dame RB at #32.
- **FA Targets Still Available:** Jauan Jennings (WR, ESPN projects SEA, ~$12-16M AAV); Najee Harris (RB, post-Achilles); Bobby Wagner (LB); Asante Samuel Jr. (CB, injury discount).

**Confidence:**
- ✅ Shaheed re-sign — CONFIRMED (Spotrac verified, Tier 1-2 sources)
- ✅ Jobe re-sign — CONFIRMED (Spotrac verified, Tier 1-2 sources)
- ✅ Bryant departure — CONFIRMED (Spotrac, CHI announcement)
- 🟢 Bosa → SF — Likely (restructure + Tier 1-2 reports)
- 🟡 Jennings → SEA — Possible (ESPN projection)
- 🟡 Harris → SEA — Possible (projected landing spot)

**Why:** SEA-specific intel enables team agent to update roster knowledge and identify priority signings. Bryant loss creates urgent safety need alongside RB (post-Walker III). $44M cap space provides signing room. Jennings/Harris are high-value FA targets still available. Draft RB need aligns with #32 pick in current mocks.

---


### 2026-03-15: User directive — Avoid politically divisive topics
**By:** Joe Robinson (via Copilot)  
**Status:** Proposed  
**Priority:** CRITICAL  
**Affects:** All agents, all content tracks

**What:** Avoid politically divisive topics in all content. Specifically: do NOT reference or analyze state/federal tax legislation (e.g., WA SB 6346 millionaires tax), political bills, or any content that could be construed as taking a political stance. This applies to all article ideas, discussion prompts, panel discussions, article drafts, and agent analyses.

**Why:** User request — captured for team memory. The WA tax angle surfaced in the JSN contract panel discussion and was flagged as inappropriate for the platform.

**Scope:** All agents — Lead, Media, Writer, Editor, Publisher, panel participants, and any future agents.

**⚠️ BLOCKING NOTE (Scribe):**
JSN panel discussion completed on 2026-03-15 before this directive was filed. Discussion summary and panelist positions reference WA SB 6346 tax mechanics as a key finding. **Action Required:** Lead or Editor must revise `content/articles/jsn-extension-preview/discussion-summary.md` and related position files to remove tax references before article proceeds to Writer stage (Stage 5). This should not block the log/decision merge, but must be resolved before draft production.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction


Decision: All article content must avoid politically divisive topics. No tax legislation, political bills, or political angles. Applies to all stages: ideas, discussion prompts, panel positions, drafts, editor/publisher passes.


### Editor Verdict: JSN Extension Preview — Re-Review

# Editor Verdict: JSN Extension Preview — Re-Review

**From:** Editor  
**Date:** 2026-03-15  
**Article:** "Jaxon Smith-Njigba's Extension Is Coming. Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid."  
**Review:** Re-review (2nd pass) after Writer addressed 🟡 REVISE feedback

---

## Verdict: ✅ APPROVED

All three 🔴 errors from the first review are fixed correctly:

1. **Rob Havenstein** — "Ryan" corrected to "Rob" on line 120. ✅
2. **Cap/PlayerRep quote attribution** — Blended quote properly split into two quotes with correct panelist attribution (Cap: comps, PlayerRep: draft-slot argument). ✅
3. **Shanahan-tree superlative** — Now reads "since Cooper Kupp's 1,947-yard outlier in 2021," properly qualifying the claim. ✅

**Additional findings:**
- Full 8-quote attribution audit: all clean. No misattributions remain.
- No new factual errors on full re-read.
- 4 carried-forward 🟡 suggestions (stat specifics, vague record claim, table footnote, "rebuilding" wording) remain as recommendations for future updates. None are publish-blockers.

**The article is publish-ready.**

---

*Full review saved to: `content/articles/jsn-extension-preview/editor-review-2.md`*

### Editor Verdict: JSN Extension Preview Article

# Editor Verdict: JSN Extension Preview Article

**Article:** "Jaxon Smith-Njigba's Extension Is Coming. Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid."  
**Date:** 2026-03-15  
**Full review:** `content/articles/jsn-extension-preview/editor-review.md`

---

## Verdict: 🟡 REVISE

### 🔴 Fixes Required (3):
1. **"Ryan Havenstein" → "Rob Havenstein"** (line 116) — wrong first name
2. **Quote misattribution** (line 52) — draft-slot argument is PlayerRep's, not Cap's. Split or rewrite the quote.
3. **"Best any Shanahan-tree receiver" superlative** (line 58) — Kupp's 1,947-yard season makes this technically incorrect. Add qualifier.

### 🟡 Top Recommendations:
- Add JSN's 2025 stat specifics (catches, TDs, target share) — "1,800 yards" alone isn't enough for the central argument
- Fix polished-paraphrase quotes presented as direct attribution (lines 87, 91, 165)
- Add DK Metcalf's Pittsburgh AAV ($30M/yr per project data) for narrative context

### What's Working:
- Structure, voice, tables, and data accuracy are excellent
- Four-path framework is compelling
- Verdict ($32-33M) takes a clear, well-supported position
- No political/tax content violations
- 22/23 verifiable facts checked clean

### Path to ✅ APPROVED:
Fix the 3 🔴 items → address top 🟡 suggestions → resubmit for final sign-off.

---

*Editor — 2026-03-15*

### Decision: JSN Extension Article Draft Complete — Ready for Editor Review

# Decision: JSN Extension Article Draft Complete — Ready for Editor Review

**Date:** 2026-03-15  
**Decider:** Writer  
**Status:** ✅ Completed  

---

## What Was Decided

The JSN extension preview article draft is complete and saved to `content/articles/jsn-extension-preview/draft.md`. The article synthesizes the four-expert panel discussion (Cap, PlayerRep, SEA, Offense) into a narrative-driven piece following the NFL Lab house style.

**Article specs:**
- **Headline:** "Jaxon Smith-Njigba's Extension Is Coming. Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid."
- **Length:** ~3,200 words
- **Structure:** Hook → 4 paths framework → AAV debate → cost-of-waiting math → Shaheed leverage point → front-loaded structure → verdict ($32–33M, extend now)
- **Tables:** 5 major tables (paths, panel positions, comps, cost-of-waiting, cap structure)
- **Image placeholders:** 4 (cover + 3 section headers)
- **Voice:** Expert disagreement format, data-backed, clear position taken in verdict

---

## Rationale

The panel discussion surfaced genuine tension on the central question: is JSN a Jefferson/Lamb-tier WR ($34–36M) or a tier below ($28–32M)? The article presents both sides (PlayerRep/Cap arguing for full market, Offense arguing for system-amplified discount, SEA prioritizing defense) and lands on a synthesis: $32–33M AAV, front-loaded, extend now.

**Key narrative choices:**
1. **The tier question is the article's core.** Four experts, four AAV ranges. I didn't artificially smooth this into consensus — the disagreement IS the product.
2. **PlayerRep's "Shaheed tipped their hand" insight is positioned as the non-obvious reveal.** Per charter, each expert should surface something readers won't find elsewhere. Shaheed's $17M AAV as JSN's negotiating floor is that hook.
3. **Cap's cost-of-waiting math ($33M more over deal life if you use the option) is the counter-intuitive data point.** It's the reason "extend now" wins despite SEA's defense-first concerns.
4. **Took a clear position in the verdict.** $32–33M AAV, $90M+ guaranteed, front-loaded structure. No hedging. This is what the charter demands.

---

## Open Questions Flagged for Editor

The draft includes a writer note section flagging 7 open questions that need fact-checking:
1. JSN's actual 2025 production numbers (yards, TDs, target share, YAC)
2. Fleury's system context — how much is scheme vs. JSN's skill?
3. Public quotes from Macdonald/front office about JSN's role
4. DK Metcalf's Pittsburgh contract specifics (~$24M/yr claim)
5. WR market 2027 projection (Cap's $36–38M AAV estimate)
6. 5th-year option exact figure for 2027 ($21–23M range given)
7. Shaheed contract structure verification (3yr/$51M, $17M AAV, $34.7M gtd)

These are verification tasks for Editor, not Writer.

---

## Next Steps

1. **Editor reviews the draft** — fact-check open questions, evaluate structure/voice, provide 🔴🟡🟢 feedback.
2. **Revisions if needed** based on Editor's verdict.
3. **Publish pipeline** once approved.

The draft is ready for editorial review.

---

**Recorded by:** Writer  
**File location:** `content/articles/jsn-extension-preview/draft.md`  
**Editor handoff:** Ready now

### Writer → Editor: JSN Extension Article — Revision Complete

# Writer → Editor: JSN Extension Article — Revision Complete

**From:** Writer  
**To:** Editor  
**Date:** 2026-03-15  
**Re:** `content/articles/jsn-extension-preview/draft.md` — Revision pass complete, ready for re-review

---

## Summary

All 3 🔴 must-fix errors have been corrected. Four 🟡 suggestions were addressed. The article's structure, argument, and conclusion are unchanged.

---

## 🔴 Fixes Made

### 1. "Ryan Havenstein" → "Rob Havenstein"
**Line 120:** Corrected. "the Rams just lost Ryan Havenstein" → "the Rams just lost Rob Havenstein." Verified this was the only instance of the wrong first name in the draft.

### 2. Cap/PlayerRep Quote Split
**Lines 52–56 (revised):** The blended quote was split into two properly attributed quotes:
- **Cap** now carries only the comp analysis: *"The comps are clean: Lamb at $34M, Jefferson at $35M. JSN is younger than both at signing and just as productive."*
- **PlayerRep** now carries the draft-slot argument: *"You don't get a discount for drafting him at pick 20 instead of pick 5. Production sets the second contract, not draft slot."*
- A bridge sentence ("PlayerRep makes the draft-slot case just as bluntly:") connects the two quotes naturally.

### 3. "Best Any Shanahan-Tree Receiver Has Ever Produced" → Qualified
**Line 62 (revised):** Changed to: *"JSN's 1,800-yard season is the best any Shanahan-tree receiver has produced since Cooper Kupp's 1,947-yard outlier in 2021 — better than Deebo Samuel's peak, better than Brandon Aiyuk at his best. Kupp's historic season is the only asterisk; everyone else in the family tree is below JSN's line."*  
This preserves the point (JSN is best in the tree in normal terms) while explicitly acknowledging Kupp's outlier season.

---

## 🟡 Suggestions Addressed

### Quote voice / accuracy cleanup (Suggestion #2)
Four quote adjustments were made to better match each expert's documented voice:

1. **Cap (line 91):** "optionality theater" → *"a trap"* — restored to Cap's language from the position file. "The fifth-year option is a trap" is more faithful than an invented phrase.

2. **PlayerRep (line 95):** Removed the trailing *"The injury clock is ticking"* — that line doesn't appear in PlayerRep's position file and reads as Writer invention. The quote now ends on guaranteed cash language, which is PlayerRep's actual register.

3. **SEA → PlayerRep (line 169):** The "financial malpractice" quote re-attributed from SEA to PlayerRep. "Financial malpractice" is PlayerRep's language per the position file. SEA uses strategic/organizational framing, not player-advocacy rhetoric.

### JSN stat line (Suggestion #1)
**Not added.** The discussion-summary does not contain specific stats beyond "1,800-yard breakout season" (no receptions, TDs, target share, YAC, or separation metrics). Open question #1 from the Writer notes remains unresolved — these numbers need to come from a data source before they can be added. Left the WRITER NOTES flag intact for Editor awareness.

---

## No Structural Changes

The article's four-path framework, expert positions, panel tables, verdict ($32–33M AAV), and conclusion are all unchanged. This was a targeted fix pass, not a rewrite.

---

*Writer — 2026-03-15*


---

# Decision: JSN Yellow-Item Fixes — Editorial Standards

**By:** Editor  
**Date:** 2026-03-15  
**Affects:** Writer, Lead, all future articles

## What

When source material explicitly flags a data gap (e.g., "we don't have the specific stats"), the editorial standard is:

1. **Narrow vague claims** to the most defensible specific version supported by available data (e.g., "franchise-record receiving numbers" → "franchise-record receiving yardage" when all evidence points to yards).
2. **Add HTML comment placeholders** for missing data rather than inventing or omitting the claim entirely: `<!-- TODO: Add [specific data] when verified -->`.
3. **Use precise competitive descriptors** per project data — "retooling" vs "rebuilding" when a team has significant cap space and draft capital.

## Why

The JSN article's 🟡 items all stemmed from the same root cause: the expert panel worked with "breakout season" as a given without nailing down the underlying numbers. This is likely to recur in future articles where panel discussions outpace verified stat availability. The placeholder pattern lets us publish on time while ensuring nothing falls through the cracks.


---

### 2026-03-15T21:39:08Z: Knowledge Propagation Pattern — Adopted
**By:** Lead (Joe Robinson directive)
**What:** All agents must write cross-agent knowledge updates to .squad/knowledge/inbox/ using the structured drop file format. Scribe processes this inbox during every session cleanup. Charter updates are flagged, not applied directly.
**Why:** Prevents knowledge from being siloed in one agent's history when it's relevant to other agents or team-level files. Enforces the same drop-box discipline for knowledge that already exists for decisions.


---

### 2026-03-15T14-37-16: User directive
**By:** Joe Robinson (via Copilot)
**What:** When any agent discovers knowledge that should update team files (other agents' history.md, team.md, decisions.md, or charters), those updates must NOT be lost. Agents must explicitly flag cross-agent knowledge for Scribe to route.
**Why:** User request — captured for team memory. Prevents knowledge silos and ensures discoveries made by one agent propagate to the right places.

---

### 20260315-234500: User directive — Image sizing

**By:** Joe (via Copilot)

**What:** Images in Substack articles must use imageSize normal (text column width), not large (full-bleed). Images should follow the same left/right borders as the article text.

**Why:** User request — full-width images looked inconsistent with the centered text column

---

### 20260315-234500-inline-default: User directive — Inline-only default

**By:** Joe (via Copilot)

**What:** Default image generation should produce inline images only (no cover images). Use image_types: ['inline', 'inline'] for 2 images. Cover images are NOT generated automatically — they are set manually in the Substack editor if needed.

**Why:** User request — cover images should not be auto-generated or embedded in article markdown

---

### 2026-03-15T22:28:58Z: User directive — Inline image limit

**By:** Joe Robinson (via Copilot)

**What:** Limit articles to 2 inline images only — no cover/banner image. Images should break up text and look good on mobile. This change also saves tokens.

**Why:** User request — captured for team memory

---

### 2026-03-15T23:41:37Z: Image hallucinatio pattern — "contract paperwork" trigger (EDITOR CHARTER UPDATE)

**By:** Editor (vision review)

**What:** AI hallucinates CONTRACT labels, fake NFL logos, and garbled body text when prompted with "contract paperwork" image concepts. This is a consistent failure pattern requiring prompt engineering mitigation.

**Pattern:** Contract/document prompts trigger unwanted text generation (labels, logos, fake document text) that cannot be caught by visual inspection alone.

**Mitigation:** Replace "contract paperwork" with "blank white papers" + explicit "no text, no logos, no writing of any kind" constraint in generation prompts.

**Charter flag:** Editor's knowledge base should be updated with: AI hallucinates CONTRACT labels on document-themed images — avoid "contract" + "document" + "paperwork" in generation prompts.

**Why:** Prevents repeated rejection cycles on document-themed images. Prompt engineering is more efficient than repeated regenerations.

---

### 2026-03-15T23:41:37Z: Image uniqueness enforcement — Hash verification required (MANDATORY PRE-PUBLISH RULE)

**By:** Lead & Joe (directive consolidation)

**What:** Always verify image hashes are unique before publishing any article with multiple images. Two images with identical hashes are duplicates regardless of filename — visual inspection cannot catch this. MD5/SHA256 hash check is mandatory pre-publish step.

**Implementation:**
1. Before publishing, run hash verification on all generated images: Get-FileHash content/images/{slug}/*.png -Algorithm MD5
2. If duplicate hashes found: reject both, regenerate, verify again
3. Log hashes in Editor's image review report for audit trail

**Updated:**
- image-generation/SKILL.md — Added "Uniqueness Check (Required Before Publishing)" section
- image-review/SKILL.md — Added duplicate hash detection to review checklist

**Applies to:** All articles with 2+ images

**Why:** First published article had identical inline images with different filenames (550CFD87 = 18CBD39A). Only hash verification catches this. Hash check is only reliable deduplication method.

---

### 2026-03-15T23:41:37Z: JSN article — Duplicate inline images resolved

**By:** Coordinator & Editor

---

### 2026-03-16: Batch-Create Generic Article Issues for Remaining Divisions
**By:** Lead (GM/Lead Specialist)
**Status:** Completed
**Affects:** All remaining 28 NFL teams (AFC/NFC divisions)

**What:**
Created 28 GitHub issues (#43–#69) covering every remaining team except NE and SEA, using the same generic template as NFC West batch (#40–#42: ARI, LAR, SF).

**Decision:**
- **Skipped NE** — Joe confirmed already generated; skip to avoid duplicate
- **Skipped SEA** — Home team; not included in NFC West batch either; gets dedicated, non-generic treatment
- **Template:** Generic `IDEA GENERATION REQUIRED` at Depth Level 2 (matches #40–#42 pattern)
- **Labels:** All issues tagged `squad`, `squad:lead`, `article`
- **Issue map by division:**
  - AFC East: BUF #43, MIA #44, NYJ #45
  - AFC North: BAL #46, CIN #47, CLE #48, PIT #49
  - AFC South: HOU #50, IND #51, JAX #52, TEN #53
  - AFC West: DEN #54, KC #55, LAC #56, LV #57
  - NFC East: DAL #58, NYG #59, PHI #60, WAS #61
  - NFC North: CHI #62, DET #63, GB #64, MIN #65
  - NFC South: ATL #66, CAR #67, NO #68, TB #69

**Why:**
Batch issue creation is stable at 28 items (0.5s delay, template loop). Generic template + mandatory idea generation upfront shifts responsibility to runtime (when issue is claimed) instead of creation time. All old-format issues (#9–#39) now superseded by generic pipeline starters. Skipping NE and SEA maintains design consistency.

**Pattern Established:**
Batch issue creation works cleanly for 28+ teams. Generic template enforces idea generation at claim time (Step 1b of Lead's pipeline) rather than creation time, preventing staleness.

---

### 2026-03-16: NFC West Parallel Panel Execution Pattern
**By:** Lead
**Status:** Approved
**Affects:** Article pipeline, batch processing strategy

**What:**
Run NFC West articles in parallel batches (2 articles × 4 agents = 8 simultaneous panel agents) when:
- Both articles are at the same pipeline stage
- Both are Depth Level 2 (same model/token budget)
- No dependency exists between the two articles

**Outcome:**
- Total wall time for 8 agents: ~4 minutes (same as running 4 agents for one article)
- All 8 positions produced were high quality — no degradation from parallelism
- Both syntheses completed with actionable writer briefs

**Reusable Pattern:**
When multiple articles in the same division are at the same pipeline stage, batch them:
1. Create all discussion prompts first
2. Spawn all panel agents simultaneously (up to 8 tested successfully)
3. Wait for all to complete
4. Write syntheses sequentially (Lead needs to read all positions for each synthesis)

**Why:**
Parallel execution is cost-neutral (no token discount) but saves wall-clock time significantly. Division-specific batching leverages shared domain context (all agents understand NFC West landscape). No context window pressure — agents are stateless and independent.

---

### 2026-03-16: Idea Generation Must Use Top Model + Current Data
**By:** Lead
**Status:** Implemented
**Critical:** Yes

**What:**
Issues must be generic triggers. Idea generation must happen as the FIRST STEP of the pipeline using a top model with real research.

**Root Cause of Old Problem:**
1. Batch issue creation asked Lead to generate 30 ideas all at once
2. Lead used cheaper model to save tokens without fetching current data
3. Model relied on training data (last updated mid-2025 at best)
4. Stale angles got committed to GitHub issues, locking in wrong assumptions
5. Example failures: QB situations referenced wrong year, cap figures from wrong offseason, "Year N" framing for Year N+1 players

**Implementation:**
1. **Model Requirement:** ALWAYS use `claude-opus-4.6` for idea generation (non-negotiable)
2. **Current Data Requirement:** MUST fetch current data (OTC, ESPN, web_search) before generating any angle
3. **Year Accuracy Gate:** Confirm 2026 offseason context, 2025 season stats, 2026 cap year
4. **Process Integration:** New generic issue template (`.squad/templates/team-article-issue.md`), issue says "IDEA GENERATION REQUIRED", Lead runs Step 1b (read skill → fetch data → generate → post comment → continue)

**Files Updated:**
- `.squad/skills/idea-generation/SKILL.md` — Mandates top model + current context
- `.squad/agents/lead/charter.md` — Added Step 1b to pipeline protocol
- `.squad/templates/team-article-issue.md` — New generic template
- `.squad/skills/article-lifecycle/SKILL.md` — Documented GitHub Issue-Triggered idea generation

**Pattern Established:**
**Idea generation is NOT a bulk batch task.** It's a research-intensive, current-data-dependent task that must happen just-in-time before each article starts. Never: "Generate 30 team ideas up front". Always: "Trigger 30 issues with 'IDEA GENERATION REQUIRED' and let Lead research each individually as Step 1 of pipeline".

---

### 2026-03-16: Article Process Guards — Temporal Accuracy + TLDR Requirement
**By:** Lead (Joe Robinson directive)
**Status:** Implemented
**Critical:** Yes

**What:**
Add three accuracy gates to the article lifecycle:

**Gate 1: Temporal Accuracy**
- All panel agent spawns MUST include season context block: current NFL year (2026), most recent completed season (2025), upcoming season (2026)
- All stats cited = 2025 season unless noted as historical
- All cap figures = 2026 cap year
- Coaching staff = who is actually coaching in 2026
- Year N framing accurate (e.g., QB drafted 2024 = entering Year 3 in 2026)

**Gate 2: TLDR Present**
- Article structure template MUST include TLDR callout block after subtitle
- TLDR format: 4 bullets (situation, assets, verdict, debate)
- Editor MUST verify presence and accuracy before approval

**Gate 3: Player/Staff Name Accuracy**
- All player/coach names verified against current rosters
- Draft prospects verified as real 2026 prospects
- Contract figures sourced (OTC/Spotrac citation required)

**Root Cause:**
Drake Maye article ("Year 2 Decision Time") shipped with:
1. Temporal accuracy failure — framed Maye as Year 2 entering Year 3, panel used wrong season context
2. Missing TLDR — 3,500+ word article published without quick-scan summary

**Files Updated:**
- `.squad/skills/substack-article/SKILL.md` — Added TLDR to structure + Temporal Accuracy subsection
- `.squad/skills/article-lifecycle/SKILL.md` — Added "Accuracy Gates" section (stages 6-7)
- `.squad/agents/editor/charter.md` — Added "Temporal Accuracy Checklist" to fact-checking

**Why:**
Temporal accuracy is non-negotiable. Readers who follow NFL closely will catch "Year 2" for a Year 3 player instantly. TLDRs drive engagement — busy readers scanning the site need 15-second answer to "Is this article for me?". Name accuracy protects credibility — one invented name undermines trust in everything else (contract projections, scheme analysis, etc.).

**Expected Impact:**
- Zero temporal accuracy errors (panel agents work from current context)
- 100% TLDR presence (Editor gate enforces before publish)
- Name verification as routine checklist

---

### 2026-03-16: Substack Section Routing Fix — `section_chosen: true`
**By:** Lead (debugging task from Joe Robinson)
**Status:** Implemented
**Affects:** `.github/extensions/substack-publisher/extension.mjs`

**What:**
Fixed Substack publisher extension's section assignment for drafts. Root cause: missing `section_chosen: true` field in PUT request.

**Changes:**
1. PUT body minimized: Changed from spreading full draft payload to minimal body with only section fields: `{ section_id, draft_section_id, section_chosen: true }`
2. Verification GET added: After PUT, fetch persisted draft to confirm `draft_section_id` and `section_chosen` saved
3. Integer coercion added for `sectionId` safety
4. Output enhanced to show GET verification results including `section_chosen` status

**Key API Finding:**
Substack's draft editor checks `section_chosen === true` before displaying section in UI dropdown. Without this flag, `draft_section_id` is stored but editor treats it as unset. Old code never sent `section_chosen`, so every draft appeared to have no section despite API confirming ID.

**Verification:**
Test draft 191082679 (NE Patriots, section 355520) confirmed via GET: `draft_section_id: 355520, section_chosen: true`.

---

### 2026-03-16: Drake Maye Article Fact Corrections — Year 3 Reframe
**By:** NE (New England Patriots Expert)
**Status:** Completed
**Affects:** `content/articles/ne-maye-year2-offseason/draft.md`

**What:**
Comprehensive fact-check and rewrite of Drake Maye offseason article. Article was written using 2024 (Year 1) data but Maye just finished his 2nd season (2025). All content updated to reflect Year 3 framing (2026 offseason).

**Critical Corrections:**
- "just finished a rookie season" → "just finished his sophomore campaign"
- 66.6% comp, 2,276 yds, 15 TDs → 72.0% comp, 4,394 yds, 31 TDs, 8 INTs
- PFF OL graded "worst in NFL" → improved from 32nd to ~6th after additions
- "#4 overall pick" → "#31 overall pick" (14-3 record, Super Bowl runner-up)
- "new head coach in Mike Vrabel" → "coaching staff entering Year 2"
- All "Year 2" references for upcoming season → "Year 3"
- $73.5M cap projection → $92M (per OTC)

**Major Rewrites:**
1. Intro/Hook — reframed from "unproven rookie" to "MVP-caliber sophomore post-SB loss"
2. The Situation — OL from "worst" to "dramatically improved", WR from "bare cupboard" to "partially addressed"
3. Cap Math — acknowledged completed FA moves (Doubs, AVT, Jones, Byard), updated remaining scenarios
4. Draft Board — complete rewrite from #4 pick logic to #31 pick logic, trade-down to trade-up math
5. Debate sections — WR debate (Doubs already signed), pick debate (#31 context), Year 3 framing
6. Verdict Blueprint — updated targets for #31 context

**Added Content:**
- TLDR callout box (4 bullets)
- Maye's 113.5 passer rating, 77.1 QBR, 2nd-team All-Pro, MVP consideration
- 14-3 record, Super Bowl LX loss to Seattle 29-13
- Post-FA spending breakdown with cap hits
- 11 total draft picks context
- Updated AFC East: MIA released Tua, NYJ 3-14, BUF fired McDermott

**Verified As Correct:**
- ~$44M cap space (OTC: $43.9M)
- $301.2M salary cap
- $10M Maye cap hit
- $33.7M dead money total
- Dugger ($12.2M), Diggs ($9.7M), Peppers ($3M)
- Mike Vrabel HC, Josh McDaniels OC
- All 4 draft prospects are real 2026 prospects

**Impact:**
Article title remains accurate. Slug (`ne-maye-year2-offseason`) unchanged per instructions.

---

### 2026-03-16: Cardinals Article Draft Structure
**By:** Writer
**Article:** Arizona Cardinals 2026 Offseason (#40)
**Status:** Draft complete, pending Editor review

**What:**
Structured the Cardinals article around the QB timing disagreement as central tension rather than dead-cap or #3 pick evaluation. Cap's "dead cap as receipt" reframe and Offense's "Lamborghini on regular unleaded" urgency create narrative engine. Verdict endorses Draft's two-step plan (Bain at #3 + trade back for Simpson) with Offense's shorter leash on Brissett as modifier.

**Rationale:**
- Dead-cap angle is obvious but one-section story
- QB timing gives every expert distinct lane
- ARI's trade-down dissent preserved as honest outlier
- Cap's Path D (wait until 2027) presented as strongest counterargument

**Editor Watch Items:**
LaFleur's title chain (OC → HC), Simpson's start count, 2027 QB class eligibility, Harrison Jr. CBA extension timeline. Eight items flagged in writer notes.

---

### 2026-03-16T03:25:56Z: User Directive — Pipeline Progress Comments
**By:** Joe Robinson (via Copilot)
**What:** Pipeline progress comments should be more frequent — post to GitHub issue after each individual panel agent completes, not just after full panel batch. The 45-minute pipeline felt opaque with too few check-ins.
**Why:** User request — captured for team memory

**What:** jsn-extension-preview article had duplicate inline images. Regenerated jsn-extension-preview-inline.png (Attempt 1 rejected for AI text hallucination; Attempt 2 approved with improved prompt). Final hashes verified unique: 550CFD87 ≠ 18CBD39A. Republished to Substack draft 191077419.

**Images:**
- inline.png (fountain pen + blank papers + football field): 550CFD87 ✅ 
- inline-2.png (data stream/circuit theme): 18CBD39A ✅
- Status: Not duplicates

**Why:** Ensures JSN article publishes with verified unique assets. Duplicate image issue now resolved with hash verification and prompt engineering fixes applied.

### 2026-03-16T03:42:21Z: User directive — Publish with tags, not sections/bylines
**By:** Joe Robinson (via Copilot)
**What:** Stop assigning Substack sections during publish, clear bylines because they break, and use tags instead — always tag the team and also tag any specialist agents who participated.
**Why:** User request — captured for team memory


### 2026-03-16: Substack publishing — sections removed, tags adopted

**By:** Lead (on behalf of Joe Robinson)
**Status:** Implemented

**Decision:** Stop assigning Substack sections during publish. Stop sending `draft_bylines` (was breaking). Instead, tag each post with:
1. The team name (full, e.g. "San Francisco 49ers")
2. Any specialist agents who contributed artifacts (e.g. "Cap", "Offense", "Defense")

**Rationale:**
- Per-team sections are not the correct Substack taxonomy for this publication
- `draft_bylines` payload was causing publish failures
- Tags provide flexible, additive categorization without the rigidity of sections

**Tag convention:**
- Team tag: full NFL team name as provided or auto-detected from `pipeline.db`
- Specialist tags: derived from article directory filenames (`{role}-position.md`, `{role}-panel.md`, etc.), title-cased
- Team agent files (identified by NFL abbreviation prefix) are excluded from specialist tags

**Implementation:**
- `getSectionId()`, section PUT/verify, and `draft_bylines` removed from extension
- `postTags` array added to draft creation payload
- `deriveTagsFromArticleDir()` scans article directory for specialist artifacts
- Success output now reports tags instead of section status
- All related skill docs updated

**Affects:** Publisher extension, substack-publishing skill, publisher skill, substack-article skill, article-lifecycle skill


### 2026-03-17: README.md Documentation Update — Publishing Behavior

**Date:** 2026-03-17  
**Decision Maker:** Lead (Joe Robinson directive)  
**Category:** Documentation Accuracy

**Problem:**
README.md lines 139–141 contained stale language describing automated Substack publishing behavior:
- "routed to the correct team section" — implied automatic per-team section assignment
- Missing description of actual tag-based publishing
- No mention of specialist agent tags

These descriptions no longer matched the operational publishing model after the sections→tags migration (2026-03-16).

**What Changed:**

Old language (L139–L141):
\\\
- [x] **Automated publishing** — `publish_to_substack` Copilot extension creates Substack drafts directly from article markdown files, routed to the correct team section
- [x] **MCP servers / extensions** — `publish_to_substack` Copilot extension (`.github/extensions/substack-publisher/`) enables automated Substack publishing
- [x] **32-team sections** — All NFL teams have dedicated Substack sections with official brand colors on both `nfllab` and `nfllabstage`
\\\

New language (L139–L141):
\\\
- [x] **Automated publishing** — `publish_to_substack` Copilot extension creates Substack drafts directly from article markdown files, tagged with team + specialist tags for categorization
- [x] **MCP servers / extensions** — `publish_to_substack` Copilot extension (`.github/extensions/substack-publisher/`) enables automated Substack publishing with tag-based routing
- [x] **32-team sections** — All NFL teams have dedicated Substack sections with official brand colors on both `nfllab` and `nfllabstage`
\\\

**Rationale:**
1. **Section routing removed:** The publisher extension no longer assigns drafts to per-team sections. Tags are the organizing mechanism.
2. **Tag-based categorization:** Drafts now carry two types of tags:
   - Team tag (full team name, e.g. "San Francisco 49ers")
   - Specialist tags (agent roles from panel, e.g. "Cap", "Offense", "Defense")
3. **No bylines:** Old code had broken `draft_bylines` logic. This is now cleared entirely.
4. **Accuracy:** README is team-facing documentation. Stale language misleads future contributors about the actual publishing behavior.

**Impact:**
- **Low risk:** These are documentation lines only. No code changes. README describes behavior that already changed.
- **High value:** Prevents future confusion about publishing workflow.
- **Scope:** Minimal edit (3 lines, same section, no roadmap/status changes elsewhere).

**Files Changed:**
- `README.md` — lines 139–141 updated

**Decision:**
✅ **APPROVED** — Update README to reflect current tag-based publishing behavior. Minimal, surgical change with high accuracy impact.


### 2026-03-16T04:18:50Z: User directive — Social link image preference
**By:** Joe Robinson (via Copilot)
**What:** The preferred Witherspoon visual reference is the social link image, not the cover image. Track a future backlog item to update social image handling, and leave it unassigned.
**Why:** User request — captured for team memory.


### 2026-03-16: AFC East Batch Progress — Issues #43, #44, #45
**By:** Lead (Danny)
**Status:** In-progress
**What:** Processed the AFC East batch (BUF, MIA, NYJ) using the idea-generation-first workflow. Advanced MIA (#44) as the strongest article (12/12 score) through to panel-ready stage. BUF (#43) and NYJ (#45) remain at `stage:idea`. Added `stage:idea`, `stage:discussion-prompt`, `stage:panel-ready` labels to the repo.
**Why:** MIA's $99.2M dead cap story is a historic NFL event — unprecedented financial constraints, new regime, full roster teardown. It has natural tension and broad appeal. BUF and NYJ are strong but more conventional; they benefit from waiting for MIA to validate the pipeline. 3-agent panel (Cap + MIA + Draft) is tight and non-overlapping.


### 2026-03-17: Fix draft_bylines in Substack publisher extension
**By:** Lead (Danny)
**What:** Add `draft_bylines: []` to the POST payload in `createSubstackDraft()` in `.github/extensions/substack-publisher/extension.mjs`. The API requires this field to be present — omitting it entirely triggers an HTTP 400 validation error.
**Why:** Discovered during republishing of NE Patriots / Drake Maye article. No functional change to draft behavior (empty bylines = Substack uses account default).


### 2026-03-17: Social Link Image — Backlog Tracking (Issue #70)
**By:** Lead (Danny)
**Status:** Recorded
**Affects:** Writer, Editor, image generation pipeline
**What:** Created GitHub issue #70 to track future work on social link image (Open Graph / `og:image`) generation and consistency across Substack articles. No `squad` labels — backlog only, unassigned. Joe identified the Witherspoon v2 social link preview image as the preferred style reference.
**Why:** Social link previews (Twitter/X cards, LinkedIn, iMessage, Slack) are the first visual impression for shared articles. Consistent, high-quality social image style improves click-through and brand consistency. Future work — no immediate action required.


### 2026-03-17: Witherspoon Article Refresh — Process & Artifact Structure
**By:** Lead (Danny)
**Status:** Informational
**What:** Regenerated the Witherspoon extension article (Article #2, originally published 2026-03-14) using the full current pipeline. Reconstructed discussion prompt from original article, spawned 3-agent panel (Cap, PlayerRep, SEA) with fresh positions, produced complete v2 draft. All 6 artifacts saved to `content/articles/witherspoon-extension-v2/`. Original article preserved as archive. Removed all WA tax legislation references per post-v1 content constraint; replaced with football/business arguments. Panel convergence tighter than v1 ($30.5–32.5M range vs. original $27–33M).
**Why:** Pre-pipeline articles can be retroactively structured. The published article serves as the source artifact when no pipeline files exist. Pattern established for future retroactive pipeline runs.


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



### 2026-03-16T04:32:24Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** Max out parallel throughput for Ralph across all issues right now. Do not use artificial caps; only block on real dependencies.
**Why:** User request — captured for team memory


---
type: "idea"
agent: "DEN"
issue: 54
idea_id: "den-missing-joker-te-championship-window"
score: 12
status: "pending"
---

# Article Idea: The Missing Joker — Sean Payton's Tight End Problem Could Define Denver's Championship Window

**Issue:** #54 — Article: DEN - Denver Broncos — 2026 Offseason
**Generated by:** DEN (Denver Broncos Expert)
**Date:** 2026-03-16

## Decision

DEN selected the **Tight End "Joker" crisis in Payton's system** as the single strongest angle for the Broncos' 2026 offseason article. This was chosen over:

1. ~~Bo Nix ankle recovery~~ — Important but binary (he's expected back by May OTAs); lacks sustained tension
2. ~~Aging OT bookends (Bolles/McGlinchey)~~ — Real concern but more of a 2027 story; less immediate
3. ~~Davis Webb as first-time playcaller~~ — Interesting but works better as context within the TE angle
4. ~~AFC West window opportunity (KC declining)~~ — Broad divisional overview; less specific than a single-position deep dive
5. ~~Draft BPA vs. need at #30~~ — Subsumed into the TE angle as a key tension point

## Why This Angle

- **Connects coaching identity to roster construction:** Payton's entire offensive DNA revolves around the TE Joker — this isn't just a positional need, it's an identity crisis
- **Multi-layered tension:** Engram's failed experiment + draft dilemma (Sadiq vs. Allen at #30) + Webb playcalling shift + championship window urgency
- **Data-rich:** Engram's 50/461/1 stat line, $14.2M cap hit, Payton's historical TE production in NO, draft prospect comparisons
- **Time-sensitive:** Draft April 23-25; Engram decision looming; Webb playcalling just announced at Combine
- **12/12 rubric score** — maximum on all four dimensions

## Stages Completed

- ✅ Stage 1 — Idea Generation (angle + data posted to issue #54)
- ✅ Stage 2 — Discussion Prompt (structured brief with 3-agent panel posted to issue #54)

## Recommended Next Step

Lead should confirm the panel (DEN + Cap + Offense) and advance to Stage 3 → Stage 4 — Panel Discussion. All three agent questions are defined in the Stage 2 discussion prompt artifact.

---

## Evaluation Checklist
- [x] Trigger is clear (AFCCG loss + Engram failure + draft approaching + Webb playcalling shift)
- [x] Angle is unique (Payton TE history as framing device — not covered in this specific combination)
- [x] DEN relevance is explicit (franchise-defining offseason question)
- [x] Reader value is defensible at depth level 2
- [x] Window/date alignment is sound (pre-draft, ASAP)
- [x] Time-sensitive flag: YES (draft April 23-25, Engram decision pending)


# Decision: Witherspoon v2 Draft — Editor Approved

**Date:** 2026 Offseason
**Author:** Editor
**Article:** Witherspoon Extension v2 (`content/articles/witherspoon-extension-v2/draft.md`)

## Decision

The regenerated Witherspoon extension article (v2) is **editor-approved** after 3 corrections.

## Context

Lead regenerated the Witherspoon article from scratch because the original (v1) predated the current editorial pipeline. The v2 draft was built from fresh position files (Cap, PlayerRep, SEA) and a new discussion summary, then reviewed against all source material.

## Changes Made

1. **Temporal fix (🔴):** "Six months after Super Bowl LIX" → "A month after Super Bowl LIX" — the article is set in March 2026; the Super Bowl was February 2026.
2. **Arizona descriptor (🟡):** "Arizona is still building" → "Arizona is retooling" — per decisions.md competitive descriptor convention.
3. **Missing credential (🟢):** Added All-Pro (2nd Team, 2025) to Witherspoon's stats table — present in discussion prompt but missing from draft.

## What This Means for the Team

- The draft is ready for the next pipeline step (images, publisher pass, or publication).
- The v2 article supersedes the old `witherspoon-extension-cap-vs-agent.md` — Lead should decide whether to archive or remove v1.
- Cap's position is now correctly modeled at $30.5M AAV (not the old $27M), reflecting the post-McDuffie market. This is a permanent framing shift for all future Witherspoon references.

## Pattern to Watch

Temporal claims in regenerated articles are high-risk. When an article is rewritten months after the original concept, time references ("six months after," "this offseason") can drift from the article's own internal calendar. Always verify time references against season context during editorial review.


---
type: "idea"
agent: "HOU"
issue: 50
idea_id: "hou-100m-countdown-stroud-anderson"
score: 12
status: "pending"
---

# Article Idea: Houston's $100 Million Countdown

**Issue:** #50 — Article: HOU - Houston Texans — 2026 Offseason
**Generated by:** HOU (Houston Texans Expert)
**Date:** 2026-03-16

## Decision

HOU selected the **Stroud/Anderson extension cliff** as the single strongest angle for the Texans' 2026 offseason article. This was chosen over:

1. ~~Interior DL crisis~~ — Important but narrower; works better as a section within the extension article
2. ~~Dead money drag~~ — Symptomatic of past decisions; less forward-looking
3. ~~Division arms race (JAX)~~ — Good but better as secondary context within a larger piece
4. ~~Post-Mixon RB room~~ — Lower stakes; RB is a lower-priority need

## Why This Angle

- **Affects everything:** Every roster decision (draft, FA, restructures, cuts) flows through the extension math
- **Time-sensitive:** Anderson extension expected this spring; Stroud 5th-year option decision imminent
- **Reader demand:** "Can we afford both?" is the #1 question Texans fans are asking
- **Data-rich:** Cap projections, extension comparables, draft prospect mapping all available
- **12/12 rubric score** — maximum on all four dimensions

## Stages Completed

- ✅ Stage 1 — Idea Generation (angle + data posted to issue #50)
- ✅ Stage 2 — Discussion Prompt (structured brief with 4-agent panel posted to issue #50)

## Recommended Next Step

Lead should confirm the panel (HOU + Cap + Draft + Defense) and advance to Stage 4 — Panel Discussion. All four agent questions are defined in the Stage 2 comment.

---

## Evaluation Checklist
- [x] Trigger is clear (extension timeline + draft approaching + FA spending underway)
- [x] Angle is unique (no existing "cap countdown" framing for HOU in project)
- [x] HOU relevance is explicit (franchise-defining decision)
- [x] Reader value is defensible at depth level 2
- [x] Window/date alignment is sound (pre-draft, ASAP)
- [x] Time-sensitive flag: YES (Anderson extension imminent)


---
type: "article-angle"
agent: "IND"
issue: 51
status: "approved-by-agent"
date: "2026-03-16"
---

# Decision: IND Issue #51 — Article Angle Selection

## What
Selected **"The Colts Bet Two First-Round Picks on a 7-2 Start. They Finished 8-9. Now What?"** as the article angle for the Indianapolis Colts 2026 offseason piece.

## Why This Angle Over Alternatives

**Considered and rejected:**
1. *"Alec Pierce $114M Bet"* — Interesting but narrow. Pierce extension is one piece, not the defining story.
2. *"QB Purgatory (Jones/Richardson/Leonard)"* — Strong but well-covered by beat reporters. Less unique framing.
3. *"8-2 to 8-9 Collapse"* — Symptom, not cause. The Sauce trade IS the cause.
4. *"AFC South Arms Race"* — Division-level story doesn't center IND strongly enough.

**Why the Sauce Gardner gamble wins:**
- It's the single decision that explains EVERYTHING else about this offseason
- Creates cascading analysis: trade cost → draft capital loss → roster gaps → division positioning
- Unique "cap-rich, draft-poor" framing that no beat writer has used
- Scores 12/12 on idea generation rubric
- Broad appeal: cautionary tale for all NFL fans + deep IND-specific analysis

## Impact
- Article artifacts created: `content/articles/ind-sauce-gardner-gamble/`
- Issue #51 advanced to `stage:panel-ready`
- Panel: Cap + IND + Defense (3 agents)

## For Lead
No action needed unless Lead wants to adjust the panel or angle. Ready for panel discussion spawn.


---
type: "article-angle"
agent: "JAX"
issue: 52
status: "pending"
---

# Article Angle Decision: JAX 2026 Offseason — Issue #52

## Decision
Selected **"The Travis Hunter Paradox"** as the article angle for the Jacksonville Jaguars 2026 offseason piece.

## Angle Summary
Did Jacksonville's all-in bet on Travis Hunter — the NFL's only two-way WR/CB starter — create a roster construction paradox that threatens their 2026 contention window? The trade cost (2026 1st-round pick), the LCL injury, the cap crunch ($53M dead money), and the position depth it strains (CB, WR allocation, RB, LB) all flow from the Hunter decision.

## Why This Angle Over Alternatives
| Angle Considered | Score | Why Not Selected |
|-----------------|-------|-----------------|
| **Travis Hunter Paradox** | 12/12 | ✅ SELECTED — only applies to JAX, unprecedented in NFL |
| Cap Hell + Contending | 9/12 | Good but generic — many teams face cap crunches. Less unique. |
| Brian Thomas Jr. Trade Rumors | 8/12 | Interesting but GM shut it down publicly. Less tension remaining. |
| Post-Etienne RB Room | 7/12 | Valid need but narrow scope; less reader appeal outside JAX fans. |
| No 1st-Round Pick Strategy | 8/12 | Good angle but better as a sub-theme within the Hunter story. |

The Hunter angle is the umbrella that **connects all the other sub-stories** — the trade cost created the cap/draft constraints; the two-way usage affects BTJ's role and CB depth; the injury raises workload questions. One angle, five threads.

## Panel
JAX + Cap + Defense + Offense (4 agents, max for Depth Level 2)

## Impact
- Issue #52 advanced from Stage 1 → Stage 3 (Panel Ready)
- Labels updated: removed `go:needs-research`, added `stage:panel-ready`, `squad:jax`, `squad:cap`, `squad:offense`, `squad:defense`
- Two detailed comments posted to issue with research, angle, discussion prompt, and panel composition

## Next Action
Lead (or any coordinator) spawns Stage 4 panel discussion with the 4 named agents.


---
type: "article-angle"
agent: "kc"
issue: 55
status: "pending"
created: "2026-03-16"
---

# KC Issue #55 — Article Angle Decision

## Decision
Selected "Mahomes Is Racing Back — But to What?" as the article angle for the KC 2026 offseason piece.

## Rationale
Scored 12/12 on the idea-generation rubric. The "what does Mahomes return to?" framing is the strongest single angle because it:
1. Ties together every major KC storyline (ACL recovery, roster overhaul, cap gymnastics, Rice suspension risk, division arms race) into one coherent narrative
2. Has national appeal — Mahomes is a league-wide story, not just a KC story
3. Creates genuine tension — reasonable people disagree on reload vs. rebuild vs. twilight
4. Is time-sensitive — best published pre-draft while the roster picture is still forming

## What Was Rejected
- "Chris Jones' $44.85M Gamble" — too narrow (cap story only, not enough narrative breadth)
- "Kelce's Last Ride" — emotionally compelling but speculative and thin on data
- "AFC West Power Shift" — dilutes KC focus across 4 teams
- "Rashee Rice: The Chiefs' Impossible Decision" — too dependent on external ruling; could age poorly

## Panel
KC + Cap + Offense (3 agents, Level 2 — The Beat)

## Stage Reached
panel-ready (Stages 1-3 complete). Next: spawn panel agents.

## Artifacts
- `content/articles/kc-mahomes-return-roster-gamble/idea.md`
- `content/articles/kc-mahomes-return-roster-gamble/discussion-prompt.md`
- `content/articles/kc-mahomes-return-roster-gamble/panel-composition.md`


---
type: "idea"
agent: "LAC"
issue: 56
idea_id: "lac-mcdaniel-gambit-herbert-cap-window"
score: 12
status: "pending"
created: "2026-03-16"
---

# Article Idea: The McDaniel Gambit — Can the Chargers Arm Herbert Before His Cap Hit Explodes?

## Summary
The Chargers have a 2–3 year window to build a Super Bowl contender before Herbert's cap hit balloons to $71M. They hired McDaniel to transform the offense, but the WR room has no alpha, they lost their best pass rusher, and they have only 5 draft picks — while KC's dynasty crumbles and the AFC West is wide open. The article frames the all-in-now vs. build-patiently decision through the lens of Herbert's escalating cap.

## Teams
- **Primary:** LAC (Los Angeles Chargers)
- **Secondary:** KC (division comparison), PHI (A.J. Brown trade angle)

## Depth Level
2 — The Beat (balanced data + story, 2000-3500 words)

## Publish Window
Pre-draft (ASAP — 2026 offseason)

## Time Sensitive
Yes — A.J. Brown trade rumors are active; NFL Draft is April 23–25, 2026

## Recommended Panel
| Agent | Role | Question |
|-------|------|----------|
| LAC | Team context, roster gaps, division outlook | What are the realistic paths to WR1 and EDGE solutions this offseason? |
| Cap | Cap/contract analysis | How does Herbert's escalating cap shape the 2026-2028 spending strategy? |
| Offense | Scheme fit under McDaniel | What does McDaniel's system need from the WR room and how does the current roster fit? |

## Reasoning
- **Why this angle?** Herbert's cap escalation creates an automatic clock. Every roster decision this offseason is filtered through "will this matter before we're cap-strapped?" That's universal tension for any Chargers reader.
- **Why now?** Free agency is still active, Brown trade rumors are live, draft is 5 weeks away. All three decision paths (trade, draft, stand pat) are still viable — the article catches readers at the fork in the road.
- **Why this depth?** Depth 2 balances the cap numbers and scheme analysis with a narrative that casual fans can follow. Not so deep it requires cap accounting fluency, not so casual it ignores the numbers.
- **Uniqueness:** No outlet has unified the cap escalation + McDaniel scheme change + KC decline + Brown trade as a single interconnected decision framework.

## Evaluation Checklist
- [x] Trigger is clear (coaching change + cap window + FA/draft decision point)
- [x] Angle is unique (cap escalation as ticking clock, not just "offseason preview")
- [x] Team relevance is explicit (LAC-specific, Herbert-centered)
- [x] Reader value is defensible at depth level (decision framework fans can engage with)
- [x] Window/date alignment is sound (pre-draft, trade rumors active)
- [x] Time-sensitive flag is correct (yes — draft and Brown trade deadline approaching)


---
type: "batch-progress"
agent: "lead"
batch: "afc-north"
issues: [46, 47, 48, 49]
status: "in-progress"
date: "2026-03-16"
---

# Decision: AFC North Article Batch — Prioritization & Stage Progress

## Context
Four AFC North issues (#46-#49) picked up in a single session. All started as template-state "IDEA GENERATION REQUIRED."

## Decisions Made

### 1. BAL #46 prioritized for deeper push (Stage 2)
**Rationale:** The Crosby trade is the biggest single transaction of the 2026 offseason. The "two first-round picks for a veteran" angle has clear cap math to model, a coaching transition narrative (Harbaugh → Minter), and a win-now-vs-pipeline tension that generates genuine disagreement. Reader interest is high — this trade just happened.

### 2. PIT #49 flagged as time-sensitive
**Rationale:** The Rodgers retirement/return decision could break any day. If he announces before the article progresses, the framing shifts from "will he or won't he" to "what happens now." This should be the SECOND issue advanced after BAL.

### 3. Three-agent panels for all four articles
**Rationale:** All four are Depth Level 2 (The Beat), which supports 3-4 agents. Three-agent panels (team + 2 specialists) provide enough perspective without redundancy. BAL gets Defense as the third agent (scheme fit matters most); CIN, CLE, PIT all get Cap + Offense/Defense.

### 4. CLE #48 angle: "Three QBs, no answer" over "Watson contract trap"
**Rationale:** The Watson dead cap angle has been covered extensively. The fresher tension is the three-way QB competition under a new system-specific coach (Monken). The O-line spending ($93M+) creates a concrete data anchor that elevates this beyond another "Watson bad" article.

## Priority Order for Next Session
1. **BAL #46** — Stage 3/4 (panel spawn + discussion)
2. **PIT #49** — Stage 2 (discussion prompt) — time-sensitive
3. **CIN #47** — Stage 2
4. **CLE #48** — Stage 2

## Artifacts Created
- `content/articles/bal-2026-offseason/idea.md`
- `content/articles/bal-2026-offseason/discussion-prompt.md`
- `content/articles/cin-2026-offseason/idea.md`
- `content/articles/cle-2026-offseason/idea.md`
- `content/articles/pit-2026-offseason/idea.md`


# Decision: Retarget Ralph Loop for NFL Article Pipeline

**Date:** 2025-07-25
**Author:** Lead
**Status:** Implemented
**Scope:** github-copilot-ralph-loop repo (external to nfl-eval)

## Context

The Ralph Wiggum loop repo (`github-copilot-ralph-loop`) was a demo driving Copilot CLI to build a .NET Hello World app. Joe wants it retargeted to autonomously drive the nfl-eval team-article backlog (issues #40–#69) through the 8-stage article pipeline until Substack drafts exist.

## Decision

Rewrote all Ralph loop files to target nfl-eval:

1. **Script targets nfl-eval** via `-TargetRepo` param (defaults to sibling checkout `../nfl-eval`).
2. **Prompt instructs Lead behavior** — pick next backlog item by priority, advance one stage, commit, repeat.
3. **PRD defines the 8-stage pipeline** with done criteria per stage and issue-label-based stage tracking.
4. **Default model changed to `claude-sonnet-4.5`** — better at long-form content than `gpt-5-mini`.

## Key Assumptions

- **Backlog priority:** finish mid-pipeline items first → `go:yes` items → `go:needs-research` items → tie-break by issue number.
- **One stage per iteration:** keeps changes atomic and reviewable. At 30 issues × ~7 stages each, full clearance needs ~210 iterations (or batching multiple stages later).
- **Stage 8 stays manual:** Joe always makes the final publish decision in Substack.
- **Model choice:** `claude-sonnet-4.5` balances quality and cost; switch to `claude-opus-4.6` for premium runs.

## Risks

- **Prompt drift:** The prompt is static. If nfl-eval's pipeline conventions evolve, the prompt needs manual updates.
- **Rate limits:** 210+ Copilot CLI invocations may hit rate limits. The `$Model` variable can be switched to lighter models if needed.
- **Substack auth:** Stage 7 requires `.env` credentials configured in nfl-eval. If missing, that stage will fail gracefully.

## Alternatives Considered

- **Multi-stage per iteration:** Faster but harder to debug. Chose one-stage-per-iteration for safety.
- **GitHub Actions instead of local loop:** More robust for unattended runs, but adds infra complexity. Local loop is fine for now.


---
type: "idea"
agent: "lv"
idea_id: "lv-2026-offseason-crosby-paradox"
issue: 57
score: 12
status: "pending"
---

# Article Idea: The Crosby Paradox — How a Voided Trade Rewrote the Raiders' Entire Rebuild

## Decision Summary

**What:** Selected "The Crosby Paradox" as the angle for LV's 2026 offseason article (issue #57). The voided Maxx Crosby trade to Baltimore is the single most consequential event shaping this franchise's rebuild trajectory.

**Why this angle over alternatives:**
1. **"Building Around Mendoza"** — too generic, every outlet is covering the #1 pick storyline
2. **"Raiders Offseason Report Card"** — list format, no tension, no disagreement
3. **"Crosby Paradox"** — counter-narrative, creates genuine expert disagreement, backed by specific numbers, time-sensitive (draft April 23)

**Key facts driving the angle:**
- Crosby's $35.8M cap hit + Paye's $16M/yr = $47M+ in edge rusher spending on a 3-14 team
- Lost #14 overall + 2027 R1 from BAL — two premium picks that defined the rebuild plan
- Raiders already signed Crosby's "replacements" before the trade was voided
- Crosby rehabbing meniscus — may not be fully healthy for Week 1

**Panel recommendation:** Cap + LV + Defense (3 agents per Depth Level 2 limits)

**Risk:** If Crosby gets traded again before publish, the angle shifts — but the "paradox" framing still holds as historical analysis.


---
type: "article-angle"
agent: "TEN"
issue: 53
status: "complete"
date: "2026-03-16"
---

# Decision: TEN Article Angle — Issue #53

## What
Selected article angle for the Tennessee Titans 2026 offseason first post: **"52 Sacks and a Defense-First Draft — Are the Titans Building Around Cam Ward or Robert Saleh?"**

The angle frames the #4 overall pick as a proxy for a deeper philosophical tension between Saleh's defense-first coaching identity and Daboll's mandate to develop Ward. It connects FA spending patterns (overwhelmingly defensive), the Sneed release, and draft prospect options (EDGE vs. WR) into a single narrative thread.

## Why This Angle Over Others
- **"Who do the Titans draft at #4?"** — Too narrow. Every mock draft outlet covers this. Our article needs a "why should you care" layer.
- **"The secondary overhaul"** — Interesting but backward-looking. Signings are done. Less tension.
- **"Speed-running a rebuild"** — Too broad. Hard to make specific and data-driven in 2,500-3,500 words.
- **"Ward vs. Saleh at #4"** — Combines the draft question with the organizational philosophy question. Fresh framing. Strong tension. Data-rich. Time-sensitive (draft window).

## Artifacts Created
- `content/articles/ten-ward-vs-saleh-draft-identity/idea.md` (Stage 1)
- `content/articles/ten-ward-vs-saleh-draft-identity/discussion-prompt.md` (Stage 2)
- `content/articles/ten-ward-vs-saleh-draft-identity/panel-composition.md` (Stage 3)

## Stage Reached
`stage:panel-ready` — Ready for Lead to spawn 4-agent panel discussion.

## Key Research Finding
L'Jarius Sneed was released March 13, 2026 (post my last knowledge update). This frees ~$11.4M in cap, pushing effective space to ~$50M+. Changes the "can they afford to go defense at #4 AND help Ward?" calculus significantly.



# Decision: ATL Panel Position — atl-2026-offseason

**Agent:** ATL
**Date:** 2026-03-15
**Article:** atl-2026-offseason
**Issue:** #66

## Decision

Framed the Falcons' 2026 offseason as a **bridge year with contention upside** rather than a rebuild. The key analytical stance: 8-9 was a coaching-suppressed record, not a talent-level record. Stefanski's hiring recontextualizes the roster — this is a 10-win caliber team if the QB room cooperates.

## Core Recommendation

Atlanta is a **9-8 to 10-7 team** with legitimate NFC South contention potential. The ceiling (11-6 division champs) depends on Penix's ACL recovery and Stefanski's ability to build a run-first identity around Bijan Robinson. The floor (6-11) is a QB health catastrophe where both Penix and Tua miss significant time.

## Chosen Angle

**"Two QBs, Zero Guarantees — Atlanta's Bridge Year Might Actually Be a Contention Year"**

The tension between patience (stockpile for 2027's $156M cap explosion) and opportunity (wide-open division + coaching upgrade + roster that underperformed). Scored 12/12 on the idea rubric.

## Hardest Tradeoff

The new regime must decide how much of 2027's massive cap space to sacrifice for 2026 competitiveness. Restructuring Bates or Matthews creates 2026 room but pushes dead money into the year they're supposed to have maximum flexibility. The tradeoff is *compete now in a weak division* vs. *preserve the 2027 reload*.

## Implications for Future Articles

- Any draft preview piece should weight WR and EDGE heavily at #48 — these are the swing positions.
- Penix ACL rehab updates are a first-order storyline for training camp coverage.
- The Stefanski/Rees offensive installation is a standalone article candidate by preseason.
- Kyle Pitts usage in Stefanski's TE-friendly system could be a mid-season evaluation piece.
- The 2027 "cap explosion" offseason will be a major article when extension decisions begin (Pitts, Bijan, London).

---
date: 2026-03-16
agent: BAL
status: decision
topic: Panel Position Protocol — Hypothetical vs. Reality Conflict
---

# Decision: How to Handle Article Premises That Conflict with Reality

## Context
Issue #46 article premise: Maxx Crosby trade COMPLETED (March 16 artifacts).
BAL history.md reality: Maxx Crosby trade VOIDED on March 13 (failed physical).

Joe requested BAL write the panel position for "the Crosby-trade article." The article folder exists with completed idea.md and discussion-prompt.md, all premised on the trade happening.

## Decision Made
**Proceeded with the article premise as written.** Treated the trade as completed, wrote the BAL position arguing for/against the move within the hypothetical scenario.

## Rationale
1. **User instruction was explicit:** "Write the Ravens team-expert panel position for the current BAL article" and "reuse the local BAL article folder for the Crosby-trade article."
2. **Article artifacts are internally consistent:** The idea.md and discussion-prompt.md both assume the trade happened. The panel discussion requires internally consistent analysis.
3. **Hypothetical analysis has value:** Even if the trade didn't happen in reality, analyzing "what if it had" provides insights into Ravens roster construction philosophy, cap tradeoffs, and identity questions.
4. **Lead owns article factual accuracy:** It's Lead's job to reconcile article premises with reality before publishing. BAL's job is to provide expert Ravens perspective on the scenario presented.

## Protocol Established
When asked to contribute to an article with a premise that conflicts with known reality:
- **Clarify with the requester** if unsure (not applicable here — Joe was explicit)
- **If the requester is clear:** Proceed with the article premise as written
- **Note the discrepancy in your history.md** for future reference
- **Trust the article pipeline:** Lead/Editor will catch factual conflicts before publish

## Next Steps
- Lead should review whether this article proceeds to drafting or is archived as a "what-if" scenario piece
- If published, it should be framed as hypothetical analysis or alternate-timeline exploration

---
**Filed by:** BAL
**Reviewed by:** (pending)

# Decision: BUF Panel Position — buf-2026-offseason

**Agent:** BUF
**Date:** 2026-03-15
**Article:** buf-2026-offseason

## Decision

Framed the Bills' offseason as a **deliberate scheme-change retool** rather than a panicked rebuild or reckless all-in. The key analytical stance: Leonhard's 3-4 installation recontextualizes the defensive departures — the "lost four starters" narrative understates how poorly those players fit the new scheme anyway.

## Core Recommendation

Buffalo is a **conference-championship-caliber roster** with one structural vulnerability: LCB. CB at #26 is non-negotiable. The margin for error on defense (Chubb's knee, Strong's inexperience) is the binding constraint on a team whose offensive infrastructure (Allen, Cook, Moore, Kincaid, Torrence) is genuinely elite.

## Hardest Tradeoff

Beane bet the scheme change plus Chubb could replace four defenders cheaply — but if Chubb's knee fails or Strong can't hold up at LCB, Allen is carrying a defense that can't stop anyone in January. The tradeoff is *cost efficiency now* vs. *single-point-of-failure risk* at the two thinnest positions.

## Implications for Future Articles

- Any draft preview piece should weight CB heavily at #26 — this position wrote it as "non-negotiable."
- Chubb health updates are a first-order storyline for in-season evaluation.
- The Brady/Leonhard coaching evaluation is a standalone article candidate by Week 8.

---
agent: cap
timestamp: 2026-03-16T19:30:00Z
decision_type: panel_methodology
status: proposal
---

# Decision: Post-June 1 Designations as Cap Flexibility Tool

## Context

During the DEN 2026 offseason panel discussion (TE acquisition article), analyzed three scenarios for Evan Engram's contract: keep ($14.2M hit), cut pre-June 1 ($10.4M dead, $3.8M savings), cut post-June 1 ($5.2M dead in 2026, $5.2M dead in 2027, $3.8M usable now).

## Decision Made

Recommended post-June 1 designation as the optimal cap management strategy for aging veterans with significant dead money but limited roster value.

## Rationale

1. **Cash flow advantage:** Post-June 1 creates same immediate usable space ($3.8M) as pre-June 1 but defers half the dead money to following year when cap typically expands
2. **Strategic timing alignment:** Deferring $5.2M to 2027 aligns with Denver's McGlinchey decision (projected $23.8M 2027 cap hit); both dead-money hits can be absorbed in same year while clearing larger veteran contract
3. **Championship window optimization:** For teams in 2-year windows (rookie QB deals), maximizing year-1 usable space is more valuable than minimizing total dead money
4. **Roster construction flexibility:** The $3.8M 2026 savings enables in-season roster moves (trade deadline acquisitions, injury replacements) during critical championship window years

## Impact on Future Work

- **Cap position methodology:** Post-June 1 analysis should be standard practice for any veteran contract analysis where team has multi-year championship window
- **Dead money modeling:** When modeling cut scenarios, always include post-June 1 split-year option with year-over-year cap projection comparison
- **Timeline-aware cap management:** Cap decisions must be evaluated against team-specific championship window timelines (e.g., rookie QB deal expiration, defensive core extension deadlines)

## Team Relevance

Applies to any team with:
- Veteran contracts with significant dead money
- Defined championship windows (2-3 years)
- Projected cap expansion in following year
- Need for in-season roster flexibility

Examples: Teams with rookie-deal QBs (DEN, HOU, NE, WSH), teams with expiring QB windows (DAL, GB), teams clearing space before major extension years.

## Validation Needed

- Confirm OTC/Spotrac post-June 1 dead money split calculations are accurate
- Verify CBA rules around post-June 1 designation limits (believe it's 2 players per team per year — needs confirmation)
- Test this methodology on other aging veteran contracts (e.g., WR/OL in years 8-10)

---

**Submitted by:** Cap
**Scope:** Cap methodology, panel analysis workflow
**Next step:** Lead reviews and either approves as team standard or requests refinement

---
date: 2026-03-16
agent: Cap
context: HOU 2026 offseason article panel discussion
status: decision
---

# Decision: Extension Sequencing Methodology for Two-Star Cap Models

## Context

Writing the cap position for Houston's Stroud/Anderson extension article, I developed a methodology for modeling "two-megacontract" scenarios (QB + EDGE/WR1/OT) where both players hit extensions within 12-24 months of each other.

## Decision

**Standardize the two-star extension analysis framework:**

1. **Always model both "extend now" and "wait" scenarios** with year-by-year cap impact tables showing combined cap hits as % of total cap
2. **Calculate the "wait penalty"** — the AAV market escalation cost of deferring an extension (e.g., Stroud at $55M in 2026 vs. $62M in 2027 = $7M/year penalty)
3. **Identify the positional hierarchy** — which player must be extended first based on replaceability (QB > EDGE > WR1 > OT in most cases)
4. **Map the "cap crunch threshold"** — the year when combined cap hits exceed 28-30% of total cap, forcing roster construction into "thin depth" mode
5. **Show restructure opportunities with dead-money costs** — table format showing player, current cap hit, restructure savings, and 2-3 year dead money impact
6. **Recommend specific extension sequencing** with contract structure (years, AAV, guarantees) and timeline (which offseason)

## Rationale

This framework is reusable for any team facing dual mega-extensions:
- CIN: Burrow + Chase
- MIA: Tua + Tyreek (already done, but useful historical comp)
- LAC: Herbert + Derwin James
- DET: Goff + Aidan Hutchinson (upcoming)

The year-by-year cap modeling (2027-2030 projections) forces specificity instead of vague "cap crunch" warnings. Seeing "$90M committed to 2 players = 27.5% of cap in 2029" is actionable. "Extensions will be expensive" is not.

## Impact

- **For future cap panel positions:** Use this structure as a template for multi-extension articles
- **For team agents:** When requesting cap analysis, ask for the full sequencing model (not just "can we afford it?")
- **For Writer:** The tables are article-ready — drop them directly into the draft with minimal editing

## Example Output

See `content/articles/hou-2026-offseason/cap-position.md` for the full implementation.

Key artifact: The "Extension Modeling: Year-by-Year Cap Impact" section with Scenario 1 (extend now) vs. Scenario 2 (wait) tables showing 2026-2030 projections.

---

**Status:** Validated once (HOU article). Monitor for reusability on next multi-extension article (e.g., DET, CIN).

---
agent: Cap
article: kc-mahomes-return-roster-gamble
date: 2026-03-15
status: filed
---

# Cap Panel Position: KC Mahomes Article — One-Year Window Analysis

## Context

Panel position written for the KC Mahomes article ("Mahomes Is Racing Back — But to What?"). My role on the panel: map the 2026-2027 financial trajectory, determine if this is a one-year window or sustainable, and analyze the Chris Jones contract decision tree.

## Core Position

**This is a one-year championship push — then the cap explodes.**

The Chiefs cleared $98M in 2026 through trades, cuts, and restructures to build a win-now roster. But 2027 is structurally broken:
- Mahomes: $85.25M (31.2% of cap)
- Chris Jones: $44.85M (16.4% of cap)
- **Combined: $130.1M on two players** (47.6% of cap)

Projected to be $45-60M over the cap in 2027 before signing a single free agent.

## Key Analysis Frameworks

### 1. Chris Jones Decision Tree

Three options, all bad:
1. **Accept the $44.85M hit** → Prevents signing any other defensive FAs; roster depth collapses
2. **Extend Jones** (lower 2026-2027, add years to 2029) → Kicks the can, creates more dead money if he declines
3. **Trade/release post-June 1** → Clears $44.85M but creates $27M dead money; loses best defensive player

**My call:** Extend Jones this summer, restructure to ~$32M/year through 2029. Creates $12-15M relief but commits to him through age 36. It's a gamble that Jones ages like Aaron Donald, not Fletcher Cox.

### 2. McDuffie Trade: Cap Efficiency vs. Talent Sacrifice

Cleared $13.5M in 2026 + removed $16M 2027 obligation.

**But:** Replaced All-Pro corner (would've been $16M value contract vs. Gardner at $24M, Surtain at $24.1M) with Kader Kohou at $9M AAV (graded 42nd-best corner in 2025 per PFF).

The $7M savings doesn't offset the competitive gap. Trade enabled Walker ($14.35M) + Gilman ($8.25M) + 2027 draft capital. Makes sense IF Walker + Gilman + future picks > McDuffie. I'm skeptical.

### 3. The Hardest Cap Constraint

**The 2027 Mahomes megahit was intentionally unsustainable** — designed to force a renegotiation in 2026. But the strategy assumed the Chiefs would have cap flexibility to negotiate from strength.

They don't. They're backed into a corner and MUST extend Mahomes to avoid the cap explosion. That gives Mahomes' agent (Leigh Steinberg) all the leverage.

This isn't Mahomes being greedy — it's the structural reality of deferred cap management catching up.

## Core Recommendation

**Go all-in on 2026 — because 2027 won't allow it.**

If the roster is healthy and competitive entering the 2026 trade deadline (late October), Brett Veach should trade future draft capital (2027/2028 picks) to acquire a proven WR2 and starting-caliber CB. The Rams won Super Bowl LVI by trading multiple first-rounders for Stafford and Ramsey. KC should adopt the same mindset.

But if 2026 goes sideways (Mahomes struggles post-ACL, Rice suspended all year, defense can't stop anyone), flip the script at the deadline: trade Jones for a 2027 1st, trade Brown for a Day 2 pick, and accelerate the rebuild before 2027's cap crisis makes it unavoidable.

**The window is this year. The cap math doesn't lie.**

## Disagreements with Panel

**KC will argue:** The two first-round picks on rookie deals hedge against the 2027 cap crisis.

**My pushback:** Rookie contracts are cost-controlled, but they don't create cap *space* — they just prevent you from spending more. The Chiefs' 2027 problem isn't lack of cheap talent; it's $130M committed to two players before counting anyone else. Rookie deals don't solve that.

**Offense will argue:** If Rashee Rice is suspended, the Chiefs need to trade for a WR2 mid-season.

**My agreement with a constraint flag:** They have ~$15M available cap space after draft signings. That's enough for a rental (Darnell Mooney type at $10M AAV), but it eats the entire emergency fund. One significant injury to Mahomes, Kelce, or Walker, and the Chiefs have no financial flexibility.

## Reusable Patterns for Future Panel Work

### Pattern 1: Multi-Year Cap Trajectory Analysis

When analyzing "is this sustainable?" questions:
1. Map the current year cap space (real number from OTC)
2. Project Year 2 commitments (include restructure consequences, void year acceleration)
3. Identify the "cap cliff" — the year where the math breaks
4. Build the decision tree for each major contract
5. Quantify what "must happen" to avoid the cliff

Applied to KC: 2026 is workable ($28M space), 2027 is the cliff ($130M on two players), and five things must happen (Mahomes extension, Jones extension, Kelce retires, Brown cut, no Karlaftis/Smith extensions).

### Pattern 2: Trade Analysis — Cap Savings vs. Talent Cost

When evaluating high-value trades:
1. Calculate cap savings (immediate + future year obligation removal)
2. Identify the replacement player and their cost
3. Compare talent level (use PFF grades, Pro Bowl/All-Pro status, positional market value)
4. Determine what the cap savings enabled (specific signings/extensions)
5. Frame the trade as: "Savings enabled X, Y, Z. Does X + Y + Z > [player traded]?"

Applied to McDuffie: $13.5M 2026 savings + $16M 2027 savings enabled Walker + Gilman + draft capital. But McDuffie at $16M would've been a value contract vs. top CB market. The $7M net savings doesn't offset the talent gap.

### Pattern 3: Contract Decision Tree

When analyzing "what should they do with [expensive veteran]?" questions:
1. Map all available options (accept hit, extend, trade, release)
2. For each option, calculate: cap savings, dead money, roster impact, future cap consequences
3. Identify the "least bad" option (not the "good" option — sometimes there isn't one)
4. Flag the age/decline risk factor
5. Make a call with reasoning

Applied to Chris Jones: All three options are bad. Extend is least bad because it creates immediate cap relief and avoids losing your best defensive player. But it's a gamble on aging curve.

## Decision

No formal team decision required — this is a panel position statement for an article.

**Filed for knowledge propagation:** These three analytical patterns (multi-year trajectory, trade talent/cap tradeoff, contract decision tree) are reusable for any cap-focused article panel position.

---

*Decision filed by Cap — 2026-03-15*

---
created: 2026-03-XX
agent: Cap (Salary Cap Expert)
status: proposed
priority: medium
affects: TEN team agent, Lead, Writer (ten-ward-vs-saleh-draft-identity article)
---

# Decision: Post-June-1 Cuts Create Hidden Future-Year Cap Constraints

## Context

While writing the Cap position for the Titans draft identity article, I analyzed two paths:
- **Path A:** EDGE at #4 + post-June-1 Ridley cut ($16.45M 2026 savings, $5M 2027 dead money acceleration)
- **Path B:** WR at #4 + keep Ridley through 2026 (costs $16.45M more in 2026, but $0 dead money in 2027)

## The Decision Point

**Post-June-1 cuts are frequently presented as "cap relief" mechanisms** — and they are, for the current year. But they create a **future-year dead money acceleration** that constrains the exact window when franchise QBs need cap flexibility for extensions, 5th-year options, and supporting cast upgrades.

In Tennessee's case:
- Cutting Ridley post-June-1 saves $16.45M in 2026 but accelerates $5M into 2027
- Ward's 5th-year option decision arrives in 2027 (his Year 3)
- That $5M dead money hit reduces 2027 flexibility when TEN needs to decide: extend Ward early, add weapons around him, or let him play out Year 4

## The Principle

**When evaluating post-June-1 cuts for teams with franchise QBs in Years 2-4, always model the 2-year cap impact:**
1. Year 1 savings (the headline number)
2. Year 2 dead money acceleration (the hidden cost)
3. Whether Year 2 aligns with QB contract decision windows (5th-year option, early extension, etc.)

If the future-year dead money hits during a critical QB decision window, the "savings" aren't savings — they're borrowing from the QB's future to solve a current-year problem.

## Recommendation for Future Analysis

- Cap agent should flag post-June-1 cuts that accelerate dead money into QB contract decision years
- When discussing "cap relief," present both the Year 1 savings AND the Year 2 cost in a single table
- Introduce the concept of "net 2-year cap impact" as a metric for evaluating aging veteran cuts

## Status

Proposed. Affects how Cap discusses post-June-1 cuts in future articles, especially for teams with rookie-contract QBs.

---
type: "article-angle"
agent: "car"
issue: 67
status: "approved"
date: "2026-03-16"
---

# Decision: CAR 2026 Offseason Article Angle — Bryce Young 5th-Year Option Crossroads

## What
Selected "The $165 Million Bet on a Quarterback Nobody's Sure About" as the Panthers' first offseason article angle. The article frames the entire 2026 offseason through the lens of Bryce Young's 5th-year option decision (due May 2026), arguing that the $165M defensive investment (Phillips + Lloyd) only makes sense if Young is the franchise QB — and the 2025 tape is violently contradictory.

## Why This Angle Over Alternatives

| Considered Angle | Score | Why Not Lead? |
|-----------------|-------|---------------|
| **Bryce Young 5th-year option crossroads** | 12/12 | ✅ SELECTED — highest tension, most timely, reframes every other move |
| Phillips/Lloyd defensive transformation | 9/12 | Good but descriptive — "look what they bought" lacks tension |
| NFC South window opening | 8/12 | Interesting context but diffuse — no single decision point |
| Draft at #19 | 7/12 | Too early — draft board not set yet, better as pre-draft article |

## Affects
- **Cap agent** — will need to model 5th-year option financial decision tree
- **Offense agent** — will evaluate scheme-QB fit under Canales
- **Writer/Editor** — article targets 2,500-3,500 words at Depth Level 2

## Artifacts
- `content/articles/car-2026-offseason/idea.md`
- `content/articles/car-2026-offseason/discussion-prompt.md`
- `content/articles/car-2026-offseason/panel-composition.md`

---
agent: CHI
issue: 62
date: 2026-03-16
category: article-angle-selection
status: proposed
---

# Decision: Bears 2026 Offseason Article Angle — "Restraint in the Cheap-QB Window"

## Context

Issue #62 requested a Chicago Bears 2026 offseason article with **"IDEA GENERATION REQUIRED"**—meaning no pre-written angle, fresh research needed.

The Bears finished 2025 at 11-6 (NFC North champs, playoff win vs GB) but took an unusual path this offseason:
- Traded DJ Moore (WR1) to Buffalo for a 2nd-round pick, freed $16.5M cap
- Let all three starting safeties walk (Brisker, Gardner-Johnson, Byard)
- Explored but rejected a Maxx Crosby blockbuster (Raiders wanted 2 1sts + player)
- Signed mid-tier FAs instead (Coby Bryant, Devin Bush, Neville Gallimore)

Meanwhile, NFC North rivals went aggressive:
- DET: $35.9M cap space, Aidan Hutchinson returning from injury
- GB: Traded for Micah Parsons, hired Jonathan Gannon as DC
- MIN: Added Jonathan Allen + Javon Hargrave on defense

## Decision

**Selected Angle:**  
"The Bears Traded Their Best Receiver and Let Three Safeties Walk. That Might Be the Smartest Offseason in the NFL."

**Core Tension:**  
Caleb Williams is entering Year 3 on a rookie deal (~$1M cap hit)—the cheapest franchise-QB window in football. He has **two seasons (2026-2027) before a $55M+ AAV extension** locks in. Every contender in NFL history tries to maximize this window. The Bears are using it to *subtract* high-priced veterans and stockpile draft capital.

Is this **restraint or timidity?** Can they close the gap on DET/GB inside a short window by building through the draft, or does playing conservative in the NFL's toughest division guarantee they waste the cheapest franchise-QB years in football?

## Rationale

1. **Nationally relevant framing:** "Contender that subtracted" is counterintuitive and debate-worthy. The Khalil Mack parallel (2018 trade → 12-4 → 6-year drought) resonates beyond Bears fans.

2. **Williams' cheap-QB window is the ticking clock:** This isn't just "Bears offseason recap." It's a strategic referendum on how to maximize a generational QB on a rookie deal when the division is loaded.

3. **Maxx Crosby non-trade crystallizes the debate:** Poles confirmed he explored it and walked away. The ghost of the Mack era informs every decision—but the Mack lesson cuts both ways (the Bears went 12-4 in Mack's first year and nearly won a Super Bowl). Sometimes the "reckless" move IS the right one.

4. **Safety exodus is the biggest roster risk:** Dennis Allen's takeaway-heavy defense (33 in 2025, best since 1985) just lost all three starting safeties. Coby Bryant is solid but not a Pro Bowler. Can the scheme survive a full positional reset?

5. **NFC North arms race makes this urgent:** DET/GB/MIN are adding premium talent. The Bears are the only team playing conservative. Is this positioning for sustained success, or falling behind in a sprint?

## Alternatives Considered

- **"Caleb Williams Extension Timeline: How the Bears' 2027 Cap Cliff Changes Everything"** — Too cap-centric, loses the narrative tension. Better as a standalone piece later.
- **"Can Dennis Allen's Defense Survive Without Brisker, CJGJ, and Byard?"** — Too narrow. Secondary rebuild is a subplot, not the headline.
- **"The Maxx Crosby Trade That Never Happened: Why Ryan Poles Said No"** — Interesting but reactive. Crosby is a subplot in the larger "restraint vs. urgency" story.

## Impact on Article Production

- **Depth Level:** 2 — The Beat (2,000–3,500 words, balanced data + story)
- **Panel:** CHI (team expert), Cap (extension timeline), Defense (secondary rebuild), Draft (R1 safety vs. OT decision)
- **Publish Window:** ASAP — 2026 offseason, pre-draft
- **Audience:** Bears fans, NFC North watchers, NFL fans interested in "restraint vs. aggression" roster-building philosophy

## Next Steps

- ✅ Discussion Prompt created (`content/articles/chi-2026-offseason/discussion-prompt.md`)
- ✅ Idea scored 10/12 (SEA relevance: 2, Timeliness: 3, Reader value: 3, Uniqueness: 2)
- 🔄 **Stage 3 (Panel Composition)** — Finalize 3-4 agent panel and spawn instructions
- ⏳ Stage 4 (Panel Discussion) — Agents produce expert analysis
- ⏳ Stage 5 (Article Drafting) — Writer synthesizes into article

## Open Questions

1. Should we adjust depth level to **3 — Deep Dive** given the complexity? (Cap cliff modeling, secondary scheme fit, draft trade-up math, etc.)
2. Is the Khalil Mack parallel too heavy-handed, or is it the perfect framing device?
3. Do we need Analytics on the panel for takeaway regression modeling, or is Defense enough?

## Decision Owner

CHI (Chicago Bears Expert)

---

**For Lead/Ralph:** This decision captures the article angle selection process. If approved, archive to `.squad/decisions/archive/` and proceed to Panel Composition (Stage 3).

---
date: 2026-03-16
agent: CollegeScout
article: seahawks-rb-pick64-v2 (issue #71)
stage: panel-discussion
decision_type: panel-position-stance
status: filed
---

# Decision: Price at #64 Is Fair Value, Not a Steal — v2 Should Reframe

## Context

Panel discussion for "Seahawks RB Pick #64 Analysis (v2)." The v1 article positioned Jadarian Price at #64 as a late-first-round talent falling due to Achilles fear. CollegeScout re-tested this premise against current board data.

## CollegeScout Panel Position

**Recommendation:** Path 2 — Keep the Player, Move the Price. Price fits Seattle but is not the discount v1 claimed.

**Key Findings:**
- Price's consensus ADP has risen to #53-58 (PFF 58, StatRankings ~56) — UP from v1's ~67 claim
- The Achilles "discount" has eroded after 41 healthy games. If the injury doesn't scare teams, it also doesn't create a buying opportunity
- At #64, Seattle pays fair market price for a mid-R2 committee back — not a steal
- Quality RB alternatives (Coleman, Johnson) exist at #96 with similar zone-scheme fit
- The positional dropoff from #64 to #96 is steepest at EDGE/CB, shallowest at RB
- Recommended reframe: "paying fair value for a good fit" rather than "stealing a first-round talent"

## Strategic Implications

- v2 article should correct the v1's overstatement without abandoning the prospect
- Writer needs honest quotable lines, not promotional ones
- Likely friction with Offense (who will emphasize scheme fit as unique differentiator)
- Board reality supports EDGE/CB at #64 + Coleman/Johnson at #96 as the better value play

## Follow-Up Questions

1. Does SEA's need hierarchy make RB at #64 defensible even without the "discount" narrative?
2. Will Offense agree that Coleman/Johnson are viable zone-scheme alternatives, or hold the line on Price specifically?
3. If Price's ADP compresses above #64, does the article need a "trade-up" scenario or does the thesis break entirely?

---

**Filed for:** Lead review during synthesis phase (Stage 4)

### 2026-03-16T05:31:24Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** Use GPT-5.4 when Claude 4.6 is unavailable.
**Why:** User request — captured for team memory

### 2026-03-16T06:51:25Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** The Seahawks RB v2 item should be treated as an existing article rerun through the new pipeline, not a blank-slate rewrite; every article should end with a cliffhanger-style next-article tease; after publish, create a new GitHub idea issue for that teased article with a Thursday-of-week target for now.
**Why:** User request — captured for team memory

---
type: "article-angle"
agent: "dal"
issue: 58
status: "ready-for-panel"
created: "2026-03-16"
---

# Decision: DAL Issue #58 — Article Angle Selection

## What Was Decided

Selected **"Dallas Spent $166M on Offense and Allowed the Most Points in the NFL. Now Two First-Round Picks Have to Fix Everything."** as the article angle for the DAL 2026 offseason piece.

## Why This Angle

Considered several angles:
1. ~~Parsons trade retrospective~~ — too backward-looking; verdict depends on draft which hasn't happened
2. ~~George Pickens extension drama~~ — important subplot but not the defining question
3. ~~Christian Parker scheme install~~ — too narrow; doesn't capture the cap urgency
4. **Offense/defense spending imbalance + Parsons trade + 2027 cap bomb** ✅ — This ties together the three biggest Cowboys storylines into one cohesive tension: they built an elite offense, demolished the defense, and now have exactly ONE draft to fix it before the cap window closes. Every other angle is a subset of this one.

## Artifacts Created

- `content/articles/dal-2026-offseason/idea.md` — Stage 1 complete
- `content/articles/dal-2026-offseason/discussion-prompt.md` — Stage 2 complete
- GitHub issue #58 updated with angle comment

## Panel Recommendation

4-agent panel: DAL, Cap, Defense, Draft. Each has a specific brief in the discussion prompt. Ready for Lead to approve and spawn Stage 3/4.

## Impact

Commits pipeline forward from "needs-research" to "ready-for-panel" on the DAL article. No blocking dependencies — panel agents can be spawned immediately.

# Decision: BUF Defensive Panel — Milano Is the Scheme-Critical Retention

**By:** Defense (Defensive Scheme Expert)
**Date:** 2026-07-18
**Status:** Proposed
**Affects:** BUF team agent, Cap agent, Lead (synthesis)

## What

In the BUF 2026 offseason panel, Defense recommends **Path 4 (Youth Movement) with Milano retention as the non-negotiable modifier.** The core finding: of the four departing defenders (Bosa, Milano, Epenesa, White), only Milano's loss changes the *scheme identity* — Leonhard's 35% blitz rate requires a coverage LB who can execute pattern-match drops, and no Day 2 replacement can replicate that processing speed. Bosa, Epenesa, and White are replaceable through draft archetypes and mid-tier free agents because Leonhard's simulated-pressure packages generate rush through design, not individual talent.

## Why This Matters for Synthesis

- Cap agent should model Milano at 2-yr/$18M (age-30 discount) as a baseline assumption, not a luxury add.
- BUF agent should evaluate whether Terrel Bernard can grow into Milano's coverage role by 2027 — if yes, the 2-year bridge contract makes sense; if not, the timeline shifts.
- The recommended draft allocation (R1: CB, R2: EDGE, R3: IDL) follows directly from the scheme-damage ranking and should be consistent across panel positions.

## Constraint

The hardest defensive constraint is **not** the edge rush — it's the coverage LB position. The EDGE and CB2 spots have clear Day 2 draft archetypes. The ILB coverage role Milano fills barely exists outside the first round. If Milano walks, Leonhard must either reduce his blitz rate (weakening the entire defensive identity) or accept catastrophic coverage breakdowns against AFC East speed.

### 2026-03-16: Houston Interior DL — Dual-Role Draft Strategy
**By:** Defense (Defensive Scheme Expert)
**Status:** Proposed
**Priority:** Medium
**Affects:** HOU team agent, Draft agent, Cap agent, Lead

**What:**
Houston's 2026 DT crisis requires drafting for **two distinct scheme roles**, not just "best available DT":

1. **1-tech anchor** (295-315 lbs): Two-gap nose who absorbs doubles, keeps linebackers clean, allows light boxes. Fatukasi departure is structural crisis.
2. **Attacking 3-tech** (290-305 lbs): B-gap penetrator who collapses pockets, wins on stunts, generates interior pressure in low-blitz scheme.

**The constraint:** Cannot draft both roles in Round 1. Must prioritize.

**Recommendation:** Draft 1-tech anchor at pick 28 (Deone Walker if available, Alfred Collins if not), then target attacking 3-tech at pick 38/59 (Christen Miller, Peter Woods). Rationale: Anderson/Hunter can carry pass rush; they cannot carry run defense without a nose.

**Why:**
DeMeco Ryans' 4-3 under scheme *requires* a true 1-tech to function. Houston's No. 1 defense in 2025 succeeded because Fatukasi did unglamorous work that let the scheme stay structurally sound. Missing this role forces Houston to add safety to box → breaks preferred two-high shell → exposes Stingley/Lassiter on islands more often.

**Decision Point:**
When evaluating defensive needs, always map prospects to **specific scheme roles**, not just positional labels. "DT" is too broad — 1-tech and 3-tech are different positions with different production profiles and draft target pools. This applies league-wide, not just Houston.

**Follow-Up:**
Draft agent should build scheme-role-specific target boards for all teams with interior DL needs (not just generic "DT prospects"). Cap agent should model cost differential between drafting vs. FA patching for 1-tech anchors (rare and expensive in FA).

# Defense Panel Position — Detroit Lions EDGE at #17

**Date:** 2026-03-16  
**Agent:** Defense  
**Article:** Detroit Lions 2026 Offseason  
**Position Type:** Scheme Fit Analysis

---

## Core Position

Detroit should prioritize **EDGE at #17** over OT, with **Keldric Faulk (Auburn)** as the preferred target.

## Reasoning

### 1. Sheppard's Scheme Requirements

Detroit's aggressive 4-3 is front-driven, not coverage-reliant. The defense generates pressure through trench violence and four-man rush effectiveness, not exotic blitzes. This creates specific EDGE requirements:

- **Must set physical edges** — run defense is non-negotiable in this scheme
- **Must maintain gap integrity** — Sheppard doesn't mask front mistakes with secondary help
- **Must win 1-on-1 in pass rush** — the interior (McNeill) collapses escape lanes; EDGE must convert

### 2. Prospect Fit Analysis

| Prospect | Scheme Fit | Run Defense | Pass Rush | Frame | Verdict |
|----------|------------|-------------|-----------|-------|---------|
| Keldric Faulk (AUB) | ✅ Excellent | Elite | Developing | 6'6"/276, 34" arms | **Best fit** |
| Cashius Howell (TAMU) | ⚠️ Risky | Adequate | Elite | 6'2"/248, 30" arms | Scheme concern |
| Dani Dennis-Sutton (PSU) | ✅ Good | Strong | Solid | 6'5"/260, 33.5" arms | Day 2 target |

Faulk's power-first, edge-setting style matches Detroit's identity. Howell's speed/bend profile fits hybrid or odd-front schemes better than Sheppard's base-heavy approach.

### 3. Hutchinson + 1 Rookie Risk Assessment

- **If Faulk:** Workable. Scheme-ready Day 1 contributor opposite Hutchinson.
- **If Howell:** Higher risk. May struggle on early downs; creates schematic limitations.
- **If OT at #17:** MUST address EDGE via veteran FA or Round 2. Hassanein (UDFA) cannot carry the RDE role.

### 4. Branch/Joseph Uncertainty — Defensive Function Impact

Branch's Achilles (targeting midseason return) and Joseph's chronic knee create schematic constraints:

- Without Branch, Detroit loses coverage flexibility; man-heavy looks become predictable
- Without Joseph's range, underneath aggression must be tempered
- Both uncertain = the defense cannot mask pass-rush weakness through coverage

This elevates EDGE priority. The pass rush must be reliable if the secondary starts compromised.

## Verdict

**EDGE at #17 (Faulk) > OT + EDGE later.**

The margin for error is too thin. Detroit's window is still open, but the path through it runs directly through Hutchinson's ability to function without absorbing constant doubles. Faulk solves this. OT is addressable via FA or Round 2 OT prospects; starting-caliber EDGE opposite Hutchinson is not.

---

**Confidence:** High  
**Dependencies:** Faulk available at #17; no major FA EDGE signing before draft

---
date: 2026-03-16
agent: DEN
article: den-2026-offseason (issue #54)
stage: panel-discussion
decision_type: panel-position-stance
status: filed
---

# Decision: Advocating Kenyon Sadiq Over CJ Allen at Pick #30

## Context

Panel discussion for "The Missing Joker — Sean Payton's Tight End Problem" article. The core tension is whether Denver should draft the consensus ILB prospect (CJ Allen, Georgia) to address aging Alex Singleton (32), or draft the TE "freak" (Kenyon Sadiq, Oregon) to fill the Joker role that has been absent since Evan Engram's failed experiment (50/461/1 in 2025).

## DEN Panel Position

**Recommendation:** Draft Kenyon Sadiq at pick #30.

**Rationale:**
- ILB is the more urgent need (Singleton aging, thin depth), but TE is the more impactful position for championship ceiling
- Denver's 2025 season showed elite defense (#2 in AFC) but offensive limitations — 52% red zone TD rate (25th in NFL), 46% inside the 10-yard line
- AFCCG loss (10-7 vs NE) exposed the offense's ceiling when the middle of the field is unavailable
- Engram failed the scheme (14 drops on catchable balls, 61% catch rate, locker room indifference) — Payton dialed up Graham-style routes but execution was absent
- Bo Nix's development trajectory requires a red zone mismatch weapon, not another boundary WR
- Championship window is 2-3 years max while Nix is on $5M/year rookie deal — can't afford to wait

**Hardest Tradeoff:**
Accepting thin ILB depth in 2026, relying on 32-year-old Singleton to stay healthy and effective in coverage for one more year, and betting that a rookie TE can deliver immediately in Year 1.

## Strategic Implications

This decision reflects the **championship-aggressive** stance rather than the **roster-balanced** approach:
- Prioritizes offensive ceiling over defensive depth
- Accepts positional risk (ILB) to acquire transformational piece (TE)
- Aligns with Payton's offensive DNA (TE-centric system) even as playcalling transitions to Davis Webb
- Rejects the "safe" pick (Allen) in favor of the "swing for the fences" pick (Sadiq)

## Alignment Check

**Conflicts with:**
- Conservative roster-building philosophy ("run it back" with minimal FA spending)
- BPA-over-need draft strategy (Allen is more NFL-ready than Sadiq)
- Depth-chart urgency (ILB is thinner than TE)

**Aligns with:**
- Championship window urgency (Nix's rookie deal is 2 years max before extension)
- Payton's offensive system requirements (TE has historically been centerpiece)
- Offensive efficiency gaps from 2025 (red zone stagnation, middle-of-field absence)

## Follow-Up Questions

1. If Cap or Offense disagree strongly, does DEN hold the line or compromise toward Path 2 (Allen at #30, TE in R2)?
2. What's the fallback if Sadiq is off the board at #30 — trade up, or pivot to Allen?
3. Should DEN advocate for ILB in R2 as the "balance" move if Sadiq is taken in R1?

---

**Filed for:** Lead review during synthesis phase (Stage 4)

---
type: "article-angle"
agent: "DET"
issue: 63
status: "proposed"
created: "2026-03-16"
---

# Decision: DET Article Angle for Issue #63

## What
DET agent generated the article angle for issue #63 (Detroit Lions 2026 Offseason):

**Working Title:** "The Lions Have $200 Million in Elite Talent. They're One Pick Away From Wasting All of It."

**Angle:** Championship window framing — elite core locked up on megadeals, but 9-8 regression exposed structural gaps (EDGE, LT, coordinator turnover). Pick #17 (EDGE vs. OT) is the fulcrum that determines whether the window reopens or closes.

## Why This Angle
- EDGE need is consensus #1, but the "one pick from wasting $200M" framing is fresh and visceral
- Connects coordinator brain drain (3 OCs in 3 years), roster holes, and injuries into one strategic narrative
- Ben Johnson coaching rival CHI adds unique NFC North tension
- Scored 11/12 on idea-generation rubric

## Artifacts Created
- `content/articles/det-2026-offseason/idea.md`
- `content/articles/det-2026-offseason/discussion-prompt.md`

## Stage Progression
- Stage 1 (Idea Generation): ✅ Complete
- Stage 2 (Discussion Prompt): ✅ Complete
- Stage 3 (Panel Composition): Ready — suggested DET, Cap, Defense, Draft (4 agents)

## For Lead
Panel composition is drafted in the discussion prompt. Ready for Lead to finalize and spawn agents for Stage 4.

# Decision Record: HOU Panel Position — DT Talent Cliff Strategy

**Date:** 2026-03-16  
**By:** Draft (NFL Draft Expert)  
**Article:** HOU - Houston Texans — 2026 Offseason  
**Status:** Proposed  
**Affects:** HOU team agent, Cap, Defense, Writer  

---

## What

Houston's 2026 draft strategy must account for a **DT talent cliff after pick 30**. Peter Woods (Clemson) and Caleb Banks (Florida) are consensus top-2 DTs, both projected picks 15-25. Christen Miller (Georgia) is the next tier, but he's 10-15 picks below Woods/Banks in value. If both Woods and Banks are gone at pick 28, Houston faces:

1. **Reach for Miller at 28** — overdraft by ~10 picks, but secure a safe Day 1 starter
2. **Wait until 38** — draft BPA (Sonny Styles, LB) at 28, hope Miller lasts to 38
3. **Trade up from 28 to 20-25** — costs pick 59 or 69, guarantees Woods or Banks

**Recommendation:** If Houston's DT board is Woods > Banks > 15-pick gap > Miller, **trade up** is the value play. Giving up pick 59 to jump from 28 to 23 and secure Banks is cheaper than paying $18M/yr for a veteran DT in 2027 free agency.

---

## Why

- **Extension window compression:** Stroud and Anderson's extensions hit in 2027-2028. Every position Houston doesn't address in the 2026 draft becomes a cap crisis when the QB/EDGE extensions consume 35%+ of the cap.
- **DT is crisis-level:** Lost Settle and Fatukasi in FA, Rankins is 31 and on a 2-year deal. If Houston doesn't draft a starting DT in 2026, they'll be shopping the 2027 FA market at premium prices.
- **Prospect quality cliff:** Woods and Banks are first-round talents. Miller is a late-1st/early-2nd talent. The gap is real. Waiting from 28 to 38 risks settling for a lesser player.
- **Trade-up cost-benefit:** A trade from 28 to 23 costs ~200 points (JJ chart). That's approximately pick 59 (310 points). But a veteran DT in 2027 FA costs $15-20M/yr. Over 3 years, that's $45-60M vs. a rookie DT on a 4-year/$15M deal. The draft capital cost is negligible compared to the cap savings.

---

## Team-Level Implications

- **HOU:** Must decide if DT is worth a trade-up. If yes, targets are picks 20-25 (where Woods/Banks likely land). If no, must accept either a reach at 28 (Miller) or risk waiting until 38.
- **Cap:** Trade-up scenario means fewer Day 2 picks to fill depth. But it secures a cost-controlled DT starter for 4 years, which is critical when extensions hit.
- **Defense:** DeMeco Ryans' 4-3 scheme needs both a 1-tech (run-stuffer) and a 3-tech (pass-rusher). Woods can do both. Banks leans 1-tech. Miller is pure 1-tech. The scheme fit matters.
- **Writer:** The trade-up framing is a strong narrative angle — "Houston is so desperate for DT help that they're willing to mortgage Day 2 picks to secure a franchise interior lineman."

---

## Next Steps

1. **Writer:** Verify Houston's OT depth chart (Tunsil/Howard starter status) to assess how critical pick 59 is for OT depth.
2. **Cap:** Model the "cost of waiting" — what's the 2027 FA market for 1-tech vs. 3-tech DTs? Is $18M/yr the floor or ceiling?
3. **Defense:** Confirm Ryans' 1-tech vs. 3-tech usage rate. Does he play two 1-techs (Rankins + rookie) or does he need a 3-tech pass-rusher?
4. **HOU:** Decide if trade-up is on the table. If yes, identify trade partners (teams at picks 20-25 willing to move back).

---

## Validation

- ✅ Woods and Banks are consensus DT1 and DT2 (verified via PFF, CBS, Athlon Sports, BNB Football)
- ✅ Miller is consensus late-1st/early-2nd (verified via same sources)
- ✅ Houston's picks are 28, 38, 59, 69 (verified via NFL Mock Draft Database, ESPN, Sporting News)
- ✅ Stroud/Anderson extension timeline is 2027-2028 (verified via Pro Football Rumors, Red94, CBS Sports)
- ✅ Settle/Fatukasi departures and Rankins re-sign confirmed (verified via Click2Houston, Clutch Points)

---

**Recommendation:** Publish this decision to `.squad/decisions.md` after panel synthesis. This is a high-stakes strategic call that affects Houston's 2026-2029 roster construction.

### 2025-07-17: Draft Board Analysis — Detroit Lions EDGE vs. OT at #17
**By:** Draft (Draft Expert)
**Status:** Proposed
**Affects:** DET team agent, Lead, Writer

**What:**
1. **OT at #17, EDGE at #50 is the preferred sequencing.** The OT class thins faster than the EDGE class — Kadyn Proctor (Alabama) is likely the last first-round-caliber LT on the board, while EDGE has 6-8 Day 1-2 starters.
2. **Keldric Faulk is the safest EDGE at #17** but grading below Proctor as a prospect — taking Faulk over Proctor would be need-over-BPA.
3. **R2 #50 EDGE options are viable:** Dani Dennis-Sutton (PSU), Cashius Howell (TAMU) if he slides, Akheem Mesidor (Miami). Class depth supports waiting on EDGE.
4. **R2 #50 OT options are thinner:** Max Iheanachor (ASU, RT profile), Blake Miller (Clemson), Gennings Dunker (Iowa). None are Day 1 LT-ready.
5. **Trade-down from #17 is a viable wildcard** if Proctor is gone and Faulk doesn't feel like BPA — could move to #22-23 and pick up extra Day 2 capital.

**Why:** Structural analysis of 2026 draft class depth by position. OT scarcity at the top of the class makes it the premium R1 target. EDGE depth allows Detroit to find a quality starter in R2. The R1-R2 combo realistically addresses both needs only if OT goes first.

**Artifact:** `content/articles/det-2026-offseason/draft-position.md`

# Editor Decision — BUF offseason draft review

- **Article:** `content/articles/buf-2026-offseason/draft.md`
- **Decision:** 🔴 REJECT
- **Why:** The draft's central framing was overtaken by March 2026 reality. It still treats Buffalo as an $11M-over-the-cap team with Dawson Knox as an obvious cut, but Buffalo has already restructured Josh Allen, reworked Knox's deal, re-signed Connor McGovern, and added DJ Moore and Bradley Chubb.
- **Editorial implication:** This should be rewritten against the current post-move state rather than patched line by line.

# Decision: Editor Review of DEN 2026 Offseason Draft

**Agent:** Editor  
**Date:** 2026-03-17  
**Article:** den-2026-offseason  
**Stage:** 6 — Editor Pass  

## Decision

**✅ APPROVED** — The draft is factually accurate, internally consistent, and publish-ready.

## Rationale

Performed full fact-check against all three panel positions (DEN, Cap, Offense), the discussion prompt, and the idea file. Cross-referenced Jimmy Graham's stats and Combine numbers against Pro Football Reference and official Combine records. Found zero factual errors. Issued five polish-level suggestions (name the AFCCG opponent, clarify Engram cut-scenario table, expand recovery timeline argument, verify Graham height source, specify Nix injury game). None are blockers.

## What this means for the pipeline

The draft can advance to Stage 7 (Publisher Pass) after the Writer optionally addresses the 🟡 suggestions. No re-review needed unless structural changes are made.

# Decision: Editor Review of HOU 2026 Offseason Draft

**Agent:** Editor
**Date:** 2026-03-17
**Article:** `content/articles/hou-2026-offseason/draft.md`

## Decision

Issued a **🟡 REVISE** verdict on the Houston 2026 offseason article.

## Rationale

The article is well-written and structurally sound, but contains one factual error that would undermine credibility with knowledgeable readers:

1. **Sonny Styles at pick 28 is unrealistic.** Styles is a consensus top-5 to top-10 prospect (PFF, NFL.com, ESPN, The Athletic all project him no later than 10th overall). Listing him as a tempting option at 28 repeats an error from the Draft position paper and would be immediately flagged by any reader tracking the 2026 draft.

The Writer also made a smart but incomplete editorial choice: avoiding all DT prospect names to sidestep contradictions between the Draft and Defense position papers (Peter Woods projected top-20 by Draft but listed as a Day 3 pick by Defense; Christen Miller listed as Georgia by Draft but USC by Defense). This kept the article from repeating source-paper errors but left a noticeable gap for Depth Level 2 readers who expect prospect names.

## What Happens Next

Writer fixes E1 (Styles) and addresses the four 🟡 suggestions. Editor re-reviews for ✅ APPROVED.

# Decision: JAX 2026 Offseason Draft — Editor Review Verdict

**Agent:** Editor
**Date:** 2026-03-17
**Article:** `content/articles/jax-2026-offseason/draft.md`

## Decision

**Verdict: 🟡 REVISE** — The draft has strong writing and structure but contains six factual errors that must be corrected before publish.

## Key Issues

1. **Cap deficit figure** ($15.9M in draft vs. $8.3M in Cap source) — appears 4× in the article
2. **Hunter's 2026 cap hit** ($10.6M in draft vs. $7.8M in Cap source)
3. **Trade structure** (draft says #5→#2 with picks #36/#126; Cap source says JAX received #5 from CLE, giving #41/#104/2026 1st/2027 3rd)
4. **Restructured players** (draft names Meyers/Hainsey/Mekari/Murray/Lewis; Cap source proposes Kirk/Robinson/Oluokun)
5. **Missing Defense panelist** (4-agent panel, no Defense output or section in draft)
6. **No OTC/Spotrac citations** (Gate 3 failure)

## What's Working

Writing quality, narrative arc, TLDR, headline, panel disagreement framing, BTJ analysis, and temporal accuracy are all strong. The errors are numerical/factual corrections, not structural rewrites.

## Next Step

Writer corrects all 🔴 errors → Editor re-reviews.

# Editor Decision — LV Crosby Review

- **Article:** `content\articles\lv-2026-offseason\draft.md`
- **Verdict:** 🟡 REVISE
- **Why:** The central argument is strong and timely, but the cap section materially overstates the Raiders' 2026 squeeze by using Kwity Paye's AAV as cap hit, subtracting gross rookie holds instead of effective Top-51 rookie impact, and relying on a stale draft-pick count.
- **Meaningful editorial call:** Preserve the thesis, but require a full cap-table rewrite before publish. This is not a tone problem; it is a credibility problem in the article's most data-sensitive section.

# Decision: Panel Composition Workflow for Article Stage 3

**Decision made by:** HOU (Houston Texans Expert)  
**Date:** 2026-03-16  
**Context:** Issue #50 — HOU 2026 Offseason article advanced from Stage 2 (Discussion Prompt) to Stage 3 (Panel Composition)  

---

## Decision

For articles at Stage 3 (Panel Composition), team agents should:

1. **Create article folder** using `{team-abbr}-{topic}` naming pattern (e.g., `hou-2026-offseason`)
2. **Create `panel-composition.md` artifact** inside the article folder documenting:
   - Central question from Discussion Prompt
   - Final panel (2-5 agents per depth level constraints)
   - Each agent's role and specific question
   - Composition rationale (why these agents, what perspectives they cover)
   - Expected disagreements between panelists
   - Compliance with composition rules (team agent + specialist, size limits, distinct angles)
3. **Post Stage 3 completion comment** to GitHub issue with panel summary
4. **Update issue body** to mark Stage 3 complete and Stage 4 in progress

---

## Rationale

**Why this structure:**
- Panel composition artifact serves as the single source of truth for Stage 4 (Panel Discussion)
- Documents the strategic choices behind agent selection (prevents "why wasn't X included?" questions later)
- Captures expected disagreements upfront — identifies the productive tensions that will drive the article
- Ensures compliance with depth level constraints (Level 1 = 2 agents, Level 2 = 3-4, Level 3 = 4-5)

**Why separate artifact file:**
- Discussion Prompt (Stage 2) lives in GitHub issue comments — it's conversational
- Panel Composition (Stage 3) is operational — it's the spawn instructions for Stage 4
- Keeping it in `content/articles/{slug}/panel-composition.md` makes it discoverable next to the draft

**Benefits observed in Issue #50:**
- Clear handoff from HOU (team expert) to Lead (who orchestrates Stage 4)
- Easy to verify compliance with composition rules (checklist at bottom of artifact)
- Transparent rationale for why Offense specialist was excluded (defense + cap focus)

---

## Applicability

**When to use:**
- All articles at Stage 3 (Panel Composition)
- Applies to all depth levels (1, 2, 3) — just adjust panel size constraints

**Who should execute:**
- Lead typically owns Stage 3 (per article-lifecycle skill)
- Team agents can execute if assigned directly to the article (as in Issue #50)

**Exception cases:**
- Depth Level 1 (Casual Fan) articles may skip formal panel composition artifact if only 2 agents are needed — can document directly in issue comment

---

## References

- `.squad/skills/article-lifecycle/SKILL.md` — Stage 3 composition rules, panel size limits
- Issue #50 — First execution of this workflow pattern
- Artifact created: `content/articles/hou-2026-offseason/panel-composition.md`

---

## Follow-up Actions

- [ ] **Writer/Editor:** Consider adding this pattern to `.squad/skills/article-lifecycle/SKILL.md` Stage 3 section as an example
- [ ] **Lead:** Use this pattern for future Stage 3 compositions
- [ ] **Ralph:** If monitoring article lifecycle, check for presence of `panel-composition.md` artifact before advancing to Stage 4

# Decision — HOU Panel Position: Draft-Heavy Interior DL Strategy

**Decision maker:** HOU (Houston Texans Expert)  
**Date:** 2026-03-16  
**Context:** Issue #50 — Houston's $100 Million Countdown panel discussion  
**Status:** Position stated, awaiting panel synthesis

---

## The Decision

**Advocate for aggressive interior DL investment via draft (picks 28 or 38) despite positional value concerns.**

Interior defensive line is ranked as the #1 critical need — ahead of linebacker, OT depth, and RB — even though late 1st/early 2nd round picks historically underperform at DT compared to EDGE/WR/CB.

---

## The Rationale

### Why DT is the top priority:

1. **Roster crisis:** Lost 3 interior DL (Settle to WAS, Fatukasi UFA, Hinish UFA) with only 31-year-old Rankins and rotational Togiai/Hamilton remaining
2. **Scheme dependency:** DeMeco Ryans' 4-3 defense requires two-gap DTs to free up Hunter/Anderson on the edges — scheme doesn't work without credible interior run-stoppers
3. **Extension window math:** Rookie DT at pick 38 costs ~$2.2M/yr vs. $12-18M/yr FA DT in 2027 when Stroud/Anderson extensions hit — a $10-16M annual savings
4. **JAX competitive urgency:** Trevor Lawrence and JAX's run game won the division at 13-4. Can't afford to give up 4.5+ YPC up the middle in division games.

### The tradeoff:

**Value vs. need tension.** DT is not a premium position at picks 28-38 historically. Edge rushers, cornerbacks, and wide receivers have higher hit rates in this range. We may be "reaching" for scheme fit rather than taking best player available.

**Alternative path:** Draft LB at 28 (higher positional value), address DT in Round 3-4 or via veteran FA bridge signing, then invest in elite DT in 2027 draft when we have better pick position. This delays the DT solution but maximizes draft value.

### Why I'm advocating for DT anyway:

- **2027 is too late.** Stroud/Anderson extensions likely signed by then. No cap room for FA DT at market rate.
- **Scheme fit > generic value.** A 290-lb two-gap DT who fits Ryans' scheme at pick 38 is more valuable to Houston than a 4.4-speed off-ball LB who doesn't.
- **Division window is NOW.** JAX is at their peak. We can't wait until 2028 to compete for the division.

---

## Implications for Other Panelists

- **Cap:** Will likely model the cost savings of rookie DT vs. FA DT and validate the $10-16M annual delta
- **Draft:** Will evaluate specific DT prospects at 28/38 (Christen Miller, LT Overton, Peter Woods) and assess reach vs. value
- **Defense:** Will confirm scheme fit requirements and whether available DTs at 28-69 can actually play Ryans' two-gap technique

---

## Open Question for Lead

If Draft and Defense both say "the available DTs at 28-38 are scheme mismatches or reaches," do we pivot to:
- **Option A:** Trade back from 28 to acquire more Day 2 capital and take DT at 45-55 range?
- **Option B:** Draft LB at 28, take best available DT at 59-69, and sign a veteran bridge FA (Dalvin Tomlinson type, 1yr/$8M)?
- **Option C:** Stand firm on DT at 28 because need > value in extension window?

I lean Option C (draft DT at 28 anyway) but willing to defer to Draft + Defense consensus if they identify a true scheme fit.

---

## Status

✅ Position stated in `hou-position.md`  
⏳ Awaiting Cap/Draft/Defense panel positions  
⏳ Lead will synthesize and recommend final path

---
date: 2026-03-16
author: IND
status: filed
article: ind-sauce-gardner-gamble
---

# Decision: IND Panel Position on Gardner Trade Consequences

## Context
Panel discussion for article "The Colts Bet Two First-Round Picks on a 7-2 Start. They Finished 8-9. Now What?" Required IND to provide roster audit, competitive trajectory analysis, and realistic 2026 ceiling assessment.

## Decision
Took the position that the **Gardner trade created a cap-rich/talent-poor paradox** that cap space alone cannot solve. Core arguments:

1. **Realistic ceiling: 7-10 wins** (likely 7-10, best case 8-9, floor 5-12)
2. **Two unfixable problems:** QB fragility (Jones injury history) and LB talent deficit (Franklin/Pratt replaced by Carlies/Ajiake/Bullock)
3. **Cap space limitations:** $51M can fix WR2, LB depth, Edge rotation — but NOT QB reliability or true #1 WR (already spent $28.5M AAV on Pierce)
4. **Division finish:** 4th place behind HOU (11-6), TEN (9-8), JAX (8-9)
5. **Recommended path:** Accept bridge year, sign mid-tier FAs, must-hit R2 #47 at LB, hope for 8-9 wins to keep coaching staff employed

## Hardest Tradeoff
**Accepting 8-9 wins as success vs. triggering front-office reckoning.** If the Colts finish 7-10 or worse, Chris Ballard (GM since 2017) enters Year 11 on the hot seat. The Gardner trade's opportunity cost (two years without R1 picks) makes short-term mediocrity painful but potentially unavoidable.

## Key Analytical Insights
- **Position group grades:** CB (A+), RB (A), OL (B), TE (B+), S (B), EDGE (B-), DT (B), WR (C+), QB (C-), **LB (D+)**
- **Anthony Richardson trade return:** 5th-round pick (Vikings/Packers) — market has spoken
- **Division landscape shift:** TEN's coaching overhaul (Saleh/Daboll/Bradley) makes them the biggest wildcard; HOU remains dominant; JAX owns the head-to-head (2-0 in 2025)

## Implications
- This position establishes the "ground truth" for the article — other panelists (Cap, Defense) may argue investment thesis or scheme, but IND owns the roster reality
- If this analysis holds, the article's narrative becomes "Gardner trade = franchise limbo" not "Gardner trade = salvageable mistake"
- Sets expectation that 2026 is a lost year competitively, which may influence editorial tone (cautionary tale vs. path-forward optimism)

## Follow-up
- After article publishes, track if actual 2026 season results validate or contradict the 7-10 win projection
- Monitor if Ballard/Steichen survive a sub-.500 season (historical data: how many GMs survive Year 11 with back-to-back losing seasons?)

# Decision: Detroit Lions Safety Injury Risk Assessment

**Agent:** Injury
**Date:** 2026-03-15
**Context:** Brian Branch (Achilles) and Kerby Joseph (knee) both recovering from season-ending injuries

## Decision

Detroit should treat safety depth as **MODERATE urgency** in offseason planning.

## Rationale

1. **Achilles recovery (Branch):** 10-14 month window puts Week 1 return at 50-60% probability at best. Even if active, expect 60-70% snap counts and reduced burst early in season.

2. **Knee recovery (Joseph):** Higher Week 1 probability (~60-75%) if ACL, but still uncertain. 25% re-injury risk applies to ACL returns.

3. **Compounded risk:** Two uncertain timelines at the same position creates dangerous variance. Even if each has 60% Week 1 odds individually, both being fully healthy is closer to 35-40%.

4. **Positional demands:** Safety requires explosive backpedaling and lateral agility — precisely the movements most compromised by both Achilles and knee injuries.

## Recommendation

- Add one veteran safety capable of starting-level play via free agency or trade
- Consider Day 2-3 safety in draft as insurance
- Do NOT assume both starters will be ready Week 1

## Confidence

🟡 MODERATE — based on public injury timelines, not private medical access

### 2026-03-16: Injury panel position — Seahawks RB Pick #64 v2
**By:** Injury (Injury Analysis Expert)
**Status:** Proposed
**Affects:** SEA team agent, CollegeScout, Offense, Writer, Lead
**Issue:** #71

**What:**
1. **Charbonnet Week 1 probability is ~35-45%** — late-season ACL (IR Jan 23) puts surgery-to-Week 1 at ~7.5-8 months, short of the 10-12 month RB-typical return window. Even if active, expect diminished burst through October.
2. **Price's Achilles is no longer an elevated risk** — 4 years post-surgery, 41 games, zero recurrence. Risk tier remains 🟡 MODERATE. The draft discount is shrinking as teams complete their own physicals — may be only 5-15 picks by draft day vs. 15-30 estimated in v1.
3. **Robinson >> Mostert for the veteran bridge** — Robinson (26, 🟢 LOW risk, 43/48 starts over 3 years) is the clear medical choice. Mostert (34, 🟠-🔴 risk, ACL history + multiple knee procedures) stacks injury risk on top of injury risk.
4. **Composite medical urgency for RB: 🟠 MODERATE-HIGH** — not a crisis, but a coin-flip Week 1 for your RB1 plus insufficient backup depth demands meaningful action (draft pick, veteran, or both).

**Why:** The entire v1 article thesis rests on two medical interpretations (Charbonnet urgency + Price discount). v2 must refresh both. The Charbonnet timeline is tighter than v1 implied; the Price discount is smaller than v1 assumed. Both adjustments sharpen the recommendation without changing it.

**Key disagreement flags:**
- SEA may deprioritize RB given CB/EDGE losses — Injury pushes back on underweighting a coin-flip RB1 timeline
- CollegeScout may say Price won't be available at #64 if discount compresses — Injury agrees this is plausible
- Offense may say Wilson/Holani can bridge — Injury says the insurance math doesn't support it for a defending champion

# Decision: JAX Panel Position — Hunter Workload Framework

**Agent:** JAX (Jacksonville Jaguars Expert)
**Date:** 2026-03-16
**Issue:** #52 — JAX 2026 Offseason Article
**Stage:** 4 (Panel Discussion)

---

## Decision Made

Recommended a **55/25 offense-heavy snap split** for Travis Hunter in Year 2, grounded in Year 1 workload data and injury causation analysis.

---

## Context

Panel question: "How should JAX deploy Hunter in Year 2 given his LCL recovery, the 13-4 baseline, and the roster holes? What's the realistic snap split?"

**Year 1 reality:**
- Hunter played 67% offensive snaps + 36% defensive snaps = **103% combined snap rate**
- LCL injury after 7 games ended his season
- Graded 82 PFF at WR, 71 PFF at CB — better at offense

---

## Rationale

1. **Workload sustainability:** 103% snap rate broke him. 80% total (55% offense + 25% defense) is sustainable.

2. **Skill allocation:** Hunter is currently a better WR than CB. Lean into strength while CB technique develops.

3. **Scheme fit:** Udinski's 3WR offense unlocks when Hunter plays WR2 opposite BTJ — creates single coverage opportunities.

4. **BTJ analysis:** Target share data shows Hunter reduced BTJ's targets by only 0.7/game. Slump is coverage adjustment, not cannibalization. Hunter helps BTJ by forcing defenses to respect both perimeters.

5. **Roster hole compensation:** Missing 2026 1st-round pick (#19) hurts, but Hunter's dual value compensates if he stays healthy. Round 2/3 picks (Benson at RB, Jacobs at LB) + bargain CB2 FA can fill gaps.

---

## Hardest Tradeoff Identified

**Hunter's workload ceiling vs. JAX's contention timeline.**

The two-way experiment only works if Hunter is available for 17 games. But keeping him healthy means accepting he'll never be a full-time All-Pro at either position — always part-time on both sides. The bet: "part-time elite at two positions" > "full-time elite at one position." The LCL injury proves the margin for error is razor-thin.

---

## Reusable Pattern

**Two-way player workload framework:**
1. Identify total sustainable snap % (typically 75–80% for injury prevention)
2. Grade player's current skill level at each position
3. Allocate snaps toward higher-graded position (offense-heavy or defense-heavy)
4. Monitor in-season snap creep — pull back if exceeding sustainable threshold
5. Role identity clarity: pick "WR who plays CB in sub-packages" vs. "CB who plays WR" — don't try to be 50/50

This framework applies to any future two-way player analysis (though Hunter is currently the only NFL example).

---

## Implications

- **For Writer:** The 55/25 split provides a concrete deployment plan to build article narrative around
- **For Defense panel:** They'll want more Hunter snaps on defense — this creates natural panel tension
- **For Offense panel:** They'll argue Hunter should play even more offense — also creates tension
- **For Cap panel:** They'll evaluate whether the trade cost (4 picks including 2026 1st) was worth a part-time player

---

## Files Created

- `content/articles/jax-2026-offseason/jax-position.md` — full panel position (10.5 KB)
- Discussion prompt and panel composition already existed (created by Lead agent in earlier stage)

---

## Next Steps

- Wait for Cap, Defense, and Offense panel positions
- Writer synthesizes all four positions into article draft
- Editor fact-checks and polishes

---

## Tags

`#panel-position` `#workload-management` `#two-way-player` `#hunter` `#jax` `#issue-52`

---
agent: KC
context: Panel position for "Mahomes Is Racing Back — But to What?" article
date: 2026-03-17
status: filed
---

# Decision: Three Coin Flips Framework for Roster Evaluation

## What I Decided

When evaluating roster construction with multiple interdependent variables, frame the analysis as "coin flips" — binary outcomes where the entire projection hinges on all flips landing favorably.

For KC's 2026 roster:
1. **Mahomes Week 1 at 90% mobility** (post-ACL recovery on schedule)
2. **Rashee Rice suspension ≤6 games** (not 10-12 game ban)
3. **Both first-round picks hit immediately** (WR at #9, CB at #29 start Week 1)

**If all three hit:** AFC Championship ceiling (11-6, wild card → divisional → AFCCG path)
**If one flips wrong:** Wild card exit (10-7)
**If two flip wrong:** No playoffs (9-8)

## Why This Matters

Traditional roster grading uses linear projections ("better at RB, worse at CB, net neutral"). But that obscures **cascading dependencies** where one failure triggers multiple position failures.

Examples from KC's 2026 roster:
- If Rice suspended 10+ games AND rookie WR doesn't start → bottom-5 receiving corps → Mahomes can't operate Reid's scheme → OL pressures increase → post-ACL knee at risk
- If CB pick doesn't start AND Mahomes mobility limited → defense gets exposed → offense must score 30+ per game → unsustainable

The coin flip framework forces you to:
1. Identify the 2-4 genuinely binary outcomes (not gradients)
2. Map the cascading consequences of each flip landing wrong
3. Give honest probabilities to each scenario
4. Avoid "most likely case" bias (averaging away the realistic extremes)

## When to Use This Again

- Any roster with a recovering star player + multiple draft-dependent positions
- Offseasons where cap constraints force "draft or bust" at 2+ positions
- Teams betting on aging veterans having "one more year" at multiple positions simultaneously

## When NOT to Use This

- Stable rosters with few question marks (nothing is truly binary)
- Articles where the uncertainty IS the story (don't resolve it with probabilities)
- Fan-facing content (Level 1) — coin flips are analyst framing, not casual fan framing

---
date: 2026-03-16
agent: LAC
context: issue-56-stage-advancement
status: implemented
---

# Decision: Combining Stages 2 and 3 for Straightforward Panels

## Context

Working on issue #56 (LAC 2026 offseason article), I needed to advance from Stage 1 (idea) to Stage 4 (panel discussion).

## Decision

Combined Stages 2 (Discussion Prompt) and 3 (Panel Composition) into a single work session when the panel composition is straightforward.

**Criteria for combining:**
- Panel is 3-4 agents (within Depth Level 2 limits)
- Panel includes 1 team agent + 2 specialists (standard pattern)
- No need for panel composition debate or alternative options
- Per-agent focus lanes are clearly differentiated in the discussion prompt

**Result:**
- Created `discussion-prompt.md` with finalized panel already documented in the Panel Instructions section
- Updated GitHub issue with both Stage 2 completion AND Stage 3 finalized panel in same comment
- Advanced directly to `stage:panel-ready` label (skipped intermediate `stage:discussion-prompt` label)

## Rationale

1. **Efficiency:** For standard team+specialists panels, composition is determined by the article subject matter. No need for a separate decision step.
2. **Workflow coherence:** The discussion prompt already specifies per-agent questions. Finalizing the panel while writing those questions is natural.
3. **Consistent with skill:** The article-discussion skill shows the panel table as part of the discussion prompt template, not a separate artifact.

## When NOT to combine

- Panel size is 5 agents (Deep Dive) — needs justification for each agent
- Unusual panel (e.g., 4 team agents for a trade article) — needs explicit rationale
- Panel composition is contested or unclear — needs Lead review before locking in

## Related

- `.squad/skills/article-discussion/SKILL.md` — shows panel table as part of discussion prompt
- `.squad/skills/article-lifecycle/SKILL.md` — defines Stages 2-3 as distinct but sequential

## Implementation

Used on issue #56. Worked cleanly. Recommend this as standard pattern for Beat-level (Depth 2) team articles.

# 2026-03-17: NFC West publish wave routing

## Decision

Use the fastest parallel lane for the NFC West batch:

- **ARI** goes straight to **Editor** on `content/articles/ari-2026-offseason/draft.md`
- **LAR** goes to **Writer** to turn the completed panel package into `content/articles/lar-2026-offseason/draft.md`
- **SF** goes to **Writer** to turn the completed panel package into `content/articles/sf-2026-offseason/draft.md`
- **SEA** stays on **panel execution** for `content/articles/seahawks-rb-pick64-v2/` before Writer starts

## Why

This ordering maximizes same-night throughput because it keeps all four teams moving without waiting on a single bottleneck. ARI is the only NFC West article with a real draft file already on disk, but it is not publishable yet because there is no Editor verdict and writer notes remain in the draft. LAR and SF are both one full stage behind ARI but have complete panel artifacts, so Writer can work them immediately. SEA is one stage earlier and should not skip the panel step.

## Publishing implication

No NFC West article is currently eligible for Stage 7 publish to `nfllab.substack.com`. When an article clears Editor, publish to a **Substack draft with tags only** — **no sections**.

### 2026-03-17: Ralph board reconciliation rule
**By:** Lead
**Status:** Proposed
**Affects:** Ralph, Lead, Writer, Editor

**What:**
- During Ralph board sweeps, treat local article artifacts under `content/articles/` and any editor/publish evidence as the source of truth over stale issue comments or `stage:*` labels.
- Do **not** close an article issue unless publish evidence exists (for example: published pipeline state, Substack URL, or equivalent local publish proof). A completed draft or even an approved editor review is not enough by itself.
- If the current label set cannot represent the true late-stage state, remove obviously stale stage labels and leave a reconciliation comment that names the exact local artifacts and the next concrete step.

**Why:**
The board is lagging behind the filesystem. Several article issues still read as panel-stage work even though local folders already contain drafts and editor reviews. Using repo artifacts as ground truth prevents duplicate work while keeping closure conservative and accurate.

### 2026-03-16: Article Versioning — Witherspoon v2 Published + RB v2 Tracked
**By:** Lead (Lead Orchestrator)
**Status:** Executed
**Affects:** Writer, Editor, SEA team agent, article pipeline

**What:**
1. **Witherspoon v2** published to Substack as a new draft (Draft ID: 191097519). The original v1 (`content/articles/witherspoon-extension-cap-vs-agent.md`, Draft ID 191061865) is preserved. v2 lives at `content/articles/witherspoon-extension-v2/draft.md` with updated panel positions and refined analysis.
2. **Seahawks RB Pick #64 v2** — GitHub issue #71 created to track regeneration of Article #1. The original (`content/articles/seahawks-rb1a-target-board.md`) was published 2026-03-14 without Editor review. v2 will re-run the panel with current data, apply Editor review, and publish as a separate Substack draft.

**Why:**
- Witherspoon v2 incorporates McDuffie comp, tighter synthesis, and current article conventions (TLDR block, no inline byline, tags).
- RB article is the only published piece that never went through Editor — quality gate compliance requires a v2.
- Versioning preserves originals (readers who bookmarked v1 links are unaffected) while allowing iterative improvement.

**Convention established:** Article regenerations get a `-v2` directory suffix and a GitHub issue with "v2 Regeneration" in the title. Original files are never overwritten.

# Decision: Issue #68 Panel Composition — Excluding Defense from Saints Bridge Year Article

**Date:** 2026-03-16  
**Agent:** NO (New Orleans Saints Expert)  
**Issue:** #68 — "Bridge Year or Burial? The Saints' $114M Dead Money Gamble on Tyler Shough"  
**Decision Type:** Panel composition (team-relevant)

## Context

Issue #68 is a Saints 2026 offseason article examining whether the team is building toward 2027 contention or just surviving 2026 under $114M dead money. The discussion prompt suggested a 3-4 agent panel: NO + Cap + Offense, with Draft as optional 4th.

The Saints have clear defensive needs (CB2 after losing Alontae Taylor, EDGE after Cameron Jordan's likely exit), and "Roster construction" articles typically include Defense according to the Panel Selection Matrix in `.squad/skills/article-lifecycle/SKILL.md`.

## Decision

**Exclude Defense from the core panel.** Panel composition: NO + Cap + Offense (3 core agents), with Draft as optional 4th.

## Rationale

1. **Defensive gaps are symptoms, not the core tension.** The article's central question is "Is the front office building a 2027 contender or just surviving 2026?" The CB2 and EDGE holes exist **because of the $114M dead money constraint**, not because of scheme failures or talent evaluation mistakes. Defense would tell us "CB2 is a hole" — which we already know from NO's depth chart analysis.

2. **Defense doesn't add a distinct angle.** The three critical questions for this article are:
   - Can the Saints build around Shough while cap-strapped? (Cap's angle)
   - What's the realistic ceiling for this roster in 2026? (NO's angle)
   - Does Kellen Moore's offense need a WR at #8, or can it win with current weapons? (Offense's angle)
   
   Defense doesn't answer any of these questions in a way that NO (depth chart gaps) or Draft (positional evaluation at #8) can't already cover.

3. **Depth Level 2 = 3-4 agents max.** Adding Defense would push us to 4 core agents, crowding out the optional Draft spot. Draft is more valuable than Defense for this article because the #8 pick decision (WR vs. CB vs. EDGE) is a key 2026 move that determines whether the bridge year succeeds.

4. **If defensive analysis is needed, NO can provide it.** NO owns the Saints' depth chart, knows the CB2 and EDGE gaps, and can evaluate whether the #8 pick should address defense. Defense's specialized expertise (scheme fit, coverage concepts, pass rush technique) isn't required for a bridge year roster construction article.

## Implications for Future Articles

This decision establishes a principle: **Don't add an agent just because the topic touches their domain. Add an agent when they bring a distinct angle that can't be covered by the existing panel.**

For Saints defensive-focused articles (e.g., "Can the Saints' 3-4 scheme survive without Demario Davis?"), Defense would absolutely be on the panel. But for this bridge year article, Defense is redundant.

## Validation

Panel composition follows established patterns:
- ✅ 3 core agents (NO + Cap + Offense) within Depth Level 2 limits (min 3, max 4)
- ✅ Team agent included (NO)
- ✅ At least one specialist (Cap + Offense)
- ✅ Each agent has a distinct question
- ✅ Coverage check confirms all article components are addressed

---

**Status:** Panel composition complete. Issue #68 advanced to `stage:panel-ready`.  
**Next step:** Lead spawns 3-agent panel for Stage 4 discussion.

---
type: "article-angle"
agent: "nyg"
issue: 59
article_id: "nyg-2026-offseason"
status: "approved-by-agent"
created: "2026-03-15"
---

# Decision: NYG 2026 Offseason Article Angle — Issue #59

## Decision
Selected **"Ravens South or Dart's Team?"** as the article angle for the Giants 2026 offseason piece. The #5 pick (Sonny Styles vs. Carnell Tate) serves as the fulcrum for a broader franchise identity question: does Harbaugh build his proven defense-first Baltimore model, or adapt to maximize Jaxson Dart's cheap rookie contract window?

## Why This Angle Over Alternatives

**Considered and rejected:**
1. *"Dart Year 2 breakout profile"* — Too narrow. Doesn't capture the organizational tension. Every beat reporter will write this.
2. *"The Ravens Pipeline: How Harbaugh is remaking the Giants"* — Good background piece but lacks a decision point. It's descriptive, not analytical.
3. *"NFC East arms race: Can the Giants keep up?"* — Interesting framing but the Giants' answer IS the #5 pick, which circles back to our chosen angle anyway.
4. *"Cap crunch → cap explosion: The Giants' two-year plan"* — Too financial for a team expert article. Better as a Cap sidebar.

**Why this wins:** It combines the best elements of all four — Dart's development, Harbaugh's philosophy, the draft decision, cap context, and division landscape — into a single tension with real stakes and a ticking clock (pre-draft).

## Team Relevance
This decision affects panel composition (4 agents selected: NYG, Cap, Draft, Defense) and establishes the article's editorial direction for Writer/Editor stages.

## Artifacts Created
- `content/articles/nyg-2026-offseason/idea.md`
- `content/articles/nyg-2026-offseason/discussion-prompt.md`
- `content/articles/nyg-2026-offseason/panel-composition.md`

---

# Update: Stage 4 Panel Position (2026-03-16)

## Decision Made

**Framed the central tension as a timeline question:** Is the Giants' 2027-focused rebuild timeline (patient, infrastructure-first, $112-129M cap explosion) compatible with Jaxson Dart's accelerated Year 2 development and the NFC East's narrowing gap?

### Key Framing Choices

1. **Positioned the Giants as playing a different game than their rivals** — while WSH/DAL chase 2026 wins, NYG is building for 2027. This is supported by $210M+ defensive spending and cap math.

2. **Centered Dart's rookie year as the disruptive variable** — he wasn't supposed to lead all rookies with 24 TDs or beat PHI 34-17. His unexpected breakout changes the calculus because it creates a 2-3 year rookie contract window that history shows must be exploited (CIN/Burrow/Chase) or gets wasted (CHI/Fields).

3. **Emphasized NFC East urgency** — WSH is the most improved team (not PHI), DAL retains firepower, PHI weakened but still has core. Waiting until 2027 assumes rivals stand still (they won't).

4. **Ended with the strategic fork** — Sonny Styles = 2027 patient rebuild; Carnell Tate/Jordyn Tyson = 2026 acceleration to match division trajectory. Both can't be right. The #5 pick decides.

5. **Explicitly handed off to the panel** — Cap must answer if 2027 is financially optimal, Draft must evaluate Tate vs. Styles as prospects, Defense must assess if Styles is needed after the FA rebuild. NYG provides the *question*; the specialists provide the *answer*.

## Rationale

This framing accomplishes three goals:

1. **Avoids taking a side on the draft pick** — as team expert, NYG's job is to frame the franchise-level strategic question, not evaluate prospects (that's Draft's job) or do cap math (that's Cap's job). Staying neutral preserves the panel dynamic.

2. **Elevates beyond mock draft content** — by framing this as "which rebuild is this?" rather than "who should the Giants draft?", the article becomes about organizational identity and strategic philosophy, not just prospect evaluation.

3. **Creates clear lanes for the other panelists** — Cap owns the timeline question (is 2027 soon enough?), Draft owns the prospect question (Tate vs. Styles value), Defense owns the necessity question (is Styles needed?). No overlap, no gaps.

## Key Research Updates Incorporated

- **Carnell Tate is still consensus #5** (33%+ of mocks), not Sonny Styles. Updated article framing to reflect current mock draft landscape.
- **Malik Nabers ACL injury** (rehabbing) adds urgency to WR2 need — can't assume health. This strengthens the "arm Dart now" argument significantly.
- **NFC East power shift confirmed** — WSH most improved (Oweh $100M, Chenal, Robertson), not PHI. Division gap narrowing fast.

## Reusable Pattern Identified

**Panel-based article workflow:**
- Team expert provides franchise context and strategic framing
- Specialists (Cap, Draft, Defense, etc.) answer the framed question from their domain
- Team expert synthesizes at the end (if needed), or Writer handles full synthesis in Stage 5

This avoids the "everyone talks about everything" problem and creates clearer editorial lanes. May be worth documenting in `.squad/skills/article-discussion/`.

## Artifacts Created (Stage 4)
- `content/articles/nyg-2026-offseason/nyg-position.md` (~550 words)

## Status
Panel position complete. Ready for Cap, Draft, and Defense to write their positions (can be done in parallel).

# Decision: NYJ Panel Position — Two Bites at the Apple

**Date:** 2026-03-15
**By:** NYJ (New York Jets Expert)
**Article:** nyj-two-firsts-qb-decision
**Status:** Filed

## Recommendation

**Path 1 — Mendoza at #2, Best Defender at #16.**

Take the quarterback now. The Jets' 20-year QB drought is the franchise's defining failure. Waiting for the 2027 class is the NFL's most repeated mistake. Mendoza's pocket-passer profile fits Frank Reich's scheme, Geno Smith bridges Year 1, and #16 addresses the CB1 emergency created by the Sauce Gardner trade.

## Hardest Tradeoff

Spending #2 overall on a non-consensus QB in a "thin" class — with full knowledge that Bortles, Rosen, and Darnold were all early picks in similarly thin classes who busted. If Mendoza misses, the Jets have burned their best draft asset in a decade and validated the "wait for 2027" argument.

## Key Roster Findings

- Teardown is 80% coherent but the Hall franchise tag ($14.3M) and Fitzpatrick acquisition ($15.6M) contradict rebuild logic
- CB1 is a genuine scheme emergency — Glenn's press-man identity requires a corner the roster doesn't have
- 2028 is the realistic contention window (dead money clears, $264M projected cap space)
- 2026 win projection: 5-7 wins regardless of draft path

---
date: 2026-03-16
agent: offense
type: scheme-analysis
status: proposed
---

# Decision: Playcalling Delegation INCREASES Position Importance (Not Decreases)

## Context

Denver article panel discussion on TE draft priority. Sean Payton delegating playcalling to Davis Webb for first time in 20-year HC career. Natural assumption: if Payton (the Joker-role architect) isn't calling plays anymore, maybe the TE position matters less.

## Decision Made

**Opposite is true:** Playcalling delegation INCREASES the importance of the signature position/scheme element.

## Rationale

When the architect stops calling plays and the protégé takes over:

1. **Loss of real-time adjustment fluidity** — Payton could see coverage and audible instantly to exploit it. Webb needs pre-scripted contingencies until he builds that instinct → the safety valve position becomes MORE critical as his coverage-read backup.

2. **Defensive coordinators test the new playcaller** — They'll show exotic looks pre-snap, rotate post-snap, force quick reads. The signature scheme element (Joker TE for Payton, or whatever the system's "constraint defender" is) becomes the simplest coverage identifier to lean on when surprised.

3. **Background ≠ playcalling experience** — Webb coached Bo Nix brilliantly (QB coach, passing game coordinator), but coaching mechanics and calling an AFCCG offense under pressure are different skill sets. He needs structural support, and the Joker role IS that support.

## Application Beyond Denver

This pattern applies to ANY coaching transition where the architect delegates:

- **If Andy Reid stopped calling plays** (KC), the new playcaller would need Travis Kelce (or his replacement) MORE, not less — because Kelce is Reid's coverage-read safety valve
- **If Kyle Shanahan delegated** (SF), the new playcaller would need the fullback/Juszczyk role MORE — because it's the pre-snap motion key that unlocks the entire Shanahan system
- **If McVay delegated** (LAR), the new playcaller would need the 11 personnel WR versatility MORE — because that's the foundation of the McVay route tree

## General Principle

**When playcalling is delegated, the system's signature position/role becomes MORE important because it's the new playcaller's crutch until they develop pattern recognition.**

The architect can compensate when the signature piece is missing (they've seen every coverage 1000 times). The protégé can't — they need the structural support the system was designed around.

## Recommendation for Future Articles

When evaluating coaching transitions (OC hires, playcalling delegation, HC succession):
- Identify the system's "constraint defender" or "coverage identifier" position
- Assume that position's importance INCREASES in Year 1 of the transition
- Don't mistake the architect's flexibility for proof the system can work without its foundation

---

**Proposed by:** Offense  
**Needs review by:** Lead (for general applicability), DEN (for Denver-specific accuracy)

---
agent: offense
article: kc-mahomes-return-roster-gamble
date: 2026-03-16
decision_type: offensive-architecture
---

# Decision: KC Post-ACL Mahomes Offensive Architecture

## Context
Chiefs are facing the most significant offensive constraint in the Mahomes era: their franchise QB is returning from a torn ACL without full functional mobility for 12–18 months post-surgery. Simultaneously, the receiving corps is dangerously thin (Rashee Rice suspension wildcard, Xavier Worthy unproven, Kelce aging), forcing Andy Reid to redesign the offense mid-dynasty.

## The Decision
Reid must shift from a post-snap improvisation offense (Mahomes' historical strength) to a **rhythm passing offense** built on quick game, pre-snap motion, and play-action credibility — a structure Mahomes has never run in the NFL.

## Supporting Architecture
1. **Kenneth Walker RB signing ($43M):** Provides the play-action foundation the offense needs without Mahomes' scramble ability
2. **Personnel shift:** More 12 personnel (two TEs), less 10 personnel (four WRs) to create natural protection pockets
3. **Concept distribution:** Quick game (ball out <2.5 seconds), play-action off Walker zone runs, significantly fewer deep shots early
4. **Pre-snap motion increase:** 60%+ of snaps to give Mahomes coverage clarity without requiring post-snap mobility

## Critical Constraint
**Receiving corps depth.** If Rashee Rice is suspended AND Xavier Worthy gets hurt, Travis Kelce is the only proven pass-catcher on the roster. Zero margin for error.

## Recommendation
If Rice is suspended, the Chiefs must trade for a proven intermediate receiver immediately (target: Darnell Mooney / Jakobi Meyers type). Cost: Day 2 pick. Non-negotiable for offensive functionality.

## One-Year Window
This offensive structure only works for 2026. After that, the cap detonates (Mahomes $85M hit in 2027), Kelce retires, and the roster rebuild accelerates. Reid must design it perfectly.

## Team-Wide Implication
This decision affirms that **the 2026 Chiefs are in a one-year contention window** where the offensive identity must be completely reimagined around quarterback limitations rather than strengths. The dynasty's twilight is here.

# Decision: Offense Panel Position — SEA RB Pick #64 v2

**Date:** 2026-03-16
**By:** Offense (Offensive Scheme Expert)
**Affects:** SEA team agent, Injury, CollegeScout, Writer, Lead
**Article:** Seahawks RB Pick #64 Analysis (v2)
**Issue:** #71

## Decision

Offense rates the scheme pull toward RB at #64 as **7/10** — Price is a schematic target, not a luxury. Fleury's wide zone system requires three committee backs; Seattle currently has one zone-fit starter (Charbonnet, ACL uncertain) plus a gap runner (Wilson) and a depth body (Holani). Price's Notre Dame zone experience translates cleanly with no adjustment period.

## Key Positions

1. Wilson as primary zone back is a schematic mismatch that cascades into play-action and passing efficiency problems.
2. The replacement curve at zone-fit RB (within this specific scheme) is steeper than at CB/EDGE, where veteran FA options return 80 cents on the dollar.
3. Charbonnet's ACL timeline is the swing variable: 90%+ Week 1 readiness → pull drops to 5/10; 50-60% → pull rises to 8/10.

## Expected Disagreements

- **SEA** will rank CB/EDGE above RB on raw need — Offense doesn't dispute need severity, but argues drop-off severity is the real metric.
- **CollegeScout** may find a viable Day 3 zone back alternative — if so, the #64 case weakens.
- **Injury** owns the Charbonnet timeline that swings the entire argument.

## Status

✅ Panel position delivered → `content/articles/seahawks-rb-pick64-v2/offense-position.md`

### 2026-03-16: Publisher gate for NFC West batch drafts
**By:** Publisher lane
**Status:** Proposed
**Affects:** Publisher, Lead, Joe

**What:**
- Do not create a Substack draft for a batch article unless the article has a real draft artifact (`draft.md` or equivalent ready article file) **and** a completed editor-review artifact.
- A Writer-ready discussion summary is not enough for Publisher pass.
- A draft that still contains image placeholders, writer notes, or other pre-editor markers is still blocked even if the headline/body are largely complete.
- For this batch, target publication remains `https://nfllab.substack.com`, using tags and no byline/section customization beyond the existing publisher workflow.

**Why:**
- `content/article-ideas.md` makes Editor review mandatory before publish.
- The publisher and article-lifecycle skills both place Stage 7 after Editor approval.
- This keeps batch publishing honest: only files that have crossed the editorial gate get draft URLs, and everything else is reported with a concrete missing artifact instead of wishful "almost ready" status.

# Decision: SEA Panel Position — Seahawks RB Pick #64 (v2)

**By:** SEA (Seattle Seahawks Expert)  
**Date:** 2026-03-16  
**Status:** Proposed  
**Affects:** Lead, Writer, Offense, CollegeScout, Injury panelists on article #71  

## What

SEA's Stage 4 panel position for the Seahawks RB Pick #64 v2 article recommends **against** using Pick #64 on a running back. The revised need hierarchy after free agency losses:

1. **CB at #32** — Woolen + Bryant departures left the secondary one injury from catastrophe
2. **EDGE at #64** — Mafe gone, Lawrence may retire, no young edge on roster
3. **RB at #96 or via veteran FA** — Charbonnet returns midseason; veteran bridge ($3-5M) covers Weeks 1-8
4. **IOL at #96 or ~#188** — Interior depth thin but not crisis-level

The four-pick constraint (only #32, #64, #96, ~#188) makes every selection critical. Two of four must address defensive needs. RB can be solved with cap space; CB and EDGE cannot.

## Why

The v1 article was written before Seattle lost Woolen (PHI), Bryant (CHI), and Mafe (CIN). Those departures fundamentally altered the need stack. Additionally, DeMarcus Lawrence is openly considering retirement, which would leave EDGE in crisis. The RB room has a floor (Charbonnet returning midseason, Wilson, Holani, McIntosh) that CB and EDGE do not.

## Key Quotable

> "Price is a fine player. This isn't about Price. It's about a four-pick draft where two positions are on fire and running back is merely smoldering."

## File

`content/articles/seahawks-rb-pick64-v2/sea-position.md`

---
type: "article-recommendation"
agent: "TB"
issue: "#69"
status: "pending"
priority: "high"
---

# TB Decision — Issue #69 Mayfield Extension Article

**Date:** 2026-03-16  
**Agent:** TB (Tampa Bay Buccaneers Expert)  
**Context:** Article pipeline Stage 4 (Panel Discussion)

## Decision Context

Issue #69 requested a Tampa Bay Buccaneers 2026 offseason article. After researching current data (2025 season results, 2026 cap situation, FA moves, coaching changes), I identified the Baker Mayfield extension question as the single most pressing issue facing the franchise.

## Angle Selected

**"Baker Mayfield's \$53M Trap: Tampa Bay Can't Afford to Pay Him — and Can't Afford Not To"**

**Core tension:** Mayfield's \$52.98M cap hit (17.46% of cap) on an 8-9 team creates a no-win scenario:
- Extend him → lock in \$50M+ AAV for a QB who collapsed 6-2 to 8-9
- Let him walk → QB purgatory in a harder NFC South (CAR/ATL/NO all upgraded)

Neither path clearly fixes the roster (56% cap concentration in top 5 players, pass rush crisis, Evans dead money).

## Recommendation as TB Team Expert

**Extend Baker Mayfield with outs after Year 2.**

**Structure:**
- 3yr/\$156M (\$52M AAV)
- \$80M fully guaranteed at signing
- Year 3 salary guaranteed for injury only (team can walk after Year 2)
- 2026 cap hit drops to ~\$40M (creates \$13M space via restructure)

**Rationale:**
1. **No viable alternative:** Jake Browning is a backup. 2026/2027 draft QB classes are weak. Trading up costs capital the Bucs don't have.
2. **Locker room support:** Winfield (captain), Godwin (WR1), Bowles (HC) all publicly backed Mayfield post-collapse.
3. **Scheme fit:** New OC Zac Robinson's play-action heavy, motion-based offense (from ATL) masks Mayfield's weaknesses and maximizes strengths.
4. **Division got harder:** CAR (Phillips/Lloyd), ATL (Stefanski), NO (\$113M spending spree) — can't compete with QB uncertainty.

**Pair with:**
- Cut Vita Vea (saves \$15.7M) → aging, declining, high cap hit
- Draft EDGE at #15 (Cashius Howell if available) → address pass rush on rookie deal
- Sign veteran CB2 (budget \$8-10M AAV) → replace Jamel Dean

**Creates:**
- ~\$28M in total cap space (\$13M from extension + \$15.7M from Vea cut)
- QB continuity for 2-3 years
- Young EDGE + veteran CB to fix defense
- Exit after Year 2 if Mayfield doesn't deliver

## Why This Matters for the Project

This recommendation drives the entire article narrative. The other panelists (Cap, Offense) will react to this position:

- **Cap** will model the extension scenarios and likely argue the numbers favor letting him walk
- **Offense** will analyze whether Robinson's scheme truly fits Mayfield or if a different QB profile is needed

The tension between these three perspectives IS the article. TB (me) argues extend for roster stability. Cap argues walk for financial flexibility. Offense is the swing vote — scheme fit determines if the investment is worth it.

## Data Supporting This Decision

**Second-half collapse was multi-causal, not just Mayfield:**
- OL injuries: Bredeson (LG) and Mauch (RG) both hit IR → pressure rate jumped from 24.1% to 31.4%
- Mike Evans decline: 4 games under 40 yards in final 8 weeks (hamstring issues)
- Defense failed: 48.6% third-down conversion allowed in second half vs. 36.2% in first half
- Scheme stagnation: Bowles immediately fired OC Grizzard, QB coach Lewis, STC McGaughey post-season

**Mayfield's 2025 splits:**
- First 8 games (6-2): 1,847 yards, 14 TDs, 4 INTs, 26.4 PPG
- Final 7 games (2-7): 1,683 yards, 9 TDs, 8 INTs, 19.8 PPG

The collapse wasn't solely on Mayfield — but he's still the QB, and QBs get the credit AND the blame.

**Locker room temperature (sources: Pewter Report, ESPN, SI):**
- Winfield: "Baker's our guy, we ride with him" (Dec 2025)
- Godwin: Lobbied Licht to extend Mayfield (Jan 2026)
- Bowles: "Baker gives us the best chance to win. Period." (post-season presser)

**Post-Evans WR room viability:**
- Godwin (30, \$33.7M cap hit) moves to WR1 — slot-capable, fits Robinson's option routes
- Emeka Egbuka (rookie, 1st-rounder 2025) showed flashes but inconsistent (112 yards vs. SEA, 18 yards vs. BUF)
- Cade Otton (TE, 3yr/\$30M re-signed) is the X-factor — 72 catches for 734 yards in 2025, fits Robinson's TE-heavy scheme

## Next Steps

1. **Awaiting Cap analysis:** Extension modeling at \$50M/\$52M/\$55M AAV, 2026-2028 cap impact
2. **Awaiting Offense analysis:** Robinson scheme fit, Mayfield vs. hypothetical replacement
3. **Writer drafts article** once panel discussion complete (Stage 5)
4. **Editor reviews** for accuracy, tone, fact-checking (Stage 6)
5. **Joe approves for publish** (Stages 7-8)

## Status

- [x] Idea generated with current 2026 data (no stale training-data angles)
- [x] Discussion prompt written
- [x] Panel composed (TB, Cap, Offense)
- [x] TB analysis complete (this document + panel-tb-analysis.md)
- [ ] Cap analysis (pending)
- [ ] Offense analysis (pending)
- [ ] Writer draft
- [ ] Editor review
- [ ] Publish

---

**Requesting:** Lead approval to continue with this angle and recommendation. If Joe wants a different position (e.g., "let him walk" or "trade him"), I can adjust before Writer drafts.

— TB (Tampa Bay Buccaneers Expert)

### 2026-03-15: TEN Panel Position — Ward vs. Saleh Draft Identity

**By:** TEN (Tennessee Titans Expert)
**Status:** Proposed
**Affects:** TEN team agent, article panel discussion process

**Decision:** When writing panel positions for organizational power structure questions, quantify FA spending patterns and identify family/scheme connections to reveal true decision-making hierarchy.

**What:**
For the "52 Sacks and a Defense-First Draft" article, TEN's panel position used:
1. **FA spending ratio analysis** — Calculated 1.9-to-1 defense over offense in total contracts ($179M vs $94M), 2.2-to-1 in guarantees. This is objective evidence of organizational priority.
2. **Power structure mapping** — Identified family connections (Dave Borgonzi = GM's brother on defensive staff, Ahmed Saleh = HC's cousin). This reveals Borgonzi/Saleh alignment vs Daboll as outside consultant.
3. **Strategic timing analysis** — Explained why Calvin Ridley hasn't been cut yet (post-June 1 window is open): cutting him early signals draft intent and kills trade-down leverage. The timing is a competitive strategy, not just a cap decision.
4. **Division gap context** — TEN is 2-3 years behind HOU (playoff team vs 3-14). This justifies Saleh's "build elite defense first" philosophy as a multi-year plan, not a 1-year fix.
5. **Coaching leverage assessment** — Daboll got 2 offensive FAs (Robinson, Bellinger), both scheme-familiar not premium. He has no GM authority. The #4 pick is his only leverage point to force offensive investment.

**Why:**
Panel positions for team agents should provide organizational context that specialists can't deliver. TEN's unique value is roster knowledge + front office dynamics + division competitive reality. By quantifying FA spending and mapping power structure, TEN gives the panel (and the Writer) a framework to evaluate the EDGE vs WR decision through the lens of "who actually makes this call and what do they prioritize?"

**Recommendation:**
TEN advocated for **trade down to #7–11** (Starks or Tate) + extra R2 pick as the optimal path. This gives Borgonzi optionality, Saleh gets defensive talent either way, and Daboll gets a WR in the first two rounds. If no trade partner exists, take **Mykel Williams (EDGE)** at #4 and accept that Ward's Year 2 supporting cast will be bottom-10.

**Hardest tradeoff named:**
Choosing EDGE at #4 means accepting Cam Ward enters Year 2 with a bottom-10 offensive supporting cast. If Ward stalls, the organization will have chosen Saleh's vision (elite defense protects young QB) over Daboll's mandate (give the QB weapons to develop). That choice defines the next 3-5 years.

**Reusable pattern for future TEN positions:**
- Always quantify FA spending by position group (offense vs defense split)
- Map family/scheme connections on coaching staff to reveal decision-making alignment
- Assess division gap to contextualize timeline (rebuild vs win-now)
- Identify strategic timing signals (e.g., why a cut hasn't happened yet when it's cap-optimal)
- Name the hardest tradeoff explicitly — don't smooth it over

# Decision: Narrative Strategy for Unanimous Panel Consensus Articles

**Date:** 2026-03-16  
**Decided by:** Writer  
**Context:** Miami Dolphins $99M dead cap rebuild article  
**Status:** Proposed (for team review)

## The Problem

The Miami article presented a structural challenge: all three experts (Cap, MIA, Draft) independently recommended the same path (Path 3: Green Bay slow build). No disagreement on strategy — only on timeline.

Prior articles (JSN extension, Arizona draft) had clear disagreement axes that drove narrative tension:
- JSN: Cap/PlayerRep wanted $28-30M, Offense wanted $36M
- Arizona: Cap wanted patience, Offense wanted urgency, ARI dissented entirely

The expert-disagreement format is our differentiator. What happens when experts agree?

## The Decision

**When panel consensus is unanimous on the path, shift the disagreement axis to dependencies and timeline.**

Structural approach for Miami article:
1. **Lead with debunking the sensational headline** — The $99.2M number is the click driver, but Cap's proportional burden analysis reframes it immediately
2. **Organize around areas of agreement first** — Establish Path 3 as unanimous, present each expert's contribution to that consensus
3. **Surface the timeline tension as the disagreement** — Cap: 2027 competitive, MIA: 2028 competitive, Draft: depends on variables
4. **Feature the non-obvious insight prominently** — Salary-dump trade market (Cap's strategy) becomes the differentiator from recap journalism
5. **Frame swing variables as narrative wildcards** — Chop Robinson's development, Willis evaluation, 2027 QB class — these create uncertainty even with consensus path

## Rationale

The expert-panel format works when:
- Experts disagree on strategy → traditional disagreement structure
- Experts agree on strategy but disagree on execution/timeline → dependencies structure (this case)
- Experts all surface different non-obvious insights → mosaic structure (future use case)

Unanimous consensus doesn't mean no tension. It means the tension lives in *uncertainty* (will Robinson develop?) rather than *prescription* (what should Miami do?).

## Validation Needed

This was the first unanimous-consensus article. Editor review will determine whether:
- The timeline disagreement creates sufficient narrative tension
- The swing variable framing (Robinson, Willis, 2027 class) works as a substitute for path disagreement
- Readers experience the article as "expert analysis with depth" vs "everyone agrees, boring"

## Alternative Considered

**Devil's advocate structure** — Assign one panelist to argue Path 1 (scorched earth) or Path 4 (Hail Mary) even if they don't believe it, to create artificial disagreement.

**Rejected because:** Forces experts to argue positions they don't hold, undermines credibility. The panel's job is honest analysis, not debate-team theater. If all three independently reached the same conclusion, that *is* the story.

## Team-Relevant Impact

- **Writer:** New narrative template for consensus articles
- **Lead/Coordinator:** When designing panels, anticipate whether disagreement is structurally likely (e.g., Cap vs PlayerRep on extensions = always disagree; Cap + MIA + Draft on rebuild = may converge)
- **Editor:** Fact-check that "unanimous consensus" claim is accurate — verify no panelist hedged or dissented in their position file

## Files Referenced
- `content/articles/mia-tua-dead-cap-rebuild/draft.md` — The consensus-structure article
- `content/articles/mia-tua-dead-cap-rebuild/discussion-summary.md` — Lead's documentation of unanimous Path 3 recommendation

### 2026-03-16: Witherspoon republish image placement
**By:** Writer
**Status:** Recorded
**Affects:** Writer, image generation pipeline, publisher pass

**What:** Added exactly two inline image placeholders to `content/articles/witherspoon-extension-v2/draft.md` using the expected generated asset paths `../../images/witherspoon-extension-v2/witherspoon-extension-v2-inline-1.png` and `../../images/witherspoon-extension-v2/witherspoon-extension-v2-inline-2.png`. Placed them after **The Setup** and **The Fight**, the two strongest visual breakpoints in the article.

**Why:** Those sections cleanly separate the piece's two core ideas: why Witherspoon is structurally essential to Seattle's defense, and where the actual negotiation gap lives. Using the standard slug-based image path pattern keeps the draft ready for image generation and clean Substack republishing without changing article substance or byline handling.

---
type: "article-angle"
agent: "WSH"
issue: 61
article_slug: "wsh-2026-offseason"
status: "approved"
date: "2026-03-16"
---

# Decision: Article Angle for Issue #61 — WSH 2026 Offseason

## What Was Decided

Selected **"$66 Million and No Answers — Washington Built a Fortress on Defense, But Daniels' Offense Is Still Bare"** as the article angle for the Commanders' 2026 offseason piece.

## Why This Angle

- **Strongest tension available:** Defense-first spending philosophy critique vs. incomplete offense around a franchise rookie-deal QB is a more interesting question than a standard needs list or draft preview.
- **Unique frame:** "Building backwards" hasn't been written as a comprehensive analysis for Washington. Every other outlet has needs lists; this critiques the *order* and *philosophy* of roster construction.
- **Dual first-time coordinator risk** adds a sharp coaching sub-angle with historical precedent (2024 Patriots, 2023 Cardinals, 2021 Jets).
- **Universal appeal:** The rookie-deal QB window debate applies to every NFL team — Commanders are the most extreme case study in 2026.
- **Scored 12/12** on the idea-generation rubric.

## Panel Selected

WSH + Cap + Offense (3 agents). Draft considered but embedded in WSH assignment to avoid dilution.

## Stage Reached

Stages 1-3 complete (idea, discussion prompt, panel composition). Ready for Stage 4 panel discussion.

## Artifacts

- `content/articles/wsh-2026-offseason/idea.md`
- `content/articles/wsh-2026-offseason/discussion-prompt.md`
- `content/articles/wsh-2026-offseason/panel-composition.md`


### 2026-03-16: Dense Table → PNG Rendering Before Substack Publish
**By:** Writer
**Date:** 2026-03-16
**Context:** Miami Tua dead cap article (mia-tua-dead-cap-rebuild)

**What:**
When the Substack publisher's density classifier blocks a markdown table (≥5 columns with financial/comparison headers, or densityScore ≥ 7.5), render it as a PNG using the repo's enderer-core.mjs table-image-renderer and replace the markdown table with the image reference before publishing.

**Why:**
The publisher extension's ssertInlineTableAllowed guard intentionally rejects dense tables because Substack's inline list conversion destroys layout meaning. The dead cap comparison table (6 columns: Team, Year, Dead Cap, Total Cap, Dead %, Recovery Timeline) triggered this guard. Rendering to PNG preserves the visual hierarchy that makes the data scannable.

**Implementation:**
1. Call enderTableImage() from .github/extensions/table-image-renderer/renderer-core.mjs with the blocked table markdown
2. Save the PNG to content/images/{slug}/
3. Replace the markdown table in the article with ![alt|caption](../../images/{slug}/{filename}.png)
4. Proceed with publish

**Scope:**
Applies to all future articles with dense comparison/financial tables. The cap-comparison template is ideal for dead cap data; draft-board for draft pick tables.

**DB Writeback Note:**
Pipeline DB stage transition was NOT performed because there's no clearly safe path from within a Writer/JS context. The PipelineState Python layer should be used by Lead or Ralph for stage advancement.



### 2026-03-16: LAR 2026 Offseason Draft — Structural & Editorial Choices
**Author:** Writer
**Date:** 2026-03-16
**Article:** content/articles/lar-2026-offseason/draft.md

**What:**
Took Lead's synthesis position (EDGE at #13) for the verdict rather than flattening the OT vs. EDGE disagreement. Both sides are fully preserved in the body — LAR and Draft lean OT, Defense demands EDGE — but the verdict is decisive per house style ("don't write generic 'both sides have a point' conclusions").

**Rationale:**
1. Lead's synthesis explicitly recommended EDGE at #13 with the reasoning that "RT problem is real but more solvable in free agency or Day 2."
2. Draft's LB-class insight (EDGE values suppressed, top-12 talent at #13) provides the evidence bridge — it's not just a preference, it's a market inefficiency argument.
3. The article's defensive scheme section builds a feedback-loop argument (coverage → sacks → shorter downs) that structurally supports EDGE over OT.

**Impact:**
Editor should review whether the verdict leans too heavily EDGE given two of four panelists preferred OT. The disagreement table preserves both positions, but the closing paragraphs advocate for EDGE. If Editor wants more balance, the closing could be rewritten to present both as equally valid championship strategies.



### 2026-03-16: Seahawks RB Pick #64 v2 Draft
**Date:** 2026-03-16
**Agent:** Writer
**Article:** seahawks-rb-pick64-v2
**Issue:** #71

**Decision:**
Drafted the v2 article at content/articles/seahawks-rb-pick64-v2/draft.md. Honored the lead call: the article lands on "EDGE/CB at #64, RB at #96 or veteran bridge" rather than reaffirming Price at #64. Preserved Offense's dissent (7/10 pull toward RB at #64) as a full section with its own quotes and argument rather than a footnote.

**Key Structural Choices:**
1. Led with "what changed" rather than "what we found." The defensive losses are the narrative engine — they explain why the panel reconvened and why the answer shifted.
2. Gave Offense its own section, not just a row in the disagreement table. The scheme argument is the article's tension. Flattening it to a table cell would violate the "disagreement is content" principle.
3. Used CollegeScout's dropoff table as the analytical centerpiece. This is the single most persuasive data point and it anchors the verdict without editorializing.
4. Did not frame Price negatively. The article repeatedly says he's a good player at the wrong price — respecting the prospect while redirecting the pick.

**For Editor:**
Fact-check items to verify:
- Charbonnet ACL timeline (late January surgery, IR placement January 23)
- Price ADP range (53–58 per PFF/StatRankings)
- FA contract details (Mafe 3yr/\, Woolen 1yr/\, Bryant 3yr/\)
- Robinson Jr. market value estimate (\–5M)
- Lawrence retirement reporting sources
- Coleman/Johnson/Singleton board positions at #96 range
- Super Bowl LIX reference (Seattle as defending champions)



### 2026-03-16: SF 2026 Offseason — Draft Structure
**By:** Writer
**Date:** 2026-03-16
**Article:** sf-2026-offseason

**Decision:**
Organized the article around unanimous Path 2 consensus, with the primary tension point moved to **pick #27 allocation** (EDGE vs. OT) rather than the usual path-vs-path disagreement. This is a structural choice — when all four experts agree on the path, the article's conflict must come from a subordinate disagreement that still has real stakes.

**Rationale:**
Previous articles (ARI, MIA, Seahawks RB) all had at least one expert advocating a different path, making the disagreement section straightforward. Here, all four panelists wanted Path 2. Framing the pick #27 fight as the "real" disagreement keeps expert tension alive without manufacturing a split that didn't exist.

**Impact:**
Future articles with unanimous panels should look for the subordinate split — it's always there. The question is never "do they agree" but "where exactly does the agreement fracture."



### 2026-03-16: Ralph Prompt.md — Principle-First Reorganization
**By:** Writer
**Status:** Implemented (not committed per user request)
**Date:** 2026-03-16
**Affects:** Ralph orchestrator prompt, pipeline iteration behavior

**What:**
Rewrote alph/prompt.md to use the three operating principles as the structural backbone:
1. **Artifact-First Discovery** — filesystem is authoritative; labels/DB are followers
2. **Max-Parallel Scheduling** — every unblocked article moves every iteration, no lane caps
3. **Labels Are Visibility Mirrors** — write-only output, never read for scheduling

Previously these three ideas were scattered across Steps 1/2/4 and Rules 6/8. Now they form the top-level "Operating Principles" section with explicit priority ordering, and the iteration steps and rules reference them by name.

**What did NOT change:**
- Stage-specific instructions (1→2 through 8) — identical
- Critical files table — identical
- Progress file format — identical
- Important notes — identical
- Commit protocol — identical

**Why:**
Backend requested the rewrite to reduce Ralph's tendency to consult labels before scanning artifacts, and to make max-parallel the default posture rather than an aspiration. The reorganization is structural (how Ralph reads the prompt) not behavioral (what Ralph does).


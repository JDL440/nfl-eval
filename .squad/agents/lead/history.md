# Lead — Lead / GM Analyst History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Data Sources:** overthecap.com, spotrac.com, ESPN/NFL.com, PFR, PFF, The Athletic, mock draft sites
- **Rumor Mode:** Dual-track (⚠️ RUMOR inline + separate track)

## Learnings

### Article Discussion Workflow — First End-to-End Run (2026-03-15)

**Article:** `jsn-extension-preview` — "Jaxon Smith-Njigba's Contract Is Coming. Here Are the 4 Paths Seattle Can Take."

**Panel used:**
- Cap (contract modeling + cap structure)
- PlayerRep (player leverage + WA tax calculus)
- SEA (roster construction priority)
- Offense (WR scheme value / tier justification)

**What worked:**
- Parallel agent spawning (all 4 fired simultaneously, total wall time ~3 min)
- Front-loading the discussion prompt with specific data anchors (cap hit tables, market comps, tax math) produced sharp, number-driven positions — no vague analysis
- Panelist instructions with explicit "what you should focus on" + "what to avoid" (no talent eval for Cap, no cap analysis for Offense) kept positions clean and non-overlapping
- The synthesis revealed a genuine strategic tension (AAV: $28M vs. $36M) that makes the article interesting — not a rubber-stamp panel

**Key finding from this run:**
The WA millionaires tax (SB 6346, effective 2028) is a *front-loading accelerant*, not just a player destination factor. Cap identified the mechanism: a $65M signing bonus paid in 2026 is pre-tax income. This creates a time-sensitive window that strengthens the "extend now" argument independent of the talent debate. Write this into the article.

**The Shaheed signal:** PlayerRep's non-obvious point — the $51M Shaheed re-sign is JSN's best negotiating weapon. Seattle tipped its hand: you don't pay the WR2 $17M/yr and then claim you can't afford the WR1.

**Panel disagreement zone (use this in the article):**
- AAV target: $28M (Offense) vs. $31–32M (SEA) vs. $34M (Cap) vs. $36M (PlayerRep)
- Synthesis recommendation: $31–33M range threads the needle
- Tag war rejected unanimously — that's the headline consensus

**Artifacts created:**
- `content/articles/jsn-extension-preview/discussion-prompt.md`
- `content/articles/jsn-extension-preview/cap-position.md`
- `content/articles/jsn-extension-preview/playerrep-position.md`
- `content/articles/jsn-extension-preview/sea-position.md`
- `content/articles/jsn-extension-preview/offense-position.md`
- `content/articles/jsn-extension-preview/discussion-summary.md`

**DB updated:** `current_stage = 'panel_discussion'`
**Decision filed:** `.squad/decisions/inbox/lead-discussion-path-field.md` — add `discussion_path` column to `articles` table
**Skill created:** `.squad/skills/article-discussion/SKILL.md`

### Data Source Viability (Observed 2026-03-12)

**What Works with web_fetch:**

| Source | URL Pattern | Quality | Notes |
|--------|-------------|---------|-------|
| OTC Team Cap | `/salary-cap/{team-slug}` | ✅ Excellent | Full roster salary table, server-rendered, all 32 teams |
| OTC Player Contract | `/player/{slug}/{id}` | ✅ Excellent | Year-by-year breakdown, guarantee triggers, out years |
| OTC Cap Space Rankings | `/salary-cap-space` | ✅ Excellent | All 32 teams, multi-year, effective cap space |
| OTC Position Market | `/position/{position}` | ✅ Excellent | All contracts at position sorted by APY |
| Spotrac Team Cap | `/nfl/{team-slug}/cap` | ✅ Excellent | Similar to OTC, includes league rank per metric |
| Spotrac Free Agents | `/nfl/free-agents` | ✅ Excellent | Signed + available FAs, contract terms, teams |
| Spotrac Player Contract | `/nfl/player/_/id/{id}/{slug}` | ✅ Excellent | Most detailed: incentives, escalators, notes |
| ESPN Roster | `/nfl/team/roster/_/name/{abbr}/{slug}` | ✅ Good | Position, age, height, weight, experience, college |
| ESPN Depth Chart | `/nfl/team/depth/_/name/{abbr}/{slug}` | ✅ Excellent | Full depth chart by formation, injury flags |
| ESPN Transactions | `/nfl/team/transactions/_/name/{abbr}/{slug}` | ✅ Excellent | Chronological with full details |
| ESPN Schedule | `/nfl/team/schedule/_/name/{abbr}/{slug}` | ✅ Good | Game results, leaders |
| NFL.com Roster | `/teams/{team-slug}/roster` | ✅ Good | Key advantage: UFA/RFA/ERFA status flags |

**What Does NOT Work:**

| Source | URL Pattern | Issue |
|--------|-------------|-------|
| Pro Football Reference | Any PFR URL | 🔴 HTTP 403 — blocks all automated access |
| OTC Free Agency | `/free-agency` | 🔴 JS-only, returns empty table headers + preloader GIFs |
| OTC Cap Tracker | `/cap-tracker` | 🔴 404 Not Found |
| OTC Contracts by Team | `/contracts/{team-slug}` | ⚠️ Returns league-wide data, not team-filtered |

**Key Discoveries:**
- OTC player IDs must be extracted from team salary pages — guessing IDs returns wrong players
- Spotrac is the ONLY working source for free agent tracking via web_fetch
- ESPN depth chart reveals scheme (formation names: "3WR 1TE", "Base 4-3 D")
- ESPN transactions page is the best single page for offseason move tracking
- NFL.com roster status flags (ACT/UFA/RFA) are unique — no other source provides this in fetchable form
- `max_length` must be 8000-15000 for roster/cap pages; default 5000 truncates heavily
- 2026 salary cap is $301,200,000

### Skills Created (2026-03-12)
- `.squad/skills/overthecap-data/SKILL.md` — OTC URL patterns, extraction guidance
- `.squad/skills/spotrac-data/SKILL.md` — Spotrac URL patterns, free agent tracking
- `.squad/skills/nfl-roster-research/SKILL.md` — ESPN/NFL.com roster, depth, transactions
- `.squad/skills/knowledge-recording/SKILL.md` — Standard format for agent history.md files

### Agents Created (2026-03-12)
- **Media** (`.squad/agents/media/`) — NFL Media & Rumors Specialist. Intel desk: monitors news feeds, tracks rumors with confidence levels (🟢/🟡/🔴), manages rumor lifecycle (⚠️ RUMOR → ✅ CONFIRMED / ❌ DEBUNKED), pushes confirmed intel to team agents. Includes reporter reliability tiers (Tier 1–4) and rumor dashboard format. Created per Joe Robinson's request.
- **Analytics** (`.squad/agents/analytics/`) — NFL Advanced Analytics Expert. The team's numbers engine: EPA, DVOA, PFF grades, QBR, win probability, success rate, AV. Provides statistical context for player evaluation, player comparison models, positional value analysis, contract value modeling, draft pick value analytics, team efficiency rankings, and opponent-adjusted metrics. Challenges narrative-driven evaluations with data. Integrates with Cap (contract value), Draft (prospect modeling), Offense/Defense (scheme context), and team agents (team-specific analytics). Created per Joe Robinson's request.
- **CollegeScout** (`.squad/agents/collegescout/`) — College Player Scouting Expert. The team's college-to-pro projection specialist: deep prospect evaluation (film patterns, technique, athleticism, football IQ), measurables analysis with positional thresholds, college production in context (conference, system, usage), historical prospect comps, scheme fit projection (with Offense/Defense), medical red flags (with Injury), character/intangibles tracking, small school/FCS discovery, all-star game evaluation, and transfer portal tracking. Position-specific criteria for QB, WR, OL, EDGE, CB, S, LB, DL, RB, TE. Provides scouting intelligence that Draft and team agents use — does NOT make pick recommendations. Created per Joe Robinson's request.
- **PlayerRep** (`.squad/agents/playerrep/`) — Player Advocate & CBA Expert. The other side of the negotiation table: advocates from the player's perspective in trade, signing, and contract evaluations. Deep CBA expertise (accrued seasons, FA types, franchise/transition tags, comp pick formula, rookie wage scale, 5th-year option, guaranteed money structures, void years). Player destination preference analysis (state income tax impact, market size, winning culture, scheme fit/role clarity, coaching reputation, lifestyle, family proximity). Contract negotiation dynamics (extension vs. FA timing, leverage points, comparable contracts, guaranteed money as #1 priority). Career trajectory modeling (optimal extension windows by position, age curves, 2nd vs. 3rd contract dynamics). Player movement patterns (ring-chasing, return-home narratives, prove-it deals). Serves as counterpoint to team agents — PlayerRep + Cap together give full negotiation picture. Does NOT evaluate talent or scheme fit — defers to team agents, Offense, Defense. Created per Joe Robinson's request.

### Phase 2 Automation Proposal (2026-03-14)

**Deliverable:** `content/proposals/phase2-automation-proposal.md`

**Key Architectural Decisions Proposed:**

1. **State Machine Design** — Article lifecycle with 6 states: PROPOSED → DRAFTING → REVIEWING → APPROVED → PUBLISHED / ARCHIVED. Each transition is explicit with recovery semantics.

2. **Queue Architecture** — Recommended BullMQ (Node.js + Redis) for job scheduling. Five queues: media-sweep (cron), article-draft (event), article-review (event), article-publish (manual), knowledge-sync (cron).

3. **Hybrid Scheduling** — GitHub Actions for cron triggers (free, auditable), BullMQ for event-driven jobs (priority, retry, concurrency control).

4. **Persistence Strategy** — Git-based JSON for MVP (audit trail, no setup), migrate to SQLite before 32-team scale.

5. **Significance Scoring** — Rules engine to auto-trigger article drafts: +3 for Seahawks starter, +2 for $10M+ AAV or top-60 pick, +2 for division rival, +1 for position of need. Threshold: 4 points.

6. **Cost Model** — Estimated ~$3.20/article with Opus everywhere. Proposed tiered strategy: Opus for Writer/Editor (quality-critical), Sonnet for expert spawns (~$2.00/article).

7. **Error Recovery** — Idempotent operations, state checkpointing on every transition, recovery-on-startup scans for incomplete articles.

**Open Questions for User:**
- Workflow engine preference (BullMQ vs Celery vs Actions-only)
- Cost aggressiveness (Opus everywhere vs tiered models)
- Substack integration (email-to-post vs Puppeteer vs manual)
- First automated article target date (before/during/after draft)

**Learnings:**
- Phase 1 proved the editorial model works (Editor caught 6 errors in Witherspoon article)
- Current manual workflow: ~2-3 hours human involvement per article, 4 human touchpoints
- 32-team scale bottlenecks: Editor single-threaded, dashboard UX overwhelmed, git state performance
- Substack has no public API — need workaround (email-to-post or Puppeteer)

### Article Lifecycle Skill Created (2026-03-14)

**Deliverable:** `.squad/skills/article-lifecycle/SKILL.md`

**What:** Codified the full 8-stage article production lifecycle as a formal skill — from idea generation through Substack publish. This is the canonical process reference that supersedes the Phase 2 state machine proposal's 6-state model with a more granular, human-usable 8-stage workflow.

**Key design decisions:**
1. **Discussion Prompt as required artifact (Stage 2)** — The single biggest process improvement. Forces tension/angle definition BEFORE panel composition, preventing unfocused panels and generic articles. This is what the substack-article skill was missing.
2. **Publisher Pass (Stage 7) — new stage** — Inserted between Editor approval and publish. Designed as a manual checklist today (Joe uses it directly) with clear automation hooks for a future Publisher agent + Substack MCP server. Covers metadata, scheduling, formatting, and cross-post planning.
3. **Panel composition codified (Stage 3)** — Formalized the 2–5 agent sweet spot with a selection matrix mapping article types to recommended panels. Extended the substack-article skill's existing table with more article types and explicit rules (always team agent + specialist, never all 45).
4. **Wrapper, not replacement** — The article-lifecycle skill is coordinator-level orchestration. The existing substack-article skill remains authoritative for drafting mechanics, headline formulas, style guide, and editorial review protocol. No duplication.
5. **Stage transitions are explicit gates** — Each stage has clear "done when" criteria and a transition gate. Recovery semantics defined for Editor rejection, stale-news mid-production, and panelist gaps.
6. **Confidence: low** — New skill, not yet validated end-to-end. Stages 4–6 are proven via existing articles. Stages 2, 3, and 7 are new and need real-world validation.

### Intel Brief — 2026-03-15 Media Sweep

**Source:** Media agent daily sweep (March 14-15). 50+ new confirmed transactions. 115+ total FA transactions tracked. 15 active rumors.

#### LEAGUE-WIDE HIGHLIGHTS

- **Tennessee's $270M+ spending spree is the offseason's defining bet.** Robinson ($78M WR), Franklin-Myers ($63M DL), Taylor ($58M CB), Flott ($45M CB), Bellinger ($24M TE) — all surrounding sophomore QB Cam Ward under Saleh/Daboll. This is either 2020 Bucs or 2022 Jags. Biggest single-team FA spend in the league.
- **Las Vegas built a defense in one week.** Paye ($48M EDGE), Walker ($40.5M LB), Dean ($36M LB), Stokes ($30M CB) = $154M+ on defense, all mid-20s, wrapping around Mendoza (#1 pick) and Crosby. Full franchise pivot from offense-first to defense-first identity.
- **NFC West arms race escalating.** LAR added Watson ($51M CB) + McDuffie (trade). SF restructured Nick Bosa to clear $17M — Joey Bosa signing appears imminent. ARI lost Thompson (S→DAL) but added Bourne (WR). Every team in the division made moves that affect SEA's competitive picture.

#### SEAHAWKS SPECIFIC

| Move | Type | Details | Cap Impact |
|------|------|---------|------------|
| ✅ Rashid Shaheed | RE-SIGN | 3yr/$51M ($34.7M gtd, $23M at sign). WR2/3 + return specialist. $17M AAV. | ~$17M/yr hit |
| ✅ Josh Jobe | RE-SIGN | 3yr/$24M ($14.25M gtd, $9.5M at sign). CB2, 15/16 starts in 2025, 12 PDs. $8M AAV. | ~$8M/yr hit |
| ❌ Coby Bryant | LOST to CHI | 3yr/$40M ($25.75M gtd). 4th significant departure (Walker III→KC, Mafe→CIN, DK→PIT trade, Bryant→CHI). | Safety now critical need |
| ✅ Depth | RE-SIGN | Brady Russell (TE), Emanuel Wilson (RB) signed. Tyler Hall (DB) released. D'Anthony Bell (DB) re-signed. | Minimal |

**Cap Situation:** $44.08M remaining (6th most in NFL). Room for 1-2 more significant signings.

**Key FA targets still available (SEA-linked):**
- Jauan Jennings (WR, 🟡 Possible — ESPN projects SEA, ~$12-16M AAV)
- Najee Harris (RB, 🟡 Possible — post-Achilles, SEA named as landing spot)
- Bobby Wagner (LB — leadership/mentorship, SEA/DEN/LAR projected)
- Asante Samuel Jr. (CB — injury limiting market, significant upside)

**Critical needs post-Bryant loss:** Safety (S), EDGE (Mafe replacement), RB (Walker III replacement). Draft intel has SEA mocked for Notre Dame RB at #32.

#### RUMOR WATCH

| Rumor | Confidence | Change | Key Detail |
|-------|-----------|--------|------------|
| **Aaron Rodgers → PIT** | 🟢 Likely | ⬆️ UPGRADED from 🟡 | Mark Kaboly (The Athletic, Tier 2): "near-certain" of return. Decision before draft. PIT not pursuing other QBs. Win-now roster assembled (Metcalf, Pittman, Dean, Dowdle, Brisker). |
| **Joey Bosa → SF** | 🟢 Likely | STABLE | Nick Bosa restructure cleared $17.172M on 3/14. Multiple Tier 1-2 sources say signing imminent. NFC West EDGE arms race would escalate. |
| **Stefon Diggs market** | 🟡 Possible | BAL emerges as frontrunner | KC, LAC, WSH also linked. No deal. 32 years old. |
| **Jauan Jennings → SEA** | 🟡 Possible | STABLE | ESPN projects SEA. SF door closed (Evans signing). |
| **Maxx Crosby trade** | 🟢 Likely (that LV moves him) | STABLE | BAL trade voided. Market depressed. No new suitor. LV deciding. |
| **ARI #3 pick trade** | 🟡 Active | STABLE | ESPN mocks show EDGE at #3, possible trade back for Ty Simpson (QB). |

⚠️ **Rodgers is the biggest domino.** If he returns, PIT is a Super Bowl contender with Metcalf + Pittman + Dean + Dowdle. If he retires, PIT falls to Mason Rudolph and the entire win-now build craters. Decision expected by end of March. This is a Tier 1 article candidate.

#### ARTICLE PIPELINE IMPLICATIONS

| Pipeline Item | Impact | Action |
|---------------|--------|--------|
| **Priority #1: "Seattle Won the Super Bowl and Lost Half Its Defense"** (Mar 17 target) | ⬆️ MORE URGENT — Bryant loss to CHI adds another departure. Safety now a glaring hole alongside Walker III, Mafe losses. Shaheed/Jobe re-signs give positive counterweight. | **Publish on schedule.** Update to include Bryant loss + Shaheed/Jobe re-signs. |
| **Priority #2: "The Free Agent Nobody's Talking About"** (Mar 18 target) | ⬆️ MORE URGENT — Jennings still unsigned and ESPN projects SEA. Samuel Jr. (CB) could be the under-the-radar pick given Bryant departure. | **Publish on schedule.** Strong Jennings or Samuel Jr. angle. |
| **Evergreen: "NFC West Power Rankings"** | ⬆️ MORE RELEVANT — Watson→LAR, Bosa restructure→SF, Thompson→DAL (ARI loss), Shaheed/Jobe→SEA. All 4 teams moved. | **Promote to March window.** Could publish as NFC West FA recap. |
| **Priority #4: "Seahawks Draft Board at #32 — Every CB"** (Mar 25 target) | STABLE — Bryant departure makes CB draft need even more acute. | On schedule. |
| **Priority #6: "EDGE Rushers Through Macdonald's Scheme"** (Apr 8 target) | STABLE — Mafe gone, EDGE still a need. Phillips ($120M) and Oweh ($100M) set market comps. | On schedule. |
| **NEW: "Tennessee's $270M Spending Spree"** | 🆕 HIGH — Media scored this 5/5 significance. Non-SEA but massive audience potential. | **Add to pipeline — March 19-20 window.** |
| **NEW: "The Rodgers Decision"** | 🆕 HIGH — Media scored 4/5. Biggest remaining domino. Time-sensitive (decision before draft). | **Add to pipeline — publish when decision drops, or preview piece Mar 21.** |
| **NEW: "Seattle's Championship Window: Retention vs. Exodus"** | 🆕 HIGH — Media scored 4/5. Directly overlaps with Priority #1 but different angle (strategic analysis vs. fan reassurance). | **Consider merging with Priority #1 or publishing as follow-up.** |
| **Priority #16: "WA Millionaires Tax"** (Jun 22 target) | STABLE — No new developments. 2028 effective date means no urgency. | On schedule. |

#### AGENTS TO BRIEF

| Agent | Why | Priority |
|-------|-----|----------|
| **SEA** | Bryant loss, Shaheed/Jobe re-signs, $44M cap, safety now critical need, Jennings/Harris rumors | 🔴 HIGH |
| **Cap** | SEA at $44M post-signings, TEN at ~$75M despite $270M spend, SF cleared $17M via Bosa restructure, NFC West cap landscape shifted | 🔴 HIGH |
| **Defense** | Bryant loss creates safety hole, NFC West secondary arms race (Watson→LAR, Bosa→SF imminent), EDGE market reset ($120M Phillips, $100M Oweh) | 🔴 HIGH |
| **Draft** | SEA mocked for RB at #32, CB need escalated post-Bryant, ARI #3 pick trade buzz, NYJ two-first-rounder scenarios | 🟡 MEDIUM |
| **Offense** | Shaheed re-sign locks WR corps (JSN/Shaheed/Lockett?), Jennings still available, TEN's offensive overhaul for scheme comps | 🟡 MEDIUM |
| **Injury** | Crosby failed physical (market impact), Mahomes "ahead of schedule," Harris post-Achilles (SEA target), Samuel Jr. injury limiting market | 🟡 MEDIUM |
| **Analytics** | TEN $270M spend — historical comp analysis needed (2020 Bucs vs 2022 Jags), PIT win-now build ROI modeling | 🟢 LOW |
| **PlayerRep** | Shaheed $17M AAV valuation, Jobe $8M AAV valuation, Jennings projected $12-16M AAV if SEA pursues | 🟢 LOW |

### ⚠️ CRITICAL: User Directive — No Political Topics (2026-03-15)

**Note from Joe Robinson (via Copilot):** Avoid all politically divisive topics in content. Specifically: do NOT reference or analyze state/federal tax legislation (e.g., WA SB 6346), political bills, or anything construed as taking a political stance. Applies to all article ideas, discussion prompts, panel discussions, drafts, and analyses.

**Impact on JSN panel:** WA tax mechanics were identified as a key finding in the discussion panel (completed before this directive). Discussion summary must be revised to remove tax references before Writer stage. This is non-blocking for decision/log merge but must be resolved before draft production.

---

**Session log merged:** 2026-03-15 13:09:08  
**Decisions merged:** 6 inbox files (discussion_path field, intel brief, article candidates, league-wide intel, SEA intel, political topics directive)  
**Inbox status:** Empty

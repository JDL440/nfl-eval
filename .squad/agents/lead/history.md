# Lead — Lead / GM Analyst History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Data Sources:** overthecap.com, spotrac.com, ESPN/NFL.com, PFR, PFF, The Athletic, mock draft sites
- **Rumor Mode:** Dual-track (⚠️ RUMOR inline + separate track)

## Prior Context Summary (2026-03-12 through 2026-03-14)

**Data Source Viability (2026-03-12):**
- ✅ OTC (cap, player contracts), Spotrac (free agents), ESPN (roster/depth/transactions), NFL.com (UFA/RFA flags) all work via web_fetch
- 🔴 PFR blocks automated access (HTTP 403)
- ✅ Key discovery: Spotrac is the only source for FA tracking; ESPN depth reveals scheme formations; max_length must be 8000-15000 for roster/cap pages
- 2026 cap: $301.2M

**Agents & Skills Created (2026-03-12):**
- Media (rumors/intel), Analytics (EPA/DVOA/efficiency), CollegeScout (prospect eval), PlayerRep (player advocate/CBA)
- 4 data skills created: OTC patterns, Spotrac FA tracking, NFL roster research, knowledge recording format

**Article Automation Proposal (2026-03-14):**
- Phase 2 architecture: State machine (6 states), BullMQ job queues, hybrid scheduling (Actions + BullMQ), significance scoring, cost model (~$3.20/article)
- Phase 1 validation: Editorial model works, Editor catches errors, ~2-3 hrs per article
- Article Lifecycle Skill (8-stage workflow) codified: Discussion Prompt (Stage 2) as required pre-panel artifact; Publisher Pass (Stage 7) for metadata/scheduling; panel composition rules (2–5 agents, always team + specialist)

---

## Learnings

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

### Article Discussion Workflow — First End-to-End Run (2026-03-15)

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

### CONTENT CONSTRAINT (2026-03-15)

CONTENT CONSTRAINT (2026-03-15): Politically divisive topics are strictly off-limits. This includes all tax legislation references (WA SB 6346, millionaires tax, state income tax), political bills, and any political angles. Remove from existing content, never add to future content. This was flagged during JSN panel synthesis.

**Action taken:** Revised all 4 JSN panel position files (cap, playerrep, sea, offense) and rewrote the discussion-summary.md to replace tax/political arguments with legitimate football and business arguments (injury protection, front-loading for cash-flow, cap efficiency, standard big-market signing bonus structures). Offense file was already clean — no changes needed.

---

### Knowledge Propagation Pattern — Implemented (2026-03-15)

**Task:** Per Joe Robinson directive, designed and implemented the knowledge propagation pattern for cross-agent knowledge updates.

**What was built:**

1. **`.squad/skills/knowledge-propagation/SKILL.md`** — Mandatory read skill defining:
   - Knowledge inbox pattern (`.squad/knowledge/inbox/`)
   - Drop file format (From/Target/Section/Content/Why)
   - Routing rules for agent:{name}, team.md, charter:{name}, decisions.md
   - Clear distinction between knowledge inbox (factual updates) vs decisions inbox (team-level decisions)

2. **Scribe charter updated** — Added new step 4 (process knowledge inbox):
   - Routes drops to target files (appends to specified sections)
   - Charter updates are flagged (`.squad/knowledge/charter-flags/`) not applied directly
   - Deletes processed inbox files
   - Logs each routed update
   - Updated memory architecture diagram to show knowledge/ directory structure

3. **Directory structure created:**
   - `.squad/knowledge/inbox/` (drop-box for cross-agent knowledge)
   - `.squad/knowledge/charter-flags/` (proposed charter updates)

4. **Decision filed:** `.squad/decisions/inbox/lead-knowledge-propagation.md` — Pattern adoption decision

**Why this matters:** Previously, agents had no structured way to propagate knowledge OUTSIDE their domain. Discoveries stayed siloed in their own history.md or got lost. This pattern enforces the same drop-box discipline for knowledge that already exists for decisions, with proper routing and audit trails.

**Pattern distinction:**
- **Decisions inbox** = team-level decisions (architecture, process, scope, constraints)
- **Knowledge inbox** = factual updates to specific files (content appended to specific sections)

**Next dependency:** All agents must read the knowledge-propagation skill before starting work to understand when and how to use the inbox.


📌 Team update (2026-03-15T21:45:00Z): Knowledge Propagation Pattern adopted — all agents route cross-team knowledge to .squad/knowledge/inbox/ for Scribe processing. Prevents silos. Decided by: Lead (Joe Robinson directive)

### Image Generation Quality Control — Duplicate Detection (2026-03-15)

**Finding:** First published article had two inline images that were bit-for-bit identical (same MD5 hash). The image generator cached a result and saved it twice under different filenames. Neither Writer nor Editor caught this — both were focused on visual inspection, and two different filenames appeared to mean two different images.

**Root cause:** AI image generation tools (Imagen, Gemini) sometimes cache results. If the prompt or random seed is sufficiently similar, the exact same image bytes are returned. Saving to a new filename masks the duplication.

**Prevention implemented:**
- New section in `image-generation/SKILL.md`: "Uniqueness Check (Required Before Publishing)" — mandates PowerShell hash verification before publication
- Command: `Get-FileHash content/images/{slug}/*.png -Algorithm MD5 | Select-Object Hash, Path`
- Rule: Any two images with identical hashes must be rejected and regenerated immediately
- Audit requirement: Log hashes in Editor's image review report for traceability

**Updated skills:**
- `.squad/skills/image-generation/SKILL.md` — Added Uniqueness Check section with hash verification process
- `.squad/skills/image-review/SKILL.md` — Added duplicate check to review checklist ("Are all inline images visually distinct?")

**Decision filed:** `.squad/decisions/inbox/lead-image-uniqueness.md`

### Substack Section Routing Bug — Root Cause & Fix (2026-03-16)

**Bug:** Drafts created via the Substack publisher extension always showed an empty section in the Substack editor, despite the API reporting a non-null section ID after the PUT.

**Root cause:** Missing `section_chosen: true` field. Substack's draft model has 4 section-related fields:
- `section_id` — always null for drafts (only set on published posts)
- `draft_section_id` — the section ID for unpublished drafts ✅
- `section_chosen` — boolean flag the editor checks to determine if a section was explicitly selected ⚠️ THIS WAS THE BUG
- `syndicate_to_section_id` — cross-publication syndication (not relevant)

**What was happening:** The old code sent `section_id` + `draft_section_id` in the PUT. Substack persisted `draft_section_id = 355520` correctly, but `section_chosen` remained `null`. The Substack editor only displays the section in its dropdown when `section_chosen === true`. Without it, the editor shows "No section" even though the API has the correct ID stored.

**Secondary fix:** The old PUT also spread the full payload (`...payload` with `draft_body`, `draft_title`, etc.) into the section-assignment PUT. This was unnecessary and potentially interfering. Changed to a minimal PUT with only the 3 section fields.

**API findings from debugging:**
1. Substack **ignores** `section_id` and `draft_section_id` at POST time — both return null
2. PUT with `draft_section_id` + `section_chosen: true` is the only reliable way to assign a section
3. `section_id` remains null for all drafts — it's only populated on published posts
4. A GET after PUT is the only way to verify section persistence (PUT response echoes input)

**Code changes in `.github/extensions/substack-publisher/extension.mjs`:**
1. Changed PUT body from `{ ...payload, section_id, draft_section_id }` → `{ section_id, draft_section_id, section_chosen: true }`
2. Added integer coercion for sectionId (safety)
3. Added verification GET after PUT to confirm persistence
4. Updated output to show GET verification results including `section_chosen`

**Verification:** Test draft 191082679 created with NE Patriots section. GET confirmed `draft_section_id: 355520, section_chosen: true`.

**Decision filed:** `.squad/decisions/inbox/lead-substack-section-fix.md`

### Article Process Guards — Temporal Accuracy + TLDR Requirement (2026-03-16)

**Context:** The Drake Maye article ("Year 2 Decision Time") had two critical process failures:

1. **Temporal accuracy failure:** Article treated Maye as entering "Year 2" with Year 1 stats, when he's actually entering Year 3 of his career. Panel experts wrote analysis based on stale/wrong season context because the spawning prompts didn't specify the current NFL calendar. Agents defaulted to their training cutoff, which was one season behind.

2. **Missing TLDR:** Article published without a quick-scan summary box at the top. Every article should have a TLDR callout block (situation, assets, verdict, debate) immediately after the subtitle to help readers decide if they want to read 3,000+ words.

**Root cause:** No temporal context guards in panel spawns, no TLDR requirement in the article structure template, no verification gate in the Editor checklist.

**Process updates implemented:**

1. **`.squad/skills/substack-article/SKILL.md`:**
   - Added TLDR template to article structure (4-bullet callout block after subtitle)
   - Added "Temporal Accuracy (REQUIRED for every spawn)" subsection to Phase 2
   - All panel spawns now MUST include season context block: current year (2026), most recent completed season (2025), upcoming season (2026), explicit stat sourcing requirements

2. **`.squad/skills/article-lifecycle/SKILL.md`:**
   - Added new "Accuracy Gates" section between Stage 6 and Stage 7
   - Gate 1: Temporal Accuracy (stats from correct season, year references accurate, current offseason data)
   - Gate 2: TLDR Present (callout block required, 3-4 bullets verified by Editor)
   - Gate 3: Player/Staff Name Accuracy (no invented names, real prospects, sourced contract figures)

3. **`.squad/agents/editor/charter.md`:**
   - Added "Temporal Accuracy Checklist" subsection under Fact-Checking
   - 5 explicit checks Editor must perform on EVERY article: season stats, year references, cap data, TLDR presence, name verification

**Why this matters:** Temporal context errors destroy credibility — readers who follow the NFL closely will catch "Year 2" framing for a Year 3 player instantly. Missing TLDRs reduce engagement — busy readers scanning the site need to know if an article is worth their time. These guards prevent both failure modes from recurring.

**Decision filed:** `.squad/decisions/inbox/lead-article-process-guards.md`

### Idea Generation Process Fix — Current Data Required (2026-03-15)

**Problem:** The 30 NFL team issues were created with pre-written stale angles. Root cause: Lead was doing idea generation UP FRONT without current research, baking in assumptions from training data (at least one season out of date).

**Example failures:**
- QB situations referenced wrong year (e.g., treating 2024 starters as current when coaching changes happened in 2025)
- Cap figures from wrong offseason window
- Angles framed around "Year N" player development when the player was actually in Year N+1

**Root cause diagnosis:**
1. Batch issue creation asked Lead to generate 30 ideas all at once
2. Lead used a cheaper model (to save tokens) without fetching current data
3. The model relied on training data (last updated mid-2025 at best)
4. Stale angles got committed to GitHub issues, locking in wrong assumptions

**The fix: Issues must be generic triggers, and idea generation must happen as the FIRST STEP of the pipeline using a top model with real research.**

**Process updates implemented:**

1. **`.squad/skills/idea-generation/SKILL.md`:**
   - Updated to mandate **`claude-opus-4.6`** for all idea generation (non-negotiable)
   - Added "Current Context — REQUIRED Before Generating Any Idea" section
   - Specific data sources to fetch: OTC cap page, ESPN roster, news search for "{team} 2026 offseason"
   - "Year Accuracy Gate" checklist — confirms 2026 offseason framing, 2025 season stats, 2026 cap year
   - Clear distinction: NEW process (issue-triggered idea gen) vs. OLD process (general ideation)

2. **`.squad/agents/lead/charter.md`:**
   - Added "Step 1b: Idea Generation (when issue says 'IDEA GENERATION REQUIRED')" to GitHub Issue → Article Pipeline protocol
   - Mandates reading idea-generation skill first
   - Requires fetching current data before generating any angle
   - Must post generated idea as GitHub comment before proceeding with pipeline
   - Model requirement: ALWAYS `claude-opus-4.6` (non-negotiable)

3. **`.squad/templates/team-article-issue.md`:**
   - New template for generic team article issues
   - Issue body contains "IDEA GENERATION REQUIRED" flag instead of pre-written angle
   - Clear instruction: fetch current data, don't rely on training data alone
   - Example issue for reference (Buffalo Bills)

4. **`.squad/skills/article-lifecycle/SKILL.md`:**
   - Added "GitHub Issue-Triggered Idea Generation (NEW)" subsection to Stage 1
   - Documents the Step 1b process (read skill → fetch data → generate → comment → continue)
   - Rationale: 30-team batch revealed stale angle problem
   - Model requirement documented

**Why this matters:**
- Training data is ALWAYS at least one season behind for NFL content
- QB changes, coaching staff turnover, cap situations, draft positions all shift every offseason
- Pre-written angles lock in stale assumptions that can't be corrected mid-pipeline
- Top-tier models are necessary for idea generation because cheaper models hallucinate plausible-sounding but factually wrong angles
- Real-time research (OTC, ESPN, news) ensures current context

**Pattern:** Idea generation is NOT a bulk batch task. It's a research-intensive, current-data-dependent task that must happen just-in-time before each article starts.

**Decision filed:** `.squad/decisions/inbox/lead-idea-generation-skill.md`

### NFC West Pipeline Batch — LAR + SF Discussion Panels (2026-03-16)

**Articles advanced:** Two NFC West articles moved from idea-generation through full panel discussion in a single pass.

**Article: LAR — `lar-2026-offseason` (Issue #41)**
- **Angle:** Rams' record-breaking secondary overhaul (McDuffie $124M, Watson $51M, Curl $36M) as Stafford's last dance
- **Panel:** LAR, Cap, Defense, Draft (4 agents, Depth 2, claude-opus-4.6)
- **Consensus:** Unanimous Path 1 (Full Send). All four agents independently arrived at all-in.
- **Key debate:** OT vs. EDGE at #13. Lead synthesis: EDGE (completes defensive feedback loop).
- **Non-obvious findings:** Kingsbury hire targeting Seattle matchup; synchronized cap bomb (all three secondary contracts escalate in 2027 when Stafford exits); LB-deep class suppressing EDGE values at #13.
- **Artifacts:** discussion-prompt.md, 4 position files, discussion-summary.md

**Article: SF — `sf-2026-offseason` (Issue #42)**
- **Angle:** 49ers' two-front rebuild — Bosa brothers reunion + Evans replacing entire WR corps
- **Panel:** SF, Cap, Defense, Offense (4 agents, Depth 2, claude-opus-4.6)
- **Consensus:** Unanimous sign Joey Bosa. Path 2 (Joey + draft EDGE insurance) from 3 of 4 agents.
- **Key debate:** #27 pick — EDGE/IDL insurance vs. OT succession for Williams (38, $38M+).
- **Non-obvious findings:** Morris' 3-4 scheme eases Bosa ACL return; Evans deal at $0 GTD is smartest contract of offseason; Jennings loss > Aiyuk loss for on-field impact; dead money clearing in 2027 is SF's lifeline.
- **Artifacts:** discussion-prompt.md, 4 position files, discussion-summary.md

**What worked:**
- Running 8 panel agents in parallel (4 per article) kept wall time under ~4 minutes per panel
- Both discussion prompts built with specific data anchors produced sharp, disagreement-generating positions
- Per-panelist focus instructions prevented overlap (no duplicate analysis between Cap and team agents)
- The skill template (article-discussion) held up across two different article structures

**Pattern confirmed:**
- Batch processing works for NFC West pipeline — running 2 articles simultaneously with parallel panels is efficient and produces quality output
- Depth Level 2 panels (4 agents each) hit the sweet spot: enough perspectives for tension without redundancy
- The "competing emergencies" framing (e.g., EDGE vs. OT at #27 for SF) creates natural article tension better than single-issue prompts

### Batch Issue Creation — Remaining Divisions (2026-03-16)

Created 28 generic article issues (#43–#69) for all remaining NFL teams beyond NFC West, using the same template as #40–#42. Labels: `squad`, `squad:lead`, `article`. All include `IDEA GENERATION REQUIRED` at Depth Level 2.

**Issues by division:**
- **AFC East:** BUF #43, MIA #44, NYJ #45 (skipped NE — already generated per Joe)
- **AFC North:** BAL #46, CIN #47, CLE #48, PIT #49
- **AFC South:** HOU #50, IND #51, JAX #52, TEN #53
- **AFC West:** DEN #54, KC #55, LAC #56, LV #57
- **NFC East:** DAL #58, NYG #59, PHI #60, WAS #61
- **NFC North:** CHI #62, DET #63, GB #64, MIN #65
- **NFC South:** ATL #66, CAR #67, NO #68, TB #69

**Skipped teams:**
- **NE** — Joe confirmed already generated
- **SEA** — Home team; not included in NFC West batch (#40–42) either; gets dedicated treatment

**Pattern:** GH CLI batch creation via Python loop with 0.5s delay works cleanly for 28 issues. Template string substitution (ABBR + full name) keeps formatting consistent. All old-format issues (#9–39, closed) are superseded by these generic pipeline starters.

### Publishing: Sections → Tags Migration (2026-03-16)

**Change:** Removed Substack section assignment and byline metadata from the publisher extension. Replaced with `postTags` — each draft is now tagged with the team name + any participating specialist agents.

**Why:**
- Sections: Joe discovered that per-team sections aren't the right Substack taxonomy. Tags are the correct organizing mechanism.
- Bylines: `draft_bylines` payload was breaking draft creation. Clearing it fixes the issue.

**Tag convention:**
- Team tag: full team name as-is (e.g. "San Francisco 49ers")
- Specialist tags: agent role from position/panel filenames, title-cased (e.g. "Cap", "Offense", "Defense")
- Derived automatically from article directory artifacts; no manual input needed

**What was removed:**
- `getSectionId()` function and all section lookup/PUT/verify logic
- `draft_bylines` / `authorId` from draft payload
- Section-related success output (replaced with tag report)

**Files changed:**
- `.github/extensions/substack-publisher/extension.mjs` — core code changes
- `.squad/skills/substack-publishing/SKILL.md` — updated to reflect tags instead of sections
- `.squad/skills/publisher/SKILL.md` — updated checklist and tool call docs
- `.squad/skills/substack-article/SKILL.md` — updated publishing description
- `.squad/skills/article-lifecycle/SKILL.md` — updated Stage 7/8 references

**Validated:** `node --check` syntax pass + functional tag derivation test against real article directories (sf-2026-offseason, ari-2026-offseason).

### README.md Documentation Update — Publishing Behavior (2026-03-17)

**Task:** Fix stale README lines that incorrectly described automated publishing as routing drafts to team sections with bylines.

**Lines updated (L139–L141 in "What's Next" roadmap section):**

**OLD:**
```
- [x] **Automated publishing** — `publish_to_substack` Copilot extension creates Substack drafts directly from article markdown files, routed to the correct team section
- [x] **MCP servers / extensions** — `publish_to_substack` Copilot extension (`.github/extensions/substack-publisher/`) enables automated Substack publishing
- [x] **32-team sections** — All NFL teams have dedicated Substack sections with official brand colors on both `nfllab` and `nfllabstage`
```

**NEW:**
```
- [x] **Automated publishing** — `publish_to_substack` Copilot extension creates Substack drafts directly from article markdown files, tagged with team + specialist tags for categorization
- [x] **MCP servers / extensions** — `publish_to_substack` Copilot extension (`.github/extensions/substack-publisher/`) enables automated Substack publishing with tag-based routing
- [x] **32-team sections** — All NFL teams have dedicated Substack sections with official brand colors on both `nfllab` and `nfllabstage`
```

**Rationale:** The deprecated "routed to the correct team section" language implied automatic section assignment. Current behavior is tag-based publishing (no section routing, no bylines). The updated text accurately reflects the operational reality: drafts are tagged with team name + specialist agent roles for Substack categorization.

**Decision filed:** `.squad/decisions/inbox/lead-readme-publish-tags.md`

### Republish: NE Patriots / Drake Maye Draft (2026-03-17)

**Request:** Joe asked to republish `content/articles/ne-maye-year2-offseason/draft.md` to verify the updated Substack publisher behavior (tags instead of sections, no bylines).

**Result:** ✅ Draft created successfully.
- **Draft ID:** 191093154
- **Draft URL:** https://nfllab.substack.com/publish/post/191093154
- **Tags applied:** New England Patriots, Cap, Draft, Offense
- **Title:** The Patriots Have ~$44 Million, the #31 Pick, and a Franchise QB on a Rookie Deal. Our Expert Panel Can't Agree on What to Do Next.

**Finding:** The Substack API requires `draft_bylines: []` to be explicitly sent in the POST payload — omitting the field entirely triggers a 400 error (`"Invalid value"` for `draft_bylines`). The extension.mjs currently does NOT include this field. This needs to be patched in the extension for the Copilot SDK path to work correctly.

**Extension fix needed:** Add `draft_bylines: []` to the `createSubstackDraft` payload in `.github/extensions/substack-publisher/extension.mjs`.

### AFC East Batch — Issues #43 (BUF), #44 (MIA), #45 (NYJ) — 2026-03-16

**Batch approach:** Processed 3 generic "IDEA GENERATION REQUIRED" issues in one session. Used web_search for real-time research per team (cap, roster, season results, coaching, draft picks), generated ideas with current 2026 offseason data, then advanced the strongest article.

**Ideas generated (all scored 8+):**

| Issue | Team | Article Slug | Score | Stage Reached |
|-------|------|-------------|-------|---------------|
| #43 | BUF | `buf-2026-offseason` | 10/12 | idea |
| #44 | MIA | `mia-tua-dead-cap-rebuild` | 12/12 | panel-ready |
| #45 | NYJ | `nyj-two-firsts-qb-decision` | 11/12 | idea |

**MIA advanced furthest:** The $99.2M dead cap story scored a perfect 12/12 — historic event, unprecedented constraints, new regime, broad NFL interest. Discussion prompt written with 4 paths (Rams/Texans/GB/Hail Mary models) and data anchors (dead cap comps table, cap landscape, draft capital, young core). Panel composed: Cap + MIA + Draft (3 agents, Level 2).

**What worked:**
- Batching 3 issues in one session is efficient — parallel research, shared context on AFC East dynamics
- web_search produces enough current data for idea generation without needing web_fetch on OTC/ESPN pages directly
- Creating pipeline stage labels (`stage:idea`, `stage:discussion-prompt`, `stage:panel-ready`) makes the board much more readable than relying only on `go:*` labels
- Scoring ideas (10, 12, 11) made the "which to advance?" decision obvious — MIA was clearly the strongest

**What to watch:**
- BUF and NYJ still need discussion prompts — they're at `stage:idea` with `go:yes`
- MIA panel is ready to run (3 agents, all prompts written) — next session should spawn the panel
- The 4-path structure for MIA (Rams/Texans/GB/Hail Mary) gives the panel concrete options to evaluate, not vague "rebuild" talk

### Social Link Image — Backlog Item Created (2026-03-17)

**Request:** Joe corrected an earlier preference — he likes the **social link image** (not the cover image) from the Witherspoon article (`witherspoon-extension-v2`). Asked for an unassigned backlog item to track future social image improvements.

**Duplicate check:** Searched open issues for "social image", "social link image", "og:image" — none found.

**Action:** Created GitHub issue **#70** — *"Improve social link image generation for Substack articles"*
- **URL:** https://github.com/JDL440/nfl-eval/issues/70

### Substack Notes Research — Issue Filed (2025-07-25)

**Request:** Joe asked Lead to file a research issue for incorporating Substack Notes into the article workflow, focused on timing Notes for maximum viewership and subscriber conversion.

**Context check:** No existing issues on Substack Notes. Current pipeline (8 stages, article-lifecycle skill) covers article drafting → Substack draft → Joe publishes. Notes are not part of the workflow at all.

**Action:** Created GitHub issue **#72** — *"Research: Incorporate Substack Notes into article workflow for maximum discovery & subscriber conversion"*
- **URL:** https://github.com/JDL440/nfl-eval/issues/72
- **Labels:** `enhancement`, `squad`, `squad:lead`
- **Decision filed:** `.squad/decisions/inbox/lead-substack-notes-research.md`

**Key research angles proposed:**
1. Pre-publish teaser Notes (1–2 days before) — drives discovery/anticipation
2. Launch-day Notes (same day as article) — direct subscriber conversion
3. Post-publish discussion Notes (1–2 days after) — extends article lifecycle, paid conversion
4. Compound strategy (all three) — maximum touchpoints, best for initial testing
5. Standalone Notes (not tied to articles) — long-term follower growth between publishes

**Experiment plan:** 4-article compound campaign with metrics (impressions, click-through, new subs, paid conversion rate). A/B test teaser vs. no-teaser across matched pairs.

**Open question:** Whether Substack Notes has an API or is manual-only — determines if this can be automated via the pipeline or needs a checklist/template approach.
- **Label:** `enhancement` (no `squad` labels — avoids auto-routing/assignment)
- **Assignee:** none (backlog only, per user request)
- **Style reference:** Witherspoon article social link preview flagged as the target aesthetic

**Decision filed:** `.squad/decisions/inbox/lead-social-image-backlog.md`



### Witherspoon Extension V2 — Article Refresh from Original Source (2026-03-15)

**Request:** Joe asked to regenerate the Witherspoon extension article from original source artifacts.

**Source artifact findings:**
- **Original article exists:** `content/articles/witherspoon-extension-cap-vs-agent.md` (published 2026-03-14, Article #2)
- **No structured pipeline artifacts exist:** This was a pre-pipeline article — no discussion-prompt, position files, or discussion-summary were ever created. It predates the Article Lifecycle skill.
- **Idea entry:** One line in `content/article-ideas.md` (line 14) — agents: Cap, PlayerRep, SEA
- **DB seed:** `content/init_db.py` has the article record with slug and metadata

**Action taken:**
- Used the published article as source material (premise, data anchors, expert positions, market comps)
- Created full pipeline artifacts in `content/articles/witherspoon-extension-v2/`:
  - `discussion-prompt.md` — reconstructed from original data
  - `cap-position.md` — fresh Cap panel position (441 words)
  - `playerrep-position.md` — fresh PlayerRep panel position (500 words)
  - `sea-position.md` — fresh SEA panel position (450 words)
  - `discussion-summary.md` — Lead synthesis
  - `draft.md` — complete fresh article (~3,300 words)

**Key changes from v1:**
- Removed all WA tax legislation references (SB 6346, 9.9% millionaires tax) per content constraint
- Added TLDR section per current article standards
- Narrowed the AAV gap: v1 had $27M vs ; v2 panel converged to $30.5M vs .5M — more realistic post-McDuffie
- Guarantee fight surfaced as the real tension (v1 focused more on AAV; v2 identifies guarantees as the actual battlefield)
- PlayerRep's non-obvious insight (5th-year option strengthens the player's hand) is a stronger argument than v1's tax angle

**Learning:** Pre-pipeline articles (Articles 1-2) have no structured artifacts. When refreshing them, the published article itself IS the source material. The pipeline structure (discussion-prompt → positions → synthesis → draft) can be reconstructed retroactively.

---

### AFC North Batch — Issues #46-#49 (2026-03-16)

**Batch:** BAL (#46), CIN (#47), CLE (#48), PIT (#49)
**All four issues** entered as template-state "IDEA GENERATION REQUIRED" with `go:needs-research` label.

#### Research Findings (all four teams)

| Team | Key Storyline | Score |
|------|--------------|-------|
| **BAL** | Traded 2026+2027 1st-round picks for Maxx Crosby ($106.5M). New HC Jesse Minter after Harbaugh firing. Only 30 sacks in 2025 (league-worst). Linderbaum + Likely hitting FA. | 11/12 |
| **PIT** | Built $59M WR room (Pittman + Metcalf) for Rodgers — who might retire. McCarthy replaced Tomlin. 10-6 AFC North champs in 2025. Only Rudolph + Howard under contract at QB. | 11/12 |
| **CIN** | Let Hendrickson (4x Pro Bowl, 17.5-sack seasons) walk. Burrow's 3rd straight playoff miss at 6-11. Signed Cook/Mafe/Allen as volume defense replacements. $48M Burrow cap hit. | 10/12 |
| **CLE** | Monken hired from BAL. Three-QB competition (Watson/Sanders/Gabriel). $93M+ O-line spending. Two 1st-round picks (#6 + #24). Watson returning from Achilles. | 10/12 |

#### Actions Taken

1. **All four issues:** Generated ideas with current 2026 offseason data, posted structured idea comments (matching #40/#45 format), created `content/articles/{team}-2026-offseason/idea.md` folders, updated labels from `go:needs-research` → `go:yes` + `stage:idea`

2. **BAL #46 pushed to Stage 2:** Wrote full discussion prompt (`content/articles/bal-2026-offseason/discussion-prompt.md`) with three cap scenarios, Crosby trade math as central question, and BAL + Cap + Defense panel. Updated label to `stage:discussion-prompt`.

3. **Pipeline priority:** BAL #46 recommended as next to advance (richest data, clearest tension engine, most analytically interesting for The Beat depth level)

#### Learnings

- **Batch workflow efficiency:** Researching all 4 teams in parallel via web_search, then writing all ideas simultaneously, then posting all comments — significantly faster than sequential processing. ~15 min for 4 ideas vs. prior single-issue sessions.
- **AFC North has two 11/12 ideas (BAL, PIT):** Both have time-sensitive hooks (Crosby trade just happened; Rodgers decision pending). CIN and CLE are strong but slightly less urgent.
- **Crosby trade creates cross-division angle:** The same trade appears in both BAL #46 (buyer side) and LV #57 (seller side — "Crosby Paradox" angle already generated). Could cross-reference.
- **Rodgers will-he-won't-he is perishable:** PIT #49's angle expires when Rodgers decides. If he announces retirement or signs, the article framing must shift. Flag for priority if decision appears imminent.

---

## Session: Retarget Ralph Loop for NFL Article Pipeline

**Date:** 2026-03-15
**Task:** Retarget the github-copilot-ralph-loop repo from .NET Hello World demo to drive nfl-eval's team-article backlog.

**What changed (in github-copilot-ralph-loop):**
- **ralph.ps1** — Added `-TargetRepo` param (defaults to sibling `../nfl-eval`). Script now `Set-Location` into nfl-eval so Copilot CLI sees .squad/, content/, etc. Changed default model to `claude-sonnet-4.5`. Timeout raised to 900s. Progress file fields renamed from stories to items.
- **ralph/prompt.md** — Complete rewrite. Instructs Copilot CLI to act as Lead, pick the next team article issue (#40-#69), advance it one pipeline stage (8-stage lifecycle), commit, and exit. Includes backlog priority rules, stage-by-stage guidance, and all critical file references.
- **ralph/prd.json** — Replaced Hello World user stories with NFL article pipeline definition: 8 stages, done criteria per stage, issue label mappings, and completion criteria (all 30 issues at stage 7+).
- **ralph/AGENTS.md** — Replaced .NET project context with nfl-eval agent roster, pipeline overview, content structure, conventions, and error handling guidance.
- **readme.md** — Full rewrite documenting the NFL article pipeline driver, quick start, parameters, prerequisites, and 8-stage table.

**Backlog selection logic (assumption made):**
1. Finish mid-pipeline articles first (avoid half-done work)
2. `go:yes` issues next (already approved: #40 ARI, #43 BUF, #44 MIA, #45 NYJ)
3. `go:needs-research` issues last (26 teams needing idea generation)
4. Tie-break by issue number ascending

**Validation performed:**
- PowerShell syntax check: zero parse errors
- JSON validation: prd.json is valid
- Residual scan: no Hello World / .NET / C# references remain
- Script logic verified: Set-Location targets TargetRepo, model and banner updated
- No live execution against nfl-eval (constraint honored)

**Learning:** The Ralph loop pattern is repo-agnostic by design — the key is that Set-Location puts Copilot CLI inside the target repo so it sees the right context files. The prompt.md is the real "controller" that determines what Copilot does each iteration.

📌 Team update (2026-03-16T04:36:50Z): 3 orchestration logs created, 1 session log created. 12 inbox decisions merged to decisions.md. Editor approved Witherspoon v2. BUF/NYJ discussion prompts advanced.

## Panel: seahawks-rb-pick64-v2 (Issue #71)

📌 **Team update (2026-03-16T07:49:26Z):** RB at #64 evaluation complete. Consensus: Pass on RB due to CB/EDGE priority, despite scheme preference and manageable medical risk. Decision drivers: positional hierarchy (SEA), fair value not a steal (CollegeScout), insufficient medical urgency alone (Injury), scheme preference overridden (Offense).

---

## Session: Seahawks RB Pick #64 v2 — Discussion Summary
**Date:** 2026-03-16
**Task:** Synthesize Stage 4 panel discussion into discussion-summary.md for issue #71.
**Panel:** SEA, Injury, CollegeScout, Offense (4 agents).
**Outcome:** 1 firm no (SEA), 2 conditionals (Injury, CollegeScout), 1 firm yes (Offense). Lead called Path 2 hybrid — redirect #64 to EDGE/CB, address RB at #96 or veteran market. Core disagreement: need severity vs. scheme survival. v1's "steal" narrative debunked by CollegeScout (ADP risen to ~53-58). Writer handoff includes headline direction, narrative tension, overclaim guardrails, and 5 key takeaways.

## Learnings
- **Disagreement framing matters more than resolution.** The 3-vs-1 split was clear, but the article is stronger because Offense's dissent is preserved and respected. Don't flatten minority positions — they create the narrative tension Writer needs.
- **v1→v2 regeneration benefits from explicitly killing dead narratives.** CollegeScout's correction of the "first-round talent at a discount" framing was the panel's sharpest contribution. Writer needs explicit permission to abandon v1 claims.
- **Medical timelines are the emotional engine, not the logical engine.** Injury's coin-flip framing (35-45% Week 1) creates urgency the reader feels, even though the Lead call is to address RB elsewhere. Let the urgency breathe in the article while the logic redirects the pick.

### Ralph Maximum Parallel Throughput Rule (2025-07-25)

**Task:** Codify the proven parallel execution patterns into an explicit Ralph operating rule, replacing the original "one stage per iteration" constraint.

**Evidence reviewed:**
- NFC West parallel panel: 8 agents, ~4 min, zero quality loss (Approved decision, 2026-03-16)
- AFC North batch: 4 teams researched in parallel, ~15 min vs. ~60 min serial (history entry)
- NFC West publish wave: Writer + Editor + Panel running cross-stage simultaneously (2026-03-17)
- User directive: "Max out parallel throughput … no artificial caps; only block on real dependencies"

**What was delivered:**
1. Decision proposal: `.squad/decisions/inbox/lead-ralph-max-throughput.md` — full operating spec with 6 concrete principles (fan-out by stage, saturate downstream lanes, serialize only on real dependencies, batch same-stage work, no agent cap, multi-article iteration accounting).
2. Updated `.squad/identity/now.md` — session focus shifted from "interactive article creation" to "maximum-throughput Ralph pipeline."

**Key learning:** The "one stage per iteration" rule was correct for initial pipeline validation but became the primary bottleneck once the pattern was proven. Parallel execution is cost-neutral (same total tokens) but cuts wall-clock time by 3-4×. The only real serialization constraint is intra-article stage ordering — cross-article work is always independent.

### State/Reconciliation Core Implementation (2026-03-16)

**Task:** Implement shared state layer + artifact-first reconciliation for article orchestration.

**Architecture decisions:**
- `content/pipeline_state.py` is the single write gateway for all pipeline.db mutations. Validates numeric stages (1-8), logs stage_transitions, handles editor reviews, publisher pass, and publish confirmation.
- `content/article_board.py` infers true article stage from local artifacts using strict precedence: publisher-pass.md > editor-review.md > draft.md > discussion-summary > panel outputs > idea.md > DB fallback. Includes dry-run reconciliation and `--repair` mode.
- Ralph prompt rewritten from one-at-a-time to sweep-all-unblocked-lanes. Uses artifact-first discovery, not label-first selection.
- Labels remain visibility mirrors, not scheduler inputs.
- Publisher extension writeback intentionally left as TODO — calling agent uses pipeline_state.py after extension returns. Avoids cross-process DB conflicts.

**Key file paths:**
- `content/pipeline_state.py` — shared DB write helper
- `content/article_board.py` — artifact-first board reader + reconciler
- `ralph/prompt.md` — autonomous sweep prompt (max-throughput)
- `.github/workflows/squad-heartbeat.yml` — now includes pipeline reconciliation step

**Reconciliation findings (dry-run):**
- 38 discrepancies detected: 1 string-valued stage (jsn-extension-preview), 3 stage drifts (buf, mia, seahawks-rb-pick64-v2), 26 missing DB rows, 2 missing editor reviews
- Board correctly infers stage for all 38 article directories
- Editor verdict parsing covers: `## Verdict: [emoji] VERDICT`, `### [emoji] VERDICT`, `**VERDICT**` patterns

**Pattern:** When building pipeline state helpers, separate reads (article_board.py) from writes (pipeline_state.py) and make the reader filesystem-first. This prevents the common failure mode where DB is stale but the system trusts it over actual artifacts.

### Integration Pass (2026-03-16)

**Scope:** Coherence pass across pipeline_state.py consumers + heartbeat + extension.

**Changes made (4 files):**
1. `content/update_jsn.py` — Migrated from raw SQL/string stages to PipelineState helper with numeric stages. Uses `advance_stage(from_stage=1, to_stage=2)` and `repair_string_stage()` for safety.
2. `content/set_discussion_path.py` — Migrated from raw SQL to PipelineState `set_discussion_path()` with context manager.
3. `.github/workflows/squad-heartbeat.yml` — Fixed reconciliation output parsing: was matching `⚠️`/`WARNING` but `article_board.py` actually outputs `[WARN]`/`[FIX]` prefixes. Also fixed action line counting (skips header and separator rows).
4. `.github/extensions/substack-publisher/extension.mjs` — Made stage-7/writeback path explicit: extracts article slug from file path, returns slug + concrete PipelineState writeback code block in tool output. Replaced vague TODO with actionable instructions.

**Decisions:**
- Extension still does NOT write directly to pipeline.db — conflict avoidance with Python PipelineState layer. The writeback is a structured instruction in the return value that the calling agent (Lead/Ralph) executes.
- `pipeline_state.py` and `article_board.py` left unchanged — both already coherent and safe.

**Remaining bounded gap:**
- 38 DB discrepancies exist (26 missing DB rows, 1 string stage, 3 drifts) — these are pre-existing and should be resolved by running `python content/article_board.py --repair` when ready.

📌 Team update (2026-03-16 094957): Writer completed MIA Tua article with PNG-rendered table. Dense table rendering now standard pattern for Substack publisher (density block workaround). DB writeback deferred — requires PipelineState Python layer for stage advancement. — decided by Writer


## 2026-03-16: Team Retro — Tua Publish Workflow Process Fixes

📌 **Team update (2026-03-16T16:59:13Z):** Editor completed concurrent retro on publisher-readiness friction. Key finding: dense table density rules live only in extension.mjs (invisible to upstream agents). Editor recommended two upstream checks:
1. Add table density pre-check to Publisher skill (Step 1, post-verification)
2. Add flagging rule to Editor skill (Stage 6) for dense/comparative tables

Both recommendations complement Lead's URL persistence fix (#1 priority) — together they prevent publish-time failures. **Decisions merged to decisions.md:**
- lead-tua-publish-retro.md
- editor-publisher-readiness-retro.md

**Next steps:** Approve URL persistence as immediate priority; implement upstream table audit to prevent repeated friction on future articles.



### Gemini Image Default + Substack Draft Update (2026-03-17)

**Task:** Make Gemini 3 Pro Image the default for editorial image generation; promote approved Gemini variants for MIA and DEN articles; update live Substack drafts in-place.

**What worked:**
- Mock SDK pattern (stub joinSession in node_modules) allows running the publisher extension standalone for batch draft updates
- Promoting images to canonical filenames (-inline-1/2.png) means no markdown changes needed
- The publisher extension draft_url parameter + updateSubstackDraft path works cleanly for in-place updates without creating duplicate drafts

**Key finding:**
- Gemini 3 Pro Image produces better editorial/atmospheric images than Imagen 4 Ultra for this workflow abstract, no-faces style guide. Made permanent as the default (use_model: gemini).
- The use_model enum was expanded: gemini (default), auto (Gemini then Imagen 4 fallback), imagen-4 (explicit Imagen 4).

**Cleanup pattern for image variants:**
When running A/B image tests, always name variants with a suffix (e.g., -v2-gemini). Once a winner is chosen, overwrite the canonical file and delete all variant files. This avoids markdown churn.

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



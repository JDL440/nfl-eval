# Lead's Issue Planning — Research Findings → Implementable Issues

## Research Findings Analysis

**Input:** 7 research items on Writer/Editor loop improvements  
**Context:** Article pipeline stages: Writer (Stage 4) → Editor (Stage 5) → Lead (Stage 6) → Publisher (Stage 7)  
**Constraint:** Exclude #119 (artifact-level provenance + UX badge already scoped)

---

## Issue Split & Prioritization

### Quick Wins (Implement First)

**Tier 1: Observability & Control Foundation (enablers for higher tiers)**

1. **Add structured editor blocker IDs / unresolved issue tracking**
   - Currently: Editor revisions stored as free-text summary in revision record
   - Problem: Can't programmatically identify repeated blockers; can't route by blocker type
   - Win: 1-2 day implementation (add blocker_id enum, update revision struct, add query)
   - Payoff: Unblocks items #4, #5, #6; enables data-driven routing
   - Files: src/db/schema.sql, src/db/repository.ts, src/pipeline/actions.ts

2. **Add concise unresolved-blockers list to Writer handoff prompt**
   - Currently: Writer sees only last Editor comment; no summary of what's blocking them
   - Problem: Writer often re-addresses same issues, wasting context & iterations
   - Win: Query blockers from revision history, inject into Writer prompt as 1-line summary list
   - Payoff: Faster Writer revisions; better targeting of effort
   - Dependencies: Requires structured blocker IDs from issue #1
   - Files: src/config/defaults/charters/nfl/writer.md, src/pipeline/actions.ts

3. **Route evidence-deficit editor revisions to research/data-refresh path**
   - Currently: All Editor REVISE routes back to Writer for content fix
   - Problem: Some revisions are "we need better data" not "your writing is wrong" — loops Writer pointlessly
   - Win: Add blocker_type="evidence_deficit" classifier; route to Research agent for data-gathering instead
   - Payoff: Breaks the evidence-loop-to-Writer cycle; distributes work correctly
   - Dependencies: Requires structured blocker IDs from issue #1
   - Files: src/pipeline/actions.ts, src/config/defaults/charters/nfl/editor.md, src/config/defaults/charters/nfl/researcher.md

### Medium-Term (Implement Next)

**Tier 2: Guardrails & Fallback Modes**

4. **Add explicit fallback/claim-mode after repeated failed revisions**
   - Currently: Max revision loop forces approval regardless of remaining blockers
   - Problem: Can't complete articles when evidence is truly unavailable; just force-ships broken content
   - Win: After N failed revisions, offer fallback to "opinion/analysis frame" (clearly label as such)
   - Payoff: Preserve publishability; clear UX about evidence gaps; better than force-approve
   - Dependencies: Requires structured blocker IDs from issue #1
   - Files: src/pipeline/actions.ts, src/config/defaults/charters/nfl/editor.md

5. **Treat repeated editor blockers as system-level blocked state**
   - Currently: Same blocker repeats → still loops Writer; no escalation path
   - Problem: Infinite loop on blockers that Writer can't fix (missing data, scope conflict, etc.)
   - Win: After blocker repeats 2+ times on same article, escalate to Lead for decision (reframe/abandon/wait-for-data)
   - Payoff: Prevents infinite revision loops; gives Lead visibility + decision authority
   - Dependencies: Requires structured blocker IDs from issue #1
   - Files: src/pipeline/actions.ts, src/config/defaults/charters/nfl/lead.md

### Forward-Looking (Research Phase)

**Tier 3: Writer Capability Expansion**

6. **Allow Writer targeted research/fact-checking instead of forbidding it entirely**
   - Currently: Writer is forbidden from fact-checking; must rely on Editor + Research
   - Problem: User believes this is the biggest win — Writer could self-correct mid-draft, reduce loops
   - Win: Define guardrails for Writer research (approved sources, fact-checking tools, budget)
   - Scope: Research phase to define safe tool set, cost model, and validation gates
   - Payoff: Faster drafts; fewer Editor loops; Writer more autonomous
   - Note: This is a capability/permission shift, not a quick config change — requires careful design
   - Files: src/config/defaults/charters/nfl/writer.md, src/pipeline/actions.ts (new research-access gate)

### Out of Scope (Skip)

7. ~~Improve observability around model routing / stage run metadata~~ → **Already covered by issue #119**

---

## Issue Details (Draft Bodies)

### Issue 1: Add structured editor blocker IDs / unresolved issue tracking

**Title:** Add structured editor blocker tracking instead of free-text revision summaries

**Problem:**
- Editor revisions store blocker reasons as free-text summaries in `revision_summary` field
- No way to programmatically identify repeated blockers across an article's history
- Can't route different blockers to different paths (evidence gap vs. framing vs. scope conflict)
- Dashboard and Writer have no programmatic access to "what's blocking us"

**Proposed approach:**
1. Add `blocker_type` enum to revision records: evidence_deficit | framing | scope | structural | style | other
2. Store blocker_ids as structured array alongside free-text summary
3. Query blocker history by type for repeated blocker detection
4. Expose blocker list in revision API payload so Writer/Editor/dashboard can reference it

**Acceptance criteria:**
- [ ] Schema adds blocker_type enum and blocker_ids array to article_revisions table
- [ ] Editor charter updated with guidance on classifying blockers
- [ ] Repository.getArticleRevisions() returns blocker_ids and blocker_type for each revision
- [ ] At least one test validates blocker tracking and retrieval
- [ ] Writer/Editor API payloads include blocker summary for visibility

**Implementation notes:**
- Backward compatibility: existing free-text summaries map to blocker_type=other
- Blocker_ids can reference issue numbers, named patterns, or generic descriptions
- Keep the free-text summary as fallback; blocker_type is primary for routing

---

### Issue 2: Add concise unresolved-blockers list to Writer handoff prompt

**Title:** Surface unresolved blockers summary in Writer revision prompt

**Problem:**
- Writer receives only the most recent Editor comment; no summary of repeated blockers
- Writer often re-addresses the same issue multiple times because context is hidden
- Each revision loop wastes context tokens on problems that were supposedly already fixed

**Proposed approach:**
1. Query previous revision history for blocker_ids
2. Summarize unique blockers (e.g., "Missing contract details, unclear source attribution")
3. Inject as "## Unresolved Blockers" section in Writer's REVISE prompt
4. Writer can see at a glance what's been flagged before and avoid repeating the fix

**Acceptance criteria:**
- [ ] Writer charter includes "## Unresolved Blockers" section in REVISE template
- [ ] Pipeline injects blocker summary from article revision history before Writer execution
- [ ] Blocker summary is concise (1-line per blocker, max 3-4 blockers shown)
- [ ] At least one test validates blocker injection into Writer prompt context
- [ ] Dashboard revision view shows unresolved blockers alongside current feedback

**Dependencies:**
- Requires issue #1 (structured blocker IDs)

**Implementation notes:**
- If no prior revisions, omit the section; don't create false context
- Prefer deduplicating blockers by type; group similar issues under one header
- Blocker summary should be refreshed at each revision, not cached

---

### Issue 3: Route evidence-deficit editor revisions to research/data-refresh path

**Title:** Route evidence-gap blockers to Research agent instead of looping Writer

**Problem:**
- Editor flags "missing contract data" or "unverified source" → loops back to Writer
- Writer has no access to data sources; can only rewrite with same incomplete evidence
- Creates infinite loop: Writer rewrites, Editor still has no data, REVISE repeats
- Research agent exists but is never invoked for mid-article data gathering

**Proposed approach:**
1. Editor classifies blocker as `blocker_type=evidence_deficit` during REVISE
2. Pipeline detects evidence_deficit blocker and branches to Research agent instead of Writer loop
3. Research agent gathers/verifies missing data (contract lookups, source verification, etc.)
4. Research returns enriched data context back to Writer for next revision attempt
5. Writer uses Research output to fix the article without looping on unsolvable data gaps

**Acceptance criteria:**
- [ ] Editor charter guidance for evidence_deficit classification
- [ ] Pipeline.stage5(Editor) routes evidence_deficit blockers to Research agent
- [ ] Research charter updated with "mid-article data enrichment" task
- [ ] After Research completes, Writer receives enriched data in revision prompt
- [ ] At least one integration test validates evidence-gap routing path (Editor → Research → Writer)

**Dependencies:**
- Requires issue #1 (structured blocker IDs and evidence_deficit type)

**Implementation notes:**
- Research should be non-blocking; if data cannot be found, return explicit "data unavailable" rather than failing
- Research output should be timestamped and citable so Writer can reference it
- Keep Research task bounded: specific data sources, max effort, timeout after 10 min

---

### Issue 4: Add explicit fallback/claim-mode after repeated failed revisions

**Title:** Fallback to opinion-framed mode when evidence cannot be completed

**Problem:**
- Max revision limit forces approval even when blockers remain unresolved
- Editor and Writer are stuck: evidence is missing, but approval is required anyway
- Result: either force-ship broken content or abandon the article
- No graceful fallback to "opinion/analysis" framing when evidence is insufficient

**Proposed approach:**
1. After N failed revision attempts on the same blocker, offer fallback mode
2. Lead (or Editor with Lead approval) can mark article as "opinion/analysis" with explicit caveats
3. Writer rewrites draft under opinion-framing rules (cite assumptions, clearly label speculative analysis, require transparency)
4. Editor approves opinion-framed version as a valid (but different) end state
5. Published artifact is clearly labeled "analysis" not "news," managing reader expectations

**Acceptance criteria:**
- [ ] Article_mode enum: fact_driven | opinion_analysis | mixed (with caveats)
- [ ] After N revisions on same blocker, trigger fallback prompt to Lead
- [ ] Lead can approve fallback mode and Writer receives reframe prompt
- [ ] Writer reframes draft according to opinion_analysis rules (caveats, assumptions, source clarity)
- [ ] Article and published output carry mode badge so readers know the framing
- [ ] At least two tests cover fallback path: Lead approval + Writer reframe execution

**Dependencies:**
- Requires issue #1 (blocker tracking to identify repetitions)

**Implementation notes:**
- Define N based on stage timeout or iteration count (suggest N=4 total revisions)
- Lead approval is mandatory; auto-fallback is not safe
- Opinion-framing is not a way to ship bad content; it's a way to transparently publish limited analysis
- Writer charter should include fallback reframe guidance (cite sources, state assumptions, mark speculation)

---

### Issue 5: Treat repeated editor blockers as system-level blocked state

**Title:** Escalate repeated blockers to Lead for decision instead of infinite loop

**Problem:**
- Same blocker repeats 2+ times on an article (e.g., "source unavailable," "scope conflict")
- Pipeline loops Writer → Editor → Writer → Editor endlessly
- Writer cannot fix structural or data blockers; only content-based ones
- No escalation path; no decision made; article hangs indefinitely

**Proposed approach:**
1. Pipeline tracks repeated blockers by type (evidence_deficit, scope, etc.)
2. After blocker repeats 2+ times on same article, escalate to Lead instead of looping Writer again
3. Lead reviews blocker history and decides: reframe (issue #4), wait for data, abandon, or modify scope
4. Writer executes Lead's decision (reframe, pause, etc.) rather than re-attempting same fix

**Acceptance criteria:**
- [ ] Pipeline.stage5() detects repeated blockers from revision history
- [ ] After repeat detection, article transitions to Lead review (out of Writer loop)
- [ ] Lead charter updated with guidance for escalation decisions
- [ ] Lead can choose from: reframe (→ fallback mode), pause (→ blocked state), reframe scope, abandon
- [ ] Writer receives Lead decision and executes it; no more loops on same blocker
- [ ] At least one test validates escalation path (blocker repeats 2x → Lead review)

**Dependencies:**
- Requires issue #1 (blocker tracking)
- Works well with issue #4 (fallback/reframe mode)

**Implementation notes:**
- Define "repeat" as same blocker_type appearing in 2+ consecutive revisions
- Escalation should preserve full revision history for Lead's context
- Lead decision should update article status (blocked, in_reframe, etc.) to signal the state change

---

### Issue 6: Allow Writer targeted research/fact-checking instead of forbidding it entirely

**Title:** Unbox Writer with guardrailed research/fact-checking access

**Problem:**
- Writer is forbidden from fact-checking; must rely entirely on Editor to catch errors
- User research suggests Writer self-checking could be the biggest win (fewer loops, faster drafts)
- No guardrails exist for safe Writer fact-checking; current ban is blanket prohibition
- Writer could verify claims mid-draft, self-correct, and reduce downstream revision loops

**Proposed approach:**
1. Research phase: Define approved fact-checking sources and tools (box scores, rosters, contract databases)
2. Define Writer fact-check budget (time, API calls, acceptable error rate)
3. Add guardrails: Writer can fact-check claims against predefined sources only; must cite results
4. Require Writer to flag uncertainty clearly ("unverified," "requires Editor confirmation")
5. Add regression tests for Writer fact-check usage (ensuring claims are cited, sources are approved)

**Acceptance criteria:**
- [ ] Approved sources list documented (rosters, cap databases, game stats, etc.)
- [ ] Writer charter updated with fact-checking permission and guardrails
- [ ] Writer pipeline includes optional fact-check gate with budget enforcement
- [ ] Writer is required to cite fact-check results and flag uncovered claims as uncertain
- [ ] At least two tests validate fact-check execution (approved source query + citation requirement)
- [ ] Dashboard shows Writer fact-check usage per article (source queried, claims verified, time spent)

**Dependencies:**
- Research phase required; implement after tier 1 is stable
- Requires careful scoping to avoid uncontrolled API usage or hallucination
- Suggest starting with read-only sources (rosters, cap tables, schedules) before moving to external APIs

**Implementation notes:**
- This is a capability expansion, not a quick config change
- Start with low-risk sources (internal rosters, OverTheCap, Spotrac public pages)
- Writer must mark claims as "verified," "unverified," or "uncertain" after checking
- Consider cost cap: e.g., max 3 fact-checks per draft, max 5 min total fact-check time
- Escalate unverifiable claims to Editor as explicit "needs verification" notes

---

## Prioritization Summary

### Implement in Order (Recommended)

1. **Issue #1** — Structured blocker tracking (foundation; unblocks everything else)
2. **Issue #2** — Blocker summary in Writer prompt (quick win; direct payoff)
3. **Issue #3** — Evidence-gap routing to Research (breaks infinite loops)
4. **Issue #5** — Escalate repeated blockers to Lead (safety net for system-level blocks)
5. **Issue #4** — Fallback/claim-mode (graceful degradation when evidence unavailable)
6. **Issue #6** — Writer fact-checking guardrails (capability expansion; research phase)

### Rationale

- **#1 is mandatory:** Enables data-driven routing for #3, #4, #5
- **#2 is highest ROI:** Cheaper iterations and Writer context improves immediately
- **#3 breaks a known anti-pattern:** Evidence-gap loops are expensive and visible
- **#5 prevents system hangs:** Escalation path is a safety mechanism
- **#4 provides graceful fallback:** Preserves publishability without compromising integrity
- **#6 requires research:** Capability expansion with guardrails; scope it carefully

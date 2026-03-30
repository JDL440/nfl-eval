# Ready-to-Create GitHub Issues — Writer/Editor Loop Improvements

**Status:** 6 issues drafted, tested for duplicates, ready for `gh issue create`  
**Priority:** Issues should be created in the order listed  
**Estimated effort:** 13-17 engineer-days total across 5 issues (Tier 1-4); Tier 5 is research phase  

---

## Issue 1: Add structured editor blocker tracking (FOUNDATION)

```
Title: Add structured editor blocker tracking instead of free-text revision summaries

Problem:
- Editor revisions store blocker reasons as free-text summaries in `revision_summary` field
- No way to programmatically identify repeated blockers across an article's history
- Can't route different blockers to different paths (evidence gap vs. framing vs. scope conflict)
- Dashboard and Writer have no programmatic access to "what's blocking us"

Proposed approach:
1. Add `blocker_type` enum to revision records: evidence_deficit | framing | scope | structural | style | other
2. Store blocker_ids as structured array alongside free-text summary
3. Query blocker history by type for repeated blocker detection
4. Expose blocker list in revision API payload so Writer/Editor/dashboard can reference it

Acceptance criteria:
- [ ] Schema adds blocker_type enum and blocker_ids array to article_revisions table
- [ ] Editor charter updated with guidance on classifying blockers
- [ ] Repository.getArticleRevisions() returns blocker_ids and blocker_type for each revision
- [ ] At least one test validates blocker tracking and retrieval
- [ ] Writer/Editor API payloads include blocker summary for visibility

Implementation notes:
- Backward compatibility: existing free-text summaries map to blocker_type=other
- Blocker_ids can reference issue numbers, named patterns, or generic descriptions
- Keep the free-text summary as fallback; blocker_type is primary for routing
- Estimated effort: 1-2 days
```

---

## Issue 2: Add concise unresolved-blockers list to Writer handoff prompt

```
Title: Surface unresolved blockers summary in Writer revision prompt

Problem:
- Writer receives only the most recent Editor comment; no summary of repeated blockers
- Writer often re-addresses the same issue multiple times because context is hidden
- Each revision loop wastes context tokens on problems that were supposedly already fixed

Proposed approach:
1. Query previous revision history for blocker_ids
2. Summarize unique blockers (e.g., "Missing contract details, unclear source attribution")
3. Inject as "## Unresolved Blockers" section in Writer's REVISE prompt
4. Writer can see at a glance what's been flagged before and avoid repeating the fix

Acceptance criteria:
- [ ] Writer charter includes "## Unresolved Blockers" section in REVISE template
- [ ] Pipeline injects blocker summary from article revision history before Writer execution
- [ ] Blocker summary is concise (1-line per blocker, max 3-4 blockers shown)
- [ ] At least one test validates blocker injection into Writer prompt context
- [ ] Dashboard revision view shows unresolved blockers alongside current feedback

Dependencies:
- Requires issue #1 (structured blocker IDs)

Implementation notes:
- If no prior revisions, omit the section; don't create false context
- Prefer deduplicating blockers by type; group similar issues under one header
- Blocker summary should be refreshed at each revision, not cached
- Estimated effort: 1-2 days
```

---

## Issue 3: Route evidence-deficit editor revisions to research/data-refresh path

```
Title: Route evidence-gap blockers to Research agent instead of looping Writer

Problem:
- Editor flags "missing contract data" or "unverified source" → loops back to Writer
- Writer has no access to data sources; can only rewrite with same incomplete evidence
- Creates infinite loop: Writer rewrites, Editor still has no data, REVISE repeats
- Research agent exists but is never invoked for mid-article data gathering

Proposed approach:
1. Editor classifies blocker as `blocker_type=evidence_deficit` during REVISE
2. Pipeline detects evidence_deficit blocker and branches to Research agent instead of Writer loop
3. Research agent gathers/verifies missing data (contract lookups, source verification, etc.)
4. Research returns enriched data context back to Writer for next revision attempt
5. Writer uses Research output to fix the article without looping on unsolvable data gaps

Acceptance criteria:
- [ ] Editor charter guidance for evidence_deficit classification
- [ ] Pipeline.stage5(Editor) routes evidence_deficit blockers to Research agent
- [ ] Research charter updated with "mid-article data enrichment" task
- [ ] After Research completes, Writer receives enriched data in revision prompt
- [ ] At least one integration test validates evidence-gap routing path (Editor → Research → Writer)

Dependencies:
- Requires issue #1 (structured blocker IDs and evidence_deficit type)

Implementation notes:
- Research should be non-blocking; if data cannot be found, return explicit "data unavailable" rather than failing
- Research output should be timestamped and citable so Writer can reference it
- Keep Research task bounded: specific data sources, max effort, timeout after 10 min
- Estimated effort: 2-3 days
```

---

## Issue 4: Add explicit fallback/claim-mode after repeated failed revisions

```
Title: Fallback to opinion-framed mode when evidence cannot be completed

Problem:
- Max revision limit forces approval even when blockers remain unresolved
- Editor and Writer are stuck: evidence is missing, but approval is required anyway
- Result: either force-ship broken content or abandon the article
- No graceful fallback to "opinion/analysis" framing when evidence is insufficient

Proposed approach:
1. After N failed revision attempts on the same blocker, offer fallback mode
2. Lead (or Editor with Lead approval) can mark article as "opinion/analysis" with explicit caveats
3. Writer rewrites draft under opinion-framing rules (cite assumptions, clearly label speculative analysis, require transparency)
4. Editor approves opinion-framed version as a valid (but different) end state
5. Published artifact is clearly labeled "analysis" not "news," managing reader expectations

Acceptance criteria:
- [ ] Article_mode enum: fact_driven | opinion_analysis | mixed (with caveats)
- [ ] After N revisions on same blocker, trigger fallback prompt to Lead
- [ ] Lead can approve fallback mode and Writer receives reframe prompt
- [ ] Writer reframes draft according to opinion_analysis rules (caveats, assumptions, source clarity)
- [ ] Article and published output carry mode badge so readers know the framing
- [ ] At least two tests cover fallback path: Lead approval + Writer reframe execution

Dependencies:
- Requires issue #1 (blocker tracking to identify repetitions)

Implementation notes:
- Define N based on stage timeout or iteration count (suggest N=4 total revisions)
- Lead approval is mandatory; auto-fallback is not safe
- Opinion-framing is not a way to ship bad content; it's a way to transparently publish limited analysis
- Writer charter should include fallback reframe guidance (cite sources, state assumptions, mark speculation)
- Estimated effort: 2-3 days
```

---

## Issue 5: Treat repeated editor blockers as system-level blocked state

```
Title: Escalate repeated blockers to Lead for decision instead of infinite loop

Problem:
- Same blocker repeats 2+ times on an article (e.g., "source unavailable," "scope conflict")
- Pipeline loops Writer → Editor → Writer → Editor endlessly
- Writer cannot fix structural or data blockers; only content-based ones
- No escalation path; no decision made; article hangs indefinitely

Proposed approach:
1. Pipeline tracks repeated blockers by type (evidence_deficit, scope, etc.)
2. After blocker repeats 2+ times on same article, escalate to Lead instead of looping Writer again
3. Lead reviews blocker history and decides: reframe (issue #4), wait for data, abandon, or modify scope
4. Writer executes Lead's decision (reframe, pause, etc.) rather than re-attempting same fix

Acceptance criteria:
- [ ] Pipeline.stage5() detects repeated blockers from revision history
- [ ] After repeat detection, article transitions to Lead review (out of Writer loop)
- [ ] Lead charter updated with guidance for escalation decisions
- [ ] Lead can choose from: reframe (→ fallback mode), pause (→ blocked state), reframe scope, abandon
- [ ] Writer receives Lead decision and executes it; no more loops on same blocker
- [ ] At least one test validates escalation path (blocker repeats 2x → Lead review)

Dependencies:
- Requires issue #1 (blocker tracking)
- Works well with issue #4 (fallback/reframe mode)

Implementation notes:
- Define "repeat" as same blocker_type appearing in 2+ consecutive revisions
- Escalation should preserve full revision history for Lead's context
- Lead decision should update article status (blocked, in_reframe, etc.) to signal the state change
- Estimated effort: 2-3 days
```

---

## Issue 6: Allow Writer targeted research/fact-checking instead of forbidding it entirely

```
Title: Unbox Writer with guardrailed research/fact-checking access

Problem:
- Writer is forbidden from fact-checking; must rely entirely on Editor to catch errors
- User research suggests Writer self-checking could be the biggest win (fewer loops, faster drafts)
- No guardrails exist for safe Writer fact-checking; current ban is blanket prohibition
- Writer could verify claims mid-draft, self-correct, and reduce downstream revision loops

Proposed approach:
1. Research phase: Define approved fact-checking sources and tools (box scores, rosters, contract databases)
2. Define Writer fact-check budget (time, API calls, acceptable error rate)
3. Add guardrails: Writer can fact-check claims against predefined sources only; must cite results
4. Require Writer to flag uncertainty clearly ("unverified," "requires Editor confirmation")
5. Add regression tests for Writer fact-check usage (ensuring claims are cited, sources are approved)

Acceptance criteria:
- [ ] Approved sources list documented (rosters, cap databases, game stats, etc.)
- [ ] Writer charter updated with fact-checking permission and guardrails
- [ ] Writer pipeline includes optional fact-check gate with budget enforcement
- [ ] Writer is required to cite fact-check results and flag uncovered claims as uncertain
- [ ] At least two tests validate fact-check execution (approved source query + citation requirement)
- [ ] Dashboard shows Writer fact-check usage per article (source queried, claims verified, time spent)

Implementation notes:
- This is a capability expansion, not a quick config change
- Start with low-risk sources (internal rosters, OverTheCap, Spotrac public pages)
- Writer must mark claims as "verified," "unverified," or "uncertain" after checking
- Consider cost cap: e.g., max 3 fact-checks per draft, max 5 min total fact-check time
- Escalate unverifiable claims to Editor as explicit "needs verification" notes
- This issue is the user-identified "biggest win" — prioritize research phase
- Estimated effort: Research phase (2-3 days) + implementation (3-4 days)
```

---

## Supplementary: Priority & Sequencing

**Tier 1 (Foundation — blocks everything):**
1. Issue #1 (Blocker tracking) — 1-2 days

**Tier 2 (Quick wins — direct ROI):**
2. Issue #2 (Blocker summary in Writer prompt) — 1-2 days
3. Issue #3 (Evidence routing to Research) — 2-3 days

**Tier 3 (Safety nets — prevent system hangs):**
4. Issue #5 (Escalate repeated blockers) — 2-3 days

**Tier 4 (Graceful degradation):**
5. Issue #4 (Fallback/claim-mode) — 2-3 days

**Tier 5 (Capability expansion — research phase required):**
6. Issue #6 (Writer fact-checking with guardrails) — Research (2-3 days) + Implementation (3-4 days)

**Rationale:**
- Issue #1 unblocks 4 downstream issues
- Tier 2 issues deliver immediate value (fewer Writer loops, clear routing)
- Tier 3/4 are safety mechanisms and fallbacks
- Tier 5 is forward-looking and requires careful research before implementation

---

## Duplicate Check Summary

All searches completed; no overlaps found with existing issues:
- ✅ No issue for "Writer research/fact-checking"
- ✅ No issue for "Evidence-gap routing to Research"
- ✅ No issue for "Blocker escalation to Lead"
- ✅ No issue for "Blocker summary in Writer prompt"
- ✅ No issue for "Structured blocker tracking"
- ✅ Issue #119 covers separate scope (artifact provenance + UX badges) — EXCLUDED per request

**Conclusion:** Safe to create full 6-issue set.

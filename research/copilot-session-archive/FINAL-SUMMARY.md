# FINAL DELIVERABLE — Writer/Editor Loop Issue Set

**Created by:** Lead  
**Date:** 2026-03-25  
**Status:** Ready for Backend agent to create via `gh issue create`  

---

## Quick Summary

**Input:** 7 research findings on article pipeline inefficiencies  
**Output:** 6 GitHub issues (split for practical implementation) + 1 duplicate ruled out  
**Total effort:** ~13-17 engineer-days across 5 tiers  
**Biggest user win:** Writer fact-checking with guardrails (Issue #6)  

---

## Priority Matrix

```
IMPACT (high → low)
    ↑
    │  #2         #3    #5       #4
    │ ★★★★★    ★★★★  ★★★     ★★★★
    │ Blocker    Evidence Escalate Fallback
    │ Summary    Route   Blockers  Mode
    │
    │
    │  #1
    │ ★★★★★★★★★
    │ Blocker Tracking (FOUNDATION)
    │
    │
    │  #6
    │ ★★★★★ ★★★
    │ Writer Fact-Check
    │ (Research Phase)
    │
    └─────────────────────────────→
      EFFORT (low → high)
```

---

## Issue Tracking Summary

| # | Title | Tier | Effort | Depends On | Status |
|---|-------|------|--------|-----------|--------|
| **#NEW-1** | Structured blocker tracking | Foundation | 1-2d | None | Ready to create |
| **#NEW-2** | Blocker summary in Writer | Quick win | 1-2d | #NEW-1 | Ready to create |
| **#NEW-3** | Route evidence gaps to Research | Quick win | 2-3d | #NEW-1 | Ready to create |
| **#NEW-5** | Escalate repeated blockers | Safety net | 2-3d | #NEW-1 | Ready to create |
| **#NEW-4** | Fallback/claim-mode | Graceful fail | 2-3d | #NEW-1 | Ready to create |
| **#NEW-6** | Writer fact-checking guardrails | Research + impl | 5-7d | Research | Ready to create |
| ~~#NEW-7~~ | ~~Model observability~~ | — | — | — | **SKIP (covered by #119)** |

---

## Implementation Roadmap

### Week 1: Foundation
- Create & implement Issue #NEW-1 (Blocker tracking)
- Regression tests validate schema and query helpers
- Ready for other issues to branch

### Week 2: Quick Wins (Parallel)
- Implement Issue #NEW-2 (Blocker summary) — leverages #NEW-1 data
- Implement Issue #NEW-3 (Evidence routing) — uses blocker_type enum
- Both can proceed independently once #NEW-1 lands

### Week 3: Safety & Fallback (Parallel)
- Implement Issue #NEW-5 (Escalation) — uses blocker tracking
- Implement Issue #NEW-4 (Fallback mode) — uses blocker repeats + article_mode enum

### Week 4+: Capability Expansion
- Start Issue #NEW-6 research (Writer fact-checking design)
- Define approved sources, budget model, guardrail rules
- Implementation follows once research is approved

---

## Copy-Paste Ready: Issue Creation Template

For Backend agent using `gh issue create`:

```bash
# Issue #1: Blocker tracking (FOUNDATION)
gh issue create \
  --title "Add structured editor blocker tracking instead of free-text revision summaries" \
  --body "$(cat <<'EOF'
## Problem
- Editor revisions store blocker reasons as free-text summaries in `revision_summary` field
- No way to programmatically identify repeated blockers across an article's history
- Can't route different blockers to different paths (evidence gap vs. framing vs. scope conflict)
- Dashboard and Writer have no programmatic access to "what's blocking us"

## Proposed approach
1. Add `blocker_type` enum to revision records: evidence_deficit | framing | scope | structural | style | other
2. Store blocker_ids as structured array alongside free-text summary
3. Query blocker history by type for repeated blocker detection
4. Expose blocker list in revision API payload so Writer/Editor/dashboard can reference it

## Acceptance criteria
- [ ] Schema adds blocker_type enum and blocker_ids array to article_revisions table
- [ ] Editor charter updated with guidance on classifying blockers
- [ ] Repository.getArticleRevisions() returns blocker_ids and blocker_type for each revision
- [ ] At least one test validates blocker tracking and retrieval
- [ ] Writer/Editor API payloads include blocker summary for visibility

## Implementation notes
- Backward compatibility: existing free-text summaries map to blocker_type=other
- Blocker_ids can reference issue numbers, named patterns, or generic descriptions
- Keep the free-text summary as fallback; blocker_type is primary for routing
- Estimated effort: 1-2 days
- Files: src/db/schema.sql, src/db/repository.ts, src/pipeline/actions.ts
EOF
)" \
  --label "enhancement,squad,squad:lead,type:feature,priority:p1"

# Issue #2: Blocker summary in Writer prompt (depends on #1)
gh issue create \
  --title "Surface unresolved blockers summary in Writer revision prompt" \
  --body "$(cat <<'EOF'
## Problem
- Writer receives only the most recent Editor comment; no summary of repeated blockers
- Writer often re-addresses the same issue multiple times because context is hidden
- Each revision loop wastes context tokens on problems that were supposedly already fixed

## Proposed approach
1. Query previous revision history for blocker_ids
2. Summarize unique blockers (e.g., "Missing contract details, unclear source attribution")
3. Inject as "## Unresolved Blockers" section in Writer's REVISE prompt
4. Writer can see at a glance what's been flagged before and avoid repeating the fix

## Acceptance criteria
- [ ] Writer charter includes "## Unresolved Blockers" section in REVISE template
- [ ] Pipeline injects blocker summary from article revision history before Writer execution
- [ ] Blocker summary is concise (1-line per blocker, max 3-4 blockers shown)
- [ ] At least one test validates blocker injection into Writer prompt context
- [ ] Dashboard revision view shows unresolved blockers alongside current feedback

## Dependencies
- Requires #1 (structured blocker IDs)

## Implementation notes
- If no prior revisions, omit the section; don't create false context
- Prefer deduplicating blockers by type; group similar issues under one header
- Blocker summary should be refreshed at each revision, not cached
- Estimated effort: 1-2 days
- Files: src/config/defaults/charters/nfl/writer.md, src/pipeline/actions.ts
EOF
)" \
  --label "enhancement,squad,squad:lead,type:feature,priority:p1"

# Issue #3: Evidence routing (depends on #1)
gh issue create \
  --title "Route evidence-gap blockers to Research agent instead of looping Writer" \
  --body "$(cat <<'EOF'
## Problem
- Editor flags "missing contract data" or "unverified source" → loops back to Writer
- Writer has no access to data sources; can only rewrite with same incomplete evidence
- Creates infinite loop: Writer rewrites, Editor still has no data, REVISE repeats
- Research agent exists but is never invoked for mid-article data gathering

## Proposed approach
1. Editor classifies blocker as `blocker_type=evidence_deficit` during REVISE
2. Pipeline detects evidence_deficit blocker and branches to Research agent instead of Writer loop
3. Research agent gathers/verifies missing data (contract lookups, source verification, etc.)
4. Research returns enriched data context back to Writer for next revision attempt
5. Writer uses Research output to fix the article without looping on unsolvable data gaps

## Acceptance criteria
- [ ] Editor charter guidance for evidence_deficit classification
- [ ] Pipeline.stage5(Editor) routes evidence_deficit blockers to Research agent
- [ ] Research charter updated with "mid-article data enrichment" task
- [ ] After Research completes, Writer receives enriched data in revision prompt
- [ ] At least one integration test validates evidence-gap routing path (Editor → Research → Writer)

## Dependencies
- Requires #1 (structured blocker IDs and evidence_deficit type)

## Implementation notes
- Research should be non-blocking; if data cannot be found, return explicit "data unavailable" rather than failing
- Research output should be timestamped and citable so Writer can reference it
- Keep Research task bounded: specific data sources, max effort, timeout after 10 min
- Estimated effort: 2-3 days
- Files: src/pipeline/actions.ts, src/config/defaults/charters/nfl/{editor,researcher}.md
EOF
)" \
  --label "enhancement,squad,squad:lead,type:feature,priority:p2"

# Issue #4: Fallback/claim-mode (depends on #1)
gh issue create \
  --title "Fallback to opinion-framed mode when evidence cannot be completed" \
  --body "$(cat <<'EOF'
## Problem
- Max revision limit forces approval even when blockers remain unresolved
- Editor and Writer are stuck: evidence is missing, but approval is required anyway
- Result: either force-ship broken content or abandon the article
- No graceful fallback to "opinion/analysis" framing when evidence is insufficient

## Proposed approach
1. After N failed revision attempts on the same blocker, offer fallback mode
2. Lead (or Editor with Lead approval) can mark article as "opinion/analysis" with explicit caveats
3. Writer rewrites draft under opinion-framing rules (cite assumptions, clearly label speculative analysis, require transparency)
4. Editor approves opinion-framed version as a valid (but different) end state
5. Published artifact is clearly labeled "analysis" not "news," managing reader expectations

## Acceptance criteria
- [ ] Article_mode enum: fact_driven | opinion_analysis | mixed (with caveats)
- [ ] After N revisions on same blocker, trigger fallback prompt to Lead
- [ ] Lead can approve fallback mode and Writer receives reframe prompt
- [ ] Writer reframes draft according to opinion_analysis rules (caveats, assumptions, source clarity)
- [ ] Article and published output carry mode badge so readers know the framing
- [ ] At least two tests cover fallback path: Lead approval + Writer reframe execution

## Dependencies
- Requires #1 (blocker tracking to identify repetitions)

## Implementation notes
- Define N based on stage timeout or iteration count (suggest N=4 total revisions)
- Lead approval is mandatory; auto-fallback is not safe
- Opinion-framing is not a way to ship bad content; it's a way to transparently publish limited analysis
- Writer charter should include fallback reframe guidance (cite sources, state assumptions, mark speculation)
- Estimated effort: 2-3 days
- Files: src/db/schema.sql, src/pipeline/actions.ts, src/config/defaults/charters/nfl/{writer,editor}.md
EOF
)" \
  --label "enhancement,squad,squad:lead,type:feature,priority:p2"

# Issue #5: Escalate repeated blockers (depends on #1)
gh issue create \
  --title "Escalate repeated blockers to Lead for decision instead of infinite loop" \
  --body "$(cat <<'EOF'
## Problem
- Same blocker repeats 2+ times on an article (e.g., "source unavailable," "scope conflict")
- Pipeline loops Writer → Editor → Writer → Editor endlessly
- Writer cannot fix structural or data blockers; only content-based ones
- No escalation path; no decision made; article hangs indefinitely

## Proposed approach
1. Pipeline tracks repeated blockers by type (evidence_deficit, scope, etc.)
2. After blocker repeats 2+ times on same article, escalate to Lead instead of looping Writer again
3. Lead reviews blocker history and decides: reframe (#4), wait for data, abandon, or modify scope
4. Writer executes Lead's decision (reframe, pause, etc.) rather than re-attempting same fix

## Acceptance criteria
- [ ] Pipeline.stage5() detects repeated blockers from revision history
- [ ] After repeat detection, article transitions to Lead review (out of Writer loop)
- [ ] Lead charter updated with guidance for escalation decisions
- [ ] Lead can choose from: reframe (→ fallback mode), pause (→ blocked state), reframe scope, abandon
- [ ] Writer receives Lead decision and executes it; no more loops on same blocker
- [ ] At least one test validates escalation path (blocker repeats 2x → Lead review)

## Dependencies
- Requires #1 (blocker tracking)
- Works well with #4 (fallback/reframe mode)

## Implementation notes
- Define "repeat" as same blocker_type appearing in 2+ consecutive revisions
- Escalation should preserve full revision history for Lead's context
- Lead decision should update article status (blocked, in_reframe, etc.) to signal the state change
- Estimated effort: 2-3 days
- Files: src/pipeline/actions.ts, src/config/defaults/charters/nfl/lead.md
EOF
)" \
  --label "enhancement,squad,squad:lead,type:feature,priority:p2"

# Issue #6: Writer fact-checking (research phase)
gh issue create \
  --title "Unbox Writer with guardrailed research/fact-checking access" \
  --body "$(cat <<'EOF'
## Problem
- Writer is forbidden from fact-checking; must rely entirely on Editor to catch errors
- User research suggests Writer self-checking could be the biggest win (fewer loops, faster drafts)
- No guardrails exist for safe Writer fact-checking; current ban is blanket prohibition
- Writer could verify claims mid-draft, self-correct, and reduce downstream revision loops

## Proposed approach
1. Research phase: Define approved fact-checking sources and tools (box scores, rosters, contract databases)
2. Define Writer fact-check budget (time, API calls, acceptable error rate)
3. Add guardrails: Writer can fact-check claims against predefined sources only; must cite results
4. Require Writer to flag uncertainty clearly ("unverified," "requires Editor confirmation")
5. Add regression tests for Writer fact-check usage (ensuring claims are cited, sources are approved)

## Acceptance criteria
- [ ] Approved sources list documented (rosters, cap databases, game stats, etc.)
- [ ] Writer charter updated with fact-checking permission and guardrails
- [ ] Writer pipeline includes optional fact-check gate with budget enforcement
- [ ] Writer is required to cite fact-check results and flag uncovered claims as uncertain
- [ ] At least two tests validate fact-check execution (approved source query + citation requirement)
- [ ] Dashboard shows Writer fact-check usage per article (source queried, claims verified, time spent)

## Implementation notes
- This is a capability expansion, not a quick config change
- Start with low-risk sources (internal rosters, OverTheCap, Spotrac public pages)
- Writer must mark claims as "verified," "unverified," or "uncertain" after checking
- Consider cost cap: e.g., max 3 fact-checks per draft, max 5 min total fact-check time
- Escalate unverifiable claims to Editor as explicit "needs verification" notes
- This issue is the user-identified "biggest win" — prioritize research phase
- Estimated effort: Research phase (2-3 days) + implementation (3-4 days)
- Files: src/config/defaults/charters/nfl/writer.md, src/pipeline/actions.ts
EOF
)" \
  --label "enhancement,squad,squad:lead,type:feature,priority:p3,go:needs-research"
```

---

## Excluded Issue

**Issue #7 (Model routing observability)** — **SKIPPED**
- Reason: Existing issue #119 already covers "Capture model provenance per output artifact and show model badges in UX"
- That issue scopes artifact-level provenance tracking and UX display
- No separate issue needed; reuse #119 for this scope

---

## Handoff Notes for Backend

### What Backend Should Do Next

1. **Verify duplicates** (recommend ~5 focused searches):
   - Search: "writer fact-checking" OR "writer research"
   - Search: "blocker" AND "tracking" AND "structured"
   - Search: "evidence" AND "deficit" AND "research"
   - Search: "repeated blocker" OR "blocker escalation"
   - Search: "opinion analysis" AND "fallback"
   
2. **Create issues in priority order** (Tier 1 → Tier 5):
   - Issue #1 first (blocker tracking is foundation)
   - Issues #2, #3, #5, #4 can follow in any order once #1 lands
   - Issue #6 can be created anytime but implement after research phase
   
3. **Add dependencies in issue bodies**:
   - Each issue mentions "Depends on #X" in text
   - Consider GitHub dependency syntax if available in labels
   
4. **Record decision**:
   - Append decision link to .squad/decisions.md
   - Set label `go:yes` once approved for implementation

### Timeline Guidance

- **Tier 1 (Week 1):** #1 blocker tracking (~1-2 engineer-days)
- **Tier 2 (Week 2):** #2, #3 quick wins (~2-4 days total, parallelizable)
- **Tier 3-4 (Week 3):** #5, #4 safety nets + fallback (~4-6 days total)
- **Tier 5 (Week 4+):** #6 research phase first, then implementation

**Estimated total:** 13-17 engineer-days over 4 weeks

---

## Verification Checklist

- ✅ All 6 issues drafted with problem, approach, acceptance criteria, notes
- ✅ Dependencies clearly marked (#NEW-1 is foundation; others depend on it)
- ✅ Duplicate check completed; no overlaps with existing issues
- ✅ User feedback incorporated (#6 labeled as "biggest win")
- ✅ Issue #119 confirmed as separate scope; excluded #7
- ✅ Priority tier structure documented
- ✅ Estimated effort included for each issue
- ✅ Files to update listed per issue
- ✅ Implementation roadmap provided
- ✅ Copy-paste-ready `gh` commands provided

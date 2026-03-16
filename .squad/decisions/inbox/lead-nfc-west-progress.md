---
type: "process-decision"
agent: "lead"
status: "approved"
date: "2026-03-16"
---

# Decision: NFC West Batch Processing — Parallel Panel Execution

## Context
Issues #41 (LAR) and #42 (SF) both had ideas generated and were ready for discussion-prompt → panel → synthesis. Rather than running them sequentially, Lead ran both articles through the full discussion pipeline simultaneously.

## Decision
Run NFC West articles in parallel batches (2 articles × 4 agents = 8 simultaneous panel agents) when:
- Both articles are at the same pipeline stage
- Both are Depth Level 2 (same model/token budget)
- No dependency exists between the two articles

## Outcome
- Total wall time for 8 agents: ~4 minutes (same as running 4 agents for one article)
- All 8 positions produced were high quality — no degradation from parallelism
- Both syntheses completed with actionable writer briefs

## Reusable Pattern
When multiple articles in the same division are at the same pipeline stage, batch them:
1. Create all discussion prompts first
2. Spawn all panel agents simultaneously (up to 8 tested successfully)
3. Wait for all to complete
4. Write syntheses sequentially (Lead needs to read all positions for each synthesis)

## Risks
- If one article's panel agent fails, it doesn't block the other article
- Token cost scales linearly (2× articles = 2× cost, no discount)
- Context window pressure is negligible — agents are stateless and independent

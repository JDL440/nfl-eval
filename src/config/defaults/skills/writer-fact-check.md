---
name: writer-fact-check
description: Bounded Stage 5 writer verification policy and durable writer-factcheck.md contract
domain: content-production
confidence: 1.0
tools: []
---

# Writer Fact-Check — Skill

## Core Rule

Writer gets **bounded, targeted verification access**. Writer does **not** get generic browsing, raw web search, or permission to replace Editor as the final fact-check gate.

## Approved Source Ladder

1. **Local/runtime artifacts and deterministic helpers first**
   - `discussion-summary.md`
   - `panel-factcheck.md`
   - `roster-context.md`
   - `fact-check-context.md`
   - local nflverse-backed helpers and structured outputs
2. **Official primary sources second**
3. **Trusted references third**
   - OverTheCap
   - Spotrac
   - Pro Football Reference
   - ESPN roster/depth/transaction pages

If the local/runtime layer can answer the claim, do not escalate.

## Prohibited

- Raw open-ended web search
- General browsing across arbitrary domains
- Social posts, rumor accounts, forums, or fan blogs as evidence
- Research loops that continue until confident
- Using outside research to invent a new thesis

## Budget

### Fresh draft

- External approved-source checks: **max 3**
- Wall-clock budget: **5 minutes**

### Revision draft

- Reuse the existing `writer-factcheck.md` artifact first
- New external approved-source checks: **max 1**
- Same 5-minute wall-clock cap

If the budget is exhausted, mark the claim unresolved and then attribute it cautiously, soften it, omit it, or hand it to Editor.

## Scope

Verify only specific risky claims:

- contract figures and cap mechanics
- player/team assignments
- time-sensitive transactions or dates
- statistics, rankings, and draft facts
- direct quotes or official statements

Do **not** re-verify every sentence in the article.

## Durable Artifact

`writer-factcheck.md` must keep these sections:

1. **Verified Facts Used in Draft**
2. **Attributed but Not Fully Verified**
3. **Unverified / Omitted Claims**
4. **Budget Summary**

## Boundary

Editor remains the mandatory final authority. Writer-side verification is advisory and churn-reducing only.

---
name: writer-fact-check
description: Bounded Stage 5 writer verification policy and durable writer-factcheck.md contract
domain: content-production
confidence: 1.0
tools: []
---

# Writer Fact-Check — Skill

> **Confidence:** high
> **Scope:** Stage 5 writer verification only
> **Purpose:** Reduce revision churn on risky claims without turning Writer into a second open-ended research or Editor pass

## Core Rule

Writer gets **bounded, targeted verification access**. Writer does **not** get generic browsing, raw web search, or permission to replace Editor as the final fact-check gate.

## Approved Source Ladder

Use sources in this order:

1. **Local/runtime artifacts and deterministic helpers first**
   - `discussion-summary.md`
   - `panel-factcheck.md`
   - `roster-context.md`
   - `fact-check-context.md`
   - local nflverse-backed helpers and structured outputs
2. **Official primary sources second**
   - official NFL/team roster, transaction, schedule, standings, and announcement pages
3. **Trusted references third**
   - OverTheCap
   - Spotrac
   - Pro Football Reference
   - ESPN roster/depth/transaction pages

If the local/runtime layer can answer the claim, do not escalate to external sources.

## Prohibited in v1

- Raw open-ended web search
- General browsing across arbitrary domains
- Social posts, rumor accounts, forums, or fan blogs as evidence
- Research loops that continue until confident
- Using external research to invent a new thesis the panel did not supply

## Budget

### Fresh draft
- Local deterministic bundle: reuse supplied artifacts first
- External approved-source checks: **max 3**
- Wall-clock budget: **5 minutes**

### Revision draft
- Reuse the existing `writer-factcheck.md` artifact first
- New external approved-source checks: **max 1**
- Same 5-minute wall-clock cap

If the budget is exhausted, Writer must mark the claim unresolved, then attribute it cautiously, soften it, omit it, or hand it to Editor.

## Verification Scope

Verify only **specific risky claims**, such as:

- contract figures and cap mechanics
- player/team assignments
- time-sensitive transactions or dates
- statistics, rankings, and draft facts
- direct quotes or official statements

Do **not** try to re-verify every sentence in the article.

## Volatile Facts Rule

When a claim is time-sensitive, source-sensitive, or unresolved:

- attribute it inline if an approved source supports it but drift is possible
- soften the prose if the evidence is directional but not stable
- omit it if the claim cannot be supported within policy and budget

Never collapse unresolved conflicts into a bare factual sentence.

## Durable Artifact: `writer-factcheck.md`

Writer must preserve a durable artifact with these sections:

1. **Verified Facts Used in Draft**
2. **Attributed but Not Fully Verified**
3. **Unverified / Omitted Claims**
4. **Budget Summary**

At minimum, record claim status, source class/label, and what prose treatment was required.

## Editor Boundary

Editor remains the mandatory final authority. Writer-side verification is advisory and churn-reducing; it does not create auto-approval.

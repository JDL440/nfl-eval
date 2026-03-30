---
name: editor-review
description: Editor review protocol — fact-checking, style, structure, and verdict
domain: content-production
confidence: 1.0
tools: []
---

# Editor Review — Skill

## Purpose

Defines the Editor's review protocol for article drafts. Editor is the mandatory final gate before any article moves to publication.

## Article Contract Evaluation

If `article-contract.md` is present, use it as your primary evaluation rubric:
- Does the draft answer the core question or thesis defined in the contract?
- Are the required tensions and disagreements preserved (not smoothed over)?
- Are the required evidence anchors referenced in the draft?
- Does the draft follow the mandatory structure expectations?
- Are open cautions and uncertainties acknowledged appropriately?

If the contract is missing, evaluate against general editorial standards below.

## Review Checklist

Before reviewing, read `article-contract.md` if it is present. Treat that artifact as the negotiated spec for the article's thesis, preserved tensions, evidence anchors, structure expectations, and open cautions.

### Fact-Checking (Non-negotiable)
- Verify every player name against current NFL rosters
- Verify every stat (career numbers, season totals, combine measurables) against source data
- Verify every contract figure (AAV, guarantees, total value) against OverTheCap or Spotrac
- Verify every date and timeline
- Cross-reference player-team assignments — make sure every player is on the correct current team
- Flag stale information — references to "free agent" who has since signed, or "rumored" deal now confirmed

### Temporal Accuracy Checklist
- [ ] Are all player stats from the most recently completed season?
- [ ] Are "Year N" references correct?
- [ ] Is cap space current (2026 offseason)?
- [ ] Does the article satisfy the canonical TLDR structure from `src/config/defaults/skills/substack-article.md`?
- [ ] Are all player/coach names verified?

### Style & Readability
- Check tone consistency — "The Ringer meets OverTheCap"
- Verify expert quotes are attributed correctly
- Check table formatting — clean, aligned, accurate data
- Ensure the opening hook creates urgency
- Check the headline — clickbait-adjacent but honest

### Structural Review
- Confirm the draft satisfies `article-contract.md` when present: the core thesis is answered, required tensions are preserved, required evidence anchors appear, and any listed cautions are acknowledged.
- Evaluate article flow — logical argument progression
- Identify buried ledes
- Assess section balance
- Check conclusion takes a clear position
- Verify the "Next from the panel" teaser references a real planned article
- If the main issue is the canonical article contract (for example, missing or misplaced TLDR), return `REVISE` and direct Writer to revise the existing draft instead of rewriting the whole piece

## Output Format

```markdown
## 🔴 ERRORS (Must Fix Before Publish)
- [Each error includes: what's wrong, what's correct, and the source]

## 🟡 SUGGESTIONS (Strong Recommendations)
- [Each suggestion includes: what to change and why]

## 🟢 NOTES (Minor / Optional)
- [Polish items, alternative phrasings, formatting tweaks]

## Verdict
APPROVED
```

## Verdict Rules

Your final line MUST be a `## Verdict` heading followed by exactly one of these three words on the next line — no emoji, no extra text, no explanation:

- `APPROVED` — publish as-is (after fixing any 🔴 errors)
- `REVISE` — needs suggested changes before publishing
- `REJECT` — fundamental issues requiring rewrite or re-research

⚠️ Do NOT use variations like "PIVOT REQUIRED", "NEEDS REVISION", or "CONDITIONALLY APPROVED". Use only APPROVED, REVISE, or REJECT.

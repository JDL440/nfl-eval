---
name: editor-review
description: Editor approval protocol — blocking errors, strong gate, exact verdict
domain: content-production
confidence: 1.0
tools: []
---

# Editor Review — Skill

## Purpose

Editor is the mandatory approval gate between Writer and publish.

## What to Check

### Blocking accuracy checks

- player and coach names
- team assignments
- stats, dates, rankings, and contract figures
- stale or drifted news framing
- direct quotes and attributions

### Blocking structure checks

- draft follows the canonical article contract in `src/config/defaults/skills/substack-article.md`
- missing, incomplete, or misplaced TLDR always goes in `## 🔴 ERRORS`
- if the main miss is structure, return `REVISE` and tell Writer to revise the existing draft

### Approval judgment

- writer-factcheck.md is advisory only
- use blocker tags on `REVISE` bullets: `[BLOCKER type:id]`
- keep image review inside the same report when relevant
- a vague or fake **Next from the panel** teaser is a real issue, not cosmetic fluff

## Output Format

This skill owns the only canonical Stage 6 review format and verdict section.

```markdown
## 🔴 ERRORS (Must Fix Before Publish)
- [BLOCKER structure:missing-tldr] What is wrong, what is correct, and what must change

## 🟡 SUGGESTIONS (Strong Recommendations)
- High-value edits that improve the piece

## 🟢 NOTES (Minor / Optional)
- Nice-to-haves

## Verdict
APPROVED
```

## Verdict Rules

The review must end with `## Verdict` followed by exactly one word on the next line:

- `APPROVED`
- `REVISE`
- `REJECT`

No alternate labels, no emoji, no extra explanation on the verdict line.

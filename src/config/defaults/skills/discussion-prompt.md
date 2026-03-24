---
name: discussion-prompt
description: How to write a sharp discussion prompt that generates specific, data-anchored panel debate
domain: content-production
confidence: 1.0
tools: []
---

# Discussion Prompt — Skill

## Purpose

Canonical Stage 2 guidance for how Lead writes a discussion prompt — the most important artifact in the pipeline. A bad prompt produces a generic panel. A good prompt produces specific, numeric, disagreement-generating analysis.

## Required Sections

Every discussion prompt must have all five:

| Section | What It Does | Quality Signal |
|---------|-------------|----------------|
| **Core Question** | One sharp sentence — the actual debate | "When should SEA extend JSN?" ✅ vs. "Is JSN good?" ❌ |
| **Key Tensions** | 3–4 bullet points the panel MUST resolve | Each tension should have a "yes side" and "no side" |
| **Data Anchors** | Specific numbers: cap figures, market comps, timeline milestones | Must include actual dollar amounts, dates, percentages |
| **The Paths** | Brief, parallel framing of each option | Each path should be a plausible choice — no strawmen |
| **Panel Instructions** | Per-panelist focus with explicit "do this / don't do that" | Prevents overlap; each agent should have a unique lane |

## Anti-Patterns to Avoid

- **Vague tension:** "JSN vs. cap space" → **Better:** "Paying $34M AAV leaves only $10M for EDGE/safety; is that a defensible roster construction choice?"
- **Missing data anchors:** Saying "the WR market has reset" without citing specific contract comps
- **No per-panelist differentiation:** If Cap and Team agent both get "analyze the financial implications," expect duplicate analysis
- **Strawman paths:** Don't make one path obviously wrong — every path should have a legitimate advocate

## Scope

- This skill is the single source of truth for Stage 2 prompt structure and quality signals.
- `article-discussion.md` should reference this skill instead of restating the full Stage 2 checklist.
- Keep panel-selection details in `panel-composition.md`, not here.

## Template

```markdown
# Discussion Prompt: [Article Title]

**Depth Level:** [1 — Casual Fan | 2 — The Beat | 3 — Deep Dive]

## The Core Question
[One sentence — sharp, specific, contentious]

## Key Tensions
- [Tension 1 — with both sides stated]
- [Tension 2]
- [Tension 3]

## Data Anchors
[Tables with specific numbers — contract comps, cap figures, timeline gates]

## The Paths
[Brief parallel framing — 2–4 paths, each plausible]

## Panel Instructions
### [Panelist 1 Name] — [Role]
[Specific focus, explicit what-to-do / what-not-to-do]

### [Panelist 2 Name] — [Role]
[Specific focus]
```

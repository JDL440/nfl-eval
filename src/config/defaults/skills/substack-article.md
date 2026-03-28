---
name: substack-article
description: Canonical NFL Lab article structure, TLDR contract, and Substack drafting guidance
domain: content-production
confidence: 1.0
tools: []
---

# Substack Article Generation — Skill

> **Confidence:** medium
> **Created:** 2026-03-14
> **Last validated:** 2026-03-14

## Purpose

Generate long-form NFL Lab articles by synthesizing multi-agent analysis into a compelling, reader-friendly narrative with expert-panel framing.

## Canonical Contract

This file is the canonical article structure contract for NFL Lab. Writer, Editor, and Publisher should reference this skill instead of maintaining duplicate policy text elsewhere.

**Non-negotiable top-of-article order:**
1. `# Headline`
2. `*Italic subheadline*`
3. Optional cover image markdown
4. `> **📋 TLDR**` block with **4 bullet points**
5. `**By: The NFL Lab Expert Panel**`

Drafts that miss this TLDR contract should be repaired before Editor approval. Stage 5→6 validation treats a missing, misplaced, or too-short TLDR block as a hard guard failure.

## Runtime Contract

The in-app article runtime may expose limited research tools depending on provider and configuration.

- Agents may use approved web research when the runtime exposes it and the added context materially improves freshness or verification.
- Agents should not assume arbitrary file access, direct image or publishing tools, commits, or other side effects unless the runtime explicitly exposes those actions.
- The application runtime still handles model routing, artifact persistence, image generation, publishing integrations, and dashboard actions outside the tools explicitly available to the model.
- This skill should describe structure, reasoning, and handoff intent without pretending to execute unavailable operator steps.

## When to Use

- User requests an article on a specific NFL topic
- User wants to publish expert-panel analysis as content
- Any “write this up as a Substack” or “turn this into an article” request

## Process

### Phase 1: Identify Expert Sources

Map the topic to the 2–4 most relevant agents. Every article needs at minimum:

- one team agent
- one or more specialists relevant to the topic

### Phase 2: Gather Expert Analysis

The runtime should gather all relevant expert outputs before Writer drafts. Each agent prompt should:

1. include the role and the specific angle relevant to that expert
2. note that the output will be used in a Substack article
3. ask for quotable conclusions — strong opinions, specific numbers, clear recommendations
4. encourage real disagreement when the analysis supports it

### Phase 3: Write the Article

Writer should receive:

- the topic brief
- the discussion summary
- relevant panel outputs
- any supplied `panel-factcheck.md` or `writer-factcheck.md` artifacts

If the supplied material is missing a key fact, do not invent it. Write around the gap cautiously or flag it for Editor.

## Temporal Accuracy

The prompt should make current-season context explicit when it matters:

- what the current NFL year/offseason is
- which season’s stats are being cited
- whether roster/cap references are current to that moment

If the context is unclear, the draft should avoid overstating freshness.

## Structure Template

```markdown
# {Clickbait-worthy but substantive headline}

*{Subheadline describing the panel angle}*

![{Hero image alt text}]({cover-image-if-supplied})

> **📋 TLDR**
> - {1-line on the player/team situation}
> - {1-line on the key resource / leverage point}
> - {1-line panel verdict}
> - {1-line on the central disagreement}

---

**By: The NFL Lab Expert Panel**

{Opening hook — 2-3 paragraphs that create urgency}

::subscribe

---

## {Section 1: The Situation / The Problem}
{What happened, what matters now, what is at stake}

## {Section 2: Expert Analysis — First Angle}
{Primary expert lane with evidence}

## {Section 3: Expert Analysis — Second Angle}
{Contrasting or complementary lane}

## {Section 4: Additional Angle(s)}
{Scheme, injury, cap, draft, or roster context as needed}

## {Section 5: The Disagreement}
{Where the panel meaningfully splits and why}

## {Section 6: The Consensus / Verdict}
{What the panel recommends overall}

---

{Closing paragraph — tie back to the big picture}

::subscribe

---

*The NFL Lab is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement is the analysis. Welcome to the Lab.*

*Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.*

---

**Next from the panel:** {Specific teaser for the next real queued topic}
```

## Image Guidance

Images are part of the article contract, but the **application** handles image workflows.

Prompt guidance:

- assume at most one cover image at the top and a small number of purposeful inline images
- keep section breaks natural so image insertion points are obvious
- do not depend on visible captions to explain the article
- if an image is supplied, it should support the section rather than decorate it

## Editorial Expectations

Before a piece is considered publish-ready, Editor should verify:

- TLDR structure and placement
- factual accuracy
- quote attribution
- table consistency
- image relevance / policy compliance
- a real, specific “Next from the panel” teaser

## Style Guide

- **Tone:** informed but accessible; data-backed but narrative-driven
- **Tables:** use when they answer a real reader question
- **Quotes:** highlight the strongest panel positions
- **Disagreements:** surface them; don’t hide them
- **Conclusion:** take a position
- **Length:** long enough to matter, short enough to finish

## Anti-Patterns

- ❌ generic “both sides have a point” endings
- ❌ burying the recommendation
- ❌ vague teasers for a nonexistent next article
- ❌ repeating the same point across multiple expert sections
- ❌ pretending the model itself generated images, saved files, committed code, or published the piece

## Notes

- `article-discussion` feeds this skill upstream
- `editor.md` enforces this contract downstream

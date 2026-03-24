---
name: substack-article
description: Canonical NFL Lab article contract for Writer, Editor, and Publisher
domain: content-production
confidence: 1.0
tools: []
---

# Substack Article — Skill

This file is the canonical article structure contract for NFL Lab. Writer, Editor, Publisher, and runtime guards should reference this skill instead of maintaining competing structure rules.

## Canonical Top-of-Article Contract

Required order:

1. `# Headline`
2. `*Italic subheadline*`
3. Optional cover image markdown
4. `> **📋 TLDR**` block with **4 bullet points**
5. `**By: The NFL Lab Expert Panel**`

Drafts that miss this contract should be repaired before Editor approval. Stage 5→6 validation treats a missing, misplaced, or too-short TLDR block as a hard guard failure.

## Writer Essentials

- Write a complete markdown article, not notes or an outline.
- Lead with a clear hook and a clear thesis.
- Keep panel disagreement visible when it matters.
- Use tables and expert quotes when they sharpen the analysis.
- End with a specific `**Next from the panel:**` teaser tied to a real follow-up angle.

## House Style

- Informed but accessible
- Data-backed but narrative-driven
- Honest tension in headlines; no empty clickbait
- Clear recommendation by the end of the piece

## Image Policy

- Exactly **1 cover image** near the top of the article body
- Exactly **2 inline images** at natural section breaks
- No visible markdown image captions in the article body
- Alt text should be accurate and useful

## Publisher Essentials

- Publisher pass is for required publish-readiness checks only.
- Confirm the article package is clean, correctly structured, and ready for Substack.
- Optional promotion work such as Notes, tweets, or publish bundles is separate from the required publish gate.

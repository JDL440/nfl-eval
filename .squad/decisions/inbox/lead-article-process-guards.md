# Decision: Article Process Guards — Temporal Accuracy + TLDR Requirement

**Date:** 2026-03-16  
**Decided by:** Lead (Joe Robinson directive)  
**Status:** Implemented

## Problem

Drake Maye article ("Year 2 Decision Time") shipped with two critical process failures:

1. **Temporal accuracy failure:** Article framed Maye as entering "Year 2" and used Year 1 stats, when he's actually entering Year 3 of his NFL career. Panel experts wrote analysis based on stale season context because spawning prompts didn't specify the current NFL calendar. Agents defaulted to their training cutoff, which was one season behind reality.

2. **Missing TLDR:** Article published without a quick-scan summary box. NFL Lab articles are 3,000+ words — readers need a TLDR callout block (situation, assets, verdict, debate) to decide if the article is worth their time.

**Root cause:** No temporal context guards in panel spawn templates, no TLDR requirement in article structure, no verification gate in Editor checklist.

## Decision

Add three accuracy gates to the article lifecycle and update panel spawning requirements to prevent recurrence:

### Gate 1: Temporal Accuracy
- All panel agent spawns MUST include a season context block specifying:
  - Current NFL year (2026)
  - Most recent completed season (2025)
  - Upcoming season (2026)
  - Explicit requirement: all stats from 2025 unless noted as historical
  - All roster/cap data from 2026 offseason
- Editor MUST verify temporal accuracy as part of fact-check

### Gate 2: TLDR Present
- Article structure template MUST include TLDR callout block after subtitle
- TLDR format: 4 bullets (situation, assets, verdict, debate)
- Editor MUST verify TLDR presence and accuracy before approval

### Gate 3: Player/Staff Name Accuracy
- All player/coach names verified against current rosters
- Draft prospects verified as real 2026 prospects
- Contract figures sourced (OTC/Spotrac citation required)

## Implementation

**Files updated:**
1. `.squad/skills/substack-article/SKILL.md` — Added TLDR to structure template + Temporal Accuracy subsection to Phase 2
2. `.squad/skills/article-lifecycle/SKILL.md` — Added "Accuracy Gates" section between Stage 6 and Stage 7
3. `.squad/agents/editor/charter.md` — Added "Temporal Accuracy Checklist" subsection to Fact-Checking

## Rationale

**Temporal accuracy is non-negotiable.** Readers who follow the NFL closely will catch "Year 2" framing for a Year 3 player instantly. Stale stats undermine every conclusion built on top of them. If the article says "based on his Year 1 performance" when discussing a Year 3 player, the entire analysis is compromised.

**TLDRs drive engagement.** A 3,500-word deep-dive article without a TLDR assumes readers will commit 10+ minutes blind. Busy readers scanning the site need to know: What's the verdict? What's the debate? Is this article for me? A 4-bullet TLDR answers those questions in 15 seconds.

**Name accuracy protects credibility.** One invented first name or hallucinated prospect name is enough to make readers question everything else in the article. If we can't get names right, why trust our contract projections or scheme analysis?

## Expected Impact

- **Zero temporal accuracy errors** — panel agents will work from current season context, not training cutoff defaults
- **100% TLDR presence** — Editor gate enforces the requirement before any article moves to Publisher Pass
- **Name verification as routine** — Editor checklist formalizes what was previously implicit

## Side Note: Title/Subtitle Display in Substack

Joe noted the Maye article title and subtitle appeared twice in Substack (once in the header, once in the body). This was a publisher bug already fixed separately — the Substack API strips `# Title` and `*subtitle*` from the markdown body before rendering, so they don't duplicate. Article markdown files should KEEP the H1 and subtitle intact (that's the source file format), but the publisher now strips them correctly.

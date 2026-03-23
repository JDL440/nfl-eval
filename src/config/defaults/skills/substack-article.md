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
> **Last validated:** 2026-03-14 (RB article for NFL Lab)

## Purpose

Generate long-form Substack articles for "NFL Lab" (or similar expert-panel sports blogs) by synthesizing multi-agent analysis into a compelling, reader-friendly narrative with expert-panel framing.

## Canonical Contract

This file is the canonical article structure contract for NFL Lab. Writer, Editor, and Publisher should reference this skill instead of maintaining duplicate policy text elsewhere.

**Non-negotiable top-of-article order:**
1. `# Headline`
2. `*Italic subheadline*`
3. Optional cover image markdown
4. `> **📋 TLDR**` block with **4 bullet points**
5. `**By: The NFL Lab Expert Panel**`

Drafts that miss this TLDR contract should be repaired before Editor approval.
Stage 5→6 validation treats a missing, misplaced, or too-short TLDR block as a hard guard failure, and Writer should repair that structure before Editor runs.

## When to Use

- User requests an article on a specific NFL topic (trade, signing, draft pick, extension, scheme analysis)
- User wants to publish expert-panel analysis as content
- Any "write this up as a Substack" or "turn this into an article" request

## Process

### Phase 1: Identify Expert Sources (Coordinator)

Map the topic to the 2-4 most relevant agents. Every article needs at minimum:
- **One team agent** (the team the article is about)
- **One or more specialists** relevant to the topic

| Topic Type | Primary Agents | Supporting Agents |
|------------|---------------|-------------------|
| Free agent signing | Team + Cap | PlayerRep, Offense/Defense (scheme fit) |
| Contract extension | Cap + PlayerRep | Team (roster context), Offense/Defense |
| Trade evaluation | Both team agents + Cap | Draft (if picks involved), PlayerRep |
| Draft pick analysis | CollegeScout + Team | Draft (board context), Offense/Defense, Injury |
| Roster construction | Team + Cap + Offense/Defense | Analytics, SpecialTeams |
| Injury impact | Injury + Team | Cap (contract implications), PlayerRep |

### Phase 2: Gather Expert Analysis (Parallel Agent Spawns)

Spawn all relevant agents in parallel. Each agent's prompt should:
1. Read their charter.md and history.md
2. Be given the specific question/angle relevant to their expertise
3. Be told the output will be used in a Substack article
4. Be asked to provide **quotable conclusions** — strong opinions, specific numbers, clear recommendations
5. Be encouraged to **disagree with each other** if their analysis warrants it (disagreement = compelling content)

**Key prompt addition for article spawns:**
```
Your analysis will be used in a Substack article for "NFL Lab."
Provide your expert assessment with:
- Specific numbers and projections (not vague ranges)
- A clear bottom-line recommendation
- Quotable one-liner summary of your position
- Areas where you DISAGREE with other experts (Cap vs PlayerRep, Team vs Scheme, etc.)
```

#### Temporal Accuracy (REQUIRED for every spawn)

Every panel agent spawn MUST include the current NFL calendar context:

```
CURRENT SEASON CONTEXT (required — verify before writing):
- Current NFL year: 2026
- Most recent completed season: 2025 (Year N for {player})
- Upcoming season: 2026 (Year N+1 for {player})
- All stats MUST be from the {2025} season unless explicitly noted as historical
- All roster/contract/cap data MUST be 2026 offseason current
```

Failure to specify this causes agents to default to their training cutoff context,
which may be one or more seasons stale.

### Phase 3: Write the Article (Writer Agent)

**Writer takes the raw expert output and crafts it into a polished Substack article.** Writer follows the house style guide in their charter and the structure template below. Writer does NOT fact-check — that's Editor's job.

**Note on fact-checking preflight:** Before Writer begins, Lead runs a lightweight preflight verification (see [fact-checking SKILL.md](../fact-checking/SKILL.md)) on high-risk claims in the panel outputs, flagging contradictions, missing sources, and unsafe details. Writer receives the `panel-factcheck.md` artifact and uses it to understand which claims are verified, flagged, or problematic — but does not re-verify claims. Editor handles final fact-check at Stage 6.

Spawn Writer with:
- The topic brief
- All raw expert analysis (pasted into the prompt)
- The structure template below
- **The `panel-factcheck.md` preflight** — include a summary so Writer knows which claims are verified, flagged, or problematic
- **Model:** Selected by the LLM Gateway model-policy (writer stage key)
- **Output budget:** 5,000 tokens max. If content is dense, tighten narrative connective tissue first; never drop expert analysis.

Writer produces a complete markdown draft saved to `content/articles/{slug}.md`.

**Structure Template:**

```markdown
# {Clickbait-worthy but substantive headline}

*{Subheadline describing the expert panel angle}*

![{Hero image alt text}](../../images/{slug}/{slug}-cover-1.png)

> **📋 TLDR**
> - {1-line on the player/situation heading into the upcoming season}
> - {1-line on key assets / resources available}
> - {1-line panel verdict}
> - {1-line: the central expert debate}

---

**By: The NFL Lab Expert Panel**

{Opening hook — 2-3 paragraphs setting up the problem/question. Make it visceral.
Use the team's current situation to create urgency.}

::subscribe

---

## {Section 1: The Situation / The Problem}
{Context: what happened, what's at stake, why this matters now}
{Use tables for roster data, cap numbers, comparables}

## {Section 2: Expert Analysis — First Angle}
{Deep dive from primary expert. Quote them directly.}
{Include data tables, comparisons, projections.}

## {Section 3: Expert Analysis — Second Angle}
{Contrasting or complementary analysis from second expert.}
{This is where disagreements shine — "Cap says X, but PlayerRep argues Y"}

## {Section 4: Expert Analysis — Additional Angles}
{Scheme fit, injury, draft context — whatever's relevant}
{Keep each expert section focused on THEIR domain}

## {Section 5: The Disagreement (if applicable)}
{Explicitly call out where experts disagree and why}
{Present both sides fairly — let the reader decide}

## {Section 6: The Consensus / The Verdict}
{What the panel agrees on, despite disagreements}
{Present as a clear recommendation with a summary table}
{Quote each expert's bottom-line take}

---

{Closing paragraph — tie it back to the big picture}

::subscribe

---

*The NFL Lab is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement is the analysis. Welcome to the Lab.*

*Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.*

---

**Next from the panel:** {Cliffhanger tease for the next real article topic — specific enough to spin up or match a GitHub idea issue}
```

### Phase 4: Headline Craft

Headlines should be:
- **Clickbait-adjacent but honest** — create curiosity without misleading
- **Include a tension or question** — disagreement, surprise, counter-narrative
- **Name the team** — SEO and fan targeting
- **Use specific language** — numbers, player names, pick numbers

**Formula options:**
- `{Team} Has a {Problem}. Here's Why {Surprising Solution} Might Be the Answer.`
- `{Player}'s Extension: What {Team} Should Pay vs. What His Agent Will Demand`
- `The {Position} Nobody's Talking About That Could Win {Team} Another Title`
- `We Asked {N} Experts About {Topic}. They Can't Agree — and That's the Point.`
- `{Bold Claim}. Our Expert Panel Explains Why.`

### Phase 4b: Image Generation (after Writer saves draft)

**Immediately after the draft is saved**, generate editorial images using the `generate_article_images` extension. Images are generated at this stage so the Editor can review them alongside the article text.

```
generate_article_images(
  article_slug: "{slug}",
  article_title: "{Final headline}",
  article_summary: "{1-3 sentence summary of the article's core argument}",
  team: "{Primary NFL team, e.g. 'Seattle Seahawks'}",
  players: ["{Key players mentioned}"],
  image_types: ["cover", "inline", "inline"],
  count_per_type: 1
)
```

The tool saves images to `content/images/{slug}/` and returns markdown references to paste into the article.

**Image policy (updated):**
- **Exactly 1 cover image** in article markdown — place it at the very top of the article body, above the `> **📋 TLDR**` block
- **Exactly 2 inline images** — placed at natural section breaks to keep mobile readers scrolling
- **Cover image is the hero image** — it should be the first body image and should drive the social/share thumbnail
- **For player-centric headlines or articles, the cover image should feature the player in a strong editorial/game-action image**
- **For team-wide or abstract pieces, the cover image can be atmospheric/team-led**
- **inline-2** can be analytical or data-adjacent
- All article images render at `imageSize: "normal"` (text column width)
- **Do not use visible image captions** in article markdown; keep alt text, skip caption text

**Full guidance:** See [`image-generation` SKILL.md](../image-generation/SKILL.md) for prompting strategy, custom prompts, and Editor review format.

### Phase 5: Editorial Review (MANDATORY)

**Editor reviews every article before it goes to `content/articles/`.** This is non-negotiable.

Spawn Editor (sync) with the draft article. Editor produces:
- 🔴 **ERRORS** — factual mistakes that must be fixed (wrong names, bad stats, stale info)
- 🟡 **SUGGESTIONS** — strong recommendations for style/structure
- 🟢 **NOTES** — minor polish items

**Verdict:** ✅ APPROVED / 🟡 REVISE / 🔴 REJECT

If 🔴 errors exist, fix them and re-submit. The Emmanwori name error (mixing Nick Emmanwori with Nehemiah Pritchett) is the founding example of why this step exists.

### Phase 6: Polish & Store

1. Save article to `content/articles/{slug}.md` (with image references inserted)
2. Commit with descriptive message (include images: `content/images/{slug}/`)
3. Tease the next article at the end with a cliffhanger hook that points to a real queued topic — or to the topic that will become the next GitHub idea issue

### Phase 7: Publisher Pass + Publish to Substack

Run the Publisher pass using the [`publisher` SKILL](../publisher/SKILL.md) — it handles final formatting verification, image placement checks, and calls `publish_to_substack`:

Call `publish_to_substack` to push the article to Substack as a draft:

```
publish_to_substack(
  file_path: "content/articles/{slug}.md",
  title: "{Final headline — may refine from working title}",
  subtitle: "{1-line hook used for email preview}",
  audience: "everyone"
)
```

**Team tag is auto-applied** from `primary_team` in `content/pipeline.db` — no need to pass `team` manually. The tool also auto-tags any specialist agents whose artifacts are in the article directory. Pass `team:` explicitly only if you need to override.

The tool auto-creates a Substack draft and returns an editor URL. Hand the URL to Joe for final review and one-click publish.

**Requirements:** `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL` must be set in `.env`. See `.env.example` for setup instructions (one-time Chrome cookie grab).

## Style Guide

- **Tone:** Informed but accessible. Data-heavy but narrative-driven. Like The Ringer meets OverTheCap.
- **Tables:** Use liberally — readers scan tables before reading paragraphs
- **Expert quotes:** Format as blockquotes with attribution: `> *"Quote" — Expert Name*`
- **Disagreements:** Highlight, don't hide. Expert disagreement IS the content.
- **Length:** 2,000-4,000 words (8-15 min read). Long enough to be substantive, short enough to finish.
- **Emoji:** Use sparingly for risk ratings (🟢🟡🔴) and section markers, not decoration
- **Boilerplate:** Every article ends with the "Welcome to the Lab" footer (virtual front office + human editor + Lab brand) + engagement CTA + a cliffhanger-style next article tease

## Anti-Patterns

- ❌ Don't write generic "both sides have a point" conclusions — take a position
- ❌ Don't use all 45 agents — 2-4 experts per article, max
- ❌ Don't make every article agree internally — disagreement is what makes expert panels compelling
- ❌ Don't skip the data tables — they're the credibility backbone
- ❌ Don't bury the recommendation — lead with it or build clearly toward it
- ❌ Don't end with a flat "next article" blurb — the teaser should make the next piece feel necessary

## Validated On

- ✅ "The Seahawks Have a Hole at RB" — RB1A analysis article (2026-03-14)
  - Used: SEA + Cap + Injury + CollegeScout + Offense + Media
  - Result: ~3,500 words, strong narrative arc, expert quotes throughout
  - Feedback: User said "Wow - that came out amazing"
- ✅ "Our Cap Expert Says $27 Million..." — Witherspoon extension (2026-03-14)
  - Used: Cap + PlayerRep + SEA → Editor caught 6 errors including McDuffie All-Pro miscount
  - Result: ~3,800 words, expert disagreement format worked perfectly
  - First article through the Editorial Review pipeline

## Production Pipeline (Updated)

```
1. Topic selected from content/article-ideas.md
2. Expert agents spawned in parallel
3. Panel outputs collected; fact-check preflight run → panel-factcheck.md saved (gate between Stage 4 & 5)
4. Writer assembles draft from expert output + preflight guidance
5. Writer calls generate_article_images → images saved to content/images/{slug}/
6. Editor reviews draft + images — fact-check + style + structure + image review
7. Fixes applied if needed → re-review if errors
8. Saved to content/articles/ and committed, including images/
9. Publisher pass → publish_to_substack called → draft URL returned to Joe
10. Joe reviews in Substack editor → clicks Publish
```

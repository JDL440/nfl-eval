# Substack Article Generation — Skill

> **Confidence:** medium
> **Created:** 2026-03-14
> **Last validated:** 2026-03-14 (RB article for NFL Lab)

## Purpose

Generate long-form Substack articles for "NFL Lab" (or similar expert-panel sports blogs) by synthesizing multi-agent analysis into a compelling, reader-friendly narrative with expert-panel framing.

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

### Phase 3: Write the Article (Writer Agent)

**Writer takes the raw expert output and crafts it into a polished Substack article.** Writer follows the house style guide in their charter and the structure template below. Writer does NOT fact-check — that's Editor's job.

Spawn Writer with:
- The topic brief
- All raw expert analysis (pasted into the prompt)
- The structure template below

Writer produces a complete markdown draft saved to `content/articles/{slug}.md`.

**Structure Template:**

```markdown
# {Clickbait-worthy but substantive headline}

*{Subheadline describing the expert panel angle}*

---

**By: The NFL Lab Expert Panel**

{Opening hook — 2-3 paragraphs setting up the problem/question. Make it visceral.
Use the team's current situation to create urgency.}

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

---

*{Boilerplate: about the expert panel, what it does, invite engagement}*

*Want us to evaluate a {trade/signing/scenario}? Drop it in the comments.*

---

**Next from the panel:** {Tease the next article topic}
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

### Phase 5: Editorial Review (MANDATORY)

**Editor reviews every article before it goes to `content/articles/`.** This is non-negotiable.

Spawn Editor (sync) with the draft article. Editor produces:
- 🔴 **ERRORS** — factual mistakes that must be fixed (wrong names, bad stats, stale info)
- 🟡 **SUGGESTIONS** — strong recommendations for style/structure
- 🟢 **NOTES** — minor polish items

**Verdict:** ✅ APPROVED / 🟡 REVISE / 🔴 REJECT

If 🔴 errors exist, fix them and re-submit. The Emmanwori name error (mixing Nick Emmanwori with Nehemiah Pritchett) is the founding example of why this step exists.

### Phase 6: Polish & Store

1. Save article to `content/articles/{slug}.md`
2. Commit with descriptive message
3. Tease the next article at the end (creates a content pipeline)

### Phase 7: Publish to Substack

Call `publish_to_substack` to push the article to Substack as a draft:

```
publish_to_substack(
  file_path: "content/articles/{slug}.md",
  title: "{Final headline — may refine from working title}",
  subtitle: "{1-line hook used for email preview}",
  audience: "everyone"
)
```

**Team section is auto-detected** from `primary_team` in `content/pipeline.db` — no need to pass `team` manually. The tool looks up the article by its path, finds the team, and routes to the correct section. Pass `team:` explicitly only if you need to override.

The tool auto-creates a Substack draft and returns an editor URL. Hand the URL to Joe for final review and one-click publish.

**Requirements:** `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL` must be set in `.env`. See `.env.example` for setup instructions (one-time Chrome cookie grab).

## Style Guide

- **Tone:** Informed but accessible. Data-heavy but narrative-driven. Like The Ringer meets OverTheCap.
- **Tables:** Use liberally — readers scan tables before reading paragraphs
- **Expert quotes:** Format as blockquotes with attribution: `> *"Quote" — Expert Name*`
- **Disagreements:** Highlight, don't hide. Expert disagreement IS the content.
- **Length:** 2,000-4,000 words (8-15 min read). Long enough to be substantive, short enough to finish.
- **Emoji:** Use sparingly for risk ratings (🟢🟡🔴) and section markers, not decoration
- **Boilerplate:** Every article ends with the expert panel description + engagement CTA + next article tease

## Anti-Patterns

- ❌ Don't write generic "both sides have a point" conclusions — take a position
- ❌ Don't use all 45 agents — 2-4 experts per article, max
- ❌ Don't make every article agree internally — disagreement is what makes expert panels compelling
- ❌ Don't skip the data tables — they're the credibility backbone
- ❌ Don't bury the recommendation — lead with it or build clearly toward it

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
2. Expert agents spawned in parallel (Phase 2)
3. Writer assembles draft from expert output (Phase 3)
4. Editor reviews draft — fact-check + style + structure (Phase 5)
5. Fixes applied if needed → re-review if 🔴 errors
6. Saved to content/articles/ and committed (Phase 6)
7. publish_to_substack called → draft URL returned to Joe (Phase 7)
8. Joe reviews in Substack editor → clicks Publish
```

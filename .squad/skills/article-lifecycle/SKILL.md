---
name: "article-lifecycle"
description: "Canonical 8-stage process for producing articles from idea to dashboard review and live publish"
domain: "content-production"
confidence: "low"
source: "manual — designed by Joe Robinson & Lead, not yet validated end-to-end"
---

# Article Lifecycle — Skill

> **Confidence:** low — new skill, not yet validated end-to-end
> **Created:** 2026-03-14
> **Last validated:** n/a (stages 2–3 and 7 are new; stages 4–6 validated via substack-article skill)

## Purpose

The canonical process reference for how every article gets made — from first spark to live on Substack. Every agent (Lead, Writer, Editor, future Publisher) reads this skill and knows exactly where they fit, what they receive, and what they hand off.

This is **coordinator-level guidance**. It tells Lead how to orchestrate the full lifecycle. For drafting/editorial detail, agents should read the [`substack-article` skill](../substack-article/SKILL.md), which remains the authoritative reference for Phases 5–6.

> **Runtime model policy:** `.squad/config/models.json` is the source of truth, and `python content/model_policy.py select ...` is the executable selector for stage/task-family model resolution.

## When to Use

- Any time an article enters production (from idea approval through publish)
- When Lead needs to decide what stage an article is in and who acts next
- When a new agent (Writer, Editor, future Publisher) needs to understand the full pipeline
- When Joe wants to manually shepherd an article through the Publisher pass

## Lifecycle Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ARTICLE LIFECYCLE — 8 STAGES                       │
├──────┬──────────────────────┬────────────────┬─────────────────────────┤
│ Stage│ Name                 │ Owner          │ Output                  │
├──────┼──────────────────────┼────────────────┼─────────────────────────┤
│  1   │ Idea Generation      │ Anyone         │ Entry in article-ideas  │
│  2   │ Discussion Prompt    │ Lead           │ Structured brief        │
│  3   │ Panel Composition    │ Lead           │ Named panel + rationale │
│  4   │ Panel Discussion     │ Panel agents   │ Raw expert analysis     │
│  5   │ Article Drafting     │ Writer         │ Draft in content/articles│
│  6   │ Editor Pass          │ Editor         │ Verdict + corrections   │
│  7   │ Publisher Pass       │ Lead → Joe     │ Dashboard-ready handoff │
│      │                      │                │ package                 │
│  8   │ Published            │ Joe via        │ Live on Substack        │
│      │                      │ dashboard      │                         │
└──────┴──────────────────────┴────────────────┴─────────────────────────┘
```

### Status Flow

```
💡 Proposed  →  ✅ Approved  →  🚀 In Production  →  ✅ Published
                     │                                      │
                     └──── 🗄️ Archived ◄───────────────────┘
```

An idea in `content/article-ideas.md` moves through these statuses. "In Production" spans stages 2–7. The status updates in `article-ideas.md` once an article is published or archived.

---

## Stage 1 — Idea Generation

**Owner:** Anyone (Joe, Media, Lead, any team agent)
**Output:** New entry in `content/article-ideas.md`
**Status on entry:** 💡 Proposed

### What triggers an idea

| Source | Trigger | Example |
|--------|---------|---------|
| Joe | Any prompt or direction | "Write about the Witherspoon extension" |
| Media agent | FA sweep flags a high-signal move | Significance score ≥ 4 from media-sweep skill |
| Lead | NFL calendar milestone approaching | Draft week, schedule release, cut day |
| Team agent | Roster event with article potential | Star player traded, major extension signed |

### Idea format

Every idea in `content/article-ideas.md` needs:

| Field | Required | Description |
|-------|----------|-------------|
| Title / headline idea | ✅ | Working title — can be refined later |
| Angle / tension | ✅ | What makes this worth reading? The conflict or question. |
| Team(s) | ✅ | Primary team + any secondary teams involved |
| Urgency / timing | ✅ | Target publish date or window (e.g., "before draft") |
| Agents needed | ✅ | Estimated panel (can change at Stage 3) |
| Status | ✅ | 💡 Proposed (default for new ideas) |
| Depth level | ✅ | Default: **2 — The Beat** (see Depth Levels below) |

### Done when

- [ ] Idea is written in `content/article-ideas.md` with all required fields including depth level
- [ ] Status is 💡 Proposed
- [ ] Joe has reviewed (ideas auto-advance to ✅ Approved only with Joe's explicit go-ahead)

### GitHub Issue-Triggered Idea Generation (NEW)

When GitHub issues are created with **"IDEA GENERATION REQUIRED"** (no pre-written angle), Lead runs idea generation as **Step 1b of the pipeline** (see Lead charter).

**Process:**
1. Lead reads `.squad/skills/idea-generation/SKILL.md` (mandatory)
2. Lead fetches current data for the team (OTC cap page, ESPN roster, news search)
3. Lead generates the idea using current 2026 offseason context
4. Lead posts the generated idea as a comment on the issue
5. Pipeline continues using the generated idea — no further approval needed unless Joe requests it

**Model requirement:** ALWAYS use **`claude-opus-4.6`** for this step (non-negotiable — cheaper models produce stale angles)

**Rationale:** The 30-team issue batch revealed that pre-written angles (generated up front without current research) were stale by at least one season. Idea generation MUST happen in real-time with current data.

---

## Depth Levels

Every article has a depth level. Set it at Stage 1, adjust at Stage 2 or Stage 5 if needed. Default is **2 — The Beat**.

| Level | Name | Reader | What it means |
|-------|------|--------|---------------|
| 1 | **Casual Fan** | Watches games, knows the stars | Narrative-first. Minimal jargon. Cap numbers in plain English. One clear takeaway. ~1,200–2,000 words. |
| 2 | **The Beat** | Follows the team, reads the coverage | Balance of story and data. Assumes roster knowledge, explains mechanics. ~2,000–3,500 words. **Default.** |
| 3 | **Deep Dive** | Cap nerd, film watcher, scheme analyst | Full data. Contract breakdowns, comp picks, scheme fits, injury history. Assumes expert fluency. ~3,000–5,000 words. |

### How depth level affects each stage

**Stage 2 (Discussion Prompt):** Lead notes depth level in the prompt header. Determines how much jargon/data the brief expects panelists to produce.

**Stage 4 (Panel Discussion):** Agent spawn instructions include the depth level as a tone signal:
- Level 1: *"Write for someone who just watched the game highlights. No jargon. One clear takeaway."*
- Level 2: *"Write for a knowledgeable fan who follows the team closely. Data OK, but explain what it means."*
- Level 3: *"Full analysis. Assume cap fluency, scheme knowledge, draft comp familiarity. Don't simplify."*

**Stage 5 (Article Drafting):** Writer tunes headline style, data density, and explanation depth to the level. Level 1 headlines lean narrative; Level 3 headlines can lead with numbers.

**Stage 7 (Publisher Pass):** Depth level informs tag choices.

### Adjusting depth level

Depth is set on the idea but can change:
- **Before Discussion Prompt (Stage 2):** Lead adjusts based on story complexity
- **Before Article Drafting (Stage 5):** Writer flags if panel outputs don't match the target level — Lead decides whether to re-level or re-prompt

When adjusted, update `content/pipeline.db`:
```python
conn.execute("UPDATE articles SET depth_level=?, updated_at=datetime('now') WHERE id=?", (new_level, article_id))
conn.execute("INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes) VALUES (?,?,?,?,?)",
             (article_id, current_stage, current_stage, agent_name, f"Depth level adjusted to {new_level}"))
conn.commit()
```

Before spawning panelists, Writer, or Editor after a depth change, re-resolve the model through `content/model_policy.py` so the requested model, tier, and precedence stay aligned with the current policy.

---

## Stage 2 — Discussion Prompt

**Owner:** Lead
**Input:** An ✅ Approved idea from `article-ideas.md`
**Output:** A structured brief (the Discussion Prompt artifact)
**Status on entry:** ✅ Approved → 🚀 In Production

This is the step that separates good articles from generic analysis. The tension and angle are defined **up front**, not discovered after the panel runs.

### Discussion Prompt Template

```markdown
# Discussion Prompt: {Working Title}

**Depth Level:** {1 — Casual Fan | 2 — The Beat | 3 — Deep Dive}

## Central Question
{One sentence. What is this article trying to answer?}

## The Tension
{What's the conflict? Where do reasonable people disagree?
This is the engine of the article — if there's no tension, there's no article.}

## What Would Make This Worth Reading
{Why should a fan click? What will they learn that they can't get from ESPN?
Be specific — "insider analysis" is not enough.}

## Scope & Constraints
- **Team(s):** {primary and secondary}
- **Time horizon:** {this offseason? next 3 years? career arc?}
- **Data needed:** {cap numbers, draft comps, injury history, etc.}
- **Recency cutoff:** {any events that must be included or excluded}

## Panel (see Stage 3)
| Agent | Role on Panel | Specific Question for This Agent |
|-------|---------------|----------------------------------|
| {agent} | {why they're here} | {their specific angle/question} |

## Target
- **Length:** {2,000–4,000 words}
- **Publish window:** {date or range}
- **Audience note:** {anything specific about who's reading this one}
```

### Done when

- [ ] Discussion Prompt is fully filled out — no placeholder fields
- [ ] Central Question is a single, clear sentence
- [ ] Tension is identified and non-trivial (not "both sides have a point")
- [ ] Panel section is drafted (finalized in Stage 3)

---

## Stage 3 — Panel Composition

**Owner:** Lead
**Input:** Discussion Prompt from Stage 2
**Output:** Final panel (2–5 agents) with per-agent rationale and questions

### Composition Rules

1. **Always include the relevant team agent(s)** — they own the roster context
2. **Always include at least one specialist** — Cap, Offense, Defense, etc.
3. **Panel size is gated by depth level** (source of truth: `.squad/config/models.json` → `panel_size_limits`):

   | Depth Level | Min | Max |
   |-------------|-----|-----|
   | 1 — Casual Fan | 2 | **2** |
   | 2 — The Beat | 3 | **4** |
   | 3 — Deep Dive | 4 | **5** |

4. **Use gpt-5-mini for panel composition recommendation** — see [Lightweight Tasks](#lightweight-tasks-gpt-5-mini) below. Lead reviews and approves before spawning agents.
5. **Never use all ~45 agents** — that's an anti-pattern, not thoroughness

### Panel Selection Matrix

| Article Type | Required | Recommended | Optional |
|-------------|----------|-------------|----------|
| Free agent signing | Team, Cap | PlayerRep, Offense or Defense | Media (market context) |
| Contract extension | Cap, PlayerRep | Team | Offense or Defense (scheme fit) |
| Trade evaluation | Both teams, Cap | Draft (if picks), PlayerRep | Analytics |
| Draft prospect | CollegeScout, Team | Draft, Offense or Defense | Injury, Analytics |
| Draft class review | Draft, CollegeScout, Team | Offense, Defense | Cap, Analytics |
| Scheme analysis | Offense or Defense, Team | Analytics | CollegeScout (if prospects) |
| Injury impact | Injury, Team | Cap | Offense or Defense |
| Roster construction | Team, Cap, Offense or Defense | Analytics | SpecialTeams |
| Divisional breakdown | All division teams | Cap, Analytics | Offense, Defense |
| Season preview / recap | Team, Analytics | Offense, Defense | Media |

### Anti-patterns

- ❌ Picking agents because they're available, not because they add a distinct angle
- ❌ Duplicating perspectives — if Cap and PlayerRep both cover money, give them different questions
- ❌ Omitting the team agent — they're the connective tissue for any team-specific article
- ❌ Panel of 1 — that's a report, not a panel discussion

### Done when

- [ ] 2–5 agents selected
- [ ] Each agent has a named role and a specific question tailored to this article
- [ ] At least one team agent and one specialist are on the panel
- [ ] Discussion Prompt's Panel section is updated with final selections
- [ ] Potential disagreements identified (e.g., "Cap and PlayerRep will likely disagree on extension value")

---

## Stage 4 — Panel Discussion

**Owner:** Lead (orchestrates); Panel agents (execute)
**Input:** Discussion Prompt with finalized panel
**Output:** Raw expert analysis from each panelist

### Execution

Lead spawns all panel agents **in parallel**. Each agent receives:

1. **The Discussion Prompt** (full document from Stage 2)
2. **Their specific angle/question** (from the Panel table)
3. **Article-mode instructions:**

```
Your analysis will be used in a Substack article for "NFL Lab."
Provide your expert assessment with:
- Specific numbers and projections (not vague ranges)
- A clear bottom-line recommendation
- Quotable one-liner summary of your position
- Areas where you DISAGREE with other experts (Cap vs PlayerRep, Team vs Scheme, etc.)
- Flag any data you'd want verified before publish
```

4. **Instructions to read their own charter.md and history.md** for context

### Output format

Each panelist produces a raw analysis document. Lead collects all outputs and passes them to Writer in Stage 5.

### Done when

- [ ] All panelists have returned their analysis
- [ ] Each analysis includes: numbers, recommendation, quotable summary, disagreement flags
- [ ] Lead has reviewed outputs for obvious gaps (if a panelist missed their question, re-prompt)
- [ ] All raw outputs are ready to hand to Writer

> **Detail reference:** See [`substack-article` SKILL.md](../substack-article/SKILL.md), Phase 2 for prompt templates and expert-spawn mechanics. This skill supersedes that phase for orchestration; the substack-article skill remains authoritative for prompt wording.

---

## Stage 5 — Article Drafting (Writer)

**Owner:** Writer
**Input:** Discussion Prompt + all raw panel outputs
**Output:** Draft article saved to `content/articles/{slug}/draft.md`

Writer takes all panel outputs and assembles a polished article following the house style: **The Ringer meets OverTheCap** — informed but accessible, data-heavy but narrative-driven.

> **Full guidance:** See [`substack-article` SKILL.md](../substack-article/SKILL.md), Phase 3 (structure template), Phase 4 (headline craft), and Style Guide. This skill does not duplicate that material.

### Key reminders

- Writer does **not** fact-check — that's Editor's job in Stage 6
- Disagreements between panelists are **content**, not problems to resolve
- Draft goes to `content/articles/{slug}/draft.md` — not directly to Substack
- Target length: 2,000–4,000 words (8–15 min read)

### Done when

- [ ] Draft saved to `content/articles/{slug}/draft.md`
- [ ] Article follows the structure template from substack-article skill
- [ ] All panelists' analysis is represented (none dropped)
- [ ] Headline follows the formula options in substack-article skill
- [ ] Boilerplate footer included (expert panel description + CTA + cliffhanger-style next article tease)

---

## Stage 6 — Editor Pass

**Owner:** Editor
**Input:** Draft article from `content/articles/{slug}/draft.md`
**Output:** Editorial verdict + categorized corrections

Editor reviews the draft for factual accuracy, structural issues, and style compliance. This is **mandatory** — no article skips the Editor pass.

> **Full guidance:** See [`substack-article` SKILL.md](../substack-article/SKILL.md), Phase 5. Editor's review protocol, error categories, and the Emmanwori founding example are documented there.

### Output format

| Category | Meaning | Action |
|----------|---------|--------|
| 🔴 ERRORS | Factual mistakes — wrong names, bad stats, stale info | Must fix before proceeding |
| 🟡 SUGGESTIONS | Strong recommendations for style/structure | Should fix; Writer's judgment |
| 🟢 NOTES | Minor polish items | Optional |

**Verdict:** ✅ APPROVED / 🟡 REVISE / 🔴 REJECT

### Revision loop

- If 🔴 errors exist → Writer fixes → Editor re-reviews
- If 🟡 REVISE → Writer addresses suggestions → Editor confirms
- If 🔴 REJECT → back to Stage 4 or 5 depending on the issue (structural vs. factual)
- Loop continues until verdict is ✅ APPROVED

### Done when

- [ ] Editor has issued a verdict
- [ ] All 🔴 errors are resolved
- [ ] Final verdict is ✅ APPROVED
- [ ] Approved draft is committed to `content/articles/{slug}/draft.md`
- [ ] Editor has verified the "Next from the panel" hook points to a real planned follow-on article and reads like a cliffhanger

---

## Accuracy Gates

Every article must pass three accuracy checks before moving to Stage 7 (Publisher Pass):

### Gate 1: Temporal Accuracy
- All player stats refer to the most recently completed season (not a prior season)
- Year references (e.g., "Year 2", "Year 3") reflect the UPCOMING season, not the season just played
- Cap figures, roster construction, and coaching staff reflect the current offseason (not last year's)

### Gate 2: TLDR Present
- Article must have a `> **📋 TLDR**` callout block immediately after the opening hook
- TLDR must have 3-4 bullet points: situation, assets, verdict, central debate
- Editor is responsible for verifying TLDR presence and accuracy

### Gate 3: Player/Staff Name Accuracy
- All player names, coach names, and team staff verified (no invented first names)
- Draft prospects are real 2026 prospects, not hallucinated names
- Contract figures are sourced (OTC/Spotrac citation in text or table)

---

## Stage 7 — Publisher Pass

**Owner:** Lead prepares the handoff; Joe reviews in the dashboard
**Input:** Editor-approved draft from `content/articles/{slug}/draft.md`
**Output:** Dashboard-ready article with a completed publisher checklist. No Substack publish happens yet.
**DB update:** Advance to `current_stage=7`, record `publisher_pass` details

Stage 7 is the **pause point before any Substack publish step**. The article stays local while Lead finishes the publisher pass, confirms the final checklist, and hands the article to Joe in the dashboard. The dashboard preview is the review surface immediately before live publish.

### How to Run Stage 7

Lead completes the handoff locally:

1. Ensure the article markdown, inline images, and publisher-pass artifact are complete.
2. Confirm every publisher-pass field is true in `content/pipeline.db`.
3. Hand Joe the dashboard article page (`/article/{slug}`) for preview/validation review.
4. Stop here. The main pipeline does **not** call `publish_to_substack` during Stage 7.

Draft creation/update can still happen later, but it is part of the dashboard publish action rather than the Stage 7 handoff itself.

### Dashboard Publish Checklist

Copy this to the article thread before handoff. Lead confirms content items; Joe uses the dashboard page for final preview/validation review before publishing.

```markdown
## Publisher Pass — {Article Title}

### Publisher Pass Fields
- [ ] Title final
- [ ] Subtitle final
- [ ] Body clean
- [ ] Section assigned
- [ ] Tags set
- [ ] URL slug set
- [ ] Cover image set
- [ ] Paywall set
- [ ] Names verified
- [ ] Numbers current
- [ ] No stale refs

### Dashboard Review
- [ ] Preview looks correct in the dashboard
- [ ] Validation checks are green or understood
- [ ] Publish promotion channels selected (Substack Note is the default)
```

### Done when

- [ ] DB updated: `current_stage=7`, `publisher_pass` row inserted, stage transition recorded
- [ ] Publisher-pass fields are complete
- [ ] Joe has the dashboard article page and can review/publish from there
- [ ] **GitHub issue label updated** (optional visibility mirror): `stage:publisher-pass` or similar label added if it exists. Labels reflect state for human visibility; DB `current_stage` is the authoritative scheduler source of truth.

---

## Stage 8 — Published

**Owner:** Joe Robinson via the dashboard publish action
**Input:** Dashboard-reviewed Stage 7 article + selected promotion channels
**Output:** Live article on Substack, plus any successful follow-on promotions
**DB update:** Set `published_at`, `substack_url`, `status='published'`, `current_stage=8`; record promotion results such as Notes separately

### Process

1. **Joe opens the dashboard article page** for the Stage 7 article.
2. **Joe reviews** preview, validation output, and the completed publisher pass.
3. **Joe clicks Publish** from the dashboard, leaving the default Substack Note enabled unless there is a reason to suppress it.
4. **The dashboard publish flow** creates or updates the Substack draft behind the scenes, publishes it live, records the live URL, and then dispatches selected promotions.
5. **If live publish fails before a public URL exists,** the article stays at Stage 7 for retry. If the article goes live but a promotion fails, the article remains Stage 8 and the failed promotion is retried separately.
5. **Post-publish cleanup:**

| Task | How |
|------|-----|
| Update `content/article-ideas.md` | Change status to ✅ Published, add publish date |
| Update `content/pipeline.db` | Handled by the dashboard publish flow via `content/pipeline_state.py` |
| **GitHub issue label update** | Add `stage:published` label (optional visibility mirror). GitHub labels reflect pipeline state for human visibility; DB `current_stage` is the authoritative scheduler source of truth. |
| Git commit | `git add . && git commit -m "Published: {article title}"` |
| Content pipeline | Ensure "Next from the panel" tease at article end points to a real upcoming idea |
| Follow-on issue | Create or confirm a GitHub idea issue for the teased next article, targeted for Thursday of the publication week (current default cadence) |
| **History maintenance** | Run history summarization for all agents that participated (see [history-maintenance skill](../history-maintenance/SKILL.md)) |
| Promotions | Confirm the selected promotion channels succeeded; retry any failures separately |

### Done when

- [ ] Article is live on Substack
- [ ] `content/article-ideas.md` reflects ✅ Published with date and Substack URL
- [ ] Follow-on GitHub idea issue exists for the teased next article (Thursday-of-week target by default)
- [ ] Git repo is committed and clean
- [ ] Cross-post plan executed (if applicable)

---

## Lightweight Tasks (gpt-5-mini)

> **Model:** `gpt-5-mini` — use for classification, slot-filling, and structured compression. Does not require deep football reasoning. See `.squad/config/models.json` → `models.lightweight`.
> **Max tokens:** 800 per call.

These tasks do not need a heavy model. Using gpt-5-mini here costs near-zero and keeps Opus/Sonnet budget for the content that matters.

| Stage | Task | Prompt Pattern | Expected Output |
|-------|------|----------------|-----------------|
| **Stage 1** | Idea viability triage | "Given this article idea and the current NFL calendar, is this worth producing now? Answer: YES/NO with a 1-sentence rationale." | YES or NO + 1 sentence |
| **Stage 3** | Panel composition recommendation | "Given this article type ({type}), depth level ({level}), and available agents ({list}), recommend the optimal {N} agents to include. For each agent, give a 1-sentence rationale." | JSON array of agent names + rationale |
| **Stage 7** | Article metadata extraction | "Extract from this article: primary_team, secondary_teams (array), topic_tags (3–5). Return as JSON." | JSON object |
| **Stage 8** | History entry draft | "Summarize this article's key facts in 3–5 bullets for an agent's history file. Include: topic, key numbers, recommendation, any notable disagreement. Max 200 words." | Bullet list |
| **Ongoing** | History summarization | See [history-maintenance skill](../history-maintenance/SKILL.md) | Compressed history block |

### Panel Composition via gpt-5-mini (Stage 3 detail)

```
You are helping compose a panel of NFL analysts for an article.

Article type: {e.g., "contract extension"}
Depth level: {1 / 2 / 3}
Panel size limit: {from models.json panel_size_limits}
Article description: {1–2 sentence idea summary}

Available agents:
Specialists: Cap, PlayerRep, Draft, Offense, Defense, Analytics, Injury, SpecialTeams, CollegeScout, Media
Team Agents: SEA, SF, LAR, ARI, KC, DEN, LV, LAC, DAL, PHI, NYG, WSH, CHI, GB, MIN, DET, TB, NO, ATL, CAR, NE, BUF, NYJ, MIA, BAL, PIT, CLE, CIN, HOU, TEN, IND, JAX

Select exactly {N} agents. For each, give a 1-sentence rationale for why they add a distinct perspective.
Return as JSON: [{"agent": "SEA", "rationale": "..."}, ...]
```

Lead reviews the recommendation and can override before spawning.

---

## Stage Transition Summary

| From → To | Gate (what must be true) | Who decides |
|-----------|--------------------------|-------------|
| 1 → 2 | Idea approved by Joe | Joe |
| 2 → 3 | Discussion Prompt complete, tension identified | Lead |
| 3 → 4 | Panel finalized (2–5 agents), each with specific question | Lead |
| 4 → 5 | All panelists returned analysis, Lead reviewed for gaps | Lead |
| 5 → 6 | Draft saved to `content/articles/{slug}/draft.md` | Writer |
| 6 → 7 | Editor verdict is ✅ APPROVED (all 🔴 resolved) | Editor |
| 7 → 8 | Joe approves the dashboard review and the live publish succeeds (`substack_url` recorded) | Joe |
| 8 → Done | Article live on Substack, cleanup complete, promotions handled as needed | Joe |

## Recovery & Edge Cases

| Situation | Recovery |
|-----------|----------|
| Editor rejects draft (🔴 REJECT) | Back to Stage 4 (re-gather analysis) or Stage 5 (rewrite) depending on issue |
| Panelist misses their question | Lead re-prompts that specific agent (don't re-run entire panel) |
| Breaking news makes article stale mid-production | Lead decides: update in place (if minor), restart from Stage 2 (if angle changed), or archive |
| Joe rejects during dashboard review | Back to Stage 6 or remain at Stage 7 depending on the issue type |
| Dashboard publish or promotion fails | If no live URL exists, remain at Stage 7 and retry publish. If the article is already live, remain at Stage 8 and retry only the failed promotion. |
| Article idea becomes irrelevant | Mark 🗄️ Archived in `article-ideas.md` with reason |

## Anti-Patterns

- ❌ Skipping the Discussion Prompt (Stage 2) — leads to unfocused panels and generic articles
- ❌ Letting Writer fact-check — that's Editor's job; separation of concerns
- ❌ Publishing without Editor pass — the Emmanwori error is the founding lesson
- ❌ Using 5+ panelists for a focused single-player article — 2–3 is better
- ❌ Treating the Publisher Pass as optional — even when manual, the checklist catches metadata gaps
- ❌ Advancing past Stage 1 without Joe's explicit approval — ideas don't auto-approve

## Pipeline Database

Every article has a row in `content/pipeline.db`. Agents MUST update it at each stage transition. Use Python (always available) — no sqlite3 CLI required.

**Stage semantics:** Use numeric integer values 1–8 for `current_stage` per the schema. String-valued stage names are deprecated — always write numeric stages.

### Agent Write Pattern

**Preferred:** Use the shared helper at `content/pipeline_state.py` for all DB writes. This validates numeric stages, logs transitions, and prevents drift.

```python
from content.pipeline_state import PipelineState

ps = PipelineState()                           # auto-finds content/pipeline.db
ps.advance_stage('slug', from_stage=3, to_stage=4, agent='Lead')
ps.set_discussion_path('slug', 'content/articles/slug/discussion-summary.md')
ps.set_article_path('slug', 'content/articles/slug/draft.md')
ps.record_editor_review('slug', 'REVISE', errors=2, suggestions=3)
ps.record_publisher_pass('slug', title_final=1, body_clean=1, tags_set=1)
ps.record_publish('slug', 'https://nfllab.substack.com/p/slug')
ps.close()
```

**Fallback (only if import unavailable):**

```python
import sqlite3
conn = sqlite3.connect('content/pipeline.db')
```

### Required DB writes by stage

| Stage | Agent | Required write | Notes |
|-------|-------|----------------|-------|
| 1 | Anyone | `INSERT INTO articles` with id, title, primary_team, teams, status='proposed', current_stage=1 | Numeric stage=1 |
| 2 | Lead | `INSERT INTO discussion_prompts`; advance article to current_stage=2, status='approved' | Numeric stage=2 |
| 3 | Lead | `INSERT INTO article_panels` (one row per panelist); advance to current_stage=3 | Numeric stage=3 |
| 4 | Lead | Mark `analysis_complete=1` in article_panels as each panelist returns; set `discussion_path`; advance to current_stage=4 | Numeric stage=4; `discussion_path` field exists in schema |
| 5 | Writer | Set `article_path`; advance to current_stage=5, status='in_production' | Numeric stage=5 |
| 6 | Editor | `INSERT INTO editor_reviews` with verdict + counts; advance to current_stage=6 | Numeric stage=6 |
| 7 | Lead / Publisher | `INSERT INTO publisher_pass`; advance to current_stage=7 | Numeric stage=7 |
| 8 | Joe | Set published_at, substack_url, status='published', current_stage=8 | Numeric stage=8 (final) |
| 8+ | Lead / Agent | `ps.record_note()` in `notes` table (optional, post-publish) | Notes are a post-publish action, not a new stage. Default path: let the dashboard publish action send the Note with live publish. Use `publish_note_to_substack` only for retry/manual follow-up after the article is live. |

### Stage transition helper

Every stage change also inserts a row in `stage_transitions`. Prefer `PipelineState.advance_stage()` which handles this automatically:

```python
from content.pipeline_state import PipelineState
ps = PipelineState()
ps.advance_stage(article_id, from_stage=5, to_stage=6, agent='Editor', notes='Editor review complete')
```

**Manual fallback** (only if helper unavailable):

```python
# Use numeric stages (1-8) consistently
conn.execute(
    """INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes)
       VALUES (?,?,?,?,?)""",
    (article_id, from_stage, to_stage, agent_name, notes)
)
conn.execute(
    "UPDATE articles SET current_stage=?, updated_at=datetime('now') WHERE id=?",
    (to_stage, article_id)
)
conn.commit()
```

**Artifact-first discovery:** When determining the current state of an article, use `python content/article_board.py actions` to get the prioritized next-action queue. The board checks local artifacts first (published proof > `publisher-pass.md` > `editor-review.md` > `draft.md` > discussion outputs), then reconciles DB state to match filesystem reality. The DB is the ledger; the filesystem is the source of truth for what work has been completed.

**Reconciliation:** Run `python content/article_board.py reconcile` for a dry-run drift report. Use `python content/article_board.py --repair` to fix DB discrepancies (logs all repairs in `stage_transitions`).

### Visualization

```
pip install datasette && datasette content/pipeline.db --open
```

Opens a web UI at `http://localhost:8001` — browse all tables and the `pipeline_board` view (sorted by active → proposed → published).

### Schema reference

Full schema: `content/schema.sql`
Tables: `articles`, `stage_transitions`, `article_panels`, `discussion_prompts`, `editor_reviews`, `publisher_pass`
View: `pipeline_board` (one row per article with stage name + sort by status)

**GitHub labels as visibility mirrors:** `stage:*` labels on GitHub issues MAY be updated to reflect current article state for human visibility, but they are NOT the source of truth for scheduling or next-action determination. The scheduler reads `current_stage` from `pipeline.db` and artifact presence from `content/articles/`. Labels are optional documentation, not control-plane inputs.

---

## Relationship to Other Skills

| Skill | Relationship |
|-------|-------------|
| [`substack-article`](../substack-article/SKILL.md) | **Child detail.** Covers drafting mechanics (structure template, headline formulas, style guide, editorial review protocol). This lifecycle skill is the higher-level wrapper. |
| [`media-sweep-generation`](../media-sweep-generation/SKILL.md) | **Idea feeder.** Media sweeps can trigger Stage 1 ideas when significance score ≥ 4. |
| [`knowledge-recording`](../knowledge-recording/SKILL.md) | **Post-publish.** After publish, agents update their history.md with learnings from the article production. |

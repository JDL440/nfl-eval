---
name: "idea-generation"
description: "How to generate, evaluate, and submit new article ideas for the NFL content pipeline. Covers idea triggers, angle validation, DB schema format, routing to Lead, and batch idea sprints with scoring."
domain: "content-production"
confidence: "low"
source: "manual — designed by Joe Robinson & Lead"
---

# Idea Generation Skill

## Purpose

This skill enables agents across the squad to generate high-quality article ideas that align with reader value, SEA-priority lens, and editorial timelines. All new ideas flow through Lead's decisions inbox for approval before insertion into `content/pipeline.db`.

---

## 1. Idea Triggers — What Sparks a Good Idea?

Ideas come from multiple sources. Train your thinking to recognize these signals:

### News Hooks
- **Media sweep findings**: When Media agents flag trending narratives or breaking developments (player movement, coaching changes, salary cap moves, draft buzz), those become immediate idea candidates
- **Team announcements**: Official roster moves, injury reports, strategic statements from FO
- **League-wide developments**: Playoff implications, draft order shifts, collective bargaining ripples

### Calendar Windows
- **Off-season cycles**: FA wave 1, pre-draft evaluation, draft week itself, training camp ramp-up, preseason games, regular season games
- **Anniversary hooks**: Draft anniversaries (5 years for trade retrospectives), free agency decisions, playoff runs
- **Recurring themes**: Each window has patterns (comp value in FA, value accumulation pre-draft, injury report spikes before games)

### Analytical Gaps
- **Unanswered questions**: What readers ask but haven't seen answered well (e.g., "How does our pass rush rate against top-5 WRs?")
- **SEA-specific angles**: Competitive positioning vs. NFC West, cap efficiency vs. division, draft class performance vs. peers
- **Trend validation**: Market rate for 2-year RBs, secondary value at depth, O-line replacement costs

### Cross-Team Angles
- **SEA in context**: "How do Seahawks compare on …?" (contract structure, draft capital allocation, roster turnover)
- **Comp teams**: Similar roster profile, draft strategy, or market position offers framing
- **Division dynamics**: SEA's edge/deficit in specific categories (pass defense, third-down conversion, salary cap room)

### What Readers Are Asking
- Social media sentiment, forum discussions, email inboxes, and fan engagement signal information voids
- Uncertainty during transitions creates demand (new coaching staff, incoming QB competition, rebuild questions)

---

## 2. Angle Evaluation — Criteria for a Strong Pitch

Before writing up an idea, validate it against these criteria:

| Criterion | Strong Pitch | Weak Pitch |
|-----------|-------------|-----------|
| **SEA Relevance** | Direct impact on roster, cap, or strategy; or exemplifies broader league pattern | Tangential mention; "fun fact" without strategic weight |
| **Reader Value** | Addresses decision-making (draft preference, cap management, win probability) or cultural interest (rivalry, legacy) | Retrospective recap without forward relevance |
| **Uniqueness** | Angle not recently published; data-driven fresh take or underexplored combo | Retreads same narrative; surface-level take |
| **Timeliness** | Aligns with decision windows (draft week for draft ideas, FA week for cap ideas); time-sensitive info | General evergreen; or info already digested |
| **Depth Match** | Angle complexity matches target depth (1=casual headline; 2=balanced fan; 3=analytics deep-dive) | Mismatch (analytics content for casual audience, or oversimplified for deep-dive) |

### Rejection Signals
- Idea is a "hot take" without data backing
- Already published 2-3 times this cycle
- Relevant window closes within 48 hours (too little time for full cycle)
- Idea depends on speculation > available facts

---

## 3. Output Format — Properly-Structured Idea Proposal

Use this template when drafting an idea. Fields map directly to `content/pipeline.db` schema:

```
ID: {url-slug}
Title: {headline — 60-80 characters, reader-facing}
Summary: {2-3 sentence pitch — what, why it matters, proof point}
Teams: [{primary_team}, {secondary_team}, ...]
Primary Team: {team}
Depth Level: {1 | 2 | 3}
  - 1 = Casual (headline + context, minimal analysis)
  - 2 = Balanced (data + narrative, accessible)
  - 3 = Deep-Dive (advanced analytics, detailed breakdown)
Publish Window: {fa-wave-1 | pre-draft | draft-week | may | camp-preview | preseason | regular-season | evergreen | backlog}
Target Date: {YYYY-MM-DD or null if window is sufficient}
Time Sensitive: {yes | no}
  - yes = Idea expires or loses value after a date
  - no = Idea is valid evergreen; publish when capacity allows
Expires: {YYYY-MM-DD or null if evergreen}

Reasoning:
  - Why this angle? (tie to trigger + calendar + reader need)
  - Why now? (timeliness window, news hook, competitive moment)
  - Why this depth? (audience familiarity, analysis required)
  - Where does it fit with recent/planned ideas? (uniqueness check)
```

### Example Idea

```
ID: seahawks-pass-rush-comp-nfcw
Title: How Seahawks Pass Rush Stacks vs. NFC West (and What It Costs)
Summary: Seahawks defensive line depth has implications for 2024 free agency and draft positioning. We compare SEA's edge-rushing efficiency, salary cap allocation, and replacement strategy to 49ers, Rams, and Cardinals to forecast SEA's offseason approach and competitive window.
Teams: [Seattle, San Francisco, Los Angeles, Arizona]
Primary Team: Seattle
Depth Level: 2
Publish Window: pre-draft
Target Date: 2024-02-15
Time Sensitive: yes
Expires: 2024-03-01

Reasoning:
  - Trigger: Media sweep flagged SEA's pass-rush metrics; draft evaluation season (pre-draft window)
  - Timeliness: Aligns with Feb offseason buzz; info becomes stale post-FA
  - Depth: Balanced — data-driven comparison without elite-level analytics gatekeeping
  - Uniqueness: Haven't seen SEA-focused NFCW pass rush comparison this cycle
```

---

## 4. Routing — Getting Ideas Into the Decision Pipeline

All new ideas route through **Lead's decisions inbox** for approval before DB insertion.

### File Naming & Location
```
.squad/decisions/inbox/{agent}-idea-{slug}.md
```

Example:
```
.squad/decisions/inbox/media-idea-seahawks-pass-rush-comp-nfcw.md
```

### File Format
Write your idea proposal as a markdown file with frontmatter:

```yaml
---
type: "idea"
agent: "{your-agent-name}"
idea_id: "{slug}"
score: {numeric score from rubric}
status: "pending"
---

# Article Idea: {Title}

{Full idea proposal using template above}

---

## Evaluation Checklist
- [ ] Trigger is clear (news hook, calendar, gap, etc.)
- [ ] Angle is unique (checked recent 30 ideas)
- [ ] SEA relevance is explicit
- [ ] Reader value is defensible at depth level
- [ ] Window/date alignment is sound
- [ ] Expires/time-sensitive flags are correct
```

### Lead's Review
Lead will:
1. Review score and reasoning
2. Approve (→ DB insertion) or reject (→ feedback in inbox)
3. Update status to "approved" or "rejected"
4. Archive to `.squad/decisions/archive/`

---

## 5. Batch Idea Sessions — Structured 20-Minute Idea Sprints

When running a **batch session**, follow this rhythm:

### Setup (2 min)
- Pick a **window** (e.g., "pre-draft", "may", "regular-season")
- Define scope (e.g., "Pass rush evaluations", "Playoff implications", "Cap optimization")
- Set a **timer for 18 minutes** of generation + filtering

### Generation (10 min)
- **Brainstorm 5–8 angle variations** quickly
  - No critique yet; capture every direction
  - Use idea triggers (news, calendar, gaps, cross-team, reader sentiment)
  - Jot headline + 1-line pitch for each
- Example batch for "pre-draft" window:
  1. Seahawks vs. NFCW draft history (comp teams)
  2. Pass rush replacement cost (analytical gap)
  3. Secondary value at depth (reader question)
  4. Trade-down incentive models (analytical)
  5. Cap flexibility vs. draft capital (analytical + calendar)
  6. Injury history and resilience (evergreen angle)

### Evaluation (6 min)
- Score each idea using the **rubric below** (max 12 points)
- **Filter to top 3** by score (target 8+ threshold)
- Rank and reason briefly for top pick

### Submission (2 min)
- Write full proposal for top 1–3 ideas
- Route to Lead's inbox
- Log batch session in shared log (optional: timestamp + window + ideas submitted)

---

## 6. Scoring Rubric — Quantify Idea Strength

Use this **4-point scale** to evaluate each angle:

| Dimension | 3 Points | 2 Points | 1 Point |
|-----------|----------|----------|---------|
| **SEA Relevance** | Direct impact on decisions or strategy; clear SEA lens | Relevant but secondary; mixed SEA angle | Tangential or generic; no SEA angle |
| **Timeliness** | Aligns perfectly with current window or news cycle | Loosely aligned; valid but not urgent | Off-cycle; evergreen only; dated info |
| **Reader Value** | Addresses decision-making or cultural significance; audience clear | Moderately useful; audience somewhat clear | Low utility; audience unclear |
| **Uniqueness** | Fresh angle; data-driven; not covered this cycle | Variation on recent idea; some novelty | Retreads; same narrative as prior pieces |

### Scoring Example

**Idea: "Seahawks Pass Rush vs. NFCW"**
- SEA Relevance: 3 (direct roster + draft impact)
- Timeliness: 3 (pre-draft window, Feb news hook)
- Reader Value: 2 (useful for draft nerds; less for casual fans)
- Uniqueness: 3 (no comp analysis this cycle)
- **Total: 11/12** ✓ Submit

**Idea: "NFL Hall of Famers from Small Colleges"**
- SEA Relevance: 1 (no SEA lens)
- Timeliness: 1 (evergreen; no urgent hook)
- Reader Value: 2 (fun facts, low utility)
- Uniqueness: 1 (covered many times)
- **Total: 5/12** ✗ Reject; revise for SEA angle

### Threshold
- **8–12**: Submit to Lead's inbox
- **5–7**: Revise; could be improved with stronger angle or window alignment
- **<5**: Decline; table for future cycle or repurpose

---

## Tips & Gotchas

1. **Batch sessions are faster than solo ideation.** Run them weekly or as windows shift.
2. **Time sensitivity is data, not guess.** If FA closes March 15, idea expires March 15. Don't default to evergreen.
3. **Depth level mismatch kills ideas.** A deep-dive score model has no audience at depth 1; a casual headline bores depth-3 readers.
4. **SEA lens is non-negotiable.** Generic NFL content belongs elsewhere; our readers want SEA context.
5. **Uniqueness check is ongoing.** Before submission, skim the last 30 ideas in the DB; if 2+ similar, refocus or shelve.
6. **Reader sentiment matters.** If fans ask a question repeatedly, it's a valid signal—even if the angle seems obvious to analysts.
7. **Lead is the gate.** Don't bypass the inbox; approve/reject timing depends on Lead's capacity and editorial priorities.

---

## Related Skills & Workflows

- **Discussion Prompt Writing** (next stage after idea approval)
- **Panel Facilitation** (stage 3: live debate on approved ideas)
- **Article Drafting** (stage 4: writers execute on idea → discussion output)
- **Editorial Review** (stage 5: editor refines draft)
- **Publisher Workflow** (stage 6–7: SEO, formatting, scheduling)

---

*Last updated: 2024*
*Maintained by: Lead & Content Squad*

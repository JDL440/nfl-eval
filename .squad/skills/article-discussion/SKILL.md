---
name: "article-discussion"
description: "How to run a structured panel discussion for an article — from prompt writing through synthesis"
domain: "content-production"
confidence: "medium"
source: "validated — first end-to-end run 2026-03-15 (jsn-extension-preview)"
---

# Article Discussion — Skill

> **Confidence:** medium — validated once end-to-end on `jsn-extension-preview` (2026-03-15)
> **Created:** 2026-03-15
> **Last validated:** 2026-03-15

## Purpose

Codifies the three-phase discussion workflow (Stages 2–4 of the Article Lifecycle skill): writing a discussion prompt, assembling a panel, and synthesizing their positions into a discussion summary that the Writer uses to draft the article.

This skill is the "inner loop" of article production. The [article-lifecycle skill](../article-lifecycle/SKILL.md) orchestrates the full 8-stage pipeline; this skill provides the detailed playbook for Stages 2–4 specifically.

---

## When to Use

- Any time an article enters `discussion_prompt` stage
- When Lead needs to spawn a panel and produce a summary
- When Joe wants to understand what makes a discussion prompt sharp vs. generic

---

## Phase 1 — Writing the Discussion Prompt

The discussion prompt is the **most important artifact in the pipeline**. A bad prompt produces a generic panel. A good prompt produces specific, numeric, disagreement-generating analysis.

### Required Sections

Every discussion prompt must have all five:

| Section | What It Does | Quality Signal |
|---------|-------------|----------------|
| **Core Question** | One sharp sentence — the actual debate | "When should SEA extend JSN?" ✅ vs. "Is JSN good?" ❌ |
| **Key Tensions** | 3–4 bullet points the panel MUST resolve | Each tension should have a "yes side" and "no side" |
| **Data Anchors** | Specific numbers: cap figures, market comps, timeline milestones | Must be tables with actual dollar amounts, dates, percentages |
| **The Paths** | Brief, parallel framing of each option | Each path should be a plausible choice — no strawmen |
| **Panel Instructions** | Per-panelist focus with explicit "do this / don't do that" | Prevents overlap; each agent should have a unique lane |

### Anti-Patterns to Avoid

- **Vague tension:** "JSN vs. cap space" → **Better:** "Paying $34M AAV leaves only $10M for EDGE/safety; is that a defensible roster construction choice?"
- **Missing data anchors:** Saying "the WR market has reset" without citing Lamb ($34M AAV, $102M gtd) and Jefferson ($35M AAV, $110M gtd)
- **No per-panelist instruction differentiation:** If Cap and SEA both get "analyze the financial implications," expect duplicate analysis
- **Strawman paths:** Don't make one path obviously wrong — every path should have a legitimate advocate

### Template

```markdown
# Discussion Prompt: [Article Title]

## The Core Question
[One sentence — sharp, specific, contentious]

## Key Tensions
- [Tension 1 — with both sides stated]
- [Tension 2]
- [Tension 3]
- [Tension 4 — optional]

## Data Anchors
[Tables with specific numbers — contract comps, cap figures, timeline gates, tax implications]

## The Paths
[Brief parallel framing — 2–4 paths, each plausible]

## Panel Instructions
### [Panelist 1 Name] — [Role]
[Specific focus, explicit what-to-do / what-not-to-do]

### [Panelist 2 Name] — [Role]
[Specific focus]
```

---

## Phase 2 — Assembling the Panel

### Selection Rules

| Rule | Rationale |
|------|-----------|
| **Always include the relevant team agent** | Roster/competitive context grounds the discussion in reality |
| **Always include at least one specialist** | Pure team-agent panels produce fan-level analysis |
| **2–4 panelists is the sweet spot** | 2 is too thin; 5+ produces diminishing returns and synthesis overhead |
| **Each panelist should have a distinct lane** | Overlap between Cap and PlayerRep is fine (negotiation counterpoints); overlap between two team agents is wasteful |

### Panel Composition Matrix

| Article Type | Recommended Panel |
|-------------|-------------------|
| Contract extension / FA signing | Cap + PlayerRep + Team Agent |
| Contract extension (deep-dive) | Cap + PlayerRep + Team Agent + Offense/Defense |
| Draft pick evaluation | Draft + CollegeScout + Team Agent + Offense or Defense |
| Trade evaluation | Cap + PlayerRep + Team Agent (acquiring) + Team Agent (trading) |
| Coaching/scheme analysis | Offense or Defense + Team Agent + Analytics |
| Roster construction strategy | Team Agent + Cap + Analytics |
| Position market analysis | Cap + Offense or Defense + relevant Team Agents |

### Available Agents (2026-03-15)

**Specialists:** Cap, PlayerRep, Draft, Offense, Defense, Analytics, Injury, SpecialTeams, CollegeScout, Media

**Team Agents (32):** SEA, SF, LAR, ARI, KC, DEN, LV, LAC, DAL, PHI, NYG, WSH, CHI, GB, MIN, DET, TB, NO, ATL, CAR, NE, BUF, NYJ, MIA, BAL, PIT, CLE, CIN, HOU, TEN, IND, JAX

**Article production:** Lead, Writer, Editor, Scribe

---

## Phase 3 — Running the Panel

### Execution Protocol

1. **Spawn all panelists simultaneously** — use `task` tool in parallel, all as `background` agents with `claude-opus-4.6` model (per team decision)
2. **Each panelist prompt must include:**
   - Their identity and role (brief)
   - The core question and their specific focus lane
   - Full data anchors (copy from discussion prompt — agents are stateless)
   - The 4 paths (brief framing)
   - Word count target (300–500 words works well)
   - Save-to path: `content/articles/{article-id}/{panelist-name}-position.md`
3. **Wait for all agents to complete before synthesizing** — use `read_agent` with `wait: true`

### Panelist Prompt Template

```
You are [Name], the [Role] for an NFL analysis team. You are participating in a panel discussion.

TEAM ROOT: C:\github\nfl-eval
Read .squad/agents/[agent-folder]/charter.md and history.md.
Read .squad/decisions.md.

## Your Role
[2–3 sentences on what you do and why you're on this panel]

## Discussion Prompt
[Core question + your specific focus]

## Key Data Anchors
[Full tables from discussion prompt — do not summarize]

## The Paths
[Full path framing]

## Your Task
Write a position statement of 300–500 words. Include:
- [Specific deliverable 1]
- [Specific deliverable 2]
- [One non-obvious point the other panelists will miss]

Save to: content/articles/{article-id}/{agent-name}-position.md
```

### Quality Signals (What a Good Position Looks Like)

- **Uses specific numbers** — exact dollar amounts, percentages, cap hits. Not "a large contract."
- **Takes a clear stance** — recommends a path, not "it depends"
- **Addresses the WA tax / any article-specific nuance** from the prompt — shows the agent read the brief
- **Has at least one non-obvious insight** — something the writer wouldn't have known without the panel

---

## Phase 4 — Synthesis

The synthesis is the artifact the Writer uses. It must be actionable.

### Required Sections

| Section | Purpose |
|---------|---------|
| **Panel In Brief** | Table: panelist → position → recommended path → key metric |
| **Areas of Agreement** | 2–4 points where all or most panelists converge. These are the article's consensus foundation. |
| **Key Tensions** | The real disagreements. This is the article's tension engine. Name each tension clearly, show both sides, don't resolve everything. |
| **Recommended Path** | Lead's synthesis call — numbered reasoning, clear recommendation, contract/decision structure if applicable |
| **Open Questions for the Writer** | Specific things the writer needs to research, verify, or decide before drafting. Numbered, actionable. |

### Synthesis Quality Rules

- **Don't average away disagreement.** A range of $28–36M AAV is interesting; pretending the panel agreed on $32M is not.
- **Name the key tension explicitly.** The JSN discussion's central tension ("Jefferson/Lamb tier vs. one below") IS the article's debate. Surface it, don't smooth it over.
- **Lead takes a stance.** The synthesis is not a neutral summary. Lead recommends a path with reasoning.
- **Open questions must be specific.** "Verify JSN's 2025 stats" is actionable. "Get more context" is not.

---

## DB Integration

After discussion completes, Lead must:

```python
import sqlite3
from datetime import datetime

conn = sqlite3.connect('content/pipeline.db')
conn.execute(
    "UPDATE articles SET current_stage = 'panel_discussion', updated_at = ? WHERE id = ?",
    (datetime.now().isoformat(), article_id)
)
conn.commit()
conn.close()
```

⚠️ Note: The `articles` table does not yet have a `discussion_path` field to link artifacts back to the record. Decision filed at `.squad/decisions/inbox/lead-discussion-path-field.md`. Add this field when the schema is next updated.

---

## Timing & Cost Benchmarks (Observed 2026-03-15)

| Step | Observed Time | Notes |
|------|--------------|-------|
| Discussion prompt writing | ~5 min | Includes reading context files |
| 4 panelists in parallel | ~3 min wall time | agent-9 (Cap) slowest at ~190s |
| Synthesis writing | ~5 min | |
| Total (4-agent panel) | ~15 min | |

**Model:** claude-opus-4.6 for all panelists (per team decisions.md)
**Cost estimate:** ~$2–3 per panel discussion (4 agents, 300–500 words each)

---

## Related Skills

- [article-lifecycle](../article-lifecycle/SKILL.md) — Full 8-stage pipeline context
- [substack-article](../substack-article/SKILL.md) — Drafting mechanics for Stage 5
- [knowledge-recording](../knowledge-recording/SKILL.md) — How to update agent histories after a session

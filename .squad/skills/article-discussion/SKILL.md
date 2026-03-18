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

> **Runtime model policy:** resolve panel, Writer, and Editor models from `.squad/config/models.json` via `python content/model_policy.py select ...`; do not rely on hard-coded model names in prompts.

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

> Use the **Level 2/3 template** (full) for Beat and Deep Dive articles. Use the **Level 1 template** (short-form) for Casual Fan articles — it injects fewer tokens into every panel agent spawn.

#### Level 2 / Level 3 Template (full)

```markdown
# Discussion Prompt: [Article Title]

**Depth Level:** [1 — Casual Fan | 2 — The Beat | 3 — Deep Dive]

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

#### Level 1 Template (short-form — Casual Fan only)

Omit data anchor tables entirely. Level 1 articles are narrative-first; agents should bring the storytelling angle, not cap mechanics. Each agent receives ~200 words of context instead of ~600.

```markdown
# Discussion Prompt: [Article Title]

**Depth Level:** 1 — Casual Fan

## The Core Question
[One sentence — accessible, fan-facing tension]

## Key Tensions
- [Tension 1 — written for a fan, not a GM]
- [Tension 2]

## The Paths
[2–3 plausible paths in plain English — no jargon]

## Panel Instructions
### [Panelist 1 Name] — [Role]
[One short paragraph — what angle they own, plain language output expected]

### [Panelist 2 Name] — [Role]
[One short paragraph]
```

---

## Phase 2 — Assembling the Panel

### Selection Rules

| Rule | Rationale |
|------|-----------|
| **Always include the relevant team agent** | Roster/competitive context grounds the discussion in reality |
| **Always include at least one specialist** | Pure team-agent panels produce fan-level analysis |
| **Panel size is gated by depth level** | See limits below — the biggest single lever on token cost |
| **Each panelist should have a distinct lane** | Overlap between Cap and PlayerRep is fine (negotiation counterpoints); overlap between two team agents is wasteful |

### Panel Size Limits by Depth Level

> **Source of truth:** `.squad/config/models.json` → `panel_size_limits`

| Depth Level | Min | Max | Rationale |
|-------------|-----|-----|-----------|
| 1 — Casual Fan | 2 | **2** | Narrative-first; 2 agents produce enough tension without cap-nerd detail |
| 2 — The Beat | 3 | **4** | Default; balance of depth and cost |
| 3 — Deep Dive | 4 | **5** | Full scheme/cap/draft analysis; 5 agents justified only here |

**Do not exceed these limits.** A Level 1 article with 4 agents costs the same as a Level 3 article but delivers a worse reader experience (too many expert voices for a casual piece).

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

> **Model config source of truth:** `.squad/config/models.json` plus `content/model_policy.py`

1. **Spawn all panelists simultaneously** — use `task` tool in parallel, all as `background` agents
2. **Model selection is depth-level-driven:**

   | Depth Level | Panel Agent Model | Source |
   |-------------|-------------------|--------|
   | 1 — Casual Fan | resolve `stage_key=panel --depth-level 1` | `models.panel_casual` + task-family precedence |
   | 2 — The Beat | resolve `stage_key=panel --depth-level 2` | `models.panel_beat` + task-family precedence |
   | 3 — Deep Dive | resolve `stage_key=panel --depth-level 3` | `models.panel_deep_dive` + task-family precedence |

   Writer and Editor should likewise resolve through `python content/model_policy.py select --stage-key writer` and `--stage-key editor`, even when the current defaults remain `claude-opus-4.6`.

   When you are opening a tracked panel/Writer/Editor run, prefer `python content/model_policy.py start-stage-run ...` so the selected model, tier, precedence rank, and output budget are captured in `stage_runs` at spawn time.

3. **Each panelist prompt must include:**
   - Their identity and role (brief)
   - The core question and their specific focus lane
   - Full data anchors (copy from discussion prompt — agents are stateless)
   - The 4 paths (brief framing)
   - Word count target and **output token budget** (see Panelist Prompt Template below)
   - Save-to path: `content/articles/{article-id}/{panelist-name}-position.md`
4. **Wait for all agents to complete before synthesizing** — use `read_agent` with `wait: true`

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

## Output Budget
Target 300–500 words. Hard cap: 1,500 tokens. Write tight — every sentence must add
information or perspective not already in the data anchors. Cut qualifications, hedge
phrases, and recap. Lead will synthesize; you don't need to summarize the question back.

Save to: content/articles/{article-id}/{agent-name}-position.md
```

### Quality Signals (What a Good Position Looks Like)

- **Uses specific numbers** — exact dollar amounts, percentages, cap hits. Not "a large contract."
- **Takes a clear stance** — recommends a path, not "it depends"
- **Addresses article-specific nuances** from the prompt — shows the agent read the brief
- **Has at least one non-obvious insight** — something the writer wouldn't have known without the panel
- **⚠️ CONTENT CONSTRAINT: No politically divisive topics.** No tax legislation (WA SB 6346, millionaires tax, state income tax bills), no political bills, no political angles. Replace with football/business arguments (injury protection, front-loading for cash flow, cap efficiency, market comps). Applies to all stages.

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

After discussion completes, Lead must update `pipeline.db` with numeric stage and artifact path:

```python
import sqlite3
from datetime import datetime

conn = sqlite3.connect('content/pipeline.db')
# Update to numeric Stage 4 (panel_discussion) and record artifact path
conn.execute(
    "UPDATE articles SET current_stage = 4, discussion_path = ?, updated_at = datetime('now') WHERE id = ?",
    (f'content/articles/{article_id}/discussion-summary.md', article_id)
)
# Record stage transition
conn.execute(
    """INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes)
       VALUES (?, 3, 4, 'Lead', 'Panel discussion complete')""",
    (article_id,)
)
conn.commit()
conn.close()
```

**Stage semantics:** Use numeric values 1–8 per the schema. The `discussion_path` field is part of the current schema (see `content/schema.sql`).

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

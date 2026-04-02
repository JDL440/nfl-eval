---
name: "article-discussion"
description: "How to run a structured panel discussion for an article — from prompt writing through synthesis"
domain: "content-production"
confidence: "medium"
source: "validated — runtime-cleaned reference for stages 2–4"
---

# Article Discussion — Skill

## Purpose

 Codifies the three-phase discussion workflow: writing a discussion prompt, assembling a panel, and synthesizing positions into the Stage 4 discussion artifacts Writer uses to draft the article.

This skill is the inner loop of article production. The `article-lifecycle` skill provides the high-level 8-stage context; this skill provides the detailed playbook for Stages 2–4 specifically.

> **Runtime model policy:** model selection is handled by the application. Do not rely on hard-coded model names in prompts.

---

## When to Use

- Any time an article enters the discussion-prompt stage
- When Lead needs to assemble a panel and produce a summary
- When the team needs a reference for what makes a discussion prompt sharp vs. generic

---

## Phase 1 — Writing the Discussion Prompt

The discussion prompt is the most important artifact in the pipeline. A bad prompt produces a generic panel; a good prompt produces specific, disagreement-generating analysis.

### Required Sections

Every discussion prompt must have all five:

| Section | What It Does | Quality Signal |
|---------|--------------|----------------|
| **Core Question** | One sharp sentence — the actual debate | Specific and contentious, not vague |
| **Key Tensions** | 3–4 bullet points the panel must resolve | Each tension has a plausible yes-side and no-side |
| **Data Anchors** | Specific numbers, comps, milestones, or rates | Concrete tables or bullet lists, not hand-waving |
| **The Paths** | Brief parallel framing of each option | Each path is plausible; no strawmen |
| **Panel Instructions** | Per-panelist focus with explicit lane ownership | Prevents duplicate analysis |

### Anti-Patterns

- vague tension
- missing numerical anchors
- duplicate panel lanes
- one obviously “right” path and one fake strawman

### Discussion Prompt Template

```markdown
# Discussion Prompt: [Article Title]

**Editorial Preset:** [Casual Explainer | Beat Analysis | Technical Deep Dive | Narrative Feature]
**Reader Profile:** [Casual | Engaged | Hardcore]
**Article Form:** [Brief | Standard | Deep | Feature]
**Panel Shape:** [Auto | News reaction | Contract evaluation | Trade evaluation | Draft evaluation | Scheme breakdown | Cohort / comparison | Market map]

## The Core Question
[One sentence — sharp, specific, contentious]

## Key Tensions
- [Tension 1 — with both sides stated]
- [Tension 2]
- [Tension 3]
- [Tension 4 — optional]

## Data Anchors
[Tables or bullets with specific numbers — contract comps, cap figures, timeline gates, rankings, market comps]

## The Paths
[Brief parallel framing — 2–4 plausible paths]

## Panel Instructions
### [Panelist 1 Name] — [Role]
[Specific focus, explicit what-to-do / what-not-to-do]

### [Panelist 2 Name] — [Role]
[Specific focus]
```

### Data Anchor Guidance

Use the runtime-supplied evidence as anchors first. When the runtime exposes approved web research, use it to fill freshness gaps that the supplied context does not resolve cleanly:

- player efficiency context
- positional market comps
- team efficiency baseline
- snap usage or workload context when relevant
- draft context for draft-related articles
- advanced metrics for QB evaluations
- combine measurables for prospect articles

If the prompt lacks an anchor the article clearly needs, name the gap instead of pretending to have fetched it.

---

## Phase 2 — Assembling the Panel

### Selection Rules

| Rule | Rationale |
|------|-----------|
| Include the relevant team agent unless the article is intentionally cross-team / cohort-focused | Keeps single-team pieces grounded without forcing the wrong topology |
| Always include at least one specialist | Pure team-agent panels produce fan-level analysis |
| Panel size is gated by panel shape and explicit constraints | Prevents article form from silently dictating topology |
| Each panelist should have a distinct lane | Minimizes overlap and repetition |

### Panel Size Guidance by Shape / Form

| Panel Shape / Form | Min | Max | Rationale |
|--------------------|-----|-----|-----------|
| `news_reaction` or brief explainer | 2 | 2 | Narrative-first; enough tension without overloading the piece |
| `auto` + standard/feature | 3 | 4 | Default balance of depth and cost without treating features as a special model tier |
| `contract_eval` / `draft_eval` / `scheme_breakdown` | 3 | 4 | Specialist-heavy but still focused |
| `trade_eval` / `cohort_rank` / `market_map` | 4 | 5 | Cross-team / comparison work needs broader representation |
| `auto` + deep | 4 | 5 | Deep technical analysis justifies the fullest panel |

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

---

## Phase 3 — Running the Panel

### Execution Protocol

The application runtime handles spawning, persistence, and model routing. Prompt text should describe the desired outputs, and may use approved research tools when the runtime exposes them, but should not pretend to use unavailable tools or side-effecting infrastructure.

Each panelist prompt should include:

- their identity and role
- the core question and their specific focus lane
- the full data anchors
- the candidate paths
- a clear output budget

### Panelist Prompt Template

```
You are [Name], the [Role] for an NFL analysis team. You are participating in a panel discussion.

Your charter and relevant memories are loaded automatically by the runner.

## Your Role
[2–3 sentences on what you do and why you're on this panel]

## Discussion Prompt
[Core question + your specific focus]

## Key Data Anchors
[Full tables or bullet lists — do not summarize away important numbers]

## The Paths
[Full path framing]

## Your Task
Write a position statement of 300–500 words. Include:
- [Specific deliverable 1]
- [Specific deliverable 2]
- [One non-obvious point the other panelists may miss]
```

### Quality Signals

- uses specific numbers
- takes a clear stance
- addresses the article-specific nuance
- contributes at least one non-obvious insight
- stays inside current content constraints supplied by the runtime

---

## Phase 4 — Synthesis

 The synthesis step produces the canonical Stage 4 handoff. It must leave behind both:

- `discussion-summary.md` — the actionable synthesis Writer uses directly
- `article-contract.md` — the compact negotiated spec Writer and Editor must both honor

Together, these are the hard prerequisites before Stage 5 can begin.

### Required Sections

| Section | Purpose |
|---------|---------|
| **Panel In Brief** | Table: panelist → position → recommended path → key metric |
| **Areas of Agreement** | Where all or most panelists converge |
| **Key Tensions** | The real disagreements — the article’s tension engine |
| **Recommended Path** | Lead’s synthesis call with clear reasoning |
| **Open Questions for Writer** | Specific things still needing caution, framing, or verification |

### Synthesis Rules

- do not average away disagreement
- name the key tension explicitly
- Lead takes a stance
- open questions must be specific

### Contract Rules

`article-contract.md` should stay compact and operational. Capture:

- the thesis or core question the article must answer
- the disagreements/tensions that must survive into the draft
- the evidence anchors the article must reference
- the structural expectations Writer must satisfy
- the open cautions or uncertainty the final piece must acknowledge

### Article Contract

After the discussion summary is written, generate `article-contract.md` as a second Stage 4 artifact. The article contract is the compact specification that both Writer (Stage 5) and Editor (Stage 6) must honor. It serves as the shared agreement on what the article must deliver.

#### Required Elements

| Element | Purpose |
|---------|---------|
| **Thesis or Core Question** | The central claim or question the article must answer |
| **Key Tensions** | Disagreements or trade-offs that must be preserved (not smoothed over) |
| **Required Evidence Anchors** | Specific stats, comps, or data points the article must reference |
| **Mandatory Structure** | Expected sections, flow, or framing requirements |
| **Open Cautions** | Gaps, uncertainties, or temporal limits the article must acknowledge |

#### Contract Rules

- Keep it compact: 200-400 words
- This is a specification, not a draft
- Be explicit about what Writer must deliver and what Editor will evaluate
- Cite specific numbers and requirements from the discussion

---

## Related Skills

- `article-lifecycle` — full 8-stage pipeline context
- `substack-article` — drafting mechanics for Stage 5
- `knowledge-recording` — durable takeaways after a session

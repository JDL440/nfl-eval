# Token Optimization Plan — NFL Lab Pipeline

## Problem

The pipeline is ready to scale from ~1-team to 32 teams, but there are no token controls anywhere. At 32 teams / 2 articles per team per week, costs project to $55/week in LLM tokens alone (before infrastructure). More importantly, there are structural inefficiencies that can be fixed without touching quality on the content that matters.

## Current State (from deep codebase analysis)

| Metric | Current |
|--------|---------|
| LLM calls per article | 8–9 spawns |
| Tokens per article | ~107K (94K in / 18K out) |
| Largest cost driver | Panel discussion (~60% of tokens) |
| Panel agents (current) | 4–5, all at claude-opus-4.6 |
| max_tokens anywhere | **None — completely unbounded** |
| Central model config | **None — each charter says `auto`** |
| History file limits | **None — grow forever** |

Key locations:
- Spawn model guidance: `.squad/skills/article-discussion/SKILL.md:121` (`claude-opus-4.6` for all panelists)
- Panel size sweet spot documented: `.squad/skills/article-discussion/SKILL.md:90` but not enforced by depth level
- Depth levels already exist: `.squad/skills/article-lifecycle/SKILL.md:101–105` (Casual / Beat / Deep Dive)
- History files: `.squad/agents/*/history.md` — currently unbounded, some already 20K+ tokens

---

## Approach

Implement controls across 5 dimensions, in priority order. All changes are **guidance documents + config** — no code to deploy, no infrastructure changes.

1. **Central model config** — one file to rule them all
2. **Depth-level model routing** — match model quality to article depth
3. **max_tokens output budgets** — cap every spawn
4. **History maintenance** — rolling summaries via gpt-5-mini
5. **gpt-5-mini task catalog** — explicit list of tasks that don't need heavy models

---

## Todos

### T1: Central Model Config
**File:** `.squad/config/models.json`

Create a single model routing config. All skill docs will reference this, so model changes are one-edit operations.

```json
{
  "version": "1.0",
  "note": "All model assignments for the NFL Lab pipeline. Edit here, not in individual charters.",
  "roles": {
    "writer": "claude-opus-4.6",
    "editor": "claude-opus-4.6",
    "lead": "claude-opus-4.6",
    "panel_deep_dive": "claude-opus-4.6",
    "panel_beat": "claude-opus-4.6",
    "panel_casual": "claude-sonnet-4.5",
    "lightweight": "gpt-5-mini"
  },
  "max_tokens": {
    "panel_agent": 1500,
    "writer": 5000,
    "editor": 2500,
    "lead_discussion": 2000,
    "lead_synthesis": 2500,
    "lightweight": 800
  }
}
```

Update `article-discussion/SKILL.md` and `article-lifecycle/SKILL.md` to reference this config file as the authoritative source.

---

### T2: Depth-Level Model Routing

Update `article-discussion/SKILL.md` Phase 3 (Running the Panel) to add a model routing table:

| Depth Level | Panel Model | Rationale |
|-------------|-------------|-----------|
| 1 — Casual Fan | `claude-sonnet-4.5` | Narrative-first; Sonnet is capable enough |
| 2 — The Beat | `claude-opus-4.6` | Default; current behavior |
| 3 — Deep Dive | `claude-opus-4.6` | Full cap/scheme/draft analysis needs Opus |

**Writer and Editor always stay at `claude-opus-4.6`** regardless of depth level — they are the voice and the final check.

Estimated savings: ~35% of panel token cost on Level 1 articles if Sonnet pricing is meaningfully lower.

---

### T3: Enforce Panel Size Limits by Depth Level

Update `article-discussion/SKILL.md` Panel Composition Matrix with hard limits:

| Depth Level | Min Agents | Max Agents |
|-------------|-----------|------------|
| 1 — Casual Fan | 2 | 2 |
| 2 — The Beat | 3 | 4 |
| 3 — Deep Dive | 4 | 5 |

Also add Stage 3 (Panel Composition) as a **gpt-5-mini task** in `article-lifecycle/SKILL.md`. Lead can use gpt-5-mini to:
- Read the idea description + depth level
- Recommend which 2–5 agents to include with one-line rationale
- Lead reviews and approves before spawning

This eliminates manual cognitive overhead for Lead and ensures depth constraints are applied consistently.

---

### T4: max_tokens Output Budgets

**Critical — must be done before scaling.** No max_tokens constraints exist anywhere today.

Update panelist prompt template in `article-discussion/SKILL.md` to add explicit token budget:

```
## Output Budget
Max tokens: 1,500. Write tight. Every sentence must add information or perspective not available elsewhere. Cut qualifications, hedge phrases, and recap.
```

Add to `substack-article/SKILL.md` Writer section:
```
Max tokens: 5,000 for article body. If the article exceeds this, cut summary sections, not substance.
```

Add to Editor spawn guidance:
```
Max tokens: 2,500. The Editor Report format is structured — it does not need prose preamble.
```

---

### T5: History Maintenance Skill

**File:** `.squad/skills/history-maintenance/SKILL.md`

New skill defining:

**Retention policy:**
- Keep last **5 articles** in full detail per agent
- All older entries → compressed into a "Historical Context" summary block at the top of history.md
- Summary format: 3–5 bullets per older article, not full analysis

**Summarization protocol (gpt-5-mini):**
```
Prompt: You are summarizing NFL analysis history for agent [NAME].
Compress the following [N] entries into a 3-5 bullet summary per entry.
Keep: key recommendations, key numbers, key disagreements.
Cut: preamble, caveats, setup prose, anything already in the charter.
```

**Trigger:** Run after every article is published (Stage 8).

**Target:** Keeps history files under 5K tokens total, regardless of article volume.

---

### T6: gpt-5-mini Task Catalog

Add a "Lightweight Tasks" section to `article-lifecycle/SKILL.md` documenting every place gpt-5-mini is appropriate. The explicit catalog prevents over-engineering with heavy models on trivial tasks.

| Stage | Task | Model | Why gpt-5-mini is enough |
|-------|------|-------|--------------------------|
| Stage 1 | Idea viability triage | gpt-5-mini | Yes/no with brief rationale |
| Stage 3 | Panel composition recommendation | gpt-5-mini | Slot-filling from known agent list |
| Stage 7 | Article metadata extraction | gpt-5-mini | Tags, section, team name from article |
| Stage 8 | History entry draft | gpt-5-mini | Structured compression, not analysis |
| Ongoing | History summarization | gpt-5-mini | See T5 |

Each entry in the catalog includes a prompt template and expected output format.

---

### T7: Discussion Prompt Depth Compression

Update `article-discussion/SKILL.md` Phase 1 template to add a Level 1 short-form template.

**Current template:** ~600 words with full data anchor tables (required for Level 2/3)

**Level 1 template:** ~200-word version — core question, 2 tensions, brief panel instructions only. No full data anchor tables (Level 1 articles don't use cap mechanics and draft comps the same way).

This reduces the context injected into each Level 1 panel agent spawn.

---

## Token Impact Estimate

| Optimization | Est. Savings per Article | Applies When |
|---|---|---|
| T2: Depth model routing | ~$0.08 (Level 1 only) | Any Casual Fan article |
| T3: Panel size limits | ~$0.10 (Level 1, saves 2 agents) | Level 1 articles |
| T4: max_tokens budgets | ~$0.05 (catch overruns) | All articles |
| T5: History maintenance | ~$0.03 growing → ~$0.15 after 50 articles | All articles at scale |
| T7: Prompt compression (L1) | ~$0.02 | Level 1 articles |
| **T1/T6: Config + catalog** | **$0 direct, operational** | Prevents future overruns |

Writer, Editor, Lead quality models are **unchanged**. All savings come from peripheral tasks.

---

## Files Changed

| File | Change |
|------|--------|
| `.squad/config/models.json` | **New** — central model config |
| `.squad/skills/article-discussion/SKILL.md` | Model routing table, panel size limits, max_tokens in templates |
| `.squad/skills/article-lifecycle/SKILL.md` | gpt-5-mini catalog, depth-level model routing reference |
| `.squad/skills/history-maintenance/SKILL.md` | **New** — retention + summarization policy |
| `.squad/skills/substack-article/SKILL.md` | max_tokens for Writer |

No charter files need editing. No code changes.

---

## Branch + Worktree Setup

All work is done on a feature branch in a dedicated worktree to keep main clean.

```
branch:   feature/token-optimization
worktree: C:\github\worktrees\token-optimization
```

Steps:
1. `git checkout main && git pull` (ensure clean base)
2. `git branch feature/token-optimization`
3. `git worktree add C:\github\worktrees\token-optimization feature/token-optimization`
4. All edits happen in the worktree
5. PR from `feature/token-optimization` → `main` when ready

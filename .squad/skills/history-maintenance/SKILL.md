---
name: "history-maintenance"
description: "How to keep agent history files lean as article volume scales — retention policy, summarization protocol, and trigger schedule"
domain: "content-production"
confidence: "medium"
source: "designed 2026-03-15 — not yet validated end-to-end"
---

# History Maintenance — Skill

> **Confidence:** medium — designed but not yet validated at scale
> **Created:** 2026-03-15
> **Last validated:** n/a

## Why This Exists

Each agent's `history.md` file is injected as context at every spawn. Histories grow
without bound as articles accumulate — after 50 articles, a frequently-used agent like
Cap or SEA can have 20K+ tokens of history, adding $0.03–0.05 per spawn just in context.
At 32 teams and 2 articles/week, that compounds fast.

This skill defines the retention policy and summarization protocol to keep every
`history.md` under ~5K tokens regardless of article volume.

---

## Retention Policy

> **Source of truth:** this skill. Override in `.squad/config/models.json` if needed.

| Tier | What to keep | Format |
|------|-------------|--------|
| **Recent** (last 5 articles) | Full detail — analysis, recommendations, key numbers | Original content |
| **Historical** (older entries) | Compressed summary — 3–5 bullets per article | Summary block (see below) |
| **Archived** (>12 months) | Drop entirely | Nothing |

The "last 5 articles" window is per agent, not per team. An agent who appeared in 3
articles this week and 2 last month keeps all 5 in full detail.

---

## Summary Block Format

Compressed entries are grouped into a single `## Historical Context` section at the top
of history.md, above the full recent entries:

```markdown
## Historical Context
_Summarized entries older than the last 5 articles. Updated: {date}._

### {Article Title} — {Publish Date}
- Topic: {1 sentence}
- Key numbers: {most important figures}
- Recommendation: {what this agent recommended}
- Disagreements: {any notable panel tension, if applicable}
- Outcome: {what actually happened, if known}
```

Each compressed entry should be 50–100 words. Five entries = ~400 words = ~600 tokens.

---

## Summarization Protocol

Use `gpt-5-mini` (`models.lightweight` from `.squad/config/models.json`) for all
summarization. This is a compression task, not a reasoning task.

### Prompt Template

```
You are compressing NFL analysis history entries for the agent named {AGENT_NAME}.
Each entry will appear in the agent's history file and be read at every spawn.
Keep it lean — only facts that would be useful in a future article about a similar topic.

For each article entry below, write a 3–5 bullet summary using this format:
- Topic: {1 sentence}
- Key numbers: {the most important figures}
- Recommendation: {what this agent recommended}
- Disagreements: {any notable panel disagreement, or "None"}
- Outcome: {what actually happened, if known, or "Unknown"}

Entries to compress:
---
{paste article history entries here}
---

Return one summary block per article entry. Max 100 words per block.
```

### Steps

1. Open the agent's `history.md`
2. Count the article entries (each `## {Article Title}` heading is one entry)
3. If total entries > 5:
   - Identify the oldest (total − 5) entries
   - Pass them to gpt-5-mini with the prompt above
   - Replace those entries with the `## Historical Context` summary block
   - Keep the 5 most recent entries in full detail below the summary block
4. Commit the updated history file with message: `chore: compress {agent} history — {date}`

---

## Trigger Schedule

Run history maintenance **after every article publish** (Stage 8 of the article lifecycle)
for all agents that participated in the article's panel.

At minimum, run for:
- All panel agents from that article
- Writer (if a new article entry was added)
- Lead (if synthesis notes were added)

Do **not** run for agents that weren't involved in the article — their history is unchanged.

---

## File Structure After Maintenance

```markdown
# {Agent Name} — {Team/Role} History

## Historical Context
_Summarized entries older than the last 5 articles. Updated: 2026-03-15._

### {Old Article 1} — {Date}
- Topic: ...
- Key numbers: ...
- Recommendation: ...
- Disagreements: ...
- Outcome: ...

### {Old Article 2} — {Date}
...

---

## {Recent Article 5} — Full Entry

[Full analysis content...]

---

## {Recent Article 4} — Full Entry

[Full analysis content...]

...
```

---

## Token Budget Target

| Scenario | Target history.md size |
|----------|------------------------|
| Agent with 1–5 articles | < 5K tokens |
| Agent with 6–20 articles | < 5K tokens (5 full + compressed summary) |
| Agent with 20+ articles | < 6K tokens (5 full + growing summary block) |

---

## Related Skills

- [article-lifecycle](../article-lifecycle/SKILL.md) — Stage 8 triggers history maintenance
- [knowledge-recording](../knowledge-recording/SKILL.md) — How to write new history entries before maintenance runs

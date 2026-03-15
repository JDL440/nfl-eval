# Knowledge Propagation Skill

> **MANDATORY READ:** All agents must read this before starting work.

## Problem

Agents discover information that should update files OUTSIDE their domain:
- Facts relevant to another agent's work
- Stale information in team.md
- Incorrect facts in someone else's charter
- Follow-on decisions that belong in decisions.md

Without a structured pattern, this knowledge gets siloed or lost.

## The Pattern: Knowledge Inbox

**Location:** `.squad/knowledge/inbox/`

When you discover something that should update a file you DON'T own, write a drop file:

```
.squad/knowledge/inbox/{agent-name}-{slug}.md
```

### Drop File Format

```markdown
### {ISO timestamp}: Knowledge update
**From:** {agent name}
**Target:** {one of: agent:{name} | team.md | charter:{name} | decisions.md}
**Section:** {the section heading to append under, e.g., "## Learnings" or "## Project Context"}
**Content:**
{the exact text to append}
**Why:** {brief rationale — why does this other file need this update?}
```

### Example

```markdown
### 2025-01-15T14:32:00Z: Knowledge update
**From:** Danny
**Target:** agent:rusty
**Section:** ## Cap Context
**Content:**
📌 Cowboys restructuring Dak Prescott's contract in March 2025 will free $18M in cap space (verified via OverTheCap projection). This affects Rusty's cap calculations for DAL offseason moves.
**Why:** Rusty needs to know this cap move is happening to accurately model Dallas's available cap space for FA signings.
```

## Rules for Agents

### Write a knowledge drop for ANY of these situations:

1. **You learned something about another agent's domain they need to know**
   - Example: Danny discovers a cap implication → drop file targeting agent:rusty

2. **You discovered team.md has stale information**
   - Example: Project scope changed, roster is incorrect, issue source outdated
   - Target: `team.md`

3. **A charter has an incorrect or outdated fact**
   - Example: Basher's charter says "focus on run game analysis" but project shifted to pass-first
   - Target: `charter:{name}`
   - ⚠️ **IMPORTANT:** Do NOT rewrite the charter yourself — write a drop file flagging the issue. Coordinator will review.

4. **A decision in decisions.md needs a follow-on decision added**
   - Example: A previous decision assumed X, but you learned X is no longer true
   - Target: `decisions.md`

### Do NOT write directly to:
- Other agents' `history.md` files (use the knowledge inbox)
- `team.md` (use the knowledge inbox)
- Anyone else's charter (use the knowledge inbox with `charter:{name}` target)

### Still write DIRECTLY to:
- Your OWN `history.md` (no change here)
- Your OWN `.squad/decisions/inbox/` entry for team-level decisions (no change here)

## Knowledge Inbox vs Decisions Inbox

**When to use `.squad/decisions/inbox/`:**
- Team-level decisions (architecture, process, scope, constraints)
- Things ALL agents need to know about how we work
- Changes to team agreements, patterns, workflows

**When to use `.squad/knowledge/inbox/`:**
- Factual updates to specific files (append content somewhere specific)
- Information that belongs in one agent's history, not the whole team's decision log
- Corrections to team.md or charter facts
- Follow-on decisions that augment existing decisions.md entries

## Processing

**Scribe** processes the knowledge inbox during every session cleanup:
- Routes each drop file to its target (appends content to the specified section)
- For charter updates, creates a flag file instead (Coordinator reviews)
- Deletes processed inbox files
- Logs each routed update

## Why This Matters

Without this pattern, agents either:
1. Silently keep knowledge to themselves (silo risk)
2. Write directly to files they don't own (merge conflict risk)
3. Drop important facts in their own history where no one else will see them

The knowledge inbox enforces the same discipline for cross-agent knowledge that already exists for team decisions.

---

**Next steps after reading this:**
- Before starting work, check if you've learned anything that should be routed elsewhere
- If yes, write a knowledge drop file using the format above
- Continue your normal work

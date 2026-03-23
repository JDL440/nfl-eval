---
name: Writer Structure Guard
domain: pipeline
confidence: high
tools: [typescript, vitest]
---

# Writer Structure Guard

## When to use

- A pipeline stage has a deterministic article-format requirement that must be enforced before the next agent runs.
- You want malformed drafts to self-heal once, then loop back to Writer with explicit repair instructions instead of silently stalling downstream.
- The required structure already exists in a canonical skill or contract file and runtime validation must match it.

## Pattern

1. Put the canonical structure contract in one skill file and make dependent charters reference that file instead of duplicating policy text.
2. Add a deterministic validator near the stage guard (`src/pipeline/engine.ts`) that returns specific failure reasons, not just a generic false.
3. Reuse that validator inside the stage action (`src/pipeline/actions.ts`) to do one targeted self-heal retry with instructions that name the exact structural miss.
4. If the retry still fails, stop the action with a precise validation error so the stage cannot advance.
5. In auto-advance loops, convert guard-level structure failures into a synthetic `editor-review.md` send-back note and preserve the previous `draft.md` so Writer revises the actual failed draft.

## NFL Lab example

- Issue `#107` made `src/config/defaults/skills/substack-article.md` the TLDR contract source of truth.
- `inspectDraftStructure()` in `src/pipeline/engine.ts` now enforces a near-top `> **📋 TLDR**` block with four bullets.
- `writeDraft()` in `src/pipeline/actions.ts` retries once with a structure-specific repair instruction, and `autoAdvanceArticle()` regresses Stage 5 drafts back to Stage 4 with a synthetic REVISE note when the guard still blocks Editor.

## Why this works

- Deterministic guards catch format regressions faster and more reliably than asking Editor to notice them later.
- A targeted retry fixes easy misses cheaply, while the preserved-draft send-back path keeps revision loops grounded in the existing work instead of forcing complete rewrites.

---
name: memory-pollution-detection
description: Identify and safely prune polluted auto-generated learnings from agent memory
domain: observability
confidence: 0.85
tools: [sqlite, typescript, sql]
---

# Memory Pollution Detection Pattern

## When to use

- Agent memory accumulates low-signal rows from generated article previews or execution summaries.
- Need to protect runtime recall without broad schema churn.
- Need a narrowly scoped cleanup strategy for already polluted memory rows.

## Problem

Preview-shaped outputs can land in reusable categories like `learning` even though they are not durable instructions, decisions, or facts. Once stored, they crowd out real context during recall because they are long, recent, and often high-relevance.

## Detection Strategy

### 1. Inspect recent reusable-category rows

Look for rows that combine:

- article slug prefixes such as `[article-slug] ...`
- long markdown-heavy bodies
- generated panel/article output instead of compact instruction/fact form

### 2. Identify preview signals

Common signals:

- markdown tables
- blockquotes / TL;DR blocks
- image markdown
- heading stacks or headline-option lists
- long multi-line article fragments

### 3. Verify before deletion

Before cleanup, sample matches and ask:

- Is this a durable instruction, decision, preference, or fact?
- Or is it just generated output that happened to be stored?

Only delete the latter.

## Prevention: Shared-Boundary Fix

### First isolate the write seam

Trace both `AgentMemory.store()` and direct callers of `runner.run().content`. A common failure mode is that `AgentRunner` is already safe, but higher-level dashboard/pipeline callers still persist raw task output.

### Preferred runtime pattern

Put one classifier in `src\agents\memory.ts` and reuse it everywhere:

```typescript
export function isReusableMemory({ category, content }: {
  category: MemoryCategory;
  content: string;
}): boolean {
  if (category === 'domain_knowledge') return true;
  return !looksLikeArticleOutputPreview(content) &&
         !looksLikeExecutionSummary(content);
}

store(entry) {
  if (!isReusableMemory(entry)) return 0;
  // persist
}

recall(agentName, { reusableOnly: true }) {
  // overfetch, filter, then slice
}
```

### Runner seam

`AgentRunner` should not auto-promote raw model output into reusable memory. Useful memories should be written explicitly as compact summaries with an intentional category.

## NFL Lab Example

Current repo pattern:

- `src\agents\memory.ts` owns reusable-memory classification
- `src\agents\runner.ts` requests `reusableOnly` recall before prompt assembly
- `pruneTaskOutputPreviews()` uses the same classifier for targeted cleanup
- `tests\agents\memory.test.ts` covers block/store/recall/prune behavior
- `tests\agents\runner.test.ts` proves polluted rows are skipped during runtime recall

## Tests

Add focused tests for:

- blocking preview-shaped stores
- preserving concise explicit learnings
- filtering legacy polluted rows during runtime recall
- targeted cleanup that removes only preview rows

Also add caller-seam tests for any surface that turns `runner.run().content` into a memory write. Otherwise runner-level tests can pass while pollution still enters through higher-level orchestration code.

## Why This Works

1. One classifier governs store blocking, reusable recall, and cleanup.
2. Runtime protection works immediately, even before legacy cleanup runs.
3. Cleanup stays narrow because deletion targets only the preview pattern.
4. Useful concise memories and structured domain knowledge still behave normally.

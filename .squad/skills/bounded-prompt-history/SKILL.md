---
name: Bounded Prompt History
domain: runtime-context
confidence: high
tools: [typescript, vitest]
---

# Bounded Prompt History

## When to use
- A runtime prompt includes prior conversation turns, reviews, or summaries that can grow over time.
- You need predictable prompt size without dropping the most recent feedback.

## Pattern
1. Add an explicit cap constant near the formatter/query helpers.
2. When a DB query applies `limit`, order newest-first before limiting.
3. In the formatter, sort deterministically and slice again as a safety net.
4. Add focused tests for both query ordering and formatter output.

## NFL Lab example
- `src/pipeline/conversation.ts` adds `MAX_EDITOR_PREVIOUS_REVIEWS` and a `newestFirst` option on `getArticleConversation()`.
- `buildEditorPreviousReviews()` sorts by descending `turn_number` and enforces the same cap.
- `src/pipeline/actions.ts` requests capped editor history with `{ agentName: 'editor', limit: MAX_EDITOR_PREVIOUS_REVIEWS, newestFirst: true }` before assembling the editor prompt.

## Why this works
- Query-time ordering prevents old rows from crowding out recent context.
- Formatter-level bounding keeps helper misuse from reintroducing prompt growth later.
- Tests lock in deterministic newest-first behavior.

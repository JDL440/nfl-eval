---

# Decision: Issue #92 should use summary-only shared handoffs at runtime

**Issue:** #92 — charter isolation in shared article conversation context
**Status:** IMPLEMENTED
**Submitted by:** Code (🔧 Dev)
**Date:** 2026-03-22

---

## TLDR

Keep storing full per-article conversation history, but stop injecting that raw shared transcript into Writer, Editor, and Publisher by default. Runtime handoffs should use a compact revision-summary block, with Editor additionally receiving only its own previous reviews and Writer revisions still receiving the current `editor-review.md` artifact as an explicit handoff.

## Decision

Use `buildRevisionSummaryContext()` in `src/pipeline/conversation.ts` as the default shared cross-role prompt surface:

- **Writer:** shared revision summary only
- **Writer revisions:** explicit current `editor-review.md` handoff + previous draft + shared revision summary
- **Editor:** shared revision summary + `buildEditorPreviousReviews()`
- **Publisher:** shared revision summary only

Do **not** pass `buildConversationContext()` into these stage actions during normal runtime.

## Why

- Fresh per-agent system prompts already preserve formal charter precedence in `src/agents/runner.ts`.
- The practical bleed risk came from `src/pipeline/actions.ts` prepending the full raw writer/editor/publisher transcript to later user messages.
- `revision_summaries` already contain the lowest-risk cross-agent continuity data we need, so no schema migration was necessary.

## Scope boundary

- Keep `article_conversations` and `buildConversationContext()` for storage, debugging, and any future explicit full-history surfaces.
- Do not remove the conversation tables or change the runner injection model in this follow-up.
- Do not give Publisher the raw editorial journey unless a future debug mode explicitly asks for it.

## Test rule

Regression tests for this area should assert both:

1. the compact handoff text is present, and
2. sentinel raw thread content from other roles is absent.

That negative assertion is what proves role-bleed prevention, not just summary formatting.

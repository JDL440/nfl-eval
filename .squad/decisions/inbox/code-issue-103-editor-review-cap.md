# Decision Inbox — Code — Issue #103

- **Issue:** #103
- **Context:** Follow-up to hybrid handoff isolation shipped in PR #97 / issue #92.
- **Decision:** Bound editor self-history at 10 prior reviews, prefer newest reviews deterministically, and enforce the same newest-first ordering at query time when applying limits.
- **Why:** This keeps runtime editor prompts predictable without changing the existing adv-stage/context-config behavior introduced by PR #97.
- **Implementation paths:** `src/pipeline/conversation.ts`, `src/pipeline/actions.ts`, `tests/pipeline/conversation.test.ts`.

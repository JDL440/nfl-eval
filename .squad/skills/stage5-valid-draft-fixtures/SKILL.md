---
name: Stage 5 Valid Draft Fixtures
domain: testing
confidence: high
tools: [typescript, vitest]
---

# Stage 5 Valid Draft Fixtures

## When to use

- A test writes `draft.md` directly and then exercises Stage 5→6 guards, auto-advance, scheduler readiness, or publish-adjacent flows.
- Runtime validation in `src\pipeline\engine.ts` requires the canonical near-top TLDR block.
- A broad test turns red after provider/runtime work even though focused provider and dashboard suites are green.

## Pattern

1. Add a local helper in the test file that emits a canonical draft scaffold: headline, optional subtitle, near-top `> **📋 TLDR**`, four bullets, then the body text payload.
2. Subtract the scaffold word count from the target total so the final draft length still matches the intended word-count scenario.
3. Reuse that helper anywhere the test means “valid draft” instead of hand-writing raw body text.
4. Keep malformed draft fixtures only in tests that explicitly verify structure failures.

## NFL Lab example

- `tests\e2e\ux-happy-path.test.ts` uses `buildValidDraft()` for the stage-5 draft and the post-regression rewrite draft.
- `tests\pipeline\scheduler.test.ts` uses `buildValidDraft(900)` before advancing `published` from Stage 5 to Stage 6.

## Why this works

- It keeps broad validation aligned with the deterministic runtime contract instead of silently relying on obsolete fixtures.
- It narrows failures: structure tests stay intentionally malformed, while happy-path tests only fail when runtime behavior actually regresses.

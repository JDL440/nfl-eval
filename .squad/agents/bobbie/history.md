# Bobbie — Agent History

## Core Context
- **Role:** Backend / Test Engineer
- **Project:** NFL Roster Evaluation — 2026 Offseason (v2 architecture)

## Sessions

### E2E Edge Case Test Suite (2026-03-20)
**Status:** ✅ COMPLETE — 573 lines of deterministic edge case tests authored and committed.

- Created `tests/e2e/edge-cases.test.ts` covering failure, retry, regression, concurrency, and guard scenarios
- All tests use MockProvider for deterministic execution (no external dependencies)
- Full vitest suite passed with zero regressions
- Commit: `94787da` on `v2`

## Learnings

### actionCtx Wiring Pattern (2026-03-20)
When writing e2e tests that exercise pipeline stage gates, the `actionCtx` object must be properly wired through MockProvider to simulate real pipeline state transitions. Tests that skip actionCtx wiring will pass in isolation but miss guard-clause bugs.

### Edge Case Coverage Patterns (2026-03-20)
Effective edge case test categories for the article pipeline:
1. **Failure paths:** Provider errors, malformed input, missing required fields
2. **Retry logic:** Exponential backoff boundaries, max-retry cap enforcement
3. **Regression guards:** Pin previously-fixed bugs as assertions to prevent reintroduction
4. **Concurrency:** Parallel pipeline runs, race conditions on shared state (pipeline.db)
5. **Stage gates:** Verify actionCtx guards reject out-of-order stage transitions

### MockProvider Best Practice (2026-03-20)
All e2e tests should use MockProvider rather than live providers. This ensures:
- Deterministic test execution (no network flakiness)
- Fast test runs (no API latency)
- Precise failure injection (can simulate specific error codes/shapes)

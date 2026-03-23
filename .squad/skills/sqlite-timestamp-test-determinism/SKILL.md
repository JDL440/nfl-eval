# Skill: SQLite timestamp determinism in tests

## When to use

Use this pattern when repo code writes SQLite timestamps with `datetime('now')` or another second-precision source and tests need deterministic ordering across multiple inserts.

## Pattern

1. Prefer `vi.useFakeTimers()` plus `vi.setSystemTime(...)` over millisecond sleeps.
2. If multiple rows intentionally share the same timestamp, assert ordering with a stable secondary key such as an autoincrement `id`.
3. Match the query index to the production ordering clause so regression tests can verify both correctness and the optimized read path.

## NFL Lab example

- Query usage history with `ORDER BY created_at DESC, id DESC`
- Support it with `idx_usage_events_article_history` on `(article_id, created_at DESC, id DESC)`
- Cover both repository-level reads and pipeline-level usage recording without relying on timing gaps

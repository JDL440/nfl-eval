# Squad Routing

## How to Route Requests
- Pipeline/architecture decisions, multi-agent coordination → Holden (Lead)
- API, backend pipeline code, stage execution, DB state → Naomi
- UI/API contracts, artifacts presentation, HTTP ergonomics → Drummer
- Tests (unit, e2e, Vitest), MockProvider wiring, guard coverage → Bobbie
- Data integrity, artifacts, concurrency, slug/metadata ops → Alex
- Session logging + union merges → Scribe (auto-spawn via coordinator only)
- Work queue / GitHub issues / automation loops → Ralph

## Notes
- Always mention concrete files or endpoints in prompts.
- E2E + integration tests should use MockProvider only (no live LLM).
- Use drop-box pattern: decisions/inbox for new decisions, Scribe consolidates.
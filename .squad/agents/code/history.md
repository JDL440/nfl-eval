# History — Code

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Learnings

- Team initialized 2025-07-18
- 47 article pipeline agents live in `src/config/defaults/charters/nfl/` — these are SEPARATE from Squad agents
- Dashboard runs on port 3456 (Hono + HTMX)
- **Token usage system (issue #81):** Usage events are recorded in `usage_events` table (schema.sql:96-120) via `recordAgentUsage()` in actions.ts:77-96. The dashboard renders via `renderUsagePanel()` in article.ts:960-1064. Cost tracking is broken: `cost_usd_estimate` is never calculated (no pricing module exists). Copilot CLI provider returns `usage: undefined` (copilot-cli.ts:195). Dashboard has no per-provider breakdown despite multi-provider support. All 7 providers store tokens consistently except copilot-cli.

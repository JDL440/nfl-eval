# Phase C: Tier 2 + Tier 3 Implementation Plan

## Problem
Implement the deferred Tier 2 (Analytics Agent Upgrade) and Tier 3 (MCP Extension) from the nflverse integration research plan. Key insight: the repo uses MCP servers (not native Copilot CLI extensions), so Tier 3 maps to MCP tool registration in `mcp/server.mjs`.

## Approach

### Tier 2 — Analytics Agent Upgrade
1. **Analytics charter rewrite** — Deep knowledge areas for PBP analysis, tracking data, FTN charting, historical comps
2. **New query script: `query_pfr_defense.py`** — Individual defensive player production (tackles, coverage, pressure). Fills the biggest data gap.
3. **New query script: `query_historical_comps.py`** — Multi-season player comparison framework (query 5+ seasons to find statistical comps)
4. **Update SKILL.md** — Document new scripts and capabilities

### Tier 3 — MCP Extension (nflverse-query)
5. **Create `.github/extensions/nflverse-query/tool.mjs`** — 10 MCP tools wrapping all query scripts
6. **Register in `mcp/server.mjs`** — Add nflverse-query tools to the MCP server
7. **Update smoke test** — Add nflverse tool coverage to `mcp/smoke-test.mjs`
8. **Update SKILL.md** — Document MCP tool availability for agents

## Todos
- `pfr-defense-script` — Build query_pfr_defense.py (defensive player stats)
- `historical-comps-script` — Build query_historical_comps.py (multi-season player comps)
- `analytics-charter-rewrite` — Full Tier 2 charter upgrade
- `nflverse-mcp-tools` — Create tool.mjs with 10 tool definitions + handlers
- `mcp-server-register` — Register nflverse tools in mcp/server.mjs
- `smoke-test-update` — Add nflverse tools to smoke test
- `skill-update` — Update SKILL.md with new scripts + MCP tools

## Notes
- Tools shell out to Python scripts (same pattern as pipeline-telemetry.mjs)
- Tool results return markdown tables as text content
- All scripts support --format json for structured MCP responses
- MCP tools map 1:1 to existing query scripts plus the two new ones

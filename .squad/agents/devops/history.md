# History — DevOps

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, GitHub Actions
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `.github/workflows/` (CI/CD), `.github/extensions/` (extensions), `.github/ISSUE_TEMPLATE/` (templates), `mcp/` (MCP servers), `.mcp.json` (MCP config)

## Learnings

- Team initialized 2025-07-18
- GitHub Actions used for CI, triage, label sync
- MCP tools available for Substack, image gen, nflverse
- `.github/agents/squad.agent.md` defines Squad coordinator governance
- **Issue #83 (K5a):** Fact-checking is already wired at 3 stages (preflight Stage 4→5, editor Stage 6, deterministic roster Stage 7) but limited to roster-only data. AgentRunner (`src/agents/runner.ts`) is pure LLM — no tool-calling capability. Key gap is connecting 11 nflverse MCP tools to fact-check stages. Recommended: pre-compute enriched fact-check context (Option A) before LLM call. Implementation is Code scope, not DevOps.

### 2026-03-22: Fact-Check Investigation Outcome

**Result:** Investigation confirmed fact-checking scope for issue #83. Code team implemented via pre-compute fact-check context (Option A) + deterministic validators (Option C). Pipeline enhancements deployed in PR #89 (merged).

**No DevOps changes required.** Fact-checking now integrated at 3 pipeline stages (Stage 4→5, 5→6, 6→7).



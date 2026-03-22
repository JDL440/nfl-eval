# History — Ralph

## Session 1 — Team Initialization
- **Date:** 2026-03-22
- **Context:** Squad initialized for NFL Lab (nfl-eval). TypeScript/Node.js platform with 8-stage article pipeline, Hono+HTMX dashboard, multi-provider LLM gateway, MCP tools for Substack/image gen/nflverse.
- **Repo:** JDL440/nfl-eval
- **Owner:** Joe Robinson (Product Owner / Tech Lead)
- **Note:** Ralph operates as the background work monitor. Runs via both GitHub Actions (squad-heartbeat.yml — lightweight triage) and local ralph-watch.ps1 (heavy agent work, 5-minute interval). The article pipeline agents in src/config/defaults/charters/ are separate from the Squad team.

# History — Lead

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/config/defaults/charters/nfl/` (47 pipeline agents), `src/dashboard/` (Hono UI), `src/pipeline/` (article pipeline), `tests/` (vitest)

## Learnings

- Team initialized 2025-07-18 with functional role names (Lead, Code, Data, Publisher, Research, DevOps, UX)
- @copilot enabled with auto-assignment for well-scoped issues
- Joe Robinson is the human Product Owner / Tech Lead with final decision authority

### 2025-07-19: Triage Round 1 — 5 non-article project issues

**Closed as complete (already implemented in v2):**
- **#73** (nflverse integration) — Fully shipped: 11 MCP tools, 11 Python query scripts, TypeScript DataService, 20+ cached parquet files. Every research question answered.
- **#72** (Substack Notes) — Fully shipped: `publish_note_to_substack` MCP tool, `SubstackService.createNote()`, `notes` DB table, dashboard Note composer, API endpoint.

**Routed for work:**
- **#81** (Token Usage UX broken) → `squad:ux`. Usage tracking infrastructure exists (`usage_events` table, `renderUsagePanel`) but likely has display/accuracy bugs, especially with multi-provider cost reporting. Imagen provider throws runtime error.
- **#76** (Mass Document Update Service) → `squad:code`. Significant 4-phase feature. Some batch processing exists (PipelineScheduler, migration) but not the full catalog-wide find-and-replace with Substack sync described in the issue.
- **#70** (Social link image generation) → `squad:ux`. Cover image generation works (Gemini 3 Pro) but needs style standardization using Witherspoon article as reference, plus platform-specific OG preview auditing.

**Key finding:** The v2 platform is more capable than the backlog reflects. Two major research spikes (#72, #73) were fully implemented but never closed. Future triage should cross-check the codebase before assuming issues are still open work.

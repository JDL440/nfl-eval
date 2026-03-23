# History — Data

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js (core), Python (data queries via nflverse)
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `requirements.txt` (Python deps), `mcp/` (MCP tools including nflverse), `src/services/` (data services), `content/` (pipeline output)

## Learnings

- Team initialized 2025-07-18
- nflverse is the primary NFL data source (Python ecosystem)
- 47 article pipeline agents consume data for analysis — accuracy is critical
- 2026-03-22: Issue #85 phases 1–3 now use YAML glossaries with per-entry `source`, `verified_date`, and `ttl_days`, while team sheets stay markdown with short-TTL frontmatter for volatile leadership facts.
- 2026-03-22: For durable team identity files, official club/NFL pages anchor leadership and venue facts; seasonal identity claims should defer to current nflverse efficiency or charting refreshes.
- 2026-03-22: Issue #85 team sheets should avoid baked-in seasonal EPA or usage facts; keep durable identity in markdown body and push volatile facts into source guidance plus refresh workflows.
- 2026-03-22: Buffalo's official team site currently lists Joe Brady as head coach, so team-sheet validation should prefer current official pages over older internal assumptions.

### 2026-03-22T18-23-26Z: Issue #85 decision sync
- The merged decision set keeps the glossary schema and team-sheet frontmatter as the canonical Phase 1-3 shape.
- Older decision history is archived, so the current planning file is easier to read while still preserving provenance.
- Freshness and source metadata remain the key durability markers for future data work.

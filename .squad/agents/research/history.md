# History — Research

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `docs/` (documentation), `VISION.md` (project vision), `README.md`, `src/config/` (configuration)

## Learnings

- Team initialized 2025-07-18
- VISION.md is the strategic north star — owned by Joe Robinson, last updated 2026-03-20
- 47 article pipeline agents have individual charters in `src/config/defaults/charters/nfl/`
- **2025-07-19 — Issue #85: Structured Domain Knowledge Research**
  - Completed full inventory of existing domain knowledge infrastructure
  - Found 176 bootstrap facts in `src/config/defaults/bootstrap-memory.json` (flat, no hierarchy)
  - Live roster context injected via `src/pipeline/roster-context.ts` at Idea→Prompt, Editor, Factcheck stages
  - Agent memory system (`src/agents/memory.ts`) persists learnings in SQLite with relevance scoring
  - Context config (`src/pipeline/context-config.ts`) routes artifacts to agents per-article
  - Identified 7 gaps: no team glossaries, no hierarchical KB, no factual currency, no source tracking, no team identity sheets, no unified glossary, no inter-fact relationships
  - Proposed 4-layer Hierarchical KB: Universal Glossaries (YAML), Team Identity Sheets (MD), Domain Knowledge Index (JSON), Monthly Refresh Job (cron)
  - Effort estimate: MEDIUM (5–7 days), recommend phased rollout starting with glossaries + team sheets
  - Decision document created at `.squad/decisions/inbox/research-domain-knowledge.md`
  - Full findings posted to GitHub issue #85
- **2025-07-19 — Issue #85: Research findings posted & label updated**
  - Re-ran investigation confirming prior findings; posted comprehensive comment to issue #85
  - Updated label from `go:needs-research` → `go:yes`
  - Key deliverable: 4-layer Hierarchical KB proposal (glossaries → team sheets → indexed facts → monthly refresh)
  - Affected files: runner.ts, actions.ts, bootstrap-memory.json, + new glossaries/ and team-sheets/ dirs

### 2026-03-22: Decision Document & Session Completion

**Decision submitted:** Research-domain-knowledge.md merged to squad decisions.md. 4-layer Hierarchical KB proposal ready for Lead/PO review.

**Coordination:** Research findings inform Code team's potential future work on domain knowledge infrastructure (Phases 1–3: glossaries, team sheets, domain index).



# History — Research

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `docs/` (documentation), `VISION.md` (project vision), `README.md`, `src/config/` (configuration)

## Core Context

- Team initialized 2025-07-18; `src/config/defaults/` is the seeded knowledge home, while article artifacts live under `content/articles/{slug}/`.
- VISION.md is the strategic north star — owned by Joe Robinson, last updated 2026-03-20.
- Issue #85 established the static knowledge-asset proof of concept: glossaries plus team sheets, with runtime loading deferred.
- Issue #93 / #104 established deterministic usage-history reads: full history for UI surfaces, bounded reads kept explicit.
- TLDR contract drift is now the canonical article-skeleton concern: `substack-article.md` is the source of truth and role charters should reference it instead of duplicating structure policy.
- Revision visibility and thinking visibility are separate dashboard seams; revision data lives in `revision_summaries`, while thinking traces already exist as `*.thinking.md` artifacts.

## Learnings

- 2026-03-22 — Issue #85 planning: recommended a static glossary + team-sheet asset layout and kept runtime loading in the deferred follow-up.
- 2026-03-22 — LLM observability: persisted thinking artifacts and usage events are the main debug surfaces; raw prompts/responses are not stored.
- 2026-03-22 — TLDR prompt contract drift: writer delegates structure, downstream skills require TLDR, and the safest canonical source is `substack-article.md`.
- 2026-03-22 — Revision / thinking visibility: revision history belongs to a dedicated hydration path, while debug artifacts need broader discoverability.
- 2026-03-22 — Scribe inbox merge: confirmed the TLDR enforcement, retrospective logging, and dashboard visibility notes align with the existing canonical decisions.


### 2026-03-22T22-20-49Z: Scribe maintenance — revision/thinking visibility
- Confirmed the revision/thinking visibility investigation is canonical in .squad/decisions.md; no inbox files remained to merge.
- No archive rollover was required, and the dashboard gap remains a discoverability/navigation seam rather than a persistence gap.


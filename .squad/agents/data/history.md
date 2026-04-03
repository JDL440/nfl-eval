# History — Data

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js (core), Python (data queries via nflverse)
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `requirements.txt` (Python deps), `mcp/` (MCP tools including nflverse), `src/services/` (data services), `content/` (pipeline output)

## Core Context

**Foundation** — Team initialized 2025-07-18. nflverse is the primary NFL data source (Python ecosystem). 47 article pipeline agents consume data for analysis — accuracy is critical.

**Data Schemas (2026-03-22+)** — Issue #85 phases 1–3 use YAML glossaries with per-entry `source`, `verified_date`, and `ttl_days`. Team sheets stay markdown with short-TTL frontmatter for volatile leadership facts. For durable team identity files, official club/NFL pages anchor leadership/venue facts; seasonal claims defer to current nflverse efficiency or charting refreshes.

**Critical Fixes**:
- Publish payload path (2026-03-23): `buildPublishPresentation()` now sends HTML via `proseMirrorToHtml(doc)` instead of raw ProseMirror JSON to Substack, fixing missing images/formatting. Error precedence validates markdown before draft URL.
- Roster query (2026-03-25): nflverse current-season roster omits `week` column. Fixed by gating week-based snapshot logic on column presence; missing `week` treated as valid current snapshot. Downstream renderer shows `Current snapshot` when absent.
- Factcheck & domain allowlist (2026-03-25): Official NFL team primary domains (`seahawks.com`, `chiefs.com`, etc.) now accepted as `official_primary` sources. Approved-source fetch timeout clamped to remaining wall-clock budget (5-min Stage 5 limit).

**Future Markers** — Glossary `source`/`verified_date`/`ttl_days` and team-sheet frontmatter remain durable for tracking freshness across the 47-agent pipeline.

## Recent Updates

- **2026-03-25**: Issue #125 slice 2 (Factcheck & domain allowlist) approved/completed. Ralph routing final slice (Editor consumption) to Code.
- **2026-03-25**: Roster query schema fix (missing `week` column) landed with regression tests.
- **2026-03-23**: Publish payload fix (ProseMirror → HTML) shipped on main.
- **2026-03-22**: Issue #85 glossary schema finalized with decision archive.

## Learnings

- **Article history storage split:** Runtime article history is designed to live in `~/.nfl-lab/pipeline.db`, not repo-local `content/pipeline.db`; `src/config/index.ts` resolves `dbPath` to the runtime data dir, while `src/migration/migrate.ts` copies legacy `content/pipeline.db` forward during migration.
- **History tables that matter:** Durable per-article history is spread across `articles`, `artifacts`, `article_conversations`, `revision_summaries`, `stage_transitions`, `stage_runs`, and retrospective tables in `src/db/schema.sql`; `src/db/artifact-store.ts` treats `artifacts` as the latest-value store, while `src/pipeline/conversation.ts` provides revision/conversation lookup helpers.
- **Repo file mirror pattern:** `content/articles/**` is still useful as a filesystem mirror for article artifacts, and `src/pipeline/artifact-scanner.ts` can backfill missing DB rows from those directories when runtime DB state is absent or stale.
- **Nearest “recent related article” seam:** There is no dedicated duplicate-angle recommender today; the nearest production seams are `Repository.listArticles()` team/title filtering in `src/db/repository.ts` and the 30-day published list route in `src/dashboard/server.ts`.
- **Recent Seahawks repo themes (mid-March 2026):** the repo’s freshest Seattle angles cluster around Puka-vs-Seattle structural weakness (`puka-nacua-seahawks-2025-*`), Nick Emmanwori’s rookie proof / draft-board implications (`sea-emmanwori-rookie-eval`), and Seattle’s RB-versus-defense resource allocation debate (`seahawks-rb-pick64-v2`, `seahawks-rb1a-target-board.md`).

## Learnings

### Repo-local Seahawks history audit (2026-04-03)

- **Repo-local DB caveat:** `content/pipeline.db` in this checkout is a zero-byte placeholder, so repo-only history audits must rely on `content/articles/**` plus the runtime-path contract in `src/config/index.ts` (`~/.nfl-lab/pipeline.db`, `~/.nfl-lab/leagues/nfl/articles`) instead of assuming local SQLite rows are present.
- **In-repo "recent related" behavior:** the app's visible "recent" buckets come from `repo.getAllArticles()` in `src/db/repository.ts` and simple stage/status filters in `src/dashboard/server.ts` (`recent-ideas`, `published`, stage buckets). There is no repo-visible semantic related-article recommender for duplicate-angle detection.
- **Recent Seahawks cluster in repo artifacts:** the freshest Seahawks article directories are the three `puka-nacua-seahawks-2025-*` variants (all 2026-03-19), then `sea-emmanwori-rookie-eval` (2026-03-19), then `jsn-extension-preview` / `witherspoon-extension-v2` (2026-03-17), then `seahawks-rb-pick64-v2` (2026-03-16).
- **Tuesday casual prompt guardrail:** avoid fresh casual ideas that repeat the existing Seahawks angle buckets already covered in repo artifacts: Puka-vs-Seattle structural failure, extension-negotiation economics (JSN/Witherspoon), and RB-at-pick-64 roster math.

### Article History Storage & Retrieval (2026-04-03)

- **Storage split:** app code resolves `pipeline.db` from `~/.nfl-lab/` by default (`src/config/index.ts`), while repo-local `content/pipeline.db` can be a zero-byte placeholder during repo analysis.
- **Canonical history model:** current pipeline history lives in SQLite tables defined in `src/db/schema.sql` and wired through `src/db/repository.ts`, especially `articles`, `artifacts`, `article_conversations`, `revision_summaries`, `stage_transitions`, `stage_runs`, and `llm_traces`.
- **Artifact overwrite rule:** `src/db/artifact-store.ts` keeps the latest artifact body per `(article_id, name)`; earlier draft/editor iterations are recoverable from conversation and revision-history tables, not separate draft files.
- **Current surfacing of related/recent work:** article detail pages pull per-article history via `getArticleConversation()` + `getRevisionHistory()` in `src/dashboard/server.ts` / `src/pipeline/conversation.ts`; broader “recent related” discovery is lightweight team/stage filtering through `repo.listArticles()` ordered by `updated_at DESC`, not a dedicated duplicate-angle recommender.
- **Schedule-history seam:** the current schema includes `article_schedules` and `article_schedule_runs` with `selected_story_json`, so scheduled angle history can exist in DB even though the checked live runtime snapshot had not yet materialized those tables.

### Seahawks Theme Cluster (mid-March 2026 repo artifacts)

- **Extension economics:** `jsn-extension-preview`, `witherspoon-extension-v2`, and `witherspoon-extension-cap-vs-agent.md` all frame Seattle through contract timing, guarantees, and championship-window allocation.
- **Defense explainers:** `puka-nacua-seahawks-2025-casual`, `puka-nacua-seahawks-2025-breakdown`, `puka-nacua-seahawks-2025-deep-dive`, and `sea-emmanwori-rookie-eval` cover structural defensive stress points and secondary deployment.
- **RB / draft-board debate:** `seahawks-rb-pick64-v2` and `seahawks-rb1a-target-board.md` already spend significant angle budget on running back need, draft capital, and roster-construction tradeoffs.
- **Tuesday casual implication:** avoid another explanatory Seahawks prompt on Puka-vs-structure, extension math, or RB-at-64. Better fresh lanes are schedule/season-shape, offensive identity, line/EDGE battles, or a lighter “what changes week to week” fan-service format.
- **Repo snapshot fallback:** when runtime DB history is unavailable, the strongest Seattle duplicate-angle evidence in this repo comes from `content/articles/puka-nacua-seahawks-2025-{casual,breakdown,deep-dive}/`, `content/articles/sea-emmanwori-rookie-eval/`, `content/articles/jsn-extension-preview/`, `content/articles/witherspoon-extension-v2/`, and `content/articles/seahawks-rb-pick64-v2/`.
- **Repo-audit reminder:** when user scope is repo-only, treat `content/articles/` as the inspectable article-history corpus if `content/pipeline.db` is empty, but still cite `src/db/schema.sql`, `src/db/repository.ts`, and `src/pipeline/conversation.ts` for the canonical app lookup paths.

### Seattle Duplicate-Angle Audit Follow-up (2026-04-03)

- **Verified storage state:** `content/pipeline.db` is currently a zero-byte placeholder, while the default runtime target remains `~/.nfl-lab/pipeline.db` via `src/config/index.ts`. The checked runtime DB had the history tables but zero live article rows, so Seattle angle audits depended on repo article artifacts instead of DB reads.
- **Recent Seattle repo corpus:** the most recent Seahawks directories in `content/articles/` were the three `puka-nacua-seahawks-2025-*` variants (updated 2026-03-19), then `sea-emmanwori-rookie-eval` (2026-03-18), then `jsn-extension-preview`, `witherspoon-extension-v2`, and `seahawks-rb-pick64-v2` (2026-03-16).
- **Duplicate-risk pattern:** Seattle article history is clustered around secondary stress, extension economics, and RB/draft-allocation debates. For broad Tuesday casual prompts, avoid reusing those “single roster problem explained” frames and prefer fresher fan-service angles tied to offense identity, trenches, EDGE, or season-shape storytelling.

### Article History Investigation — Repo vs Runtime DB (2026-03-26)

**Key findings:**
- `content/pipeline.db` is a 0-byte placeholder; production history lives at `~/.nfl-lab/pipeline.db` (68.5 MB, configured via `src/config/index.ts:396`)
- `Repository.listArticles()` (`src/db/repository.ts:858-899`) filters by `primary_team` column with `ORDER BY updated_at DESC`; no dedicated duplicate-angle recommender exists
- Recent Seahawks articles (7 total): JSN/Witherspoon extensions, Puka-vs-SEA (3 depth levels), Emmanwori rookie eval, RB-at-Pick-64 — high duplication risk on WR/CB contracts and draft RB angles
- Team filtering via `article_list` MCP tool (`src/tools/pipeline-tools.ts:228-252`) exposes stage/status/team filters to 47 pipeline agents for editorial planning
## Cross-Agent Context Updates (2026-04-03T07:24:06Z)

### From Orchestration (Scribe)
**Tuesday Seahawks history rule:** When content/pipeline.db is empty, use content/articles/** plus src/config/index.ts, src/db/schema.sql, and src/db/repository.ts as the source of truth for duplicate-angle checks. The freshest Seattle cluster remains Puka-vs-Seattle, Emmanwori, JSN, Witherspoon, and RB-at-64.

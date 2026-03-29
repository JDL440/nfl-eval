# Active Decisions

- **Dashboard mobile restyle directive** (2026-03-29T20-08-26Z): Eliminate hamburger/menu overlap and horizontal overflow on the live dashboard/mobile shell, and restyle the product toward a premium, designed app feel rather than an AI-vibe default.
- **Code UX Modernize** (2026-03-29): Implement the dashboard modernization as a shared mobile-first system first, then layer page polish on top. Shared shell primitives should own responsive header/nav behavior across live routes.
- **Copilot CLI session artifact harvest** (2026-03-29): When harvesting local Copilot CLI artifacts, read from `C:\Users\jdl44\.copilot\session-state` plus root carry-forward docs, `plan.md`, `checkpoints/*.md`, and `research/*.md`; exclude logs, caches, DBs, packaged docs, and machine config, and preserve provenance in repo-owned archive filenames.
- **Dashboard cleanup audit final** (2026-03-29T18:42:53Z): Treat `/config` (Settings) as the only remaining dashboard admin surface. Keep `/articles/:id/traces`, `/traces/:id`, and `POST /api/agents/refresh-all`. Remove/fail closed any leftover references implying retired `/agents`, `/memory`, `/runs`, `/runs/:id`, or article-detail stage-run/timeline chrome still exist. Trace observability lives on trace pages; maintenance lives on Settings; retired admin browsers do not linger through copy, tests, or dead code.
- **Dashboard article cleanup complete** (2026-03-29T11:38:22Z by Code): Removed pipeline-activity bar, stageRuns data, stageRunErrorHtml from article detail. Cleaned dead CSS. All view/test/import artifacts confirmed already removed.
- **Dashboard surface retirement** (2026-03-29): Retire `/agents`, `/memory`, and `/runs` surfaces instead of keeping placeholder pages. Preserve trace observability via `/articles/:id/traces`, `/traces/:id`. Preserve operator maintenance through `/config` + `POST /api/agents/refresh-all`. Delete obsolete view modules and route tests; keep artifact trace access via simple Trace button.
- **UX settings copy guidance** (2026-03-29): Call `/config` "Settings" in operator-facing copy to match nav label. Remove references to retired context-config UI. Describe memory honestly as legacy storage for refresh/migration maintenance, not as active user-facing feature.
- Dashboard cleanup remains the current direction: `/config` is the single admin surface; legacy `/agents`, `/memory`, `/runs`, and article-side advanced/context-config/stage-runs UI are removed.
- Trace observability stays on `/articles/:id/traces` and `/traces/:id`, and `POST /api/agents/refresh-all` stays available.
- Memory storage/schema remain intact, but runtime memory injection stays disabled pending redesign.
- Runner traces must preserve `availableTools` and merge provider-native tool-loop calls when the app-managed loop is bypassed.
- LM Studio structured output for qwen should use `json_schema` or `text`; `json_object` is not accepted.
- Checked-out `main` should only advance through a fast-forward descendant of the validated target.
- Older detailed decision history has been archived to `.squad/decisions-archive.md`.

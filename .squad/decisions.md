# Active Decisions

- Dashboard cleanup remains the current direction: `/config` is the single admin surface; legacy `/agents`, `/memory`, `/runs`, and article-side advanced/context-config/stage-runs UI are removed.
- Trace observability stays on `/articles/:id/traces` and `/traces/:id`, and `POST /api/agents/refresh-all` stays available.
- Memory storage/schema remain intact, but runtime memory injection stays disabled pending redesign.
- Runner traces must preserve `availableTools` and merge provider-native tool-loop calls when the app-managed loop is bypassed.
- LM Studio structured output for qwen should use `json_schema` or `text`; `json_object` is not accepted.
- Checked-out `main` should only advance through a fast-forward descendant of the validated target.
- Older detailed decision history has been archived to `.squad/decisions-archive.md`.

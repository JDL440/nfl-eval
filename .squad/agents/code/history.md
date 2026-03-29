# Code Agent Project History

## Core Context
- Dashboard cleanup treats `/config` as the single admin surface; legacy `/agents`, `/memory`, `/runs`, and article-side advanced/context-config/stage-runs UI are removed.
- Trace observability stays on `/articles/:id/traces` and `/traces/:id`, with `POST /api/agents/refresh-all` preserved.
- Memory storage/schema remain intact, but runtime memory injection is intentionally disabled pending redesign.
- Runner traces should preserve `availableTools` and merge provider-native tool-loop calls when the app-managed loop is bypassed.
- LM Studio structured output on qwen requires `json_schema` or `text`; `json_object` is rejected.
- Fast-forward-only advancement of checked-out `main` is the safe integration policy.

## Learnings
- 2026-03-29 — Dashboard regression tests for the approved cleanup should assert operator-visible states only: `/config` always renders the maintenance target, refresh-all form visibility depends on runner+memory initialization, and article tests should verify the current metadata/detail shape while excluding legacy `/context-config` and inline edit-form copy.
- 2026-03-29 — Dashboard surface cleanup validated: deprecated `/agents`, `/memory`, and `/runs` UI was removed; trace pages and `POST /api/agents/refresh-all` stayed intact; article detail now focuses on metadata, artifacts, revisions, reviews, actions, and usage.
- 2026-03-29 — The clean integration lane for v4 forward-port validation is `C:\github\worktrees\nfl-eval-v4-integration-f31a5ec` on branch `devops/v4-integration-f31a5ec`; use it for focused validation instead of the dirty root checkout when possible.
- 2026-03-29 — LM Studio and Copilot trace seams depend on provider metadata continuity: trace start records available tools, and completion must merge app-managed tool calls or provider-native tool-loop calls so traces stay observable.
- 2026-03-29 — The dashboard settings/config surface is the preferred low-risk seam for runtime validation, while model/tool-loop/provider routing changes should be kept isolated from operator UI cleanup.

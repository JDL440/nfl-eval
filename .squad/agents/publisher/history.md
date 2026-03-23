# History — Publisher

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, MCP tools for Substack/image generation
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `content/` (pipeline output), `mcp/` (MCP tools), `src/services/` (publishing services)

## Core Context

- Stage 7 publishing is a manual two-step flow: create or update the Substack draft first, then publish that linked draft.
- `/articles/:id/publish` is the draft-first workspace; copy should clearly distinguish draft state, publish action, and optional Notes/Tweets.
- The current failure mode is startup wiring, not route logic: `createApp()` can accept `substackService`, but normal `startServer()` startup does not construct or pass it.
- For local article publishing, the meaningful env vars are `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL`; stage-target and Notes support are separate paths.
- The publish page should keep the richer preview/error guidance aligned with the actual dashboard state so editors see whether publishing is unavailable, draft-ready, or live.

## Recent Learnings

- 2026-03-25 — Substack config trace: confirmed the missing `SubstackService` injection is the root cause of the dashboard publish failure path; route tests pass because they inject a mock service directly.
- 2026-03-24 — Publish-overhaul coordination: the draft-first model, preview expectations, and error-state copy were aligned across Publisher, UX, and Code.
- 2026-03-23 — Stage 7 publish UX review: terminology like “publish workspace” should be replaced with clearer action/state labels.

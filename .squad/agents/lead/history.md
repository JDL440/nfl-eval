# History — Lead

## Core Context

### Issue Decisions (Locked & Approved)

- **Issue #85**: structured domain knowledge stays in static assets and docs/testing; runtime integration remains deferred.
- **Issue #102**: dashboard auth direction is single-operator local login with Hono middleware, opaque sessions, and SQLite persistence.
- **Issue #107**: `substack-article.md` is the canonical contract; Writer/Editor/Publisher and guards all reference it.
- **Issue #108**: keep retrospective landing to the smallest coherent runtime slice only; dashboard/CLI/reporting stay deferred.
- **Issue #115/#116/#117/#118**: manual CLI digest first, with #117 unblocked and #118 dependent on the digest scaffold.
- **Publish-overhaul**: keep the work isolated from unrelated mainline changes; draft-first publish is the shared product direction.

### Team & Project Context

- **Team:** Initialized 2025-07-18 (Lead, Code, Data, Publisher, Research, DevOps, UX)
- **Owner:** Joe Robinson (PO/Tech Lead, final decision authority)
- **Platform:** NFL Lab (nfl-eval); TypeScript, Node.js, Hono, HTMX, SQLite
- **Key paths:** `src/config/defaults/charters/nfl/` (47 pipeline agents), `src/dashboard/` (Hono UI), `src/pipeline/`, tests/vitest

### Architecture Notes

- Dashboard (port 3456): Hono + HTMX + SSE, currently no auth middleware
- Article pipeline: 47 agents separate from Squad agents
- Conversation history per article with revision summaries; long turns truncated for prompt context
- Repository: article pipeline, agents, usage tracking, retrospectives, drafts; no auth/session tables yet
- Config: `src/config/index.ts` loads `.env` and `~/.nfl-lab/config/.env` for runtime + provider/service vars

## Recent Learnings

- 2026-03-24 — Retrospective worktree triage: mainline already contains the approved minimal runtime slice, so unrelated worktree drift should not be ported.
- 2026-03-24 — Publish-overhaul isolation strategy: branch from `origin/main`, stash unrelated work, and keep the dashboard publish commit publish-only.
- 2026-03-23 — Issue #107 approval: the TLDR contract enforcement is complete and regression coverage passed.

### 2026-03-25: Dashboard publish missing-config review
- Verified the original failure path on `POST /api/articles/:id/draft` and `POST /api/articles/:id/publish`: when `substackService` was undefined, HTMX callers received HTTP 500 before any publish-panel fragment render, so the page surfaced a raw failure instead of actionable guidance.
- Current route behavior now returns `renderPublishWorkflow()` for HTMX requests with concrete recovery steps (`SUBSTACK_PUBLICATION_URL`, `SUBSTACK_TOKEN`, restart dashboard, check `/config`) while JSON callers still receive 500 JSON errors.
- Review outcome: behavior fix is good, but the current diff is not a narrow hotfix. `src/dashboard/server.ts` and `tests/dashboard/server.test.ts` also carry broader publish-workflow, revision-history, and artifact-rendering changes, and there is still no direct regression test for `createSubstackServiceFromEnv()` / startup DI wiring.

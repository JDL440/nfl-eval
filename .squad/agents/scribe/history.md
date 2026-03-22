# History — Scribe

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval

## Learnings

- Team initialized 2025-07-18
- Decision inbox pattern: agents write to `.squad/decisions/inbox/{agent}-{slug}.md`, Scribe merges to `decisions.md`
- Orchestration logs go to `.squad/orchestration-log/{timestamp}-{agent}.md`
- Session logs go to `.squad/log/{timestamp}-{topic}.md`
- Issue #85 coordination: merge inbox decisions into `decisions.md`, then record brief orchestration/session logs and update affected agent histories when the new decision materially changes planning context

### 2026-03-22T18-23-26Z: Issue #85 session record
- Merged the issue #85 decision inbox, archived older decisions, and wrote the orchestration/session logs for the current pass.
- Cross-agent history was updated for Research, Code, Lead, and Data to preserve the static-asset scope boundary.

### 2026-03-22T18:35:21Z: Thinking/debug regression pass

- Wrote the orchestration and session logs for the article-detail debug visibility investigation.
- Verified the decision inbox entries were already represented in `decisions.md`, so no archive roll-up was needed.
- Cross-agent context now records that persisted `*.thinking.md` artifacts remain the canonical debug source, with inline extraction only as a legacy fallback.

### 2026-03-22T19:20:00Z: Issue #93 token usage seam

- The article usage gap was caused by the repository read seam (`Repository.getUsageEvents()` defaulting article reads to the newest 100 rows), not by provider token creation or dashboard chart rendering.
- Future usage investigations should verify repository defaults first so early provider events are not clipped out of article-level history views.

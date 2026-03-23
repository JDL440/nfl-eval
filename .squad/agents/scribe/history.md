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
### 2026-03-23T01:23:06Z: Issue #110 scribe pass
- Wrote orchestration logs and the session log for the issue #110 triage pass.
- Merged the new decision inbox items, deduplicated the article-trace notes against the established #109 decision, and removed the inbox files.
- No archive rollover or history summarization was needed.
### 2026-03-23T02:07:00Z: Code dev.ps1 scribe pass
- Merged the dev.ps1 decision from inbox into `decisions.md` at the top (most recent).
- Wrote orchestration log (`.squad/orchestration-log/2026-03-23T02-07-00Z-code.md`) and session log (`.squad/log/2026-03-23T02-07-00Z-code.md`).
- Updated Code agent history with expanded dev.ps1 learning.
- No inbox files remained to clean (Code had already created the inbox file in the commit).

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
### 2026-03-22T19:09:46Z: Issue #93 scribe maintenance pass
- Merged Lead's issue #92 hybrid context model decision and UX's issue #93 query-layer diagnosis into decisions.md.
- UX inbox entry was a partial duplicate; merged only the unique diagnostic framing and scope note.
- Summarized lead/history.md (was 13,682 bytes) into ## Core Context block.
- No entries qualified for archiving (all decisions dated 2026-03-22, none >30 days old).
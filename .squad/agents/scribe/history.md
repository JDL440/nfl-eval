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

### 2026-03-22T19:11:56Z: Issue #92 follow-up maintenance pass
- Wrote orchestration logs for Code and Lead, plus a brief session log for the hybrid context implementation.
- Merged the remaining issue #93 inbox notes into decisions.md with a single deduplicated repository-hydration decision.
- Appended cross-agent history updates for the Code implementation and Lead review follow-through.
### 2026-03-22T19-13-43Z: Issue #93 session record
- Wrote orchestration logs for UX and Lead.
- Merged the issue #93 decision inbox into `.squad/decisions.md` and deleted the inbox files.

### 2026-03-22T19:14:56Z: Issue #93 maintenance pass
- Merged the remaining issue #93 decision material and updated the official decision record.
- Logged the team outcome as blocked / not reproducible after lead, UX, and code review converged.
- Removed the inbox artifact after folding its content into the decision log.

### 2026-03-22T19:07:48.2253500Z: Issue #93 coordination pass
- Confirmed the inbox content was already represented in the canonical decision log and kept the merge/deletion cleanup in sync.
- Wrote the current orchestration and session logs for the maintenance pass.

### 2026-03-22T22:01:57Z: Issue #104 scribe maintenance pass
- Wrote orchestration and session logs for the usage-history follow-up pass.
- Confirmed the issue #103 decision inbox was already canonical in decisions.md and removed the stale inbox artifact.
- No decisions qualified for archiving because the remaining decision entries were current.
### 2026-03-22T22-07-35Z: Issue #104 squad maintenance
- Merged the inbox decisions into `.squad/decisions.md` and removed the inbox files.
- Wrote orchestration logs and the session log for the approved usage-history follow-up.

### 2026-03-22T22-09-11Z: Issue #103 maintenance pass
- Wrote the current orchestration and session logs for the editor-review cap follow-up.
- Confirmed the inbox decisions were already canonical and deleted the stale inbox artifacts without adding duplicate decision text.

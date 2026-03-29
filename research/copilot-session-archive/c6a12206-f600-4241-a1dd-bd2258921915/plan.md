Problem: Complete Phase B of the nflverse plan and validate it against a real in-flight article workflow.

Approach:
- Extend the `content/data/` query library with the four Phase B scripts from the approved roadmap.
- Update prompt-template guidance so discussion prompts explicitly tell agents which nflverse commands to run for structured data anchors.
- Validate the new scripts and the prompt integration against `buf-2026-offseason`, while respecting reviewer lockout on `draft.md`.

Progress:
- Phase A is complete: root Python deps, cache tooling, three initial query scripts, nflverse skill doc, analytics charter update, and smoke-tested auto-fetch workflow.
- Phase B query library is complete and verified: `query_snap_usage.py`, `query_draft_value.py`, `query_ngs_passing.py`, and `query_combine_comps.py` shipped and passed smoke checks.
- Prompt-template guidance is updated in `.squad/skills/article-discussion/SKILL.md` and `.squad/skills/nflverse-data/SKILL.md`.
- Buffalo validation path is complete at the prompt + panel level:
  - `content/articles/buf-2026-offseason/discussion-prompt.md` now contains valid Phase B query instructions and March 2026-consistent framing.
  - `content/articles/buf-2026-offseason/cap-position.md` was refreshed with current cap + nflverse context.
  - `content/articles/buf-2026-offseason/buf-position.md` was refreshed with current roster + nflverse context.
- `draft.md` remains intentionally deferred because `editor-review.md` already rejected it and Writer is locked out of the next revision cycle.

Todos:
- Phase B implementation and Buffalo prompt/panel validation are complete.
- Deferred follow-up: a separate draft-refresh workflow must handle `content/articles/buf-2026-offseason/draft.md` (and any stale upstream idea/panel-composition artifacts) outside the Phase B gate.

Notes:
- The source implementation roadmap remains `C:\Users\jdl44\.copilot\session-state\c6a12206-f600-4241-a1dd-bd2258921915\research\i-want-to-add-another-expert-for-more-advanced-dat.md`.
- Phase B should stay within the current platform shape: no new agent, no extension work, no gameday pipeline work.
- The practical article validation target was `buf-2026-offseason`, but the validation scope was narrowed to prompt + panel artifacts because the draft is under reviewer lockout and needs a separate refresh owner.

Problem: Cookie-based Substack auth now succeeds locally, but draft creation fails with a 400 response complaining that `draft_bylines` is invalid. The likely issue is a stale or incomplete request body for `/api/v1/drafts`.

Approach:
- Inspect the current cookie-auth draft payload builder and compare it against the failing live behavior and any available upstream guidance.
- Patch the backend request shape conservatively so local draft creation works without regressing existing cookie-auth behavior.
- Add or update automated coverage around the Substack draft payload and rerun the relevant existing tests.

Todos:
- `substack-draft-payload-investigation` — identify the invalid payload field(s) and implement the backend fix.
- `substack-draft-payload-validation` — add/update regression coverage and verify the relevant Jest tests pass.

Notes:
- The git worktree is already dirty, so changes must stay tightly scoped to the Substack integration and its tests.
- Auth appears healthy now; the failure is after authentication, during draft creation.

Update:
- Substack cookie-auth draft creation is now fixed and validated.
- New problem under investigation: local end-to-end intake fails with `POST /api/sweep/trigger` returning `No media-sweep.json found in content/`, and the dashboard is surfacing multiple 500s.
- Initial clue: `C:\github\nfl-eval\content\media-sweep.json` exists in the current worktree, so the local server may be running from a different cwd/worktree/container view than expected.

Current todos:
- `local-intake-debug` — identify why the running backend cannot see the sweep file and implement the correct local dev behavior.
- `local-dashboard-500-validation` — validate that the backend/local-flow fix clears the dashboard 500s and add regression coverage if needed.

Current state:
- Local Docker flow is working again after mounting `content/` into the backend container.
- Local sweep triggering now works in development and uses a dev-friendly threshold unless `SWEEP_THRESHOLD` is explicitly set.
- Dashboard API proxy checks are healthy against `http://localhost:5173/api/...`.

Next steps:
- Give the user a clean from-scratch local setup + end-to-end verification checklist.
- Optional follow-up: add a dedicated regression test for the server's dev sweep trigger contract if we want to lock the Docker/dev behavior more tightly.

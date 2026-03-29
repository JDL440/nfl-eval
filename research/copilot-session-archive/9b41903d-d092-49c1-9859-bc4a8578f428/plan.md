Problem: `npm run dashboard` crashes with an unhandled `EADDRINUSE` when port 3456 is already occupied. In this repo, the dashboard already supports `DASHBOARD_PORT`, but the current failure mode is noisy and the README only shows a Unix-style env-var example that is awkward on Windows.

Approach:
- Confirm the current port behavior and existing process on 3456.
- Improve dashboard startup so port conflicts produce a clear, actionable message instead of a stack trace.
- Add a cross-platform custom-port path that works cleanly from PowerShell and npm (`-- --port 8080`), while preserving the existing `DASHBOARD_PORT` support.
- Update the dashboard docs to show both the CLI flag and the PowerShell env-var syntax.
- Validate the updated startup behavior on an occupied port and on a free alternate port.

Todos:
- Inspect and update dashboard startup argument/port resolution logic.
- Add explicit `EADDRINUSE` handling with actionable guidance.
- Update README dashboard usage examples for Windows/cross-platform usage.
- Verify behavior by starting on the occupied default port and a free alternate port.

Notes:
- Port 3456 is currently occupied by an existing `node .\dashboard\server.mjs` process, so the new UX should acknowledge that scenario gracefully.

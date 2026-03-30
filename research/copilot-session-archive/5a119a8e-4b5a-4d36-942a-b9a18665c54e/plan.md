Problem: The stage badge shown below the dashboard title is out of sync with the stage number shown for the current batch in the Stage Runs panel.

Approach:
- Trace the badge render path and the Stage Runs panel render path.
- Identify the source-of-truth fields each path uses and align them.
- Update any affected view-model/server code so both surfaces read the same stage semantics.
- Validate with focused tests plus the TypeScript build.

Todos:
- Investigate article dashboard stage sources and confirm the mismatch seam.
- Implement a narrow fix so the title badge and Stage Runs panel agree.
- Add or update tests covering the aligned stage display.
- Run focused validation and the repo TypeScript build.

Notes:
- Prefer the Stage Runs panel’s semantics as the visible source of truth unless investigation shows it is the stale view.
- Keep the fix narrow to dashboard rendering/data flow; avoid unrelated pipeline stage behavior changes.

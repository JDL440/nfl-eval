Problem: Ralph can report an iteration failure even when Copilot exits 0 because the spawned Copilot process may not operate in the intended repo context and may never update `ralph\state\progress.txt`.

Approach:
- Make the spawned Copilot process deterministic by setting its working directory explicitly to the target repo.
- Pass the configured agent again, but do not rely on that alone.
- Render the runtime prompt with explicit `TargetRepo` and `ProgressFile` paths so the agent knows exactly which repo and state file to use.
- Validate the PowerShell script with a safe no-iteration run and parser checks.

Todos:
- Inspect current local `ralph.ps1` edits and preserve unrelated changes.
- Patch `ralph.ps1` to render a runtime prompt and set process working directory.
- Update `ralph/prompt.md` to use explicit placeholders for repo and progress-file path.
- Run safe validation without launching a real Copilot iteration.

Notes:
- `ralph.ps1` already had local edits before this session; work must layer on top of them.
- Goal is to stop false iteration failures caused by wrong repo/path context, not to change the article workflow itself.

---
name: Read-Only Tool-Calling Smoke Test
domain: runtime-audit
confidence: high
tools: [view, sql, powershell]
---

# Read-Only Tool-Calling Smoke Test

## When to Use

- You need to distinguish **permission granted** from **tool actually used**
- You need the safest proof available when a live dashboard may be the wrong checkout or login-gated
- You need to know whether trace data is only persisted or also visible in the page UI

## Pattern

Treat the audit as three separate questions:

1. **Permission granted** — was the tool offered to the run?
2. **Tool actually used** — did runtime execute it and persist the call?
3. **Trace visible in page** — does `/articles/:id/traces` render that metadata?

Do not collapse those into one “tooling works” conclusion.

### Layer 1: Identify the serving checkout first

Before touching the live dashboard, confirm what is actually serving port 3456:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 3456 } |
  Select-Object LocalAddress, LocalPort, OwningProcess

Get-CimInstance Win32_Process |
  Where-Object { $_.ProcessId -eq <PID> } |
  Select-Object ProcessId, Name, CommandLine
```

If the listener is a sibling worktree or returns login instead of data, do not use it as proof for the target checkout.

---

### Layer 2: Permission-only proof

For the current repo, the safest permission proof is the focused v4 Copilot CLI observability test:

```powershell
Set-Location C:\github\worktrees\llminputs\worktrees\v4
npm run v2:test -- --run tests/agents/tool-trace-copilot-cli.test.ts
```

**What it proves:** `availableTools` was captured in trace metadata.

**What it does not prove:** a tool actually executed. In the current Copilot CLI path, `availableTools` can exist while `toolCalls` stays empty.

---

### Layer 3: Runtime execution + persistence proof

Use the app-managed tool-loop smoke in v4:

```powershell
Set-Location C:\github\worktrees\llminputs\worktrees\v4
npm run v2:test -- --run tests/agents/runner.test.ts -t "executes a bounded tool loop and stores tool call metadata in traces"
```

**What it proves end-to-end:**
- runtime requested the read-only tool `article_get`
- the tool loop executed it
- the persisted trace stored `metadata_json.toolCalls[0].toolName = "article_get"`

This is the lowest-risk proof because it avoids live auth, avoids shared DB mutation, and stays inside the intended v4 checkout.

---

### Layer 4: Page visibility check

Inspect `C:\github\worktrees\llminputs\worktrees\v4\src\dashboard\views\traces.ts`.

Current trace cards render:
- system prompt
- user message
- provider-wrapped prompt
- provider request envelope
- provider response envelope
- thinking
- assistant output

Current trace cards do **not** render:
- `metadata_json`
- `availableTools`
- `toolCalls`

So a persisted tool call is **not currently visible as a dedicated field in the trace page UI**.

---

## Specific to This Repo

- **Live-server warning:** the active listener on port 3456 may be a different checkout than the one under investigation.
- **Preferred evidence path:** the two focused v4 Vitest commands above.
- **Runtime execution proof file:** `tests\agents\runner.test.ts`
- **Permission-only / Copilot CLI caveat file:** `tests\agents\tool-trace-copilot-cli.test.ts`

## Key Implementation Details

1. **Permission:** `availableTools` means configuration/allowance, not execution.
2. **Runtime:** app-managed tool execution persists `toolCalls` into `llm_traces.metadata_json` in v4.
3. **Copilot CLI caveat:** current tests show permission can be logged without an app-managed tool call.
4. **Visibility:** `/articles/:id/traces` currently surfaces envelopes and prompts, not `metadata_json`.

---

## References

- `.squad/decisions/inbox/devops-trace-smoke-test.md`
- `C:\github\worktrees\llminputs\worktrees\v4\tests\agents\runner.test.ts`
- `C:\github\worktrees\llminputs\worktrees\v4\tests\agents\tool-trace-copilot-cli.test.ts`
- `C:\github\worktrees\llminputs\worktrees\v4\src\db\repository.ts`
- `C:\github\worktrees\llminputs\worktrees\v4\src\dashboard\views\traces.ts`


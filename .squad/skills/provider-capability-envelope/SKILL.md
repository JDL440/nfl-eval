---
name: provider-capability-envelope
description: Keep provider trace envelopes honest by separating configured access from effective runtime capability.
domain: workflow-architecture
confidence: high
source: manual
tools: [view, rg, vitest]
---

# Skill Content

## Purpose

Prevent dashboard and trace-contract drift when a provider has both a high-level mode switch and lower-level runtime gates.

## When to Use

- A provider exposes both config intent (`toolAccessMode`, feature flags) and effective runtime availability (resolved allowlist, missing config, fail-closed behavior).
- Dashboard traces or tests need to explain what was configured versus what the provider could actually use.
- A legacy boolean such as `enableTools` still exists while a newer explicit mode contract is being adopted.

## Workflow

1. Inspect the server/provider wiring to find the explicit mode input and any legacy compatibility flags.
2. Resolve the provider’s runtime flags first, then build prompt/tool-policy text from those resolved flags rather than raw config booleans.
3. If tool use is provider-specific, preview the resolved route before building the tool contract so the runtime can decide capability from the executing provider rather than the caller’s guess.
4. Keep provider adapters honest about structured-output differences when the tool loop depends on machine-readable turns (for example, LM Studio preferring `json_schema` over `json_object`).
3. In the request envelope, persist both:
   - configured intent (`toolAccessMode`, `toolAccessConfigured`)
   - effective capability (`toolsEnabled`, `allowedTools`, resolved MCP/web flags)
5. Add a regression test where explicit mode contradicts legacy booleans so the modern contract wins.
6. Add a regression test for fail-closed runtime conditions (for example, missing MCP config) so traces do not claim unavailable tools.

## Examples

- `src\dashboard\server.ts` passes `toolAccessMode` explicitly into `CopilotCLIProvider` even though `enableTools` still exists.
- `src\llm\providers\copilot-cli.ts` records `toolAccessConfigured` separately from `toolsEnabled`, and prompt copy uses resolved runtime flags.
- `tests\llm\provider-copilot-cli.test.ts` covers explicit-mode override and missing-MCP fail-closed behavior.
- `src\llm\gateway.ts` can expose a route preview so LM Studio-only tool loops are decided from the resolved provider, not from ad hoc caller branching.
- `src\llm\providers\lmstudio.ts` should record request/response envelopes and use the structured-output mode the local runtime actually honors when the runner expects tool-loop JSON turns.

## Boundaries

- This pattern is for observability and contract correctness; it does not decide which tools should be allowed.
- Do not collapse configured and effective state back into one field just to simplify UI copy.
- Keep changes surgical: fix the contract and focused tests before touching broader dashboard presentation.

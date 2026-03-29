---
name: Copilot CLI Guarded Mode Contract
domain: llm-provider
confidence: high
tools: [view, rg, powershell]
---

# Copilot CLI Guarded Mode Contract

## When to use

- A change touches `src\llm\providers\copilot-cli.ts`, `src\dashboard\server.ts`, or Copilot-focused tests.
- A branch mixes `toolAccessMode`, legacy `enableTools`, session reuse, or dashboard env wiring.
- Someone is unsure whether behavior belongs in the CLI provider or the plain GitHub Models provider.

## Pattern

Treat the providers as two separate contracts:

1. `src\llm\providers\copilot.ts` is the plain GitHub Models adapter. It accepts the shared request shape but must stay text-only.
2. `src\llm\providers\copilot-cli.ts` owns guarded tool access, approved MCP allowlisting, session reuse, and provider trace metadata.
3. `src\dashboard\server.ts` can read legacy env flags, but only to derive a single `cliMode` that becomes explicit `toolAccessMode`.
4. Inside `CopilotCLIProvider`, explicit `toolAccessMode` is authoritative. `enableTools` is only a backward-compatibility shim when `toolAccessMode` is omitted.
5. Session reuse is allowed only when `toolAccessMode === 'article-tools'`, `enableSessionReuse` is true, an `articleId` exists, and the stage is one of 4-7.

## Repo example

- `src\dashboard\server.ts` derives `cliMode` from `COPILOT_CLI_MODE` plus legacy env toggles, then passes `toolAccessMode: cliMode`.
- `src\llm\providers\copilot-cli.ts` resolves runtime flags from `toolAccessMode`, `enableWebFetch`, `enableRepoMcp`, and MCP config presence, then records the resulting state in request/response envelopes.
- `tests\llm\provider-copilot-cli.test.ts` locks the contract for article-tools allowlists, fallback from resumed sessions, and explicit `toolAccessMode` overriding `enableTools`.
- `tests\llm\copilot-article-stage.test.ts` and `tests\pipeline\copilot-integration.test.ts` verify the plain Copilot provider does not leak CLI-only semantics.

## Narrowest fix rule

If the bug is about tool/session behavior, fix `src\llm\providers\copilot-cli.ts` or its dashboard wiring. Do not add article-tools or session-reuse semantics to `src\llm\providers\copilot.ts`.

## Validation

- `npm run v2:build`
- `npm run v2:test -- tests\agents\runner.test.ts tests\dashboard\server.test.ts tests\db\repository.test.ts tests\llm\copilot-article-stage.test.ts tests\llm\provider-copilot-cli.test.ts tests\llm\gateway.test.ts tests\pipeline\copilot-integration.test.ts`

## Anti-patterns

- Treating `enableTools` as the source of truth after `toolAccessMode` has been set.
- Letting the plain Copilot API provider grow CLI-only tool/session logic.
- Enabling article-tools prompts from raw config booleans instead of resolved runtime flags.
- Reusing sessions for non-article stages or without an `articleId`.

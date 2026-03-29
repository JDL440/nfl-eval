# Copilot CLI Provider Deep Dive

## Executive Summary

The `CopilotCLIProvider` is already architecturally separate from the other providers, but today it is used as a **one-shot text backend**, not as an agent runtime: it flattens all messages into a single prompt string, launches `copilot -p ... -s --no-ask-user` in a temp sandbox, and prepends a prompt constraint telling the model not to read files, run commands, or use tools.[^1] That means the provider is currently suppressing nearly all of the native capabilities that make Copilot CLI special.[^1][^2]

For planning purposes, the tool scope should be simplified to **two repo MCP servers** plus Copilot CLI’s native built-in tools. The two repo servers are: the **pipeline MCP server** in `src\mcp\server.ts`, which exposes article/pipeline operations, and the **local data MCP server** in `mcp\server.mjs`, which exposes nflverse and prediction-market data tools (and should be treated as the data server for this plan).[^4][^5]

On your three immediate goals:  
1. **Unboxing tools** is feasible as a Copilot-CLI-only change, because the provider already has `extraFlags`, but the app never passes them and the provider still launches in an empty sandbox with a no-tools prompt constraint.[^1][^10]  
2. **Direct access to the repo MCP tools you want right now** is feasible if the Copilot CLI path is limited to the two existing repo servers: the pipeline MCP server and the local data MCP server.[^4][^5]  
3. **A single shared context** does not exist today. The article pipeline stores a shared conversation thread, but every Copilot CLI call is still a fresh subprocess with a rebuilt prompt envelope, so true provider-level shared context would require either a persistent interactive Copilot session or a provider-specific session abstraction.[^1][^11][^12][^13]

## Architecture / System Overview

```text
Current flow
============

Pipeline action / dashboard route
        |
        v
AgentRunner.run()
  - load charter
  - load skills
  - recall memory
  - rebuild system prompt
  - rebuild user prompt
  - create [system, user] messages
        |
        v
LLMGateway.chat()
  - resolve provider/model
        |
        v
CopilotCLIProvider.chat()
  - flatten messages -> one prompt string
  - add "do not use tools" constraint
  - exec: copilot -p ... -s --no-ask-user
  - cwd = temp sandbox
        |
        v
plain text response


What you'd need for the "special Copilot CLI" path
==================================================

Pipeline / dashboard
        |
        v
AgentRunner (or Copilot-specific session manager)
  - stable shared context for article/run
  - delta prompts per stage
  - optional article-scoped session state
        |
        v
CopilotCliSessionProvider
  - tool visibility policy
  - tool permission policy
  - MCP bootstrap/config injection
  - repo/trusted-dir policy
  - persistent session strategy (not -p one-shot)
        |
        v
Copilot CLI native agent
  - builtin tools
  - GitHub MCP
  - pipeline MCP server
  - data MCP server
```

The generic runtime is still prompt-first. `AgentRunner.run()` rebuilds the system prompt from charter, skills, memory, and roster context, builds a user message from the task plus article/conversation context, and sends a single `messages` array into `LLMGateway.chat()`.[^11] `LLMGateway.chat()` itself is also single-shot and text-only: `ChatRequest` contains only messages plus model parameters, and `ChatResponse` returns only content, model, provider, usage, and finish reason.[^14]

That matters because any Copilot CLI redesign sits on top of a runtime that currently assumes **one request in, one text response out**.[^11][^14] So the provider can be changed independently, but only up to a point: once you want persistent context, tool transcripts, or native MCP interaction, the provider will start straining against the current gateway/runner contract.[^1][^11][^14]

## 1. What the Copilot CLI provider is doing today

### 1.1 It is deliberately de-agentized

`CopilotCLIProvider.chat()` resolves a model, calls `buildPrompt()`, and then runs the standalone `copilot` executable either by `-p` or via redirected stdin for very large prompts.[^1] `buildPrompt()` inserts a hardcoded constraint block:

> `Do NOT read files, create files, run commands, or use any tools. Just generate and output the text.`[^1]

So today the provider is not merely “not using tools”; it is **explicitly instructing the CLI not to behave like the CLI**.[^1]

### 1.2 It hides the repository from Copilot CLI

The provider constructor creates a temp sandbox directory under the OS temp folder and uses that as `cwd` for every CLI invocation.[^1] The code comment is explicit: this is meant to prevent the CLI from seeing repo context and “wasting minutes reading/writing repo files.”[^1] This makes the provider safer and faster as a text backend, but it also means that even if you removed the no-tools prompt constraint, the CLI would still start in a nearly empty filesystem view unless you changed the working-directory/trusted-directory model.[^1][^15]

### 1.3 It does not keep a Copilot session alive

Each call uses `execFile` or `exec`, waits for stdout, trims it, estimates tokens from character counts, and returns.[^1] There is no persisted session handle, no PTY, no interactive reuse, and no provider-managed memory across stage calls.[^1] By design, this means the provider cannot currently satisfy your “entire flow should share a single context always” requirement on its own.[^1]

### 1.4 The app does not expose the provider's tool-related flags

The provider class already has an `extraFlags` option that appends arbitrary Copilot CLI flags to each invocation, and the tests confirm those flags are passed through.[^1][^16] However, the live app wiring in `src\dashboard\server.ts` only passes `defaultModel` and `copilotPath` when constructing `CopilotCLIProvider`.[^10] So while the provider could theoretically receive `--available-tools`, `--allow-tool`, `--additional-mcp-config`, or GitHub MCP flags, the current app never supplies them.[^1][^10]

## 2. Full tool list: what Copilot CLI can access vs what this repo gives it

## 2.1 Copilot CLI's documented native tool categories

The CLI command reference documents the tool names accepted by `--available-tools` and `--excluded-tools`, and the permission model accepted by `--allow-tool` / `--deny-tool`.[^2][^3] The documented tool categories are:

| Category | Documented tool names |
|---|---|
| Shell | `bash` / `powershell`, `read_bash` / `read_powershell`, `write_bash` / `write_powershell`, `stop_bash` / `stop_powershell`, `list_bash` / `list_powershell` |
| File operations | `view`, `create`, `edit`, `apply_patch` |
| Agent/subagent | `task`, `read_agent`, `list_agents` |
| Search / retrieval | `grep` / `rg`, `glob`, `web_fetch` |
| Agent workflow | `skill`, `ask_user`, `report_intent`, `show_file`, `fetch_copilot_cli_documentation`, `store_memory`, `update_todo`, `exit_plan_mode`, `task_complete` |
| Structured / analysis | `sql`, `lsp` |
| MCP / external | server-scoped tools via `<mcp-server-name>(tool-name?)` permission patterns |

Those tools are separate from the built-in GitHub MCP server, which the CLI ships with by default and can widen using `--add-github-mcp-tool`, `--add-github-mcp-toolset`, or `--enable-all-github-mcp-tools`.[^2] The CLI also supports local or additional MCP servers through `/mcp add` or `--additional-mcp-config`, and MCP server tools can be auto-used by the agent once configured.[^2][^15]

### Important nuance for the current provider

The current provider does **not** formally enumerate a safe subset with `--available-tools`; instead, it relies on prompt suppression, temp sandboxing, and the absence of extra flags.[^1] So the “full list” of tools the wrapped CLI *could* understand is broad, but the subset it is *practically* encouraged to use in this app is close to **none**.[^1][^2][^3]

## 2.2 The repo's in-app MCP server tool list

The in-app stdio MCP server in `src\mcp\server.ts` currently exposes exactly seven tools:[^4]

| Tool | Purpose |
|---|---|
| `pipeline_status` | Pipeline summary + ready-to-advance articles |
| `article_get` | Full article details, transitions, validation |
| `article_create` | Create a new article idea |
| `article_advance` | Advance one article one stage |
| `article_list` | List articles by stage/status |
| `pipeline_batch` | Batch-check or batch-advance by stage |
| `pipeline_drift` | Detect DB/artifact drift |

This is the only MCP surface that is concretely wired inside the repo runtime today.[^4]

## 2.3 The repo-local data MCP server

There is already a second stdio MCP server at `mcp\server.mjs` named `nfl-eval-local-tools`.[^5] For this plan, it should be treated as the **data MCP server**. In the code path relevant to your ask, it registers nflverse data tools such as `query_player_stats`, `query_team_efficiency`, `query_positional_rankings`, `query_snap_counts`, `query_draft_history`, `query_ngs_passing`, `query_combine_profile`, `query_pfr_defense`, `query_historical_comps`, `query_rosters`, and `refresh_nflverse_cache`, along with `query_prediction_markets` for market data.[^5]

That means the immediate Copilot CLI MCP story can be reduced to:

| Server | Scope for this plan |
|---|---|
| Pipeline MCP server | article/pipeline operations |
| Data MCP server | nflverse + prediction-market data |

## 2.4 What skill metadata says today

The runner parses `tools:` metadata from skill frontmatter into `AgentSkill.tools`, but that metadata is not used to expose or constrain real tools at runtime.[^17] It is just parsed and carried through, and today mostly ends up as trace metadata rather than execution behavior.[^11][^17] That means you already have the start of a semantic mapping between skills and tools, but it is currently **advisory**, not operative.[^11][^17]

## 3. Goal 1: “Unbox the agent from using most of the tools it has access to”

## 3.1 What would need to change immediately

To “unbox” Copilot CLI in a controlled way, you need to change **three layers**, not one:

| Layer | Current behavior | Needed change |
|---|---|---|
| Prompt | Hardcoded no-tools constraint in `buildPrompt()`[^1] | Remove or gate it behind a provider option |
| Workspace | `cwd` is temp sandbox[^1] | Add a provider option for repo/custom working dir and trusted dirs |
| CLI policy flags | No `extraFlags` are passed by app wiring[^10] | Thread provider-specific flags from config/env into `CopilotCLIProvider` |

If you only remove the prompt constraint, the agent is still stranded in an empty temp directory and still lacks MCP bootstrapping and explicit tool visibility policy.[^1]

## 3.2 Recommended provider-specific controls

The safest design is to keep Copilot CLI special by adding options such as:

- `workingDirStrategy: 'sandbox' | 'repo' | 'custom'`
- `workingDir?: string`
- `usePromptToolConstraint?: boolean`
- `availableTools?: string[]`
- `excludedTools?: string[]`
- `allowToolPatterns?: string[]`
- `denyToolPatterns?: string[]`
- `additionalMcpConfigs?: string[]`
- `disableBuiltinMcps?: boolean`
- `githubMcpTools?: string[]`
- `githubMcpToolsets?: string[]`

This stays provider-specific and does **not** require changing Gemini/LM Studio behavior just to improve Copilot CLI.[^1][^10]

## 3.3 A staged “unboxing” plan

The lowest-risk rollout for Copilot CLI specifically is:

1. **Add explicit provider options and wiring first** so the app can pass `extraFlags` and choose repo vs sandbox cwd.[^1][^10]  
2. **Keep `--available-tools` narrow at first**: `view`, `glob`, `rg`, `web_fetch`, `sql`, `lsp`, plus chosen MCP servers.[^2][^3]  
3. **Use `--deny-tool` / `--excluded-tools` to keep write/shell actions off** until you decide otherwise.[^2][^3]  
4. **Do not rely on prompt-only safety** once real tools are enabled; use CLI tool filtering and permission patterns instead.[^2][^3]  

That gives you a real policy surface rather than the current “please don’t use tools” prompt hint.[^1]

## 4. Goal 2: “I want it to have direct access to all of the MCP tools that we created”

## 4.1 What is possible immediately

Two things are already true:

1. Copilot CLI supports additional MCP servers through `/mcp add` and the `--additional-mcp-config` flag.[^2][^15]  
2. `CopilotCLIProvider` already supports arbitrary CLI flags via `extraFlags`.[^1][^16]

So **provider-specific MCP enablement is immediately feasible in principle** without redesigning Gemini/LM Studio or the generic gateway.[^1][^16]

## 4.2 What is *not* wired yet

The repo already has both servers in code:

- the pipeline MCP server started from `src\cli.ts mcp`, which exposes the seven pipeline tools in `src\mcp\server.ts`,[^4][^15]
- and the local data MCP server in `mcp\server.mjs`, which exposes nflverse + prediction-market tools.[^5]

So “give Copilot CLI direct access to the MCP tools we want right now” breaks into two subproblems:

| Catalog | Current status | Gap |
|---|---|---|
| `src\mcp\server.ts` pipeline tools | Ready to expose through Copilot CLI MCP config | Provider needs to pass MCP config |
| `mcp\server.mjs` data tools | Ready to expose through Copilot CLI MCP config | Provider needs to pass MCP config and keep the allowed tool list narrowed to the intended data tools |

## 4.3 The safe recommendation

For the immediate path, I recommend:

### Phase A — expose the pipeline MCP server first

Register the repo MCP server with Copilot CLI for this provider only, using `--additional-mcp-config` or a dedicated `COPILOT_HOME` config for the provider.[^2][^15] This gives direct access to the seven pipeline tools with the least ambiguity because they already live behind a real stdio MCP server.[^4][^18]

### Phase B — expose the local data MCP server second

Register the local data MCP server with Copilot CLI as a second MCP server, separate from the pipeline server.[^2][^5] Keep the first rollout limited to the nflverse and prediction-market tools you actually want active, instead of broadening into publishing, image, or other non-data tools in the same family.[^2][^5]

## 4.4 Long-term note for cross-provider tool calling

This is where Copilot CLI should stay special. For Gemini / LM Studio / future providers, you likely want a **repo-managed tool loop** in `AgentRunner` / `LLMGateway` so the app owns the permissions, transcripts, and traces. But for Copilot CLI specifically, you can also support a **provider-native agent mode** that uses CLI MCP and native tools directly.[^11][^14][^15]

Those two paths do not have to be the same implementation as long as you normalize traces and final outputs.[^11][^14]

## 5. Goal 3: “The entire flow should share a single context always”

## 5.1 What already exists

The app does already store a **shared article conversation thread**. `conversation.ts` explicitly states that all agents working on the same article share one conversation thread, and turns are globally ordered per article.[^12] Later stages such as writer revision, editor review, and publisher pass sometimes pass `conversationContext` back into `runner.run()`.[^13]

## 5.2 What does *not* exist

That is not the same thing as a **single provider context**:

- `AgentRunner.run()` always rebuilds a fresh system prompt from charter + skills + memories + roster context.[^11]
- It always rebuilds a fresh user prompt from task + article context + optional conversation context.[^11]
- `gatherContext()` repeatedly inlines upstream artifacts per stage based on `context-config.ts`, which means the same material can be resent across stages.[^13][^19]
- `CopilotCLIProvider.chat()` launches a new `copilot` subprocess every time and discards all state after the response.[^1]

So today you have **shared stored context**, but not **shared live model context**.[^1][^11][^12][^13][^19]

## 5.3 Immediate dedupe opportunities without a persistent CLI session

If you want incremental improvement before a full provider-session redesign:

1. **Stop re-sending stable system blocks** when unchanged. Charter identity/responsibilities/boundaries and skill bodies are currently rebuilt every call.[^11]  
2. **Promote article-level conversation context earlier** so more stages reuse the shared article thread rather than rebuilding from upstream artifacts alone.[^12][^13]  
3. **Refactor `gatherContext()` into stable + delta layers** so repeated artifacts are referenced from a cached working set instead of pasted every stage.[^13][^19]  

These changes help all providers, but they do **not** create a true single Copilot CLI session.[^1][^11]

## 5.4 What “single context always” really requires for Copilot CLI

For Copilot CLI specifically, true single-context behavior likely depends on **reusing a Copilot session**, not just shrinking prompts.[^1][^2] In practical terms, this means investigating whether the provider can create or attach to a Copilot CLI conversation/session ID and then continue that same session across stages (for example through the CLI's resume/session model) rather than issuing isolated `copilot -p` one-shot calls every time.[^1][^2]

The current provider does the opposite: it flattens the prompt, runs a one-shot CLI command, and exits.[^1] So today there is nowhere for native Copilot session memory to live except what the app manually re-injects in the next request.[^1] That makes the section more relevant, not less: if you want “single context always,” the key question is no longer just dedupe, but whether the provider can safely adopt **session reuse plus trace visibility**.

That means the real design choice is:

| Option | What it gives you | Cost |
|---|---|---|
| App-level dedupe only | Smaller repeated prompts; still one-shot; no native Copilot session continuity | Moderate |
| Provider-managed reused Copilot sessions | True shared Copilot context across stages by reusing a session GUID / resume flow | High; requires session lifecycle ownership, working-directory policy, and trace-safe capture of incremental vs canonical prompts |
| Generic cross-provider shared-context layer in runner | Better portability across providers | Moderate-high; still separate from native Copilot session behavior |

The main implementation uncertainty is whether the current non-interactive `copilot -p` wrapper can support session reuse cleanly, or whether this requires a more session-aware provider mode altogether.[^1][^2] If resumed sessions are workable, then the trace design must record at least:

- the Copilot provider session ID,
- whether the run was one-shot or resumed,
- the working directory / trust context used for that session,
- the canonical full prompt snapshot plus the incremental delta sent into the resumed session.

My recommendation is still **both**, staged:

1. do app-level dedupe now,  
2. explicitly investigate Copilot session reuse as the native path to “single context always,”  
3. only then decide whether Copilot CLI needs a dedicated session-aware provider abstraction.[^1][^11][^12][^13][^19]

## 6. Recommended architecture direction

## 6.1 Short-term, Copilot-CLI-only

Make `CopilotCLIProvider` configurable enough to behave like a real Copilot agent **without** forcing tool calling into the generic provider contract yet.[^1][^10] Concretely:

- add config/env wiring for `extraFlags`, cwd strategy, and MCP bootstrap,
- replace the hardcoded no-tools prompt with an option,
- start with read/search/MCP-only tool visibility,
- expose only the repo pipeline MCP server and the local data MCP server at first,
- add a trace capture field for provider mode (`one-shot-text` vs `native-cli-agent`).[^1][^10]

This is the best way to satisfy your immediate Copilot-CLI-specific goals without entangling Gemini / LM Studio prematurely.[^1][^10]

## 6.2 Medium-term, cross-provider-safe

Add a provider capability model such as:

```ts
interface ProviderCapabilities {
  nativeTools?: boolean;
  mcpBootstrap?: boolean;
  persistentSession?: boolean;
  structuredToolCalls?: boolean;
}
```

Then let:

- Copilot CLI advertise `nativeTools`, `mcpBootstrap`, and maybe `persistentSession`;
- Gemini / LM Studio advertise `structuredToolCalls` later through a repo-managed tool loop;
- `AgentRunner` choose the right path per provider instead of forcing one design on all of them.[^1][^11][^14]

That keeps your long-term “add tool calling to other models” path open while preserving Copilot CLI as the special provider it really is.[^1][^14][^15]

## 7. Bottom line answers to your three requests

| Request | Answer |
|---|---|
| 1) Unbox the agent from using most of its tools, give full list | **Yes**, but it is a provider-specific policy project, not just a prompt edit. The verified scope to plan around is: documented native Copilot CLI tools, the 7 repo pipeline MCP tools, and the data MCP server tools for nflverse + prediction markets.[^2][^3][^4][^5] |
| 2) Give it direct access to the repo MCP tools we want right now | **Yes.** Limit the first rollout to two MCP servers: the pipeline MCP server and the local data MCP server.[^4][^5][^15] |
| 3) Entire flow should share a single context always | **Not with the current provider shape.** You already have shared stored conversation context, but not shared live provider context. True single-context Copilot behavior requires a persistent session design or a provider-specific session abstraction.[^1][^11][^12][^13] |

## Confidence Assessment

**High confidence**: the current `CopilotCLIProvider` is intentionally sandboxed, one-shot, and tool-suppressing. I verified this directly in provider source and test coverage.[^1][^16]

**High confidence**: the repo already has two concrete MCP servers relevant to this narrowed plan: the 7-tool in-app pipeline server in `src\mcp\server.ts` and the local data server in `mcp\server.mjs` that exposes nflverse and prediction-market tools.[^4][^5][^15]

**High confidence**: the current app does not yet support true provider-level shared context for Copilot CLI, because `AgentRunner` rebuilds prompts each call and `CopilotCLIProvider` launches a fresh subprocess every time.[^1][^11][^12][^13][^19]

**Medium confidence**: the exact best Copilot CLI bootstrap shape still depends on whether you configure the two MCP servers with transient `--additional-mcp-config` per run or through a dedicated Copilot config/home. Both are supported by the CLI docs; the final choice is an implementation preference.[^2][^15]

## Footnotes

[^1]: `C:\github\worktrees\llminputs\src\llm\providers\copilot-cli.ts:84-128,162-180,214-259,288-350`
[^2]: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
[^3]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli
[^4]: `C:\github\worktrees\llminputs\src\mcp\server.ts:28-153,200-217`
[^5]: `C:\github\worktrees\llminputs\mcp\server.mjs:39-42,137-256`
[^10]: `C:\github\worktrees\llminputs\src\dashboard\server.ts:2850-2910`
[^11]: `C:\github\worktrees\llminputs\src\agents\runner.ts:219-260,409-557`
[^12]: `C:\github\worktrees\llminputs\src\pipeline\conversation.ts:1-22,194-256`
[^13]: `C:\github\worktrees\llminputs\src\pipeline\actions.ts:507-533,805-832,843-904,915-999,1169-1227,1294-1319,1397-1436`
[^14]: `C:\github\worktrees\llminputs\src\llm\gateway.ts:15-49,80-205`
[^15]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp
[^16]: `C:\github\worktrees\llminputs\tests\llm\provider-copilot-cli.test.ts:145-229,286-321`
[^17]: `C:\github\worktrees\llminputs\src\agents\runner.ts:180-215`
[^18]: `C:\github\worktrees\llminputs\src\cli.ts:627-631`
[^19]: `C:\github\worktrees\llminputs\src\pipeline\context-config.ts:15-45` and `C:\github\worktrees\llminputs\src\pipeline\actions.ts:714-749`

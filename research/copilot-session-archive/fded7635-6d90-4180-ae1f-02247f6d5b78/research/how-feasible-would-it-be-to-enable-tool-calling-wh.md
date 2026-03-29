# Tool Calling Feasibility Research

## Executive Summary

Enabling tool calling in this repo is **feasible**, but the hard part is **not** the provider adapters. The core blocker is the current runtime contract: `AgentRunner` builds a system prompt and one user message, `LLMGateway` sends a single `ChatRequest`, and every provider returns a single text-only `ChatResponse`; there is no tool declaration field, no tool-call response type, and no execution loop that feeds tool results back into the model.[^1][^2]

For **Gemini**, feasibility is high because the Gemini API already supports function declarations, multi-turn function responses, and combining built-in tools with custom functions; the repo would mainly need a richer request/response contract plus a runner-side tool loop.[^3][^4] For **LM Studio**, feasibility is medium-high because its OpenAI-compatible endpoints support tool use, but actual quality depends heavily on the loaded local model and whether that model has native or only default tool-use support.[^5][^6]

For **Copilot CLI**, feasibility is low **in the current provider design**. The official CLI supports tool use, trusted-directory file access, and MCP servers, but this repo wraps the CLI as a one-shot text subprocess launched in an empty sandbox and explicitly instructs it not to use tools; turning that wrapper into a robust tool-calling backend would require a substantial redesign and would hand control to the CLI's own agent loop rather than this repo's `AgentRunner`.[^7][^8][^9]

The main upside of tool calling is that models could retrieve live data and act with smaller, fresher context instead of relying on large pre-injected artifacts and roster/context handoffs. The main downside is that it would shift this system from a prompt-only pipeline to an agent runtime with permission boundaries, latency/cost amplification, provider-specific behavior differences, and a much stronger need for traceability and guardrails.[^10][^11][^12]

## Architecture/System Overview

Today the in-app LLM path is:

```text
Pipeline action / dashboard route
        |
        v
AgentRunner.run()
  - load charter
  - load skills
  - recall memory
  - compose system prompt
  - build user message from task + article context + conversation context
        |
        v
LLMGateway.chat()
  - resolve candidate models from ModelPolicy
  - find provider
        |
        v
Provider.chat(request)
  - map messages to provider-specific body
  - send one request
        |
        v
ChatResponse { content, model, provider, usage, finishReason }
        |
        v
caller persists output / thinking / usage / conversation turn
```

If tool calling were enabled in-app, the runtime would need to become:

```text
AgentRunner.runWithTools()
        |
        v
LLMGateway.chat(request + tools)
        |
        v
Provider returns either:
  - final text response, or
  - tool call(s)
        |
        +--> Tool executor validates + runs allowed tool(s)
        |     - e.g. article_get / pipeline_status / custom read-only data tools
        |
        +--> Append tool result messages to conversation
        |
        
(loop until final assistant response or max iterations)
        |
        v
Persist trace, tool transcript, final output, thinking, usage
```

That change is structural because `ChatRequest` and `ChatResponse` are currently text-only, and `AgentRunner.run()` assumes exactly one request/one response rather than an iterative tool loop.[^1][^2]

## What `AgentRunner` Is Doing Today

`AgentRunner` today is a **prompt assembly and dispatch layer**, not a tool-using agent runtime. It:

1. loads the agent charter from disk,[^2]
2. loads skill markdown files and parses their YAML frontmatter,[^13]
3. recalls prior memory entries,[^2]
4. composes a single system prompt from identity, responsibilities, skill content, memories, roster context, and boundaries,[^2]
5. builds a single user message from task, article context, and conversation context,[^2]
6. calls `LLMGateway.chat()` once,[^2]
7. separates any inline thinking tags from output, updates memory, and returns the result.[^2]

It does **not** today:

- register callable tools with the model,[^1][^2]
- inspect model tool-call responses,[^1]
- execute tools and feed results back into the conversation,[^1][^2]
- enforce a tool permission boundary of its own,[^2]
- or maintain an iterative tool loop.[^1][^2]

A subtle sign of this gap is that skills already have a parsed `tools` metadata field, but `AgentRunner` never uses `AgentSkill.tools` during execution; skill content is injected into prompts, but tool metadata is effectively advisory/inert today.[^13][^2]

## What Tool Calling Would Give the Model Access To

Tool calling does **not** automatically give the model access to “everything.” It gives the model access only to the functions the runtime exposes.

In this repo, there are two realistic access models:

### A. In-app controlled tool loop (recommended)

If you implement tool calling inside `AgentRunner`/`LLMGateway`, the model would only be able to call the tools you explicitly register. The most obvious existing starting catalog is the repo’s MCP server, which already exposes pipeline-oriented tools such as `pipeline_status`, `article_get`, `article_create`, `article_advance`, `article_list`, `pipeline_batch`, and `pipeline_drift`.[^14]

Because the MCP server is already wired to the repository and pipeline engine and can be started from `cli.ts mcp`, this would let you reuse existing business logic instead of inventing a second tool surface.[^14][^15]

### B. Copilot CLI native tool use (broad, but externally managed)

If you rely on the Copilot CLI's own native agentic tooling instead of an in-app tool loop, the model could access the capabilities that the CLI itself exposes in a trusted directory, including reading and modifying files, executing approved shell commands, and using configured MCP servers.[^7][^8]

That is much broader than the repo’s current in-app runtime and would bypass this codebase’s own permission/trace model unless you build explicit capture around it.[^8][^9]

## Provider/Runtime Feasibility Table

| Surface | Current integration in this repo | Tool support in underlying platform | Feasibility here | If enabled, what would the model access? | Main pros | Main cons |
|---|---|---|---|---|---|---|
| `AgentRunner` + `LLMGateway` core | Single-shot text flow: `ChatRequest.messages` in, `ChatResponse.content` out.[^1][^2] | None in current contract.[^1] | **Medium** overall, but requires core runtime redesign. | Whatever tool catalog you explicitly expose, ideally the repo MCP tools and any additional read-only data tools.[^14] | Uniform cross-provider tool loop; explicit permissions; best traceability. | Requires new types, loop control, tool executor, error handling, and new trace UX.[^1][^2] |
| `GeminiProvider` | REST `generateContent` wrapper with `contents`, optional `systemInstruction`, and text-only parsing.[^16] | Gemini API supports function declarations, multi-turn function responses, parallel/compositional function calling, and combining custom functions with built-in tools.[^3][^4] | **High**. Provider changes are straightforward once core runtime supports tools. | Custom functions you register in-app; potentially Gemini built-in tools too, if you choose to expose them rather than only custom tools.[^3][^4] | Strong native support; can mix custom functions and built-in tools; good fit for agent workflows.[^3][^4] | Provider-specific response parsing; built-in Gemini tools create capability asymmetry vs other providers.[^3][^4] |
| `LMStudioProvider` | OpenAI-compatible local `/v1/chat/completions` wrapper; always uses the local default model and currently parses text only.[^17] | LM Studio supports tool use on `/v1/chat/completions` and `/v1/responses`; it can parse tool calls, but quality depends on model/tool-template support.[^5][^6] | **Medium-High**. Transport is compatible, but local model behavior is the risk. | Custom functions you register in-app; no implicit local shell/filesystem access unless you create such tools yourself. | Works locally; OpenAI-compatible surface; can reuse one custom tool loop.[^5][^17] | Tool reliability varies by loaded model; some models only have “default” rather than native tool support.[^6] |
| `CopilotCLIProvider` | One-shot subprocess wrapper around `copilot -p ... -s --no-ask-user`; runs in empty sandbox; prompt explicitly forbids tool use.[^9] | Copilot CLI itself is agentic, can use tools with approval, can work in trusted directories, and supports MCP servers.[^7][^8] | **Low in current design**. Feasible only with major redesign or by letting Copilot CLI be the outer agent. | Potentially file read/write/execute + configured MCP servers in trusted dirs, depending on CLI permissions and cwd, which is much broader than in-app custom tools.[^7][^8] | Rich built-in tooling and MCP ecosystem; no need to invent tool protocol for the CLI itself.[^7][^8] | Hard to control, trace, and permission-manage from this wrapper; current provider intentionally disables tools and hides the repo from the CLI.[^9] |
| `CopilotProvider` (GitHub Models API) | OpenAI-compatible HTTP chat wrapper with text-only parsing.[^18] | Not investigated here beyond current repo code. This repo currently treats it as plain chat.[^18] | **Unknown/Out of scope for this question**. | Would depend on GitHub Models API capabilities and what you add to the contract. | Similar transport shape to LM Studio/OpenAI. | Needs separate API-capability validation. |

## Repo-Specific Access Matrix

| If you enable tool calling via… | What the model would actually be able to touch in this repo | Why |
|---|---|---|
| In-app custom tool loop + existing MCP server | Pipeline/article operations only: `pipeline_status`, `article_get`, `article_create`, `article_advance`, `article_list`, `pipeline_batch`, `pipeline_drift`.[^14] | Those tools already exist, are typed, and route through the repo’s `Repository` and `PipelineEngine`.[^14] |
| In-app custom loop + additional custom read-only tools | Whatever extra functions you expose, e.g. roster/data lookups, artifact reads, context inspection. | Access is defined entirely by the functions you register. |
| Copilot CLI native tool use through current provider (after removing constraints) | Likely still very little useful repo access unless you also change sandbox/cwd/trust settings; today it runs in a temp sandbox specifically to avoid repo browsing.[^9] | Current wrapper intentionally deprives the CLI of workspace context.[^9] |
| Copilot CLI native tool use through a redesigned integration | Trusted-directory filesystem access, approved shell execution, and configured MCP servers.[^7][^8] | That is how the official CLI agent works; it is broader than the repo’s current in-app runtime.[^7][^8] |

## Pros and Cons of Enabling Tool Calling

### Pros

#### 1. Fresher data, less prompt stuffing

The current system compensates for no tools by injecting lots of context into prompts: charters, skills, memories, roster context, article content, revision summaries, and additional article-context artifacts.[^2][^10] Tool calling would let the runtime fetch only the needed facts at execution time instead of front-loading large prompt blocks.

#### 2. Better agent autonomy

Today a model can only reason over what the caller pre-packages. With tools, it could inspect pipeline state, fetch article metadata, check drift, or query structured data as needed, which would make the agent closer to a real runtime actor instead of a pure text generator.[^14][^2]

#### 3. Smaller prompts and potentially better quality

Replacing large inline context with precise tool fetches can reduce prompt bloat, reduce stale context risk, and give the model a clearer separation between instructions, retrieval, and action.

#### 4. Better fit for a future trace page

If you want a true “see all inputs/outputs/tools” advanced page, tool calling gives you an interaction model worth tracing: tool requests, arguments, results, retries, and final answer, not just prompt/output text.

### Cons

#### 1. Major runtime complexity increase

This is the biggest cost. You need to redesign the gateway/provider interfaces, add tool-call/result types, add a loop controller with iteration limits, build a tool registry/executor, and handle failures or malformed tool requests.[^1][^2]

#### 2. Provider behavior divergence

Gemini, LM Studio, and Copilot CLI do not behave the same way. Gemini has its own function-call structures and even built-in tools; LM Studio is OpenAI-like but quality is model-dependent; Copilot CLI is a full external agent with its own permission model.[^3][^4][^6][^7][^8][^9]

#### 3. Safety and permission design

Once models can call tools, you need explicit policies for what tools are allowed, whether calls are read-only or mutating, how arguments are validated, and how dangerous actions are gated. This is especially acute if you ever let a runtime touch files, shell commands, or wide MCP surfaces.[^7][^8]

#### 4. More latency and cost variance

A single-shot call becomes an iterative agent loop. One user-visible response may require several model turns plus tool execution plus final synthesis.

#### 5. Much stronger trace/audit requirement

A tool-calling runtime without robust tracing is hard to debug. If you enable tools, you should treat trace persistence as part of the same project, not a later nicety.

## Provider-Specific Findings

### Gemini

Gemini is the cleanest target. The current provider already maps system instructions and contents into the Gemini REST API, so the mechanical change would be to add `tools`/function declarations to the request body and parse `functionCall` or related tool parts out of the response.[^16][^3]

Gemini’s docs also show multi-turn circulation of function responses and the ability to combine custom functions with server-side built-in tools such as Google Search, which is powerful but creates a product decision: do you want the in-app runtime to expose **only** your repo’s controlled tools, or also provider-native tools that other providers cannot match?[^4]

**Bottom line:** technically strong fit; product/policy fit needs decisions.

### LM Studio

LM Studio is also plausible because the current provider is already using an OpenAI-compatible local server surface.[^17] LM Studio’s docs say tool use works through `/v1/chat/completions` and that it parses model-emitted tool calls into OpenAI-style response fields when possible.[^5]

The catch is model quality. LM Studio explicitly distinguishes models with **native** tool-use support from those that only get a default prompt-based tool format, and warns that smaller or non-tool-trained models may emit malformed calls.[^6]

**Bottom line:** transport-level fit is good; operational reliability depends on which local model is loaded.

### Copilot CLI

Copilot CLI is the least natural fit for this repo’s current architecture. Officially, the CLI is already agentic: in a trusted directory it may read, modify, and execute files; it prompts for approval on potentially dangerous tools; and it can use MCP servers.[^7][^8] That makes it great as an **outer agent**.

But this repo is not using it that way. `CopilotCLIProvider` flattens the conversation into one prompt string, runs `copilot -p ... -s --no-ask-user` as a subprocess, launches it from an empty temp sandbox, and injects a constraint saying not to use tools or interact with files/commands.[^9] In other words, the current provider intentionally strips away the very agent/runtime features that make the CLI interesting.

So there are two possible interpretations of “enable tool calling in Copilot CLI”:

1. **Let the CLI be the real agent.** That means redesigning this repo to delegate work to Copilot CLI sessions rather than treating it as a plain text model backend. Feasible, but architecturally very different from the current in-app runner.[^7][^8][^9]
2. **Keep the current provider shape and somehow add tool calls.** That is awkward and low-feasibility because the wrapper is one-shot, noninteractive, sandboxed, and built around plain-text return values.[^9]

**Bottom line:** viable only if you change the architecture, not just the provider method signature.

## Recommended Path

1. **Add tool calling to the in-app runtime first**, not to Copilot CLI first. Extend `ChatRequest`/`ChatResponse`, build a controlled tool executor, and keep the access surface narrow.[^1][^2]
2. **Use the existing MCP server as the first tool catalog.** It already exposes typed repo operations and runs through core business logic.[^14][^15]
3. **Implement Gemini first.** It has the clearest native support story.[^3][^4]
4. **Implement LM Studio second.** Reuse the same contract, but document that support quality depends on the loaded model.[^5][^6][^17]
5. **Treat Copilot CLI separately.** Decide whether it should remain a plain-text provider or become an outer agent integration. Do not try to shoehorn it into the same tool loop without rethinking sandbox, trust, approvals, and tracing.[^7][^8][^9]
6. **Ship trace persistence with the feature.** Tool calling without a trace/thread view will be much harder to operate safely.

## Key Repositories / Modules Summary

| Module | Purpose | Why it matters |
|---|---|---|
| `C:\github\worktrees\llminputs\src\llm\gateway.ts` | Shared request/response contract and provider dispatch | Current contract is text-only; must change first.[^1] |
| `C:\github\worktrees\llminputs\src\agents\runner.ts` | Prompt assembly and one-shot dispatch | Would need to become a multi-turn tool loop orchestrator.[^2] |
| `C:\github\worktrees\llminputs\src\llm\providers\gemini.ts` | Gemini REST wrapper | Strong provider candidate for first tool implementation.[^16] |
| `C:\github\worktrees\llminputs\src\llm\providers\lmstudio.ts` | Local OpenAI-compatible wrapper | Good transport fit; model quality varies.[^17] |
| `C:\github\worktrees\llminputs\src\llm\providers\copilot-cli.ts` | One-shot Copilot CLI subprocess wrapper | Current design intentionally disables tool use and hides repo context.[^9] |
| `C:\github\worktrees\llminputs\src\mcp\server.ts` | Existing typed repo tool surface | Best starting catalog for in-app tool calling.[^14] |
| `C:\github\worktrees\llminputs\src\cli.ts` | Starts MCP server | Confirms MCP surface is already runnable from the repo CLI.[^15] |

## Confidence Assessment

**High confidence**: the repo is currently prompt-only and would need a core runtime contract change before any provider-specific tool enablement matters. I verified this directly in `LLMGateway`, `AgentRunner`, `GeminiProvider`, `LMStudioProvider`, `CopilotCLIProvider`, and the repo’s MCP server code.[^1][^2][^9][^14][^16][^17]

**High confidence**: Gemini and LM Studio both have real underlying tool-use support, and Copilot CLI itself is agentic and supports tools/MCP in its native UX. Those claims are grounded in the provider docs and GitHub/Gemini/LM Studio documentation fetched during this research.[^3][^4][^5][^6][^7][^8]

**Medium confidence**: the exact quality of LM Studio tool calling in this repo would depend on which local model you standardize on, and the exact best integration pattern for Copilot CLI would depend on whether you want it as a backend model provider or as the outer orchestrating agent. Those are architecture choices not resolved by the current code alone.[^6][^9]

## Footnotes

[^1]: `C:\github\worktrees\llminputs\src\llm\gateway.ts:15-49,80-205`
[^2]: `C:\github\worktrees\llminputs\src\agents\runner.ts:201-439`
[^3]: `https://ai.google.dev/gemini-api/docs/function-calling`
[^4]: `https://ai.google.dev/gemini-api/docs/tool-combination`
[^5]: `https://lmstudio.ai/docs/app/api/tools`
[^6]: `https://lmstudio.ai/docs/developer/openai-compat/tools`
[^7]: GitHub Copilot CLI documentation from `fetch_copilot_cli_documentation` in this session (README + help output)
[^8]: `https://docs.github.com/api/article/body?pathname=/en/copilot/how-tos/use-copilot-agents/use-copilot-cli`
[^9]: `C:\github\worktrees\llminputs\src\llm\providers\copilot-cli.ts:1-17,116-127,162-224,256-350`
[^10]: `C:\github\worktrees\llminputs\src\pipeline\context-config.ts:15-55`
[^11]: `C:\github\worktrees\llminputs\src\mcp\server.ts:1-25,30-153,200-221`
[^12]: `C:\github\worktrees\llminputs\src\dashboard\server.ts:2568-2665`
[^13]: `C:\github\worktrees\llminputs\src\agents\runner.ts:160-197,304-309`
[^14]: `C:\github\worktrees\llminputs\src\mcp\server.ts:30-153,200-221`
[^15]: `C:\github\worktrees\llminputs\src\cli.ts:622-632`
[^16]: `C:\github\worktrees\llminputs\src\llm\providers\gemini.ts:66-149`
[^17]: `C:\github\worktrees\llminputs\src\llm\providers\lmstudio.ts:46-174`
[^18]: `C:\github\worktrees\llminputs\src\llm\providers\copilot.ts:162-250`

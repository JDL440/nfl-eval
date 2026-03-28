# DevOps MCP Tool Audit

*Audit date: 2025-07-25 • Scope: tool inventory, access control, secrets, risk surface*

---

## 1. MCP Server Architecture

The repo exposes **two independent MCP servers**, each over stdio:

| Server | Entry point | SDK | Tools |
|---|---|---|---|
| **Canonical local** | `mcp/server.mjs` (McpServer SDK) | `@modelcontextprotocol/sdk ^1.27.1` | 18 tools (data, media, publishing, help) |
| **Pipeline v2** | `src/mcp/server.ts` (Server SDK) | same package | 6 tools (pipeline CRUD + drift) |

They run in separate processes; the canonical server is exposed via `.mcp.json` / `.copilot/mcp-config.json`, while the pipeline server is started via `tsx src/cli.ts mcp-pipeline`.

---

## 2. Tool Inventory — Canonical Local Server (`mcp/server.mjs`)

Registered in `mcp/tool-registry.mjs` → `registerLocalTools(server)`.

### 2a. Help & Discovery (1 tool)
| Tool | Side effects | Read-only |
|---|---|---|
| `local_tool_catalog` | none | ✅ |

### 2b. Media Generation (2 tools)
| Tool | Side effects | Read-only |
|---|---|---|
| `generate_article_images` | writes local files, calls Gemini/Imagen API | ❌ |
| `render_table_image` | writes local PNG files | ❌ |

### 2c. Publishing & Promotion (3 tools)
| Tool | Side effects | Read-only |
|---|---|---|
| `publish_to_substack` | creates/updates Substack drafts, updates pipeline DB | ❌ |
| `publish_note_to_substack` | posts Substack Notes | ❌ |
| `publish_tweet` | posts to X/Twitter (unless `target=stage`) | ❌ |

### 2d. Data Queries (12 tools)
| Tool | Side effects | Read-only |
|---|---|---|
| `query_player_stats` | none | ✅ |
| `query_team_efficiency` | none | ✅ |
| `query_positional_rankings` | none | ✅ |
| `query_snap_counts` | none | ✅ |
| `query_draft_history` | none | ✅ |
| `query_ngs_passing` | none | ✅ |
| `query_combine_profile` | none | ✅ |
| `query_pfr_defense` | none | ✅ |
| `query_historical_comps` | none | ✅ |
| `query_rosters` | none | ✅ |
| `query_prediction_markets` | none | ✅ |
| `refresh_nflverse_cache` | downloads/refreshes local parquet cache | ❌ |

---

## 3. Tool Inventory — Pipeline MCP Server (`src/mcp/server.ts`)

| Tool | Side effects | Read-only |
|---|---|---|
| `pipeline_status` | none | ✅ |
| `article_get` | none | ✅ |
| `article_create` | inserts DB row | ❌ |
| `article_advance` | advances pipeline stage, may trigger LLM calls | ❌ |
| `article_list` | none | ✅ |
| `pipeline_batch` | may advance multiple articles if `execute=true` | ❌ |
| `pipeline_drift` | none (filesystem check) | ✅ |

---

## 4. Access Control Assessment

### 4a. Allowlist / Denylist

**Finding: NONE EXIST.** There is no tool-level allowlist or denylist anywhere in the codebase.

- `registerLocalTools()` iterates `localToolEntries` and registers **every tool** unconditionally.
- The pipeline server registers a hardcoded `TOOLS` array with no filtering.
- No env var (e.g., `MCP_ALLOWED_TOOLS`, `MCP_DENIED_TOOLS`) is checked.
- No per-agent tool scoping exists — any MCP client connected to a server sees all tools.

### 4b. Per-Agent Tool Routing

The `AgentRunner` (src/agents/runner.ts) does **not** interact with MCP tools at all. It:
- Loads charters and skills (markdown files)
- Skill files declare a `tools` frontmatter field, but this is **informational only** — used for prompt construction, not enforcement
- Calls `LLMGateway.chat()` which is a pure LLM text-completion layer with no tool-calling dispatch

**Conclusion:** Agent skill `tools` declarations are advisory metadata, not an enforcement boundary.

### 4c. Gateway Routing

`LLMGateway` (src/llm/gateway.ts) handles **LLM provider routing only** (OpenAI, Copilot, LMStudio, etc.). It has:
- `preferredProvider` / `allowedProviders` / `providerStrategy` — these scope which LLM backends are tried
- No concept of tool access control

---

## 5. Secret & Credential Exposure

Tools read credentials at call-time from `.env` via `shared-env.mjs`:

| Secret | Used by | Loaded from |
|---|---|---|
| `SUBSTACK_TOKEN` | publish_to_substack, publish_note_to_substack | `.env` or `~/.config/postcli/.env` |
| `SUBSTACK_PUBLICATION_URL` | publish_to_substack, publish_note_to_substack | `.env` |
| `SUBSTACK_STAGE_URL` | publish_to_substack, publish_note_to_substack | `.env` |
| `NOTES_ENDPOINT_PATH` | publish_note_to_substack | `.env` |
| `GEMINI_API_KEY` | generate_article_images | `.env` |
| `TWITTER_API_KEY` | publish_tweet | `.env` |
| `TWITTER_API_SECRET` | publish_tweet | `.env` |
| `TWITTER_ACCESS_TOKEN` | publish_tweet | `.env` |
| `TWITTER_ACCESS_TOKEN_SECRET` | publish_tweet | `.env` |

**Positive:** Secrets are **not baked into code** — they are loaded from `.env` at runtime, and `shared-env.mjs` supports `EXTENSION_ENV_DISABLED=1` to blank them for testing.

**Risk:** Any MCP client connected to the canonical server can invoke `publish_tweet` with `target=prod` and the tweet goes live. There is no confirmation gate or rate limit at the MCP layer.

---

## 6. Risk Summary

### 🔴 High Risk
| Issue | Detail |
|---|---|
| **No tool-level access control** | All 18 canonical tools are exposed to every MCP client. A malicious or misconfigured agent can publish to Substack/X in production. |
| **No write-tool confirmation** | `publish_tweet(target=prod)` and `publish_to_substack(target=prod)` execute immediately with no human-in-the-loop gate at the MCP server level. |
| **Pipeline batch auto-advance** | `pipeline_batch(execute=true)` can advance every article at a stage with no rollback mechanism. |

### 🟡 Medium Risk
| Issue | Detail |
|---|---|
| **Advisory-only tool metadata** | Skill file `tools: [...]` is prompt decoration, not an enforcement boundary. An LLM ignoring prompt instructions could attempt any tool. |
| **No rate limiting** | MCP servers have no per-tool or per-client rate limits. Runaway loops could burn Gemini API quota or flood Substack/X. |
| **Shared credentials** | All MCP clients share the same `.env` credentials — no per-agent or per-session credential scoping. |

### 🟢 Low Risk / Positive
| Item | Detail |
|---|---|
| **Secrets not in code** | All secrets loaded from `.env` at runtime; `.env.example` has placeholders only. |
| **Smoke test blanks creds** | `smoke-test.mjs` sets `EXTENSION_ENV_DISABLED=1` and blanks API keys. |
| **Read-only annotations** | Tools declare `readOnlyHint`, `destructiveHint`, `idempotentHint` per MCP spec — clients *can* use these for safety checks. |
| **Stage guard** | `publish_to_substack` refuses to operate on Stage 8 (already-published) articles. |
| **Stage/dry-run** | Publishing and tweet tools support `target=stage` for non-destructive testing. |

---

## 7. Environment Variable Controls

| Variable | Effect |
|---|---|
| `EXTENSION_ENV_DISABLED=1` | Disables `.env` loading in extensions — all secrets return empty, tools fail gracefully. Used in smoke tests. |
| `SUBSTACK_TOKEN` (absent) | Publish tools return an instructive error, not a crash. |
| `GEMINI_API_KEY` (absent) | Image generation returns a setup-instructions error. |
| `TWITTER_*` (absent) | Tweet tool returns a setup-instructions error. |

**No variable controls which tools are registered.** There is no `MCP_CONFIG`, `MCP_TOOLS`, or feature-flag mechanism to selectively enable/disable tools.

---

## 8. Recommendations

1. **Add tool-level allowlisting.** Introduce an env var (e.g., `MCP_TOOL_ALLOWLIST`) that `registerLocalTools()` checks before registering each tool. Default to all for backward compatibility; tighten in CI/shared environments.

2. **Gate destructive tools.** Consider requiring a `confirm: true` parameter (or a two-step call) for `publish_to_substack(target=prod)`, `publish_tweet(target=prod)`, and `pipeline_batch(execute=true)`.

3. **Per-agent tool scoping.** If agents will call MCP tools directly in the future, enforce the skill-declared `tools` list at the MCP dispatch layer, not just in the prompt.

4. **Add rate limiting.** A simple sliding-window counter in `runWithNormalization()` would prevent runaway API spend.

5. **Audit logging.** Log every MCP tool invocation (tool name, arguments hash, caller, timestamp) to a local audit file for forensics.

---

*End of audit.*

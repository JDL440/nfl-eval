---
name: Unified Local MCP Rollout
domain: devops-infrastructure
confidence: high
tools: [view, rg, powershell]
---

# Unified Local MCP Rollout

## When to use

- A repo has more than one MCP server entrypoint and the team wants one canonical local client target
- CLI wrappers, repo config files, and docs all mention MCP, but may not describe the same server inventory
- You need a DevOps handoff that stays out of runtime implementation details while still protecting the contract

## Pattern

Treat local MCP rollout as a **four-surface contract**, not just a server file:

1. **Canonical stdio server** — the file local clients should execute
2. **CLI wrapper** — any repo command that delegates to the same server
3. **Client configs** — `.mcp.json`, `.copilot\mcp-config.json`, VS Code config, etc.
4. **Validation/docs** — smoke tests and READMEs that describe what the local server exposes

If one surface changes without the others, operators see tool inventory drift even when the server code is correct.

## Audit checklist

### 1. Identify the true canonical entrypoint

- Check `package.json` scripts
- Check repo-local MCP config files
- Check CLI command handlers
- Check README claims

Prefer the file that most configs/docs already target.

### 2. Classify non-canonical servers

- Decide whether each extra server is:
  - a legacy compatibility shim
  - a debug-only surface
  - a separate runtime that should stay independent

Document that status explicitly so local clients do not bind to the wrong tool inventory.

### 3. Keep configs mirrored

- `.mcp.json`
- `.copilot\mcp-config.json`
- any user-level example snippets

These should share the same command, args, cwd, and server name unless there is a deliberate client-specific difference.

### 4. Align validation language with reality

- Read the smoke test script itself, not just the README
- Flag any artifact writes, network calls, or publishing endpoints
- Split “safe registration smoke” from “credentialed integration smoke” if needed

## Handoff boundary to Code

DevOps can recommend the canonical entrypoint and the compatibility labeling.

Code must decide whether multiple tool inventories should be unified through:

- a shared registration module
- a compatibility wrapper
- or a deliberate long-term split

Do not make that runtime contract change implicitly in docs/config only.

## Validation commands

- `npm run v2:build`
- `npm test`
- `npm run mcp:server`
- `node mcp\smoke-test.mjs` (only after confirming whether it is side-effect-safe in the current branch)
- schema validation for supported MCP config files

## Anti-patterns

- Pointing local clients at a pipeline-only or legacy MCP server because it “also works”
- Calling a smoke test “safe” without checking whether it writes files or hits publish/image tools
- Updating `.mcp.json` without updating `.copilot\mcp-config.json`

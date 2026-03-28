# Copilot CLI MCP Config

## When to use

Use this skill when auditing, creating, or repairing repo-local MCP configuration for GitHub Copilot CLI in this repository.

## Pattern

1. Treat `C:\github\nfl-eval\.copilot\mcp-config.json` as the repo's Copilot-facing MCP file and keep `C:\github\nfl-eval\.mcp.json` aligned as the generic mirror.
2. Prefer the modern `mcpServers` schema with explicit `type` and `tools` fields for each server entry.
3. Keep `nfl-eval-local` pointed at `node mcp/server.mjs` for the canonical repo-local server.
4. Keep `nfl-eval-pipeline` pointed at `npx tsx src/cli.ts mcp` for the pipeline MCP surface.
5. Validate with `npm run v2:build`, `npx vitest run tests\cli.test.ts tests\mcp\server.test.ts --reporter=verbose`, and `npm run mcp:smoke`.

## Caveats

- Standalone Copilot CLI manages user-level MCP servers in `~/.copilot/mcp-config.json`; the repo-local `.copilot\mcp-config.json` only applies when the runtime passes it through explicitly.
- Repo runtime defaults `COPILOT_CLI_MCP_CONFIG` to `.copilot\mcp-config.json` and enables repo MCP through the Copilot CLI `--additional-mcp-config` flag path.
- Current checked-in configs use `${workspaceFolder}` for `cwd`, so relative MCP startup commands assume the workspace root is the repo root.

## Recommendation

If you need broad repo tool access, set `COPILOT_CLI_MODE=article-tools`, keep repo MCP enabled, and preserve config parity between `.copilot\mcp-config.json` and `.mcp.json`.

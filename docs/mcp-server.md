# Local MCP Server

This repo includes a local stdio MCP server for the publishing/image workflow.

## Server entrypoint

Start it from the repo root:

```bash
npm run mcp:server
```

This runs:

```bash
node mcp/server.mjs
```

The server exposes:

- `generate_article_images`
- `render_table_image`
- `publish_to_substack`
- `publish_note_to_substack`

## Safe verification

Run the local smoke test:

```bash
npm run mcp:smoke
```

The smoke test is intentionally safe by default:

- it verifies tool registration
- it renders one local table image
- it disables `.env` loading for the run
- it checks the expected missing-auth error paths for Gemini and Substack tools

## Repo config files

This repo now includes MCP config files for clients that support repo-scoped configuration:

- GitHub Copilot / VS Code: [`.copilot/mcp-config.json`](/C:/github/nfl-eval/.copilot/mcp-config.json)
- Claude Code: [`.mcp.json`](/C:/github/nfl-eval/.mcp.json)
- OpenCode: [`opencode.json`](/C:/github/nfl-eval/opencode.json)

## Codex

Codex uses user-level MCP registration via Codex config, not a repo-only file.

Add this to your Codex config TOML:

```toml
[mcp_servers.nfl-eval-local]
command = "node"
args = ["C:\\github\\nfl-eval\\mcp\\server.mjs"]
cwd = "C:\\github\\nfl-eval"
```

After saving config, restart Codex or reload MCP servers in the client you are using.

## Codex Desktop

I did not find a separate official repo-scoped config file format for Codex Desktop distinct from Codex itself, so document and use the same local server command values there:

- command: `node`
- args: `["C:\\github\\nfl-eval\\mcp\\server.mjs"]`
- cwd: `C:\\github\\nfl-eval`

If the desktop app exposes an MCP settings UI instead of raw TOML, enter those same values there.

## GitHub Copilot / VS Code

Repo file: [`.copilot/mcp-config.json`](/C:/github/nfl-eval/.copilot/mcp-config.json)

Current config:

```json
{
  "mcpServers": {
    "nfl-eval-local": {
      "command": "node",
      "args": ["mcp/server.mjs"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

This is the repo-scoped MCP registration for GitHub Copilot tools in the workspace.

## Claude Code

Repo file: [`.mcp.json`](/C:/github/nfl-eval/.mcp.json)

Current config:

```json
{
  "mcpServers": {
    "nfl-eval-local": {
      "command": "node",
      "args": ["mcp/server.mjs"],
      "env": {}
    }
  }
}
```

From the repo root, Claude Code can also add the same server through CLI commands if you prefer user/project registration via the tool:

```bash
claude mcp add nfl-eval-local --scope project -- node mcp/server.mjs
```

## OpenCode

Repo file: [`opencode.json`](/C:/github/nfl-eval/opencode.json)

Current config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "nfl-eval-local": {
      "type": "local",
      "command": ["node", "mcp/server.mjs"],
      "enabled": true
    }
  }
}
```

## Environment

Normal runs keep the existing `.env` contract unchanged:

- `GEMINI_API_KEY`
- `SUBSTACK_TOKEN`
- `SUBSTACK_PUBLICATION_URL`
- `SUBSTACK_STAGE_URL`
- `NOTES_ENDPOINT_PATH`

For safe test runs, `mcp/smoke-test.mjs` sets `EXTENSION_ENV_DISABLED=1` so the server ignores `.env`.

## Sources

Config shapes in this doc are based on the current official docs I checked while updating this file:

- OpenCode MCP servers docs: [opencode.ai/docs/mcp-servers](https://opencode.ai/docs/mcp-servers/)
- MCP config guidance already present in this repo: [mcp-config.md](/C:/github/nfl-eval/.squad/templates/mcp-config.md)

For Codex Desktop specifically, this doc uses the same command/cwd values as Codex because I did not find a separate official desktop-specific MCP file format to cite.

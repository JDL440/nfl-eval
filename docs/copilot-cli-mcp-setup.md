# Copilot CLI MCP Configuration

This guide shows how to configure GitHub Copilot CLI to use the local MCP server for publishing and image generation tools.

## Repo-Level Config (Automatic)

✨ **No setup needed!** This repo includes `.copilot/mcp-config.json` that automatically registers the MCP server when you open the workspace in VS Code with GitHub Copilot CLI installed.

The repo config:
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

Simply open the repo and the tools are available. **This is the recommended setup for most users.**

## User-Level Config (Optional)

For persistent access across all sessions (not just this repo), you can also add a user-level configuration.

Location:
```
%USERPROFILE%\.config\github-copilot\cli\config.json
```

Configuration:
```json
{
  "mcpServers": {
    "nfl-eval-local": {
      "command": "node",
      "args": ["C:\\github\\nfl-eval\\mcp\\server.mjs"],
      "cwd": "C:\\github\\nfl-eval"
    }
  }
}
```

**Note:** User-level config persists across all sessions, but requires absolute paths.

## Available Tools

Once configured, these tools are available in Copilot CLI:

1. **`generate_article_images`** - Generate editorial images using Gemini/Imagen
2. **`render_table_image`** - Convert markdown tables to polished PNG images
3. **`publish_to_substack`** - Create/update Substack drafts
4. **`publish_note_to_substack`** - Create Substack Notes

## Verifying Setup

1. **Restart Copilot CLI** after creating the config (exit and restart your terminal/session)

2. **Test the MCP server directly:**
   ```bash
   npm run mcp:smoke
   ```
   This runs a safe smoke test that verifies all tools are registered.

3. **Check if tools are available in Copilot CLI:**
   The tools should appear in your available tool list. You can test by asking Copilot to use them.

## Environment Variables

These tools require environment variables in `.env`:

- **`GEMINI_API_KEY`** - For image generation (get from [Google AI Studio](https://ai.google.dev/gemini-api/docs/get-api-key))
- **`SUBSTACK_TOKEN`** - Your substack.sid cookie value for publishing
- **`SUBSTACK_PUBLICATION_URL`** - Production publication URL
- **`SUBSTACK_STAGE_URL`** - Staging publication URL (optional)
- **`NOTES_ENDPOINT_PATH`** - Notes API endpoint (e.g., `/api/v1/comment/feed`)

## Troubleshooting

### Tools not appearing
- Restart your Copilot CLI session completely
- Verify the config file exists at the path above
- Check that Node.js is in your PATH

### Server errors
- Run `npm run mcp:smoke` to diagnose
- Check `.env` has required API keys
- Verify you're running from the repo root (C:\github\nfl-eval)

### Permission issues
- Ensure the MCP server has read/write access to `content/images/` and `content/pipeline.db`

## Related Documentation

- [MCP Server Overview](./mcp-server.md) - Full server documentation
- [Extension Guide](../.github/extensions/README.md) - Extension architecture details
- Main README [MCP Server section](../README.md#local-mcp-server)

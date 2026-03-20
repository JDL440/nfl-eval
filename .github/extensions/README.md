# Extensions & Local MCP Tools

This directory contains tool implementations that extend GitHub Copilot CLI and other AI coding assistants with NFL-specific publishing, analytics, and content generation capabilities.

## Architecture: MCP-First Design

**✨ Preferred Pattern: Build tools as MCP servers, not native Copilot CLI extensions.**

### Why MCP Over Native Extensions?

1. **Multi-client support** - One tool implementation works across GitHub Copilot, Claude Code, Codex, OpenCode, and any MCP-compatible client
2. **Simpler implementation** - No SDK version conflicts or extension API changes
3. **Better debugging** - Standard Node.js modules are easier to test and troubleshoot
4. **Stable interface** - MCP protocol is client-agnostic and more stable than client-specific extension APIs
5. **Easier deployment** - Configure once per repo, works for all team members

### Current Implementation

All tools in this directory follow the MCP-first pattern:

```
.github/extensions/
├── gemini-imagegen/
│   └── extension.mjs           # Exports tool definition + handler
├── table-image-renderer/
│   ├── extension.mjs           # Exports tool definition + handler
│   └── renderer-core.mjs       # Core rendering logic (importable)
└── substack-publisher/
    ├── extension.mjs           # Exports tool definition + handler (deprecated)
    └── tool.mjs                # Main tool implementation

mcp/
└── server.mjs                  # Aggregates all tools into one MCP server
```

Each extension:
- Exports a tool definition object (schema + metadata)
- Exports a handler function (the actual implementation)
- Can optionally include a `main()` function for legacy Copilot CLI native extension support

The MCP server (`mcp/server.mjs`) imports these exports and registers them as MCP tools.

## Available Tools

### `generate_article_images`
Generates editorial images for NFL Lab articles using Google Gemini 3 Pro Image or Imagen 4.

**Use case:** Create hero/inline images after Writer produces a draft, before Editor review.

**Requires:** `GEMINI_API_KEY` in `.env`

### `render_table_image`
Converts markdown tables to polished PNG images optimized for Substack.

**Use case:** Transform dense comparison tables into readable, mobile-friendly images.

**Features:**
- Desktop (2200×545px) and mobile (1040×NNNpx) variants
- Multiple templates: generic-comparison, cap-comparison, draft-board, priority-list
- Automatic border, padding, and typography optimization

### `publish_to_substack`
Creates or updates Substack draft posts with full ProseMirror formatting.

**Use case:** Publish article drafts from markdown to Substack for final review and publication.

**Requires:** `SUBSTACK_TOKEN`, `SUBSTACK_PUBLICATION_URL` in `.env`

### `publish_note_to_substack`
Creates Substack Notes (short-form posts) for engagement and article promotion.

**Use case:** Post article teasers or quick takes to the Substack Notes feed.

**Requires:** `SUBSTACK_TOKEN`, `SUBSTACK_PUBLICATION_URL`, `NOTES_ENDPOINT_PATH` in `.env`

## Setup for Developers

### Repo-Level Config (Already Done)

This repo includes `.copilot/mcp-config.json` that automatically configures the MCP server for GitHub Copilot CLI when you open the workspace:

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

**No manual setup needed** - just open the repo in VS Code with Copilot CLI installed.

### User-Level Config (Optional)

For persistent access across all sessions (not just this repo), add to `~/.config/github-copilot/cli/config.json`:

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

For the older step-by-step Copilot CLI walkthrough, see the archived v1 guide at [`archive/v1/docs/copilot-cli-mcp-setup.md`](../../archive/v1/docs/copilot-cli-mcp-setup.md).

## Testing

### Smoke Test (Safe, No Side Effects)

```bash
npm run mcp:smoke
```

This verifies:
- All tools are registered correctly
- Table rendering works (generates test image)
- Auth-required tools show expected errors when credentials are missing

### Manual Testing

1. Start the MCP server in a separate terminal:
   ```bash
   npm run mcp:server
   ```

2. In your Copilot CLI session, use the tools:
   ```
   @copilot render the first table in content/articles/sea-emmanwori-rookie-eval/draft.md
   ```

## Creating New Tools

### Step 1: Create the Tool Implementation

Create a new directory under `.github/extensions/`:

```javascript
// .github/extensions/my-new-tool/extension.mjs

export const myNewToolDefinition = {
    name: "my_new_tool",
    description: "What this tool does...",
    parameters: {
        type: "object",
        properties: {
            param1: {
                type: "string",
                description: "Description of param1",
            },
        },
        required: ["param1"],
    },
};

export async function handleMyNewTool(params) {
    // Implementation here
    const { param1 } = params;
    
    // Do work...
    
    return {
        textResultForLlm: "Success message",
        resultType: "success",
    };
}
```

### Step 2: Register in MCP Server

Add to `mcp/server.mjs`:

```javascript
import {
    myNewToolDefinition,
    handleMyNewTool,
} from "../.github/extensions/my-new-tool/extension.mjs";

// ... in registerTool section:
server.registerTool(myNewToolDefinition.name, {
    description: myNewToolDefinition.description,
    inputSchema: {
        // Convert to Zod schema
        param1: z.string().describe(myNewToolDefinition.parameters.properties.param1.description),
    },
}, async (args) => runWithNormalization(handleMyNewTool, args));
```

### Step 3: Test It

```bash
npm run mcp:smoke
```

Add test cases to `mcp/smoke-test.mjs` for your new tool.

### Step 4: Document It

Add tool documentation to:
- This README (Available Tools section)
- `archive/v1/docs/mcp-server.md` for legacy MCP setup context (if appropriate)
- Main `README.md` (if user-facing)

## Legacy: Native Copilot CLI Extensions

Some tools include a `main()` function for backward compatibility with native Copilot CLI extension loading:

```javascript
async function main() {
    const [{ approveAll }, { joinSession }] = await Promise.all([
        import("@github/copilot-sdk"),
        import("@github/copilot-sdk/extension"),
    ]);

    await joinSession({
        onPermissionRequest: approveAll,
        tools: [
            {
                ...toolDefinition,
                handler: handleTool,
            },
        ],
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
```

**This pattern is deprecated.** Native extension loading has SDK version conflicts and limited multi-client support. New tools should export definitions and handlers for MCP server registration only.

## Shared Utilities

### `pipeline-telemetry.mjs`
Records tool usage events to `content/pipeline.db` for analytics and tracking.

### `shared-env.mjs`
Loads environment variables from `.env` for API keys and configuration.

### `renderer-core.mjs`
Core table rendering engine (Playwright-based) used by `render_table_image` and `fix-dense-tables.mjs`.

## Environment Variables

Tools use these environment variables (set in `.env`):

```bash
# Image Generation
GEMINI_API_KEY=your-google-ai-studio-key

# Substack Publishing
SUBSTACK_TOKEN=your-substack-sid-cookie
SUBSTACK_PUBLICATION_URL=https://yourpub.substack.com
SUBSTACK_STAGE_URL=https://staging.substack.com  # optional
NOTES_ENDPOINT_PATH=/api/v1/comment/feed

# Telemetry (optional)
EXTENSION_ENV_DISABLED=1  # Set to disable .env loading (for safe tests)
```

## Related Documentation

- **[Archived MCP Server Setup](../../archive/v1/docs/mcp-server.md)** - Legacy setup notes for Codex, Claude Code, OpenCode, and VS Code
- **[Archived Copilot CLI Setup](../../archive/v1/docs/copilot-cli-mcp-setup.md)** - Legacy GitHub Copilot CLI setup notes
- **[Main README](../../README.md#services-and-mcp-tools)** - Current v2 overview and MCP/service context

## Questions?

- Check existing tool implementations for patterns
- Review `mcp/server.mjs` for MCP server structure
- Run `npm run mcp:smoke` to verify everything works
- Read MCP protocol docs: https://modelcontextprotocol.io/


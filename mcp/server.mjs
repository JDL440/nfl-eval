import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerLocalTools } from "./tool-registry.mjs";

const server = new McpServer({
    name: "nfl-eval-local-tools",
    version: "1.1.0",
});

registerLocalTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("nfl-eval local MCP server running on stdio");

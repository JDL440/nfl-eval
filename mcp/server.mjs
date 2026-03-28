import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import { localTools, normalizeToolResult } from "./local-tool-registry.mjs";

const server = new McpServer({
    name: "nfl-eval-local-tools",
    version: "1.0.0",
});

function schemaToZod(schema) {
    switch (schema?.type) {
        case "string": {
            let value = z.string();
            if (Array.isArray(schema.enum) && schema.enum.length > 0) {
                value = z.enum(schema.enum);
            }
            return schema.description ? value.describe(schema.description) : value;
        }
        case "number": {
            let value = z.number();
            if (Number.isFinite(schema.minimum)) value = value.min(schema.minimum);
            if (Number.isFinite(schema.maximum)) value = value.max(schema.maximum);
            return schema.description ? value.describe(schema.description) : value;
        }
        case "integer": {
            let value = z.number().int();
            if (Number.isFinite(schema.minimum)) value = value.min(schema.minimum);
            if (Number.isFinite(schema.maximum)) value = value.max(schema.maximum);
            return schema.description ? value.describe(schema.description) : value;
        }
        case "boolean":
            return schema.description ? z.boolean().describe(schema.description) : z.boolean();
        case "array": {
            const itemSchema = schemaToZod(schema.items ?? { type: "string" });
            const value = z.array(itemSchema);
            return schema.description ? value.describe(schema.description) : value;
        }
        default:
            return schema.description ? z.any().describe(schema.description) : z.any();
    }
}

function objectShape(parameters) {
    const shape = {};
    const required = new Set(parameters?.required ?? []);
    for (const [key, property] of Object.entries(parameters?.properties ?? {})) {
        let value = schemaToZod(property);
        if (!required.has(key)) {
            value = value.optional();
        }
        shape[key] = value;
    }
    return shape;
}

for (const tool of localTools) {
    server.registerTool(tool.manifest.name, {
        description: tool.manifest.description,
        inputSchema: objectShape(tool.manifest.parameters),
    }, async (args) => {
        const result = await tool.handler(args);
        return normalizeToolResult(result);
    });
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("nfl-eval local MCP server running on stdio");

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import {
    generateArticleImagesTool,
    handleGenerateArticleImages,
} from "../.github/extensions/gemini-imagegen/extension.mjs";
import {
    renderTableImageTool,
    handleRenderTableImage,
} from "../.github/extensions/table-image-renderer/extension.mjs";
import {
    publishToSubstackTool,
    publishNoteToSubstackTool,
    handlePublishToSubstack,
    handlePublishNoteToSubstack,
} from "../.github/extensions/substack-publisher/tool.mjs";

const server = new McpServer({
    name: "nfl-eval-local-tools",
    version: "1.0.0",
});

function normalizeToolResult(result) {
    if (typeof result === "string") {
        return {
            content: [{ type: "text", text: result }],
        };
    }

    if (result && typeof result === "object" && "textResultForLlm" in result) {
        return {
            content: [{ type: "text", text: result.textResultForLlm || "" }],
            isError: result.resultType === "failure",
        };
    }

    if (result && typeof result === "object" && Array.isArray(result.content)) {
        return result;
    }

    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}

async function runWithNormalization(handler, args) {
    const result = await handler(args);
    return normalizeToolResult(result);
}

server.registerTool(generateArticleImagesTool.name, {
    description: generateArticleImagesTool.description,
    inputSchema: {
        article_slug: z.string().describe(generateArticleImagesTool.parameters.properties.article_slug.description),
        article_title: z.string().describe(generateArticleImagesTool.parameters.properties.article_title.description),
        article_summary: z.string().optional().describe(generateArticleImagesTool.parameters.properties.article_summary.description),
        team: z.string().optional().describe(generateArticleImagesTool.parameters.properties.team.description),
        players: z.array(z.string()).optional().describe(generateArticleImagesTool.parameters.properties.players.description),
        image_types: z.array(z.enum(["cover", "inline"])).optional().describe(generateArticleImagesTool.parameters.properties.image_types.description),
        count_per_type: z.number().int().min(1).max(4).optional().describe(generateArticleImagesTool.parameters.properties.count_per_type.description),
        custom_prompts: z.record(z.string(), z.string()).optional().describe(generateArticleImagesTool.parameters.properties.custom_prompts.description),
        use_model: z.enum(["gemini", "auto", "imagen-4"]).optional().describe(generateArticleImagesTool.parameters.properties.use_model.description),
    },
}, async (args) => runWithNormalization(handleGenerateArticleImages, args));

server.registerTool(renderTableImageTool.name, {
    description: renderTableImageTool.description,
    inputSchema: {
        article_file_path: z.string().describe(renderTableImageTool.parameters.properties.article_file_path.description),
        article_slug: z.string().optional().describe(renderTableImageTool.parameters.properties.article_slug.description),
        source_path: z.string().optional().describe(renderTableImageTool.parameters.properties.source_path.description),
        table_index: z.number().int().optional().describe(renderTableImageTool.parameters.properties.table_index.description),
        table_markdown: z.string().optional().describe(renderTableImageTool.parameters.properties.table_markdown.description),
        title: z.string().optional().describe(renderTableImageTool.parameters.properties.title.description),
        caption: z.string().optional().describe(renderTableImageTool.parameters.properties.caption.description),
        alt_text: z.string().optional().describe(renderTableImageTool.parameters.properties.alt_text.description),
        output_name: z.string().optional().describe(renderTableImageTool.parameters.properties.output_name.description),
        template: z.string().optional().describe(renderTableImageTool.parameters.properties.template.description),
        mobile: z.boolean().optional().describe(renderTableImageTool.parameters.properties.mobile.description),
    },
}, async (args) => runWithNormalization(handleRenderTableImage, args));

server.registerTool(publishToSubstackTool.name, {
    description: publishToSubstackTool.description,
    inputSchema: {
        file_path: z.string().describe(publishToSubstackTool.parameters.properties.file_path.description),
        title: z.string().optional().describe(publishToSubstackTool.parameters.properties.title.description),
        subtitle: z.string().optional().describe(publishToSubstackTool.parameters.properties.subtitle.description),
        audience: z.enum(["everyone", "only_paid"]).optional().describe(publishToSubstackTool.parameters.properties.audience.description),
        team: z.string().optional().describe(publishToSubstackTool.parameters.properties.team.description),
        draft_url: z.string().optional().describe(publishToSubstackTool.parameters.properties.draft_url.description),
        target: z.enum(["stage", "prod"]).optional().describe(publishToSubstackTool.parameters.properties.target.description),
    },
}, async (args) => runWithNormalization(handlePublishToSubstack, args));

server.registerTool(publishNoteToSubstackTool.name, {
    description: publishNoteToSubstackTool.description,
    inputSchema: {
        content: z.string().describe(publishNoteToSubstackTool.parameters.properties.content.description),
        image_path: z.string().optional().describe(publishNoteToSubstackTool.parameters.properties.image_path.description),
        article_slug: z.string().optional().describe(publishNoteToSubstackTool.parameters.properties.article_slug.description),
        target: z.enum(["stage", "prod"]).optional().describe(publishNoteToSubstackTool.parameters.properties.target.description),
    },
}, async (args) => runWithNormalization(handlePublishNoteToSubstack, args));

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("nfl-eval local MCP server running on stdio");

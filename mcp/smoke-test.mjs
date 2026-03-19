import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const cwd = process.cwd();
const serverArgs = ["mcp/server.mjs"];

function printToolResult(label, result) {
    console.log(`\n[${label}]`);
    for (const item of result.content || []) {
        if (item.type === "text") {
            console.log(item.text);
        } else {
            console.log(JSON.stringify(item, null, 2));
        }
    }
    if (result.isError) {
        console.log("(reported as error)");
    }
}

const client = new Client(
    { name: "nfl-eval-smoke-test", version: "1.0.0" },
    { capabilities: {} },
);

const transport = new StdioClientTransport({
    command: process.execPath,
    args: serverArgs,
    cwd,
    stderr: "inherit",
    env: {
        ...process.env,
        EXTENSION_ENV_DISABLED: "1",
        GEMINI_API_KEY: "",
        SUBSTACK_TOKEN: "",
        SUBSTACK_PUBLICATION_URL: "",
        SUBSTACK_STAGE_URL: "",
        NOTES_ENDPOINT_PATH: "",
    },
});

try {
    await client.connect(transport);

    const tools = await client.listTools();
    console.log("Registered tools:", tools.tools.map((tool) => tool.name).join(", "));

    const renderResult = await client.callTool({
        name: "render_table_image",
        arguments: {
            article_file_path: "content/articles/witherspoon-extension-cap-vs-agent.md",
            article_slug: "witherspoon-extension-cap-vs-agent",
            table_markdown: "| Team | Value |\n| --- | --- |\n| SEA | 1 |\n| SF | 2 |",
            title: "MCP Smoke Test Table",
            caption: "Local table render smoke test",
            output_name: "mcp-smoke-test-table",
        },
    });
    printToolResult("render_table_image", renderResult);

    const imageResult = await client.callTool({
        name: "generate_article_images",
        arguments: {
            article_slug: "mcp-smoke-test",
            article_title: "MCP smoke test article",
        },
    });
    printToolResult("generate_article_images", imageResult);

    const publishResult = await client.callTool({
        name: "publish_to_substack",
        arguments: {
            file_path: "content/articles/witherspoon-extension-cap-vs-agent.md",
            target: "stage",
        },
    });
    printToolResult("publish_to_substack", publishResult);

    const noteResult = await client.callTool({
        name: "publish_note_to_substack",
        arguments: {
            content: "MCP smoke test note",
            target: "stage",
        },
    });
    printToolResult("publish_note_to_substack", noteResult);

    // ─── nflverse-query tools ─────────────────────────────────────────────────
    // These tools shell out to Python — validate they register and handle
    // errors gracefully when data isn't cached.

    const nflverseTools = [
        "query_player_stats",
        "query_team_efficiency",
        "query_positional_rankings",
        "query_snap_counts",
        "query_draft_history",
        "query_ngs_passing",
        "query_combine_profile",
        "query_pfr_defense",
        "query_historical_comps",
        "refresh_nflverse_cache",
    ];

    const registeredNames = tools.tools.map((t) => t.name);
    for (const name of nflverseTools) {
        if (!registeredNames.includes(name)) {
            console.log(`[FAIL] nflverse tool not registered: ${name}`);
        }
    }
    console.log(`\nnflverse tools registered: ${nflverseTools.filter((n) => registeredNames.includes(n)).length}/${nflverseTools.length}`);

    // Smoke-test one nflverse tool (will fail gracefully if no cache)
    const playerStatsResult = await client.callTool({
        name: "query_player_stats",
        arguments: {
            player: "Jaxon Smith-Njigba",
            season: 2025,
        },
    });
    printToolResult("query_player_stats", playerStatsResult);

    const teamEffResult = await client.callTool({
        name: "query_team_efficiency",
        arguments: {
            team: "SEA",
            season: 2025,
        },
    });
    printToolResult("query_team_efficiency", teamEffResult);
} finally {
    await transport.close();
}

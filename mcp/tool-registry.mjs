import * as z from "zod/v4";

import {
    generateArticleImagesTool,
    handleGenerateArticleImages,
} from "../.github/extensions/gemini-imagegen/tool.mjs";
import {
    renderTableImageTool,
    handleRenderTableImage,
} from "../.github/extensions/table-image-renderer/tool.mjs";
import {
    publishToSubstackTool,
    publishNoteToSubstackTool,
    publishTweetTool,
    handlePublishToSubstack,
    handlePublishNoteToSubstack,
    handlePublishTweet,
} from "../.github/extensions/substack-publisher/tool.mjs";
import {
    queryPredictionMarketsTool,
    handleQueryPredictionMarkets,
} from "../.github/extensions/prediction-market-query/tool.mjs";
import {
    queryPlayerStatsTool,
    handleQueryPlayerStats,
    queryTeamEfficiencyTool,
    handleQueryTeamEfficiency,
    queryPositionalRankingsTool,
    handleQueryPositionalRankings,
    querySnapCountsTool,
    handleQuerySnapCounts,
    queryDraftHistoryTool,
    handleQueryDraftHistory,
    queryNgsPassingTool,
    handleQueryNgsPassing,
    queryCombineProfileTool,
    handleQueryCombineProfile,
    queryPfrDefenseTool,
    handleQueryPfrDefense,
    queryHistoricalCompsTool,
    handleQueryHistoricalComps,
    queryRostersTool,
    handleQueryRosters,
    queryFantasyStatsTool,
    handleQueryFantasyStats,
    refreshNflverseCacheTool,
    handleRefreshNflverseCache,
} from "../.github/extensions/nflverse-query/tool.mjs";
import { cachedQuery, TTL } from "../.github/extensions/nflverse-query/mcp-cache.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __execFileAsync = promisify(execFile);
const __toolRegistryDir = dirname(fileURLToPath(import.meta.url));
const __repoRoot = resolve(__toolRegistryDir, "..");
const MLB_DATA_DIR = resolve(__repoRoot, "content", "data", "mlb");

// ── Statcast placeholder tool (MLB data pipeline not yet connected) ──────────
const statcastDataTool = {
    name: "statcast_data",
    description:
        "Query Statcast batting, pitching, and team stats for MLB players and teams. Returns stats sourced from Baseball Savant.",
    parameters: {
        type: "object",
        properties: {
            player: {
                type: "string",
                description: 'Player name (e.g., "Shohei Ohtani"). Partial match supported.',
            },
            season: {
                type: "integer",
                description: "Season year (e.g., 2025).",
            },
            query_type: {
                type: "string",
                enum: [
                    "batting_stats",
                    "pitching_stats",
                    "team_batting",
                    "team_pitching",
                    "standings",
                ],
                description: "Type of Statcast query to run.",
            },
        },
        required: ["query_type"],
    },
};

async function runMlbPythonQuery(script, args) {
    const scriptPath = resolve(MLB_DATA_DIR, script);
    const cmd = [scriptPath, ...args, "--format", "json"];
    try {
        const { stdout, stderr } = await __execFileAsync("python", cmd, {
            cwd: __repoRoot,
            timeout: 120_000,
            maxBuffer: 10 * 1024 * 1024,
        });
        if (stderr) {
            const isError = stderr.includes("❌") || stderr.includes("ERROR");
            if (isError) return { data: null, error: stderr.trim() };
        }
        return { data: JSON.parse(stdout), error: null };
    } catch (err) {
        const msg = err.stderr?.trim() || err.message;
        return { data: null, error: msg };
    }
}

function mlbJsonToMarkdown(data, title) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return `No results for: ${title}`;
    }
    return `### ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

async function handleStatcastData(args) {
    const { query_type, player, season } = args;
    const seasonStr = season ? String(season) : "2024";

    switch (query_type) {
        case "batting_stats": {
            if (!player) return { textResultForLlm: "Player name required for batting_stats query.", resultType: "error" };
            const cacheKey = `mlb-batting:${player.toLowerCase().replace(/\s+/g, "-")}:${seasonStr}`;
            return cachedQuery(cacheKey, TTL.playerStats,
                () => runMlbPythonQuery("query_player_batting.py", ["--player", player, "--season", seasonStr]),
                (data) => ({ textResultForLlm: mlbJsonToMarkdown(data, `${player} — ${seasonStr} Batting`), resultType: "success" }),
            );
        }
        case "pitching_stats": {
            if (!player) return { textResultForLlm: "Player name required for pitching_stats query.", resultType: "error" };
            const cacheKey = `mlb-pitching:${player.toLowerCase().replace(/\s+/g, "-")}:${seasonStr}`;
            return cachedQuery(cacheKey, TTL.playerStats,
                () => runMlbPythonQuery("query_player_pitching.py", ["--player", player, "--season", seasonStr]),
                (data) => ({ textResultForLlm: mlbJsonToMarkdown(data, `${player} — ${seasonStr} Pitching`), resultType: "success" }),
            );
        }
        case "team_batting": {
            const team = args.player || "NYY";
            const cacheKey = `mlb-team-batting:${team.toUpperCase()}:${seasonStr}`;
            return cachedQuery(cacheKey, TTL.teamStats,
                () => runMlbPythonQuery("query_team_batting.py", ["--team", team, "--season", seasonStr]),
                (data) => ({ textResultForLlm: mlbJsonToMarkdown(data, `${team.toUpperCase()} — ${seasonStr} Team Batting`), resultType: "success" }),
            );
        }
        case "team_pitching":
            return { textResultForLlm: "Team pitching query coming soon.", resultType: "success" };
        case "standings":
            return { textResultForLlm: "Standings query coming soon.", resultType: "success" };
        default:
            return { textResultForLlm: `Unknown query_type: ${query_type}. Use: batting_stats, pitching_stats, team_batting, team_pitching, or standings.`, resultType: "error" };
    }
}

export const TOOL_CATEGORIES = ["all", "help", "media", "publishing", "data"];

export const SAFE_READ_ONLY_TOOL_NAMES = Object.freeze([
    "local_tool_catalog",
    "query_prediction_markets",
    "query_player_stats",
    "query_team_efficiency",
    "query_positional_rankings",
    "query_snap_counts",
    "query_draft_history",
    "query_ngs_passing",
    "query_combine_profile",
    "query_pfr_defense",
    "query_historical_comps",
    "query_rosters",
    "query_fantasy_stats",
    "statcast_data",
]);

export const BLOCKED_TOOL_NAMES = Object.freeze([
    "generate_article_images",
    "render_table_image",
    "publish_to_substack",
    "publish_note_to_substack",
    "publish_tweet",
    "refresh_nflverse_cache",
]);

const SAFE_READ_ONLY_TOOL_SET = new Set(SAFE_READ_ONLY_TOOL_NAMES);

const BASE_TOOL_METADATA = {
    generate_article_images: {
        category: "media",
        sideEffects: "writes generated image files for an article",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        examples: [
            {
                article_slug: "geno-breakout-watch",
                article_title: "Can Geno Smith sustain the surge?",
                image_types: ["cover"],
            },
        ],
    },
    render_table_image: {
        category: "media",
        sideEffects: "renders and writes an image file from markdown table input",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        examples: [
            {
                article_file_path: "content/articles/seahawks-draft.md",
                table_index: 0,
            },
        ],
    },
    publish_to_substack: {
        category: "publishing",
        sideEffects: "creates or updates a Substack draft or publication",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        examples: [
            {
                file_path: "content/articles/mock-draft.md",
                title: "Why the Seahawks need trench help",
                target: "stage",
            },
        ],
    },
    publish_note_to_substack: {
        category: "publishing",
        sideEffects: "publishes a short-form Substack note",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        examples: [
            {
                content: "Camp update: rookie usage is climbing.",
                target: "stage",
            },
        ],
    },
    publish_tweet: {
        category: "publishing",
        sideEffects: "posts content to X/Twitter",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        examples: [
            {
                content: "New Seahawks article is live.",
                target: "stage",
            },
        ],
    },
    query_prediction_markets: {
        category: "data",
        sideEffects: "none (read-only remote data lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        examples: [
            {
                team: "SEA",
                market_type: "playoff",
            },
        ],
    },
    query_player_stats: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                player: "Jaxon Smith-Njigba",
                season: 2025,
            },
        ],
    },
    query_team_efficiency: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                team: "SEA",
                season: 2025,
            },
        ],
    },
    query_positional_rankings: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                position: "WR",
                metric: "receiving_epa",
                season: 2025,
                top: 10,
            },
        ],
    },
    query_snap_counts: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                team: "SEA",
                season: 2025,
                position_group: "offense",
            },
        ],
    },
    query_draft_history: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                position: "QB",
                since: 2020,
            },
        ],
    },
    query_ngs_passing: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                player: "Patrick Mahomes",
                season: 2025,
            },
        ],
    },
    query_combine_profile: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                player: "DK Metcalf",
            },
        ],
    },
    query_pfr_defense: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                team: "SEA",
                season: 2025,
            },
        ],
    },
    query_historical_comps: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                player: "Brock Bowers",
                season: 2025,
            },
        ],
    },
    query_rosters: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                team: "SEA",
                season: 2025,
            },
        ],
    },
    query_fantasy_stats: {
        category: "data",
        sideEffects: "none (read-only local nflverse lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                player: "Amon-Ra St. Brown",
                season: 2025,
                scoring: "ppr",
            },
            {
                position: "RB",
                season: 2025,
                scoring: "half_ppr",
                top: 10,
            },
        ],
    },
    refresh_nflverse_cache: {
        category: "data",
        sideEffects: "refreshes local cached nflverse datasets on disk",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        examples: [
            {
                datasets: ["player_stats"],
                seasons: "2024,2025",
            },
        ],
    },
    statcast_data: {
        category: "data",
        sideEffects: "none (read-only Statcast lookup — pipeline not yet connected)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            {
                player: "Shohei Ohtani",
                season: 2025,
                query_type: "batting_stats",
            },
        ],
    },
};

function buildToolEntry(tool, handler, metadata) {
    return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
        handler,
        ...metadata,
    };
}

const BASE_LOCAL_TOOL_ENTRIES = [
    buildToolEntry(generateArticleImagesTool, handleGenerateArticleImages, BASE_TOOL_METADATA.generate_article_images),
    buildToolEntry(renderTableImageTool, handleRenderTableImage, BASE_TOOL_METADATA.render_table_image),
    buildToolEntry(publishToSubstackTool, handlePublishToSubstack, BASE_TOOL_METADATA.publish_to_substack),
    buildToolEntry(publishNoteToSubstackTool, handlePublishNoteToSubstack, BASE_TOOL_METADATA.publish_note_to_substack),
    buildToolEntry(publishTweetTool, handlePublishTweet, BASE_TOOL_METADATA.publish_tweet),
    buildToolEntry(queryPredictionMarketsTool, handleQueryPredictionMarkets, BASE_TOOL_METADATA.query_prediction_markets),
    buildToolEntry(queryPlayerStatsTool, handleQueryPlayerStats, BASE_TOOL_METADATA.query_player_stats),
    buildToolEntry(queryTeamEfficiencyTool, handleQueryTeamEfficiency, BASE_TOOL_METADATA.query_team_efficiency),
    buildToolEntry(queryPositionalRankingsTool, handleQueryPositionalRankings, BASE_TOOL_METADATA.query_positional_rankings),
    buildToolEntry(querySnapCountsTool, handleQuerySnapCounts, BASE_TOOL_METADATA.query_snap_counts),
    buildToolEntry(queryDraftHistoryTool, handleQueryDraftHistory, BASE_TOOL_METADATA.query_draft_history),
    buildToolEntry(queryNgsPassingTool, handleQueryNgsPassing, BASE_TOOL_METADATA.query_ngs_passing),
    buildToolEntry(queryCombineProfileTool, handleQueryCombineProfile, BASE_TOOL_METADATA.query_combine_profile),
    buildToolEntry(queryPfrDefenseTool, handleQueryPfrDefense, BASE_TOOL_METADATA.query_pfr_defense),
    buildToolEntry(queryHistoricalCompsTool, handleQueryHistoricalComps, BASE_TOOL_METADATA.query_historical_comps),
    buildToolEntry(queryRostersTool, handleQueryRosters, BASE_TOOL_METADATA.query_rosters),
    buildToolEntry(queryFantasyStatsTool, handleQueryFantasyStats, BASE_TOOL_METADATA.query_fantasy_stats),
    buildToolEntry(refreshNflverseCacheTool, handleRefreshNflverseCache, BASE_TOOL_METADATA.refresh_nflverse_cache),
    buildToolEntry(statcastDataTool, handleStatcastData, BASE_TOOL_METADATA.statcast_data),
];

function formatCatalogMarkdown(entries, options = {}) {
    const includeExamples = options.includeExamples ?? true;
    const lines = [
        "# Local Tool Catalog",
        "",
        `Tools listed: ${entries.length}`,
        "",
    ];

    for (const entry of entries) {
        lines.push(`## ${entry.name}`);
        lines.push(entry.description);
        lines.push(`- Category: ${entry.category}`);
        lines.push(`- Side effects: ${entry.sideEffects}`);
        lines.push(`- Read only: ${entry.readOnlyHint ? "yes" : "no"}`);
        const required = entry.inputSchema?.required ?? [];
        if (required.length > 0) {
            lines.push(`- Required arguments: ${required.join(", ")}`);
        }
        if (includeExamples && Array.isArray(entry.examples) && entry.examples.length > 0) {
            lines.push("- Example arguments:");
            for (const example of entry.examples) {
                lines.push("```json");
                lines.push(JSON.stringify(example, null, 2));
                lines.push("```");
            }
        }
        lines.push("");
    }

    return lines.join("\n").trim();
}

function buildCatalogEntry(allEntries) {
    return {
        name: "local_tool_catalog",
        description: "Discover the repo-local tool surface, including safe query tools, required arguments, and example payloads.",
        category: "help",
        sideEffects: "none (read-only metadata lookup)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        examples: [
            { tool_name: "query_player_stats" },
            { category: "data", include_examples: true },
        ],
        inputSchema: {
            type: "object",
            properties: {
                category: {
                    type: "string",
                    description: "Optional tool category filter: help, media, publishing, or data.",
                },
                tool_name: {
                    type: "string",
                    description: "Optional exact tool name to inspect.",
                },
                include_examples: {
                    type: "boolean",
                    description: "Whether to include example arguments in the output (default: true).",
                },
                safe_only: {
                    type: "boolean",
                    description: "When true (default), include only the approved read-only tool subset.",
                },
            },
            required: [],
        },
        async handler(args = {}) {
            const category = typeof args.category === "string" ? args.category.trim().toLowerCase() : null;
            const toolName = typeof args.tool_name === "string" ? args.tool_name.trim() : null;
            const includeExamples = args.include_examples !== false;
            const safeOnly = args.safe_only !== false;

            let entries = [...allEntries];
            if (safeOnly) {
                entries = entries.filter((entry) => SAFE_READ_ONLY_TOOL_SET.has(entry.name));
            }
            if (category) {
                entries = entries.filter((entry) => entry.category === category);
            }
            if (toolName) {
                entries = entries.filter((entry) => entry.name === toolName);
            }

            if (entries.length === 0) {
                return {
                    textResultForLlm: "No matching tools found in the local catalog.",
                    resultType: "success",
                };
            }

            return {
                textResultForLlm: formatCatalogMarkdown(entries, { includeExamples }),
                resultType: "success",
            };
        },
    };
}

export function getLocalToolEntries() {
    const baseEntries = [...BASE_LOCAL_TOOL_ENTRIES];
    return [buildCatalogEntry(baseEntries), ...baseEntries];
}

function schemaPropertyToZod(schema) {
    if (!schema || typeof schema !== "object") {
        return z.any();
    }

    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        return z.union(schema.enum.map((value) => z.literal(value)));
    }

    const schemaType = schema.type;
    if (Array.isArray(schemaType)) {
        const filtered = schemaType.filter((value) => value !== "null");
        if (filtered.length === 1) {
            return schemaPropertyToZod({ ...schema, type: filtered[0] }).nullable();
        }
        return z.any();
    }

    switch (schemaType) {
        case "string":
            return z.string();
        case "integer":
            return z.number().int();
        case "number":
            return z.number();
        case "boolean":
            return z.boolean();
        case "array":
            return z.array(schemaPropertyToZod(schema.items ?? {}));
        case "object": {
            const shape = {};
            const properties = schema.properties ?? {};
            const required = new Set(schema.required ?? []);
            for (const [key, value] of Object.entries(properties)) {
                const child = schemaPropertyToZod(value);
                shape[key] = required.has(key) ? child : child.optional();
            }
            return z.object(shape);
        }
        default:
            return z.any();
    }
}

function objectSchemaToZodShape(schema) {
    const properties = schema?.properties ?? {};
    const required = new Set(schema?.required ?? []);
    const shape = {};
    for (const [key, value] of Object.entries(properties)) {
        const child = schemaPropertyToZod(value);
        shape[key] = required.has(key) ? child : child.optional();
    }
    return shape;
}

export function normalizeToolResult(result) {
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

export function renderToolResultText(result) {
    const normalized = normalizeToolResult(result);
    const text = Array.isArray(normalized.content)
        ? normalized.content
            .map((item) => (item && typeof item.text === "string" ? item.text : ""))
            .filter(Boolean)
            .join("\n\n")
        : "";
    return {
        text,
        isError: normalized.isError === true,
    };
}

export function registerLocalTools(server) {
    for (const entry of getLocalToolEntries()) {
        server.registerTool(entry.name, {
            description: entry.description,
            inputSchema: objectSchemaToZodShape(entry.inputSchema),
        }, async (args) => normalizeToolResult(await entry.handler(args)));
    }
}

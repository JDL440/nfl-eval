/**
 * nflverse-query — MCP Tool Extension
 *
 * Exposes nflverse data query capabilities as native MCP tools.
 * Shells out to Python query scripts in content/data/.
 * Any agent can call these tools without prompt engineering.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const DATA_DIR = resolve(REPO_ROOT, "content", "data");

// ─── Shell-out helper ─────────────────────────────────────────────────────────

async function runPythonQuery(script, args) {
    const scriptPath = resolve(DATA_DIR, script);
    const cmd = [scriptPath, ...args, "--format", "json"];
    try {
        const { stdout, stderr } = await execFileAsync("python", cmd, {
            cwd: REPO_ROOT,
            timeout: 120_000,
            maxBuffer: 10 * 1024 * 1024,
        });
        if (stderr) {
            // stderr often contains cache-miss messages; not errors
            const isError = stderr.includes("❌") || stderr.includes("ERROR");
            if (isError) {
                return { data: null, error: stderr.trim() };
            }
        }
        const data = JSON.parse(stdout);
        return { data, error: null };
    } catch (err) {
        const msg = err.stderr?.trim() || err.message;
        return { data: null, error: msg };
    }
}

function formatMarkdownTable(headers, rows) {
    const hLine = `| ${headers.join(" | ")} |`;
    const sep = `|${headers.map(() => "---").join("|")}|`;
    const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    return `${hLine}\n${sep}\n${body}`;
}

function jsonToMarkdown(data, title) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        return `No results for: ${title}`;
    }
    // Return formatted JSON as a structured text result
    return `### ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

// ─── Tool 1: query_player_stats ───────────────────────────────────────────────

export const queryPlayerStatsTool = {
    name: "query_player_stats",
    description:
        "Query EPA and efficiency metrics for an NFL player. Returns passing/rushing/receiving stats with positional rank. Supports QB, RB, WR, TE.",
    parameters: {
        type: "object",
        properties: {
            player: {
                type: "string",
                description: 'Player name (e.g., "Jaxon Smith-Njigba"). Partial match supported.',
            },
            season: {
                type: "integer",
                description: "Season year (e.g., 2025).",
            },
        },
        required: ["player", "season"],
    },
};

export async function handleQueryPlayerStats(args) {
    const { player, season } = args;
    const { data, error } = await runPythonQuery("query_player_epa.py", [
        "--player", player,
        "--season", String(season),
    ]);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    return { textResultForLlm: jsonToMarkdown(data, `${player} — ${season} Stats`), resultType: "success" };
}

// ─── Tool 2: query_team_efficiency ────────────────────────────────────────────

export const queryTeamEfficiencyTool = {
    name: "query_team_efficiency",
    description:
        "Query team offensive and defensive efficiency. Returns EPA/play, success rate, turnover differential, red zone %, 3rd down %.",
    parameters: {
        type: "object",
        properties: {
            team: {
                type: "string",
                description: "3-letter team abbreviation (e.g., SEA, KC, BUF).",
            },
            season: {
                type: "integer",
                description: "Season year (e.g., 2025).",
            },
        },
        required: ["team", "season"],
    },
};

export async function handleQueryTeamEfficiency(args) {
    const { team, season } = args;
    const { data, error } = await runPythonQuery("query_team_efficiency.py", [
        "--team", team,
        "--season", String(season),
    ]);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    return { textResultForLlm: jsonToMarkdown(data, `${team} — ${season} Efficiency`), resultType: "success" };
}

// ─── Tool 3: query_positional_rankings ────────────────────────────────────────

export const queryPositionalRankingsTool = {
    name: "query_positional_rankings",
    description:
        "League-wide positional rankings by a chosen metric. Supports QB, RB, WR, TE positions.",
    parameters: {
        type: "object",
        properties: {
            position: {
                type: "string",
                description: "Position (QB, RB, WR, TE).",
            },
            metric: {
                type: "string",
                description:
                    "Metric to rank by. QB: passing_epa, passing_yards, cpoe. RB: rushing_epa, rushing_yards. WR/TE: receiving_epa, receiving_yards, target_share, racr.",
            },
            season: {
                type: "integer",
                description: "Season year.",
            },
            top: {
                type: "integer",
                description: "Number of results (default: 20).",
            },
        },
        required: ["position", "metric", "season"],
    },
};

export async function handleQueryPositionalRankings(args) {
    const { position, metric, season, top } = args;
    const cmdArgs = [
        "--position", position,
        "--metric", metric,
        "--season", String(season),
    ];
    if (top) cmdArgs.push("--top", String(top));
    const { data, error } = await runPythonQuery("query_positional_comparison.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    return { textResultForLlm: jsonToMarkdown(data, `Top ${top || 20} ${position}s by ${metric} — ${season}`), resultType: "success" };
}

// ─── Tool 4: query_snap_counts ────────────────────────────────────────────────

export const querySnapCountsTool = {
    name: "query_snap_counts",
    description:
        "Query snap counts and usage. Supports team-level (all players) or individual player lookup. Shows offensive, defensive, and special teams snap percentages.",
    parameters: {
        type: "object",
        properties: {
            team: {
                type: "string",
                description: "Team abbreviation. Required unless player is specified.",
            },
            player: {
                type: "string",
                description: "Player name for individual lookup. Overrides team.",
            },
            season: {
                type: "integer",
                description: "Season year.",
            },
            position_group: {
                type: "string",
                description: "Filter by group: offense, defense, special. Team mode only.",
            },
            top: {
                type: "integer",
                description: "Number of results (default: 20). Team mode only.",
            },
        },
        required: ["season"],
    },
};

export async function handleQuerySnapCounts(args) {
    const { team, player, season, position_group, top } = args;
    const cmdArgs = ["--season", String(season)];
    if (player) {
        cmdArgs.push("--player", player);
    } else if (team) {
        cmdArgs.push("--team", team);
        if (position_group) cmdArgs.push("--position-group", position_group);
        if (top) cmdArgs.push("--top", String(top));
    } else {
        return { textResultForLlm: "❌ Must specify --team or --player", resultType: "failure" };
    }
    const { data, error } = await runPythonQuery("query_snap_usage.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    const title = player ? `${player} — ${season} Snap Counts` : `${team} Snap Counts — ${season}`;
    return { textResultForLlm: jsonToMarkdown(data, title), resultType: "success" };
}

// ─── Tool 5: query_draft_history ──────────────────────────────────────────────

export const queryDraftHistoryTool = {
    name: "query_draft_history",
    description:
        "Query draft pick value and historical hit rates. Supports pick-range analysis, position hit rates, and individual player draft history.",
    parameters: {
        type: "object",
        properties: {
            player: {
                type: "string",
                description: "Player name for individual draft lookup.",
            },
            position: {
                type: "string",
                description: "Position for hit rate analysis (e.g., WR, EDGE, CB).",
            },
            pick_range: {
                type: "string",
                description: "Pick range (e.g., '1-10', '11-32'). For pick-range mode.",
            },
            round: {
                type: "integer",
                description: "Draft round for position analysis.",
            },
            since: {
                type: "integer",
                description: "Start year for historical analysis (default: 2015).",
            },
        },
        required: [],
    },
};

export async function handleQueryDraftHistory(args) {
    const { player, position, pick_range, round, since } = args;
    const cmdArgs = [];
    if (player) {
        cmdArgs.push("--player", player);
    } else if (pick_range) {
        cmdArgs.push("--pick-range", pick_range);
    } else if (position) {
        cmdArgs.push("--position", position);
        if (round) cmdArgs.push("--round", String(round));
    } else {
        return { textResultForLlm: "❌ Must specify --player, --position, or --pick-range", resultType: "failure" };
    }
    if (since) cmdArgs.push("--since", String(since));
    const { data, error } = await runPythonQuery("query_draft_value.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    const title = player ? `${player} — Draft History` : position ? `${position} Draft Hit Rates` : `Picks ${pick_range} Value`;
    return { textResultForLlm: jsonToMarkdown(data, title), resultType: "success" };
}

// ─── Tool 6: query_ngs_passing ────────────────────────────────────────────────

export const queryNgsPassingTool = {
    name: "query_ngs_passing",
    description:
        "Query Next Gen Stats for QBs: time to throw, air yards, completion probability, aggressiveness. Data available 2016–present.",
    parameters: {
        type: "object",
        properties: {
            player: {
                type: "string",
                description: "QB name for individual lookup.",
            },
            season: {
                type: "integer",
                description: "Season year.",
            },
            top: {
                type: "integer",
                description: "Number of results for leaderboard mode.",
            },
            metric: {
                type: "string",
                description: "Metric for leaderboard: avg_time_to_throw, aggressiveness, avg_completed_air_yards, max_completed_air_distance.",
            },
        },
        required: ["season"],
    },
};

export async function handleQueryNgsPassing(args) {
    const { player, season, top, metric } = args;
    const cmdArgs = ["--season", String(season)];
    if (player) {
        cmdArgs.push("--player", player);
    } else if (top) {
        cmdArgs.push("--top", String(top));
        if (metric) cmdArgs.push("--metric", metric);
    } else {
        return { textResultForLlm: "❌ Must specify --player or --top", resultType: "failure" };
    }
    const { data, error } = await runPythonQuery("query_ngs_passing.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    const title = player ? `${player} — ${season} NGS Passing` : `Top ${top} QBs by ${metric || "avg_time_to_throw"} — ${season}`;
    return { textResultForLlm: jsonToMarkdown(data, title), resultType: "success" };
}

// ─── Tool 7: query_combine_profile ────────────────────────────────────────────

export const queryCombineProfileTool = {
    name: "query_combine_profile",
    description:
        "Query NFL Combine measurables: 40-yard dash, vertical, bench press, broad jump, 3-cone, shuttle. Supports player lookup and positional leaderboards.",
    parameters: {
        type: "object",
        properties: {
            player: {
                type: "string",
                description: "Player/prospect name.",
            },
            position: {
                type: "string",
                description: "Position for leaderboard mode (e.g., WR, CB, EDGE).",
            },
            metric: {
                type: "string",
                description: "Metric for leaderboard: forty, vertical, broad_jump, bench, cone, shuttle.",
            },
            top: {
                type: "integer",
                description: "Number of results for leaderboard.",
            },
        },
        required: [],
    },
};

export async function handleQueryCombineProfile(args) {
    const { player, position, metric, top } = args;
    const cmdArgs = [];
    if (player) {
        cmdArgs.push("--player", player);
    } else if (position) {
        cmdArgs.push("--position", position);
        if (metric) cmdArgs.push("--metric", metric);
        if (top) cmdArgs.push("--top", String(top));
    } else {
        return { textResultForLlm: "❌ Must specify --player or --position", resultType: "failure" };
    }
    const { data, error } = await runPythonQuery("query_combine_comps.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    const title = player ? `${player} — Combine Profile` : `Top ${top || 20} ${position} by ${metric || "forty"}`;
    return { textResultForLlm: jsonToMarkdown(data, title), resultType: "success" };
}

// ─── Tool 8: query_pfr_defense ────────────────────────────────────────────────

export const queryPfrDefenseTool = {
    name: "query_pfr_defense",
    description:
        "Query PFR advanced defensive stats: tackles, coverage (targets, completion %, passer rating allowed), pass rush (sacks, pressures), turnovers. Supports player, team, and positional comparison modes.",
    parameters: {
        type: "object",
        properties: {
            player: {
                type: "string",
                description: "Defensive player name.",
            },
            team: {
                type: "string",
                description: "Team abbreviation for team defense view.",
            },
            position: {
                type: "string",
                description: "Position for league-wide comparison (CB, S, LB, DE, DT, DB, EDGE, DL).",
            },
            season: {
                type: "integer",
                description: "Season year.",
            },
            top: {
                type: "integer",
                description: "Number of results (default: 20).",
            },
        },
        required: ["season"],
    },
};

export async function handleQueryPfrDefense(args) {
    const { player, team, position, season, top } = args;
    const cmdArgs = ["--season", String(season)];
    if (player) {
        cmdArgs.push("--player", player);
    } else if (team) {
        cmdArgs.push("--team", team);
    } else if (position) {
        cmdArgs.push("--position", position);
    } else {
        return { textResultForLlm: "❌ Must specify --player, --team, or --position", resultType: "failure" };
    }
    if (top) cmdArgs.push("--top", String(top));
    const { data, error } = await runPythonQuery("query_pfr_defense.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    const title = player
        ? `${player} — ${season} PFR Defense`
        : team
          ? `${team} Defense — ${season}`
          : `Top ${top || 20} ${position}s — ${season} Defense`;
    return { textResultForLlm: jsonToMarkdown(data, title), resultType: "success" };
}

// ─── Tool 9: query_historical_comps ───────────────────────────────────────────

export const queryHistoricalCompsTool = {
    name: "query_historical_comps",
    description:
        "Find statistically similar players across multiple seasons. Uses z-score normalized metrics and Euclidean distance to identify historical comparisons. Supports QB, RB, WR, TE.",
    parameters: {
        type: "object",
        properties: {
            player: {
                type: "string",
                description: "Player name to find comps for.",
            },
            season: {
                type: "integer",
                description: "Target season year.",
            },
            seasons_back: {
                type: "integer",
                description: "Number of prior seasons to search (default: 5).",
            },
            top: {
                type: "integer",
                description: "Number of comps to return (default: 10).",
            },
        },
        required: ["player", "season"],
    },
};

export async function handleQueryHistoricalComps(args) {
    const { player, season, seasons_back, top } = args;
    const cmdArgs = [
        "--player", player,
        "--season", String(season),
    ];
    if (seasons_back) cmdArgs.push("--seasons-back", String(seasons_back));
    if (top) cmdArgs.push("--top", String(top));
    const { data, error } = await runPythonQuery("query_historical_comps.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    return { textResultForLlm: jsonToMarkdown(data, `Historical Comps for ${player} (${season})`), resultType: "success" };
}

// ─── Tool 10: query_rosters ───────────────────────────────────────────────────

export const queryRostersTool = {
    name: "query_rosters",
    description:
        "Query official NFL roster data from nflverse. Returns players with position, status (ACT/RES/INA/DEV), jersey number, and experience. Supports team rosters and individual player lookup.",
    parameters: {
        type: "object",
        properties: {
            team: {
                type: "string",
                description: "Team abbreviation (e.g., SEA, KC, BUF). Returns full team roster.",
            },
            player: {
                type: "string",
                description: "Player name for individual lookup. Overrides team.",
            },
            season: {
                type: "integer",
                description: "Season year (e.g., 2025).",
            },
            status: {
                type: "string",
                description: "Filter by status: ACT (active), RES (reserve/IR), INA (inactive), DEV (practice squad).",
            },
        },
        required: ["season"],
    },
};

export async function handleQueryRosters(args) {
    const { team, player, season, status } = args;
    const cmdArgs = ["--season", String(season)];
    if (player) {
        cmdArgs.push("--player", player);
    } else if (team) {
        cmdArgs.push("--team", team);
    } else {
        return { textResultForLlm: "❌ Must specify --team or --player", resultType: "failure" };
    }
    if (status) cmdArgs.push("--status", status);
    const { data, error } = await runPythonQuery("query_rosters.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ ${error}`, resultType: "failure" };
    const title = player
        ? `${player} — Roster Lookup (${season})`
        : `${team} Roster (${season})${status ? ` [${status}]` : ""}`;
    return { textResultForLlm: jsonToMarkdown(data, title), resultType: "success" };
}

// ─── Tool 11: refresh_nflverse_cache ──────────────────────────────────────────

export const refreshNflverseCacheTool = {
    name: "refresh_nflverse_cache",
    description:
        "Download or refresh nflverse datasets in the local parquet cache. Use to warm up the cache or force-refresh stale data.",
    parameters: {
        type: "object",
        properties: {
            datasets: {
                type: "array",
                items: { type: "string" },
                description:
                    "Datasets to refresh: pbp, player_stats, team_stats, ngs_passing, ngs_receiving, ngs_rushing, snap_counts, ftn_charting, draft_picks, combine, contracts, rosters, players, pfr_passing, pfr_rushing, pfr_receiving, pfr_defense, schedules.",
            },
            seasons: {
                type: "string",
                description: "Comma-separated season years (e.g., '2024,2025'). Omit for non-seasonal datasets.",
            },
            refresh: {
                type: "boolean",
                description: "Force re-download even if cached (default: false).",
            },
        },
        required: ["datasets"],
    },
};

export async function handleRefreshNflverseCache(args) {
    const { datasets, seasons, refresh } = args;
    const results = [];

    for (const dataset of datasets) {
        const cmdArgs = ["--dataset", dataset];
        if (seasons) cmdArgs.push("--seasons", seasons);
        if (refresh) cmdArgs.push("--refresh");

        const scriptPath = resolve(DATA_DIR, "fetch_nflverse.py");
        try {
            const { stdout, stderr } = await execFileAsync("python", [scriptPath, ...cmdArgs], {
                cwd: REPO_ROOT,
                timeout: 300_000,
                maxBuffer: 10 * 1024 * 1024,
            });
            results.push(`✅ ${dataset}: ${stdout.trim()}`);
        } catch (err) {
            results.push(`❌ ${dataset}: ${err.stderr?.trim() || err.message}`);
        }
    }

    return {
        textResultForLlm: `### Cache Refresh Results\n\n${results.join("\n")}`,
        resultType: results.some((r) => r.startsWith("❌")) ? "failure" : "success",
    };
}

/**
 * prediction-market-query — MCP Tool Extension
 *
 * Exposes NFL prediction market data (Polymarket) as a native MCP tool.
 * Shells out to Python query script in content/data/.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const DATA_DIR = resolve(REPO_ROOT, "content", "data");

async function runPythonQuery(script, args) {
    const scriptPath = resolve(DATA_DIR, script);
    const cmd = [scriptPath, ...args, "--format", "json"];
    try {
        const { stdout, stderr } = await execFileAsync("python", cmd, {
            cwd: REPO_ROOT,
            timeout: 60_000,
            maxBuffer: 10 * 1024 * 1024,
        });
        if (stderr) {
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

function marketsToMarkdown(data, title) {
    if (!data) return `No data returned for: ${title}`;

    const markets = data.markets || [];
    if (markets.length === 0) {
        return `### ${title}\n\n_No markets found on Polymarket._\n\nFetched: ${data.fetched_at || "unknown"}`;
    }

    let md = `### ${title}\n`;
    md += `_Source: Polymarket · ${data.fetched_at || "unknown"} · ${markets.length} market(s)_\n\n`;
    md += `| Market | Implied Prob | Volume | Type |\n`;
    md += `|--------|-------------|-------:|------|\n`;

    for (const m of markets.slice(0, 25)) {
        let question = m.question || "Unknown";
        if (question.length > 65) question = question.slice(0, 62) + "…";

        const probs = m.probabilities || [];
        let probStr = "N/A";
        if (probs.length > 0) {
            const yesProb = probs.find((p) => p.label?.toLowerCase() === "yes");
            if (yesProb) {
                probStr = `${yesProb.probability}%`;
            } else {
                const top = probs.reduce((a, b) => (a.probability > b.probability ? a : b));
                probStr = `${top.label}: ${top.probability}%`;
            }
        }

        const vol = m.volume || 0;
        const volStr = vol >= 1_000_000 ? `$${(vol / 1_000_000).toFixed(1)}M`
            : vol >= 1_000 ? `$${(vol / 1_000).toFixed(0)}K`
            : `$${vol}`;

        md += `| ${question} | ${probStr} | ${volStr} | ${m.market_type || "other"} |\n`;
    }

    if (markets.length > 25) {
        md += `\n_Showing top 25 of ${markets.length} markets by volume._\n`;
    }

    return md;
}

// ─── Tool: query_prediction_markets ───────────────────────────────────────────

export const queryPredictionMarketsTool = {
    name: "query_prediction_markets",
    description:
        "Query prediction market odds (Polymarket) for NFL teams, events, and players. " +
        "Returns market-implied probabilities, trading volume, and market type. " +
        "Use for forward-looking context: win totals, playoff odds, Super Bowl futures, game outcomes.",
    parameters: {
        type: "object",
        properties: {
            team: {
                type: "string",
                description:
                    "Team abbreviation (e.g., SEA, KC, BUF) or name. Filters markets mentioning this team.",
            },
            market_type: {
                type: "string",
                description:
                    "Filter by market type: futures, super_bowl, conference, division, win_total, playoff, mvp, game, player_prop.",
            },
            search: {
                type: "string",
                description:
                    "Free-text search across all NFL market titles (e.g., 'Super Bowl', 'rushing yards').",
            },
        },
    },
};

export async function handleQueryPredictionMarkets(args) {
    const { team, market_type, search } = args;
    const cmdArgs = [];

    if (team) cmdArgs.push("--team", team);
    if (market_type) cmdArgs.push("--market-type", market_type);
    if (search) cmdArgs.push("--search", search);

    // Default to futures if no filters given — most editorially useful
    if (!team && !market_type && !search) {
        cmdArgs.push("--futures");
    }

    const { data, error } = await runPythonQuery("query_prediction_markets.py", cmdArgs);
    if (error) return { textResultForLlm: `❌ Prediction market query failed: ${error}`, resultType: "failure" };

    const parts = ["NFL"];
    if (team) parts.push(team.toUpperCase());
    if (market_type) parts.push(market_type.replace(/_/g, " "));
    parts.push("Prediction Markets");
    const title = parts.join(" ");

    return { textResultForLlm: marketsToMarkdown(data, title), resultType: "success" };
}

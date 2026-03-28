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
    queryPlayerStatsTool, handleQueryPlayerStats,
    queryTeamEfficiencyTool, handleQueryTeamEfficiency,
    queryPositionalRankingsTool, handleQueryPositionalRankings,
    querySnapCountsTool, handleQuerySnapCounts,
    queryDraftHistoryTool, handleQueryDraftHistory,
    queryNgsPassingTool, handleQueryNgsPassing,
    queryCombineProfileTool, handleQueryCombineProfile,
    queryPfrDefenseTool, handleQueryPfrDefense,
    queryHistoricalCompsTool, handleQueryHistoricalComps,
    queryRostersTool, handleQueryRosters,
    refreshNflverseCacheTool, handleRefreshNflverseCache,
} from "../.github/extensions/nflverse-query/tool.mjs";

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

function localTool(manifest, handler, safety, aliases = []) {
    return {
        manifest,
        handler: async (args) => handler(args),
        source: "local-extension",
        safety,
        aliases,
    };
}

const nflverseAliases = ["nflverse-data", "nflverse", "data", "query"];

export const localTools = [
    localTool(generateArticleImagesTool, handleGenerateArticleImages, {
        readOnly: false,
        writesState: true,
        externalSideEffects: false,
    }, ["images", "imagegen"]),
    localTool(renderTableImageTool, handleRenderTableImage, {
        readOnly: false,
        writesState: true,
        externalSideEffects: false,
    }, ["charts", "tables", "prosemirror"]),
    localTool(publishToSubstackTool, handlePublishToSubstack, {
        readOnly: false,
        writesState: true,
        externalSideEffects: true,
        defaultTarget: "prod",
    }, ["substack", "publish"]),
    localTool(publishNoteToSubstackTool, handlePublishNoteToSubstack, {
        readOnly: false,
        writesState: true,
        externalSideEffects: true,
        defaultTarget: "prod",
    }, ["substack", "publish"]),
    localTool(publishTweetTool, handlePublishTweet, {
        readOnly: false,
        writesState: true,
        externalSideEffects: true,
        defaultTarget: "prod",
    }, ["twitter", "x", "social", "publish"]),
    localTool(queryPlayerStatsTool, handleQueryPlayerStats, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(queryTeamEfficiencyTool, handleQueryTeamEfficiency, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(queryPositionalRankingsTool, handleQueryPositionalRankings, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(querySnapCountsTool, handleQuerySnapCounts, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(queryDraftHistoryTool, handleQueryDraftHistory, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(queryNgsPassingTool, handleQueryNgsPassing, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(queryCombineProfileTool, handleQueryCombineProfile, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(queryPfrDefenseTool, handleQueryPfrDefense, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(queryHistoricalCompsTool, handleQueryHistoricalComps, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(queryRostersTool, handleQueryRosters, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, nflverseAliases),
    localTool(refreshNflverseCacheTool, handleRefreshNflverseCache, {
        readOnly: false,
        writesState: true,
        externalSideEffects: false,
    }, ["nflverse-data", "nflverse", "cache"]),
    localTool(queryPredictionMarketsTool, handleQueryPredictionMarkets, {
        readOnly: true,
        writesState: false,
        externalSideEffects: false,
    }, ["prediction-markets", "markets", "odds"]),
];

export { normalizeToolResult };

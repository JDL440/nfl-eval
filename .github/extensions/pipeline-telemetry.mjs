import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const PYTHON_COMMAND = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const PIPELINE_STATE_SCRIPT = resolve(process.cwd(), "content", "pipeline_state.py");

function appendArg(args, flag, value) {
    if (value === undefined || value === null || value === "") {
        return;
    }
    args.push(flag, String(value));
}

export function hashTelemetryText(value) {
    return createHash("sha256").update(value || "", "utf-8").digest("hex");
}

export function recordPipelineUsageEvent({
    articleId,
    stage,
    surface,
    provider,
    actor,
    eventType,
    modelOrTool,
    modelTier,
    precedenceRank,
    requestCount,
    quantity,
    unit,
    promptTokens,
    outputTokens,
    cachedTokens,
    premiumRequests,
    imageCount,
    costUsdEstimate,
    runId,
    stageRunId,
    metadata,
}) {
    if (!articleId) {
        throw new Error("articleId is required for pipeline telemetry");
    }
    if (!surface) {
        throw new Error("surface is required for pipeline telemetry");
    }

    const args = [PIPELINE_STATE_SCRIPT, "record-usage-event"];
    appendArg(args, "--article-id", articleId);
    appendArg(args, "--stage", stage);
    appendArg(args, "--surface", surface);
    appendArg(args, "--provider", provider);
    appendArg(args, "--actor", actor);
    appendArg(args, "--event-type", eventType);
    appendArg(args, "--model-or-tool", modelOrTool);
    appendArg(args, "--model-tier", modelTier);
    appendArg(args, "--precedence-rank", precedenceRank);
    appendArg(args, "--request-count", requestCount);
    appendArg(args, "--quantity", quantity);
    appendArg(args, "--unit", unit);
    appendArg(args, "--prompt-tokens", promptTokens);
    appendArg(args, "--output-tokens", outputTokens);
    appendArg(args, "--cached-tokens", cachedTokens);
    appendArg(args, "--premium-requests", premiumRequests);
    appendArg(args, "--image-count", imageCount);
    appendArg(args, "--cost-usd-estimate", costUsdEstimate);
    appendArg(args, "--run-id", runId);
    appendArg(args, "--stage-run-id", stageRunId);
    if (metadata !== undefined) {
        appendArg(args, "--metadata-json", JSON.stringify(metadata));
    }

    const result = spawnSync(PYTHON_COMMAND, args, {
        cwd: process.cwd(),
        encoding: "utf-8",
    });
    if (result.status !== 0) {
        const stderr = (result.stderr || "").trim();
        const stdout = (result.stdout || "").trim();
        throw new Error(stderr || stdout || "unknown telemetry failure");
    }

    return (result.stdout || "").trim();
}

/**
 * server.mjs — Local HTTP server for the NFL Lab pipeline dashboard.
 *
 * Zero external dependencies. Uses node:http, node:sqlite, node:fs.
 * Run: node dashboard/server.mjs
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";

import { getBoardData, getArticleDetail, readArtifact } from "./data.mjs";
import { boardPage, articlePage, previewPage, notFoundPage } from "./templates.mjs";
import { renderPreview } from "./render.mjs";
import { getValidationResults } from "./validation.mjs";
import { getPublishResults } from "./publish.mjs";

const DEFAULT_PORT = 3456;
const PUBLIC_DIR = resolve(import.meta.dirname, "public");
const REPO_ROOT = resolve(import.meta.dirname, "..");
const VALIDATION_WORKER = join(import.meta.dirname, "validation-worker.mjs");
const PUBLISH_WORKER = join(import.meta.dirname, "publish-worker.mjs");
const validationJobs = new Map();
const publishJobs = new Map();

function parsePortValue(rawValue, sourceLabel) {
    const port = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid ${sourceLabel} port "${rawValue}". Expected an integer between 1 and 65535.`);
    }
    return port;
}

function resolvePort(argv, env) {
    let cliPort = null;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--port" || arg === "-p") {
            const nextValue = argv[index + 1];
            if (!nextValue) {
                throw new Error(`Missing value for ${arg}. Usage: npm run dashboard -- --port 8080`);
            }
            cliPort = nextValue;
            index += 1;
            continue;
        }
        if (arg.startsWith("--port=")) {
            cliPort = arg.slice("--port=".length);
        }
    }

    if (cliPort !== null) {
        return parsePortValue(cliPort, "CLI");
    }

    if (env.DASHBOARD_PORT) {
        return parsePortValue(env.DASHBOARD_PORT, "DASHBOARD_PORT");
    }

    return DEFAULT_PORT;
}

function printStartupBanner(port) {
    console.log(`\n  🏈 NFL Lab Pipeline Dashboard`);
    console.log(`  ────────────────────────────`);
    console.log(`  Local:  http://localhost:${port}/`);
    console.log(`  Board:  http://localhost:${port}/`);
    console.log(`  API:    http://localhost:${port}/api/board\n`);
}

function printPortConflict(port) {
    console.error(`\n  Dashboard could not start.`);
    console.error(`  Port ${port} is already in use.`);
    console.error(`  If the dashboard is already running, open: http://localhost:${port}/`);
    console.error(`  To use a different port, run one of these:`);
    console.error(`    npm run dashboard -- --port 8080`);
    console.error(`    $env:DASHBOARD_PORT=8080; npm run dashboard\n`);
}

let PORT;
try {
    PORT = resolvePort(process.argv.slice(2), process.env);
} catch (err) {
    console.error(`\n  Dashboard could not start.`);
    console.error(`  ${err.message}\n`);
    process.exit(1);
}

// ── MIME types ───────────────────────────────────────────────────────────────

const MIME = {
    ".css": "text/css",
    ".js": "text/javascript",
    ".html": "text/html",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".json": "application/json",
};

// ── Static file serving ──────────────────────────────────────────────────────

function serveStatic(res, filepath, contentType) {
    try {
        const data = readFileSync(filepath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end("Not found");
    }
}

function sendHtml(res, html, status = 200) {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
}

function sendJson(res, data, status = 200) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    if (chunks.length === 0) return {};

    const raw = Buffer.concat(chunks).toString("utf-8").trim();
    if (!raw) return {};

    try {
        return JSON.parse(raw);
    } catch {
        throw new Error("Request body must be valid JSON.");
    }
}

function getMergedValidationResults(slug) {
    const persisted = getValidationResults(slug) || {};
    const running = validationJobs.get(slug) || {};
    return { ...persisted, ...running };
}

function getMergedPublishResults(slug) {
    const persisted = getPublishResults(slug) || {};
    const running = publishJobs.get(slug) || {};
    return { ...persisted, ...running.publish };
}

function startValidationJob(slug, type) {
    const current = validationJobs.get(slug) || {};
    if (current[type]?.status === "RUNNING") {
        return { started: false, state: current[type] };
    }

    current[type] = {
        status: "RUNNING",
        reason: "Validation in progress… this can take 30–60 seconds.",
        timestamp: new Date().toISOString(),
    };
    validationJobs.set(slug, current);

    const child = spawn(process.execPath, [VALIDATION_WORKER, "--slug", slug, "--type", type], {
        cwd: REPO_ROOT,
        windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
    });

    child.on("close", (code) => {
        const jobs = validationJobs.get(slug) || {};
        const markerLine = stdout
            .split(/\r?\n/)
            .find((line) => line.startsWith("__VALIDATION_RESULT__"));

        if (markerLine) {
            try {
                jobs[type] = JSON.parse(markerLine.slice("__VALIDATION_RESULT__".length));
            } catch {
                jobs[type] = {
                    status: "ERROR",
                    error: `Validation result parse failed (exit ${code ?? "?"}).`,
                };
            }
        } else {
            jobs[type] = {
                status: "ERROR",
                error: stderr.trim() || `Validation worker exited without a result (exit ${code ?? "?"}).`,
            };
        }

        jobs[type].timestamp = new Date().toISOString();
        validationJobs.set(slug, jobs);
    });

    return { started: true, state: current[type] };
}

function startPublishJob(slug, channels) {
    const current = publishJobs.get(slug) || {};
    if (current.publish?.status === "RUNNING") {
        return { started: false, state: current.publish };
    }

    current.publish = {
        status: "RUNNING",
        reason: "Publishing live article… this can take 30–90 seconds.",
        requestedChannels: channels,
        timestamp: new Date().toISOString(),
    };
    publishJobs.set(slug, current);

    const child = spawn(process.execPath, [
        PUBLISH_WORKER,
        "--slug",
        slug,
        "--channels",
        channels.join(","),
    ], {
        cwd: REPO_ROOT,
        windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
    });

    child.on("close", (code) => {
        const jobs = publishJobs.get(slug) || {};
        const markerLine = stdout
            .split(/\r?\n/)
            .find((line) => line.startsWith("__PUBLISH_RESULT__"));

        if (markerLine) {
            try {
                jobs.publish = JSON.parse(markerLine.slice("__PUBLISH_RESULT__".length));
            } catch {
                jobs.publish = {
                    status: "ERROR",
                    error: `Publish result parse failed (exit ${code ?? "?"}).`,
                };
            }
        } else {
            jobs.publish = {
                status: "ERROR",
                error: stderr.trim() || `Publish worker exited without a result (exit ${code ?? "?"}).`,
            };
        }

        jobs.publish.timestamp = new Date().toISOString();
        publishJobs.set(slug, jobs);
    });

    return { started: true, state: current.publish };
}

function escapeHtmlBasic(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Routing ──────────────────────────────────────────────────────────────────

async function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = decodeURIComponent(url.pathname);

    // Static files from public/
    if (path.startsWith("/style.css") || path.startsWith("/favicon")) {
        const file = join(PUBLIC_DIR, path === "/style.css" ? "style.css" : "favicon.ico");
        serveStatic(res, file, MIME[extname(file)] || "application/octet-stream");
        return;
    }

    // Serve article images from repo filesystem
    if (path.startsWith("/image/")) {
        const relPath = path.slice("/image/".length);
        const absPath = resolve(REPO_ROOT, relPath.replace(/\//g, "\\"));
        // Safety: ensure path stays within repo
        if (!absPath.startsWith(REPO_ROOT)) {
            res.writeHead(403); res.end("Forbidden"); return;
        }
        const ct = MIME[extname(absPath).toLowerCase()] || "application/octet-stream";
        serveStatic(res, absPath, ct);
        return;
    }

    // API: board data as JSON
    if (path === "/api/board") {
        const board = getBoardData();
        sendJson(res, board);
        return;
    }

    // API: article detail as JSON
    if (path.startsWith("/api/article/")) {
        const slug = path.slice("/api/article/".length);
        const detail = getArticleDetail(slug);
        if (!detail.article && detail.artifacts.length === 0) {
            sendJson(res, { error: "Article not found" }, 404);
        } else {
            sendJson(res, detail);
        }
        return;
    }

    // API: validation results for an article
    if (path.startsWith("/api/validation/") && req.method === "GET") {
        const slug = path.slice("/api/validation/".length);
        const results = getMergedValidationResults(slug);
        sendJson(res, results || {});
        return;
    }

    if (path.startsWith("/api/publish/") && req.method === "GET") {
        const slug = decodeURIComponent(path.slice("/api/publish/".length));
        const results = getMergedPublishResults(slug);
        sendJson(res, results || {});
        return;
    }

    // API: trigger editor validation (POST only, manual action)
    if (path.startsWith("/api/validate/editor/") && req.method === "POST") {
        const slug = decodeURIComponent(path.slice("/api/validate/editor/".length));
        console.log(`[validation] Editor validation triggered for: ${slug}`);
        try {
            const result = startValidationJob(slug, "editor");
            sendJson(res, result.state, result.started ? 202 : 200);
        } catch (err) {
            console.error(`[validation] Editor validation error:`, err);
            sendJson(res, { status: "ERROR", error: err.message }, 500);
        }
        return;
    }

    // API: trigger mobile validation (POST only, manual action)
    if (path.startsWith("/api/validate/mobile/") && req.method === "POST") {
        const slug = decodeURIComponent(path.slice("/api/validate/mobile/".length));
        console.log(`[validation] Mobile validation triggered for: ${slug}`);
        try {
            const result = startValidationJob(slug, "mobile");
            sendJson(res, result.state, result.started ? 202 : 200);
        } catch (err) {
            console.error(`[validation] Mobile validation error:`, err);
            sendJson(res, { status: "ERROR", error: err.message }, 500);
        }
        return;
    }

    if (path.startsWith("/api/publish/") && req.method === "POST") {
        const slug = decodeURIComponent(path.slice("/api/publish/".length));
        console.log(`[publish] Live publish triggered for: ${slug}`);
        try {
            const body = await readJsonBody(req);
            const channels = Array.isArray(body.channels)
                ? body.channels.filter((value) => typeof value === "string")
                : [];
            const result = startPublishJob(slug, channels);
            sendJson(res, result.state, result.started ? 202 : 200);
        } catch (err) {
            console.error(`[publish] Live publish error:`, err);
            sendJson(res, { status: "ERROR", error: err.message }, 500);
        }
        return;
    }

    // Board page
    if (path === "/" || path === "/board") {
        const board = getBoardData();
        sendHtml(res, boardPage(board));
        return;
    }

    // Article detail page
    if (path.startsWith("/article/")) {
        const slug = path.slice("/article/".length);
        const detail = getArticleDetail(slug);
        if (!detail.article && detail.artifacts.length === 0) {
            sendHtml(res, notFoundPage(`Article "${slug}" not found in DB or on disk.`), 404);
        } else {
            detail.validationResults = getMergedValidationResults(slug);
            detail.publishResults = getMergedPublishResults(slug);
            sendHtml(res, articlePage(detail));
        }
        return;
    }

    // Preview page (async: uses canonical ProseMirror pipeline)
    if (path.startsWith("/preview/")) {
        const slug = path.slice("/preview/".length);
        const md = readArtifact(slug, "draft.md");
        if (!md) {
            sendHtml(res, notFoundPage(`No draft.md found for "${slug}".`), 404);
            return;
        }
        const detail = getArticleDetail(slug);
        const dbTitle = detail.article?.title || slug;
        try {
            const preview = await renderPreview(md, { slug });
            const title = preview.title || dbTitle;
            sendHtml(res, previewPage(slug, title, preview.html, preview.warnings, preview.subtitle));
        } catch (err) {
            console.error(`Preview error for ${slug}:`, err);
            sendHtml(res, previewPage(slug, dbTitle,
                `<div class="preview-error"><h2>Preview Error</h2><pre>${escapeHtmlBasic(err.message)}</pre></div>`,
                [{ type: "error", message: err.message }]), 500);
        }
        return;
    }

    // 404
    sendHtml(res, notFoundPage(), 404);
}

// ── Start ────────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
    try {
        await handleRequest(req, res);
    } catch (err) {
        console.error(`Error handling ${req.url}:`, err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal server error");
    }
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        printPortConflict(PORT);
        process.exit(1);
    }
    console.error(`\n  Dashboard could not start.`);
    console.error(`  ${err.name}: ${err.message}\n`);
    process.exit(1);
});

server.listen(PORT, () => {
    printStartupBanner(PORT);
});

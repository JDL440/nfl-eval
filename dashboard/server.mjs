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

const PORT = parseInt(process.env.DASHBOARD_PORT || "3456", 10);
const PUBLIC_DIR = resolve(import.meta.dirname, "public");
const REPO_ROOT = resolve(import.meta.dirname, "..");
const VALIDATION_WORKER = join(import.meta.dirname, "validation-worker.mjs");
const validationJobs = new Map();

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

function getMergedValidationResults(slug) {
    const persisted = getValidationResults(slug) || {};
    const running = validationJobs.get(slug) || {};
    return { ...persisted, ...running };
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

server.listen(PORT, () => {
    console.log(`\n  🏈 NFL Lab Pipeline Dashboard`);
    console.log(`  ────────────────────────────`);
    console.log(`  Local:  http://localhost:${PORT}/`);
    console.log(`  Board:  http://localhost:${PORT}/`);
    console.log(`  API:    http://localhost:${PORT}/api/board\n`);
});

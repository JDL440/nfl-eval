/**
 * Substack Publisher — Copilot CLI Extension
 *
 * Exposes a `publish_to_substack` tool that converts a markdown article file
 * to Substack's ProseMirror format and creates a draft ready for review.
 *
 * Auth: set SUBSTACK_TOKEN to the raw value of your substack.sid cookie
 * (copy it directly from Chrome DevTools → Application → Cookies).
 * Legacy base64-encoded JSON format is still accepted for backwards compatibility.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { recordPipelineUsageEvent } from "../pipeline-telemetry.mjs";
import { loadExtensionEnv, createNoopLogger } from "../shared-env.mjs";

// ─── Config ─────────────────────────────────────────────────────────────────

function loadEnv() {
    return loadExtensionEnv();
}

// ─── Pipeline DB lookup ──────────────────────────────────────────────────────

/**
 * Given an article file path, look up primary_team from content/pipeline.db.
 * Returns e.g. "seahawks" or null if not found / DB unavailable.
 * Uses the built-in node:sqlite module (Node 22+).
 */
async function lookupTeamFromDb(filePath, cwd) {
    const dbPath = resolve(cwd, "content", "pipeline.db");
    if (!existsSync(dbPath)) return null;

    // Normalize to a relative path matching what's stored in article_path
    const normalizedPath = filePath.replace(/\\/g, "/").replace(/^.*?content\//, "content/");

    try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const stmt = db.prepare(
            "SELECT primary_team FROM articles WHERE article_path = ? OR article_path = ?"
        );
        const row = stmt.get(normalizedPath, filePath.replace(/\\/g, "/"));
        db.close();
        return row?.primary_team || null;
    } catch {
        return null;
    }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function makeHeaders(token) {
    // Accept either:
    //   1. Raw substack.sid cookie value (preferred — paste directly from Chrome)
    //   2. Legacy: base64(JSON.stringify({ substack_sid, connect_sid }))
    let substackSid, connectSid;
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        if (decoded.substack_sid) {
            // Legacy base64 JSON format
            substackSid = decoded.substack_sid;
            connectSid = decoded.connect_sid || decoded.substack_sid;
        } else {
            throw new Error("missing substack_sid");
        }
    } catch {
        // Not base64 JSON — treat as raw cookie value
        substackSid = token.trim();
        connectSid = token.trim();
    }
    return {
        Cookie: `substack.sid=${substackSid}; connect.sid=${connectSid}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Origin: "https://substack.com",
        Referer: "https://substack.com/",
    };
}

function extractSubdomain(url) {
    const m =
        url.match(/https?:\/\/([^.]+)\.substack\.com/) ||
        url.match(/@(\w+)/);
    if (m) return m[1];
    throw new Error(
        `Cannot extract subdomain from: "${url}". ` +
        "Expected format: https://yourpub.substack.com"
    );
}

// ─── Substack API ────────────────────────────────────────────────────────────

async function getAuthorId(subdomain, headers) {
    // Publication-scoped profile endpoint (most reliable)
    try {
        const res = await fetch(
            `https://${subdomain}.substack.com/api/v1/user/profile/self`,
            { headers }
        );
        if (res.ok) {
            const data = await res.json();
            if (data.id) return data.id;
        }
    } catch {}
    // Fall back: extract from first post's bylines
    try {
        const res = await fetch(
            `https://${subdomain}.substack.com/api/v1/archive?limit=1`,
            { headers }
        );
        if (res.ok) {
            const posts = await res.json();
            const id = posts[0]?.publishedBylines?.[0]?.id;
            if (id) return id;
        }
    } catch {}
    return null;
}

async function uploadImageToSubstack(subdomain, headers, imagePath, articleDir) {
    const mimeMap = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
    };
    const ext = extname(imagePath).toLowerCase();
    const mime = mimeMap[ext] || "image/jpeg";

    let absPath = /^([A-Za-z]:[\\/]|\/)/.test(imagePath)
        ? imagePath
        : resolve(articleDir, imagePath);

    // Fallback: try resolving relative to cwd (repo root) when article-dir-relative fails.
    // This handles paths like `./images/slug/img.png` written relative to the repo root.
    if (!existsSync(absPath)) {
        const cwdPath = resolve(process.cwd(), imagePath);
        if (existsSync(cwdPath)) {
            absPath = cwdPath;
        } else {
            throw new Error(`Image file not found: ${absPath} (also tried ${cwdPath})`);
        }
    }

    const dataUri = `data:${mime};base64,${readFileSync(absPath).toString("base64")}`;

    const res = await fetch(`https://${subdomain}.substack.com/api/v1/image`, {
        method: "POST",
        headers: {
            ...headers,
            "Content-Type": "application/json",
            Origin: `https://${subdomain}.substack.com`,
            Referer: `https://${subdomain}.substack.com/publish`,
        },
        body: JSON.stringify({ image: dataUri }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Image upload failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.url;
}

// ─── Tags ────────────────────────────────────────────────────────────────────

// NFL team → standard abbreviation (used to identify team-agent files in article dirs)
const NFL_TEAM_ABBREVS = {
    "arizona cardinals": "ari", "atlanta falcons": "atl", "baltimore ravens": "bal",
    "buffalo bills": "buf", "carolina panthers": "car", "chicago bears": "chi",
    "cincinnati bengals": "cin", "cleveland browns": "cle", "dallas cowboys": "dal",
    "denver broncos": "den", "detroit lions": "det", "green bay packers": "gb",
    "houston texans": "hou", "indianapolis colts": "ind", "jacksonville jaguars": "jax",
    "kansas city chiefs": "kc", "las vegas raiders": "lv", "los angeles chargers": "lac",
    "los angeles rams": "lar", "miami dolphins": "mia", "minnesota vikings": "min",
    "new england patriots": "ne", "new orleans saints": "no", "new york giants": "nyg",
    "new york jets": "nyj", "philadelphia eagles": "phi", "pittsburgh steelers": "pit",
    "san francisco 49ers": "sf", "seattle seahawks": "sea", "tampa bay buccaneers": "tb",
    "tennessee titans": "ten", "washington commanders": "was",
};

function getTeamAbbrev(teamName) {
    if (!teamName) return null;
    const lower = teamName.toLowerCase().trim();
    if (NFL_TEAM_ABBREVS[lower]) return NFL_TEAM_ABBREVS[lower];
    for (const [full, abbrev] of Object.entries(NFL_TEAM_ABBREVS)) {
        if (full.includes(lower) || lower.includes(abbrev)) return abbrev;
    }
    return null;
}

/**
 * Scan the article directory for specialist agent artifacts and build a tag list.
 *
 * Tag convention:
 *   - Team tag: the full team name as provided (e.g. "Arizona Cardinals")
 *   - Specialist tags: agent role from filename, title-cased (e.g. "Cap", "Offense", "Defense")
 *
 * Excluded (not specialist artifacts):
 *   discussion-prompt.md, discussion-summary.md, draft.md, draft-section.md
 *
 * The team agent file is identified by its filename starting with the standard
 * NFL abbreviation (e.g. sf-position.md for San Francisco 49ers).
 */
function deriveTagsFromArticleDir(articleDir, teamName) {
    const tags = [];
    if (teamName) tags.push(teamName);

    const EXCLUDED_FILES = new Set([
        "discussion-prompt.md", "discussion-summary.md",
        "draft.md", "draft-section.md",
    ]);

    const teamAbbrev = getTeamAbbrev(teamName);

    try {
        const files = readdirSync(articleDir);
        for (const file of files) {
            if (!file.endsWith(".md")) continue;
            if (EXCLUDED_FILES.has(file)) continue;

            const stem = file.replace(/\.md$/, "");
            // Skip the team agent file (e.g. sf-position.md, ari-panel-response.md)
            if (teamAbbrev && stem.startsWith(teamAbbrev + "-")) continue;

            // Strip known suffixes to extract specialist role name
            const role = stem.replace(/-(position|panel-response|panel)$/, "");
            if (role === stem) continue; // no recognised suffix → not a specialist artifact

            const tag = role.charAt(0).toUpperCase() + role.slice(1);
            if (!tags.includes(tag)) tags.push(tag);
        }
    } catch {
        // Directory may not exist or not be readable (single-file articles)
    }

    return tags;
}

async function createSubstackDraft({ subdomain, headers, title, subtitle, body, audience, tags }) {
    const payload = {
        type: "newsletter",
        audience: audience || "everyone",
        draft_title: title,
        draft_subtitle: subtitle || "",
        draft_body: JSON.stringify(body),
        draft_bylines: [],
        postTags: tags || [],
    };

    const res = await fetch(`https://${subdomain}.substack.com/api/v1/drafts`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Substack API error: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return await res.json();
}

/**
 * Update an existing Substack draft by ID.
 * Uses the same payload shape as create but PUTs to the specific draft endpoint.
 */
async function updateSubstackDraft({ subdomain, headers, draftId, title, subtitle, body, audience, tags }) {
    const payload = {
        audience: audience || "everyone",
        draft_title: title,
        draft_subtitle: subtitle || "",
        draft_body: JSON.stringify(body),
        postTags: tags || [],
    };

    const res = await fetch(`https://${subdomain}.substack.com/api/v1/drafts/${draftId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Substack draft update failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return await res.json();
}

/**
 * Extract a Substack draft ID from a draft editor URL.
 * Accepts: https://subdomain.substack.com/publish/post/191150015
 * Returns: "191150015" or null
 */
function extractDraftIdFromUrl(url) {
    if (!url) return null;
    const m = url.match(/\/publish\/post\/(\d+)/);
    return m ? m[1] : null;
}

/**
 * Look up an article's draft URL and current stage from pipeline.db.
 * Returns { draftUrl, currentStage, status } or null if DB unavailable.
 */
async function lookupArticleStateFromDb(articleSlug, cwd) {
    const dbPath = resolve(cwd, "content", "pipeline.db");
    if (!existsSync(dbPath)) return null;

    try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const stmt = db.prepare(
            "SELECT substack_draft_url, current_stage, status FROM articles WHERE id = ?"
        );
        const row = stmt.get(articleSlug);
        db.close();
        if (!row) return null;
        return {
            draftUrl: row.substack_draft_url || null,
            currentStage: row.current_stage,
            status: row.status,
        };
    } catch {
        return null;
    }
}

// ─── Substack Notes API ──────────────────────────────────────────────────────

/**
 * Look up an article's published URL (and draft URL) from pipeline.db.
 * Returns { substackUrl, substackDraftUrl, currentStage, status } or null.
 */
async function lookupArticleUrlFromDb(articleSlug, cwd) {
    const dbPath = resolve(cwd, "content", "pipeline.db");
    if (!existsSync(dbPath)) return null;

    try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const stmt = db.prepare(
            "SELECT substack_url, substack_draft_url, current_stage, status FROM articles WHERE id = ?"
        );
        const row = stmt.get(articleSlug);
        db.close();
        if (!row) return null;
        return {
            substackUrl: row.substack_url || null,
            substackDraftUrl: row.substack_draft_url || null,
            currentStage: row.current_stage,
            status: row.status,
        };
    } catch {
        return null;
    }
}

/**
 * Convert plain text to ProseMirror JSON suitable for a Substack Note.
 * Notes are plain text — no markdown formatting (bold/italic/headings).
 * Each non-empty line becomes its own paragraph. This is more reliable for
 * Notes than emitting `hard_break` nodes inside a single paragraph.
 *
 * URLs are auto-detected and wrapped in ProseMirror link marks so that
 * Substack can resolve article cards when the URL points to a published
 * /p/ article.
 */
function noteTextToProseMirror(text) {
    const content = [];
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (trimmed === "") continue;
        content.push({ type: "paragraph", content: parseNoteInline(trimmed) });
    }
    if (content.length === 0) {
        content.push({ type: "paragraph", content: [{ type: "text", text: String(text || "") }] });
    }
    return { type: "doc", attrs: { schemaVersion: "v1" }, content };
}

/**
 * Parse a plain-text line into ProseMirror text nodes, auto-linking URLs.
 * Bare URLs (https://...) get a link mark so Substack renders article cards.
 */
function parseNoteInline(line) {
    const urlRe = /(https?:\/\/[^\s<>)"]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = urlRe.exec(line)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: "text", text: line.slice(lastIndex, match.index) });
        }
        parts.push({
            type: "text",
            text: match[1],
            marks: [{ type: "link", attrs: { href: match[1], target: "_blank" } }],
        });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
        parts.push({ type: "text", text: line.slice(lastIndex) });
    }
    return parts.length > 0 ? parts : [{ type: "text", text: line }];
}

/**
 * Register an article URL as a post attachment for Notes card rendering.
 *
 * POST /api/v1/comment/attachment with { url, type: "post" } returns an
 * attachment UUID. Include that UUID in `attachmentIds` when creating the
 * Note to trigger Substack's rich article card (hero image + title + pub).
 *
 * NOT Cloudflare-blocked — works via plain fetch().
 */
async function registerPostAttachment({ articleUrl, subdomain, token }) {
    let substackSid;
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        substackSid = decoded.substack_sid;
    } catch { substackSid = token.trim(); }

    const host = `${subdomain}.substack.com`;
    const resp = await fetch(`https://${host}/api/v1/comment/attachment`, {
        method: "POST",
        headers: {
            Cookie: `substack.sid=${substackSid}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({ url: articleUrl, type: "post" }),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Post attachment registration failed: HTTP ${resp.status} — ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    return data.id; // attachment UUID
}

/**
 * Create a Note on Substack.
 *
 * Endpoint: POST https://{subdomain}.substack.com/api/v1/comment/feed
 * Payload: { bodyJson, tabId: "for-you", surface: "feed", replyMinimumRole: "everyone" }
 *
 * Browser DevTools capture (2025-07-27) confirmed Notes POST uses the
 * PUBLICATION host (same-origin), NOT substack.com globally.
 *
 * Cloudflare Bot Management blocks server-side fetch() for the comment/feed
 * write endpoint. The POST must be made from within a real Chromium page
 * context (Playwright page.evaluate) to pass bot detection.
 *
 * ⚠️  STAGE-GATED: requires NOTES_ENDPOINT_PATH to be set in .env.
 *     Without it, the function throws to prevent accidental posts.
 */
async function createSubstackNote({ bodyJson, subdomain, token, attachmentIds }) {
    const env = loadEnv();
    const endpointPath = process.env.NOTES_ENDPOINT_PATH || env.NOTES_ENDPOINT_PATH;
    if (!endpointPath) {
        throw new Error(
            "Notes API endpoint not configured. " +
            "Set NOTES_ENDPOINT_PATH in .env (e.g. /api/v1/comment/feed). " +
            "See docs/notes-api-discovery.md for details."
        );
    }

    // Default to publication subdomain (same-origin, per browser capture).
    const notesHost = process.env.NOTES_HOST || env.NOTES_HOST || `${subdomain}.substack.com`;
    const url = `https://${notesHost}${endpointPath}`;

    const payload = {
        bodyJson,
        tabId: "for-you",
        surface: "feed",
        replyMinimumRole: "everyone",
        ...(attachmentIds?.length ? { attachmentIds } : {}),
    };

    // Extract raw session cookie for Playwright injection
    let substackSid;
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        substackSid = decoded.substack_sid;
    } catch {
        substackSid = token.trim();
    }

    // Use Playwright to POST from a real browser context (bypasses Cloudflare)
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
        headless: false,
        args: ["--headless=new", "--disable-blink-features=AutomationControlled"],
    });
    try {
        const context = await browser.newContext({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            extraHTTPHeaders: {
                "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
            },
        });
        await context.addCookies([
            {
                name: "substack.sid",
                value: substackSid,
                domain: ".substack.com",
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "None",
            },
        ]);

        const page = await context.newPage();
        await page.goto(`https://${notesHost}/publish/home`, {
            waitUntil: "networkidle",
            timeout: 30000,
        });

        const result = await page.evaluate(
            async ({ url, payload }) => {
                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                    credentials: "same-origin",
                });
                const text = await res.text();
                return { status: res.status, text };
            },
            { url, payload }
        );

        if (result.status >= 400) {
            throw new Error(
                `Notes POST failed: HTTP ${result.status}. ` +
                `URL: ${url}. Response: ${result.text.slice(0, 300)}`
            );
        }

        return JSON.parse(result.text);
    } finally {
        await browser.close();
    }
}

// ─── Shared ProseMirror logic (imported from shared module) ──────────────────
//
// All markdown → ProseMirror parsing, table classification, subscribe-button
// injection, hero-image safety, and validation live in the shared module.
// The extension re-exports what it needs for the handler below.

import {
    markdownToProseMirror,
    ensureSubscribeButtons,
    ensureHeroFirstImage,
    validateProseMirrorBody,
    extractMetaFromMarkdown,
} from "./shared/substack-prosemirror.mjs";

// ─── MCP-exported tool surface ──────────────────────────────────────────────

export const publishToSubstackTool = {
    name: "publish_to_substack",
    description:
        "Publishes a markdown article file to Substack as a draft ready for review and one-click publishing. " +
        "Defaults to PROD target (SUBSTACK_PUBLICATION_URL); use target='stage' only when testing new functionality. " +
        "If a stored draft URL exists in pipeline.db for this article, updates the existing draft instead of creating a new one. " +
        "Hard guard: refuses to operate on already-published articles (Stage 8). " +
        "Reads auth from SUBSTACK_TOKEN in .env, and publication URLs from SUBSTACK_STAGE_URL / SUBSTACK_PUBLICATION_URL. " +
        "Auto-extracts title and subtitle from the markdown if not provided. " +
        "Automatically tags the draft with the team name and any participating specialist agents. " +
        "Returns the Substack editor URL so the author can review and publish.",
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description:
                    "Path to the markdown article file, relative to the repo root " +
                    "(e.g. content/articles/my-article.md)",
            },
            title: {
                type: "string",
                description:
                    "Article headline. If omitted, extracted from the first # heading in the file.",
            },
            subtitle: {
                type: "string",
                description:
                    "Article subheadline. If omitted, extracted from the first *italic* line in the file.",
            },
            audience: {
                type: "string",
                description:
                    'Audience: "everyone" (free, default) or "only_paid" (paid subscribers only).',
                enum: ["everyone", "only_paid"],
            },
            team: {
                type: "string",
                description:
                    "NFL team name to tag on the Substack draft. " +
                    'Full name (e.g. "Seattle Seahawks") or partial (e.g. "Seahawks"). ' +
                    "If omitted, auto-detected from pipeline.db.",
            },
            draft_url: {
                type: "string",
                description:
                    "Existing Substack draft URL to update instead of creating a new draft. " +
                    'Format: "https://subdomain.substack.com/publish/post/DRAFT_ID". ' +
                    "If omitted, auto-detected from pipeline.db substack_draft_url column.",
            },
            target: {
                type: "string",
                description:
                    'Publication target: "prod" (default) publishes directly to production ' +
                    "(SUBSTACK_PUBLICATION_URL). Use target='stage' only when explicitly testing " +
                    "new functionality (e.g. table/mobile rendering changes) on the staging " +
                    "publication (SUBSTACK_STAGE_URL).",
                enum: ["stage", "prod"],
            },
        },
        required: ["file_path"],
    },
};

export const publishNoteToSubstackTool = {
    name: "publish_note_to_substack",
    description:
        "Creates a Note (short-form post) on the target Substack publication. " +
        "Notes appear in the Substack Notes feed and subscriber home feeds. " +
        "Use for article teasers, quick takes, or engagement content. " +
        "Same auth as publish_to_substack (SUBSTACK_TOKEN in .env). " +
        "If article_slug is provided, auto-links to the published article URL. " +
        "Defaults to PROD target; use target='stage' for testing. " +
        "Requires NOTES_ENDPOINT_PATH in .env (set after Phase 0 validation). " +
        "The Notes POST goes to the publication host (same-origin), not substack.com globally.",
    parameters: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description:
                    "Note body text. Plain text — URLs will auto-link. No markdown formatting " +
                    "(Notes don't support bold/italic). Keep concise for engagement.",
            },
            image_path: {
                type: "string",
                description:
                    "Optional path to a local image file to attach to the Note. " +
                    "Uploaded to Substack CDN via the existing image upload endpoint.",
            },
            article_slug: {
                type: "string",
                description:
                    "Optional article slug (pipeline.db id) to link this Note to. " +
                    "If provided, the published article URL is looked up from pipeline.db " +
                    "and appended to the Note body (unless already present in content).",
            },
            target: {
                type: "string",
                description:
                    '"prod" (default) or "stage". Same semantics as publish_to_substack.',
                enum: ["stage", "prod"],
            },
        },
        required: ["content"],
    },
};

export const publishTweetTool = {
    name: "publish_tweet",
    description:
        "Posts a tweet to X (Twitter) to promote an article. " +
        "Uses OAuth 1.0a credentials from .env (TWITTER_API_KEY, TWITTER_API_SECRET, " +
        "TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET). " +
        "If article_slug is provided, auto-links to the published article URL. " +
        "X auto-unfurls Substack URLs into link cards. " +
        "Use target='stage' for dry-run (no tweet posted).",
    parameters: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description:
                    "Tweet body text. Plain text, max 280 characters " +
                    "(URLs count as 23 chars via t.co). Keep concise for engagement.",
            },
            image_path: {
                type: "string",
                description:
                    "Optional path to a local image file to attach to the tweet. " +
                    "Uploaded to Twitter via the media upload endpoint.",
            },
            article_slug: {
                type: "string",
                description:
                    "Optional article slug (pipeline.db id) to link this tweet to. " +
                    "If provided, the published article URL is looked up from pipeline.db " +
                    "and appended to the tweet text.",
            },
            target: {
                type: "string",
                description:
                    '"prod" (default) or "stage". Stage is a dry-run — no tweet is actually posted.',
                enum: ["stage", "prod"],
            },
        },
        required: ["content"],
    },
};

function createToolLogger(context = {}) {
    if (typeof context.log === "function") return context.log;
    return createNoopLogger();
}

export async function handlePublishToSubstack(args, context = {}) {
    const log = createToolLogger(context);

    try {
        const env = loadEnv();
        const token = process.env.SUBSTACK_TOKEN || env.SUBSTACK_TOKEN;
        const target = args.target || "prod";

        let pubUrl;
        if (target === "stage") {
            pubUrl = process.env.SUBSTACK_STAGE_URL || env.SUBSTACK_STAGE_URL;
            if (!pubUrl) {
                pubUrl = process.env.SUBSTACK_PUBLICATION_URL || env.SUBSTACK_PUBLICATION_URL;
                if (pubUrl) {
                    await log("⚠️  SUBSTACK_STAGE_URL not set — falling back to production URL");
                }
            }
        } else {
            pubUrl = process.env.SUBSTACK_PUBLICATION_URL || env.SUBSTACK_PUBLICATION_URL;
        }

        if (!token) {
            return {
                textResultForLlm:
                    "Error: SUBSTACK_TOKEN not found in .env.\n\n" +
                    "Setup: copy the value of your substack.sid cookie from Chrome DevTools → Application → Cookies → substack.com, then set SUBSTACK_TOKEN=<that value> in .env.",
                resultType: "failure",
            };
        }
        if (!pubUrl) {
            return {
                textResultForLlm:
                    `Error: No publication URL found for target="${target}".\n\n` +
                    "Add to .env:\n" +
                    "  SUBSTACK_PUBLICATION_URL=https://yourpub.substack.com    (production)\n" +
                    "  SUBSTACK_STAGE_URL=https://yourpubstage.substack.com     (staging)",
                resultType: "failure",
            };
        }

        const filePath = resolve(process.cwd(), args.file_path);
        if (!existsSync(filePath)) {
            return {
                textResultForLlm: `Error: File not found: ${filePath}`,
                resultType: "failure",
            };
        }
        const markdown = readFileSync(filePath, "utf-8");

        const extracted = extractMetaFromMarkdown(markdown);
        const title = args.title || extracted.title;
        const subtitle = args.subtitle || extracted.subtitle || "";
        const bodyMarkdown = extracted.bodyMarkdown;

        if (!title) {
            return {
                textResultForLlm:
                    "Error: Could not determine article title. " +
                    "Either pass `title` explicitly or add a `# Heading` as the first line of the file.",
                resultType: "failure",
            };
        }

        const headers = makeHeaders(token);
        const subdomain = extractSubdomain(pubUrl);
        await log(`Targeting ${subdomain}.substack.com (${target})…`);

        const pathParts = args.file_path.replace(/\\/g, "/").split("/");
        const draftIdx = pathParts.indexOf("articles");
        let articleSlug = draftIdx >= 0 && draftIdx + 1 < pathParts.length
            ? pathParts[draftIdx + 1]
            : null;
        if (articleSlug && articleSlug.endsWith(".md")) {
            articleSlug = articleSlug.slice(0, -3);
        }

        let existingDraftUrl = args.draft_url || null;
        if (articleSlug) {
            const articleState = await lookupArticleStateFromDb(articleSlug, process.cwd());
            if (articleState) {
                if (articleState.currentStage === 8 || articleState.status === "published") {
                    return {
                        textResultForLlm:
                            `🛑 BLOCKED: Article '${articleSlug}' is already published ` +
                            `(stage=${articleState.currentStage}, status=${articleState.status}). ` +
                            `Cannot update a published article through the draft-update path. ` +
                            `This is a safety guard to prevent overwriting live Substack content.`,
                        resultType: "failure",
                    };
                }
                if (!existingDraftUrl && articleState.draftUrl) {
                    existingDraftUrl = articleState.draftUrl;
                    await log(`Found existing draft URL in pipeline.db: ${existingDraftUrl}`);
                }
            }
        }

        const existingDraftId = extractDraftIdFromUrl(existingDraftUrl);
        const isUpdate = !!existingDraftId;

        let teamName = args.team || null;
        if (!teamName) {
            const dbTeam = await lookupTeamFromDb(args.file_path, process.cwd());
            if (dbTeam) {
                teamName = dbTeam;
                await log(`Auto-detected team from pipeline.db: "${dbTeam}"`);
            }
        }

        const articleDir = dirname(filePath);
        const tags = deriveTagsFromArticleDir(articleDir, teamName);
        await log(`Tags: ${tags.length > 0 ? tags.join(", ") : "(none)"}`);

        await log("Converting article to Substack format…");
        const uploadImage = (localPath) =>
            uploadImageToSubstack(subdomain, headers, localPath, articleDir);
        const body = await markdownToProseMirror(bodyMarkdown, uploadImage);

        ensureSubscribeButtons(body);
        await log("✅ Subscribe buttons enforced (2x subscribe-with-caption)");

        const heroCheck = ensureHeroFirstImage(body);
        if (heroCheck.warning) {
            await log(heroCheck.warning);
        }

        const validation = validateProseMirrorBody(body);
        if (!validation.valid) {
            return {
                textResultForLlm:
                    `🛑 BLOCKED: ProseMirror validation failed — the draft body contains node types ` +
                    `that Substack's editor may not recognize:\n\n` +
                    validation.issues.map(i => `  • ${i}`).join("\n") +
                    `\n\nThis would cause a \"RangeError: Unknown node type\" when opening the draft. ` +
                    `Fix the markdown or the conversion logic before retrying.`,
                resultType: "failure",
            };
        }

        let draft;
        let draftUrl;
        if (isUpdate) {
            await log(`Updating existing draft ${existingDraftId}…`);
            draft = await updateSubstackDraft({
                subdomain,
                headers,
                draftId: existingDraftId,
                title,
                subtitle,
                body,
                audience: args.audience || "everyone",
                tags,
            });
            draftUrl = existingDraftUrl;
        } else {
            await log("Creating new draft on Substack…");
            draft = await createSubstackDraft({
                subdomain,
                headers,
                title,
                subtitle,
                body,
                audience: args.audience || "everyone",
                tags,
            });
            draftUrl = `https://${subdomain}.substack.com/publish/post/${draft.id}`;
        }

        const writebackBlock = articleSlug
            ? isUpdate
                ? `\n**⚡ DB Writeback required (draft URL refresh):**\n` +
                  "```python\n" +
                  `from content.pipeline_state import PipelineState\n` +
                  `with PipelineState() as ps:\n` +
                  `    ps.set_draft_url('${articleSlug}', '${draftUrl}')\n` +
                  "```\n"
                : `\n**⚡ DB Writeback required (Stage 7 + draft URL):**\n` +
                  "```python\n" +
                  `from content.pipeline_state import PipelineState\n` +
                  `with PipelineState() as ps:\n` +
                  `    ps.advance_stage('${articleSlug}', from_stage=6, to_stage=7, agent='Publisher', notes='Draft: ${draftUrl}')\n` +
                  `    ps.set_draft_url('${articleSlug}', '${draftUrl}')\n` +
                  "```\n"
            : "";

        let telemetryWarningBlock = "";
        if (articleSlug) {
            try {
                recordPipelineUsageEvent({
                    articleId: articleSlug,
                    stage: 7,
                    surface: "publish_to_substack",
                    provider: "substack",
                    actor: "publish_to_substack",
                    eventType: isUpdate ? "updated" : "completed",
                    modelOrTool: "substack_publisher",
                    requestCount: 1,
                    quantity: 1,
                    unit: "draft",
                    metadata: {
                        audience: args.audience || "everyone",
                        draft_id: isUpdate ? existingDraftId : draft.id,
                        draft_url: draftUrl,
                        file_path: args.file_path,
                        is_update: isUpdate,
                        tag_count: tags.length,
                        target,
                        target_subdomain: subdomain,
                    },
                });
            } catch (telemetryErr) {
                telemetryWarningBlock = `\n⚠️ Telemetry warning: ${telemetryErr.message}\n`;
            }
        }

        const actionWord = isUpdate ? "updated" : "created";
        const targetLabel = target === "prod" ? "🔴 PRODUCTION" : "🟡 STAGE";
        const heroWarningBlock = heroCheck.warning ? `\n${heroCheck.warning}\n` : "";
        return (
            `✅ Substack draft ${actionWord}!\n\n` +
            `**Target:** ${targetLabel} (${subdomain}.substack.com)\n` +
            `**Mode:** ${isUpdate ? "UPDATE (existing draft)" : "CREATE (new draft)"}\n` +
            `**Title:** ${title}\n` +
            `**Subtitle:** ${subtitle || "(none)"}\n` +
            `**Audience:** ${args.audience || "everyone"}\n` +
            `**Tags:** ${tags.length > 0 ? tags.join(", ") : "(none)"}\n` +
            `**Draft ID:** ${isUpdate ? existingDraftId : draft.id}\n` +
            (articleSlug ? `**Article slug:** ${articleSlug}\n` : "") +
            `**Subscribe buttons:** 2x subscribe-with-caption injected\n` +
            heroWarningBlock +
            telemetryWarningBlock +
            `\n**Review & publish:** ${draftUrl}\n` +
            writebackBlock +
            `\nOpen the URL above to review formatting, add a cover image, and publish.`
        );
    } catch (err) {
        return {
            textResultForLlm: `Error publishing to Substack: ${err.message}`,
            resultType: "failure",
        };
    }
}

export async function handlePublishNoteToSubstack(args, context = {}) {
    const log = createToolLogger(context);

    try {
        const env = loadEnv();
        const token = process.env.SUBSTACK_TOKEN || env.SUBSTACK_TOKEN;
        const target = args.target || "prod";

        let pubUrl;
        if (target === "stage") {
            pubUrl = process.env.SUBSTACK_STAGE_URL || env.SUBSTACK_STAGE_URL;
            if (!pubUrl) {
                pubUrl = process.env.SUBSTACK_PUBLICATION_URL || env.SUBSTACK_PUBLICATION_URL;
                if (pubUrl) {
                    await log("⚠️  SUBSTACK_STAGE_URL not set — falling back to production URL");
                }
            }
        } else {
            pubUrl = process.env.SUBSTACK_PUBLICATION_URL || env.SUBSTACK_PUBLICATION_URL;
        }

        if (!token) {
            return {
                textResultForLlm:
                    "Error: SUBSTACK_TOKEN not found in .env.\n\n" +
                    "Setup: copy the value of your substack.sid cookie from Chrome DevTools → Application → Cookies → substack.com, then set SUBSTACK_TOKEN=<that value> in .env.",
                resultType: "failure",
            };
        }
        if (!pubUrl) {
            return {
                textResultForLlm:
                    `Error: No publication URL found for target="${target}".\n\n` +
                    "Add to .env:\n" +
                    "  SUBSTACK_PUBLICATION_URL=https://yourpub.substack.com    (production)\n" +
                    "  SUBSTACK_STAGE_URL=https://yourpubstage.substack.com     (staging)",
                resultType: "failure",
            };
        }

        const headers = makeHeaders(token);
        const subdomain = extractSubdomain(pubUrl);
        await log(`Targeting ${subdomain}.substack.com (${target}) for Note…`);

        let linkedArticleUrl = null;
        if (args.article_slug) {
            const articleInfo = await lookupArticleUrlFromDb(args.article_slug, process.cwd());
            if (!articleInfo) {
                return {
                    textResultForLlm:
                        `Error: Article '${args.article_slug}' not found in pipeline.db. ` +
                        "Verify the slug is correct, or omit article_slug for a standalone Note.",
                    resultType: "failure",
                };
            }

            if (articleInfo.substackUrl) {
                linkedArticleUrl = articleInfo.substackUrl;
            } else if (target === "stage" && articleInfo.substackDraftUrl) {
                linkedArticleUrl = articleInfo.substackDraftUrl;
                await log(`⚠️  No published URL for '${args.article_slug}' — using draft URL for stage testing.`);
            } else {
                return {
                    textResultForLlm:
                        `Error: Article '${args.article_slug}' has no published URL (substack_url is empty, ` +
                        `current_stage=${articleInfo.currentStage}, status=${articleInfo.status}). ` +
                        `Notes should link to published articles. ` +
                        (target === "prod"
                            ? "Publish the article first, or omit article_slug for a standalone Note."
                            : "For stage testing, ensure a draft URL exists in pipeline.db."),
                    resultType: "failure",
                };
            }
            await log(`Linked article URL: ${linkedArticleUrl}`);
        }

        if (!args.content || !args.content.trim()) {
            return {
                textResultForLlm:
                    "Error: Note content cannot be empty or whitespace-only.",
                resultType: "failure",
            };
        }

        const noteType = args.article_slug ? "promotion" : "standalone";
        let noteBody = args.content;

        if (linkedArticleUrl && !noteBody.includes(linkedArticleUrl)) {
            noteBody = noteBody.trimEnd() + "\n\n" + linkedArticleUrl;
        }

        let imageUrl = null;
        let imagePath = null;
        if (args.image_path) {
            imagePath = /^([A-Za-z]:[\\/]|\/)/.test(args.image_path)
                ? args.image_path
                : resolve(process.cwd(), args.image_path);
            if (!existsSync(imagePath)) {
                return {
                    textResultForLlm:
                        `Error: Image file not found: ${imagePath}`,
                    resultType: "failure",
                };
            }
            await log(`Image validated (upload deferred until Notes smoke test passes): ${imagePath}`);
        }

        const bodyJson = noteTextToProseMirror(noteBody);

        const attachmentIds = [];
        if (linkedArticleUrl && /substack\.com\/p\//.test(linkedArticleUrl)) {
            try {
                await log("Registering article as post attachment for card rendering…");
                const attId = await registerPostAttachment({ articleUrl: linkedArticleUrl, subdomain, token });
                attachmentIds.push(attId);
                await log(`Post attachment registered: ${attId}`);
            } catch (attErr) {
                await log(`⚠️ Post attachment registration failed (Note will post without card): ${attErr.message}`);
            }
        }

        try {
            await log("Attempting to post Note…");
            const noteResult = await createSubstackNote({ bodyJson, subdomain, token, attachmentIds });

            const noteId = noteResult?.id || noteResult?.comment?.id || null;
            const noteUrl = noteResult?.url || noteResult?.canonical_url || null;
            const targetLabel = target === "prod" ? "🔴 PRODUCTION" : "🟡 STAGE";
            const writebackBlock =
                `\n**⚡ DB Writeback required (record Note):**\n` +
                "```python\n" +
                `from content.pipeline_state import PipelineState\n` +
                `with PipelineState() as ps:\n` +
                `    ps.record_note(` +
                `${args.article_slug ? `'${args.article_slug}'` : "None"}, ` +
                `'${noteType}', ` +
                `${JSON.stringify(noteBody)}, ` +
                `${noteUrl ? JSON.stringify(noteUrl) : "None"}, ` +
                `target='${target}', agent='Publisher', ` +
                `${imagePath ? `image_path=${JSON.stringify(imagePath)}` : "image_path=None"})\n` +
                "```\n";
            return (
                `✅ Substack Note posted!\n\n` +
                `**Target:** ${targetLabel} (${subdomain}.substack.com)\n` +
                (noteId ? `**Note ID:** ${noteId}\n` : "") +
                (noteUrl ? `**Note URL:** ${noteUrl}\n` : "") +
                `**Note type:** ${noteType}\n` +
                (linkedArticleUrl ? `**Linked article:** ${linkedArticleUrl}\n` : "") +
                (imageUrl ? `**Attached image:** ${imageUrl}\n` : "") +
                `**Content preview:** ${args.content.slice(0, 150)}${args.content.length > 150 ? "…" : ""}\n` +
                (args.article_slug ? `**Article slug:** ${args.article_slug}\n` : "") +
                writebackBlock +
                `\nThe Note should now be visible in the Substack Notes feed for ${subdomain}.`
            );
        } catch (gateErr) {
            const targetLabel = target === "prod" ? "🔴 PRODUCTION" : "🟡 STAGE";
            return {
                textResultForLlm:
                    `⛔ Notes POST failed — ${gateErr.message}\n\n` +
                    `All inputs validated successfully. Dry-run summary:\n\n` +
                    `**Target:** ${targetLabel} (${subdomain}.substack.com)\n` +
                    `**Note type:** ${noteType}\n` +
                    (linkedArticleUrl ? `**Linked article:** ${linkedArticleUrl}\n` : "") +
                    (imagePath ? `**Image (local, upload deferred):** ${imagePath}\n` : "") +
                    `**Content preview:** ${args.content.slice(0, 200)}${args.content.length > 200 ? "…" : ""}\n` +
                    `**ProseMirror paragraphs:** ${bodyJson.content.length}\n` +
                    (args.article_slug ? `**Article slug:** ${args.article_slug}\n` : "") +
                    `\nIf NOTES_ENDPOINT_PATH is not set, add it to .env (e.g. /api/v1/comment/feed). ` +
                    `See docs/notes-api-discovery.md.`,
                resultType: "failure",
            };
        }
    } catch (err) {
        return {
            textResultForLlm: `Error in publish_note_to_substack: ${err.message}`,
            resultType: "failure",
        };
    }
}

export async function handlePublishTweet(args, context = {}) {
    const log = createToolLogger(context);

    try {
        const { loadTwitterCredentials, postTweet, uploadMediaForTweet, buildPromotionTweetText }
            = await import("./shared/twitter-client.mjs");

        const creds = loadTwitterCredentials(process.cwd());
        if (!creds.valid) {
            return {
                textResultForLlm:
                    `Error: Missing Twitter credentials in .env: ${creds.missing.join(", ")}.\n\n` +
                    "Setup:\n" +
                    "  1. Go to https://developer.x.com/portal/dashboard\n" +
                    "  2. Create a project + app with Read and Write permissions\n" +
                    "  3. Generate OAuth 1.0a tokens\n" +
                    "  4. Add to .env:\n" +
                    "     TWITTER_API_KEY=<consumer key>\n" +
                    "     TWITTER_API_SECRET=<consumer secret>\n" +
                    "     TWITTER_ACCESS_TOKEN=<access token>\n" +
                    "     TWITTER_ACCESS_TOKEN_SECRET=<access token secret>",
                resultType: "failure",
            };
        }

        const target = args.target || "prod";

        let linkedArticleUrl = null;
        if (args.article_slug) {
            const articleInfo = await lookupArticleUrlFromDb(args.article_slug, process.cwd());
            if (!articleInfo) {
                return {
                    textResultForLlm:
                        `Error: Article '${args.article_slug}' not found in pipeline.db. ` +
                        "Verify the slug is correct, or omit article_slug for a standalone tweet.",
                    resultType: "failure",
                };
            }
            if (!articleInfo.substackUrl) {
                return {
                    textResultForLlm:
                        `Error: Article '${args.article_slug}' has no published URL ` +
                        `(current_stage=${articleInfo.currentStage}, status=${articleInfo.status}). ` +
                        "Publish the article first, or omit article_slug for a standalone tweet.",
                    resultType: "failure",
                };
            }
            linkedArticleUrl = articleInfo.substackUrl;
            await log(`Linked article URL: ${linkedArticleUrl}`);
        }

        if (!args.content || !args.content.trim()) {
            return {
                textResultForLlm: "Error: Tweet content cannot be empty or whitespace-only.",
                resultType: "failure",
            };
        }

        const tweetText = linkedArticleUrl
            ? buildPromotionTweetText(args.content, linkedArticleUrl)
            : args.content.trim();

        const noteType = args.article_slug ? "twitter_promotion" : "twitter_standalone";

        // Stage = dry-run
        if (target === "stage") {
            return (
                `🟡 DRY-RUN — Tweet NOT sent (target=stage)\n\n` +
                `**Tweet text (${tweetText.length} chars):**\n${tweetText}\n\n` +
                `**Tweet type:** ${noteType}\n` +
                (linkedArticleUrl ? `**Linked article:** ${linkedArticleUrl}\n` : "") +
                (args.image_path ? `**Image:** ${args.image_path}\n` : "") +
                (args.article_slug ? `**Article slug:** ${args.article_slug}\n` : "")
            );
        }

        // Upload image if provided
        const mediaIds = [];
        if (args.image_path) {
            const absPath = /^([A-Za-z]:[\\/]|\/)/.test(args.image_path)
                ? args.image_path
                : resolve(process.cwd(), args.image_path);
            if (!existsSync(absPath)) {
                return {
                    textResultForLlm: `Error: Image file not found: ${absPath}`,
                    resultType: "failure",
                };
            }
            await log("Uploading image to Twitter…");
            const mediaId = await uploadMediaForTweet(absPath, creds);
            mediaIds.push(mediaId);
            await log(`Media uploaded: ${mediaId}`);
        }

        // Post the tweet
        await log("Posting tweet…");
        const result = await postTweet({ text: tweetText, creds, mediaIds });

        const targetLabel = "🔴 PRODUCTION";
        const writebackBlock =
            `\n**⚡ DB Writeback required (record tweet):**\n` +
            "```python\n" +
            `from content.pipeline_state import PipelineState\n` +
            `with PipelineState() as ps:\n` +
            `    ps.record_note(` +
            `${args.article_slug ? `'${args.article_slug}'` : "None"}, ` +
            `'${noteType}', ` +
            `${JSON.stringify(tweetText)}, ` +
            `${result.tweetUrl ? JSON.stringify(result.tweetUrl) : "None"}, ` +
            `target='${target}', agent='Publisher')\n` +
            "```\n";

        return (
            `✅ Tweet posted!\n\n` +
            `**Target:** ${targetLabel}\n` +
            `**Tweet ID:** ${result.tweetId}\n` +
            (result.tweetUrl ? `**Tweet URL:** ${result.tweetUrl}\n` : "") +
            `**Tweet type:** ${noteType}\n` +
            (linkedArticleUrl ? `**Linked article:** ${linkedArticleUrl}\n` : "") +
            `**Content preview:** ${args.content.slice(0, 150)}${args.content.length > 150 ? "…" : ""}\n` +
            (args.article_slug ? `**Article slug:** ${args.article_slug}\n` : "") +
            writebackBlock +
            `\nThe tweet should now be visible on X/Twitter.`
        );
    } catch (err) {
        return {
            textResultForLlm: `Error in publish_tweet: ${err.message}`,
            resultType: "failure",
        };
    }
}

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

import { approveAll } from "@github/copilot-sdk";
import { joinSession } from "@github/copilot-sdk/extension";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { homedir } from "node:os";

// ─── Config ─────────────────────────────────────────────────────────────────

function loadEnv() {
    const candidates = [
        resolve(process.cwd(), ".env"),
        resolve(homedir(), ".config", "postcli", ".env"),
    ];
    const env = {};
    for (const p of candidates) {
        if (!existsSync(p)) continue;
        const text = readFileSync(p, "utf-8");
        for (const line of text.split("\n")) {
            const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
            if (!m || line.trimStart().startsWith("#")) continue;
            env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
        break;
    }
    return env;
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

// ─── Markdown → ProseMirror ──────────────────────────────────────────────────

/**
 * Convert markdown to Substack's ProseMirror JSON format.
 *
 * Supported markdown syntax:
 *   # / ## / ###          → headings
 *   ---                   → horizontal rule
 *   > text                → blockquote
 *   | col | col |         → table (with optional --- separator row)
 *   - item / * item       → unordered list
 *   1. item               → ordered list
 *   ![alt](url)           → captionedImage (external URL, any caption after pipe: ![alt|caption](url))
 *   ![alt](url "caption") → captionedImage with caption
 *   ::youtube VIDEO_ID    → YouTube embed (custom syntax)
 *   ::youtube https://youtu.be/VIDEO_ID or https://youtube.com/watch?v=VIDEO_ID
 *   **bold**, *italic*, ***both***, [text](url)
 */
async function markdownToProseMirror(markdown, uploadImage) {
    // Strip HTML comments (writer/editor notes, TODOs, internal markup) before parsing
    markdown = markdown.replace(/<!--[\s\S]*?-->/g, "");

    // Normalize line endings (handles Windows CRLF)
    const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const content = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Empty line
        if (trimmed === "") { i++; continue; }

        // Heading: # ## ###
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
            content.push({
                type: "heading",
                attrs: { level: headingMatch[1].length },
                content: parseInline(headingMatch[2]),
            });
            i++;
            continue;
        }

        // Horizontal rule (--- or *** or ___ on its own line, NOT a table separator)
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            content.push({ type: "horizontal_rule" });
            i++;
            continue;
        }

        // YouTube embed: ::youtube VIDEO_ID or ::youtube URL
        const ytLine = trimmed.match(/^::youtube\s+(.+)$/i);
        if (ytLine) {
            const videoId = extractYouTubeId(ytLine[1].trim());
            if (videoId) {
                content.push({ type: "youtube2", attrs: { videoId, startTime: null, endTime: null } });
            }
            i++;
            continue;
        }

        // Standalone image line: ![alt](url) or ![alt|caption](url) or ![alt](url "caption")
        const imgLine = trimmed.match(/^!\[([^\]]*)\]\(([^)"]+?)(?:\s+"([^"]*)")?\)$/);
        if (imgLine) {
            const [, altRaw, rawSrc, titleAttr] = imgLine;
            const pipeIdx = altRaw.indexOf("|");
            const alt = pipeIdx >= 0 ? altRaw.slice(0, pipeIdx).trim() : altRaw.trim();
            const caption = titleAttr || (pipeIdx >= 0 ? altRaw.slice(pipeIdx + 1).trim() : "");

            // Auto-upload local files; pass remote URLs through as-is
            let src = rawSrc;
            if (uploadImage && !/^https?:\/\//i.test(rawSrc)) {
                try {
                    src = await uploadImage(rawSrc);
                } catch (e) {
                    // Keep original path and let Substack handle it (likely won't render, but don't crash)
                    src = rawSrc;
                }
            }
            content.push(buildCaptionedImage(src, alt, caption));
            i++;
            continue;
        }

        // Blockquote: collect consecutive > lines
        if (trimmed.startsWith("> ")) {
            const bqLines = [];
            while (i < lines.length && lines[i].trimStart().startsWith("> ")) {
                bqLines.push(lines[i].replace(/^\s*>\s?/, ""));
                i++;
            }
            const normalizedBqLines = bqLines.map((l) => l.trim()).filter((l) => l !== "");
            const firstBqLine = normalizedBqLines[0] || "";
            const remainingBqLines = normalizedBqLines.slice(1);
            const isTldrBlock =
                /TLDR/i.test(firstBqLine.replace(/\*/g, "")) &&
                remainingBqLines.length > 0 &&
                remainingBqLines.every((l) => /^[-*+]\s+/.test(l));

            if (isTldrBlock) {
                content.push({
                    type: "paragraph",
                    content: parseInline(firstBqLine),
                });
                content.push({
                    type: "bullet_list",
                    content: remainingBqLines.map((t) => ({
                        type: "list_item",
                        content: [{
                            type: "paragraph",
                            content: parseInline(t.replace(/^[-*+]\s+/, "")),
                        }],
                    })),
                });
                continue;
            }
            content.push({
                type: "blockquote",
                content: [{ type: "paragraph", content: parseInline(bqLines.join(" ")) }],
            });
            continue;
        }

        // Table (rows starting with |)
        if (trimmed.startsWith("|")) {
            const tableStartLine = i + 1;
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) {
                tableLines.push(lines[i]);
                i++;
            }
            const parsedTable = parseMarkdownTableLines(tableLines);
            assertInlineTableAllowed(parsedTable, tableStartLine);
            const table = parseTable(parsedTable);
            if (table) {
                if (Array.isArray(table)) content.push(...table);
                else content.push(table);
            }
            continue;
        }

        // Unordered list: - or * or + bullet
        if (/^[-*+]\s/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*+]\s/, ""));
                i++;
            }
            content.push({
                type: "bullet_list",
                content: items.map((t) => ({
                    type: "list_item",
                    content: [{ type: "paragraph", content: parseInline(t) }],
                })),
            });
            continue;
        }

        // Ordered list: 1. 2. etc.
        if (/^\d+\.\s/.test(trimmed)) {
            const items = [];
            let start = parseInt(trimmed.match(/^(\d+)\./)[1], 10);
            while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+\.\s/, ""));
                i++;
            }
            content.push({
                type: "ordered_list",
                attrs: { start, order: start, type: null },
                content: items.map((t) => ({
                    type: "list_item",
                    content: [{ type: "paragraph", content: parseInline(t) }],
                })),
            });
            continue;
        }

        // Paragraph: collect consecutive non-special lines
        const paraLines = [];
        while (
            i < lines.length &&
            lines[i].trim() !== "" &&
            !/^#{1,3}\s/.test(lines[i].trim()) &&
            !lines[i].trim().startsWith("> ") &&
            !lines[i].trim().startsWith("|") &&
            !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
            !/^::youtube\s/i.test(lines[i].trim()) &&
            !/^\s*[-*+]\s/.test(lines[i]) &&
            !/^\s*\d+\.\s/.test(lines[i]) &&
            !/^!\[[^\]]*\]\(/.test(lines[i].trim())
        ) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            content.push({
                type: "paragraph",
                content: parseInline(paraLines.join(" ")),
            });
        }
    }

    return { type: "doc", attrs: { schemaVersion: "v1" }, content };
}

function buildCaptionedImage(src, alt, caption) {
    const imageNode = {
        type: "image2",
        attrs: {
            src,
            alt: alt || null,
            title: caption || null,
            srcNoWatermark: null,
            fullscreen: null,
            imageSize: "normal",
            height: null,
            width: null,
            resizeWidth: null,
            bytes: null,
            type: null,
            href: null,
            belowTheFold: false,
            topImage: false,
            internalRedirect: null,
            isProcessing: false,
            align: null,
            offset: false,
        },
    };
    const captionedContent = [imageNode];
    return { type: "captionedImage", attrs: {}, content: captionedContent };
}

function extractYouTubeId(input) {
    // Already an ID (11 chars, no slashes)
    if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
    // youtu.be/ID
    const short = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (short) return short[1];
    // youtube.com/watch?v=ID
    const long = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (long) return long[1];
    return null;
}

function parseInline(text) {
    const parts = [];
    // Order matters: bold+italic first, then bold, then italic, then links
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
        }
        if (match[2]) {
            // ***bold+italic***
            parts.push({
                type: "text",
                text: match[2],
                marks: [{ type: "bold" }, { type: "italic" }],
            });
        } else if (match[3]) {
            // **bold**
            parts.push({ type: "text", text: match[3], marks: [{ type: "bold" }] });
        } else if (match[4]) {
            // *italic*
            parts.push({ type: "text", text: match[4], marks: [{ type: "italic" }] });
        } else if (match[5]) {
            // _italic_
            parts.push({ type: "text", text: match[5], marks: [{ type: "italic" }] });
        } else if (match[6] && match[7]) {
            // [link text](url)
            parts.push({
                type: "text",
                text: match[6],
                marks: [{ type: "link", attrs: { href: match[7], target: "_blank" } }],
            });
        }
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: "text", text: text.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: "text", text: text || " " }];
}

function buildParagraph(content) {
    return {
        type: "paragraph",
        content: content.length > 0 ? content : [{ type: "text", text: " " }],
    };
}

function stripTableMarkdown(value) {
    return String(value || "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/(^|[\s(])_([^_\n]+)_(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
        .trim();
}

function normalizeTableHeader(value) {
    return stripTableMarkdown(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isDetailTableHeader(value) {
    const normalized = normalizeTableHeader(value);
    return /^(current state|severity|status|budget|aav|year 1 cap hit|cap hit|comp range|draft range|profile|school|notes?)$/.test(normalized);
}

function isDenseTableHeader(value) {
    const normalized = normalizeTableHeader(value);
    return (
        /^(aav|budget|range|comp range|comparison range|draft range|cap hit|year \d+ cap hit|dead cap|cash|cost|price|bonus|guaranteed|guaranteed money|signing bonus)$/.test(normalized) ||
        normalized.includes("cap hit") ||
        normalized.includes("dead cap") ||
        normalized.includes("comp range") ||
        normalized.includes("comparison range") ||
        normalized.endsWith(" range")
    );
}

function splitMarkdownTableRow(line) {
    let working = String(line || "").trim();
    if (working.startsWith("|")) working = working.slice(1);
    if (working.endsWith("|")) working = working.slice(0, -1);

    const cells = [];
    let current = "";

    for (let i = 0; i < working.length; i++) {
        const char = working[i];
        const next = working[i + 1];

        if (char === "\\" && (next === "|" || next === "\\")) {
            current += next;
            i += 1;
            continue;
        }

        if (char === "|") {
            cells.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    cells.push(current.trim());
    return cells;
}

function isMarkdownTableSeparatorRow(row) {
    return row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(String(cell || "").trim()));
}

function normalizeTableCells(row, length, fill = "") {
    return Array.from({ length }, (_, index) => row[index] ?? fill);
}

function parseMarkdownTableLines(lines) {
    const tableLines = lines
        .map((line) => String(line || "").trim())
        .filter(Boolean)
        .filter((line) => line.startsWith("|"));

    if (tableLines.length === 0) return null;

    const rawRows = tableLines.map(splitMarkdownTableRow);
    const hasSeparator = rawRows.length > 1 && isMarkdownTableSeparatorRow(rawRows[1]);
    const headerRow = rawRows[0];
    const bodyRows = rawRows
        .slice(hasSeparator ? 2 : 1)
        .filter((row) => row.some((cell) => stripTableMarkdown(cell) !== ""));
    const columnCount = Math.max(headerRow.length, ...bodyRows.map((row) => row.length), 0);

    return {
        headerRow: normalizeTableCells(headerRow, columnCount),
        bodyRows: bodyRows.map((row) => normalizeTableCells(row, columnCount)),
        columnCount,
        rowCount: bodyRows.length,
    };
}

function looksNumericTableCell(value) {
    const normalized = stripTableMarkdown(value)
        .replace(/[$,%~≈]/g, "")
        .replace(/[()]/g, "")
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, "")
        .replace(/m$/i, "")
        .replace(/aav$/i, "");

    return normalized !== "" && /^[-+]?\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$/.test(normalized);
}

function classifyMarkdownTableForInline(table) {
    if (!table) return { allowInline: true };

    const normalizedHeaders = table.headerRow.map(normalizeTableHeader);
    const firstHeader = normalizedHeaders[0] || "";
    const orderedRowCount = table.bodyRows.filter((row) => /^\d+$/.test((row[0] || "").trim())).length;
    const looksOrdered =
        /^(priority|rank|ranking|order|no|number)$/.test(firstHeader) ||
        (table.rowCount > 0 && (orderedRowCount / table.rowCount) >= 0.8);
    const checklistHeaderCount = normalizedHeaders.filter((header) => isDetailTableHeader(header)).length;
    const denseHeaders = [...new Set(table.headerRow.filter((header) => isDenseTableHeader(header)))];
    const nonEmptyCells = table.bodyRows
        .flat()
        .map((cell) => stripTableMarkdown(cell))
        .filter((cell) => cell !== "");
    const totalCellLength = nonEmptyCells.reduce((sum, cell) => sum + cell.length, 0);
    const avgCellLength = nonEmptyCells.length > 0 ? totalCellLength / nonEmptyCells.length : 0;
    const maxCellLength = nonEmptyCells.length > 0 ? Math.max(...nonEmptyCells.map((cell) => cell.length)) : 0;

    const numericComparisonColumns = table.headerRow.reduce((count, _, index) => {
        if (looksOrdered && index === 0) return count;

        const columnValues = table.bodyRows
            .map((row) => stripTableMarkdown(row[index] || ""))
            .filter((value) => value !== "" && value !== "—");

        if (columnValues.length === 0) return count;

        const numericRatio = columnValues.filter(looksNumericTableCell).length / columnValues.length;
        return count + (numericRatio >= 0.6 ? 1 : 0);
    }, 0);

    const densityScore =
        table.columnCount +
        (numericComparisonColumns * 2) +
        (denseHeaders.length * 2.5) +
        (Math.max(0, avgCellLength - 18) / 12) +
        (Math.max(0, maxCellLength - 72) / 24);

    const isLabelValueTable = table.columnCount <= 2;
    const isChecklistTable =
        table.columnCount <= 4 &&
        (looksOrdered || checklistHeaderCount > 0) &&
        denseHeaders.length === 0 &&
        numericComparisonColumns <= 1 &&
        avgCellLength <= 70;
    const isShortScannableTable =
        table.columnCount <= 3 &&
        denseHeaders.length === 0 &&
        numericComparisonColumns <= 1 &&
        avgCellLength <= 32 &&
        maxCellLength <= 90;

    return {
        allowInline:
            isLabelValueTable ||
            isChecklistTable ||
            isShortScannableTable ||
            densityScore < 7.5,
        densityScore,
        avgCellLength,
        numericComparisonColumns,
        denseHeaders,
    };
}

function assertInlineTableAllowed(table, lineNumber) {
    const classification = classifyMarkdownTableForInline(table);
    if (classification.allowInline) return;

    const reasons = [];
    if (table.columnCount >= 5) reasons.push(`${table.columnCount} columns`);
    if (classification.denseHeaders.length > 0) {
        reasons.push(`comparison/finance headers like ${classification.denseHeaders.map((header) => `"${header}"`).join(", ")}`);
    }
    if (classification.numericComparisonColumns >= 2) {
        reasons.push(`${classification.numericComparisonColumns} numeric comparison columns`);
    }
    if (classification.avgCellLength >= 36) {
        reasons.push(`average cell length of ${Math.round(classification.avgCellLength)} characters`);
    }
    if (reasons.length === 0) {
        reasons.push(`density score ${classification.densityScore.toFixed(1)}`);
    }

    const headerPreview = table.headerRow
        .map((header) => stripTableMarkdown(header))
        .filter(Boolean)
        .slice(0, 4)
        .join(" | ");

    throw new Error(
        `Dense markdown table blocked near body line ${lineNumber}${headerPreview ? ` (${headerPreview})` : ""}. ` +
        `Substack's inline list conversion would likely lose layout meaning (${reasons.join(", ")}). ` +
        "Render it with render_table_image first, then replace the markdown table with the returned image markdown before publishing."
    );
}

function buildLabeledTableParagraph(label, value) {
    return buildParagraph([
        { type: "text", text: `${label}: `, marks: [{ type: "bold" }] },
        ...parseInline(value),
    ]);
}

function getTableTitleParts(row, headerRow, ordered) {
    const usedIndices = new Set();
    const titleParts = [];
    const leadIndex = ordered && row.length > 1 ? 1 : 0;

    if (ordered && /^\d+$/.test(row[0] || "")) {
        usedIndices.add(0);
    }

    const primaryTitle = row[leadIndex] || "";
    if (primaryTitle) {
        titleParts.push(primaryTitle);
        usedIndices.add(leadIndex);
    }

    const secondaryIndex = leadIndex + 1;
    const secondaryTitle = row[secondaryIndex] || "";
    const secondaryHeader = headerRow[secondaryIndex] || "";
    if (
        secondaryTitle &&
        !isDetailTableHeader(secondaryHeader) &&
        secondaryTitle.length <= 40
    ) {
        titleParts.push(secondaryTitle);
        usedIndices.add(secondaryIndex);
    }

    if (titleParts.length === 0) {
        const fallbackIndex = row.findIndex((cell) => cell && cell.trim() !== "");
        if (fallbackIndex >= 0) {
            titleParts.push(row[fallbackIndex]);
            usedIndices.add(fallbackIndex);
        }
    }

    return {
        title: titleParts.join(" — "),
        usedIndices,
    };
}

function buildTableListItem(row, headerRow, ordered) {
    const { title, usedIndices } = getTableTitleParts(row, headerRow, ordered);
    const content = [];

    if (title) {
        content.push(buildParagraph([
            { type: "text", text: title, marks: [{ type: "bold" }] },
        ]));
    }

    row.forEach((cell, index) => {
        if (usedIndices.has(index)) return;
        if (!cell || cell.trim() === "") return;

        const label = headerRow[index] || `Column ${index + 1}`;
        content.push(buildLabeledTableParagraph(label, cell));
    });

    if (content.length === 0) {
        content.push(buildParagraph([{ type: "text", text: row.join(" | ") }]));
    }

    return { type: "list_item", content };
}

// Substack has no reliable HTML-table path for this workflow, so we transform
// markdown tables into structured lists that keep label/value pairs scannable.
function parseTable(input) {
    const table = Array.isArray(input) ? parseMarkdownTableLines(input) : input;
    if (!table) return null;

    const { headerRow, bodyRows } = table;
    if (bodyRows.length === 0) {
        return buildParagraph([
            { type: "text", text: headerRow.join(" · "), marks: [{ type: "bold" }] },
        ]);
    }

    const firstHeader = normalizeTableHeader(headerRow[0]);
    const looksOrdered =
        /^(priority|rank|ranking|order|no|number)$/.test(firstHeader) ||
        bodyRows.every((row) => /^\d+$/.test((row[0] || "").trim()));

    const listItems = bodyRows.map((row) => buildTableListItem(row, headerRow, looksOrdered));
    if (looksOrdered) {
        const start = /^\d+$/.test((bodyRows[0][0] || "").trim())
            ? Math.max(1, parseInt(bodyRows[0][0], 10))
            : 1;
        return {
            type: "ordered_list",
            attrs: { start, order: start, type: null },
            content: listItems,
        };
    }

    return {
        type: "bullet_list",
        content: listItems,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auto-extract title and subtitle from a markdown article.
 * Title: first `# Heading` line.
 * Subtitle: first `*italic*` line (our article format uses this for subheadlines).
 */
function extractMetaFromMarkdown(markdown) {
    // Normalize line endings (handles Windows CRLF)
    const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    let title = null;
    let subtitle = null;
    let titleLineIdx = -1;
    let subtitleLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!title) {
            const h1 = line.match(/^#\s+(.+)$/);
            if (h1) { title = h1[1].trim(); titleLineIdx = i; continue; }
        }
        if (title && !subtitle) {
            const italic = line.match(/^\*(.+)\*$|^_(.+)_$/);
            if (italic) { subtitle = (italic[1] || italic[2]).trim(); subtitleLineIdx = i; break; }
            // Only look for subtitle in the lines immediately after title (skip blanks)
            if (line.trim() !== "") break;
        }
    }

    // Build body markdown with title/subtitle stripped — they're sent separately as draft_title/draft_subtitle
    const skipLines = new Set([titleLineIdx, subtitleLineIdx].filter((i) => i >= 0));
    const bodyLines = lines.filter((_, i) => !skipLines.has(i));
    // Trim any leading blank lines left after stripping
    while (bodyLines.length > 0 && bodyLines[0].trim() === "") bodyLines.shift();
    // If the file uses a top-of-body horizontal rule under the subtitle, strip it too.
    // In Substack the title/subtitle render separately, so keeping that separator creates
    // an awkward empty divider before the actual article body.
    if (bodyLines.length > 0 && /^(-{3,}|\*{3,}|_{3,})$/.test(bodyLines[0].trim())) {
        bodyLines.shift();
        while (bodyLines.length > 0 && bodyLines[0].trim() === "") bodyLines.shift();
    }
    const bodyMarkdown = bodyLines.join("\n");

    return { title, subtitle, bodyMarkdown };
}

// ─── Extension entry ─────────────────────────────────────────────────────────

const session = await joinSession({
    onPermissionRequest: approveAll,
    tools: [
        {
            name: "publish_to_substack",
            description:
                "Publishes a markdown article file to Substack as a draft ready for review and one-click publishing. " +
                "Defaults to STAGE target (SUBSTACK_STAGE_URL) for safe preview; use target='prod' to publish to production. " +
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
                            'Publication target: "stage" (default) publishes to the staging publication ' +
                            "(SUBSTACK_STAGE_URL), \"prod\" publishes to production (SUBSTACK_PUBLICATION_URL). " +
                            "Always use stage first to verify formatting before promoting to prod.",
                        enum: ["stage", "prod"],
                    },
                },
                required: ["file_path"],
            },
            handler: async (args) => {
                try {
                    // Load config
                    const env = loadEnv();
                    const token = process.env.SUBSTACK_TOKEN || env.SUBSTACK_TOKEN;

                    // Resolve publication target: stage (default) or prod
                    const target = args.target || "stage";
                    let pubUrl;
                    if (target === "stage") {
                        pubUrl = process.env.SUBSTACK_STAGE_URL || env.SUBSTACK_STAGE_URL;
                        if (!pubUrl) {
                            // Fallback: no stage URL configured, use prod with a warning
                            pubUrl = process.env.SUBSTACK_PUBLICATION_URL || env.SUBSTACK_PUBLICATION_URL;
                            if (pubUrl) {
                                await session.log("⚠️  SUBSTACK_STAGE_URL not set — falling back to production URL", { ephemeral: true });
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

                    // Read article file
                    const filePath = resolve(process.cwd(), args.file_path);
                    if (!existsSync(filePath)) {
                        return {
                            textResultForLlm: `Error: File not found: ${filePath}`,
                            resultType: "failure",
                        };
                    }
                    const markdown = readFileSync(filePath, "utf-8");

                    // Resolve title/subtitle — args take priority, then auto-extract
                    const extracted = extractMetaFromMarkdown(markdown);
                    const title = args.title || extracted.title;
                    const subtitle = args.subtitle || extracted.subtitle || "";
                    // Use bodyMarkdown (title/subtitle stripped) — they're sent as draft_title/draft_subtitle
                    const bodyMarkdown = extracted.bodyMarkdown;

                    if (!title) {
                        return {
                            textResultForLlm:
                                "Error: Could not determine article title. " +
                                "Either pass `title` explicitly or add a `# Heading` as the first line of the file.",
                            resultType: "failure",
                        };
                    }

                    // Auth
                    const headers = makeHeaders(token);
                    const subdomain = extractSubdomain(pubUrl);
                    await session.log(`Targeting ${subdomain}.substack.com (${target})…`, { ephemeral: true });

                    // Derive article slug from file path
                    // e.g. content/articles/jsn-extension-preview/draft.md → jsn-extension-preview
                    //      content/articles/ari-2026-offseason.md → ari-2026-offseason
                    const pathParts = args.file_path.replace(/\\/g, "/").split("/");
                    const draftIdx = pathParts.indexOf("articles");
                    let articleSlug = draftIdx >= 0 && draftIdx + 1 < pathParts.length
                        ? pathParts[draftIdx + 1]
                        : null;
                    if (articleSlug && articleSlug.endsWith(".md")) {
                        articleSlug = articleSlug.slice(0, -3);
                    }

                    // ── Published-article guard + draft URL lookup ────────
                    let existingDraftUrl = args.draft_url || null;
                    if (articleSlug) {
                        const articleState = await lookupArticleStateFromDb(articleSlug, process.cwd());
                        if (articleState) {
                            // Hard guard: refuse to touch published articles
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
                            // Auto-detect existing draft URL from DB if not explicitly provided
                            if (!existingDraftUrl && articleState.draftUrl) {
                                existingDraftUrl = articleState.draftUrl;
                                await session.log(`Found existing draft URL in pipeline.db: ${existingDraftUrl}`, { ephemeral: true });
                            }
                        }
                    }

                    const existingDraftId = extractDraftIdFromUrl(existingDraftUrl);
                    const isUpdate = !!existingDraftId;

                    // Resolve team: explicit arg → DB lookup → null
                    let teamName = args.team || null;
                    if (!teamName) {
                        const dbTeam = await lookupTeamFromDb(args.file_path, process.cwd());
                        if (dbTeam) {
                            teamName = dbTeam;
                            await session.log(`Auto-detected team from pipeline.db: "${dbTeam}"`, { ephemeral: true });
                        }
                    }

                    // Derive tags from team name + specialist artifacts in the article directory
                    const articleDir = dirname(filePath);
                    const tags = deriveTagsFromArticleDir(articleDir, teamName);
                    await session.log(`Tags: ${tags.length > 0 ? tags.join(", ") : "(none)"}`, { ephemeral: true });

                    // Convert markdown → ProseMirror (title/subtitle already sent separately; local images auto-uploaded)
                    await session.log("Converting article to Substack format…", { ephemeral: true });
                    const uploadImage = (localPath) =>
                        uploadImageToSubstack(subdomain, headers, localPath, articleDir);
                    const body = await markdownToProseMirror(bodyMarkdown, uploadImage);

                    // Create or update draft
                    let draft;
                    let draftUrl;
                    if (isUpdate) {
                        await session.log(`Updating existing draft ${existingDraftId}…`, { ephemeral: true });
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
                        await session.log("Creating new draft on Substack…", { ephemeral: true });
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

                    // ── Pipeline DB writeback (Stage 7 + draft URL) ──────
                    // The calling agent (Lead / Ralph) MUST update pipeline.db
                    // after this tool returns. Direct DB writes from this JS
                    // extension are avoided to prevent conflicts with the
                    // Python PipelineState layer. Use the slug and URL below.
                    //
                    // For NEW drafts (stage 6→7):
                    //   ps.advance_stage('<slug>', from_stage=6, to_stage=7, ...)
                    //   ps.set_draft_url('<slug>', '<url>')
                    //
                    // For UPDATES (already stage 7):
                    //   ps.set_draft_url('<slug>', '<url>')   # just refresh the URL

                    const writebackBlock = articleSlug
                        ? isUpdate
                            ? `\n**⚡ DB Writeback required (draft URL refresh):**\n` +
                              `\`\`\`python\n` +
                              `from content.pipeline_state import PipelineState\n` +
                              `with PipelineState() as ps:\n` +
                              `    ps.set_draft_url('${articleSlug}', '${draftUrl}')\n` +
                              `\`\`\`\n`
                            : `\n**⚡ DB Writeback required (Stage 7 + draft URL):**\n` +
                              `\`\`\`python\n` +
                              `from content.pipeline_state import PipelineState\n` +
                              `with PipelineState() as ps:\n` +
                              `    ps.advance_stage('${articleSlug}', from_stage=6, to_stage=7, agent='Publisher', notes='Draft: ${draftUrl}')\n` +
                              `    ps.set_draft_url('${articleSlug}', '${draftUrl}')\n` +
                              `\`\`\`\n`
                        : "";

                    const actionWord = isUpdate ? "updated" : "created";
                    const targetLabel = target === "prod" ? "🔴 PRODUCTION" : "🟡 STAGE";
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
            },
        },
    ],
});

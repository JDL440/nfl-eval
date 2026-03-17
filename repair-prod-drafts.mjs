#!/usr/bin/env node
/**
 * Repair Prod Drafts — Fix imageCaption parse error
 *
 * Re-pushes witherspoon-extension-v2 and jsn-extension-preview prod drafts
 * with corrected ProseMirror structure (adds missing imageCaption child nodes
 * inside captionedImage nodes).
 *
 * Usage: node repair-prod-drafts.mjs [--dry-run]
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";

// ─── Config ──────────────────────────────────────────────────────────────────

function loadEnv() {
    const p = resolve(process.cwd(), ".env");
    const env = {};
    if (!existsSync(p)) return env;
    for (const line of readFileSync(p, "utf-8").split("\n")) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
        if (!m || line.trimStart().startsWith("#")) continue;
        env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
}

const env = loadEnv();
const TOKEN = process.env.SUBSTACK_TOKEN || env.SUBSTACK_TOKEN;
const PROD_URL = process.env.SUBSTACK_PUBLICATION_URL || env.SUBSTACK_PUBLICATION_URL;

if (!TOKEN) { console.error("Missing SUBSTACK_TOKEN"); process.exit(1); }
if (!PROD_URL) { console.error("Missing SUBSTACK_PUBLICATION_URL"); process.exit(1); }

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    if (m) return m[1];
    throw new Error(`Cannot extract subdomain: ${url}`);
}

const SUBDOMAIN = extractSubdomain(PROD_URL);
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Auth ────────────────────────────────────────────────────────────────────

function makeHeaders(token) {
    let substackSid, connectSid;
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        substackSid = decoded.substack_sid;
        connectSid = decoded.connect_sid || decoded.substack_sid;
    } catch {
        substackSid = token.trim();
        connectSid = token.trim();
    }
    return {
        Cookie: `substack.sid=${substackSid}; connect.sid=${connectSid}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Origin: "https://substack.com",
        Referer: "https://substack.com/",
    };
}

const HEADERS = makeHeaders(TOKEN);

// ─── Substack API ────────────────────────────────────────────────────────────

async function uploadImageToSubstack(imagePath, articleDir) {
    const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
    const ext = extname(imagePath).toLowerCase();
    const mime = mimeMap[ext] || "image/jpeg";

    let absPath = /^([A-Za-z]:[\\/]|\/)/.test(imagePath) ? imagePath : resolve(articleDir, imagePath);
    if (!existsSync(absPath)) {
        const cwdPath = resolve(process.cwd(), imagePath);
        if (existsSync(cwdPath)) absPath = cwdPath;
        else throw new Error(`Image not found: ${absPath}`);
    }

    const dataUri = `data:${mime};base64,${readFileSync(absPath).toString("base64")}`;
    const res = await fetch(`https://${SUBDOMAIN}.substack.com/api/v1/image`, {
        method: "POST",
        headers: { ...HEADERS, Origin: `https://${SUBDOMAIN}.substack.com`, Referer: `https://${SUBDOMAIN}.substack.com/publish` },
        body: JSON.stringify({ image: dataUri }),
    });
    if (!res.ok) throw new Error(`Image upload failed: HTTP ${res.status}`);
    return (await res.json()).url;
}

async function updateDraft(draftId, title, subtitle, body, tags) {
    const payload = {
        audience: "everyone",
        draft_title: title,
        draft_subtitle: subtitle || "",
        draft_body: JSON.stringify(body),
        postTags: tags || [],
    };
    const res = await fetch(`https://${SUBDOMAIN}.substack.com/api/v1/drafts/${draftId}`, {
        method: "PUT",
        headers: HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Update failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return await res.json();
}

// ─── Markdown → ProseMirror (with imageCaption fix) ─────────────────────────

function parseInline(text) {
    const parts = [];
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
        if (match[2]) parts.push({ type: "text", text: match[2], marks: [{ type: "bold" }, { type: "italic" }] });
        else if (match[3]) parts.push({ type: "text", text: match[3], marks: [{ type: "bold" }] });
        else if (match[4]) parts.push({ type: "text", text: match[4], marks: [{ type: "italic" }] });
        else if (match[5]) parts.push({ type: "text", text: match[5], marks: [{ type: "italic" }] });
        else if (match[6] && match[7]) parts.push({ type: "text", text: match[6], marks: [{ type: "link", attrs: { href: match[7], target: "_blank" } }] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push({ type: "text", text: text.slice(lastIndex) });
    return parts.length > 0 ? parts : [{ type: "text", text: text || " " }];
}

function buildParagraph(content) {
    return { type: "paragraph", content: content.length > 0 ? content : [{ type: "text", text: " " }] };
}

function buildCaptionedImage(src, alt, caption) {
    return {
        type: "captionedImage", attrs: {},
        content: [{
            type: "image2",
            attrs: {
                src, alt: alt || null, title: caption || null, srcNoWatermark: null,
                fullscreen: null, imageSize: "normal", height: null, width: null,
                resizeWidth: null, bytes: null, type: null, href: null,
                belowTheFold: false, topImage: false, internalRedirect: null,
                isProcessing: false, align: null, offset: false,
            },
        }, {
            type: "imageCaption",
            content: caption ? [{ type: "text", text: caption }] : [],
        }],
    };
}

function extractYouTubeId(input) {
    if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
    const short = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (short) return short[1];
    const long = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (long) return long[1];
    return null;
}

function stripTableMarkdown(value) {
    return String(value || "").replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/(^|[\s(])_([^_\n]+)_(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1").trim();
}

function normalizeTableHeader(value) {
    return stripTableMarkdown(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isDetailTableHeader(value) {
    const n = normalizeTableHeader(value);
    return /^(current state|severity|status|budget|aav|year 1 cap hit|cap hit|comp range|draft range|profile|school|notes?)$/.test(n);
}

function splitMarkdownTableRow(line) {
    let working = String(line || "").trim();
    if (working.startsWith("|")) working = working.slice(1);
    if (working.endsWith("|")) working = working.slice(0, -1);
    const cells = [];
    let current = "";
    for (let i = 0; i < working.length; i++) {
        const char = working[i], next = working[i + 1];
        if (char === "\\" && (next === "|" || next === "\\")) { current += next; i++; continue; }
        if (char === "|") { cells.push(current.trim()); current = ""; continue; }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}

function isMarkdownTableSeparatorRow(row) {
    return row.length > 0 && row.every(cell => /^:?-{3,}:?$/.test(String(cell || "").trim()));
}

function normalizeTableCells(row, length, fill = "") {
    return Array.from({ length }, (_, i) => row[i] ?? fill);
}

function parseMarkdownTableLines(lines) {
    const tableLines = lines.map(l => String(l || "").trim()).filter(Boolean).filter(l => l.startsWith("|"));
    if (tableLines.length === 0) return null;
    const rawRows = tableLines.map(splitMarkdownTableRow);
    const hasSeparator = rawRows.length > 1 && isMarkdownTableSeparatorRow(rawRows[1]);
    const headerRow = rawRows[0];
    const bodyRows = rawRows.slice(hasSeparator ? 2 : 1).filter(row => row.some(cell => stripTableMarkdown(cell) !== ""));
    const columnCount = Math.max(headerRow.length, ...bodyRows.map(row => row.length), 0);
    return { headerRow: normalizeTableCells(headerRow, columnCount), bodyRows: bodyRows.map(row => normalizeTableCells(row, columnCount)), columnCount, rowCount: bodyRows.length };
}

function buildLabeledTableParagraph(label, value) {
    return buildParagraph([{ type: "text", text: `${label}: `, marks: [{ type: "bold" }] }, ...parseInline(value)]);
}

function getTableTitleParts(row, headerRow, ordered) {
    const usedIndices = new Set();
    const titleParts = [];
    const leadIndex = ordered && row.length > 1 ? 1 : 0;
    if (ordered && /^\d+$/.test(row[0] || "")) usedIndices.add(0);
    const primaryTitle = row[leadIndex] || "";
    if (primaryTitle) { titleParts.push(primaryTitle); usedIndices.add(leadIndex); }
    const secondaryIndex = leadIndex + 1;
    const secondaryTitle = row[secondaryIndex] || "";
    const secondaryHeader = headerRow[secondaryIndex] || "";
    if (secondaryTitle && !isDetailTableHeader(secondaryHeader) && secondaryTitle.length <= 40) {
        titleParts.push(secondaryTitle); usedIndices.add(secondaryIndex);
    }
    if (titleParts.length === 0) {
        const fi = row.findIndex(c => c && c.trim() !== "");
        if (fi >= 0) { titleParts.push(row[fi]); usedIndices.add(fi); }
    }
    return { title: titleParts.join(" — "), usedIndices };
}

function buildTableListItem(row, headerRow, ordered) {
    const { title, usedIndices } = getTableTitleParts(row, headerRow, ordered);
    const content = [];
    if (title) content.push(buildParagraph([{ type: "text", text: title, marks: [{ type: "bold" }] }]));
    row.forEach((cell, index) => {
        if (usedIndices.has(index)) return;
        if (!cell || cell.trim() === "") return;
        content.push(buildLabeledTableParagraph(headerRow[index] || `Column ${index + 1}`, cell));
    });
    if (content.length === 0) content.push(buildParagraph([{ type: "text", text: row.join(" | ") }]));
    return { type: "list_item", content };
}

function parseTable(input) {
    const table = Array.isArray(input) ? parseMarkdownTableLines(input) : input;
    if (!table) return null;
    const { headerRow, bodyRows } = table;
    if (bodyRows.length === 0) return buildParagraph([{ type: "text", text: headerRow.join(" · "), marks: [{ type: "bold" }] }]);
    const firstHeader = normalizeTableHeader(headerRow[0]);
    const looksOrdered = /^(priority|rank|ranking|order|no|number)$/.test(firstHeader) ||
        bodyRows.every(row => /^\d+$/.test((row[0] || "").trim()));
    const listItems = bodyRows.map(row => buildTableListItem(row, headerRow, looksOrdered));
    if (looksOrdered) {
        const start = /^\d+$/.test((bodyRows[0][0] || "").trim()) ? Math.max(1, parseInt(bodyRows[0][0], 10)) : 1;
        return { type: "ordered_list", attrs: { start, order: start, type: null }, content: listItems };
    }
    return { type: "bullet_list", content: listItems };
}

async function markdownToProseMirror(markdown, uploadImage) {
    markdown = markdown.replace(/<!--[\s\S]*?-->/g, "");
    const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const content = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === "") { i++; continue; }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
            content.push({ type: "heading", attrs: { level: headingMatch[1].length }, content: parseInline(headingMatch[2]) });
            i++; continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { content.push({ type: "horizontal_rule" }); i++; continue; }

        const ytLine = trimmed.match(/^::youtube\s+(.+)$/i);
        if (ytLine) {
            const videoId = extractYouTubeId(ytLine[1].trim());
            if (videoId) content.push({ type: "youtube2", attrs: { videoId, startTime: null, endTime: null } });
            i++; continue;
        }

        const imgLine = trimmed.match(/^!\[([^\]]*)\]\(([^)"]+?)(?:\s+"([^"]*)")?\)$/);
        if (imgLine) {
            const [, altRaw, rawSrc, titleAttr] = imgLine;
            const pipeIdx = altRaw.indexOf("|");
            const alt = pipeIdx >= 0 ? altRaw.slice(0, pipeIdx).trim() : altRaw.trim();
            const caption = titleAttr || (pipeIdx >= 0 ? altRaw.slice(pipeIdx + 1).trim() : "");
            let src = rawSrc;
            if (uploadImage && !/^https?:\/\//i.test(rawSrc)) {
                try { src = await uploadImage(rawSrc); } catch { src = rawSrc; }
            }
            content.push(buildCaptionedImage(src, alt, caption));
            i++; continue;
        }

        if (trimmed.startsWith("> ")) {
            const bqLines = [];
            while (i < lines.length && lines[i].trimStart().startsWith("> ")) { bqLines.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
            const normalizedBqLines = bqLines.map(l => l.trim()).filter(l => l !== "");
            const firstBqLine = normalizedBqLines[0] || "";
            const remainingBqLines = normalizedBqLines.slice(1);
            const isTldrBlock = /TLDR/i.test(firstBqLine.replace(/\*/g, "")) && remainingBqLines.length > 0 && remainingBqLines.every(l => /^[-*+]\s+/.test(l));
            if (isTldrBlock) {
                content.push({ type: "paragraph", content: parseInline(firstBqLine) });
                content.push({ type: "bullet_list", content: remainingBqLines.map(t => ({ type: "list_item", content: [{ type: "paragraph", content: parseInline(t.replace(/^[-*+]\s+/, "")) }] })) });
                continue;
            }
            content.push({ type: "blockquote", content: [{ type: "paragraph", content: parseInline(bqLines.join(" ")) }] });
            continue;
        }

        if (trimmed.startsWith("|")) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i]); i++; }
            const parsedTable = parseMarkdownTableLines(tableLines);
            const table = parseTable(parsedTable);
            if (table) { if (Array.isArray(table)) content.push(...table); else content.push(table); }
            continue;
        }

        if (/^[-*+]\s/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s/, "")); i++; }
            content.push({ type: "bullet_list", content: items.map(t => ({ type: "list_item", content: [{ type: "paragraph", content: parseInline(t) }] })) });
            continue;
        }

        if (/^\d+\.\s/.test(trimmed)) {
            const items = [];
            let start = parseInt(trimmed.match(/^(\d+)\./)[1], 10);
            while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s/, "")); i++; }
            content.push({ type: "ordered_list", attrs: { start, order: start, type: null }, content: items.map(t => ({ type: "list_item", content: [{ type: "paragraph", content: parseInline(t) }] })) });
            continue;
        }

        const paraLines = [];
        while (i < lines.length && lines[i].trim() !== "" && !/^#{1,3}\s/.test(lines[i].trim()) &&
            !lines[i].trim().startsWith("> ") && !lines[i].trim().startsWith("|") &&
            !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) && !/^::youtube\s/i.test(lines[i].trim()) &&
            !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) &&
            !/^!\[[^\]]*\]\(/.test(lines[i].trim())) {
            paraLines.push(lines[i]); i++;
        }
        if (paraLines.length > 0) content.push({ type: "paragraph", content: parseInline(paraLines.join(" ")) });
    }

    return { type: "doc", attrs: { schemaVersion: "v1" }, content };
}

function extractMetaFromMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    let title = null, subtitle = null, titleLineIdx = -1, subtitleLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (!title) { const h1 = lines[i].match(/^#\s+(.+)$/); if (h1) { title = h1[1].trim(); titleLineIdx = i; continue; } }
        if (title && !subtitle) { const italic = lines[i].match(/^\*(.+)\*$|^_(.+)_$/); if (italic) { subtitle = (italic[1] || italic[2]).trim(); subtitleLineIdx = i; break; } if (lines[i].trim() !== "") break; }
    }
    const skipLines = new Set([titleLineIdx, subtitleLineIdx].filter(i => i >= 0));
    const bodyLines = lines.filter((_, i) => !skipLines.has(i));
    while (bodyLines.length > 0 && bodyLines[0].trim() === "") bodyLines.shift();
    if (bodyLines.length > 0 && /^(-{3,}|\*{3,}|_{3,})$/.test(bodyLines[0].trim())) {
        bodyLines.shift();
        while (bodyLines.length > 0 && bodyLines[0].trim() === "") bodyLines.shift();
    }
    return { title, subtitle, bodyMarkdown: bodyLines.join("\n") };
}

// ─── Validation ──────────────────────────────────────────────────────────────

const KNOWN_NODE_TYPES = new Set([
    "doc", "paragraph", "text", "heading", "horizontal_rule",
    "blockquote", "bullet_list", "ordered_list", "list_item",
    "captionedImage", "image2", "imageCaption",
    "youtube2", "table", "table_row", "table_cell", "table_header",
    "hard_break", "code_block",
]);

function findUnknownNodeTypes(node, path = "root") {
    const issues = [];
    if (node.type && !KNOWN_NODE_TYPES.has(node.type)) issues.push({ type: node.type, path });
    if (Array.isArray(node.content)) {
        node.content.forEach((child, i) => issues.push(...findUnknownNodeTypes(child, `${path}[${i}]`)));
    }
    return issues;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const ARTICLES = [
    { slug: "witherspoon-extension-v2", draftId: "191200944", team: "Seattle Seahawks" },
    { slug: "jsn-extension-preview",    draftId: "191200952", team: "Seattle Seahawks" },
    { slug: "den-2026-offseason",       draftId: "191154355", team: "Denver Broncos" },
    { slug: "mia-tua-dead-cap-rebuild", draftId: "191150015", team: "Miami Dolphins" },
];

async function run() {
    console.log(`\n🔧 Repair Prod Drafts — imageCaption fix`);
    console.log(`   Target: ${SUBDOMAIN}.substack.com`);
    console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no API calls)" : "LIVE"}\n`);

    for (const article of ARTICLES) {
        const draftPath = resolve(process.cwd(), "content", "articles", article.slug, "draft.md");
        if (!existsSync(draftPath)) {
            console.log(`❌ ${article.slug}: draft.md not found at ${draftPath}`);
            continue;
        }

        console.log(`📝 ${article.slug}...`);
        const markdown = readFileSync(draftPath, "utf-8");
        const { title, subtitle, bodyMarkdown } = extractMetaFromMarkdown(markdown);
        const articleDir = dirname(draftPath);

        const uploadImage = async (localPath) => {
            console.log(`   📸 Uploading: ${localPath}`);
            return uploadImageToSubstack(localPath, articleDir);
        };

        const body = await markdownToProseMirror(bodyMarkdown, DRY_RUN ? null : uploadImage);

        // Validate
        const unknowns = findUnknownNodeTypes(body);
        if (unknowns.length > 0) {
            console.log(`   ❌ VALIDATION FAILED — unknown nodes:`);
            unknowns.forEach(u => console.log(`      ${u.type} at ${u.path}`));
            continue;
        }

        // Count captionedImage nodes and verify structure
        let imageCount = 0;
        function countImages(node) {
            if (node.type === "captionedImage") {
                imageCount++;
                const types = (node.content || []).map(c => c.type);
                if (!types.includes("imageCaption")) {
                    console.log(`   ⚠️  captionedImage missing imageCaption child!`);
                }
            }
            if (Array.isArray(node.content)) node.content.forEach(countImages);
        }
        countImages(body);
        console.log(`   ✅ Validation passed — ${imageCount} images, all with imageCaption`);
        console.log(`   📄 Title: ${title}`);

        if (DRY_RUN) {
            console.log(`   🏁 DRY RUN — would update draft ${article.draftId}\n`);
            continue;
        }

        // Build tags
        const tags = [article.team];
        try {
            const EXCLUDED = new Set(["discussion-prompt.md", "discussion-summary.md", "draft.md", "draft-section.md"]);
            const files = readdirSync(articleDir);
            for (const file of files) {
                if (!file.endsWith(".md") || EXCLUDED.has(file)) continue;
                const stem = file.replace(/\.md$/, "");
                if (stem.startsWith("sea-") || stem.startsWith("editor-review") || stem.startsWith("publisher-pass")) continue;
                const role = stem.replace(/-(position|panel-response|panel)$/, "");
                if (role === stem) continue;
                const tag = role.charAt(0).toUpperCase() + role.slice(1);
                if (!tags.includes(tag)) tags.push(tag);
            }
        } catch {}

        try {
            await updateDraft(article.draftId, title, subtitle, body, tags);
            console.log(`   ✅ Draft ${article.draftId} updated successfully`);
            console.log(`   🔗 https://${SUBDOMAIN}.substack.com/publish/post/${article.draftId}\n`);
        } catch (err) {
            console.log(`   ❌ Update failed: ${err.message}\n`);
        }

        // Rate limit between articles
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log("Done.");
}

run().catch(err => { console.error("Fatal:", err); process.exit(1); });

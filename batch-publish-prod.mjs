#!/usr/bin/env node
/**
 * Batch Publish to Production — Stage 7 → Prod Draft Push
 *
 * This script:
 * 1. Refreshes all 20 staging drafts with cleaned content
 * 2. Updates DEN's prod draft (affected by table cleanup)
 * 3. Creates new prod drafts for the 20 staging-only articles
 * 4. Updates pipeline.db with prod draft URLs
 *
 * Reuses core logic from .github/extensions/substack-publisher/extension.mjs
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { DatabaseSync } from "node:sqlite";

// ─── Config ─────────────────────────────────────────────────────────────────

function loadEnv() {
    const p = resolve(process.cwd(), ".env");
    const env = {};
    if (!existsSync(p)) return env;
    const text = readFileSync(p, "utf-8");
    for (const line of text.split("\n")) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
        if (!m || line.trimStart().startsWith("#")) continue;
        env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
}

const env = loadEnv();
const TOKEN = process.env.SUBSTACK_TOKEN || env.SUBSTACK_TOKEN;
const PROD_URL = process.env.SUBSTACK_PUBLICATION_URL || env.SUBSTACK_PUBLICATION_URL;
const STAGE_URL = process.env.SUBSTACK_STAGE_URL || env.SUBSTACK_STAGE_URL;

if (!TOKEN) { console.error("Missing SUBSTACK_TOKEN"); process.exit(1); }
if (!PROD_URL) { console.error("Missing SUBSTACK_PUBLICATION_URL"); process.exit(1); }
if (!STAGE_URL) { console.error("Missing SUBSTACK_STAGE_URL"); process.exit(1); }

const PROD_SUBDOMAIN = extractSubdomain(PROD_URL);
const STAGE_SUBDOMAIN = extractSubdomain(STAGE_URL);

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

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    if (m) return m[1];
    throw new Error(`Cannot extract subdomain from: "${url}"`);
}

const HEADERS = makeHeaders(TOKEN);

// ─── Substack API ────────────────────────────────────────────────────────────

async function uploadImageToSubstack(subdomain, imagePath, articleDir) {
    const mimeMap = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
    };
    const ext = extname(imagePath).toLowerCase();
    const mime = mimeMap[ext] || "image/jpeg";

    let absPath = /^([A-Za-z]:[\\/]|\/)/.test(imagePath)
        ? imagePath
        : resolve(articleDir, imagePath);

    if (!existsSync(absPath)) {
        const cwdPath = resolve(process.cwd(), imagePath);
        if (existsSync(cwdPath)) absPath = cwdPath;
        else throw new Error(`Image file not found: ${absPath} (also tried ${cwdPath})`);
    }

    const dataUri = `data:${mime};base64,${readFileSync(absPath).toString("base64")}`;
    const res = await fetch(`https://${subdomain}.substack.com/api/v1/image`, {
        method: "POST",
        headers: {
            ...HEADERS,
            Origin: `https://${subdomain}.substack.com`,
            Referer: `https://${subdomain}.substack.com/publish`,
        },
        body: JSON.stringify({ image: dataUri }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Image upload failed (${subdomain}): HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.url;
}

async function createSubstackDraft({ subdomain, title, subtitle, body, audience, tags }) {
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
        headers: HEADERS,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Create draft failed (${subdomain}): HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return await res.json();
}

async function updateSubstackDraft({ subdomain, draftId, title, subtitle, body, audience, tags }) {
    const payload = {
        audience: audience || "everyone",
        draft_title: title,
        draft_subtitle: subtitle || "",
        draft_body: JSON.stringify(body),
        postTags: tags || [],
    };

    const res = await fetch(`https://${subdomain}.substack.com/api/v1/drafts/${draftId}`, {
        method: "PUT",
        headers: HEADERS,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Update draft failed (${subdomain}): HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return await res.json();
}

// ─── Tags (copied from extension) ───────────────────────────────────────────

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

function deriveTagsFromArticleDir(articleDir, teamName) {
    const tags = [];
    if (teamName) tags.push(teamName);
    const EXCLUDED_FILES = new Set([
        "discussion-prompt.md", "discussion-summary.md", "draft.md", "draft-section.md",
    ]);
    const teamAbbrev = getTeamAbbrev(teamName);
    try {
        const files = readdirSync(articleDir);
        for (const file of files) {
            if (!file.endsWith(".md")) continue;
            if (EXCLUDED_FILES.has(file)) continue;
            const stem = file.replace(/\.md$/, "");
            if (teamAbbrev && stem.startsWith(teamAbbrev + "-")) continue;
            const role = stem.replace(/-(position|panel-response|panel)$/, "");
            if (role === stem) continue;
            const tag = role.charAt(0).toUpperCase() + role.slice(1);
            if (!tags.includes(tag)) tags.push(tag);
        }
    } catch {}
    return tags;
}

// ─── Markdown → ProseMirror (copied from extension, simplified) ─────────────

function extractMetaFromMarkdown(markdown) {
    const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    let title = null, subtitle = null, titleLineIdx = -1, subtitleLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!title) {
            const h1 = line.match(/^#\s+(.+)$/);
            if (h1) { title = h1[1].trim(); titleLineIdx = i; continue; }
        }
        if (title && !subtitle) {
            const italic = line.match(/^\*(.+)\*$|^_(.+)_$/);
            if (italic) { subtitle = (italic[1] || italic[2]).trim(); subtitleLineIdx = i; break; }
            if (line.trim() !== "") break;
        }
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
    const n = normalizeTableHeader(value);
    return /^(current state|severity|status|budget|aav|year 1 cap hit|cap hit|comp range|draft range|profile|school|notes?)$/.test(n);
}

function isDenseTableHeader(value) {
    const n = normalizeTableHeader(value);
    return (
        /^(aav|budget|range|comp range|comparison range|draft range|cap hit|year \d+ cap hit|dead cap|cash|cost|price|bonus|guaranteed|guaranteed money|signing bonus)$/.test(n) ||
        n.includes("cap hit") || n.includes("dead cap") || n.includes("comp range") ||
        n.includes("comparison range") || n.endsWith(" range")
    );
}

function splitMarkdownTableRow(line) {
    let working = String(line || "").trim();
    if (working.startsWith("|")) working = working.slice(1);
    if (working.endsWith("|")) working = working.slice(0, -1);
    const cells = [];
    let current = "";
    for (let i = 0; i < working.length; i++) {
        const char = working[i], next = working[i + 1];
        if (char === "\\" && (next === "|" || next === "\\")) { current += next; i += 1; continue; }
        if (char === "|") { cells.push(current.trim()); current = ""; continue; }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}

function isMarkdownTableSeparatorRow(row) {
    return row.length > 0 && row.every(cell => /^:?-+:?$/.test(String(cell || "").trim()));
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
    return {
        headerRow: normalizeTableCells(headerRow, columnCount),
        bodyRows: bodyRows.map(row => normalizeTableCells(row, columnCount)),
        columnCount, rowCount: bodyRows.length,
    };
}

function looksNumericTableCell(value) {
    const n = stripTableMarkdown(value).replace(/[$,%~≈]/g, "").replace(/[()]/g, "")
        .replace(/[–—]/g, "-").replace(/\s+/g, "").replace(/m$/i, "").replace(/aav$/i, "");
    return n !== "" && /^[-+]?\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$/.test(n);
}

function classifyMarkdownTableForInline(table) {
    if (!table) return { allowInline: true };
    const normalizedHeaders = table.headerRow.map(normalizeTableHeader);
    const firstHeader = normalizedHeaders[0] || "";
    const orderedRowCount = table.bodyRows.filter(row => /^\d+$/.test((row[0] || "").trim())).length;
    const looksOrdered = /^(priority|rank|ranking|order|no|number)$/.test(firstHeader) ||
        (table.rowCount > 0 && (orderedRowCount / table.rowCount) >= 0.8);
    const checklistHeaderCount = normalizedHeaders.filter(h => isDetailTableHeader(h)).length;
    const denseHeaders = [...new Set(table.headerRow.filter(h => isDenseTableHeader(h)))];
    const nonEmptyCells = table.bodyRows.flat().map(c => stripTableMarkdown(c)).filter(c => c !== "");
    const totalCellLength = nonEmptyCells.reduce((sum, c) => sum + c.length, 0);
    const avgCellLength = nonEmptyCells.length > 0 ? totalCellLength / nonEmptyCells.length : 0;
    const maxCellLength = nonEmptyCells.length > 0 ? Math.max(...nonEmptyCells.map(c => c.length)) : 0;
    const numericComparisonColumns = table.headerRow.reduce((count, _, index) => {
        if (looksOrdered && index === 0) return count;
        const columnValues = table.bodyRows.map(row => stripTableMarkdown(row[index] || "")).filter(v => v !== "" && v !== "—");
        if (columnValues.length === 0) return count;
        const numericRatio = columnValues.filter(looksNumericTableCell).length / columnValues.length;
        return count + (numericRatio >= 0.6 ? 1 : 0);
    }, 0);
    const densityScore = table.columnCount + (numericComparisonColumns * 2) + (denseHeaders.length * 2.5) +
        (Math.max(0, avgCellLength - 18) / 12) + (Math.max(0, maxCellLength - 72) / 24);
    const isLabelValueTable = table.columnCount <= 2;
    const isChecklistTable = table.columnCount <= 4 && (looksOrdered || checklistHeaderCount > 0) &&
        denseHeaders.length === 0 && numericComparisonColumns <= 1 && avgCellLength <= 70;
    const isShortScannableTable = table.columnCount <= 3 && denseHeaders.length === 0 &&
        numericComparisonColumns <= 1 && avgCellLength <= 32 && maxCellLength <= 90;
    return {
        allowInline: isLabelValueTable || isChecklistTable || isShortScannableTable || densityScore < 7.5,
        densityScore, avgCellLength, numericComparisonColumns, denseHeaders,
    };
}

function assertInlineTableAllowed(table, lineNumber) {
    const classification = classifyMarkdownTableForInline(table);
    if (classification.allowInline) return;
    const reasons = [];
    if (table.columnCount >= 5) reasons.push(`${table.columnCount} columns`);
    if (classification.denseHeaders.length > 0) reasons.push(`comparison headers: ${classification.denseHeaders.join(", ")}`);
    if (classification.numericComparisonColumns >= 2) reasons.push(`${classification.numericComparisonColumns} numeric columns`);
    if (classification.avgCellLength >= 36) reasons.push(`avg cell length ${Math.round(classification.avgCellLength)}`);
    if (reasons.length === 0) reasons.push(`density score ${classification.densityScore.toFixed(1)}`);
    const headerPreview = table.headerRow.map(h => stripTableMarkdown(h)).filter(Boolean).slice(0, 4).join(" | ");
    throw new Error(
        `Dense table blocked near line ${lineNumber}${headerPreview ? ` (${headerPreview})` : ""}. ${reasons.join(", ")}. ` +
        "Use render_table_image first."
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
        const label = headerRow[index] || `Column ${index + 1}`;
        content.push(buildLabeledTableParagraph(label, cell));
    });
    if (content.length === 0) content.push(buildParagraph([{ type: "text", text: row.join(" | ") }]));
    return { type: "list_item", content };
}

function parseTable(input) {
    const table = Array.isArray(input) ? parseMarkdownTableLines(input) : input;
    if (!table) return null;
    const { headerRow, bodyRows } = table;
    if (bodyRows.length === 0) {
        return buildParagraph([{ type: "text", text: headerRow.join(" · "), marks: [{ type: "bold" }] }]);
    }
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
            type: "caption",
            content: caption ? [{ type: "text", text: caption }] : [],
        }],
    };
}

const DEFAULT_SUBSCRIBE_CAPTION =
    "Thanks for reading NFL Lab! Subscribe for free to receive new posts and support our work.";

const FOOTER_PARAGRAPH_PATTERNS = [
    /\bThe NFL Lab\b/i,
    /\bAbout the NFL Lab Expert Panel\b/i,
    /\bWant us to evaluate\b/i,
    /\bDrop (?:it|your take) in the comments\b/i,
    /^\s*Next from the panel:/i,
    // New "War Room" brand footer (2026-07-25)
    /\bvirtual front office\b/i,
    /\bWelcome to the War Room\b/i,
    /\bwant us to break down\b/i,
];

const PANEL_ROLLCALL_RE = /^(?:[A-Z][A-Za-z]+|[A-Z]{2,})(?:\s*[·•]\s*(?:[A-Z][A-Za-z]+|[A-Z]{2,}))+$/;

const CHART_TABLE_IMAGE_PATH_RE =
    /(?:^|[-_/])(table|chart|data|decision|priority|comparison|breakdown|salary|contract|depth-chart|matrix|targets|snapshot|blueprint|paths|question-vs|panelist-vs|year-vs|expert-vs|prospect-vs|path-vs|model-vs|move-vs|deployment-model|dead-cap-comparison|engram-decision|pick-30-options)(?:[-_.\\/]|$)/i;
const CHART_TABLE_IMAGE_TEXT_RE =
    /\b(rows?|columns?|table|comparison|decision matrix|blueprint|depth chart|cap hit|dead cap|projected cap|draft targets|question vs|panelist vs|path vs|year vs|expert vs)\b/i;

function buildSubscribeWidget(captionText) {
    return {
        type: "subscribeWidget",
        attrs: { url: "%%checkout_url%%", text: "Subscribe", language: "en" },
        content: [{
            type: "ctaCaption",
            content: [{ type: "text", text: captionText || DEFAULT_SUBSCRIBE_CAPTION }],
        }],
    };
}

function getNodeText(node) {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    if (!Array.isArray(node.content)) return "";
    return node.content.map(getNodeText).join("");
}

function isBylineParagraph(node) {
    return node?.type === "paragraph" && /\bBy:\s*The NFL Lab Expert Panel\b/i.test(getNodeText(node).trim());
}

function isPanelRollCallParagraph(node) {
    if (node?.type !== "paragraph") return false;
    const text = getNodeText(node).trim();
    return text.length <= 80 && PANEL_ROLLCALL_RE.test(text);
}

function isTldrParagraph(node) {
    return node?.type === "paragraph" && /\bTL;?DR\b/i.test(getNodeText(node).trim());
}

function isFooterParagraph(node) {
    if (node?.type !== "paragraph") return false;
    const text = getNodeText(node).trim();
    return FOOTER_PARAGRAPH_PATTERNS.some((pattern) => pattern.test(text));
}

function findOpeningParagraphIndex(content) {
    for (let i = 0; i < content.length; i++) {
        const node = content[i];
        if (node?.type !== "paragraph") continue;
        const text = getNodeText(node).trim();
        if (!text) continue;
        if (isBylineParagraph(node) || isPanelRollCallParagraph(node) || isTldrParagraph(node) || isFooterParagraph(node)) {
            continue;
        }
        return i;
    }
    return -1;
}

function findClosingNotesInsertIndex(content) {
    for (let i = 0; i < content.length; i++) {
        if (!isFooterParagraph(content[i])) continue;
        return i > 0 && content[i - 1].type === "horizontal_rule" ? i - 1 : i;
    }

    for (let i = content.length - 1; i >= 0; i--) {
        if (content[i].type === "horizontal_rule") return i;
    }

    return content.length;
}

function ensureSubscribeButtons(doc) {
    const content = doc.content;
    if (!Array.isArray(content) || content.length === 0) return doc;

    const subscribeIndices = [];
    for (let i = 0; i < content.length; i++) {
        if (content[i].type === "subscribeWidget") subscribeIndices.push(i);
    }
    if (subscribeIndices.length >= 2) return doc;

    const openingParaIdx = findOpeningParagraphIndex(content);
    const closingNotesIdx = findClosingNotesInsertIndex(content);
    const midpoint = Math.floor(content.length / 2);

    const hasEarlyWidget = openingParaIdx >= 0
        ? subscribeIndices.some((idx) => idx >= openingParaIdx && idx <= openingParaIdx + 2)
        : subscribeIndices.some((idx) => idx <= midpoint);
    const hasLateWidget = closingNotesIdx >= 0
        ? subscribeIndices.some((idx) => idx >= Math.max(0, closingNotesIdx - 2))
        : subscribeIndices.some((idx) => idx >= midpoint);

    const insertions = [];
    if (!hasLateWidget && closingNotesIdx >= 0) insertions.push(closingNotesIdx);
    if (!hasEarlyWidget && openingParaIdx >= 0) insertions.push(openingParaIdx + 1);

    insertions
        .sort((a, b) => b - a)
        .forEach((index) => content.splice(Math.min(index, content.length), 0, buildSubscribeWidget()));

    return doc;
}

function getImageDescriptor(node) {
    const img = (node.content || []).find((child) => child.type === "image2");
    const caption = (node.content || []).find((child) => child.type === "caption");
    return {
        src: img?.attrs?.src || "",
        alt: img?.attrs?.alt || "",
        caption: getNodeText(caption).trim(),
    };
}

function ensureHeroFirstImage(doc) {
    const content = doc.content;
    if (!Array.isArray(content)) return { safe: true };

    const imageIndices = [];
    for (let i = 0; i < content.length; i++) {
        if (content[i].type === "captionedImage") imageIndices.push(i);
    }
    if (imageIndices.length === 0) return { safe: true };

    function looksLikeChart(node) {
        const { src, alt, caption } = getImageDescriptor(node);
        const text = `${alt} ${caption}`.trim();
        return CHART_TABLE_IMAGE_PATH_RE.test(src) || CHART_TABLE_IMAGE_TEXT_RE.test(text);
    }

    const firstIdx = imageIndices[0];
    if (!looksLikeChart(content[firstIdx])) return { safe: true };

    const safeCandidates = imageIndices
        .slice(1)
        .filter((idx) => !looksLikeChart(content[idx]))
        .sort((a, b) => {
            const aSrc = getImageDescriptor(content[a]).src;
            const bSrc = getImageDescriptor(content[b]).src;
            const aInline = /inline-\d+/i.test(aSrc) ? 0 : 1;
            const bInline = /inline-\d+/i.test(bSrc) ? 0 : 1;
            return aInline - bInline || a - b;
        });

    if (safeCandidates.length === 0) {
        return { safe: false, warning: "No hero-safe image available to move into first position." };
    }

    const swapIdx = safeCandidates[0];
    [content[firstIdx], content[swapIdx]] = [content[swapIdx], content[firstIdx]];
    return { safe: true, warning: `Swapped first image with position ${swapIdx} for hero safety.` };
}

function extractYouTubeId(input) {
    if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
    const short = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (short) return short[1];
    const long = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (long) return long[1];
    return null;
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

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            content.push({ type: "horizontal_rule" });
            i++; continue;
        }

        const ytLine = trimmed.match(/^::youtube\s+(.+)$/i);
        if (ytLine) {
            const videoId = extractYouTubeId(ytLine[1].trim());
            if (videoId) content.push({ type: "youtube2", attrs: { videoId, startTime: null, endTime: null } });
            i++; continue;
        }

        const subLine = trimmed.match(/^::subscribe(?:\s+(.+))?$/i);
        if (subLine) {
            content.push(buildSubscribeWidget(subLine[1] || DEFAULT_SUBSCRIBE_CAPTION));
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
            while (i < lines.length && lines[i].trimStart().startsWith("> ")) {
                bqLines.push(lines[i].replace(/^\s*>\s?/, ""));
                i++;
            }
            const normalizedBqLines = bqLines.map(l => l.trim()).filter(l => l !== "");
            const firstBqLine = normalizedBqLines[0] || "";
            const remainingBqLines = normalizedBqLines.slice(1);
            const isTldrBlock = /TLDR/i.test(firstBqLine.replace(/\*/g, "")) &&
                remainingBqLines.length > 0 && remainingBqLines.every(l => /^[-*+]\s+/.test(l));
            if (isTldrBlock) {
                content.push({ type: "paragraph", content: parseInline(firstBqLine) });
                content.push({
                    type: "bullet_list",
                    content: remainingBqLines.map(t => ({
                        type: "list_item",
                        content: [{ type: "paragraph", content: parseInline(t.replace(/^[-*+]\s+/, "")) }],
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

        if (trimmed.startsWith("|")) {
            const tableStartLine = i + 1;
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i]); i++; }
            const parsedTable = parseMarkdownTableLines(tableLines);
            assertInlineTableAllowed(parsedTable, tableStartLine);
            const table = parseTable(parsedTable);
            if (table) {
                if (Array.isArray(table)) content.push(...table);
                else content.push(table);
            }
            continue;
        }

        if (/^[-*+]\s/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s/, "")); i++; }
            content.push({
                type: "bullet_list",
                content: items.map(t => ({ type: "list_item", content: [{ type: "paragraph", content: parseInline(t) }] })),
            });
            continue;
        }

        if (/^\d+\.\s/.test(trimmed)) {
            const items = [];
            let start = parseInt(trimmed.match(/^(\d+)\./)[1], 10);
            while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s/, "")); i++; }
            content.push({
                type: "ordered_list", attrs: { start, order: start, type: null },
                content: items.map(t => ({ type: "list_item", content: [{ type: "paragraph", content: parseInline(t) }] })),
            });
            continue;
        }

        const paraLines = [];
        while (
            i < lines.length && lines[i].trim() !== "" &&
            !/^#{1,3}\s/.test(lines[i].trim()) && !lines[i].trim().startsWith("> ") &&
            !lines[i].trim().startsWith("|") && !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
            !/^::(?:youtube|subscribe)\s/i.test(lines[i].trim()) && !/^\s*[-*+]\s/.test(lines[i]) &&
            !/^\s*\d+\.\s/.test(lines[i]) && !/^!\[[^\]]*\]\(/.test(lines[i].trim())
        ) { paraLines.push(lines[i]); i++; }
        if (paraLines.length > 0) content.push({ type: "paragraph", content: parseInline(paraLines.join(" ")) });
    }

    return { type: "doc", attrs: { schemaVersion: "v1" }, content };
}

// ─── Pipeline DB ─────────────────────────────────────────────────────────────

function getDb() {
    return new DatabaseSync(resolve(process.cwd(), "content", "pipeline.db"));
}

function getStage7Articles() {
    const db = getDb();
    const rows = db.prepare(
        "SELECT id, article_path, primary_team, current_stage, status, substack_draft_url FROM articles WHERE current_stage = 7 ORDER BY id"
    ).all();
    db.close();
    return rows;
}

function updateDraftUrl(slug, url) {
    const db = getDb();
    db.prepare("UPDATE articles SET substack_draft_url = ?, updated_at = datetime('now') WHERE id = ?").run(url, slug);
    db.close();
}

function extractDraftIdFromUrl(url) {
    if (!url) return null;
    const m = url.match(/\/publish\/post\/(\d+)/);
    return m ? m[1] : null;
}

// ─── Batch Publishing ────────────────────────────────────────────────────────

const MODE = process.argv[2] || "stage"; // "stage" or "prod"
const ONLY_SLUG = process.argv[3] || null; // optional: comma-separated slugs or single slug

async function publishArticle(article, target) {
    const { id, article_path, primary_team, substack_draft_url } = article;
    const filePath = resolve(process.cwd(), article_path);
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

    const markdown = readFileSync(filePath, "utf-8");
    const extracted = extractMetaFromMarkdown(markdown);
    const title = extracted.title;
    const subtitle = extracted.subtitle || "";
    const bodyMarkdown = extracted.bodyMarkdown;

    const subdomain = target === "prod" ? PROD_SUBDOMAIN : STAGE_SUBDOMAIN;
    const articleDir = dirname(filePath);
    const tags = deriveTagsFromArticleDir(articleDir, primary_team);

    const uploadImage = (localPath) => uploadImageToSubstack(subdomain, localPath, articleDir);
    const body = await markdownToProseMirror(bodyMarkdown, uploadImage);
    ensureSubscribeButtons(body);
    ensureHeroFirstImage(body);

    // Determine if we should update an existing draft or create a new one
    let draftUrl = null;
    let existingDraftId = null;

    if (target === "stage" && substack_draft_url && substack_draft_url.includes(`${STAGE_SUBDOMAIN}.substack.com`)) {
        // Update existing staging draft
        existingDraftId = extractDraftIdFromUrl(substack_draft_url);
        draftUrl = substack_draft_url;
    } else if (target === "prod" && substack_draft_url &&
               substack_draft_url.includes(`${PROD_SUBDOMAIN}.substack.com`) &&
               !substack_draft_url.includes(`${STAGE_SUBDOMAIN}.substack.com`)) {
        // Update existing prod draft
        existingDraftId = extractDraftIdFromUrl(substack_draft_url);
        draftUrl = substack_draft_url;
    }

    if (existingDraftId) {
        await updateSubstackDraft({ subdomain, draftId: existingDraftId, title, subtitle, body, audience: "everyone", tags });
        return { action: "updated", draftUrl, title };
    } else {
        const draft = await createSubstackDraft({ subdomain, title, subtitle, body, audience: "everyone", tags });
        draftUrl = `https://${subdomain}.substack.com/publish/post/${draft.id}`;
        return { action: "created", draftUrl, title };
    }
}

async function run() {
    const articles = getStage7Articles();
    const slugFilter = ONLY_SLUG ? ONLY_SLUG.split(",") : null;
    const filtered = slugFilter ? articles.filter(a => slugFilter.includes(a.id)) : articles;

    console.log(`\n=== Batch Publish: ${MODE.toUpperCase()} ===`);
    console.log(`Articles: ${filtered.length}\n`);

    const results = { success: [], failed: [], skipped: [] };

    for (const article of filtered) {
        const slug = article.id;
        try {
            // For prod mode, skip articles that already have prod drafts unless DEN (needs update)
            if (MODE === "prod") {
                const currentUrl = article.substack_draft_url || "";
                // Must check exact subdomain match — nfllabstage contains nfllab
                const hasProdDraft = currentUrl.includes(`${PROD_SUBDOMAIN}.substack.com`) &&
                    !currentUrl.includes(`${STAGE_SUBDOMAIN}.substack.com`);
                // DEN was affected by table cleanup, so update it
                // MIA was NOT affected, so skip
                if (hasProdDraft && slug !== "den-2026-offseason") {
                    console.log(`⏭️  ${slug} — already has prod draft, skipping`);
                    results.skipped.push({ slug, reason: "already on prod", url: currentUrl });
                    continue;
                }
            }

            // Retry logic for 429s
            let result = null;
            let attempts = 0;
            const MAX_RETRIES = 3;
            while (attempts < MAX_RETRIES) {
                try {
                    process.stdout.write(`📤 ${slug} → ${MODE}${attempts > 0 ? ` (retry ${attempts})` : ""}... `);
                    result = await publishArticle(article, MODE);
                    console.log(`✅ ${result.action} — ${result.draftUrl}`);
                    break;
                } catch (retryErr) {
                    attempts++;
                    if (retryErr.message.includes("429") && attempts < MAX_RETRIES) {
                        const wait = 10000 * attempts; // 10s, 20s, 30s
                        console.log(`⏳ Rate limited, waiting ${wait/1000}s...`);
                        await new Promise(r => setTimeout(r, wait));
                    } else {
                        throw retryErr;
                    }
                }
            }
            if (!result) throw new Error("Max retries exceeded");

            // If prod, update the DB with the prod URL
            if (MODE === "prod") {
                updateDraftUrl(slug, result.draftUrl);
                console.log(`   💾 DB updated: substack_draft_url → ${result.draftUrl}`);
            }

            results.success.push({ slug, ...result });

            // Rate limit: longer delay to avoid 429s
            await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
            console.log(`❌ FAILED — ${err.message}`);
            results.failed.push({ slug, error: err.message });
        }
    }

    // Summary
    console.log(`\n=== RESULTS: ${MODE.toUpperCase()} ===`);
    console.log(`✅ Success: ${results.success.length}`);
    console.log(`⏭️  Skipped: ${results.skipped.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);

    if (results.failed.length > 0) {
        console.log("\nFailed articles:");
        for (const f of results.failed) console.log(`  - ${f.slug}: ${f.error}`);
    }
    if (results.skipped.length > 0) {
        console.log("\nSkipped articles:");
        for (const s of results.skipped) console.log(`  - ${s.slug}: ${s.reason} (${s.url})`);
    }

    // Output JSON for programmatic use
    const jsonPath = resolve(process.cwd(), `batch-publish-${MODE}-results.json`);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${jsonPath}`);
}

run().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});

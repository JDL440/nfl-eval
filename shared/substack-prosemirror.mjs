/**
 * substack-prosemirror.mjs — Shared ProseMirror parsing and post-processing.
 *
 * Extracted from .github/extensions/substack-publisher/extension.mjs so that
 * the publisher extension, dashboard preview, and any future consumer share a
 * single canonical implementation of markdown → ProseMirror conversion,
 * subscribe-button injection, hero-image safety, and dense-table blocking.
 *
 * ZERO external dependencies — pure string/object transforms only.
 *
 * Extension import:
 *   import { markdownToProseMirror, ... } from "../../../shared/substack-prosemirror.mjs";
 *
 * Dashboard import:
 *   import { markdownToProseMirror, ... } from "../shared/substack-prosemirror.mjs";
 */

// ─── Inline parser ───────────────────────────────────────────────────────────

export function parseInline(text) {
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
            parts.push({ type: "text", text: match[2], marks: [{ type: "bold" }, { type: "italic" }] });
        } else if (match[3]) {
            parts.push({ type: "text", text: match[3], marks: [{ type: "bold" }] });
        } else if (match[4]) {
            parts.push({ type: "text", text: match[4], marks: [{ type: "italic" }] });
        } else if (match[5]) {
            parts.push({ type: "text", text: match[5], marks: [{ type: "italic" }] });
        } else if (match[6] && match[7]) {
            parts.push({ type: "text", text: match[6], marks: [{ type: "link", attrs: { href: match[7], target: "_blank" } }] });
        }
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: "text", text: text.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: "text", text: text || " " }];
}

export function buildParagraph(content) {
    return {
        type: "paragraph",
        content: content.length > 0 ? content : [{ type: "text", text: " " }],
    };
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

export function extractYouTubeId(input) {
    if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
    const short = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (short) return short[1];
    const long = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (long) return long[1];
    return null;
}

// ─── Images ──────────────────────────────────────────────────────────────────

export function buildCaptionedImage(src, alt, caption) {
    const imageNode = {
        type: "image2",
        attrs: {
            src, alt: alt || null, title: caption || null,
            srcNoWatermark: null, fullscreen: null, imageSize: "normal",
            height: null, width: null, resizeWidth: null, bytes: null,
            type: null, href: null, belowTheFold: false, topImage: false,
            internalRedirect: null, isProcessing: false, align: null, offset: false,
        },
    };
    const captionNode = {
        type: "caption",
        content: caption ? [{ type: "text", text: caption }] : [],
    };
    return { type: "captionedImage", attrs: {}, content: [imageNode, captionNode] };
}

// ─── Node text utility ───────────────────────────────────────────────────────

export function getNodeText(node) {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    if (!Array.isArray(node.content)) return "";
    return node.content.map(getNodeText).join("");
}

// ─── Subscribe widget ────────────────────────────────────────────────────────

export const DEFAULT_SUBSCRIBE_CAPTION =
    "Thanks for reading NFL Lab! Subscribe for free to receive new posts and support our work.";

export const FOOTER_PARAGRAPH_PATTERNS = [
    /\bThe NFL Lab\b/i,
    /\bAbout the NFL Lab Expert Panel\b/i,
    /\bWant us to evaluate\b/i,
    /\bDrop (?:it|your take) in the comments\b/i,
    /^\s*Next from the panel:/i,
    /\bvirtual front office\b/i,
    /\bWelcome to the War Room\b/i,
    /\bwant us to break down\b/i,
];

export const PANEL_ROLLCALL_RE = /^(?:[A-Z][A-Za-z]+|[A-Z]{2,})(?:\s*[·•]\s*(?:[A-Z][A-Za-z]+|[A-Z]{2,}))+$/;

export function buildSubscribeWidget(captionText) {
    return {
        type: "subscribeWidget",
        attrs: { url: "%%checkout_url%%", text: "Subscribe", language: "en" },
        content: [{
            type: "ctaCaption",
            content: [{ type: "text", text: captionText || DEFAULT_SUBSCRIBE_CAPTION }],
        }],
    };
}

function isBylineParagraph(node) {
    if (node?.type !== "paragraph") return false;
    return /\bBy:\s*The NFL Lab Expert Panel\b/i.test(getNodeText(node).trim());
}

function isPanelRollCallParagraph(node) {
    if (node?.type !== "paragraph") return false;
    const text = getNodeText(node).trim();
    return text.length <= 80 && PANEL_ROLLCALL_RE.test(text);
}

function isTldrParagraph(node) {
    if (node?.type !== "paragraph") return false;
    return /\bTL;?DR\b/i.test(getNodeText(node).trim());
}

export function isFooterParagraph(node) {
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
        if (isBylineParagraph(node) || isPanelRollCallParagraph(node) || isTldrParagraph(node) || isFooterParagraph(node)) continue;
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

export function ensureSubscribeButtons(doc) {
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

// ─── Hero-image safety ───────────────────────────────────────────────────────

export const CHART_TABLE_IMAGE_PATH_RE =
    /(?:^|[-_/])(table|chart|data|decision|priority|comparison|breakdown|salary|contract|depth-chart|matrix|targets|snapshot|blueprint|paths|question-vs|panelist-vs|year-vs|expert-vs|prospect-vs|path-vs|model-vs|move-vs|deployment-model|dead-cap-comparison|engram-decision|pick-30-options)(?:[-_.\\/]|$)/i;
export const CHART_TABLE_IMAGE_TEXT_RE =
    /\b(rows?|columns?|table|comparison|decision matrix|blueprint|depth chart|cap hit|dead cap|projected cap|draft targets|question vs|panelist vs|path vs|year vs|expert vs)\b/i;

function getImageDescriptor(node) {
    const img = (node.content || []).find((child) => child.type === "image2");
    const caption = (node.content || []).find((child) => child.type === "caption");
    return {
        src: img?.attrs?.src || "",
        alt: img?.attrs?.alt || "",
        caption: getNodeText(caption).trim(),
    };
}

export function ensureHeroFirstImage(doc) {
    const content = doc.content;
    if (!content) return { safe: true };

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

    if (safeCandidates.length > 0) {
        const swapIdx = safeCandidates[0];
        [content[firstIdx], content[swapIdx]] = [content[swapIdx], content[firstIdx]];
        return {
            safe: true,
            warning: `⚠️ First image was a chart/table — swapped with image at position ${swapIdx} for hero safety.`,
        };
    }

    return {
        safe: false,
        warning: "⚠️ First image appears to be a chart/table but no hero-safe image was found to swap. " +
            "The social share thumbnail may not be visually appealing. Regenerate inline-1 as a true hero image before publishing.",
    };
}

// ─── Table helpers ───────────────────────────────────────────────────────────

export function stripTableMarkdown(value) {
    return String(value || "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/(^|[\s(])_([^_\n]+)_(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
        .trim();
}

export function normalizeTableHeader(value) {
    return stripTableMarkdown(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isDetailTableHeader(value) {
    const normalized = normalizeTableHeader(value);
    return /^(current state|severity|status|budget|aav|year 1 cap hit|cap hit|comp range|draft range|profile|school|notes?)$/.test(normalized);
}

export function isDenseTableHeader(value) {
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

export function splitMarkdownTableRow(line) {
    let working = String(line || "").trim();
    if (working.startsWith("|")) working = working.slice(1);
    if (working.endsWith("|")) working = working.slice(0, -1);

    const cells = [];
    let current = "";

    for (let i = 0; i < working.length; i++) {
        const char = working[i];
        const next = working[i + 1];
        if (char === "\\" && (next === "|" || next === "\\")) { current += next; i += 1; continue; }
        if (char === "|") { cells.push(current.trim()); current = ""; continue; }
        current += char;
    }
    cells.push(current.trim());
    return cells;
}

export function isMarkdownTableSeparatorRow(row) {
    return row.length > 0 && row.every((cell) => /^:?-{3,}:?$/.test(String(cell || "").trim()));
}

export function normalizeTableCells(row, length, fill = "") {
    return Array.from({ length }, (_, index) => row[index] ?? fill);
}

export function parseMarkdownTableLines(lines) {
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

export function looksNumericTableCell(value) {
    const normalized = stripTableMarkdown(value)
        .replace(/[$,%~≈]/g, "")
        .replace(/[()]/g, "")
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, "")
        .replace(/m$/i, "")
        .replace(/aav$/i, "");
    return normalized !== "" && /^[-+]?\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$/.test(normalized);
}

export function classifyMarkdownTableForInline(table) {
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

export function assertInlineTableAllowed(table, lineNumber) {
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

    if (ordered && /^\d+$/.test(row[0] || "")) usedIndices.add(0);

    const primaryTitle = row[leadIndex] || "";
    if (primaryTitle) { titleParts.push(primaryTitle); usedIndices.add(leadIndex); }

    const secondaryIndex = leadIndex + 1;
    const secondaryTitle = row[secondaryIndex] || "";
    const secondaryHeader = headerRow[secondaryIndex] || "";
    if (secondaryTitle && !isDetailTableHeader(secondaryHeader) && secondaryTitle.length <= 40) {
        titleParts.push(secondaryTitle);
        usedIndices.add(secondaryIndex);
    }

    if (titleParts.length === 0) {
        const fallbackIndex = row.findIndex((cell) => cell && cell.trim() !== "");
        if (fallbackIndex >= 0) { titleParts.push(row[fallbackIndex]); usedIndices.add(fallbackIndex); }
    }

    return { title: titleParts.join(" — "), usedIndices };
}

function buildTableListItem(row, headerRow, ordered) {
    const { title, usedIndices } = getTableTitleParts(row, headerRow, ordered);
    const content = [];

    if (title) {
        content.push(buildParagraph([{ type: "text", text: title, marks: [{ type: "bold" }] }]));
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

export function parseTable(input) {
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
            ? Math.max(1, parseInt(bodyRows[0][0], 10)) : 1;
        return { type: "ordered_list", attrs: { start, order: start, type: null }, content: listItems };
    }

    return { type: "bullet_list", content: listItems };
}

// ─── Post-conversion validation ──────────────────────────────────────────────

export const KNOWN_SUBSTACK_NODE_TYPES = new Set([
    "doc", "paragraph", "text", "heading", "horizontal_rule",
    "blockquote", "bullet_list", "ordered_list", "list_item",
    "captionedImage", "image2", "caption",
    "youtube2", "table", "table_row", "table_cell", "table_header",
    "hard_break", "code_block",
    "subscribeWidget", "ctaCaption",
]);

export function findUnknownNodeTypes(node, path = "root") {
    const issues = [];
    if (node.type && !KNOWN_SUBSTACK_NODE_TYPES.has(node.type)) {
        issues.push({ type: node.type, path });
    }
    if (Array.isArray(node.content)) {
        node.content.forEach((child, i) => {
            issues.push(...findUnknownNodeTypes(child, `${path}.content[${i}]`));
        });
    }
    return issues;
}

export function validateProseMirrorBody(body) {
    const issues = [];
    const unknowns = findUnknownNodeTypes(body);
    for (const u of unknowns) issues.push(`Unknown node type "${u.type}" at ${u.path}`);

    function walkStructure(node, path) {
        if (node.type === "captionedImage") {
            const childTypes = (node.content || []).map(c => c.type);
            if (childTypes[0] !== "image2") issues.push(`captionedImage at ${path} missing image2 as first child (got: ${childTypes[0] || "nothing"})`);
            if (childTypes[1] !== "caption") issues.push(`captionedImage at ${path} missing caption as second child (got: ${childTypes[1] || "nothing"})`);
            if (childTypes.length !== 2) issues.push(`captionedImage at ${path} has ${childTypes.length} children (expected 2: image2 + caption)`);
        }
        if (node.type === "subscribeWidget") {
            const childTypes = (node.content || []).map(c => c.type);
            if (childTypes.length !== 1 || childTypes[0] !== "ctaCaption") {
                issues.push(`subscribeWidget at ${path} must contain exactly one ctaCaption child (got: ${childTypes.join(", ") || "nothing"})`);
            }
        }
        if (Array.isArray(node.content)) {
            node.content.forEach((child, i) => walkStructure(child, `${path}.content[${i}]`));
        }
    }
    walkStructure(body, "root");

    if (issues.length === 0) return { valid: true, issues: [] };
    return { valid: false, issues };
}

// ─── Markdown → ProseMirror ──────────────────────────────────────────────────

/**
 * Convert markdown to Substack's ProseMirror JSON format.
 *
 * @param {string} markdown    - Raw markdown text.
 * @param {Function|null} uploadImage - Async callback for local image upload (null for preview).
 * @param {object} [options]   - Optional behaviour overrides.
 * @param {boolean} [options.previewMode] - When true, dense tables produce warnings instead of
 *                               throwing, and the returned doc carries a `_warnings` array.
 */
export async function markdownToProseMirror(markdown, uploadImage, options = {}) {
    const warnings = [];

    markdown = markdown.replace(/<!--[\s\S]*?-->/g, "");
    const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const content = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "") { i++; continue; }

        // Heading
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
            content.push({ type: "heading", attrs: { level: headingMatch[1].length }, content: parseInline(headingMatch[2]) });
            i++; continue;
        }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            content.push({ type: "horizontal_rule" });
            i++; continue;
        }

        // YouTube embed
        const ytLine = trimmed.match(/^::youtube\s+(.+)$/i);
        if (ytLine) {
            const videoId = extractYouTubeId(ytLine[1].trim());
            if (videoId) content.push({ type: "youtube2", attrs: { videoId, startTime: null, endTime: null } });
            i++; continue;
        }

        // Subscribe widget
        const subLine = trimmed.match(/^::subscribe(?:\s+(.+))?$/i);
        if (subLine) {
            content.push(buildSubscribeWidget(subLine[1] || DEFAULT_SUBSCRIBE_CAPTION));
            i++; continue;
        }

        // Standalone image
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

        // Blockquote
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
                content.push({ type: "paragraph", content: parseInline(firstBqLine) });
                content.push({
                    type: "bullet_list",
                    content: remainingBqLines.map((t) => ({
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

        // Table
        if (trimmed.startsWith("|")) {
            const tableStartLine = i + 1;
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) {
                tableLines.push(lines[i]);
                i++;
            }
            const parsedTable = parseMarkdownTableLines(tableLines);

            // Dense-table gate: throw in publish mode, warn in preview mode
            if (options.previewMode) {
                const classification = classifyMarkdownTableForInline(parsedTable);
                if (!classification.allowInline) {
                    const headerPreview = parsedTable.headerRow
                        .map((h) => stripTableMarkdown(h)).filter(Boolean).slice(0, 4).join(" | ");
                    warnings.push({
                        type: "dense_table",
                        line: tableStartLine,
                        message: `Dense table near line ${tableStartLine}${headerPreview ? ` (${headerPreview})` : ""} — must be rendered as image before publishing. Density score: ${classification.densityScore.toFixed(1)}.`,
                    });
                }
            } else {
                assertInlineTableAllowed(parsedTable, tableStartLine);
            }

            const table = parseTable(parsedTable);
            if (table) {
                if (Array.isArray(table)) content.push(...table);
                else content.push(table);
            }
            continue;
        }

        // Unordered list
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

        // Ordered list
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

        // Paragraph
        const paraLines = [];
        while (
            i < lines.length &&
            lines[i].trim() !== "" &&
            !/^#{1,3}\s/.test(lines[i].trim()) &&
            !lines[i].trim().startsWith("> ") &&
            !lines[i].trim().startsWith("|") &&
            !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
            !/^::(?:youtube|subscribe)\s/i.test(lines[i].trim()) &&
            !/^\s*[-*+]\s/.test(lines[i]) &&
            !/^\s*\d+\.\s/.test(lines[i]) &&
            !/^!\[[^\]]*\]\(/.test(lines[i].trim())
        ) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            content.push({ type: "paragraph", content: parseInline(paraLines.join(" ")) });
        }
    }

    const doc = { type: "doc", attrs: { schemaVersion: "v1" }, content };
    if (options.previewMode) doc._warnings = warnings;
    return doc;
}

// ─── Meta extraction ─────────────────────────────────────────────────────────

export function extractMetaFromMarkdown(markdown) {
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
            if (line.trim() !== "") break;
        }
    }

    const skipLines = new Set([titleLineIdx, subtitleLineIdx].filter((i) => i >= 0));
    const bodyLines = lines.filter((_, i) => !skipLines.has(i));
    while (bodyLines.length > 0 && bodyLines[0].trim() === "") bodyLines.shift();
    if (bodyLines.length > 0 && /^(-{3,}|\*{3,}|_{3,})$/.test(bodyLines[0].trim())) {
        bodyLines.shift();
        while (bodyLines.length > 0 && bodyLines[0].trim() === "") bodyLines.shift();
    }
    const bodyMarkdown = bodyLines.join("\n");

    return { title, subtitle, bodyMarkdown };
}

/**
 * Table Image Renderer — Copilot CLI Extension
 *
 * Deterministically renders markdown tables to publication-grade PNGs using
 * local HTML/CSS templates and Playwright element-level screenshots.
 */

import {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const TEMPLATE_PRESETS = {
    "generic-comparison": {
        label: "Comparison table",
        eyebrow: "Deterministic local render",
        accent: "#2563eb",
        accentStrong: "#0f4c81",
        accentTint: "rgba(59, 130, 246, 0.18)",
        badgeBackground: "#dbeafe",
        badgeText: "#1d4ed8",
    },
    "cap-comparison": {
        label: "Cap comparison",
        eyebrow: "Salary-cap visual",
        accent: "#059669",
        accentStrong: "#047857",
        accentTint: "rgba(16, 185, 129, 0.18)",
        badgeBackground: "#d1fae5",
        badgeText: "#047857",
    },
    "draft-board": {
        label: "Draft board snapshot",
        eyebrow: "Draft-layout render",
        accent: "#7c3aed",
        accentStrong: "#5b21b6",
        accentTint: "rgba(139, 92, 246, 0.18)",
        badgeBackground: "#ede9fe",
        badgeText: "#6d28d9",
    },
    "priority-list": {
        label: "Priority table",
        eyebrow: "Editorial priority render",
        accent: "#ea580c",
        accentStrong: "#c2410c",
        accentTint: "rgba(249, 115, 22, 0.18)",
        badgeBackground: "#ffedd5",
        badgeText: "#c2410c",
    },
};

const TEMPLATE_ALIASES = {
    auto: "auto",
    comparison: "generic-comparison",
    generic: "generic-comparison",
    cap: "cap-comparison",
    draft: "draft-board",
    priority: "priority-list",
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const RENDER_LAYOUT = Object.freeze({
    canvasPadding: 6,
    tableFramePaddingX: 0,
    tableRadius: 10,
    tableHeaderHeight: 54,
    tableHeadFontSize: 14,
    tableHeadLineHeight: 1.15,
    tableCellFontSize: 17,
    tableCellLineHeight: 1.38,
    tableCellPaddingX: 12,
    tableCellPaddingY: 10,
    tableFirstRowMinHeight: 54,
    tableRowMinHeight: 50,
    heightSafety: 72,
});

// Mobile-optimized layout: larger fonts and tighter padding for 375px viewport readability.
// At ~58% scaling (600px canvas → 343px content area), 20px body → ~11.7px effective,
// which is legible on retina screens (23.4 physical pixels).
// tableFramePaddingX adds a safety buffer inside the table frame so that
// Chrome's subpixel column-width rounding at 2× DPR never clips the
// rightmost column's text.  4 px was insufficient — anti-aliased border-
// radius bleeding plus percentage-width rounding consumed the margin.
const MOBILE_RENDER_LAYOUT = Object.freeze({
    canvasPadding: 6,
    tableFramePaddingX: 10,
    tableRadius: 10,
    tableHeaderHeight: 50,
    tableHeadFontSize: 17,
    tableHeadLineHeight: 1.18,
    tableCellFontSize: 22,
    tableCellLineHeight: 1.36,
    tableCellPaddingX: 10,
    tableCellPaddingY: 10,
    tableFirstRowMinHeight: 52,
    tableRowMinHeight: 48,
    heightSafety: 150,
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeNewlines(value) {
    return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function stripMarkdown(value) {
    return String(value || "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/(^|[\s(])_([^_\n]+)_(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
        .trim();
}

function renderInlineMarkdownToHtml(value) {
    let html = escapeHtml(value);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(
        /(^|[\s(])\*([^*\n]+)\*(?=[$\s).,;:!?]|$)/g,
        "$1<em>$2</em>"
    );
    html = html.replace(
        /(^|[\s(])_([^_\n]+)_(?=[$\s).,;:!?]|$)/g,
        "$1<em>$2</em>"
    );
    return html.replace(/\n/g, "<br>");
}

function sanitizeMarkdownImageText(value) {
    return String(value || "")
        .replace(/[\[\]\|]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function slugify(value) {
    return String(value || "table")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "table";
}

function normalizeHeader(value) {
    return stripMarkdown(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function humanizeTemplateName(templateName) {
    return templateName.replace(/-/g, " ");
}

function estimateWrappedLineCount(text, charsPerLine) {
    const limit = Math.max(8, charsPerLine);
    const segments = String(text || "")
        .split(/\n+/)
        .map((segment) => segment.trim());

    let totalLines = 0;

    for (const segment of segments) {
        if (!segment) {
            totalLines += 1;
            continue;
        }

        const words = segment.split(/\s+/);
        let lineLength = 0;
        let lineCount = 1;

        for (const word of words) {
            const wordLength = word.length;

            if (lineLength === 0) {
                lineCount += Math.max(0, Math.ceil(wordLength / limit) - 1);
                lineLength = ((wordLength - 1) % limit) + 1;
                continue;
            }

            if ((lineLength + 1 + wordLength) <= limit) {
                lineLength += 1 + wordLength;
                continue;
            }

            lineCount += 1;
            lineCount += Math.max(0, Math.ceil(wordLength / limit) - 1);
            lineLength = ((wordLength - 1) % limit) + 1;
        }

        totalLines += lineCount;
    }

    return Math.max(1, totalLines);
}

function estimateTextHeight(text, widthPx, fontSize, lineHeight, charWidth) {
    if (!String(text || "").trim()) return 0;
    const charsPerLine = Math.max(8, Math.floor(widthPx / charWidth));
    const lineCount = estimateWrappedLineCount(text, charsPerLine);
    return Math.ceil(lineCount * fontSize * lineHeight);
}

function splitMarkdownRow(line) {
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

function isSeparatorCell(cell) {
    return /^:?-+:?$/.test(String(cell || "").trim());
}

function deriveAlignment(cell) {
    const trimmed = String(cell || "").trim();
    if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
    if (trimmed.endsWith(":")) return "right";
    if (trimmed.startsWith(":")) return "left";
    return "left";
}

function normalizeRow(row, length, fill = "") {
    return Array.from({ length }, (_, index) => row[index] ?? fill);
}

function looksNumericCell(value) {
    const normalized = stripMarkdown(value)
        .replace(/[$,%~≈]/g, "")
        .replace(/[()]/g, "")
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, "")
        .replace(/m$/i, "")
        .replace(/aav$/i, "");

    return normalized !== "" && /^[-+]?\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$/.test(normalized);
}

function inferColumnStats(headers, rows) {
    return headers.map((header, index) => {
        const bodyValues = rows.map((row) => stripMarkdown(row[index] || ""));
        const lengths = bodyValues.map((value) => value.length);
        const totalLength = lengths.reduce((sum, length) => sum + length, 0);
        const numericCount = bodyValues.filter(looksNumericCell).length;
        const headerLength = stripMarkdown(header).length;

        return {
            headerLength,
            maxLength: Math.max(headerLength, ...lengths, 0),
            avgLength: bodyValues.length > 0 ? totalLength / bodyValues.length : headerLength,
            numericRatio: bodyValues.length > 0 ? numericCount / bodyValues.length : 0,
        };
    });
}

function parseMarkdownTable(tableMarkdown) {
    const lines = normalizeNewlines(tableMarkdown)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => line.startsWith("|"));

    if (lines.length < 2) {
        throw new Error("Expected a markdown table with a header row and at least one body row.");
    }

    const rawRows = lines.map(splitMarkdownRow);
    const hasSeparator = rawRows.length > 1 && rawRows[1].every(isSeparatorCell);

    let headers = rawRows[0].map((cell) => stripMarkdown(cell));
    let bodyRows = rawRows
        .slice(hasSeparator ? 2 : 1)
        .filter((row) => row.some((cell) => stripMarkdown(cell) !== ""));

    if (bodyRows.length === 0) {
        throw new Error("Expected at least one body row in the markdown table.");
    }

    const columnCount = Math.max(headers.length, ...bodyRows.map((row) => row.length));
    headers = normalizeRow(headers, columnCount).map((cell, index) => cell || `Column ${index + 1}`);
    bodyRows = bodyRows.map((row) => normalizeRow(row, columnCount));

    const alignments = normalizeRow(hasSeparator ? rawRows[1].map(deriveAlignment) : [], columnCount, "auto");
    const columnStats = inferColumnStats(headers, bodyRows);

    return {
        headers,
        rows: bodyRows,
        alignments,
        columnStats,
        columnCount,
        rowCount: bodyRows.length,
    };
}

function extractTableBlock(markdown, tableIndex = 1) {
    const lines = normalizeNewlines(markdown).split("\n");
    const tables = [];
    let i = 0;

    while (i < lines.length) {
        if (!lines[i].trim().startsWith("|")) {
            i += 1;
            continue;
        }

        const block = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
            block.push(lines[i]);
            i += 1;
        }

        if (block.length >= 2) {
            tables.push(block.join("\n"));
        }
    }

    if (tableIndex < 1 || tableIndex > tables.length) {
        throw new Error(`Table index ${tableIndex} not found. File contains ${tables.length} markdown table(s).`);
    }

    return tables[tableIndex - 1];
}

function isAbsoluteWindowsPath(pathValue) {
    return /^([A-Za-z]:[\\/]|\\\\)/.test(String(pathValue || ""));
}

function resolveInputPath(pathValue, fallbackDir = process.cwd()) {
    if (!pathValue) {
        throw new Error("A required file path was not provided.");
    }

    return isAbsoluteWindowsPath(pathValue) ? resolve(pathValue) : resolve(fallbackDir, pathValue);
}

function resolveSourcePath(sourcePath, articleDir) {
    const candidates = [resolveInputPath(sourcePath), resolveInputPath(sourcePath, articleDir)];
    const match = candidates.find((candidate) => existsSync(candidate));

    if (!match) {
        throw new Error(`Source file not found: ${sourcePath}`);
    }

    return match;
}

function deriveArticleSlug(articleFilePath) {
    const normalized = articleFilePath.replace(/\\/g, "/");
    const nested = normalized.match(/content\/articles\/([^/]+)\/[^/]+$/);
    if (nested) return nested[1];
    return basename(normalized, extname(normalized));
}

function canonicalizeTemplate(template) {
    if (!template) return "auto";
    const normalized = String(template).trim().toLowerCase();
    if (TEMPLATE_PRESETS[normalized]) return normalized;
    if (TEMPLATE_ALIASES[normalized]) return TEMPLATE_ALIASES[normalized];

    throw new Error(
        `Unsupported template \"${template}\". Use auto, generic-comparison, cap-comparison, draft-board, or priority-list.`
    );
}

function selectTemplate(table, requestedTemplate) {
    const explicit = canonicalizeTemplate(requestedTemplate || "auto");
    if (explicit !== "auto") return explicit;

    const headerText = table.headers.map(normalizeHeader).join(" | ");
    const firstHeader = normalizeHeader(table.headers[0] || "");

    if (/priority|rank|severity|current state|checklist/.test(headerText) || /^(priority|rank|ranking|no|number)$/.test(firstHeader)) {
        return "priority-list";
    }

    if (/cap|aav|dead money|savings|salary|cash|guarantee|value|cost|hit|comp range/.test(headerText)) {
        return "cap-comparison";
    }

    if (/pick|round|prospect|school|board|availability|draft/.test(headerText)) {
        return "draft-board";
    }

    return "generic-comparison";
}

function chooseCanvasWidth(columnCount, templateName) {
    if (templateName === "priority-list") {
        return columnCount <= 4 ? 960 : 1020;
    }
    if (templateName === "cap-comparison") {
        return columnCount >= 6 ? 1120 : 1040;
    }
    if (templateName === "draft-board") {
        return columnCount >= 6 ? 1160 : 1080;
    }
    if (columnCount >= 6) return 1160;
    if (columnCount === 5) return 1100;
    return 1020;
}

function chooseMobileCanvasWidth(columnCount) {
    // Extra width compensates for tableFramePaddingX (each side)
    // so the effective table content area stays the same.
    const framePad = MOBILE_RENDER_LAYOUT.tableFramePaddingX * 2;
    if (columnCount <= 3) return 500 + framePad;
    if (columnCount <= 4) return 560 + framePad;
    if (columnCount <= 5) return 660 + framePad;
    if (columnCount <= 6) return 720 + framePad;
    return 740 + framePad;
}

function inferColumnRoles(table, templateName) {
    return table.headers.map((header, index) => {
        const normalized = normalizeHeader(header);
        const stats = table.columnStats[index];

        if (index === 0 && /^(priority|rank|ranking|pick|round|no|number)$/.test(normalized)) {
            return "rank";
        }

        if (/severity|verdict|status|threat level|impact/.test(normalized)) {
            return "status";
        }

        if (
            /cap|aav|dead money|savings|salary|cash|guarantee|value|cost|hit|amount|yards|td|qbr|rating|pool|age/.test(normalized) ||
            stats.numericRatio >= 0.55
        ) {
            return "number";
        }

        if (
            /notes?|state|context|consequences|fit|availability|outcome|replacement|why|role|summary|takeaway|current state|comp range/.test(normalized) ||
            stats.avgLength > 32 ||
            stats.maxLength > 42
        ) {
            return "notes";
        }

        if (templateName === "priority-list" && index === 1) {
            return "title";
        }

        if (
            index === 0 ||
            /scenario|player|signing|option|position|team|prospect|category|agent|era|year|round|source|top target/.test(normalized)
        ) {
            return "title";
        }

        return "text";
    });
}

function defaultAlignmentForRole(role) {
    if (role === "number") return "right";
    if (role === "rank" || role === "status") return "center";
    return "left";
}

function minWidthForRole(role) {
    return {
        rank: 0.08,
        number: 0.1,
        status: 0.12,
        title: 0.14,
        notes: 0.18,
        text: 0.12,
    }[role] ?? 0.12;
}

function maxWidthForRole(role) {
    return {
        rank: 0.1,
        number: 0.18,
        status: 0.18,
        title: 0.24,
        notes: 0.36,
        text: 0.22,
    }[role] ?? 0.22;
}

function distributeColumnFractions(weights, roles) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || weights.length;
    let fractions = weights.map((weight) => weight / totalWeight);

    for (let pass = 0; pass < 8; pass += 1) {
        let changed = false;
        const locked = new Array(fractions.length).fill(false);

        for (let index = 0; index < fractions.length; index += 1) {
            const min = minWidthForRole(roles[index]);
            const max = maxWidthForRole(roles[index]);

            if (fractions[index] < min) {
                fractions[index] = min;
                locked[index] = true;
                changed = true;
            } else if (fractions[index] > max) {
                fractions[index] = max;
                locked[index] = true;
                changed = true;
            }
        }

        if (!changed) break;

        const freeIndices = [];
        let lockedTotal = 0;

        for (let index = 0; index < fractions.length; index += 1) {
            if (locked[index]) {
                lockedTotal += fractions[index];
            } else {
                freeIndices.push(index);
            }
        }

        if (freeIndices.length === 0) break;

        const remaining = clamp(1 - lockedTotal, 0.0001, 1);
        const freeWeightTotal = freeIndices.reduce((sum, index) => sum + weights[index], 0) || freeIndices.length;

        freeIndices.forEach((index) => {
            fractions[index] = remaining * ((weights[index] || 1) / freeWeightTotal);
        });
    }

    const normalizedTotal = fractions.reduce((sum, fraction) => sum + fraction, 0) || 1;
    return fractions.map((fraction) => Number((((fraction / normalizedTotal) * 100)).toFixed(2)));
}

function resolveColumnMetadata(table, templateName) {
    const roles = inferColumnRoles(table, templateName);
    const weights = roles.map((role, index) => {
        const stats = table.columnStats[index];
        let weight = clamp((stats.maxLength / 22) + (stats.avgLength / 26), 0.8, 3.2);

        if (role === "rank") weight = 0.72;
        if (role === "number") weight = clamp(weight * 0.78, 0.95, 1.5);
        if (role === "status") weight = clamp(weight * 0.85, 0.95, 1.55);
        if (role === "title") weight = clamp(weight + 0.35, 1.2, 2.6);
        if (role === "notes") weight = clamp(weight + 0.75, 1.7, 3.5);
        if (role === "text") weight = clamp(weight + 0.1, 1.0, 2.2);

        return weight;
    });

    const widths = distributeColumnFractions(weights, roles);

    return table.headers.map((header, index) => ({
        header,
        role: roles[index],
        alignment: table.alignments[index] !== "auto" ? table.alignments[index] : defaultAlignmentForRole(roles[index]),
        widthPercentage: widths[index],
        index,
    }));
}

function isSummaryRow(row) {
    return /^(total|summary|overall|net|bottom line)/i.test(stripMarkdown(row[0] || ""));
}

function buildAutoTitle(table, templateName) {
    if (templateName === "priority-list") return "Priority table";
    if (templateName === "cap-comparison") return "Cap comparison";
    if (templateName === "draft-board") return "Draft board snapshot";

    const leadHeaders = table.headers.slice(0, 2).map((header) => stripMarkdown(header)).filter(Boolean);
    return leadHeaders.length > 0 ? `${leadHeaders.join(" vs. ")}` : "Comparison table";
}

function estimateRowHeight(row, columns, canvasWidth, rowIndex, layout = RENDER_LAYOUT) {
    // Usable width = canvas minus body padding, frame border (1px each side),
    // and frame padding (tableFramePaddingX each side).
    const framePaddingX = layout.tableFramePaddingX || 0;
    const usableWidth = canvasWidth - (layout.canvasPadding * 2) - 2 - (framePaddingX * 2);
    const fontScale = layout.tableCellFontSize / 17;
    let maxLines = 1;

    row.forEach((cell, index) => {
        const column = columns[index];
        const text = stripMarkdown(cell || "") || "—";
        const widthPx = usableWidth * (column.widthPercentage / 100);
        const charsPerLine = Math.max(
            7,
            Math.floor(
                (widthPx - (layout.tableCellPaddingX * 2) - 10) /
                (
                    (column.role === "number"
                        ? 9.2
                        : column.role === "notes"
                            ? 8.4
                            : column.role === "rank"
                                ? 7.4
                                : column.role === "title"
                                    ? 8.6
                                    : 8.1
                    ) * fontScale
                )
            )
        );
        const lines = estimateWrappedLineCount(text, charsPerLine);
        maxLines = Math.max(maxLines, lines);
    });

    const minHeight = rowIndex === 0 ? layout.tableFirstRowMinHeight : layout.tableRowMinHeight;
    const lineHeightPx = layout.tableCellFontSize * layout.tableCellLineHeight;
    return Math.max(
        minHeight,
        Math.round((layout.tableCellPaddingY * 2) + (maxLines * lineHeightPx))
    );
}

function estimateHeaderRowHeight(headers, columns, canvasWidth, layout) {
    const framePaddingX = layout.tableFramePaddingX || 0;
    const usableWidth = canvasWidth - (layout.canvasPadding * 2) - 2 - (framePaddingX * 2);
    const charWidth = layout.tableHeadFontSize * 0.62;
    let maxLines = 1;

    for (let i = 0; i < headers.length; i++) {
        const text = stripMarkdown(headers[i] || "").toUpperCase();
        const colWidth = usableWidth * ((columns[i]?.widthPercentage || 10) / 100);
        const availWidth = colWidth - (layout.tableCellPaddingX * 2) - 10;
        const cpl = Math.max(4, Math.floor(availWidth / charWidth));
        const lines = estimateWrappedLineCount(text, cpl);
        maxLines = Math.max(maxLines, lines);
    }

    const lineHeightPx = layout.tableHeadFontSize * layout.tableHeadLineHeight;
    return Math.max(layout.tableHeaderHeight, Math.round(24 + (maxLines * lineHeightPx)));
}

function createRenderModel(table, options = {}) {
    const layout = options.mobile ? MOBILE_RENDER_LAYOUT : RENDER_LAYOUT;
    const templateName = selectTemplate(table, options.template);
    const preset = TEMPLATE_PRESETS[templateName];
    const columns = resolveColumnMetadata(table, templateName);
    const canvasWidth = options.mobile
        ? chooseMobileCanvasWidth(table.columnCount)
        : chooseCanvasWidth(table.columnCount, templateName);
    const rowHeaderColumnIndex = templateName === "priority-list" && table.columnCount > 1 ? 1 : 0;
    const title = String(options.title || "").trim() || buildAutoTitle(table, templateName);
    const caption = String(options.caption || "").trim();
    const rows = table.rows.map((cells, index) => ({
        cells,
        estimatedHeight: estimateRowHeight(cells, columns, canvasWidth, index, layout),
        isSummary: isSummaryRow(cells),
    }));
    const tableHeaderHeight = estimateHeaderRowHeight(table.headers, columns, canvasWidth, layout);
    const tableBodyHeight = rows.reduce((sum, row) => sum + row.estimatedHeight, 0);
    const canvasHeight = Math.max(
        220,
        (layout.canvasPadding * 2) +
        tableHeaderHeight +
        tableBodyHeight +
        layout.heightSafety
    );

    return {
        templateName,
        templateLabel: preset.label,
        preset,
        layout,
        title,
        caption,
        canvasWidth,
        canvasHeight,
        columns,
        rows,
        rowHeaderColumnIndex,
    };
}

function buildTableHeaderHtml(model) {
    return model.columns
        .map((column) => {
            const classes = ["table-head-cell", `table-head-cell--${column.alignment}`, `table-head-cell--${column.role}`];
            return `<th class="${classes.join(" ")}">${escapeHtml(column.header)}</th>`;
        })
        .join("");
}

function buildTableBodyHtml(model) {
    return model.rows
        .map((row) => {
            const rowClasses = ["table-row"];
            if (row.isSummary) rowClasses.push("table-row--summary");

            const cellsHtml = row.cells
                .map((cell, index) => {
                    const column = model.columns[index];
                    const classes = ["table-cell", `table-cell--${column.role}`, `table-cell--${column.alignment}`];
                    const isRowHeader = index === model.rowHeaderColumnIndex;
                    if (isRowHeader) classes.push("table-cell--row-header");

                    const cleanText = stripMarkdown(cell || "") || "—";
                    const richHtml = renderInlineMarkdownToHtml(cell || "—");
                    let innerHtml = richHtml;

                    if (column.role === "rank") {
                        innerHtml = `<span class="rank-pill">${richHtml}</span>`;
                    } else if (column.role === "status" && cleanText.length <= 18) {
                        innerHtml = `<span class="status-chip">${richHtml}</span>`;
                    } else if (isRowHeader) {
                        innerHtml = `<span class="row-title">${richHtml}</span>`;
                    }

                    const tag = isRowHeader ? "th" : "td";
                    const scope = isRowHeader ? ' scope="row"' : "";
                    return `<${tag}${scope} class="${classes.join(" ")}"><div class="cell-content">${innerHtml}</div></${tag}>`;
                })
                .join("");

            return `<tr class="${rowClasses.join(" ")}">${cellsHtml}</tr>`;
        })
        .join("");
}

function buildHtml(table, options = {}) {
    const model = createRenderModel(table, options);
    const { preset, layout } = model;
    const isMobile = !!options.mobile;
    const headerLetterSpacing = isMobile ? '0.02em' : '0.08em';

    const columnGroup = model.columns
        .map((column) => `<col style="width:${column.widthPercentage}%">`)
        .join("");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --accent: ${preset.accent};
      --accent-strong: ${preset.accentStrong};
      --accent-tint: ${preset.accentTint};
      --badge-bg: ${preset.badgeBackground};
      --badge-text: ${preset.badgeText};
      --ink: #0f172a;
      --body: #1e293b;
      --muted: #475569;
      --line: #dbe3ee;
      --line-strong: #cbd5e1;
      --surface: rgba(255, 255, 255, 0.96);
      --surface-alt: #f8fafc;
    }
    html, body {
      margin: 0;
      width: ${model.canvasWidth}px;
      height: ${model.canvasHeight}px;
      background: #f8fafc;
      color: var(--body);
      overflow: hidden;
      font-family: "Segoe UI", Inter, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }
    body {
      box-sizing: border-box;
      padding: ${layout.canvasPadding}px;
    }
    .table-frame {
      box-sizing: border-box;
      width: 100%;
      border: 1px solid var(--line-strong);
      border-radius: ${layout.tableRadius}px;
      overflow: hidden;
      background: #ffffff;
      padding: 0 ${layout.tableFramePaddingX || 0}px;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
    }
    thead th {
      padding: 12px ${layout.tableCellPaddingX}px;
      background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%);
      border-bottom: 1px solid var(--line-strong);
      color: #334155;
      font-size: ${layout.tableHeadFontSize}px;
      line-height: ${layout.tableHeadLineHeight};
      font-weight: 800;
      letter-spacing: ${headerLetterSpacing};
      text-transform: uppercase;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .table-head-cell--right { text-align: right; }
    .table-head-cell--center { text-align: center; }
    tbody tr:nth-child(even) { background: var(--surface-alt); }
    tbody tr:last-child th,
    tbody tr:last-child td { border-bottom: none; }
    tbody th,
    tbody td {
      box-sizing: border-box;
      padding: ${layout.tableCellPaddingY}px ${layout.tableCellPaddingX}px;
      border-bottom: 1px solid var(--line);
      color: var(--body);
      font-size: ${layout.tableCellFontSize}px;
      line-height: ${layout.tableCellLineHeight};
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .table-row--summary {
      background: linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(241,245,249,1) 56%, var(--accent-tint) 100%);
    }
    .table-row--summary th,
    .table-row--summary td {
      font-weight: 800;
      color: var(--ink);
    }
    .table-cell--number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .table-cell--center { text-align: center; }
    .table-cell--row-header { color: var(--ink); }
    .row-title {
      display: inline-block;
      color: var(--ink);
      font-weight: 800;
    }
    .rank-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--accent-tint);
      color: var(--badge-text);
      font-size: 15px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.06);
      color: var(--ink);
      font-size: 13.5px;
      line-height: 1.1;
      font-weight: 800;
    }
    strong {
      color: var(--ink);
      font-weight: 800;
    }
    em {
      color: var(--muted);
      font-style: italic;
    }
    code {
      background: #eef2f7;
      border-radius: 6px;
      padding: 2px 6px;
      font-family: Consolas, "SFMono-Regular", monospace;
      font-size: 0.92em;
    }
  </style>
</head>
<body>
    <div class="table-frame template--${model.templateName}">
      <table>
        <colgroup>${columnGroup}</colgroup>
        <thead><tr>${buildTableHeaderHtml(model)}</tr></thead>
        <tbody>${buildTableBodyHtml(model)}</tbody>
      </table>
    </div>
</body>
</html>`;

    return {
        html,
        width: model.canvasWidth,
        height: model.canvasHeight,
        model,
    };
}

function readPngMetadata(outputPath) {
    const buffer = readFileSync(outputPath);

    if (buffer.length < 33) {
        throw new Error("PNG output is too small to be valid.");
    }
    if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw new Error("Rendered output is not a valid PNG file.");
    }

    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        bytes: buffer.length,
    };
}

// ─── Playwright Browser Lifecycle ──────────────────────────────────────────────

let _browser = null;

async function getBrowser() {
    if (!_browser || !_browser.isConnected()) {
        _browser = await chromium.launch({ headless: true });
    }
    return _browser;
}

export async function closeBrowser() {
    if (_browser) {
        await _browser.close();
        _browser = null;
    }
}

// ─── Playwright Renderer ──────────────────────────────────────────────────────

async function renderTablePng({ html, width, height, outputPath }) {
    mkdirSync(dirname(outputPath), { recursive: true });

    const browser = await getBrowser();
    const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        colorScheme: "light",
    });

    const page = await context.newPage();

    try {
        await page.setContent(html, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);

        const tableFrame = page.locator(".table-frame");
        await tableFrame.waitFor({ state: "visible", timeout: 5000 });

        const screenshot = await tableFrame.screenshot({
            type: "png",
            omitBackground: false,
        });

        writeFileSync(outputPath, screenshot);

        return {
            width: screenshot.readUInt32BE(16),
            height: screenshot.readUInt32BE(20),
            bytes: screenshot.length,
        };
    } finally {
        await context.close();
    }
}

function buildAltText(table, model, explicitAltText) {
    if (explicitAltText && String(explicitAltText).trim()) {
        return String(explicitAltText).trim();
    }

    const headers = table.headers.slice(0, 3).map((header) => stripMarkdown(header)).filter(Boolean);
    const leadCell = stripMarkdown(table.rows[0]?.[model.rowHeaderColumnIndex] || table.rows[0]?.[0] || "");
    const titleClause = model.title
        ? `${model.title.replace(/\.$/, "")}. `
        : "";
    const base = `${titleClause}${table.rowCount} rows and ${table.columnCount} columns`;
    const columnSummary = headers.length > 0
        ? `. Columns include ${headers.join(", ")}${table.columnCount > headers.length ? ", and more" : ""}`
        : "";
    const leadSummary = leadCell ? `. First row: ${leadCell}` : "";

    return `${base}${columnSummary}${leadSummary}.`;
}

function buildSuggestedTakeaway(table, model) {
    const leadCell = stripMarkdown(table.rows[0]?.[model.rowHeaderColumnIndex] || table.rows[0]?.[0] || "");
    const secondaryHeaders = table.headers.slice(1, 3).map((header) => stripMarkdown(header)).filter(Boolean);

    if (!leadCell) return null;

    if (model.templateName === "priority-list") {
        return `Top line: ${leadCell} leads this ${table.rowCount}-row priority table.`;
    }

    if (model.templateName === "cap-comparison") {
        const comparison = secondaryHeaders.length > 0 ? ` across ${secondaryHeaders.join(" and ")}` : "";
        return `Quick read: ${leadCell} anchors a ${table.rowCount}-scenario cap comparison${comparison}.`;
    }

    if (model.templateName === "draft-board") {
        return `Quick read: ${leadCell} opens a ${table.rowCount}-row draft board snapshot.`;
    }

    return `Quick read: ${leadCell} is the lead row in this ${table.rowCount}-row comparison table.`;
}

// Exports for alternative renderer backends and comparison harness
export { parseMarkdownTable, buildHtml, renderTablePng, buildAltText, buildSuggestedTakeaway, TEMPLATE_PRESETS };

export function formatRenderSuccess(result) {
    const lines = [
        "✅ Rendered table image.",
        "",
        `**Saved file:** ${result.outputPath}`,
        `**Article markdown:** ${result.markdown}`,
        `**Alt text:** ${result.altText}`,
        `**Template:** ${result.template}`,
        `**PNG:** ${result.image.width}×${result.image.height}px (${result.image.bytes} bytes)`,
    ];

    if (result.takeaway) {
        lines.push(`**Suggested takeaway:** ${result.takeaway}`);
    }

    return lines.join("\n");
}

export async function renderTableImage(args) {
    const articleFilePath = resolveInputPath(args.article_file_path);
    if (!existsSync(articleFilePath)) {
        throw new Error(`Article file not found: ${articleFilePath}`);
    }

    const articleDir = dirname(articleFilePath);
    const tableIndex = Math.max(1, Number(args.table_index || 1));

    const tableMarkdown = args.table_markdown
        ? args.table_markdown
        : (() => {
            if (!args.source_path) {
                throw new Error("Provide either table_markdown or source_path.");
            }
            const sourcePath = resolveSourcePath(args.source_path, articleDir);
            const markdown = readFileSync(sourcePath, "utf-8");
            return extractTableBlock(markdown, tableIndex);
        })();

    const table = parseMarkdownTable(tableMarkdown);
    const articleSlug = args.article_slug || deriveArticleSlug(articleFilePath);
    const outputDir = join(process.cwd(), "content", "images", articleSlug);
    mkdirSync(outputDir, { recursive: true });

    const { html, width, height, model } = buildHtml(table, {
        title: args.title,
        caption: args.caption,
        template: args.template,
        mobile: args.mobile,
    });

    const mobileSuffix = args.mobile ? "-mobile" : "";
    const outputStem = slugify(args.output_name || args.title || `table-${tableIndex}`);
    const outputFilename = `${articleSlug}-${outputStem}${mobileSuffix}.png`;
    const outputPath = join(outputDir, outputFilename);
    const image = await renderTablePng({ html, width, height, outputPath });

    let relativeImagePath = relative(articleDir, outputPath).replace(/\\/g, "/");
    if (!relativeImagePath.startsWith(".")) {
        relativeImagePath = `./${relativeImagePath}`;
    }

    const altText = buildAltText(table, model, args.alt_text);
    const safeAltText = sanitizeMarkdownImageText(altText) || "Rendered table";
    const safeCaption = sanitizeMarkdownImageText(args.caption || "");
    const markdown = safeCaption
        ? `![${safeAltText}|${safeCaption}](${relativeImagePath})`
        : `![${safeAltText}](${relativeImagePath})`;

    return {
        outputPath,
        relativeImagePath,
        markdown,
        altText,
        takeaway: buildSuggestedTakeaway(table, model),
        template: model.templateName,
        image,
        table,
    };
}

async function startExtension() {
    const [{ approveAll }, { joinSession }] = await Promise.all([
        import("@github/copilot-sdk"),
        import("@github/copilot-sdk/extension"),
    ]);

    const session = await joinSession({
        onPermissionRequest: approveAll,
        tools: [
            {
                name: "render_table_image",
                description:
                    "Render a markdown table from an article or inline input to a polished local PNG for Substack-safe publishing.",
                parameters: {
                    type: "object",
                    properties: {
                        article_file_path: {
                            type: "string",
                            description: "Path to the target article markdown file, relative to the repo root.",
                        },
                        article_slug: {
                            type: "string",
                            description: "Optional slug override for content/images/{slug}/ output.",
                        },
                        source_path: {
                            type: "string",
                            description: "Optional source markdown file to extract a table from.",
                        },
                        table_index: {
                            type: "integer",
                            description: "1-based table index when extracting from a markdown source file.",
                            default: 1,
                        },
                        table_markdown: {
                            type: "string",
                            description: "Optional raw markdown table content. Use instead of source_path.",
                        },
                        title: {
                            type: "string",
                            description: "Optional title shown above the table image.",
                        },
                        caption: {
                            type: "string",
                            description: "Optional caption returned in the markdown image syntax and used as supporting copy in the image.",
                        },
                        alt_text: {
                            type: "string",
                            description: "Optional alt text override for the returned markdown image syntax.",
                        },
                        output_name: {
                            type: "string",
                            description: "Optional filename stem for the generated image.",
                        },
                        template: {
                            type: "string",
                            description: "Optional template override: auto, generic-comparison, cap-comparison, draft-board, or priority-list.",
                        },
                        mobile: {
                            type: "boolean",
                            description: "When true, renders a mobile-optimized variant (narrower canvas, larger fonts) instead of the desktop default.",
                        },
                    },
                    required: ["article_file_path"],
                },
                async call(args) {
                    try {
                        const result = await renderTableImage(args);
                        return formatRenderSuccess(result);
                    } catch (err) {
                        return {
                            textResultForLlm: `Error rendering table image: ${err.message}`,
                            resultType: "failure",
                        };
                    }
                },
            },
        ],
    });

    await session.wait();
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFilePath) {
    await startExtension();
}

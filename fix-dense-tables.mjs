#!/usr/bin/env node
/**
 * fix-dense-tables.mjs — Batch-render blocked dense tables and update drafts
 *
 * Imports the table-image-renderer core directly (no Copilot SDK needed)
 * to render all dense-blocked markdown tables to PNG images, then replaces
 * each markdown table in the draft with the image reference.
 *
 * Usage:
 *   node fix-dense-tables.mjs                     # fix all Stage 7 drafts
 *   node fix-dense-tables.mjs --slug buf-2026-offseason
 *   node fix-dense-tables.mjs --dry-run            # preview changes only
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, basename, relative } from "node:path";

const ROOT = resolve(import.meta.dirname || process.cwd());

// Import the renderer core
const rendererPath = resolve(ROOT, ".github", "extensions", "table-image-renderer", "renderer-core.mjs");
let renderTableImage, formatRenderSuccess;
try {
    const mod = await import(`file:///${rendererPath.replace(/\\/g, "/")}`);
    renderTableImage = mod.renderTableImage;
    formatRenderSuccess = mod.formatRenderSuccess;
} catch (err) {
    console.error(`Failed to import renderer-core: ${err.message}`);
    console.error("Make sure you're running from the repo root.");
    process.exit(1);
}

// ─── Density classifier (same as audit-tables.mjs) ──────────────────────────

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
    return row.length > 0 && row.every((cell) => /^:?-+:?$/.test(String(cell || "").trim()));
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
    if (!table) return { allowInline: true, densityScore: 0, denseHeaders: [] };
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
        denseHeaders,
    };
}

// ─── Template inference ──────────────────────────────────────────────────────

function inferTemplate(headerRow) {
    const headers = headerRow.map(normalizeTableHeader);
    const hasFinancial = headers.some((h) =>
        h.includes("cap") || h.includes("aav") || h.includes("dead") ||
        h.includes("guaranteed") || h.includes("bonus") || h.includes("cost") ||
        h.includes("budget") || h.includes("salary")
    );
    const hasDraft = headers.some((h) =>
        h.includes("pick") || h.includes("draft") || h.includes("prospect") ||
        h.includes("round") || h.includes("selection")
    );
    const hasPriority = headers.some((h) =>
        h.includes("priority") || h.includes("rank") || h.includes("order")
    );
    if (hasFinancial) return "cap-comparison";
    if (hasDraft) return "draft-board";
    if (hasPriority) return "priority-list";
    return "generic-comparison";
}

// ─── Title inference ─────────────────────────────────────────────────────────

function inferTitle(headerRow, precedingLines) {
    // Look for a heading line right before the table
    for (let i = precedingLines.length - 1; i >= Math.max(0, precedingLines.length - 3); i--) {
        const line = precedingLines[i].trim();
        const headingMatch = line.match(/^#{1,4}\s+(.+)/);
        if (headingMatch) return headingMatch[1].trim();
        if (line === "") continue;
        // Non-empty non-heading line — stop looking
        break;
    }
    // Fall back to headers
    const cleaned = headerRow.map((h) => stripTableMarkdown(h)).filter(Boolean);
    return cleaned.slice(0, 3).join(" vs ");
}

// ─── Table extraction with line positions ────────────────────────────────────

function extractTablesWithPositions(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const tables = [];
    let tableLineIndices = [];

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith("|")) {
            tableLineIndices.push(i);
        } else {
            if (tableLineIndices.length > 0) {
                tables.push({
                    lineIndices: [...tableLineIndices],
                    rawLines: tableLineIndices.map((idx) => lines[idx]),
                    precedingLines: lines.slice(Math.max(0, tableLineIndices[0] - 5), tableLineIndices[0]),
                });
                tableLineIndices = [];
            }
        }
    }
    if (tableLineIndices.length > 0) {
        tables.push({
            lineIndices: [...tableLineIndices],
            rawLines: tableLineIndices.map((idx) => lines[idx]),
            precedingLines: lines.slice(Math.max(0, tableLineIndices[0] - 5), tableLineIndices[0]),
        });
    }
    return tables;
}

// ─── Pipeline DB ─────────────────────────────────────────────────────────────

async function getArticlesAtStage(stage) {
    const dbPath = resolve(ROOT, "content", "pipeline.db");
    if (!existsSync(dbPath)) return [];
    try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const rows = [];
        for (const row of db.prepare("SELECT id, current_stage, status, article_path FROM articles WHERE current_stage = ?").iterate(stage)) {
            rows.push(row);
        }
        db.close();
        return rows;
    } catch {
        return [];
    }
}

function resolveDraftFile(slug) {
    const dir = resolve(ROOT, "content", "articles", slug);
    if (!existsSync(dir)) return null;
    for (const name of ["draft-clean.md", "draft.md", "article.md", `${slug}.md`]) {
        const p = resolve(dir, name);
        if (existsSync(p)) return p;
    }
    const mdFiles = readdirSync(dir).filter((f) => f.endsWith(".md"));
    if (mdFiles.length === 1) return resolve(dir, mdFiles[0]);
    return null;
}

// ─── Slugify helper ──────────────────────────────────────────────────────────

function slugify(text) {
    return String(text || "table")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "table";
}

// ─── Main fix logic ──────────────────────────────────────────────────────────

async function fixArticle(slug, draftPath, dryRun) {
    const text = readFileSync(draftPath, "utf-8");
    const tables = extractTablesWithPositions(text);
    const lines = text.replace(/\r\n/g, "\n").split("\n");

    let fixedCount = 0;
    let failedCount = 0;
    const replacements = []; // { startIdx, endIdx, newContent }

    for (let tIdx = 0; tIdx < tables.length; tIdx++) {
        const tableInfo = tables[tIdx];
        const parsed = parseMarkdownTableLines(tableInfo.rawLines);
        if (!parsed) continue;

        const classification = classifyMarkdownTableForInline(parsed);
        // Render both BLOCKED (allowInline=false) and BORDERLINE (density ≥ 5.5)
        // tables to PNG — borderline tables technically pass but look rough as
        // flattened lists on Substack.
        if (classification.allowInline && classification.densityScore < 5.5) continue;

        // This table is blocked — needs rendering
        const template = inferTemplate(parsed.headerRow);
        const title = inferTitle(parsed.headerRow, tableInfo.precedingLines);
        const outputName = slugify(title || `table-${tIdx + 1}`);
        const tableMarkdown = tableInfo.rawLines.join("\n");

        console.log(`  🔄 T${tIdx + 1} L${tableInfo.lineIndices[0] + 1}: "${title}" → ${template}`);

        if (dryRun) {
            console.log(`     (dry-run) Would render to content/images/${slug}/${slug}-${outputName}.png`);
            fixedCount++;
            continue;
        }

        try {
            // Desktop render (kept for desktop/email quality)
            const desktopResult = await renderTableImage({
                article_file_path: relative(ROOT, draftPath).replace(/\\/g, "/"),
                article_slug: slug,
                table_markdown: tableMarkdown,
                title,
                template,
                output_name: outputName,
            });
            console.log(`     ✅ Desktop → ${desktopResult.relativeImagePath}`);

            // Mobile render (narrower canvas, larger fonts for 375px viewport)
            const mobileResult = await renderTableImage({
                article_file_path: relative(ROOT, draftPath).replace(/\\/g, "/"),
                article_slug: slug,
                table_markdown: tableMarkdown,
                title,
                template,
                output_name: outputName,
                mobile: true,
            });
            console.log(`     📱 Mobile  → ${mobileResult.relativeImagePath}`);

            // Embed the mobile variant in the article — it's more universally
            // readable since it starts from a smaller base with larger fonts.
            replacements.push({
                startIdx: tableInfo.lineIndices[0],
                endIdx: tableInfo.lineIndices[tableInfo.lineIndices.length - 1],
                newContent: mobileResult.markdown,
            });

            fixedCount++;
        } catch (err) {
            console.log(`     ❌ Failed: ${err.message}`);
            failedCount++;
        }
    }

    // Apply replacements in reverse order (to preserve line indices)
    if (replacements.length > 0 && !dryRun) {
        const newLines = [...lines];
        for (const rep of replacements.sort((a, b) => b.startIdx - a.startIdx)) {
            newLines.splice(rep.startIdx, rep.endIdx - rep.startIdx + 1, rep.newContent);
        }
        writeFileSync(draftPath, newLines.join("\n"), "utf-8");
        console.log(`  📝 Updated ${basename(draftPath)} — ${replacements.length} table(s) replaced with images`);
    }

    return { fixedCount, failedCount };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");

    let slugs = [];

    if (args.includes("--slug")) {
        const idx = args.indexOf("--slug");
        slugs = [args[idx + 1]];
    } else {
        // Default: all Stage 7 articles
        const articles = await getArticlesAtStage(7);
        slugs = articles.map((a) => a.id);
    }

    console.log(`Dense table fix — ${slugs.length} article(s)${dryRun ? " (DRY RUN)" : ""}\n`);

    let totalFixed = 0;
    let totalFailed = 0;

    for (const slug of slugs) {
        const draftPath = resolveDraftFile(slug);
        if (!draftPath) {
            console.log(`⏭️  ${slug}: no draft file found`);
            continue;
        }

        console.log(`━━━ ${slug}`);
        const { fixedCount, failedCount } = await fixArticle(slug, draftPath, dryRun);
        totalFixed += fixedCount;
        totalFailed += failedCount;

        if (fixedCount === 0 && failedCount === 0) {
            console.log(`  ✅ No dense tables — ready to publish`);
        }
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`DONE: ${totalFixed} tables rendered, ${totalFailed} failed`);
    if (dryRun) console.log("(Dry run — no files were modified)");
    console.log("═".repeat(60));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

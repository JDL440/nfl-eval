#!/usr/bin/env node
/**
 * audit-tables.mjs — Pre-publish table density audit
 *
 * Runs the same density classifier used by the Substack publisher extension
 * against one or more article drafts. Reports which tables will be:
 *   ✅ Allowed inline (converted to list — looks fine)
 *   ⚠️  Allowed inline but borderline (may look rough as a list)
 *   🚫 Blocked as dense (publish will fail unless pre-rendered to PNG)
 *   🖼️  Already replaced by an image reference (no action needed)
 *
 * Usage:
 *   node audit-tables.mjs                          # audit all Stage 7 drafts
 *   node audit-tables.mjs content/articles/buf-2026-offseason/draft.md
 *   node audit-tables.mjs --slug buf-2026-offseason
 *   node audit-tables.mjs --stage 7                # all articles at given stage
 *   node audit-tables.mjs --all                    # every article with a draft
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";

const ROOT = resolve(import.meta.dirname || process.cwd());

// ─── Density classifier (extracted from substack-publisher/extension.mjs) ────

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
    if (!table) return { allowInline: true, densityScore: 0, avgCellLength: 0, numericComparisonColumns: 0, denseHeaders: [] };
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
        avgCellLength: Math.round(avgCellLength),
        maxCellLength,
        numericComparisonColumns,
        denseHeaders,
        columnCount: table.columnCount,
        rowCount: table.rowCount,
        isLabelValueTable,
        isChecklistTable,
        isShortScannableTable,
        looksOrdered,
    };
}

// ─── Markdown table extraction ───────────────────────────────────────────────

function extractTablesFromMarkdown(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const tables = [];
    let tableLines = [];
    let tableStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith("|")) {
            if (tableLines.length === 0) tableStartLine = i + 1;
            tableLines.push(trimmed);
        } else {
            if (tableLines.length > 0) {
                tables.push({ lines: [...tableLines], startLine: tableStartLine });
                tableLines = [];
            }
        }
    }
    if (tableLines.length > 0) {
        tables.push({ lines: [...tableLines], startLine: tableStartLine });
    }
    return tables;
}

function countImageRefsForSlug(text, slug) {
    const pattern = new RegExp(`!\\[.*?\\]\\(.*?${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*?\\.png\\)`, "g");
    return (text.match(pattern) || []).length;
}

// ─── Pipeline DB ─────────────────────────────────────────────────────────────

async function getArticlesAtStage(stage) {
    const dbPath = resolve(ROOT, "content", "pipeline.db");
    if (!existsSync(dbPath)) return [];
    try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const stmt = db.prepare("SELECT id, current_stage, status, article_path FROM articles WHERE current_stage = ?");
        const rows = [];
        for (const row of stmt.iterate(stage)) rows.push(row);
        db.close();
        return rows;
    } catch {
        return [];
    }
}

async function getAllArticles() {
    const dbPath = resolve(ROOT, "content", "pipeline.db");
    if (!existsSync(dbPath)) return [];
    try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const rows = [];
        for (const row of db.prepare("SELECT id, current_stage, status, article_path FROM articles ORDER BY current_stage DESC").iterate()) {
            rows.push(row);
        }
        db.close();
        return rows;
    } catch {
        return [];
    }
}

// ─── Draft file resolution ───────────────────────────────────────────────────

function resolveDraftFile(slug) {
    const dir = resolve(ROOT, "content", "articles", slug);
    if (!existsSync(dir)) return null;
    // Prefer draft-clean.md > draft.md > article.md > {slug}.md
    for (const name of ["draft-clean.md", "draft.md", "article.md", `${slug}.md`]) {
        const p = resolve(dir, name);
        if (existsSync(p)) return p;
    }
    // Fall back to single .md in the directory
    const mdFiles = readdirSync(dir).filter((f) => f.endsWith(".md"));
    if (mdFiles.length === 1) return resolve(dir, mdFiles[0]);
    return null;
}

// ─── Audit a single file ─────────────────────────────────────────────────────

function auditFile(filePath, slug) {
    const text = readFileSync(filePath, "utf-8");
    const rawTables = extractTablesFromMarkdown(text);
    const imageCount = countImageRefsForSlug(text, slug);

    const results = rawTables.map((raw, index) => {
        const parsed = parseMarkdownTableLines(raw.lines);
        if (!parsed) return null;
        const classification = classifyMarkdownTableForInline(parsed);
        const headerPreview = parsed.headerRow
            .map((h) => stripTableMarkdown(h))
            .filter(Boolean)
            .slice(0, 5)
            .join(" | ");

        let status;
        let icon;
        if (!classification.allowInline) {
            status = "BLOCKED";
            icon = "🚫";
        } else if (classification.densityScore >= 5.5) {
            status = "BORDERLINE";
            icon = "⚠️";
        } else if (classification.columnCount >= 5 || (classification.columnCount >= 4 && classification.numericComparisonColumns >= 2)) {
            status = "MOBILE_RISK";
            icon = "📱";
        } else {
            status = "OK";
            icon = "✅";
        }

        return {
            index: index + 1,
            startLine: raw.startLine,
            headerPreview,
            status,
            icon,
            ...classification,
        };
    }).filter(Boolean);

    return { filePath, slug, tables: results, imageCount };
}

// ─── Output ──────────────────────────────────────────────────────────────────

function printAudit(audit) {
    const blocked = audit.tables.filter((t) => t.status === "BLOCKED");
    const borderline = audit.tables.filter((t) => t.status === "BORDERLINE");
    const mobileRisk = audit.tables.filter((t) => t.status === "MOBILE_RISK");
    const ok = audit.tables.filter((t) => t.status === "OK");

    const slugLabel = audit.slug.padEnd(42);
    const summary = `${audit.tables.length} tables  (${ok.length} ✅  ${mobileRisk.length} 📱  ${borderline.length} ⚠️   ${blocked.length} 🚫)  ${audit.imageCount} table images`;
    console.log(`\n━━━ ${slugLabel} ${summary}`);

    if (audit.tables.length === 0) {
        console.log("    No markdown tables found.");
        return;
    }

    for (const t of audit.tables) {
        const density = `density=${t.densityScore.toFixed(1)}`;
        const cols = `${t.columnCount}col×${t.rowCount}row`;
        const avg = `avg=${t.avgCellLength}ch`;
        const dense = t.denseHeaders.length > 0 ? ` dense=[${t.denseHeaders.join(",")}]` : "";
        const numeric = t.numericComparisonColumns > 0 ? ` numeric=${t.numericComparisonColumns}` : "";
        console.log(`    ${t.icon} T${t.index} L${t.startLine}  ${cols}  ${density}  ${avg}${dense}${numeric}  │ ${t.headerPreview}`);
    }

    if (blocked.length > 0) {
        console.log(`    ┗━ ACTION: ${blocked.length} table(s) must be rendered to PNG via render_table_image before publishing`);
    }
}

function printSummary(audits) {
    let totalTables = 0;
    let totalBlocked = 0;
    let totalBorderline = 0;
    let totalMobileRisk = 0;
    let totalOk = 0;
    let totalImages = 0;
    const blockedArticles = [];
    const mobileRiskArticles = [];

    for (const a of audits) {
        totalTables += a.tables.length;
        const blocked = a.tables.filter((t) => t.status === "BLOCKED").length;
        const borderline = a.tables.filter((t) => t.status === "BORDERLINE").length;
        const mobileRisk = a.tables.filter((t) => t.status === "MOBILE_RISK").length;
        totalBlocked += blocked;
        totalBorderline += borderline;
        totalMobileRisk += mobileRisk;
        totalOk += a.tables.filter((t) => t.status === "OK").length;
        totalImages += a.imageCount;
        if (blocked > 0) blockedArticles.push({ slug: a.slug, count: blocked });
        if (mobileRisk > 0) mobileRiskArticles.push({ slug: a.slug, count: mobileRisk });
    }

    console.log("\n" + "═".repeat(80));
    console.log(`SUMMARY: ${audits.length} articles, ${totalTables} tables`);
    console.log(`  ✅ ${totalOk} will inline as lists (OK)`);
    console.log(`  📱 ${totalMobileRisk} mobile-risk (OK inline but may be hard to read on phones)`);
    console.log(`  ⚠️  ${totalBorderline} borderline (will inline but may look rough)`);
    console.log(`  🚫 ${totalBlocked} BLOCKED (must render to PNG before publish)`);
    console.log(`  🖼️  ${totalImages} table images already rendered`);

    if (blockedArticles.length > 0) {
        console.log(`\nBLOCKED ARTICLES (${blockedArticles.length}):`);
        for (const ba of blockedArticles) {
            console.log(`  • ${ba.slug} — ${ba.count} dense table(s) need render_table_image`);
        }
    }
    if (mobileRiskArticles.length > 0) {
        console.log(`\nMOBILE-RISK ARTICLES (${mobileRiskArticles.length}):`);
        for (const mr of mobileRiskArticles) {
            console.log(`  • ${mr.slug} — ${mr.count} table(s) may be illegible on mobile`);
        }
    }
    console.log("═".repeat(80));
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);

    let filesToAudit = [];

    if (args.includes("--all")) {
        const articles = await getAllArticles();
        for (const a of articles) {
            const draftPath = resolveDraftFile(a.id);
            if (draftPath) filesToAudit.push({ path: draftPath, slug: a.id });
        }
    } else if (args.includes("--stage")) {
        const stageIdx = args.indexOf("--stage");
        const stage = parseInt(args[stageIdx + 1] || "7", 10);
        const articles = await getArticlesAtStage(stage);
        for (const a of articles) {
            const draftPath = resolveDraftFile(a.id);
            if (draftPath) filesToAudit.push({ path: draftPath, slug: a.id });
        }
    } else if (args.includes("--slug")) {
        const slugIdx = args.indexOf("--slug");
        const slug = args[slugIdx + 1];
        const draftPath = resolveDraftFile(slug);
        if (draftPath) filesToAudit.push({ path: draftPath, slug });
        else console.error(`No draft found for slug: ${slug}`);
    } else if (args.length > 0 && !args[0].startsWith("-")) {
        const filePath = resolve(args[0]);
        const slug = basename(dirname(filePath));
        filesToAudit.push({ path: filePath, slug });
    } else {
        // Default: all Stage 7 articles
        const articles = await getArticlesAtStage(7);
        for (const a of articles) {
            const draftPath = resolveDraftFile(a.id);
            if (draftPath) filesToAudit.push({ path: draftPath, slug: a.id });
        }
    }

    if (filesToAudit.length === 0) {
        console.log("No articles found to audit.");
        process.exit(0);
    }

    console.log(`Table density audit — ${filesToAudit.length} article(s)\n`);

    const audits = filesToAudit.map(({ path, slug }) => auditFile(path, slug));
    audits.forEach(printAudit);
    if (audits.length > 1) printSummary(audits);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

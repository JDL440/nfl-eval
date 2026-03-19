/**
 * Alternative C: Canvas-based table renderer (@napi-rs/canvas)
 *
 * Renders tables directly on a 2D canvas — no browser, no HTML, no CSS.
 * Must manually recreate all visual styling: colors, fonts, gradients,
 * alternating rows, rank pills, etc.
 *
 * Advantages:
 * - ~50ms per render (fastest option)
 * - No browser dependency
 * - Deterministic output
 *
 * Limitations:
 * - No CSS — all layout is manual
 * - No inline bold/italic mixing
 * - No rich components (rank pills, status chips)
 * - Font rendering depends on available system fonts
 */

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const TEMPLATE_COLORS = {
    "generic-comparison": { accent: "#2563eb", accentTint: "rgba(59,130,246,0.12)", headerBg: "#f0f4ff", badgeBg: "#dbeafe", badgeText: "#1d4ed8" },
    "cap-comparison":     { accent: "#059669", accentTint: "rgba(16,185,129,0.12)", headerBg: "#ecfdf5", badgeBg: "#d1fae5", badgeText: "#047857" },
    "draft-board":        { accent: "#7c3aed", accentTint: "rgba(139,92,246,0.12)", headerBg: "#f5f3ff", badgeBg: "#ede9fe", badgeText: "#6d28d9" },
    "priority-list":      { accent: "#ea580c", accentTint: "rgba(249,115,22,0.12)", headerBg: "#fff7ed", badgeBg: "#ffedd5", badgeText: "#c2410c" },
};

const DPR = 2;

function stripMarkdown(text) {
    return String(text || "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .trim();
}

function measureText(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";

    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
            current = test;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    if (lines.length === 0) lines.push("");
    return lines;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Render table to PNG using @napi-rs/canvas.
 * Accepts parsed table data (not HTML).
 */
export async function renderTablePngCanvas({ table, options = {}, outputPath }) {
    mkdirSync(dirname(outputPath), { recursive: true });

    const isMobile = !!options.mobile;
    const templateName = options.template || "generic-comparison";
    const colors = TEMPLATE_COLORS[templateName] || TEMPLATE_COLORS["generic-comparison"];

    // Layout constants
    const cellFontSize = isMobile ? 22 : 17;
    const headFontSize = isMobile ? 17 : 14;
    const cellPadX = isMobile ? 10 : 12;
    const cellPadY = isMobile ? 10 : 10;
    const canvasPad = 6;
    const borderRadius = 10;
    const headerHeight = isMobile ? 50 : 54;
    const rowMinHeight = isMobile ? 48 : 50;
    const lineHeight = 1.38;

    // Canvas dimensions (CSS pixels — multiply by DPR for actual)
    const colCount = table.headers.length;
    let canvasWidth;
    if (isMobile) {
        canvasWidth = colCount <= 3 ? 520 : colCount <= 5 ? 680 : 760;
    } else {
        canvasWidth = colCount <= 4 ? 1020 : colCount === 5 ? 1100 : 1160;
    }
    const tableWidth = canvasWidth - canvasPad * 2;

    // Column widths — even distribution with first column getting 1.5× weight
    const totalWeight = (colCount - 1) + 1.5;
    const colWidths = table.headers.map((_, i) =>
        i === 0 ? (1.5 / totalWeight) * tableWidth : (1 / totalWeight) * tableWidth
    );

    // Pre-measure row heights
    const tmpCanvas = createCanvas(10, 10);
    const tmpCtx = tmpCanvas.getContext("2d");
    tmpCtx.font = `${cellFontSize * DPR}px "Segoe UI", sans-serif`;

    const rowHeights = table.rows.map((row) => {
        let maxLines = 1;
        row.forEach((cell, ci) => {
            const text = stripMarkdown(cell);
            const availWidth = (colWidths[ci] - cellPadX * 2) * DPR;
            const lines = measureText(tmpCtx, text, availWidth);
            maxLines = Math.max(maxLines, lines.length);
        });
        return Math.max(rowMinHeight, cellPadY * 2 + maxLines * cellFontSize * lineHeight);
    });

    const totalBodyHeight = rowHeights.reduce((s, h) => s + h, 0);
    const canvasHeight = canvasPad * 2 + headerHeight + totalBodyHeight + 2;

    // Create the actual canvas at DPR scale
    const canvas = createCanvas(canvasWidth * DPR, canvasHeight * DPR);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fx = canvasPad * DPR;
    const fy = canvasPad * DPR;
    const fw = tableWidth * DPR;
    const fh = (canvasHeight - canvasPad * 2) * DPR;

    // Table frame with rounded corners
    ctx.save();
    roundRect(ctx, fx, fy, fw, fh, borderRadius * DPR);
    ctx.clip();

    // White background for table
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(fx, fy, fw, fh);

    // === HEADER ROW ===
    const hh = headerHeight * DPR;
    ctx.fillStyle = colors.headerBg;
    ctx.fillRect(fx, fy, fw, hh);

    // Header border bottom
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = DPR;
    ctx.beginPath();
    ctx.moveTo(fx, fy + hh);
    ctx.lineTo(fx + fw, fy + hh);
    ctx.stroke();

    // Header text
    ctx.fillStyle = "#334155";
    ctx.font = `800 ${headFontSize * DPR}px "Segoe UI", sans-serif`;
    ctx.textBaseline = "middle";

    let hx = fx;
    table.headers.forEach((header, ci) => {
        const cw = colWidths[ci] * DPR;
        const text = stripMarkdown(header).toUpperCase();
        const tx = hx + cellPadX * DPR;
        ctx.fillText(text, tx, fy + hh / 2, cw - cellPadX * 2 * DPR);
        hx += cw;
    });

    // === BODY ROWS ===
    let ry = fy + hh;
    ctx.font = `400 ${cellFontSize * DPR}px "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";

    table.rows.forEach((row, ri) => {
        const rh = rowHeights[ri] * DPR;

        // Alternating row background
        if (ri % 2 === 1) {
            ctx.fillStyle = "#f8fafc";
            ctx.fillRect(fx, ry, fw, rh);
        }

        // Row bottom border
        if (ri < table.rows.length - 1) {
            ctx.strokeStyle = "#dbe3ee";
            ctx.lineWidth = DPR;
            ctx.beginPath();
            ctx.moveTo(fx, ry + rh);
            ctx.lineTo(fx + fw, ry + rh);
            ctx.stroke();
        }

        // Cell text
        let cx = fx;
        row.forEach((cell, ci) => {
            const cw = colWidths[ci] * DPR;
            const text = stripMarkdown(cell);
            const availWidth = cw - cellPadX * 2 * DPR;
            const lines = measureText(ctx, text, availWidth);

            // First column gets bold weight
            if (ci === 0) {
                ctx.font = `700 ${cellFontSize * DPR}px "Segoe UI", sans-serif`;
                ctx.fillStyle = "#0f172a";
            } else {
                ctx.font = `400 ${cellFontSize * DPR}px "Segoe UI", sans-serif`;
                ctx.fillStyle = "#1e293b";
            }

            const textY = ry + cellPadY * DPR;
            lines.forEach((line, li) => {
                ctx.fillText(line, cx + cellPadX * DPR, textY + li * cellFontSize * lineHeight * DPR, availWidth);
            });

            cx += cw;
        });

        ry += rh;
    });

    ctx.restore();

    // Frame border (on top of everything)
    roundRect(ctx, fx, fy, fw, fh, borderRadius * DPR);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = DPR;
    ctx.stroke();

    // Export PNG
    const buffer = canvas.toBuffer("image/png");
    writeFileSync(outputPath, buffer);

    return {
        width: canvas.width,
        height: canvas.height,
        bytes: buffer.length,
    };
}

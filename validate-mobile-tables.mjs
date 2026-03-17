#!/usr/bin/env node
/**
 * validate-mobile-tables.mjs — Playwright visual validation for mobile table renders
 *
 * Opens each rendered table image at mobile viewport width (375px) and captures
 * screenshots for comparison. Validates that mobile-rendered images are legible
 * at phone screen sizes.
 *
 * Usage:
 *   node validate-mobile-tables.mjs [--slug mobile-table-boundary-validation]
 *   node validate-mobile-tables.mjs --headed    # visible browser for visual inspection
 */

import { chromium } from "playwright";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, basename } from "node:path";

const ROOT = resolve(import.meta.dirname || process.cwd());
const HEADED = process.argv.includes("--headed");
const MOBILE_VIEWPORT = { width: 375, height: 812 }; // iPhone SE / standard mobile
const DESKTOP_VIEWPORT = { width: 680, height: 1024 }; // Substack article width

function getSlug() {
    const idx = process.argv.indexOf("--slug");
    return idx >= 0 ? process.argv[idx + 1] : "mobile-table-boundary-validation";
}

async function run() {
    const slug = getSlug();
    const imgDir = resolve(ROOT, "content", "images", slug);
    const outputDir = resolve(ROOT, "content", "images", slug, "validation-screenshots");

    if (!existsSync(imgDir)) {
        console.error(`Image directory not found: ${imgDir}`);
        process.exit(1);
    }

    mkdirSync(outputDir, { recursive: true });

    const allPngs = readdirSync(imgDir).filter(f => f.endsWith(".png") && !f.startsWith("validation-"));
    const mobilePngs = allPngs.filter(f => f.includes("-mobile"));
    const desktopPngs = allPngs.filter(f => !f.includes("-mobile"));

    console.log(`\n📱 Mobile Table Validation — Playwright`);
    console.log(`   Slug: ${slug}`);
    console.log(`   Desktop PNGs: ${desktopPngs.length}`);
    console.log(`   Mobile PNGs: ${mobilePngs.length}`);
    console.log(`   Mode: ${HEADED ? "headed" : "headless"}\n`);

    const browser = await chromium.launch({ headless: !HEADED });

    const results = [];

    for (const pngFile of [...mobilePngs, ...desktopPngs]) {
        const isMobile = pngFile.includes("-mobile");
        const variant = isMobile ? "mobile" : "desktop";
        const pngPath = resolve(imgDir, pngFile);

        // Build a minimal HTML page that simulates Substack's image rendering
        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #fff;
    }
    .article-body {
      max-width: 100%;
    }
    .article-body img {
      max-width: 100%;
      height: auto;
      display: block;
    }
    .label {
      font-size: 11px;
      color: #888;
      margin-bottom: 8px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="article-body">
    <div class="label">${variant.toUpperCase()} render at mobile viewport — ${pngFile}</div>
    <img src="./${pngFile}" alt="${pngFile}">
  </div>
</body>
</html>`;

        // Write temp HTML next to the images so relative src works
        const tempHtml = join(imgDir, `_validate_${variant}_${basename(pngFile, ".png")}.html`);
        writeFileSync(tempHtml, html, "utf-8");

        // Test at mobile viewport
        const mobilePage = await browser.newPage({ viewport: MOBILE_VIEWPORT });
        await mobilePage.goto(`file:///${tempHtml.replace(/\\/g, "/")}`, { waitUntil: "load" });
        await mobilePage.waitForTimeout(500);

        const mobileScreenshot = join(outputDir, `${variant}-at-375px-${basename(pngFile, ".png")}.png`);
        await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });

        // Measure the rendered image dimensions in the viewport
        const mobileMetrics = await mobilePage.evaluate(() => {
            const img = document.querySelector("img");
            if (!img) return null;
            return {
                renderedWidth: img.clientWidth,
                renderedHeight: img.clientHeight,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                scaleFactor: (img.clientWidth / img.naturalWidth * 100).toFixed(1),
            };
        });

        await mobilePage.close();

        // Test at desktop viewport
        const desktopPage = await browser.newPage({ viewport: DESKTOP_VIEWPORT });
        await desktopPage.goto(`file:///${tempHtml.replace(/\\/g, "/")}`, { waitUntil: "load" });
        await desktopPage.waitForTimeout(500);

        const desktopScreenshot = join(outputDir, `${variant}-at-680px-${basename(pngFile, ".png")}.png`);
        await desktopPage.screenshot({ path: desktopScreenshot, fullPage: true });

        const desktopMetrics = await desktopPage.evaluate(() => {
            const img = document.querySelector("img");
            if (!img) return null;
            return {
                renderedWidth: img.clientWidth,
                renderedHeight: img.clientHeight,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                scaleFactor: (img.clientWidth / img.naturalWidth * 100).toFixed(1),
            };
        });

        await desktopPage.close();

        const mobileScale = mobileMetrics ? parseFloat(mobileMetrics.scaleFactor) : 0;
        // At 2x DPR, the CSS font size is half the pixel font size, and scaling
        // is relative to natural (pixel) width. Effective CSS font estimation:
        const baseFontPx = isMobile ? 20 : 17;
        const effectiveFontAtMobile = mobileMetrics
            ? (baseFontPx * (mobileMetrics.renderedWidth / (mobileMetrics.naturalWidth / 2))).toFixed(1)
            : "?";

        const readableAtMobile = parseFloat(effectiveFontAtMobile) >= 10;

        const icon = readableAtMobile ? "✅" : "⚠️";
        console.log(`  ${icon} ${variant.padEnd(7)} ${pngFile.slice(0, 60).padEnd(62)} scale@375=${mobileScale}%  eff.font≈${effectiveFontAtMobile}px`);

        results.push({
            file: pngFile,
            variant,
            mobileMetrics,
            desktopMetrics,
            effectiveFontAtMobile,
            readableAtMobile,
        });
    }

    await browser.close();

    // Clean up temp HTML files
    for (const f of readdirSync(imgDir).filter(f => f.startsWith("_validate_") && f.endsWith(".html"))) {
        const { rmSync } = await import("node:fs");
        rmSync(join(imgDir, f), { force: true });
    }

    // Summary
    const totalReadable = results.filter(r => r.readableAtMobile).length;
    const total = results.length;

    console.log(`\n${"═".repeat(70)}`);
    console.log(`MOBILE VALIDATION: ${totalReadable}/${total} images readable at 375px`);
    if (totalReadable < total) {
        console.log(`⚠️  ${total - totalReadable} image(s) below readability threshold`);
    } else {
        console.log(`✅ All images pass mobile readability check`);
    }
    console.log(`Screenshots saved to: ${outputDir}`);
    console.log(`${"═".repeat(70)}\n`);

    process.exit(totalReadable === total ? 0 : 1);
}

run().catch(err => {
    console.error("Fatal:", err.message);
    process.exit(2);
});

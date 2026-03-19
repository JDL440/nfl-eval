/**
 * Alternative B: Playwright-based table renderer
 *
 * Uses the same HTML/CSS from buildHtml() but captures via Playwright's
 * element screenshot API instead of spawnSync(chrome).
 *
 * Advantages over current approach:
 * - Native element clipping (no PowerShell whitespace cropping)
 * - Proper async font loading
 * - Cross-platform (no Windows-only PowerShell dependency)
 * - Device scale factor via viewport config
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

let _browser = null;

async function getBrowser() {
    if (!_browser || !_browser.isConnected()) {
        _browser = await chromium.launch({ headless: true });
    }
    return _browser;
}

/**
 * Render HTML to PNG using Playwright element screenshot.
 * Matches the signature of renderTablePng: { html, width, height, outputPath }
 * Returns: { width, height, bytes }
 */
export async function renderTablePngPlaywright({ html, width, height, outputPath }) {
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

        // Wait for fonts to settle
        await page.evaluate(() => document.fonts.ready);

        // Screenshot the table frame element directly — no whitespace cropping needed
        const tableFrame = page.locator(".table-frame");
        await tableFrame.waitFor({ state: "visible", timeout: 5000 });

        const screenshot = await tableFrame.screenshot({
            type: "png",
            omitBackground: false,
        });

        writeFileSync(outputPath, screenshot);

        // Read actual dimensions from the PNG header
        const pngWidth = screenshot.readUInt32BE(16);
        const pngHeight = screenshot.readUInt32BE(20);

        return {
            width: pngWidth,
            height: pngHeight,
            bytes: screenshot.length,
        };
    } finally {
        await context.close();
    }
}

/**
 * Full render pipeline: parse markdown → build HTML → Playwright screenshot.
 * Mirrors the renderTableImage() interface for direct comparison.
 */
export async function renderTableImagePlaywright(args, { parseMarkdownTable, buildHtml, buildAltText, buildSuggestedTakeaway }) {
    const table = parseMarkdownTable(args.table_markdown);
    const { html, width, height, model } = buildHtml(table, {
        title: args.title,
        caption: args.caption,
        template: args.template,
        mobile: args.mobile,
    });

    const image = await renderTablePngPlaywright({ html, width, height, outputPath: args.outputPath });
    return { image, table, model };
}

export async function closeBrowser() {
    if (_browser) {
        await _browser.close();
        _browser = null;
    }
}

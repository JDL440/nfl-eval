#!/usr/bin/env node
/**
 * validate-stage-mobile.mjs — Playwright validation of the nfllabstage draft
 * at a 375px mobile viewport.
 *
 * Loads the draft URL with auth cookies, captures screenshots, measures
 * rendered image dimensions, and reports readability at mobile width.
 *
 * Usage: node validate-stage-mobile.mjs [--headed]
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname || process.cwd());
const HEADED = process.argv.includes("--headed");

// ─── Config ──────────────────────────────────────────────────────────────────

function loadEnv() {
    const p = resolve(ROOT, ".env");
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
const STAGE_URL = process.env.SUBSTACK_STAGE_URL || env.SUBSTACK_STAGE_URL;

if (!TOKEN) { console.error("Missing SUBSTACK_TOKEN"); process.exit(1); }
if (!STAGE_URL) { console.error("Missing SUBSTACK_STAGE_URL"); process.exit(1); }

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    if (m) return m[1];
    throw new Error(`Cannot extract subdomain: ${url}`);
}

const SUBDOMAIN = extractSubdomain(STAGE_URL);

function decodeCookies(token) {
    let substackSid, connectSid;
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        substackSid = decoded.substack_sid;
        connectSid = decoded.connect_sid || decoded.substack_sid;
    } catch {
        substackSid = token.trim();
        connectSid = token.trim();
    }
    return { substackSid, connectSid };
}

// Draft from publish-stage-validation.mjs output
const DRAFT_ID = "191225023";
const DRAFT_URL = `https://${SUBDOMAIN}.substack.com/publish/post/${DRAFT_ID}`;
// Preview uses the API to get the correct slug
const PREVIEW_URL = `https://${SUBDOMAIN}.substack.com/api/v1/drafts/${DRAFT_ID}`;

const OUT_DIR = resolve(ROOT, "content", "images", "stage-validation-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
    console.log(`\n📱 Substack Mobile Validation — Playwright`);
    console.log(`   Target: ${SUBDOMAIN}.substack.com`);
    console.log(`   Draft:  ${DRAFT_ID}`);
    console.log(`   Mode:   ${HEADED ? "headed" : "headless"}\n`);

    const { substackSid, connectSid } = decodeCookies(TOKEN);

    const browser = await chromium.launch({ headless: !HEADED, channel: "chrome" });

    // Mobile viewport context (iPhone SE / typical mobile)
    const mobileContext = await browser.newContext({
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });

    // Desktop viewport context for comparison
    const desktopContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    // Set cookies on both contexts
    for (const ctx of [mobileContext, desktopContext]) {
        await ctx.addCookies([
            { name: "substack.sid", value: substackSid, domain: ".substack.com", path: "/", httpOnly: true, secure: true, sameSite: "None" },
            { name: "connect.sid", value: connectSid, domain: `.${SUBDOMAIN}.substack.com`, path: "/", httpOnly: true, secure: true, sameSite: "None" },
        ]);
    }

    // ── Step 1: Editor page check (schema errors) ────────────────────────
    console.log("═══ Step 1: Editor Schema Validation ═══\n");
    {
        const page = await desktopContext.newPage();
        const errors = [];
        page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
        page.on("pageerror", err => errors.push(err.message));

        console.log(`  Loading editor: ${DRAFT_URL}`);
        await page.goto(DRAFT_URL, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(5000);

        const rangeErrors = errors.filter(e => /RangeError|Invalid content|schema/i.test(e));
        if (rangeErrors.length > 0) {
            console.log(`  ❌ Schema errors found:`);
            rangeErrors.forEach(e => console.log(`     ${e.slice(0, 120)}`));
        } else {
            console.log(`  ✅ No schema errors detected`);
        }

        await page.screenshot({ path: resolve(OUT_DIR, "editor-desktop.png"), fullPage: true });
        console.log(`  📸 Screenshot: editor-desktop.png\n`);
        await page.close();
    }

    // ── Step 2: Mobile preview — measure images ──────────────────────────
    console.log("═══ Step 2: Mobile Preview (375px) ═══\n");
    {
        const page = await mobileContext.newPage();

        // Use the editor draft URL (authenticated) — it renders the article content
        console.log(`  Loading draft: ${DRAFT_URL}`);
        await page.goto(DRAFT_URL, { waitUntil: "networkidle", timeout: 60000 });

        await page.waitForTimeout(3000);
        await page.screenshot({ path: resolve(OUT_DIR, "mobile-full.png"), fullPage: true });
        console.log(`  📸 Full-page screenshot: mobile-full.png`);

        // Find and measure all images
        const images = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll("img"));
            return imgs.map(img => ({
                src: img.src,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                renderedWidth: img.getBoundingClientRect().width,
                renderedHeight: img.getBoundingClientRect().height,
                alt: img.alt || "",
            })).filter(i => i.naturalWidth > 100);
        });

        console.log(`\n  Found ${images.length} content images:\n`);

        let allPass = true;
        for (const img of images) {
            const scaleRatio = img.renderedWidth / (img.naturalWidth / 2);
            // Our mobile PNGs use 20px base body font
            const effectiveFont = 20 * scaleRatio;
            const pass = effectiveFont >= 9;
            if (!pass) allPass = false;

            const shortSrc = img.src.includes("substack-post-media") ?
                img.src.split("/").pop().slice(0, 20) + "..." :
                img.src.slice(0, 50);

            console.log(`  ${pass ? "✅" : "❌"} ${shortSrc}`);
            console.log(`     Natural: ${img.naturalWidth}×${img.naturalHeight}`);
            console.log(`     Rendered: ${img.renderedWidth.toFixed(0)}×${img.renderedHeight.toFixed(0)} (at 375px viewport)`);
            console.log(`     Scale: ${scaleRatio.toFixed(3)}  →  Effective font: ${effectiveFont.toFixed(1)}px`);
            console.log();
        }

        if (images.length === 0) {
            console.log("  ⚠️  No images found — checking if page loaded correctly...");
            const title = await page.title();
            const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 300) || "");
            console.log(`  Page title: ${title}`);
            console.log(`  Body preview: ${bodyText.slice(0, 200)}...`);
        }

        console.log(allPass && images.length > 0 ?
            "  ══ All images PASS mobile readability threshold ══\n" :
            "  ══ Some images FAIL or no images found ══\n");

        // Take individual image screenshots for reference
        const imgElements = await page.$$("img");
        let idx = 0;
        for (const el of imgElements) {
            const box = await el.boundingBox();
            if (box && box.width > 50 && box.height > 50) {
                try {
                    await el.screenshot({ path: resolve(OUT_DIR, `mobile-img-${idx}.png`) });
                    idx++;
                } catch { /* skip if not visible */ }
            }
        }
        if (idx > 0) console.log(`  📸 ${idx} individual image screenshots saved\n`);

        await page.close();
    }

    // ── Step 3: Desktop preview for comparison ───────────────────────────
    console.log("═══ Step 3: Desktop Preview (1280px) ═══\n");
    {
        const page = await desktopContext.newPage();
        await page.goto(DRAFT_URL, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: resolve(OUT_DIR, "desktop-full.png"), fullPage: true });
        console.log(`  📸 Full-page screenshot: desktop-full.png\n`);
        await page.close();
    }

    await mobileContext.close();
    await desktopContext.close();
    await browser.close();

    console.log(`\n✅ Validation complete. Screenshots in: ${OUT_DIR}`);
}

run().catch(err => {
    console.error("Fatal:", err.message);
    process.exit(1);
});

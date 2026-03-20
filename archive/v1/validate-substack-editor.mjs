#!/usr/bin/env node
/**
 * validate-substack-editor.mjs — Browser-level validation for Substack drafts
 *
 * Opens each draft URL in a real Chromium browser with authenticated cookies,
 * waits for the editor to load, and checks the console for RangeError or
 * other schema errors. This is the only reliable way to predict whether a
 * draft will open cleanly in the Substack editor.
 *
 * Cookies are set in-memory only (incognito context). Nothing is persisted.
 *
 * Usage: node validate-substack-editor.mjs [--headed]
 */

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

const HEADED = process.argv.includes("--headed");

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    if (m) return m[1];
    throw new Error(`Cannot extract subdomain: ${url}`);
}

const SUBDOMAIN = extractSubdomain(PROD_URL);

// Decode token into cookie values (same logic as repair-prod-drafts.mjs)
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

// ─── Draft URLs ──────────────────────────────────────────────────────────────

const DRAFTS = [
    { slug: "witherspoon-extension-v2", draftId: "191200944" },
    { slug: "jsn-extension-preview",    draftId: "191200952" },
    { slug: "den-2026-offseason",       draftId: "191154355" },
    { slug: "mia-tua-dead-cap-rebuild", draftId: "191150015" },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
    console.log(`\n🔍 Substack Editor Validation — Browser-Level`);
    console.log(`   Target: ${SUBDOMAIN}.substack.com`);
    console.log(`   Mode: ${HEADED ? "headed (visible browser)" : "headless"}`);
    console.log(`   Drafts: ${DRAFTS.length}\n`);

    const { substackSid, connectSid } = decodeCookies(TOKEN);

    const browser = await chromium.launch({
        headless: !HEADED,
        channel: "chrome",
    });

    // Use an incognito context so cookies are never persisted
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    // Set session cookies in memory only
    await context.addCookies([
        {
            name: "substack.sid",
            value: substackSid,
            domain: ".substack.com",
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "None",
        },
        {
            name: "connect.sid",
            value: connectSid,
            domain: `.${SUBDOMAIN}.substack.com`,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "None",
        },
    ]);

    const results = [];

    for (const draft of DRAFTS) {
        const url = `https://${SUBDOMAIN}.substack.com/publish/post/${draft.draftId}`;
        console.log(`📝 ${draft.slug} (${draft.draftId})...`);

        const page = await context.newPage();

        const consoleErrors = [];
        const pageErrors = [];

        // Capture console messages (especially errors)
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(msg.text());
            }
        });

        // Capture uncaught exceptions (this is where RangeError would appear)
        page.on("pageerror", (err) => {
            pageErrors.push(err.message);
        });

        // Track dialog popups (Substack may show an alert on error)
        let dialogSeen = null;
        page.on("dialog", async (dialog) => {
            dialogSeen = { type: dialog.type(), message: dialog.message() };
            console.log(`   ⚠️  Dialog: [${dialog.type()}] ${dialog.message()}`);
            await dialog.dismiss();
        });

        try {
            // Navigate and wait for network to settle
            await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

            // Give the editor extra time to initialize ProseMirror
            await page.waitForTimeout(5000);

            // Check if the editor area loaded (look for ProseMirror contenteditable)
            const editorLoaded = await page.evaluate(() => {
                const el = document.querySelector('[contenteditable="true"]') ||
                           document.querySelector('.ProseMirror') ||
                           document.querySelector('[role="textbox"]');
                return !!el;
            });

            // Check for specific error patterns in console
            const rangeErrors = pageErrors.filter(e =>
                e.includes("RangeError") || e.includes("Unknown node type")
            );
            const consoleRangeErrors = consoleErrors.filter(e =>
                e.includes("RangeError") || e.includes("Unknown node type")
            );

            const hasSchemaError = rangeErrors.length > 0 || consoleRangeErrors.length > 0;
            const hasDialog = dialogSeen !== null;

            if (hasSchemaError) {
                console.log(`   ❌ SCHEMA ERROR detected:`);
                for (const e of [...rangeErrors, ...consoleRangeErrors]) {
                    console.log(`      ${e.slice(0, 200)}`);
                }
                results.push({ slug: draft.slug, status: "FAIL", reason: "Schema error in console", errors: [...rangeErrors, ...consoleRangeErrors] });
            } else if (hasDialog) {
                console.log(`   ❌ ERROR DIALOG appeared: ${dialogSeen.message}`);
                results.push({ slug: draft.slug, status: "FAIL", reason: `Dialog: ${dialogSeen.message}` });
            } else if (!editorLoaded) {
                // Check if we were redirected (auth failure)
                const currentUrl = page.url();
                if (currentUrl.includes("/sign-in") || currentUrl.includes("/login")) {
                    console.log(`   ⚠️  AUTH REDIRECT — session cookies may be expired`);
                    results.push({ slug: draft.slug, status: "AUTH_FAIL", reason: "Redirected to login" });
                } else {
                    console.log(`   ⚠️  Editor contenteditable not found (may still be loading)`);
                    console.log(`      Current URL: ${currentUrl}`);
                    results.push({ slug: draft.slug, status: "UNCERTAIN", reason: "Editor element not detected" });
                }
            } else {
                // Log any non-schema console errors for awareness
                if (consoleErrors.length > 0 || pageErrors.length > 0) {
                    console.log(`   ✅ Editor loaded — no schema errors`);
                    console.log(`      (${consoleErrors.length} console errors, ${pageErrors.length} page errors — none schema-related)`);
                } else {
                    console.log(`   ✅ Editor loaded cleanly — zero errors`);
                }
                results.push({ slug: draft.slug, status: "PASS" });
            }
        } catch (err) {
            console.log(`   ❌ Navigation error: ${err.message.slice(0, 200)}`);
            results.push({ slug: draft.slug, status: "ERROR", reason: err.message.slice(0, 200) });
        }

        await page.close();
    }

    await context.close();
    await browser.close();

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log(`\n${"═".repeat(60)}`);
    console.log("VALIDATION SUMMARY");
    console.log(`${"═".repeat(60)}`);

    let allPass = true;
    for (const r of results) {
        const icon = r.status === "PASS" ? "✅" : r.status === "AUTH_FAIL" ? "🔑" : r.status === "UNCERTAIN" ? "⚠️" : "❌";
        console.log(`  ${icon} ${r.slug}: ${r.status}${r.reason ? ` — ${r.reason}` : ""}`);
        if (r.status !== "PASS") allPass = false;
    }

    console.log(`${"═".repeat(60)}`);
    if (allPass) {
        console.log("✅ ALL DRAFTS PASSED BROWSER VALIDATION");
    } else {
        console.log("⚠️  SOME DRAFTS DID NOT PASS — see details above");
    }
    console.log();

    process.exit(allPass ? 0 : 1);
}

run().catch(err => {
    console.error("Fatal:", err.message);
    process.exit(2);
});

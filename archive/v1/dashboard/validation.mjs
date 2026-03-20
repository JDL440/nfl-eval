/**
 * validation.mjs — Live validation hooks for the dashboard.
 *
 * Wraps the Playwright-based validation patterns from validate-substack-editor.mjs
 * and validate-stage-mobile.mjs into parameterized functions callable from dashboard
 * routes. Manual-trigger only — never runs on page load.
 *
 * Prerequisites:
 * - SUBSTACK_TOKEN in .env or environment
 * - playwright devDependency installed
 * - Article must have a substack_draft_url in pipeline.db
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { getArticle } from "./data.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const RESULTS_PATH = join(import.meta.dirname, "validation-results.json");
const SCREENSHOTS_BASE = join(REPO_ROOT, "content", "images", "stage-validation-screenshots");

// ── Env / auth helpers (mirrors existing validate-*.mjs patterns) ────────────

function loadEnv() {
    const p = resolve(REPO_ROOT, ".env");
    const env = {};
    if (!existsSync(p)) return env;
    for (const line of readFileSync(p, "utf-8").split("\n")) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
        if (!m || line.trimStart().startsWith("#")) continue;
        env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
}

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

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    return m ? m[1] : null;
}

function isStageDraftUrl(url) {
    try {
        return /stage/i.test(new URL(url).hostname);
    } catch {
        return false;
    }
}

/**
 * Check all prerequisites for running a validation.
 * Returns { ok, error?, token?, draftUrl?, draftId?, subdomain?, cookies? }
 */
function checkPrerequisites(slug) {
    const env = loadEnv();
    const token = process.env.SUBSTACK_TOKEN || env.SUBSTACK_TOKEN;

    if (!token) {
        return { ok: false, error: "Missing SUBSTACK_TOKEN in .env — required for browser validation." };
    }

    const article = getArticle(slug);
    const draftUrl = article?.substack_draft_url;

    if (!draftUrl) {
        return { ok: false, error: `No draft URL for "${slug}" in pipeline.db. Publish to Substack first (Stage 7).` };
    }

    if (!isStageDraftUrl(draftUrl)) {
        return { ok: false, error: "Dashboard validation is stage-only. This draft URL does not point to a stage Substack host." };
    }

    const subdomain = extractSubdomain(draftUrl);
    if (!subdomain) {
        return { ok: false, error: `Cannot extract subdomain from draft URL: ${draftUrl}` };
    }

    const draftIdMatch = draftUrl.match(/\/post\/(\d+)/);
    if (!draftIdMatch) {
        return { ok: false, error: `Cannot extract draft ID from URL: ${draftUrl}` };
    }

    return {
        ok: true,
        token,
        draftUrl,
        draftId: draftIdMatch[1],
        subdomain,
        cookies: decodeCookies(token),
    };
}

// ── Result persistence (simple local JSON) ───────────────────────────────────

function loadResults() {
    if (!existsSync(RESULTS_PATH)) return {};
    try {
        return JSON.parse(readFileSync(RESULTS_PATH, "utf-8"));
    } catch { return {}; }
}

function saveResult(slug, type, result) {
    const all = loadResults();
    if (!all[slug]) all[slug] = {};
    all[slug][type] = { ...result, timestamp: new Date().toISOString() };
    writeFileSync(RESULTS_PATH, JSON.stringify(all, null, 2));
}

export function getValidationResults(slug) {
    return loadResults()[slug] || null;
}

export function getAllValidationResults() {
    return loadResults();
}

// ── Editor validation (schema check) ─────────────────────────────────────────

export async function runEditorValidation(slug) {
    const prereq = checkPrerequisites(slug);
    if (!prereq.ok) {
        const result = { status: "PREREQ_FAIL", error: prereq.error };
        saveResult(slug, "editor", result);
        return result;
    }

    let chromium;
    try {
        ({ chromium } = await import("playwright"));
    } catch {
        const result = { status: "PREREQ_FAIL", error: "Playwright not available. Run: npm install" };
        saveResult(slug, "editor", result);
        return result;
    }

    const screenshotDir = join(SCREENSHOTS_BASE, slug);
    mkdirSync(screenshotDir, { recursive: true });

    const { subdomain, draftId, cookies } = prereq;
    const url = `https://${subdomain}.substack.com/publish/post/${draftId}`;
    const screenshotRel = `content/images/stage-validation-screenshots/${slug}/editor-desktop.png`;

    let browser;
    try {
        browser = await chromium.launch({ headless: true, channel: "chrome" });
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        });

        await context.addCookies([
            { name: "substack.sid", value: cookies.substackSid, domain: ".substack.com", path: "/", httpOnly: true, secure: true, sameSite: "None" },
            { name: "connect.sid", value: cookies.connectSid, domain: `.${subdomain}.substack.com`, path: "/", httpOnly: true, secure: true, sameSite: "None" },
        ]);

        const page = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];
        let dialogSeen = null;

        page.on("console", (msg) => {
            if (msg.type() === "error") consoleErrors.push(msg.text());
        });
        page.on("pageerror", (err) => pageErrors.push(err.message));
        page.on("dialog", async (dialog) => {
            dialogSeen = { type: dialog.type(), message: dialog.message() };
            await dialog.dismiss();
        });

        await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(5000);

        // Capture state before closing
        const currentUrl = page.url();
        await page.screenshot({ path: join(screenshotDir, "editor-desktop.png"), fullPage: true });

        const editorLoaded = await page.evaluate(() => {
            const el = document.querySelector('[contenteditable="true"]') ||
                       document.querySelector('.ProseMirror') ||
                       document.querySelector('[role="textbox"]');
            return !!el;
        });

        await page.close();
        await context.close();

        const rangeErrors = pageErrors.filter(e => e.includes("RangeError") || e.includes("Unknown node type"));
        const consoleRangeErrors = consoleErrors.filter(e => e.includes("RangeError") || e.includes("Unknown node type"));
        const hasSchemaError = rangeErrors.length > 0 || consoleRangeErrors.length > 0;

        let result;
        if (hasSchemaError) {
            result = {
                status: "FAIL",
                reason: "Schema error detected in editor console",
                errors: [...rangeErrors, ...consoleRangeErrors].map(e => e.slice(0, 300)),
                screenshotPath: screenshotRel,
                draftUrl: url,
            };
        } else if (dialogSeen) {
            result = {
                status: "FAIL",
                reason: `Error dialog: ${dialogSeen.message}`,
                screenshotPath: screenshotRel,
                draftUrl: url,
            };
        } else if (!editorLoaded) {
            if (currentUrl.includes("/sign-in") || currentUrl.includes("/login")) {
                result = {
                    status: "AUTH_FAIL",
                    reason: "Redirected to login — SUBSTACK_TOKEN may be expired.",
                    screenshotPath: screenshotRel,
                    draftUrl: url,
                };
            } else {
                result = {
                    status: "UNCERTAIN",
                    reason: "Editor contenteditable element not found — page may still be loading.",
                    screenshotPath: screenshotRel,
                    draftUrl: url,
                };
            }
        } else {
            const nonSchemaCount = consoleErrors.length + pageErrors.length;
            result = {
                status: "PASS",
                reason: nonSchemaCount > 0
                    ? `Editor loaded — no schema errors (${nonSchemaCount} non-schema console messages)`
                    : "Editor loaded cleanly — zero errors",
                screenshotPath: screenshotRel,
                draftUrl: url,
            };
        }

        saveResult(slug, "editor", result);
        return result;
    } catch (err) {
        const result = {
            status: "ERROR",
            error: err.message?.slice(0, 500) || String(err),
            draftUrl: url,
        };
        saveResult(slug, "editor", result);
        return result;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

// ── Mobile validation (375px viewport + image readability) ───────────────────

export async function runMobileValidation(slug) {
    const prereq = checkPrerequisites(slug);
    if (!prereq.ok) {
        const result = { status: "PREREQ_FAIL", error: prereq.error };
        saveResult(slug, "mobile", result);
        return result;
    }

    let chromium;
    try {
        ({ chromium } = await import("playwright"));
    } catch {
        const result = { status: "PREREQ_FAIL", error: "Playwright not available. Run: npm install" };
        saveResult(slug, "mobile", result);
        return result;
    }

    const screenshotDir = join(SCREENSHOTS_BASE, slug);
    mkdirSync(screenshotDir, { recursive: true });

    const { subdomain, draftId, cookies } = prereq;
    const url = `https://${subdomain}.substack.com/publish/post/${draftId}`;

    let browser;
    try {
        browser = await chromium.launch({ headless: true, channel: "chrome" });

        const mobileContext = await browser.newContext({
            viewport: { width: 375, height: 812 },
            deviceScaleFactor: 2,
            isMobile: true,
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        });

        await mobileContext.addCookies([
            { name: "substack.sid", value: cookies.substackSid, domain: ".substack.com", path: "/", httpOnly: true, secure: true, sameSite: "None" },
            { name: "connect.sid", value: cookies.connectSid, domain: `.${subdomain}.substack.com`, path: "/", httpOnly: true, secure: true, sameSite: "None" },
        ]);

        const page = await mobileContext.newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(3000);

        await page.screenshot({
            path: join(screenshotDir, "mobile-full.png"),
            fullPage: true,
        });

        const images = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("img"))
                .map(img => ({
                    src: (img.src || "").slice(0, 100),
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    renderedWidth: Math.round(img.getBoundingClientRect().width),
                    renderedHeight: Math.round(img.getBoundingClientRect().height),
                    alt: (img.alt || "").slice(0, 80),
                }))
                .filter(i => i.naturalWidth > 100);
        });

        let allPass = true;
        const imageResults = images.map(img => {
            const scaleRatio = img.renderedWidth / (img.naturalWidth / 2);
            const effectiveFont = 20 * scaleRatio;
            const pass = effectiveFont >= 9;
            if (!pass) allPass = false;
            return {
                ...img,
                scaleRatio: +scaleRatio.toFixed(3),
                effectiveFont: +effectiveFont.toFixed(1),
                pass,
            };
        });

        // Capture individual image screenshots
        const screenshotPaths = [`content/images/stage-validation-screenshots/${slug}/mobile-full.png`];
        const imgElements = await page.$$("img");
        let idx = 0;
        for (const el of imgElements) {
            const box = await el.boundingBox();
            if (box && box.width > 50 && box.height > 50) {
                try {
                    await el.screenshot({
                        path: join(screenshotDir, `mobile-img-${idx}.png`),
                    });
                    screenshotPaths.push(
                        `content/images/stage-validation-screenshots/${slug}/mobile-img-${idx}.png`
                    );
                    idx++;
                } catch { /* element may not be visible */ }
            }
        }

        await page.close();
        await mobileContext.close();

        const result = {
            status: allPass && images.length > 0 ? "PASS" : images.length === 0 ? "UNCERTAIN" : "FAIL",
            reason: images.length === 0
                ? "No content images found — page may not have loaded correctly or auth may have failed."
                : allPass
                    ? `All ${images.length} image(s) pass mobile readability threshold.`
                    : `${imageResults.filter(i => !i.pass).length} of ${images.length} image(s) fail mobile readability.`,
            images: imageResults,
            screenshotPaths,
            draftUrl: url,
        };

        saveResult(slug, "mobile", result);
        return result;
    } catch (err) {
        const result = {
            status: "ERROR",
            error: err.message?.slice(0, 500) || String(err),
            draftUrl: url,
        };
        saveResult(slug, "mobile", result);
        return result;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

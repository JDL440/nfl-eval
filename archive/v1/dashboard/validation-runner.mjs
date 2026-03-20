/**
 * validation-runner.mjs — Dashboard child-process validation runner.
 *
 * Spawned by server.mjs as an isolated child process. Never imported into the
 * HTTP server process. Accepts CLI args:
 *   --slug <article-slug>  --type <editor|mobile>  --draft-url <url>
 *
 * Guards:
 *   - Stage-only: refuses non-stage draft URLs (belt-and-suspenders with server).
 *   - Credential isolation: loads SUBSTACK_TOKEN from .env inside this process;
 *     never echoes tokens in stdout/result JSON.
 *
 * Artifacts:
 *   - Writes results to dashboard/validation-results.json
 *   - Writes screenshots to content/images/stage-validation-screenshots/<slug>/
 *
 * Protocol: emits one __VALIDATION_RESULT__{json} line on stdout for the
 * server to parse.  Exit 0 = PASS, 1 = non-pass, 2 = fatal crash.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const RESULTS_PATH = join(import.meta.dirname, "validation-results.json");
const SCREENSHOTS_BASE = join(REPO_ROOT, "content", "images", "stage-validation-screenshots");

// ── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--") && i + 1 < argv.length) {
            args[argv[i].slice(2)] = argv[i + 1];
            i++;
        }
    }
    return args;
}

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

// ── URL helpers ──────────────────────────────────────────────────────────────

function isStageDraftUrl(url) {
    try { return /stage/i.test(new URL(url).hostname); } catch { return false; }
}

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    return m ? m[1] : null;
}

function extractDraftId(url) {
    const m = url.match(/\/post\/(\d+)/);
    return m ? m[1] : null;
}

// ── Result persistence ───────────────────────────────────────────────────────

function loadResults() {
    if (!existsSync(RESULTS_PATH)) return {};
    try { return JSON.parse(readFileSync(RESULTS_PATH, "utf-8")); } catch { return {}; }
}

function saveResult(slug, type, result) {
    const all = loadResults();
    if (!all[slug]) all[slug] = {};
    all[slug][type] = { ...result, timestamp: new Date().toISOString() };
    writeFileSync(RESULTS_PATH, JSON.stringify(all, null, 2));
}

function emitAndExit(result, slug, type, exitCode) {
    if (slug && type) {
        try { saveResult(slug, type, result); } catch { /* best effort */ }
    }
    process.stdout.write(`__VALIDATION_RESULT__${JSON.stringify(result)}\n`);
    process.exit(exitCode);
}

// ── Editor validation (schema check) ─────────────────────────────────────────

async function runEditorValidation(slug, cookies, subdomain, draftId) {
    const screenshotDir = join(SCREENSHOTS_BASE, slug);
    mkdirSync(screenshotDir, { recursive: true });

    const url = `https://${subdomain}.substack.com/publish/post/${draftId}`;
    const screenshotRel = `content/images/stage-validation-screenshots/${slug}/editor-desktop.png`;

    let chromium;
    try {
        ({ chromium } = await import("playwright"));
    } catch {
        return { status: "PREREQ_FAIL", error: "Playwright not available. Run: npm install" };
    }

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

        if (hasSchemaError) {
            return {
                status: "FAIL",
                reason: "Schema error detected in editor console",
                errors: [...rangeErrors, ...consoleRangeErrors].map(e => e.slice(0, 300)),
                screenshotPath: screenshotRel,
                draftUrl: url,
            };
        }
        if (dialogSeen) {
            return {
                status: "FAIL",
                reason: `Error dialog: ${dialogSeen.message}`,
                screenshotPath: screenshotRel,
                draftUrl: url,
            };
        }
        if (!editorLoaded) {
            if (currentUrl.includes("/sign-in") || currentUrl.includes("/login")) {
                return {
                    status: "AUTH_FAIL",
                    reason: "Redirected to login — SUBSTACK_TOKEN may be expired.",
                    screenshotPath: screenshotRel,
                    draftUrl: url,
                };
            }
            return {
                status: "UNCERTAIN",
                reason: "Editor contenteditable element not found — page may still be loading.",
                screenshotPath: screenshotRel,
                draftUrl: url,
            };
        }

        const nonSchemaCount = consoleErrors.length + pageErrors.length;
        return {
            status: "PASS",
            reason: nonSchemaCount > 0
                ? `Editor loaded — no schema errors (${nonSchemaCount} non-schema console messages)`
                : "Editor loaded cleanly — zero errors",
            screenshotPath: screenshotRel,
            draftUrl: url,
        };
    } catch (err) {
        return {
            status: "ERROR",
            error: err.message?.slice(0, 500) || String(err),
            draftUrl: url,
        };
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

// ── Mobile validation (375px viewport + image readability) ───────────────────

async function runMobileValidation(slug, cookies, subdomain, draftId) {
    const screenshotDir = join(SCREENSHOTS_BASE, slug);
    mkdirSync(screenshotDir, { recursive: true });

    const url = `https://${subdomain}.substack.com/publish/post/${draftId}`;

    let chromium;
    try {
        ({ chromium } = await import("playwright"));
    } catch {
        return { status: "PREREQ_FAIL", error: "Playwright not available. Run: npm install" };
    }

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

        return {
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
    } catch (err) {
        return {
            status: "ERROR",
            error: err.message?.slice(0, 500) || String(err),
            draftUrl: url,
        };
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const slug = args.slug;
    const type = args.type;
    const draftUrl = args["draft-url"];

    if (!slug || !type || !draftUrl) {
        throw new Error("Usage: node dashboard/validation-runner.mjs --slug <slug> --type <editor|mobile> --draft-url <url>");
    }

    if (!["editor", "mobile"].includes(type)) {
        throw new Error(`Invalid type "${type}" — must be "editor" or "mobile".`);
    }

    // Stage-only guard (belt + suspenders — server also checks before spawning)
    if (!isStageDraftUrl(draftUrl)) {
        emitAndExit(
            { status: "BLOCKED", error: "Stage-only guard: this draft URL does not point to a stage Substack host." },
            slug, type, 1,
        );
    }

    // Resolve credentials (stays in this process — never echoed)
    const env = loadEnv();
    const token = process.env.SUBSTACK_TOKEN || env.SUBSTACK_TOKEN;
    if (!token) {
        emitAndExit(
            { status: "PREREQ_FAIL", error: "Missing SUBSTACK_TOKEN in .env — required for browser validation." },
            slug, type, 1,
        );
    }

    const subdomain = extractSubdomain(draftUrl);
    if (!subdomain) {
        emitAndExit(
            { status: "PREREQ_FAIL", error: `Cannot extract subdomain from draft URL: ${draftUrl}` },
            slug, type, 1,
        );
    }

    const draftId = extractDraftId(draftUrl);
    if (!draftId) {
        emitAndExit(
            { status: "PREREQ_FAIL", error: `Cannot extract draft ID from URL: ${draftUrl}` },
            slug, type, 1,
        );
    }

    const cookies = decodeCookies(token);

    const result = type === "mobile"
        ? await runMobileValidation(slug, cookies, subdomain, draftId)
        : await runEditorValidation(slug, cookies, subdomain, draftId);

    saveResult(slug, type, result);
    process.stdout.write(`__VALIDATION_RESULT__${JSON.stringify(result)}\n`);
    process.exit(result.status === "PASS" ? 0 : 1);
}

main().catch((error) => {
    const result = { status: "ERROR", error: error.message || String(error) };
    try {
        const args = parseArgs(process.argv.slice(2));
        if (args.slug && args.type) saveResult(args.slug, args.type, result);
    } catch { /* best effort */ }
    process.stdout.write(`__VALIDATION_RESULT__${JSON.stringify(result)}\n`);
    process.exit(2);
});

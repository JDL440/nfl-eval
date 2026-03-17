#!/usr/bin/env node
/**
 * validate-notes-smoke.mjs — Stage-only smoke test for Substack Notes API
 *
 * This script is Phase 0 / Phase 1 scaffolding for Notes integration.
 * It is intentionally gated: it will refuse to run until the real Notes
 * endpoint and payload shape have been captured from browser DevTools on
 * nfllabstage.  See docs/notes-api-discovery.md for the capture checklist.
 *
 * Smoke-test steps:
 *   1. Auth check  — verify session cookie against /api/v1/user/profile/self
 *   2. Build body  — construct a minimal ProseMirror bodyJson document
 *   3. POST        — send to the captured endpoint on nfllabstage
 *   4. Response    — print raw JSON / parsed identifiers
 *   5. Cleanup     — indicate whether cleanup is manual
 *
 * Usage:
 *   node validate-notes-smoke.mjs                # smoke test (stage only)
 *   node validate-notes-smoke.mjs --dry-run      # build body + validate, skip POST
 *   node validate-notes-smoke.mjs --help         # show usage
 *
 * Environment:
 *   SUBSTACK_TOKEN          — session cookie (required)
 *   SUBSTACK_STAGE_URL      — e.g. https://nfllabstage.substack.com (required)
 *   NOTES_ENDPOINT_PATH     — captured API path, e.g. /api/v1/comment/feed (Phase 0)
 *   NOTES_PAYLOAD_SHAPE     — "prosemirror" or "plain" (Phase 0, default: prosemirror)
 *   NOTES_HOST              — host for Notes POST (default: publication subdomain — same-origin)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Env loader (same pattern as every other .mjs in this repo) ─────────────

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

function envVal(key) {
    return process.env[key] || env[key] || "";
}

// ─── CLI flags ──────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);
const HELP = ARGS.includes("--help") || ARGS.includes("-h");
const DRY_RUN = ARGS.includes("--dry-run");

if (HELP) {
    console.log(`
validate-notes-smoke.mjs — Stage-only Substack Notes smoke test

Usage:
  node validate-notes-smoke.mjs              # full smoke test (stage only)
  node validate-notes-smoke.mjs --dry-run    # build & validate body, skip POST
  node validate-notes-smoke.mjs --help       # this message

Required .env / environment variables:
  SUBSTACK_TOKEN          Session cookie value (raw or base64 JSON)
  SUBSTACK_STAGE_URL      Stage publication URL (e.g. https://nfllabstage.substack.com)

Phase 0 capture variables (set after DevTools capture or open-source discovery):
  NOTES_ENDPOINT_PATH     API path, e.g. /api/v1/comment/feed
  NOTES_PAYLOAD_SHAPE     "prosemirror" (default) or "plain"
  NOTES_HOST              Host for POST (default: publication subdomain — same-origin)

See docs/notes-api-discovery.md for the full capture checklist.
`);
    process.exit(0);
}

// ─── Hard gates ─────────────────────────────────────────────────────────────

const TOKEN = envVal("SUBSTACK_TOKEN");
const STAGE_URL = envVal("SUBSTACK_STAGE_URL");
const NOTES_ENDPOINT = envVal("NOTES_ENDPOINT_PATH");
const PAYLOAD_SHAPE = envVal("NOTES_PAYLOAD_SHAPE") || "prosemirror";
const NOTES_HOST = envVal("NOTES_HOST") || "";  // default: publication subdomain (same-origin)

if (!TOKEN) {
    console.error("❌  SUBSTACK_TOKEN is not set. Cannot authenticate.");
    process.exit(1);
}

if (!STAGE_URL) {
    console.error("❌  SUBSTACK_STAGE_URL is not set. This script is stage-only.");
    console.error("   Set it in .env, e.g.: SUBSTACK_STAGE_URL=https://nfllabstage.substack.com");
    process.exit(1);
}

// Refuse anything that looks like production
if (/nfllab\.substack\.com/i.test(STAGE_URL) && !/stage/i.test(STAGE_URL)) {
    console.error("❌  SUBSTACK_STAGE_URL appears to be a production URL (no 'stage' in name).");
    console.error("   This script is stage-only. Aborting for safety.");
    process.exit(1);
}

if (!NOTES_ENDPOINT) {
    console.error("╔══════════════════════════════════════════════════════════════╗");
    console.error("║  PHASE 0 CAPTURE REQUIRED                                  ║");
    console.error("╠══════════════════════════════════════════════════════════════╣");
    console.error("║  NOTES_ENDPOINT_PATH is not set.                            ║");
    console.error("║                                                              ║");
    console.error("║  The Notes API endpoint has not been captured yet.           ║");
    console.error("║  See: docs/notes-api-discovery.md                            ║");
    console.error("║                                                              ║");
    console.error("║  Steps:                                                      ║");
    console.error("║    1. Open nfllabstage.substack.com in Chrome                ║");
    console.error("║    2. Open DevTools → Network tab                            ║");
    console.error("║    3. Create a Note manually                                 ║");
    console.error("║    4. Copy the POST endpoint path                            ║");
    console.error("║    5. Set NOTES_ENDPOINT_PATH in .env                        ║");
    console.error("╚══════════════════════════════════════════════════════════════╝");
    if (!DRY_RUN) {
        process.exit(1);
    }
    console.log("\n⚠️  --dry-run: continuing without endpoint to validate body construction.\n");
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    if (m) return m[1];
    throw new Error(`Cannot extract subdomain from: ${url}`);
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

function makeHeaders(token, pubHost) {
    const { substackSid, connectSid } = decodeCookies(token);
    const origin = pubHost ? `https://${pubHost}` : "https://substack.com";
    return {
        Cookie: `substack.sid=${substackSid}; connect.sid=${connectSid}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Origin: origin,
        Referer: `${origin}/`,
    };
}

const SUBDOMAIN = extractSubdomain(STAGE_URL);
const PUB_HOST = `${SUBDOMAIN}.substack.com`;
const HEADERS = makeHeaders(TOKEN, PUB_HOST);

// ─── ProseMirror document builder ───────────────────────────────────────────
//
// Notes likely require a ProseMirror bodyJson document (not plain text).
// This builder creates a minimal valid doc structure.  The exact node types
// may need adjustment after Phase 0 capture reveals the real schema.

/**
 * Build a minimal ProseMirror document for a Note.
 * @param {string} text      — The note text (one or more paragraphs separated by \n\n)
 * @param {object} [options]
 * @param {string} [options.linkUrl]   — Optional URL to append as a linked paragraph
 * @param {string} [options.linkText]  — Display text for the link (defaults to URL)
 * @returns {object} ProseMirror-compatible JSON document
 */
function buildNoteBody(text, options = {}) {
    const paragraphs = text
        .split(/\n\n+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const content = paragraphs.map((para) => ({
        type: "paragraph",
        content: [{ type: "text", text: para }],
    }));

    if (options.linkUrl) {
        content.push({
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: options.linkText || options.linkUrl,
                    marks: [
                        {
                            type: "link",
                            attrs: {
                                href: options.linkUrl,
                                target: "_blank",
                                class: null,
                            },
                        },
                    ],
                },
            ],
        });
    }

    return { type: "doc", attrs: { schemaVersion: "v1" }, content };
}

/**
 * Validate that a ProseMirror body has the minimal required structure.
 * Returns { valid: boolean, errors: string[] }.
 */
function validateNoteBody(body) {
    const errors = [];
    if (!body || typeof body !== "object") {
        errors.push("Body is not an object");
        return { valid: false, errors };
    }
    if (body.type !== "doc") {
        errors.push(`Root type is "${body.type}", expected "doc"`);
    }
    if (!Array.isArray(body.content) || body.content.length === 0) {
        errors.push("Body has no content nodes");
    }
    for (let i = 0; i < (body.content || []).length; i++) {
        const node = body.content[i];
        if (!node.type) errors.push(`content[${i}] has no type`);
        if (node.type === "paragraph" && (!Array.isArray(node.content) || node.content.length === 0)) {
            errors.push(`content[${i}] (paragraph) has no inline content`);
        }
    }
    return { valid: errors.length === 0, errors };
}

// ─── Smoke-test runner ──────────────────────────────────────────────────────

async function run() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║  Substack Notes — Stage Smoke Test                          ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log(`   Target:   ${SUBDOMAIN}.substack.com (STAGE)`);
    console.log(`   Endpoint: ${NOTES_ENDPOINT || "(not captured yet)"}`);
    console.log(`   Payload:  ${PAYLOAD_SHAPE}`);
    console.log(`   Dry-run:  ${DRY_RUN}`);
    console.log();

    // ── Step 1: Auth check ──────────────────────────────────────────────────

    console.log("── Step 1: Auth Check ─────────────────────────────────────────");
    try {
        const authUrl = `https://${SUBDOMAIN}.substack.com/api/v1/user/profile/self`;
        const res = await fetch(authUrl, { method: "GET", headers: HEADERS });

        if (!res.ok) {
            console.error(`   ❌ Auth failed: HTTP ${res.status}`);
            const body = await res.text().catch(() => "");
            if (body) console.error(`      ${body.slice(0, 300)}`);
            process.exit(1);
        }

        const profile = await res.json();
        const name = profile.name || profile.email || "(unknown)";
        console.log(`   ✅ Authenticated as: ${name}`);
        if (profile.id) console.log(`   User ID: ${profile.id}`);
    } catch (err) {
        console.error(`   ❌ Auth request failed: ${err.message}`);
        process.exit(1);
    }
    console.log();

    // ── Step 2: Build & validate ProseMirror body ───────────────────────────

    console.log("── Step 2: Build ProseMirror Note Body ───────────────────────");

    const SMOKE_TEXT = "🏈 NFL Lab smoke test — this Note was created by validate-notes-smoke.mjs and should be deleted.";
    const SMOKE_LINK = `https://${SUBDOMAIN}.substack.com`;

    const noteBody = buildNoteBody(SMOKE_TEXT, {
        linkUrl: SMOKE_LINK,
        linkText: `${SUBDOMAIN}.substack.com`,
    });

    const validation = validateNoteBody(noteBody);
    if (!validation.valid) {
        console.error(`   ❌ ProseMirror body validation failed:`);
        for (const e of validation.errors) console.error(`      - ${e}`);
        process.exit(1);
    }

    console.log("   ✅ ProseMirror body is structurally valid");
    console.log(`   Paragraphs: ${noteBody.content.length}`);
    console.log(`   Body preview (JSON):`);
    console.log(`   ${JSON.stringify(noteBody).slice(0, 200)}...`);
    console.log();

    // ── Step 3: Prepare payload ─────────────────────────────────────────────

    console.log("── Step 3: Prepare Payload ───────────────────────────────────");

    // The payload keys are based on the postcli/substack open-source library
    // which has verified Notes via POST https://substack.com/api/v1/comment/feed.
    // Extra fields (tabId, surface, replyMinimumRole) are required by the API.
    const payload = PAYLOAD_SHAPE === "plain"
        ? { body: `${SMOKE_TEXT}\n\n${SMOKE_LINK}` }
        : {
            bodyJson: noteBody,
            tabId: "for-you",
            surface: "feed",
            replyMinimumRole: "everyone",
        };

    console.log("   Payload keys: " + Object.keys(payload).join(", "));
    console.log(`   bodyJson size: ${JSON.stringify(noteBody).length} bytes`);
    console.log();

    // ── Step 4: POST (or dry-run skip) ──────────────────────────────────────

    if (DRY_RUN || !NOTES_ENDPOINT) {
        console.log("── Step 4: POST (skipped — dry-run or no endpoint) ──────────");
        if (!NOTES_ENDPOINT) {
            console.log("   ⏳ NOTES_ENDPOINT_PATH not set — Phase 0 capture still needed.");
            console.log("   See: docs/notes-api-discovery.md");
        } else {
            console.log("   ⏭️  --dry-run flag: skipping POST.");
        }
        console.log("\n   Body that would be sent:");
        console.log(JSON.stringify(payload, null, 2));
        console.log();
    } else {
        console.log("── Step 4: POST to Stage Endpoint ────────────────────────────");
        // Notes POST goes to the PUBLICATION host (same-origin pattern).
        // Browser DevTools capture confirmed: nfllab.substack.com, not substack.com.
        const notesHost = NOTES_HOST || PUB_HOST;
        const url = `https://${notesHost}${NOTES_ENDPOINT}`;
        console.log(`   URL: ${url}`);

        // Cloudflare Bot Management blocks server-side fetch() for write endpoints.
        // Must POST from within a real browser page context (page.evaluate).
        // Key requirements: --headless=new, --disable-blink-features=AutomationControlled,
        // real Chrome UA, proper sec-ch-ua headers.
        let status, rawText;
        try {
            console.log("   Using Playwright (browser page context) to bypass Cloudflare…");
            const { chromium } = await import("playwright");
            const browser = await chromium.launch({
                headless: false,
                args: ["--headless=new", "--disable-blink-features=AutomationControlled"],
            });
            const context = await browser.newContext({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                extraHTTPHeaders: {
                    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                },
            });

            // Inject auth cookie on the publication domain
            const { substackSid } = decodeCookies(TOKEN);
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
            ]);

            // Navigate to the publish page to accumulate Cloudflare/session cookies
            const page = await context.newPage();
            console.log(`   Navigating to https://${notesHost}/publish/home …`);
            await page.goto(`https://${notesHost}/publish/home`, { waitUntil: "networkidle", timeout: 30000 });
            console.log(`   Page loaded. Making POST from browser context…`);

            // Execute the POST from within the browser (same-origin, real browser context)
            const result = await page.evaluate(async ({ url, payload }) => {
                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                    credentials: "same-origin",
                });
                const text = await res.text();
                return { status: res.status, text };
            }, { url, payload });

            status = result.status;
            rawText = result.text;
            await browser.close();
        } catch (pwErr) {
            console.error(`   ⚠️  Playwright failed: ${pwErr.message}`);
            console.log("   Falling back to Node.js fetch…");

            // Fallback: direct fetch (may fail due to Cloudflare)
            const postHeaders = {
                ...HEADERS,
                Origin: `https://${notesHost}`,
                Referer: `https://${notesHost}/publish/home`,
                "sec-fetch-site": "same-origin",
                "sec-fetch-mode": "cors",
                "sec-fetch-dest": "empty",
            };
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: postHeaders,
                    body: JSON.stringify(payload),
                });
                status = res.status;
                rawText = await res.text();
            } catch (fetchErr) {
                console.error(`   ❌ Fetch also failed: ${fetchErr.message}`);
                status = 0;
                rawText = fetchErr.message;
            }
        }

        console.log(`   HTTP ${status}`);
        console.log(`   Response (${rawText.length} bytes):`);

        // Try to pretty-print JSON; fall back to raw text
        try {
            const json = JSON.parse(rawText);
            console.log(JSON.stringify(json, null, 2));

            // Try to extract identifiers from the response
            const noteId = json.id || json.note_id || json.comment_id || null;
            const noteUrl = json.url || json.canonical_url || null;
            if (noteId) console.log(`\n   📌 Note ID: ${noteId}`);
            if (noteUrl) console.log(`   🔗 Note URL: ${noteUrl}`);
        } catch {
            console.log(`   ${rawText.slice(0, 1000)}`);
        }

        if (status >= 400 || status === 0) {
            console.error(`\n   ❌ POST failed with HTTP ${status}.`);
            console.error("   The endpoint or payload shape may be wrong.");
            console.error("   Re-check docs/notes-api-discovery.md and update .env.");
        } else {
            console.log(`\n   ✅ POST returned HTTP ${status}`);
        }
    }
    console.log();

    // ── Step 5: Cleanup guidance ────────────────────────────────────────────

    console.log("── Step 5: Cleanup ────────────────────────────────────────────");
    if (DRY_RUN || !NOTES_ENDPOINT) {
        console.log("   No cleanup needed — nothing was posted.");
    } else {
        console.log("   ⚠️  MANUAL CLEANUP REQUIRED");
        console.log("   Notes cannot be deleted via a known API endpoint.");
        console.log("   To remove the smoke-test Note:");
        console.log(`     1. Open https://${SUBDOMAIN}.substack.com/notes`);
        console.log("     2. Find the smoke-test Note (starts with '🏈 NFL Lab smoke test')");
        console.log("     3. Click the ··· menu → Delete");
        console.log("   If a delete API is discovered during Phase 0 capture,");
        console.log("   update this script to automate cleanup.");
    }
    console.log();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  Smoke test complete.");
    if (!NOTES_ENDPOINT) {
        console.log("  ⏳ Phase 0 capture is the next step. See docs/notes-api-discovery.md");
    }
    console.log("═══════════════════════════════════════════════════════════════");
}

run().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(2);
});

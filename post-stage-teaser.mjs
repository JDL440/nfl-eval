#!/usr/bin/env node
/**
 * post-stage-teaser.mjs — DEPRECATED (2026-03-18)
 *
 * Stage 7 teaser Notes have been deprioritized per Joe's directive.
 * The promotion-note flow for published articles remains active via
 * publish-prod-notes.mjs and the notes-sweep in article_board.py.
 *
 * This script is preserved for reference but will exit immediately.
 * To post a promotion Note for a published article, use:
 *   - publish-prod-notes.mjs (batch)
 *   - publish_note_to_substack extension tool (single article)
 */

console.log("⚠️  post-stage-teaser.mjs is DEPRECATED (2026-03-18).");
console.log("   Stage 7 teaser Notes are disabled. Use publish-prod-notes.mjs");
console.log("   or the publish_note_to_substack tool for published articles.");
process.exit(0);

// ─── Original implementation preserved below for reference ──────────────────

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// ─── Env ────────────────────────────────────────────────────────────────────

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
function envVal(key) { return process.env[key] || env[key] || ""; }

const DRY_RUN = process.argv.includes("--dry-run");
const TOKEN = envVal("SUBSTACK_TOKEN");
const STAGE_URL = envVal("SUBSTACK_STAGE_URL");
const PROD_URL = envVal("SUBSTACK_PUBLICATION_URL");
const NOTES_ENDPOINT = envVal("NOTES_ENDPOINT_PATH");

if (!TOKEN || !STAGE_URL || !NOTES_ENDPOINT) {
    console.error("❌  Missing required env: SUBSTACK_TOKEN, SUBSTACK_STAGE_URL, NOTES_ENDPOINT_PATH");
    process.exit(1);
}
if (/nfllab\.substack\.com/i.test(STAGE_URL) && !/stage/i.test(STAGE_URL)) {
    console.error("❌  SUBSTACK_STAGE_URL looks like production. Stage-only. Aborting.");
    process.exit(1);
}

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    return m ? m[1] : null;
}

const STAGE_HOST = `${extractSubdomain(STAGE_URL)}.substack.com`;
const PROD_HOST = PROD_URL ? `${extractSubdomain(PROD_URL)}.substack.com` : "nfllab.substack.com";

function decodeSid(token) {
    try {
        return JSON.parse(Buffer.from(token, "base64").toString("utf-8")).substack_sid;
    } catch { return token.trim(); }
}

const SID = decodeSid(TOKEN);

// ─── Target article ─────────────────────────────────────────────────────────

const ARTICLE_ID = "witherspoon-extension-v2";
const TEASER = "Cap says $27M. The agent demands $33M. Our experts re-examine Seattle\u2019s most important extension decision.";

// Try to look up the article's published URL from pipeline.db for card attachment
function getArticleUrl() {
    const dbPath = resolve(process.cwd(), "content", "pipeline.db");
    if (!existsSync(dbPath)) return null;
    const db = new DatabaseSync(dbPath);
    const row = db.prepare("SELECT substack_url, substack_draft_url FROM articles WHERE id = ?").get(ARTICLE_ID);
    db.close();
    if (row?.substack_url) return row.substack_url;
    // The v2 article isn't published yet — check if the original v1 has a published URL
    // that shares the same topic (fallback for card rendering)
    return null;
}

const ARTICLE_URL = getArticleUrl();

// ─── ProseMirror builder ────────────────────────────────────────────────────

function buildCardBody(teaser) {
    return {
        type: "doc",
        attrs: { schemaVersion: "v1" },
        content: [
            { type: "paragraph", content: [{ type: "text", text: teaser }] },
        ],
    };
}

// ─── Register post attachment (plain fetch — not CF-blocked) ─────────────────

async function registerPostAttachment(articleUrl) {
    const resp = await fetch(`https://${PROD_HOST}/api/v1/comment/attachment`, {
        method: "POST",
        headers: {
            Cookie: `substack.sid=${SID}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({ url: articleUrl, type: "post" }),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Attachment HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    return data.id;
}

// ─── Post helper (Playwright — CF requires browser context) ─────────────────

async function postNote(bodyJson, attachmentIds) {
    const url = `https://${STAGE_HOST}${NOTES_ENDPOINT}`;
    const payload = {
        bodyJson,
        tabId: "for-you",
        surface: "feed",
        replyMinimumRole: "everyone",
        ...(attachmentIds?.length ? { attachmentIds } : {}),
    };

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
        headless: false,
        args: ["--headless=new", "--disable-blink-features=AutomationControlled"],
    });
    try {
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            extraHTTPHeaders: {
                "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
            },
        });
        await context.addCookies([{
            name: "substack.sid", value: SID, domain: ".substack.com",
            path: "/", httpOnly: true, secure: true, sameSite: "None",
        }]);
        const page = await context.newPage();
        await page.goto(`https://${STAGE_HOST}/publish/home`, { waitUntil: "networkidle", timeout: 30000 });

        const result = await page.evaluate(async ({ url, payload }) => {
            const res = await fetch(url, {
                method: "POST",
                headers: { Accept: "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                credentials: "same-origin",
            });
            return { status: res.status, text: await res.text() };
        }, { url, payload });

        if (result.status >= 400) throw new Error(`Note POST HTTP ${result.status}: ${result.text.slice(0, 300)}`);
        return JSON.parse(result.text);
    } finally {
        await browser.close();
    }
}

// ─── DB update ───────────────────────────────────────────────────────────────

function updatePipelineDb(noteId, noteUrl) {
    const dbPath = resolve(process.cwd(), "content", "pipeline.db");
    if (!existsSync(dbPath)) { console.warn("⚠️  pipeline.db not found — skipping DB update"); return; }

    const db = new DatabaseSync(dbPath);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.exec(`INSERT INTO notes (article_id, note_type, content, substack_note_url, target, created_by, created_at)
             VALUES ('${ARTICLE_ID}', 'promotion', '${TEASER.replace(/'/g, "''")}', '${noteUrl}', 'stage', 'Lead', '${now}')`);
    db.close();
    console.log(`✅ pipeline.db updated: stage teaser note row inserted for ${ARTICLE_ID}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🎯 STAGE TEASER: Post witherspoon-extension-v2 teaser to ${STAGE_HOST}`);
    console.log(`   Teaser: "${TEASER}"`);
    console.log(`   Article URL: ${ARTICLE_URL || "(not yet published — text-only note)"}`);
    console.log(`   Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"}\n`);

    const bodyJson = buildCardBody(TEASER);

    if (DRY_RUN) {
        console.log(`[DRY-RUN] Would post teaser Note to ${STAGE_HOST}`);
        if (ARTICLE_URL) console.log(`[DRY-RUN] Would register post attachment for ${ARTICLE_URL}`);
        console.log(`[DRY-RUN] Body: ${JSON.stringify(bodyJson).slice(0, 200)}`);
        return;
    }

    let attachmentIds = [];

    // Try article card attachment if we have a published URL
    if (ARTICLE_URL) {
        try {
            console.log(`   Registering post attachment for ${ARTICLE_URL}…`);
            const attachmentId = await registerPostAttachment(ARTICLE_URL);
            console.log(`   ✅ Attachment UUID: ${attachmentId}`);
            attachmentIds = [attachmentId];
        } catch (err) {
            console.warn(`   ⚠️  Card attachment failed (${err.message}) — posting text-only`);
        }
    } else {
        console.log(`   ℹ️  No published URL — posting text-only teaser (card can be added after publish)`);
    }

    // Post the note
    console.log(`   Posting teaser Note to ${STAGE_HOST}…`);
    const res = await postNote(bodyJson, attachmentIds);
    const noteId = res?.id || res?.comment?.id || null;
    const noteUrl = noteId ? `https://substack.com/@joerobinson495999/note/c-${noteId}` : null;

    console.log(`\n═══ RESULT ═══`);
    console.log(`   ✅ Note ID: ${noteId}`);
    console.log(`   Permalink: ${noteUrl}`);
    console.log(`   Article: ${ARTICLE_ID}`);
    console.log(`   Target: nfllabstage (stage)`);
    console.log(`   Card: ${attachmentIds.length > 0 ? "yes" : "text-only"}`);

    // Update pipeline.db
    if (noteId) {
        updatePipelineDb(noteId, noteUrl);
    }

    // Output JSON for downstream consumption
    const result = { articleId: ARTICLE_ID, noteId, noteUrl, teaser: TEASER, card: attachmentIds.length > 0 };
    console.log(`\n${JSON.stringify(result, null, 2)}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

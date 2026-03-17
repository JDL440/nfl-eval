#!/usr/bin/env node
/**
 * replace-stage-notes.mjs — Delete broken stage-review Notes and repost
 * with corrected ProseMirror (auto-linked URLs for article card rendering).
 *
 * STAGE-ONLY: hard-gated to nfllabstage. Will refuse production targets.
 *
 * Usage:
 *   node replace-stage-notes.mjs              # delete old + repost corrected
 *   node replace-stage-notes.mjs --dry-run    # show what would be done
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
// DB access via node:sqlite (built-in) — no external dependency needed

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

const SUBDOMAIN = extractSubdomain(STAGE_URL);
const PUB_HOST = `${SUBDOMAIN}.substack.com`;

function decodeSid(token) {
    try {
        return JSON.parse(Buffer.from(token, "base64").toString("utf-8")).substack_sid;
    } catch { return token.trim(); }
}

// ─── Phase 4 Notes to replace ───────────────────────────────────────────────

const BROKEN_NOTES = [
    {
        noteId: 229372212,
        articleId: "jsn-extension-preview",
        content: "JSN earns 90% below market. Our panel breaks the four extension paths and the $33M mistake Seattle must avoid.",
        articleUrl: "https://nfllab.substack.com/p/jaxon-smith-njigbas-extension-is",
    },
    {
        noteId: 229372239,
        articleId: "kc-fields-trade-evaluation",
        content: "The Chiefs traded for the NFL's most debated young QB at $3M. A dynasty bet or a stall?",
        articleUrl: "https://nfllab.substack.com/p/justin-fields-to-kansas-city-the",
    },
    {
        noteId: 229372275,
        articleId: "den-2026-offseason",
        content: "Sean Payton built contenders around the middle of the field. Denver's Super Bowl push may hinge on one tight end bet.",
        articleUrl: "https://nfllab.substack.com/p/the-broncos-missing-joker-why-denvers",
    },
    {
        noteId: 229372305,
        articleId: "mia-tua-dead-cap-rebuild",
        content: "The largest dead cap hit in NFL history. Our panel dissects how Miami rebuilds from a $99M ghost.",
        articleUrl: "https://nfllab.substack.com/p/99-million-ghost-how-miami-rebuilds",
    },
    {
        noteId: 229372344,
        articleId: "witherspoon-extension-cap-vs-agent",
        content: "Cap says $27M. The agent demands $33M. Our experts re-examine Seattle's most important extension decision.",
        articleUrl: "https://nfllab.substack.com/p/cap-says-27m-the-agent-demands-33m-d00",
    },
];

// ─── ProseMirror builder (with link marks) ──────────────────────────────────

function buildCardFirstBody(teaser, articleUrl) {
    const teaserPara = {
        type: "paragraph",
        content: [{ type: "text", text: teaser }],
    };
    const linkPara = {
        type: "paragraph",
        content: [{
            type: "text",
            text: articleUrl,
            marks: [{ type: "link", attrs: { href: articleUrl, target: "_blank" } }],
        }],
    };
    return { type: "doc", attrs: { schemaVersion: "v1" }, content: [teaserPara, linkPara] };
}

// ─── Delete helper (plain fetch — not CF-blocked) ───────────────────────────

async function deleteNote(noteId) {
    const sid = decodeSid(TOKEN);
    const url = `https://${PUB_HOST}/api/v1/notes/${noteId}`;
    const res = await fetch(url, {
        method: "DELETE",
        headers: {
            Cookie: `substack.sid=${sid}`,
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });
    return { status: res.status, ok: res.status < 500 };
}

// ─── Post helper (Playwright — CF requires browser context) ─────────────────

async function postNote(bodyJson) {
    const sid = decodeSid(TOKEN);
    const url = `https://${PUB_HOST}${NOTES_ENDPOINT}`;
    const payload = { bodyJson, tabId: "for-you", surface: "feed", replyMinimumRole: "everyone" };

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
            name: "substack.sid", value: sid, domain: ".substack.com",
            path: "/", httpOnly: true, secure: true, sameSite: "None",
        }]);
        const page = await context.newPage();
        await page.goto(`https://${PUB_HOST}/publish/home`, { waitUntil: "networkidle", timeout: 30000 });

        const result = await page.evaluate(async ({ url, payload }) => {
            const res = await fetch(url, {
                method: "POST",
                headers: { Accept: "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                credentials: "same-origin",
            });
            return { status: res.status, text: await res.text() };
        }, { url, payload });

        if (result.status >= 400) throw new Error(`HTTP ${result.status}: ${result.text.slice(0, 200)}`);
        return JSON.parse(result.text);
    } finally {
        await browser.close();
    }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🎯 Replace ${BROKEN_NOTES.length} broken stage Notes on ${PUB_HOST}`);
    console.log(`   Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"}\n`);

    const dbPath = resolve(process.cwd(), "content", "pipeline.db");
    let db;
    if (!DRY_RUN && existsSync(dbPath)) {
        try {
            const { DatabaseSync } = await import("node:sqlite");
            db = new DatabaseSync(dbPath);
        } catch { db = null; }
    }

    const results = [];

    for (const note of BROKEN_NOTES) {
        console.log(`── ${note.articleId} ──`);
        console.log(`   Old Note ID: ${note.noteId}`);
        console.log(`   Article URL: ${note.articleUrl}`);

        const bodyJson = buildCardFirstBody(note.content, note.articleUrl);
        console.log(`   ProseMirror: ${bodyJson.content.length} paragraphs (teaser + link-marked URL)`);

        if (DRY_RUN) {
            console.log(`   [DRY-RUN] Would delete ${note.noteId} and repost with link marks`);
            console.log(`   Body preview: ${JSON.stringify(bodyJson).slice(0, 200)}…\n`);
            continue;
        }

        // Delete old
        console.log(`   Deleting ${note.noteId}…`);
        const del = await deleteNote(note.noteId);
        console.log(`   DELETE HTTP ${del.status} ${del.ok ? "✅" : "⚠️"}`);

        // Post new
        console.log(`   Posting corrected Note…`);
        const res = await postNote(bodyJson);
        const newId = res?.id || res?.comment?.id || null;
        const newUrl = newId ? `https://substack.com/@joerobinson495999/note/c-${newId}` : null;
        console.log(`   ✅ New Note ID: ${newId}`);
        console.log(`   Permalink: ${newUrl}\n`);

        results.push({ articleId: note.articleId, oldId: note.noteId, newId, newUrl });

        // Update pipeline.db
        if (db && newId) {
            try {
                db.exec(`UPDATE notes SET substack_note_url = '${newUrl}' WHERE article_id = '${note.articleId}' AND substack_note_url LIKE '%${note.noteId}%'`);
            } catch (e) {
                console.log(`   ⚠️ DB update failed: ${e.message}`);
            }
        }
    }

    if (db) db.close();

    if (!DRY_RUN && results.length > 0) {
        console.log("\n═══ RESULTS ═══\n");
        for (const r of results) {
            console.log(`${r.articleId}:`);
            console.log(`  Old: c-${r.oldId} (deleted)`);
            console.log(`  New: c-${r.newId} → ${r.newUrl}`);
        }
    }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

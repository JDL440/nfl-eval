#!/usr/bin/env node
/**
 * retry-stage-notes.mjs — Delete current stage-review Notes and repost a
 * fresh set with post-type attachments for article card rendering.
 *
 * STAGE-ONLY: hard-gated to nfllabstage.
 *
 * Usage:
 *   node retry-stage-notes.mjs              # delete old + repost with cards
 *   node retry-stage-notes.mjs --dry-run    # show what would be done
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

const SID = decodeSid(TOKEN);

// ─── Previous batch (from Phase 5 — the set the user wants to replace) ──────

const PREVIOUS_NOTES = [
    {
        noteId: 229384944,
        articleId: "jsn-extension-preview",
        content: "JSN earns 90% below market. Our panel breaks the four extension paths and the $33M mistake Seattle must avoid.",
        articleUrl: "https://nfllab.substack.com/p/jaxon-smith-njigbas-extension-is",
    },
    {
        noteId: 229384978,
        articleId: "kc-fields-trade-evaluation",
        content: "The Chiefs traded for the NFL's most debated young QB at $3M. A dynasty bet or a stall?",
        articleUrl: "https://nfllab.substack.com/p/justin-fields-to-kansas-city-the",
    },
    {
        noteId: 229385012,
        articleId: "den-2026-offseason",
        content: "Sean Payton built contenders around the middle of the field. Denver\u2019s Super Bowl push may hinge on one tight end bet.",
        articleUrl: "https://nfllab.substack.com/p/the-broncos-missing-joker-why-denvers",
    },
    {
        noteId: 229385048,
        articleId: "mia-tua-dead-cap-rebuild",
        content: "The largest dead cap hit in NFL history. Our panel dissects how Miami rebuilds from a $99M ghost.",
        articleUrl: "https://nfllab.substack.com/p/99-million-ghost-how-miami-rebuilds",
    },
    {
        noteId: 229385077,
        articleId: "witherspoon-extension-cap-vs-agent",
        content: "Cap says $27M. The agent demands $33M. Our experts re-examine Seattle\u2019s most important extension decision.",
        articleUrl: "https://nfllab.substack.com/p/cap-says-27m-the-agent-demands-33m-d00",
    },
];

// ─── ProseMirror builder (text only — card comes from attachment) ────────────

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
    const host = "nfllab.substack.com";
    const resp = await fetch(`https://${host}/api/v1/comment/attachment`, {
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
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    return data.id;
}

// ─── Delete helper (plain fetch — not CF-blocked) ───────────────────────────

async function deleteNote(noteId) {
    const url = `https://${PUB_HOST}/api/v1/comment/${noteId}`;
    const res = await fetch(url, {
        method: "DELETE",
        headers: {
            Cookie: `substack.sid=${SID}`,
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });
    return { status: res.status, ok: res.status < 500 };
}

// ─── Post helper (Playwright — CF requires browser context) ─────────────────

async function postNote(bodyJson, attachmentIds) {
    const url = `https://${PUB_HOST}${NOTES_ENDPOINT}`;
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

        if (result.status >= 400) throw new Error(`HTTP ${result.status}: ${result.text.slice(0, 300)}`);
        return JSON.parse(result.text);
    } finally {
        await browser.close();
    }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🔄 RETRY: Replace ${PREVIOUS_NOTES.length} stage Notes on ${PUB_HOST}`);
    console.log(`   Using: post-type attachments for article card rendering`);
    console.log(`   Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"}\n`);

    // Phase 1: Delete all old notes first
    console.log("═══ PHASE 1: Delete old Notes ═══\n");
    for (const note of PREVIOUS_NOTES) {
        if (DRY_RUN) {
            console.log(`   [DRY-RUN] Would delete Note ${note.noteId} (${note.articleId})`);
            continue;
        }
        console.log(`   Deleting ${note.noteId} (${note.articleId})…`);
        const del = await deleteNote(note.noteId);
        console.log(`   DELETE HTTP ${del.status} ${del.ok ? "✅" : "⚠️"}`);
    }

    // Phase 2: Post fresh notes
    console.log("\n═══ PHASE 2: Post fresh Notes with card attachments ═══\n");
    const results = [];

    for (const note of PREVIOUS_NOTES) {
        console.log(`── ${note.articleId} ──`);
        console.log(`   Article URL: ${note.articleUrl}`);

        const bodyJson = buildCardBody(note.content);

        if (DRY_RUN) {
            console.log(`   [DRY-RUN] Would:`);
            console.log(`     1. Register post attachment for ${note.articleUrl}`);
            console.log(`     2. Post with attachmentIds + teaser-only body`);
            console.log(`   Body: ${JSON.stringify(bodyJson).slice(0, 200)}…\n`);
            results.push({ articleId: note.articleId, oldId: note.noteId, newId: "(dry-run)", newUrl: "(dry-run)" });
            continue;
        }

        // Step 1: Register post attachment
        console.log(`   Registering post attachment…`);
        const attachmentId = await registerPostAttachment(note.articleUrl);
        console.log(`   ✅ Attachment UUID: ${attachmentId}`);

        // Step 2: Post new Note with post attachment
        console.log(`   Posting Note with post attachment…`);
        const res = await postNote(bodyJson, [attachmentId]);
        const newId = res?.id || res?.comment?.id || null;
        const newUrl = newId ? `https://substack.com/@joerobinson495999/note/c-${newId}` : null;
        console.log(`   ✅ New Note ID: ${newId}`);
        console.log(`   Permalink: ${newUrl}\n`);

        results.push({ articleId: note.articleId, oldId: note.noteId, newId, newUrl });
    }

    if (results.length > 0) {
        console.log("\n═══ RESULTS ═══\n");
        console.log("| Article | Old Note ID | New Note ID | Permalink |");
        console.log("|---------|-------------|-------------|-----------|");
        for (const r of results) {
            console.log(`| ${r.articleId} | ${r.oldId} | ${r.newId} | ${r.newUrl} |`);
        }
    }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

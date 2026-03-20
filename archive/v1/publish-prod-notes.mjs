#!/usr/bin/env node
/**
 * publish-prod-notes.mjs — Post promotion Notes to the PRODUCTION publication
 * (nfllab.substack.com) using the card-first attachment mechanism.
 *
 * Reuses approved stage-review teaser copy for all 12 published articles.
 * Attachment-based article cards: registerPostAttachment() + attachmentIds.
 *
 * Usage:
 *   node publish-prod-notes.mjs              # LIVE post to prod
 *   node publish-prod-notes.mjs --dry-run    # show what would be done
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
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
const PROD_URL = envVal("SUBSTACK_PUBLICATION_URL");
const NOTES_ENDPOINT = envVal("NOTES_ENDPOINT_PATH");

if (!TOKEN || !PROD_URL || !NOTES_ENDPOINT) {
    console.error("❌  Missing required env: SUBSTACK_TOKEN, SUBSTACK_PUBLICATION_URL, NOTES_ENDPOINT_PATH");
    process.exit(1);
}

// Safety: must be the production publication
if (!/nfllab\.substack\.com/i.test(PROD_URL) || /stage/i.test(PROD_URL)) {
    console.error("❌  SUBSTACK_PUBLICATION_URL must be production (nfllab.substack.com). Aborting.");
    process.exit(1);
}

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    return m ? m[1] : null;
}

const SUBDOMAIN = extractSubdomain(PROD_URL);
const PUB_HOST = `${SUBDOMAIN}.substack.com`;

function decodeSid(token) {
    try {
        return JSON.parse(Buffer.from(token, "base64").toString("utf-8")).substack_sid;
    } catch { return token.trim(); }
}

const SID = decodeSid(TOKEN);

// ─── The 12 published articles with approved teaser copy ─────────────────────

const PROD_NOTES = [
    {
        articleId: "jsn-extension-preview",
        teaser: "JSN earns 90% below market. Our panel breaks the four extension paths and the $33M mistake Seattle must avoid.",
        articleUrl: "https://nfllab.substack.com/p/jaxon-smith-njigbas-extension-is",
    },
    {
        articleId: "kc-fields-trade-evaluation",
        teaser: "The Chiefs traded for the NFL\u2019s most debated young QB at $3M. A dynasty bet or a stall?",
        articleUrl: "https://nfllab.substack.com/p/justin-fields-to-kansas-city-the",
    },
    {
        articleId: "den-2026-offseason",
        teaser: "Sean Payton built contenders around the middle of the field. Denver\u2019s Super Bowl push may hinge on one tight end bet.",
        articleUrl: "https://nfllab.substack.com/p/the-broncos-missing-joker-why-denvers",
    },
    {
        articleId: "mia-tua-dead-cap-rebuild",
        teaser: "The largest dead cap hit in NFL history. Our panel dissects how Miami rebuilds from a $99M ghost.",
        articleUrl: "https://nfllab.substack.com/p/99-million-ghost-how-miami-rebuilds",
    },
    {
        articleId: "witherspoon-extension-cap-vs-agent",
        teaser: "Cap says $27M. The agent demands $33M. Our experts re-examine Seattle\u2019s most important extension decision.",
        articleUrl: "https://nfllab.substack.com/p/cap-says-27m-the-agent-demands-33m-d00",
    },
    {
        articleId: "lar-2026-offseason",
        teaser: "The Rams spent $160 million on their secondary. Our panel debates whether this rebuild can survive the NFC West arms race.",
        articleUrl: "https://nfllab.substack.com/p/the-rams-spent-160-million-on-their",
    },
    {
        articleId: "sf-2026-offseason",
        teaser: "San Francisco lost their pass rush, their receivers, and their margin for error. Our panel examines what\u2019s left of the dynasty.",
        articleUrl: "https://nfllab.substack.com/p/the-49ers-lost-their-pass-rush-their",
    },
    {
        articleId: "ari-2026-offseason",
        teaser: "Arizona released Kyler Murray and ate $47.5M in dead cap. Our panel explains why they should have done it sooner.",
        articleUrl: "https://nfllab.substack.com/p/arizona-just-released-kyler-murray",
    },
    {
        articleId: "ne-maye-year2-offseason",
        teaser: "The Patriots have ~$44 million, the #31 pick, and a franchise QB on a rookie deal. Our panel maps their best offseason moves.",
        articleUrl: "https://nfllab.substack.com/p/the-patriots-have-44-million-the-3cc",
    },
    {
        articleId: "seahawks-rb1a-target-board",
        teaser: "Seattle can solve its running back problem at pick #64 for $6 million. Our panel identifies the top targets and the math behind each pick.",
        articleUrl: "https://nfllab.substack.com/p/the-6-million-backfield-how-seattle",
    },
    {
        articleId: "den-mia-waddle-trade",
        teaser: "Denver paid a late first for Jaylen Waddle. Our panel says it was worth it \u2014 but the $57M bill in 2027 is where the real debate starts.",
        articleUrl: "https://nfllab.substack.com/p/denver-paid-a-late-first-for-the",
    },
    {
        articleId: "welcome-post",
        teaser: "Welcome to The NFL Lab \u2014 where expert AI panels debate the biggest decisions in football.",
        articleUrl: "https://nfllab.substack.com/p/welcome-to-the-nfl-lab-why-were-doing",
    },
];

// ─── ProseMirror builder (teaser text only — card from attachment) ────────────

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
    const resp = await fetch(`https://${PUB_HOST}/api/v1/comment/attachment`, {
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

let _browser = null;
let _context = null;
let _page = null;

async function ensureBrowser() {
    if (_page) return;
    const { chromium } = await import("playwright");
    _browser = await chromium.launch({
        headless: false,
        args: ["--headless=new", "--disable-blink-features=AutomationControlled"],
    });
    _context = await _browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        extraHTTPHeaders: {
            "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        },
    });
    await _context.addCookies([{
        name: "substack.sid", value: SID, domain: ".substack.com",
        path: "/", httpOnly: true, secure: true, sameSite: "None",
    }]);
    _page = await _context.newPage();
    await _page.goto(`https://${PUB_HOST}/publish/home`, { waitUntil: "networkidle", timeout: 30000 });
}

async function closeBrowser() {
    if (_browser) await _browser.close();
    _browser = null; _context = null; _page = null;
}

async function postNote(bodyJson, attachmentIds) {
    await ensureBrowser();
    const url = `https://${PUB_HOST}${NOTES_ENDPOINT}`;
    const payload = {
        bodyJson,
        tabId: "for-you",
        surface: "feed",
        replyMinimumRole: "everyone",
        ...(attachmentIds?.length ? { attachmentIds } : {}),
    };

    const result = await _page.evaluate(async ({ url, payload }) => {
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
}

// ─── DB update ───────────────────────────────────────────────────────────────

function updatePipelineDb(results) {
    const dbPath = resolve(process.cwd(), "content", "pipeline.db");
    if (!existsSync(dbPath)) { console.warn("⚠️  pipeline.db not found — skipping DB update"); return; }

    const db = new DatabaseSync(dbPath);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    for (const r of results) {
        if (!r.newId) continue;
        db.exec(`INSERT INTO notes (article_id, note_type, content, substack_note_url, target, created_by, created_at)
                 VALUES ('${r.articleId}', 'promotion', '${r.teaser.replace(/'/g, "''")}', '${r.newUrl}', 'prod', 'Lead', '${now}')`);
    }
    db.close();
    console.log(`✅ pipeline.db updated: ${results.filter(r => r.newId).length} prod note rows inserted`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🚀 PROD NOTES: Post ${PROD_NOTES.length} promotion Notes on ${PUB_HOST}`);
    console.log(`   Mechanism: registerPostAttachment() + attachmentIds (card-first)`);
    console.log(`   Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"}\n`);

    const results = [];
    const errors = [];

    for (const note of PROD_NOTES) {
        console.log(`── ${note.articleId} ──`);
        console.log(`   Article: ${note.articleUrl}`);
        console.log(`   Teaser: ${note.teaser.slice(0, 80)}…`);

        const bodyJson = buildCardBody(note.teaser);

        if (DRY_RUN) {
            console.log(`   [DRY-RUN] Would register attachment + post Note\n`);
            results.push({ articleId: note.articleId, teaser: note.teaser, newId: "(dry-run)", newUrl: "(dry-run)" });
            continue;
        }

        try {
            // Step 1: Register post attachment
            console.log(`   Registering post attachment…`);
            const attachmentId = await registerPostAttachment(note.articleUrl);
            console.log(`   ✅ Attachment UUID: ${attachmentId}`);

            // Step 2: Post Note with card attachment
            console.log(`   Posting Note…`);
            const res = await postNote(bodyJson, [attachmentId]);
            const newId = res?.id || res?.comment?.id || null;
            const newUrl = newId ? `https://substack.com/@joerobinson495999/note/c-${newId}` : null;
            console.log(`   ✅ Note ID: ${newId}`);
            console.log(`   Permalink: ${newUrl}\n`);

            results.push({ articleId: note.articleId, teaser: note.teaser, newId, newUrl });

            // Brief pause between posts to avoid rate limiting
            await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
            console.error(`   ❌ FAILED: ${err.message}\n`);
            errors.push({ articleId: note.articleId, error: err.message });
        }
    }

    await closeBrowser();

    // Results summary
    console.log("\n═══ RESULTS ═══\n");
    console.log("| # | Article | Note ID | Permalink |");
    console.log("|---|---------|---------|-----------|");
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`| ${i + 1} | ${r.articleId} | ${r.newId} | ${r.newUrl} |`);
    }

    if (errors.length > 0) {
        console.log(`\n⚠️  ${errors.length} failures:`);
        for (const e of errors) {
            console.log(`   ${e.articleId}: ${e.error}`);
        }
    }

    // Update pipeline.db
    if (!DRY_RUN && results.length > 0) {
        updatePipelineDb(results);
    }

    // Write results to JSON for audit trail
    const outPath = resolve(process.cwd(), "publish-prod-notes-results.json");
    writeFileSync(outPath, JSON.stringify({ results, errors, timestamp: new Date().toISOString() }, null, 2));
    console.log(`\n📋 Results written to ${outPath}`);

    if (errors.length > 0) process.exit(1);
}

main().catch((err) => { console.error("Fatal:", err); closeBrowser().finally(() => process.exit(1)); });

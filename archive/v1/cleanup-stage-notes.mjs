#!/usr/bin/env node
/**
 * cleanup-stage-notes.mjs — Delete superseded stage-review Notes from
 * nfllabstage. These are the old review batch that already have paired
 * production promotion Notes on nfllab.substack.com.
 *
 * SAFETY:
 *   - Only targets nfllabstage (stage) notes
 *   - Does NOT touch production notes
 *   - Keeps pipeline.db rows as audit trail (marks them deleted)
 *
 * Note: The witherspoon-extension-v2 teaser (c-229449096) is now included
 * in cleanup since Stage 7 teasers have been disabled (2026-03-18).
 *
 * Usage:
 *   node cleanup-stage-notes.mjs              # LIVE delete
 *   node cleanup-stage-notes.mjs --dry-run    # show what would be done
 */

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

if (!TOKEN || !STAGE_URL) {
    console.error("❌  Missing required env: SUBSTACK_TOKEN, SUBSTACK_STAGE_URL");
    process.exit(1);
}
if (/nfllab\.substack\.com/i.test(STAGE_URL) && !/stage/i.test(STAGE_URL)) {
    console.error("❌  SUBSTACK_STAGE_URL looks like production. Stage-only. Aborting.");
    process.exit(1);
}

const STAGE_HOST = `${STAGE_URL.match(/https?:\/\/([^.]+)\.substack\.com/)?.[1]}.substack.com`;

function decodeSid(token) {
    try {
        return JSON.parse(Buffer.from(token, "base64").toString("utf-8")).substack_sid;
    } catch { return token.trim(); }
}

const SID = decodeSid(TOKEN);

// ─── Superseded stage notes to delete ────────────────────────────────────────
// The 12 stage-review notes (already deleted in prior runs — will 404 harmlessly)
// plus the witherspoon-extension-v2 teaser (229449096), now included after
// Stage 7 teasers were disabled (2026-03-18).

const NOTES_TO_DELETE = [
    { dbId: 6,  noteId: 229399257, articleId: "jsn-extension-preview" },
    { dbId: 7,  noteId: 229399279, articleId: "kc-fields-trade-evaluation" },
    { dbId: 8,  noteId: 229399303, articleId: "den-2026-offseason" },
    { dbId: 9,  noteId: 229399326, articleId: "mia-tua-dead-cap-rebuild" },
    { dbId: 10, noteId: 229399346, articleId: "witherspoon-extension-cap-vs-agent" },
    { dbId: 11, noteId: 229402275, articleId: "lar-2026-offseason" },
    { dbId: 12, noteId: 229402289, articleId: "sf-2026-offseason" },
    { dbId: 13, noteId: 229402302, articleId: "ari-2026-offseason" },
    { dbId: 14, noteId: 229402322, articleId: "ne-maye-year2-offseason" },
    { dbId: 15, noteId: 229402343, articleId: "seahawks-rb1a-target-board" },
    { dbId: 16, noteId: 229402254, articleId: "den-mia-waddle-trade" },
    { dbId: 17, noteId: 229402366, articleId: "welcome-post" },
    { dbId: 30, noteId: 229449096, articleId: "witherspoon-extension-v2" },
];

// ─── Delete helper (plain fetch — not CF-blocked) ───────────────────────────

async function deleteNote(noteId) {
    const url = `https://${STAGE_HOST}/api/v1/comment/${noteId}`;
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

// ─── DB update — mark stage rows as deleted (preserve audit trail) ──────────

function markDbRowsDeleted(deletedIds) {
    const dbPath = resolve(process.cwd(), "content", "pipeline.db");
    if (!existsSync(dbPath)) { console.warn("⚠️  pipeline.db not found — skipping DB update"); return; }

    const db = new DatabaseSync(dbPath);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    for (const id of deletedIds) {
        // Append [DELETED {timestamp}] to note_type to preserve audit trail
        db.exec(`UPDATE notes SET note_type = 'promotion [DELETED ${now}]' WHERE id = ${id}`);
    }
    db.close();
    console.log(`✅ pipeline.db: ${deletedIds.length} stage note rows marked as deleted (audit trail preserved)`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🧹 CLEANUP: Delete ${NOTES_TO_DELETE.length} stage Notes from ${STAGE_HOST}`);
    console.log(`   Includes: c-229449096 (witherspoon-extension-v2 teaser — teasers disabled 2026-03-18)`);
    console.log(`   Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"}\n`);

    const results = [];

    for (const note of NOTES_TO_DELETE) {
        if (DRY_RUN) {
            console.log(`   [DRY-RUN] Would delete c-${note.noteId} (${note.articleId})`);
            results.push({ ...note, status: "dry-run" });
            continue;
        }

        process.stdout.write(`   Deleting c-${note.noteId} (${note.articleId})… `);
        const del = await deleteNote(note.noteId);
        const status = del.status === 200 ? "deleted" : del.status === 404 ? "already-gone" : `http-${del.status}`;
        console.log(`${del.status} ${del.ok ? "✅" : "⚠️"} (${status})`);
        results.push({ ...note, status });

        // Brief pause to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    // Summary
    const deleted = results.filter(r => r.status === "deleted").length;
    const alreadyGone = results.filter(r => r.status === "already-gone").length;
    const failed = results.filter(r => !["deleted", "already-gone", "dry-run"].includes(r.status)).length;

    console.log(`\n═══ CLEANUP SUMMARY ═══`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   Already gone: ${alreadyGone}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Includes teaser c-229449096 (teasers disabled)`);

    // Update pipeline.db
    if (!DRY_RUN) {
        const successIds = results
            .filter(r => r.status === "deleted" || r.status === "already-gone")
            .map(r => r.dbId);
        if (successIds.length > 0) {
            markDbRowsDeleted(successIds);
        }
    }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

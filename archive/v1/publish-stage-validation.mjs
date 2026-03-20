#!/usr/bin/env node
/**
 * publish-stage-validation.mjs — Publish the mobile-table boundary validation
 * article to nfllabstage for real-device testing.
 *
 * This is a one-shot script for issue #75 validation. It reuses the same
 * Substack API patterns as batch-publish-prod.mjs.
 *
 * Usage: node publish-stage-validation.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";

const ROOT = resolve(import.meta.dirname || process.cwd());

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

if (!TOKEN) { console.error("Missing SUBSTACK_TOKEN in .env"); process.exit(1); }
if (!STAGE_URL) { console.error("Missing SUBSTACK_STAGE_URL in .env"); process.exit(1); }

function extractSubdomain(url) {
    const m = url.match(/https?:\/\/([^.]+)\.substack\.com/);
    if (m) return m[1];
    throw new Error(`Cannot extract subdomain: ${url}`);
}

const SUBDOMAIN = extractSubdomain(STAGE_URL);

function makeHeaders(token) {
    let substackSid, connectSid;
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        substackSid = decoded.substack_sid;
        connectSid = decoded.connect_sid || decoded.substack_sid;
    } catch {
        substackSid = token.trim();
        connectSid = token.trim();
    }
    return {
        Cookie: `substack.sid=${substackSid}; connect.sid=${connectSid}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Origin: `https://${SUBDOMAIN}.substack.com`,
        Referer: `https://${SUBDOMAIN}.substack.com/publish`,
    };
}

const HEADERS = makeHeaders(TOKEN);

// ─── Substack API ────────────────────────────────────────────────────────────

async function uploadImage(localPath) {
    const mimeMap = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
    const ext = extname(localPath).toLowerCase();
    const mime = mimeMap[ext] || "image/png";
    let absPath = /^([A-Za-z]:[\\/]|\/)/.test(localPath) ? localPath : resolve(ARTICLE_DIR, localPath);
    if (!existsSync(absPath)) {
        const cwdPath = resolve(ROOT, localPath);
        if (existsSync(cwdPath)) absPath = cwdPath;
        else throw new Error(`Image not found: ${absPath}`);
    }
    const dataUri = `data:${mime};base64,${readFileSync(absPath).toString("base64")}`;
    const res = await fetch(`https://${SUBDOMAIN}.substack.com/api/v1/image`, {
        method: "POST",
        headers: { ...HEADERS, Origin: `https://${SUBDOMAIN}.substack.com`, Referer: `https://${SUBDOMAIN}.substack.com/publish` },
        body: JSON.stringify({ image: dataUri }),
    });
    if (!res.ok) throw new Error(`Image upload failed: HTTP ${res.status}`);
    const data = await res.json();
    return data.url;
}

async function createDraft(title, subtitle, body) {
    const res = await fetch(`https://${SUBDOMAIN}.substack.com/api/v1/drafts`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
            type: "newsletter",
            audience: "everyone",
            draft_title: title,
            draft_subtitle: subtitle,
            draft_body: JSON.stringify(body),
            draft_bylines: [],
            postTags: [],
        }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Create draft failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return await res.json();
}

async function updateDraft(draftId, title, subtitle, body) {
    const res = await fetch(`https://${SUBDOMAIN}.substack.com/api/v1/drafts/${draftId}`, {
        method: "PUT",
        headers: HEADERS,
        body: JSON.stringify({
            draft_title: title,
            draft_subtitle: subtitle,
            draft_body: JSON.stringify(body),
        }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Update draft failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
    return await res.json();
}

// ─── Markdown → ProseMirror (minimal, image-aware) ──────────────────────────

function parseInline(text) {
    const parts = [];
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
        if (match[2]) parts.push({ type: "text", text: match[2], marks: [{ type: "bold" }, { type: "italic" }] });
        else if (match[3]) parts.push({ type: "text", text: match[3], marks: [{ type: "bold" }] });
        else if (match[4]) parts.push({ type: "text", text: match[4], marks: [{ type: "italic" }] });
        else if (match[5]) parts.push({ type: "text", text: match[5], marks: [{ type: "italic" }] });
        else if (match[6] && match[7]) parts.push({ type: "text", text: match[6], marks: [{ type: "link", attrs: { href: match[7], target: "_blank" } }] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push({ type: "text", text: text.slice(lastIndex) });
    return parts.length > 0 ? parts : [{ type: "text", text: text || " " }];
}

function buildCaptionedImage(src, alt, caption) {
    return {
        type: "captionedImage", attrs: {},
        content: [
            { type: "image2", attrs: { src, alt: alt || null, title: caption || null, srcNoWatermark: null, fullscreen: null, imageSize: "normal", height: null, width: null, resizeWidth: null, bytes: null, type: null, href: null, belowTheFold: false, topImage: false, internalRedirect: null, isProcessing: false, align: null, offset: false } },
            { type: "caption", content: caption ? [{ type: "text", text: caption }] : [] },
        ],
    };
}

async function markdownToProseMirror(markdown) {
    markdown = markdown.replace(/<!--[\s\S]*?-->/g, "");
    const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const content = [];
    let i = 0;

    while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed === "") { i++; continue; }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
            content.push({ type: "heading", attrs: { level: headingMatch[1].length }, content: parseInline(headingMatch[2]) });
            i++; continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            content.push({ type: "horizontal_rule" });
            i++; continue;
        }

        // Image line: ![alt](path) or ![alt|caption](path)
        const imgLine = trimmed.match(/^!\[([^\]]*)\]\(([^)"]+?)(?:\s+"([^"]*)")?\)$/);
        if (imgLine) {
            const [, altRaw, rawSrc, titleAttr] = imgLine;
            const pipeIdx = altRaw.indexOf("|");
            const alt = pipeIdx >= 0 ? altRaw.slice(0, pipeIdx).trim() : altRaw.trim();
            const caption = titleAttr || (pipeIdx >= 0 ? altRaw.slice(pipeIdx + 1).trim() : "");
            let src = rawSrc;
            if (!/^https?:\/\//i.test(rawSrc)) {
                try {
                    console.log(`  📤 Uploading: ${rawSrc}`);
                    src = await uploadImage(rawSrc);
                    console.log(`     ✅ → ${src.slice(0, 80)}...`);
                } catch (e) {
                    console.log(`     ❌ Upload failed: ${e.message}`);
                    src = rawSrc;
                }
            }
            content.push(buildCaptionedImage(src, alt, caption));
            i++; continue;
        }

        // Table lines (inline as bullet list for Substack compat)
        if (trimmed.startsWith("|")) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i].trim()); i++; }
            // Convert to simple bullet list
            const rows = tableLines.filter(l => !l.match(/^\|[\s:-]+\|$/));
            if (rows.length > 1) {
                const headerCells = rows[0].split("|").filter(c => c.trim()).map(c => c.trim());
                const dataRows = rows.slice(1);
                const items = dataRows.map(row => {
                    const cells = row.split("|").filter(c => c.trim()).map(c => c.trim());
                    return cells.map((c, idx) => headerCells[idx] ? `${headerCells[idx]}: ${c}` : c).join(" — ");
                });
                content.push({
                    type: "bullet_list",
                    content: items.map(t => ({ type: "list_item", content: [{ type: "paragraph", content: parseInline(t) }] })),
                });
            }
            continue;
        }

        // Paragraph (collect consecutive non-special lines)
        const paraLines = [];
        while (
            i < lines.length && lines[i].trim() !== "" &&
            !/^#{1,3}\s/.test(lines[i].trim()) && !lines[i].trim().startsWith("|") &&
            !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) && !/^!\[/.test(lines[i].trim())
        ) { paraLines.push(lines[i]); i++; }
        if (paraLines.length > 0) {
            content.push({ type: "paragraph", content: parseInline(paraLines.join(" ")) });
        }
    }

    return { type: "doc", attrs: { schemaVersion: "v1" }, content };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const SLUG = "mobile-table-boundary-validation";
let ARTICLE_DIR = resolve(ROOT, "content", "articles", SLUG);
const DRAFT_PATH = resolve(ARTICLE_DIR, "draft.md");

async function main() {
    const draftIdArg = process.argv.find(a => a.startsWith("--draft-id="));
    const existingDraftId = draftIdArg ? draftIdArg.split("=")[1] : null;

    console.log(`\n🚀 Publishing to nfllabstage: ${SLUG}`);
    console.log(`   Target: ${SUBDOMAIN}.substack.com`);
    if (existingDraftId) console.log(`   Updating existing draft: ${existingDraftId}`);
    console.log("");

    if (!existsSync(DRAFT_PATH)) {
        console.error(`Draft not found: ${DRAFT_PATH}`);
        process.exit(1);
    }

    const markdown = readFileSync(DRAFT_PATH, "utf-8");
    const title = "Mobile Table Rendering — Boundary Validation";
    const subtitle = "Testing dual-render (desktop + mobile PNG) at various table density levels";

    console.log("📝 Converting markdown to ProseMirror...\n");
    const body = await markdownToProseMirror(markdown);

    if (existingDraftId) {
        console.log("\n📨 Updating existing draft on Substack...");
        await updateDraft(existingDraftId, title, subtitle, body);
        const draftUrl = `https://${SUBDOMAIN}.substack.com/publish/post/${existingDraftId}`;
        console.log(`\n${"═".repeat(60)}`);
        console.log(`✅ Draft updated successfully!`);
        console.log(`   Draft URL: ${draftUrl}`);
        console.log(`   Draft ID:  ${existingDraftId}`);
        console.log(`${"═".repeat(60)}\n`);
    } else {
        console.log("\n📨 Creating draft on Substack...");
        const draft = await createDraft(title, subtitle, body);
        const draftUrl = `https://${SUBDOMAIN}.substack.com/publish/post/${draft.id}`;
        console.log(`\n${"═".repeat(60)}`);
        console.log(`✅ Draft created successfully!`);
        console.log(`   Draft URL: ${draftUrl}`);
        console.log(`   Draft ID:  ${draft.id}`);
        console.log(`${"═".repeat(60)}\n`);
    }
}

main().catch(err => {
    console.error("Fatal:", err.message);
    process.exit(1);
});

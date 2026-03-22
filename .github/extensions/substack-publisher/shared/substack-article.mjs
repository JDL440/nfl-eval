import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";

import {
    markdownToProseMirror,
    ensureSubscribeButtons,
    ensureHeroFirstImage,
    validateProseMirrorBody,
    extractMetaFromMarkdown,
} from "./substack-prosemirror.mjs";
import { extractSubdomain, makeSubstackHeaders } from "./substack-session.mjs";

const NFL_TEAM_ABBREVS = {
    "arizona cardinals": "ari", "atlanta falcons": "atl", "baltimore ravens": "bal",
    "buffalo bills": "buf", "carolina panthers": "car", "chicago bears": "chi",
    "cincinnati bengals": "cin", "cleveland browns": "cle", "dallas cowboys": "dal",
    "denver broncos": "den", "detroit lions": "det", "green bay packers": "gb",
    "houston texans": "hou", "indianapolis colts": "ind", "jacksonville jaguars": "jax",
    "kansas city chiefs": "kc", "las vegas raiders": "lv", "los angeles chargers": "lac",
    "los angeles rams": "lar", "miami dolphins": "mia", "minnesota vikings": "min",
    "new england patriots": "ne", "new orleans saints": "no", "new york giants": "nyg",
    "new york jets": "nyj", "philadelphia eagles": "phi", "pittsburgh steelers": "pit",
    "san francisco 49ers": "sf", "seattle seahawks": "sea", "tampa bay buccaneers": "tb",
    "tennessee titans": "ten", "washington commanders": "was",
};

function safeExtractSubdomain(url) {
    try {
        return extractSubdomain(url);
    } catch {
        return null;
    }
}

function sanitizeSubtitleText(value) {
    return String(value || "")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
        .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/(^|[\s(])_([^_\n]+)_(?=[$\s).,;:!?]|$)/g, "$1$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
}

const SUBSTACK_SUBTITLE_MAX_LENGTH = 140;

function clampSubtitleText(value, maxLength = SUBSTACK_SUBTITLE_MAX_LENGTH) {
    const subtitle = sanitizeSubtitleText(value);
    if (subtitle.length <= maxLength) return subtitle;

    const clipped = subtitle.slice(0, maxLength - 1);
    const lastSpace = clipped.lastIndexOf(" ");
    const safeClip = lastSpace >= Math.floor(maxLength * 0.6)
        ? clipped.slice(0, lastSpace)
        : clipped;

    return `${safeClip.trimEnd()}…`;
}

export async function lookupTeamFromDb(filePath, cwd = process.cwd()) {
    const dbPath = resolve(cwd, "content", "pipeline.db");
    if (!existsSync(dbPath)) return null;

    const normalizedPath = filePath.replace(/\\/g, "/").replace(/^.*?content\//, "content/");

    try {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const stmt = db.prepare(
            "SELECT primary_team FROM articles WHERE article_path = ? OR article_path = ?"
        );
        const row = stmt.get(normalizedPath, filePath.replace(/\\/g, "/"));
        db.close();
        return row?.primary_team || null;
    } catch {
        return null;
    }
}

export function getTeamAbbrev(teamName) {
    if (!teamName) return null;
    const lower = teamName.toLowerCase().trim();
    if (NFL_TEAM_ABBREVS[lower]) return NFL_TEAM_ABBREVS[lower];
    for (const [full, abbrev] of Object.entries(NFL_TEAM_ABBREVS)) {
        if (full.includes(lower) || lower.includes(abbrev)) return abbrev;
    }
    return null;
}

export function deriveTagsFromArticleDir(articleDir, teamName) {
    const tags = [];
    if (teamName) tags.push(teamName);

    const excludedFiles = new Set([
        "discussion-prompt.md",
        "discussion-summary.md",
        "discussion-synthesis.md",
        "draft.md",
        "draft-section.md",
    ]);

    const teamAbbrev = getTeamAbbrev(teamName);

    try {
        const files = readdirSync(articleDir);
        for (const file of files) {
            if (!file.endsWith(".md")) continue;
            if (excludedFiles.has(file)) continue;

            const stem = file.replace(/\.md$/i, "");
            if (teamAbbrev && stem.startsWith(`${teamAbbrev}-`)) continue;

            const role = stem.replace(/-(position|panel-response|panel)$/i, "");
            if (role === stem) continue;

            const tag = role.charAt(0).toUpperCase() + role.slice(1);
            if (!tags.includes(tag)) tags.push(tag);
        }
    } catch {
        // Single-file articles or missing directories are fine here.
    }

    return tags;
}

export async function uploadImageToSubstack(subdomain, headers, imagePath, articleDir) {
    const mimeMap = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    };
    const ext = extname(imagePath).toLowerCase();
    const mime = mimeMap[ext] || "image/jpeg";

    let absPath = /^([A-Za-z]:[\\/]|\/)/.test(imagePath)
        ? imagePath
        : resolve(articleDir, imagePath);

    if (!existsSync(absPath)) {
        const cwdPath = resolve(process.cwd(), imagePath);
        if (existsSync(cwdPath)) {
            absPath = cwdPath;
        } else {
            throw new Error(`Image file not found: ${absPath} (also tried ${cwdPath})`);
        }
    }

    const dataUri = `data:${mime};base64,${readFileSync(absPath).toString("base64")}`;
    const res = await fetch(`https://${subdomain}.substack.com/api/v1/image`, {
        method: "POST",
        headers,
        body: JSON.stringify({ image: dataUri }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Image upload failed (${subdomain}): HTTP ${res.status} — ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.url;
}

export async function createSubstackDraft({ subdomain, headers, title, subtitle, body, audience, tags }) {
    const payload = {
        type: "newsletter",
        audience: audience || "everyone",
        draft_title: title,
        draft_subtitle: subtitle || "",
        draft_body: JSON.stringify(body),
        draft_bylines: [],
        postTags: tags || [],
    };

    const res = await fetch(`https://${subdomain}.substack.com/api/v1/drafts`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Create draft failed (${subdomain}): HTTP ${res.status} — ${text.slice(0, 300)}`);
    }

    return await res.json();
}

export async function updateSubstackDraft({ subdomain, headers, draftId, title, subtitle, body, audience, tags }) {
    const payload = {
        audience: audience || "everyone",
        draft_title: title,
        draft_subtitle: subtitle || "",
        draft_body: JSON.stringify(body),
        postTags: tags || [],
    };

    const res = await fetch(`https://${subdomain}.substack.com/api/v1/drafts/${draftId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Update draft failed (${subdomain}): HTTP ${res.status} — ${text.slice(0, 300)}`);
    }

    return await res.json();
}

export function extractDraftIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/publish\/post\/(\d+)/);
    return match ? match[1] : null;
}

export async function upsertSubstackDraftFromMarkdown({
    filePath,
    token,
    targetUrl,
    existingDraftUrl = null,
    teamName = null,
    title: explicitTitle = null,
    subtitle: explicitSubtitle = null,
    audience = "everyone",
    cwd = process.cwd(),
}) {
    if (!filePath || !existsSync(filePath)) {
        throw new Error(`Article file not found: ${filePath}`);
    }

    const markdown = readFileSync(filePath, "utf-8");
    const extracted = extractMetaFromMarkdown(markdown);
    const title = explicitTitle || extracted.title;
    const subtitle = clampSubtitleText(explicitSubtitle || extracted.subtitle || "");
    const bodyMarkdown = extracted.bodyMarkdown;

    if (!title) {
        throw new Error(
            `No title found in ${filePath}. Add a '# Title' heading or provide an explicit title.`
        );
    }

    const subdomain = extractSubdomain(targetUrl);
    const headers = makeSubstackHeaders(token, subdomain);
    const articleDir = dirname(filePath);
    const resolvedTeam = teamName || await lookupTeamFromDb(filePath, cwd);
    const tags = deriveTagsFromArticleDir(articleDir, resolvedTeam);

    const uploadImage = (localPath) =>
        uploadImageToSubstack(subdomain, headers, localPath, articleDir);

    const body = await markdownToProseMirror(bodyMarkdown, uploadImage);
    ensureSubscribeButtons(body);
    const heroCheck = ensureHeroFirstImage(body);

    const validation = validateProseMirrorBody(body);
    if (!validation.valid) {
        throw new Error(
            `ProseMirror validation failed: ${validation.issues.join("; ")}`
        );
    }

    const existingDraftId = extractDraftIdFromUrl(existingDraftUrl);
    const existingSubdomain = safeExtractSubdomain(existingDraftUrl);
    const canUpdateExisting = Boolean(existingDraftId && existingSubdomain === subdomain);

    let draft;
    let draftUrl;
    if (canUpdateExisting) {
        draft = await updateSubstackDraft({
            subdomain,
            headers,
            draftId: existingDraftId,
            title,
            subtitle,
            body,
            audience,
            tags,
        });
        draftUrl = existingDraftUrl;
    } else {
        draft = await createSubstackDraft({
            subdomain,
            headers,
            title,
            subtitle,
            body,
            audience,
            tags,
        });
        draftUrl = `https://${subdomain}.substack.com/publish/post/${draft.id}`;
    }

    return {
        draft,
        draftId: canUpdateExisting ? existingDraftId : draft.id,
        draftUrl,
        title,
        subtitle,
        tags,
        subdomain,
        body,
        isUpdate: canUpdateExisting,
        heroWarning: heroCheck.warning || null,
    };
}

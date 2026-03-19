/**
 * data.mjs — Read model for the NFL Lab pipeline dashboard.
 *
 * Reads pipeline.db (via node:sqlite) and scans article directories on disk
 * to produce a unified board payload. Reimplements the stage-inference logic
 * from content/article_board.py in JavaScript so the dashboard is pure-Node.
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

// ── Paths ────────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(import.meta.dirname, "..");
const CONTENT_DIR = join(REPO_ROOT, "content");
const ARTICLES_DIR = join(CONTENT_DIR, "articles");
const IMAGES_DIR = join(CONTENT_DIR, "images");
const DB_PATH = join(CONTENT_DIR, "pipeline.db");

// ── Constants (mirror pipeline_state.py) ─────────────────────────────────────

export const STAGE_NAMES = {
    1: "Idea Generation",
    2: "Discussion Prompt",
    3: "Panel Composition",
    4: "Panel Discussion",
    5: "Article Drafting",
    6: "Editor Pass",
    7: "Publisher Pass",
    8: "Published",
};

export const DEPTH_NAMES = {
    1: "Casual Fan",
    2: "The Beat",
    3: "Deep Dive",
};

export const PUBLISHER_PASS_FIELDS = [
    { key: "title_final", label: "Title final" },
    { key: "subtitle_final", label: "Subtitle final" },
    { key: "body_clean", label: "Body clean" },
    { key: "section_assigned", label: "Section assigned" },
    { key: "tags_set", label: "Tags set" },
    { key: "url_slug_set", label: "URL slug set" },
    { key: "cover_image_set", label: "Cover image set" },
    { key: "paywall_set", label: "Paywall set" },
    { key: "names_verified", label: "Names verified" },
    { key: "numbers_current", label: "Numbers current" },
    { key: "no_stale_refs", label: "No stale refs" },
];

// ── DB helpers ───────────────────────────────────────────────────────────────

function openDb() {
    if (!existsSync(DB_PATH)) return null;
    return new DatabaseSync(DB_PATH, { readOnly: true });
}

export function getAllArticles() {
    const db = openDb();
    if (!db) return [];
    try {
        const rows = db.prepare(`
            SELECT a.*,
                   COALESCE(a.substack_draft_url, '') AS draft_url
            FROM articles a
            ORDER BY a.current_stage DESC, a.updated_at DESC
        `).all();
        return rows;
    } finally {
        db.close();
    }
}

export function getArticle(slug) {
    const db = openDb();
    if (!db) return null;
    try {
        return db.prepare("SELECT * FROM articles WHERE id = ?").get(slug) || null;
    } finally {
        db.close();
    }
}

export function getStageTransitions(slug) {
    const db = openDb();
    if (!db) return [];
    try {
        return db.prepare(
            "SELECT * FROM stage_transitions WHERE article_id = ? ORDER BY transitioned_at DESC"
        ).all(slug);
    } finally {
        db.close();
    }
}

export function getEditorReviews(slug) {
    const db = openDb();
    if (!db) return [];
    try {
        return db.prepare(
            "SELECT * FROM editor_reviews WHERE article_id = ? ORDER BY review_number DESC"
        ).all(slug);
    } finally {
        db.close();
    }
}

export function getPublisherPass(slug) {
    const db = openDb();
    if (!db) return null;
    try {
        return db.prepare("SELECT * FROM publisher_pass WHERE article_id = ?").get(slug) || null;
    } finally {
        db.close();
    }
}

export function resolveArticleMarkdownPath(slug, article = null) {
    const candidates = [];
    if (article?.article_path) {
        candidates.push(article.article_path);
    }
    candidates.push(`content/articles/${slug}/draft.md`);
    candidates.push(`content/articles/${slug}.md`);

    for (const relativePath of candidates) {
        const absolutePath = resolve(REPO_ROOT, relativePath);
        if (existsSync(absolutePath)) {
            return {
                exists: true,
                relativePath: relative(REPO_ROOT, absolutePath).replace(/\\/g, "/"),
                absolutePath,
            };
        }
    }

    return {
        exists: false,
        relativePath: article?.article_path || null,
        absolutePath: article?.article_path ? resolve(REPO_ROOT, article.article_path) : null,
    };
}

export function buildPublishState(article, publisherPass, notes, slug) {
    const articleFile = resolveArticleMarkdownPath(slug, article);
    const missingPublisherChecks = publisherPass
        ? PUBLISHER_PASS_FIELDS
            .filter(({ key }) => !publisherPass[key])
            .map(({ label }) => label)
        : [];

    const isPublished = Boolean(
        article?.substack_url ||
        article?.status === "published" ||
        article?.current_stage === 8
    );
    const hasPromotionNote = notes.some(
        (note) => note.note_type === "promotion" && note.target === "prod"
    );
    const noteBlockedReason = hasPromotionNote
        ? "A production promotion Note is already recorded for this article."
        : null;

    const blockedReasons = [];
    if (!article) blockedReasons.push("Article not found in pipeline.db.");
    if (!articleFile.exists) blockedReasons.push("No canonical article markdown file found for live publish.");
    if (!publisherPass) {
        blockedReasons.push("No publisher pass recorded.");
    } else if (missingPublisherChecks.length > 0) {
        blockedReasons.push(`Publisher pass incomplete: ${missingPublisherChecks.join(", ")}`);
    }
    if (isPublished) blockedReasons.push("Article is already live on Substack.");

    return {
        canPublish: blockedReasons.length === 0,
        blockedReasons,
        filePath: articleFile.relativePath,
        hasDraftUrl: Boolean(article?.substack_draft_url),
        draftUrl: article?.substack_draft_url || null,
        isPublished,
        hasPromotionNote,
        publisherPassComplete: Boolean(publisherPass) && missingPublisherChecks.length === 0,
        missingPublisherChecks,
        promotionChannels: {
            substack_note: {
                id: "substack_note",
                label: "Substack Note",
                defaultSelected: !noteBlockedReason,
                blockedReason: noteBlockedReason,
            },
        },
    };
}

export function getArticlePanels(slug) {
    const db = openDb();
    if (!db) return [];
    try {
        return db.prepare(
            "SELECT * FROM article_panels WHERE article_id = ? ORDER BY agent_name"
        ).all(slug);
    } finally {
        db.close();
    }
}

export function getNotes(slug) {
    const db = openDb();
    if (!db) return [];
    try {
        return db.prepare(
            "SELECT * FROM notes WHERE article_id = ? ORDER BY created_at DESC"
        ).all(slug);
    } finally {
        db.close();
    }
}

export function getDiscussionPrompt(slug) {
    const db = openDb();
    if (!db) return null;
    try {
        return db.prepare("SELECT * FROM discussion_prompts WHERE article_id = ?").get(slug) || null;
    } finally {
        db.close();
    }
}

// ── Artifact scanning (mirrors article_board.py) ─────────────────────────────

function hasFile(dirpath, name) {
    return existsSync(join(dirpath, name));
}

function countPositionFiles(dirpath) {
    try {
        return readdirSync(dirpath).filter(f => f.endsWith("-position.md")).length;
    } catch { return 0; }
}

function countImages(slug) {
    let count = 0;
    const articleDir = join(ARTICLES_DIR, slug);
    const imagesDir = join(IMAGES_DIR, slug);
    for (const dir of [articleDir, imagesDir]) {
        try {
            count += readdirSync(dir).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).length;
        } catch { /* dir may not exist */ }
    }
    return count;
}

function parseEditorVerdict(dirpath) {
    let files;
    try {
        files = readdirSync(dirpath).filter(f => /^editor-review(-\d+)?\.md$/.test(f));
    } catch { return null; }
    if (files.length === 0) return null;

    files.sort((a, b) => {
        const numA = a.match(/-(\d+)\.md$/)?.[1] ?? "0";
        const numB = b.match(/-(\d+)\.md$/)?.[1] ?? "0";
        return parseInt(numB) - parseInt(numA);
    });

    const latest = files[0];
    let text;
    try {
        text = readFileSync(join(dirpath, latest), "utf-8").slice(0, 16000);
    } catch { return null; }

    const verdictPatterns = [
        /(?:##\s*)?(?:Final\s+)?Verdict[:\s]*[*_ 🟢🔴🟡✅❌]*\s*(APPROVED|REVISE|REJECT)/i,
        /(?:Overall|Final)\s+(?:Verdict|Assessment)[:\s]*[*_ 🟢🔴🟡✅❌]*\s*(APPROVED|REVISE|REJECT)/i,
        /###?\s*[🟢🔴🟡✅❌]+\s*(APPROVED|REVISE|REJECT)/i,
        /\*\*(APPROVED|REVISE|REJECT)\*\*/i,
        /(?:^|\n)\s*(?:✅|🟡|🔴)\s*(APPROVED|REVISE|REJECT)/i,
    ];
    let verdict = null;
    for (const pat of verdictPatterns) {
        const m = text.match(pat);
        if (m) { verdict = m[1].toUpperCase(); break; }
    }
    const errors = (text.match(/🔴/g) || []).length;
    const suggestions = (text.match(/🟡/g) || []).length;
    const notes = (text.match(/🟢/g) || []).length;
    return { verdict, errors, suggestions, notes, file: latest };
}

export function inferStage(slug) {
    const dirpath = join(ARTICLES_DIR, slug);
    if (!existsSync(dirpath) || !statSync(dirpath).isDirectory()) {
        const flatFile = dirpath + ".md";
        if (existsSync(flatFile)) {
            return { stage: 8, stageName: STAGE_NAMES[8], nextAction: null, editorVerdict: null, detail: "Flat file (legacy published)" };
        }
        return { stage: 1, stageName: STAGE_NAMES[1], nextAction: "Idea generation", editorVerdict: null, detail: "No directory" };
    }

    const hasPrompt = hasFile(dirpath, "discussion-prompt.md");
    const panelCount = countPositionFiles(dirpath);
    const hasPanel = panelCount >= 2;
    const hasSummary = hasFile(dirpath, "discussion-summary.md") || hasFile(dirpath, "discussion-synthesis.md");
    const hasDraft = hasFile(dirpath, "draft.md");
    const editor = parseEditorVerdict(dirpath);
    const hasPublisher = hasFile(dirpath, "publisher-pass.md");
    const hasIdea = hasFile(dirpath, "idea.md");
    const hasComposition = hasFile(dirpath, "panel-composition.md");
    const imageCount = countImages(slug);

    if (hasPublisher) return { stage: 7, stageName: STAGE_NAMES[7], nextAction: "Dashboard review / live publish", editorVerdict: editor?.verdict || null, detail: "Publisher pass found" };

    if (editor) {
        if (editor.verdict === "APPROVED") {
            const next = imageCount >= 2 ? "Publisher pass" : `Image generation (${imageCount}/2)`;
            return { stage: 6, stageName: STAGE_NAMES[6], nextAction: next, editorVerdict: "APPROVED", detail: `APPROVED (${editor.file})` };
        }
        if (editor.verdict === "REVISE") return { stage: 6, stageName: STAGE_NAMES[6], nextAction: "Revision → re-draft", editorVerdict: "REVISE", detail: `REVISE — ${editor.errors} red (${editor.file})` };
        if (editor.verdict === "REJECT") return { stage: 6, stageName: STAGE_NAMES[6], nextAction: "Major revision", editorVerdict: "REJECT", detail: `REJECT (${editor.file})` };
        return { stage: 6, stageName: STAGE_NAMES[6], nextAction: "Review editor file", editorVerdict: null, detail: `Verdict unclear (${editor.file})` };
    }

    if (hasDraft) return { stage: 5, stageName: STAGE_NAMES[5], nextAction: "Editor pass", editorVerdict: null, detail: "Draft present" };
    if (hasSummary) return { stage: 4, stageName: STAGE_NAMES[4], nextAction: "Writer drafting", editorVerdict: null, detail: "Summary ready" };
    if (hasPanel) return { stage: 4, stageName: STAGE_NAMES[4], nextAction: "Synthesize panel", editorVerdict: null, detail: `${panelCount} panel outputs` };
    if (hasComposition) return { stage: 3, stageName: STAGE_NAMES[3], nextAction: "Run panel", editorVerdict: null, detail: "Panel composed" };
    if (hasPrompt) return { stage: 2, stageName: STAGE_NAMES[2], nextAction: "Panel composition", editorVerdict: null, detail: "Prompt written" };
    if (hasIdea) return { stage: 1, stageName: STAGE_NAMES[1], nextAction: "Discussion prompt", editorVerdict: null, detail: "Idea exists" };

    return { stage: 1, stageName: STAGE_NAMES[1], nextAction: "Idea generation", editorVerdict: null, detail: "Empty directory" };
}

// ── Artifact inventory for detail page ───────────────────────────────────────

export function getArticleArtifacts(slug) {
    const dirpath = join(ARTICLES_DIR, slug);
    if (!existsSync(dirpath) || !statSync(dirpath).isDirectory()) return [];

    return readdirSync(dirpath)
        .filter(f => !f.startsWith("."))
        .map(f => {
            const full = join(dirpath, f);
            const st = statSync(full);
            return {
                name: f,
                path: relative(REPO_ROOT, full).replace(/\\/g, "/"),
                size: st.size,
                isMarkdown: f.endsWith(".md"),
                isImage: /\.(png|jpe?g|webp)$/i.test(f),
                modified: st.mtime.toISOString(),
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function getArticleImages(slug) {
    const dirs = [join(ARTICLES_DIR, slug), join(IMAGES_DIR, slug)];
    const images = [];
    for (const dir of dirs) {
        try {
            for (const f of readdirSync(dir)) {
                if (/\.(png|jpe?g|webp)$/i.test(f)) {
                    images.push({
                        name: f,
                        path: relative(REPO_ROOT, join(dir, f)).replace(/\\/g, "/"),
                        dir: relative(REPO_ROOT, dir).replace(/\\/g, "/"),
                    });
                }
            }
        } catch { /* dir may not exist */ }
    }
    return images;
}

function classifyDocumentGroup(name) {
    if (name === "idea.md") return "overview";
    if (name === "discussion-prompt.md" || name === "panel-composition.md") return "panel";
    if (name.endsWith("-position.md")) return "panel";
    if (/^discussion-(summary|synthesis)\.md$/.test(name)) return "panel";
    if (/^draft(?:-.+)?\.md$/.test(name)) return "draft";
    if (/^editor-review(?:-\d+)?\.md$/.test(name) || name === "editor-image-review.md") return "draft";
    if (name === "panel-factcheck.md") return "verify";
    if (name === "publisher-pass.md") return "publish";
    return "other";
}

function documentSortKey(name) {
    if (name === "idea.md") return 10;
    if (name === "discussion-prompt.md") return 20;
    if (name === "panel-composition.md") return 30;
    if (name.endsWith("-position.md")) return 40;
    if (/^discussion-(summary|synthesis)\.md$/.test(name)) return 50;
    if (/^draft(?:-.+)?\.md$/.test(name)) return 60;
    if (/^editor-review(?:-\d+)?\.md$/.test(name)) return 70;
    if (name === "editor-image-review.md") return 80;
    if (name === "panel-factcheck.md") return 85;
    if (name === "publisher-pass.md") return 90;
    return 999;
}

function labelForDocument(name) {
    return name
        .replace(/\.md$/i, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getArticleDocuments(slug) {
    return getArticleArtifacts(slug)
        .filter((artifact) => artifact.isMarkdown)
        .map((artifact) => ({
            ...artifact,
            content: readArtifact(slug, artifact.name) || "",
            group: classifyDocumentGroup(artifact.name),
            label: labelForDocument(artifact.name),
            sortKey: documentSortKey(artifact.name),
        }))
        .sort((left, right) => left.sortKey - right.sortKey || left.name.localeCompare(right.name));
}

export function readArtifact(slug, filename) {
    const filepath = join(ARTICLES_DIR, slug, filename);
    if (!existsSync(filepath)) return null;
    try {
        return readFileSync(filepath, "utf-8");
    } catch { return null; }
}

// ── Unified board payload ────────────────────────────────────────────────────

export function getBoardData() {
    const dbArticles = getAllArticles();
    const dbMap = new Map(dbArticles.map(a => [a.id, a]));

    // Scan filesystem for article directories
    const fsSlugs = new Set();
    if (existsSync(ARTICLES_DIR)) {
        for (const entry of readdirSync(ARTICLES_DIR)) {
            const full = join(ARTICLES_DIR, entry);
            if (statSync(full).isDirectory()) fsSlugs.add(entry);
        }
    }

    // Merge DB articles + filesystem-only articles
    const allSlugs = new Set([...dbMap.keys(), ...fsSlugs]);
    const board = [];

    for (const slug of allSlugs) {
        const db = dbMap.get(slug);
        const inferredBase = inferStage(slug);
        const inferred = db && (db.substack_url || db.status === "published" || db.current_stage === 8)
            ? { ...inferredBase, stage: 8, stageName: STAGE_NAMES[8], nextAction: null, detail: "Published URL recorded in pipeline.db" }
            : inferredBase;
        const imageCount = countImages(slug);

        const row = {
            slug,
            title: db?.title || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            primaryTeam: db?.primary_team || null,
            status: db?.status || "proposed",
            dbStage: db?.current_stage ?? null,
            inferredStage: inferred.stage,
            stageName: inferred.stageName,
            nextAction: inferred.nextAction,
            editorVerdict: inferred.editorVerdict,
            detail: inferred.detail,
            depthLevel: db?.depth_level ?? 2,
            depthName: DEPTH_NAMES[db?.depth_level ?? 2] || "Unknown",
            targetPublishDate: db?.target_publish_date || null,
            publishWindow: db?.publish_window || null,
            timeSensitive: db?.time_sensitive === 1,
            substackUrl: db?.substack_url || null,
            draftUrl: db?.substack_draft_url || db?.draft_url || null,
            publishedAt: db?.published_at || null,
            updatedAt: db?.updated_at || null,
            imageCount,
            inDb: !!db,
            hasDrift: db ? (typeof db.current_stage === "number" && db.current_stage !== inferred.stage) : false,
        };
        board.push(row);
    }

    // Sort: in_production first, then by stage desc, then by updated_at desc
    board.sort((a, b) => {
        const statusOrder = { in_production: 1, in_discussion: 2, proposed: 3, approved: 4, published: 5, archived: 6 };
        const sa = statusOrder[a.status] || 7;
        const sb = statusOrder[b.status] || 7;
        if (sa !== sb) return sa - sb;
        if (b.inferredStage !== a.inferredStage) return b.inferredStage - a.inferredStage;
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });

    return board;
}

// ── Article detail aggregate ─────────────────────────────────────────────────

export function getArticleDetail(slug) {
    const article = getArticle(slug);
    const inferredBase = inferStage(slug);
    const inferred = article && (article.substack_url || article.status === "published" || article.current_stage === 8)
        ? { ...inferredBase, stage: 8, stageName: STAGE_NAMES[8], nextAction: null, detail: "Published URL recorded in pipeline.db" }
        : inferredBase;
    const artifacts = getArticleArtifacts(slug);
    const images = getArticleImages(slug);
    const documents = getArticleDocuments(slug);
    const transitions = getStageTransitions(slug);
    const editorReviews = getEditorReviews(slug);
    const publisherPass = getPublisherPass(slug);
    const panels = getArticlePanels(slug);
    const notes = getNotes(slug);
    const prompt = getDiscussionPrompt(slug);
    const publishState = buildPublishState(article, publisherPass, notes, slug);

    return {
        slug,
        article,
        inferred,
        artifacts,
        images,
        documents,
        transitions,
        editorReviews,
        publisherPass,
        panels,
        notes,
        prompt,
        publishState,
        hasDrift: article ? (typeof article.current_stage === "number" && article.current_stage !== inferred.stage) : false,
    };
}

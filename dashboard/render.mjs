/**
 * render.mjs — Canonical preview renderer for dashboard.
 *
 * Uses the shared ProseMirror module (shared/substack-prosemirror.mjs) for
 * markdown parsing and post-processing, then converts the ProseMirror JSON
 * tree to HTML. This ensures the dashboard preview matches the publisher
 * extension's semantics: subscribe buttons, hero-image safety, dense-table
 * warnings, TLDR callout handling, and YouTube embeds.
 */

import { posix as pathPosix } from "node:path";

import {
    extractMetaFromMarkdown,
    markdownToProseMirror,
    ensureSubscribeButtons,
    ensureHeroFirstImage,
    getNodeText,
} from "../shared/substack-prosemirror.mjs";

function esc(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function toDashboardImageUrl(slug, rawSrc) {
    const source = String(rawSrc ?? "").trim().replace(/\\/g, "/");
    if (!source) return "";
    if (/^(https?:\/\/|data:)/i.test(source)) return source;
    if (source.startsWith("/image/")) return source;

    const cleaned = source.replace(/^\.\/+/, "");
    let repoPath;

    if (source.startsWith("/")) {
        repoPath = source.replace(/^\/+/, "");
    } else if (/^(content|dashboard|docs|\.github)\//.test(cleaned)) {
        repoPath = cleaned;
    } else {
        repoPath = pathPosix.normalize(pathPosix.join("content/articles", slug || "", source));
    }

    if (!repoPath || repoPath.startsWith("..")) return source;
    return `/image/${encodeURIComponent(repoPath)}`;
}

function renderInlineMarkdown(text) {
    return esc(text)
        .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/_(.+?)_/g, "<em>$1</em>")
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
        .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderSimpleTable(tableLines) {
    const rows = tableLines.map((line) => {
        let working = line.trim();
        if (working.startsWith("|")) working = working.slice(1);
        if (working.endsWith("|")) working = working.slice(0, -1);
        return working.split("|").map((cell) => cell.trim());
    });

    if (rows.length < 2) return "";

    const hasSeparator = rows[1].every((cell) => /^:?-{3,}:?$/.test(cell));
    const header = rows[0];
    const body = rows.slice(hasSeparator ? 2 : 1);

    let html = '<div class="table-wrap"><table><thead><tr>';
    for (const cell of header) {
        html += `<th>${renderInlineMarkdown(cell)}</th>`;
    }
    html += "</tr></thead><tbody>";

    for (const row of body) {
        html += "<tr>";
        for (let index = 0; index < header.length; index++) {
            html += `<td>${renderInlineMarkdown(row[index] || "")}</td>`;
        }
        html += "</tr>";
    }

    html += "</tbody></table></div>";
    return html;
}

export function renderMarkdownFragment(markdown, slug = "") {
    if (!markdown) return "";

    const lines = String(markdown)
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n");

    const html = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        const trimmed = line.trim();

        if (!trimmed) {
            index++;
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
            index++;
            continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            html.push("<hr>");
            index++;
            continue;
        }

        const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)"]+?)(?:\s+"([^"]*)")?\)$/);
        if (imageMatch) {
            const altRaw = imageMatch[1];
            const pipeIndex = altRaw.indexOf("|");
            const alt = pipeIndex >= 0 ? altRaw.slice(0, pipeIndex).trim() : altRaw.trim();
            const caption = imageMatch[3] || (pipeIndex >= 0 ? altRaw.slice(pipeIndex + 1).trim() : "");
            html.push(`<figure><img src="${esc(toDashboardImageUrl(slug, imageMatch[2]))}" alt="${esc(alt)}" loading="lazy">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`);
            index++;
            continue;
        }

        if (trimmed.startsWith("> ")) {
            const quoteLines = [];
            while (index < lines.length && lines[index].trimStart().startsWith("> ")) {
                quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
                index++;
            }
            html.push(`<blockquote><p>${renderInlineMarkdown(quoteLines.join(" "))}</p></blockquote>`);
            continue;
        }

        if (trimmed.startsWith("|")) {
            const tableLines = [];
            while (index < lines.length && lines[index].trim().startsWith("|")) {
                tableLines.push(lines[index]);
                index++;
            }
            html.push(renderSimpleTable(tableLines));
            continue;
        }

        if (/^[-*+]\s/.test(trimmed)) {
            const items = [];
            while (index < lines.length && /^\s*[-*+]\s/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*[-*+]\s/, ""));
                index++;
            }
            html.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
            continue;
        }

        if (/^\d+\.\s/.test(trimmed)) {
            const items = [];
            while (index < lines.length && /^\s*\d+\.\s/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*\d+\.\s/, ""));
                index++;
            }
            html.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
            continue;
        }

        const paragraphLines = [];
        while (
            index < lines.length &&
            lines[index].trim() !== "" &&
            !/^#{1,3}\s/.test(lines[index].trim()) &&
            !lines[index].trim().startsWith("> ") &&
            !lines[index].trim().startsWith("|") &&
            !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[index].trim()) &&
            !/^\s*[-*+]\s/.test(lines[index]) &&
            !/^\s*\d+\.\s/.test(lines[index]) &&
            !/^!\[/.test(lines[index].trim())
        ) {
            paragraphLines.push(lines[index]);
            index++;
        }
        html.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
    }

    return html.join("\n");
}

// ── ProseMirror JSON → HTML ──────────────────────────────────────────────────

function renderMarks(text, marks) {
    if (!marks || marks.length === 0) return esc(text);
    let html = esc(text);
    for (const mark of marks) {
        switch (mark.type) {
            case "bold":   html = `<strong>${html}</strong>`; break;
            case "italic": html = `<em>${html}</em>`; break;
            case "link":   html = `<a href="${esc(mark.attrs?.href)}" target="_blank">${html}</a>`; break;
        }
    }
    return html;
}

function renderNode(node) {
    if (!node) return "";

    switch (node.type) {
        case "doc":
            return (node.content || []).map(renderNode).join("\n");

        case "paragraph":
            return `<p>${renderChildren(node)}</p>`;

        case "text":
            return renderMarks(node.text || "", node.marks);

        case "heading": {
            const level = node.attrs?.level || 2;
            return `<h${level}>${renderChildren(node)}</h${level}>`;
        }

        case "horizontal_rule":
            return "<hr>";

        case "hard_break":
            return "<br>";

        case "blockquote":
            return `<blockquote>${(node.content || []).map(renderNode).join("")}</blockquote>`;

        case "bullet_list":
            return `<ul>${(node.content || []).map(renderNode).join("")}</ul>`;

        case "ordered_list": {
            const start = node.attrs?.start || 1;
            return `<ol start="${start}">${(node.content || []).map(renderNode).join("")}</ol>`;
        }

        case "list_item":
            return `<li>${(node.content || []).map(renderNode).join("")}</li>`;

        case "code_block":
            return `<pre><code>${esc(getNodeText(node))}</code></pre>`;

        case "captionedImage": {
            const img = (node.content || []).find(c => c.type === "image2");
            const cap = (node.content || []).find(c => c.type === "caption");
            const src = img?.attrs?.src || "";
            const alt = img?.attrs?.alt || "";
            const capText = cap ? getNodeText(cap).trim() : "";
            const imgSrc = /^(https?:\/\/|data:)/i.test(src) || src.startsWith("/image/")
                ? src
                : `/image/${encodeURIComponent(src.replace(/^\/+/, ""))}`;
            return `<figure><img src="${esc(imgSrc)}" alt="${esc(alt)}" loading="lazy">${capText ? `<figcaption>${esc(capText)}</figcaption>` : ""}</figure>`;
        }

        case "youtube2": {
            const vid = node.attrs?.videoId || "";
            return `<div class="youtube-embed"><iframe src="https://www.youtube.com/embed/${esc(vid)}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
        }

        case "subscribeWidget": {
            const caption = getNodeText(node).trim();
            return `<div class="subscribe-widget"><p>${esc(caption)}</p><button disabled>Subscribe</button></div>`;
        }

        case "table":
            return `<div class="table-wrap"><table>${(node.content || []).map(renderNode).join("")}</table></div>`;

        case "table_row":
            return `<tr>${(node.content || []).map(renderNode).join("")}</tr>`;

        case "table_header":
            return `<th>${renderChildren(node)}</th>`;

        case "table_cell":
            return `<td>${renderChildren(node)}</td>`;

        default:
            return node.content ? (node.content || []).map(renderNode).join("") : "";
    }
}

function renderChildren(node) {
    return (node.content || []).map(renderNode).join("");
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Render a markdown draft through the canonical publisher pipeline.
 *
 * Returns { title, subtitle, html, warnings[] } where warnings include
 * dense-table and hero-image issues.
 *
 * @param {string} markdown - Raw draft markdown content.
 */
export async function renderPreview(markdown, options = {}) {
    if (!markdown) return { title: null, subtitle: null, html: "", warnings: [] };

    const meta = extractMetaFromMarkdown(markdown);
    const imageResolver = options.slug
        ? async (rawSrc) => toDashboardImageUrl(options.slug, rawSrc)
        : null;
    const doc = await markdownToProseMirror(meta.bodyMarkdown, imageResolver, { previewMode: true });

    const warnings = [...(doc._warnings || [])];

    ensureSubscribeButtons(doc);

    const heroResult = ensureHeroFirstImage(doc);
    if (heroResult.warning) {
        warnings.push({
            type: "hero_image",
            message: heroResult.warning,
            safe: heroResult.safe,
        });
    }

    const html = renderNode(doc);

    return {
        title: meta.title,
        subtitle: meta.subtitle,
        html,
        warnings,
    };
}

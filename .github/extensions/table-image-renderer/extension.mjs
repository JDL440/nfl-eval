/**
 * Table Image Renderer — Copilot CLI Extension
 *
 * Renders a markdown table to a branded PNG using a local headless browser.
 * Intended for Substack-safe illustrative tables that need to survive email
 * rendering without relying on HTML table support.
 */

import { approveAll } from "@github/copilot-sdk";
import { joinSession } from "@github/copilot-sdk/extension";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function slugify(value) {
    return String(value || "table")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "table";
}

function parseMarkdownTable(tableMarkdown) {
    const lines = tableMarkdown
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => line.startsWith("|"))
        .filter((line) => !/^\|[\s\-:|]+\|$/.test(line));

    if (lines.length < 2) {
        throw new Error("Expected a markdown table with a header row and at least one body row.");
    }

    const rows = lines.map((line) =>
        line
            .split("|")
            .filter((_, index, arr) => index > 0 && index < arr.length - 1)
            .map((cell) => cell.trim())
    );

    const [headers, ...bodyRows] = rows;
    return { headers, rows: bodyRows };
}

function extractTableBlock(markdown, tableIndex = 1) {
    const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const tables = [];
    let i = 0;

    while (i < lines.length) {
        if (!lines[i].trim().startsWith("|")) {
            i++;
            continue;
        }

        const block = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
            block.push(lines[i]);
            i++;
        }

        if (block.length >= 2) {
            tables.push(block.join("\n"));
        }
    }

    if (tableIndex < 1 || tableIndex > tables.length) {
        throw new Error(`Table index ${tableIndex} not found. File contains ${tables.length} markdown table(s).`);
    }

    return tables[tableIndex - 1];
}

function findBrowserExecutable() {
    const candidates = [
        process.env.TABLE_IMAGE_BROWSER,
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ].filter(Boolean);

    const match = candidates.find((candidate) => existsSync(candidate));
    if (!match) {
        throw new Error(
            "No supported headless browser found. Set TABLE_IMAGE_BROWSER to Edge or Chrome."
        );
    }
    return match;
}

function deriveArticleSlug(articleFilePath) {
    const normalized = articleFilePath.replace(/\\/g, "/");
    const nested = normalized.match(/content\/articles\/([^/]+)\/[^/]+$/);
    if (nested) return nested[1];
    return basename(normalized, extname(normalized));
}

function buildHtml(table, options) {
    const { title, caption } = options;
    const width = Math.max(980, Math.min(1400, table.headers.length * 220));
    const rowHeight = 64;
    const titleHeight = title ? 72 : 0;
    const captionHeight = caption ? 54 : 0;
    const height = titleHeight + captionHeight + 110 + (table.rows.length * rowHeight);

    const tableHead = table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const tableRows = table.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    :root {
      color-scheme: dark;
      --bg: #08101d;
      --panel: #0f172a;
      --border: #334155;
      --header: #93c5fd;
      --text: #f8fafc;
      --muted: #cbd5e1;
    }
    html, body {
      margin: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, "Segoe UI", Arial, sans-serif;
    }
    body {
      display: flex;
      align-items: stretch;
      justify-content: stretch;
    }
    .frame {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 28px 32px;
      background: linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
    }
    h1 {
      margin: 0 0 18px 0;
      font-size: 30px;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .caption {
      margin: -6px 0 18px 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: rgba(15, 23, 42, 0.88);
      border-radius: 14px;
      overflow: hidden;
    }
    thead th {
      text-align: left;
      color: var(--header);
      font-size: 15px;
      font-weight: 800;
      padding: 18px 14px;
      border-bottom: 1px solid var(--border);
      background: rgba(15, 23, 42, 0.95);
    }
    tbody td {
      vertical-align: top;
      font-size: 15px;
      line-height: 1.45;
      padding: 18px 14px;
      border-bottom: 1px solid var(--border);
      word-break: break-word;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <div class="frame">
    ${title ? `<h1>${escapeHtml(title)}</h1>` : ""}
    ${caption ? `<div class="caption">${escapeHtml(caption)}</div>` : ""}
    <table>
      <thead><tr>${tableHead}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
</body>
</html>`;

    return { html, width, height };
}

function renderTablePng({ html, width, height, outputPath }) {
    const browser = findBrowserExecutable();
    const tempHtmlPath = join(tmpdir(), `table-image-${randomUUID()}.html`);

    try {
        writeFileSync(tempHtmlPath, html, "utf-8");
        const url = pathToFileURL(tempHtmlPath).href;
        const args = [
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--allow-file-access-from-files",
            "--force-device-scale-factor=2",
            `--window-size=${width},${height}`,
            `--screenshot=${outputPath}`,
            url,
        ];
        const result = spawnSync(browser, args, {
            encoding: "utf-8",
            timeout: 30000,
        });

        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0 && !existsSync(outputPath)) {
            throw new Error(result.stderr || result.stdout || `Browser exited with code ${result.status}`);
        }
        if (!existsSync(outputPath)) {
            throw new Error("Browser completed without creating the PNG output.");
        }
    } finally {
        if (existsSync(tempHtmlPath)) {
            rmSync(tempHtmlPath, { force: true });
        }
    }
}

async function renderTableImage(args) {
    const articleFilePath = resolve(process.cwd(), args.article_file_path);
    if (!existsSync(articleFilePath)) {
        throw new Error(`Article file not found: ${articleFilePath}`);
    }

    const tableMarkdown = args.table_markdown
        ? args.table_markdown
        : (() => {
            if (!args.source_path) {
                throw new Error("Provide either table_markdown or source_path.");
            }
            const sourcePath = resolve(process.cwd(), args.source_path);
            if (!existsSync(sourcePath)) {
                throw new Error(`Source file not found: ${sourcePath}`);
            }
            const markdown = readFileSync(sourcePath, "utf-8");
            return extractTableBlock(markdown, args.table_index || 1);
        })();

    const table = parseMarkdownTable(tableMarkdown);
    const articleSlug = args.article_slug || deriveArticleSlug(args.article_file_path);
    const outputDir = join(process.cwd(), "content", "images", articleSlug);
    mkdirSync(outputDir, { recursive: true });

    const outputStem = slugify(args.output_name || args.title || `table-${args.table_index || 1}`);
    const outputFilename = `${articleSlug}-${outputStem}.png`;
    const outputPath = join(outputDir, outputFilename);

    const { html, width, height } = buildHtml(table, {
        title: args.title || null,
        caption: args.caption || null,
    });
    renderTablePng({ html, width, height, outputPath });

    const articleDir = dirname(articleFilePath);
    let relativeImagePath = relative(articleDir, outputPath).replace(/\\/g, "/");
    if (!relativeImagePath.startsWith(".")) {
        relativeImagePath = `./${relativeImagePath}`;
    }

    const alt = args.alt_text || args.title || "Rendered table";
    const markdown = args.caption
        ? `![${alt}|${args.caption}](${relativeImagePath})`
        : `![${alt}](${relativeImagePath})`;

    return (
        `✅ Rendered table image.\n\n` +
        `**Saved file:** ${outputPath}\n` +
        `**Article markdown:** ${markdown}\n`
    );
}

const session = await joinSession({
    onPermissionRequest: approveAll,
    tools: [
        {
            name: "render_table_image",
            description:
                "Render a markdown table from an article or inline input to a local PNG for Substack-safe publishing.",
            parameters: {
                type: "object",
                properties: {
                    article_file_path: {
                        type: "string",
                        description: "Path to the target article markdown file, relative to the repo root.",
                    },
                    article_slug: {
                        type: "string",
                        description: "Optional slug override for content/images/{slug}/ output.",
                    },
                    source_path: {
                        type: "string",
                        description: "Optional source markdown file to extract a table from.",
                    },
                    table_index: {
                        type: "integer",
                        description: "1-based table index when extracting from a markdown source file.",
                        default: 1,
                    },
                    table_markdown: {
                        type: "string",
                        description: "Optional raw markdown table content. Use instead of source_path.",
                    },
                    title: {
                        type: "string",
                        description: "Optional title shown above the table image.",
                    },
                    caption: {
                        type: "string",
                        description: "Optional caption returned in the markdown image syntax.",
                    },
                    alt_text: {
                        type: "string",
                        description: "Optional alt text override for the returned markdown image syntax.",
                    },
                    output_name: {
                        type: "string",
                        description: "Optional filename stem for the generated image.",
                    },
                },
                required: ["article_file_path"],
            },
            async call(args) {
                try {
                    return await renderTableImage(args);
                } catch (err) {
                    return {
                        textResultForLlm: `Error rendering table image: ${err.message}`,
                        resultType: "failure",
                    };
                }
            },
        },
    ],
});

await session.wait();

/**
 * markdown.ts — Lightweight markdown → HTML renderer for artifact display.
 *
 * Handles: headings, bold, italic, code (inline + fenced blocks), links,
 * ordered/unordered lists, blockquotes, horizontal rules, images, tables.
 *
 * ZERO external dependencies — pure string transforms only.
 */

import { escapeHtml } from '../dashboard/views/layout.js';

/**
 * Convert a markdown string into safe HTML for rendering in artifact tabs.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${langAttr}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('>') || (lines[i].trim() !== '' && quoteLines.length > 0 && !lines[i].startsWith('#')))) {
        if (lines[i].startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
        } else {
          break;
        }
        i++;
      }
      out.push(`<blockquote>${markdownToHtml(quoteLines.join('\n'))}</blockquote>`);
      continue;
    }

    // Table detection
    if (i + 1 < lines.length && /^\|?[^|]+\|/.test(line) && /^\|?\s*:?-+:?\s*\|/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && /\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(renderTable(tableLines));
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      out.push(`<ul>${listItems.map(li => `<li>${inlineMarkdown(li)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol>${listItems.map(li => `<li>${inlineMarkdown(li)}</li>`).join('')}</ol>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('>') && !lines[i].startsWith('```') && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(`<p>${inlineMarkdown(paraLines.join(' '))}</p>`);
    }
  }

  return out.join('\n');
}

/** Process inline markdown: bold, italic, code, links, images. */
function inlineMarkdown(text: string): string {
  let result = escapeHtml(text);

  // Inline code (must come first to protect content inside backticks)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images: ![alt](url)
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="article-img" loading="lazy" onerror="this.style.opacity=\'0.3\';this.alt=\'[Image not available]\'">'
  );

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Bold + italic: ***text*** or ___text___
  result = result.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');
  result = result.replace(/_{3}(.+?)_{3}/g, '<strong><em>$1</em></strong>');

  // Bold: **text** or __text__
  result = result.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>');
  result = result.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');

  return result;
}

/** Parse and render a markdown table. */
function renderTable(lines: string[]): string {
  const parseRow = (row: string): string[] =>
    row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  if (lines.length < 2) return '';

  const headers = parseRow(lines[0]);
  // lines[1] is the separator — parse alignment
  const alignCells = parseRow(lines[1]);
  const aligns = alignCells.map(c => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    return 'left';
  });

  const bodyRows = lines.slice(2).map(parseRow);

  const ths = headers.map((h, j) =>
    `<th style="text-align:${aligns[j] ?? 'left'}">${inlineMarkdown(h)}</th>`
  ).join('');

  const trs = bodyRows.map(row => {
    const tds = row.map((cell, j) =>
      `<td style="text-align:${aligns[j] ?? 'left'}">${inlineMarkdown(cell)}</td>`
    ).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  return `<table class="artifact-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

/**
 * Table Renderer Comparison Harness
 *
 * Renders the same test tables through all 3 backends (Chrome, Playwright, Canvas)
 * in both desktop and mobile, across multiple scenarios, then updates the
 * comparison article with all images.
 *
 * Usage: node render-comparison.mjs
 */

import { parseMarkdownTable, buildHtml, renderTablePng, closeBrowser as closeCoreBrowser, TEMPLATE_PRESETS } from "./.github/extensions/table-image-renderer/renderer-core.mjs";
import { renderTablePngPlaywright, closeBrowser as closePlaywrightBrowser } from "./.github/extensions/table-image-renderer/renderer-playwright.mjs";
import { renderTablePngCanvas } from "./.github/extensions/table-image-renderer/renderer-canvas.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "content", "images", "table-renderer-comparison");
const ARTICLE_DIR = join(process.cwd(), "content", "articles", "table-renderer-comparison");
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Test Scenarios ────────────────────────────────────────────────

const SCENARIOS = [
    {
        id: "simple",
        label: "Simple (3 columns, 3 rows)",
        template: "generic-comparison",
        markdown: [
            "| Metric | SEA | League Avg |",
            "| :-- | --: | --: |",
            "| EPA/Play | 0.12 | 0.00 |",
            "| Success Rate | 48.2% | 44.1% |",
            "| Yards/Att | 6.8 | 5.7 |",
        ].join("\n"),
    },
    {
        id: "standard",
        label: "Standard (5 columns, 4 rows)",
        template: "generic-comparison",
        markdown: [
            "| Player | Targets | Yards | EPA/Play | Rank |",
            "| :-- | --: | --: | --: | --: |",
            "| Puka Nacua | 24 | 156 | 0.42 | 3rd |",
            "| DK Metcalf | 19 | 112 | 0.18 | 12th |",
            "| Jaxon Smith-Njigba | 22 | 134 | 0.31 | 7th |",
            "| Tyler Lockett | 11 | 67 | -0.05 | 28th |",
        ].join("\n"),
    },
    {
        id: "dense",
        label: "Dense (7 columns, 6 rows)",
        template: "generic-comparison",
        markdown: [
            "| Player | Team | Tgt | Rec | Yards | YAC | EPA/Tgt |",
            "| :-- | :-- | --: | --: | --: | --: | --: |",
            "| Puka Nacua | SEA | 24 | 18 | 156 | 67 | 0.42 |",
            "| DK Metcalf | SEA | 19 | 14 | 112 | 34 | 0.18 |",
            "| Jaxon Smith-Njigba | SEA | 22 | 17 | 134 | 52 | 0.31 |",
            "| Tyler Lockett | SEA | 11 | 8 | 67 | 21 | -0.05 |",
            "| AJ Brown | PHI | 28 | 21 | 189 | 78 | 0.38 |",
            "| CeeDee Lamb | DAL | 31 | 23 | 201 | 84 | 0.44 |",
        ].join("\n"),
    },
    {
        id: "cap",
        label: "Cap Table (salary data)",
        template: "cap-comparison",
        markdown: [
            "| Scenario | 2025 Cap Hit | Dead Money | Savings | Notes |",
            "| :-- | --: | --: | --: | :-- |",
            "| Keep (status quo) | $18.2M | — | — | Full salary on books |",
            "| Restructure | $12.4M | — | $5.8M | Convert to signing bonus |",
            "| Trade (post-June 1) | $0 | $8.1M | $10.1M | Spread dead money over 2 years |",
            "| Cut (post-June 1) | $0 | $8.1M | $10.1M | No trade compensation |",
        ].join("\n"),
    },
    {
        id: "draft",
        label: "Draft Board (prospect eval)",
        template: "draft-board",
        markdown: [
            "| Pick | Prospect | School | Position | Grade |",
            "| --: | :-- | :-- | :-- | :-- |",
            "| 18 | Tetairoa McMillan | Arizona | WR | 92 |",
            "| 50 | Shemar Turner | Texas A&M | EDGE | 84 |",
            "| 82 | Jonah Savaiinaea | Arizona | OL | 79 |",
        ].join("\n"),
    },
    {
        id: "priority",
        label: "Priority List (ranked needs)",
        template: "priority-list",
        markdown: [
            "| Priority | Need | Current Starter | Urgency |",
            "| --: | :-- | :-- | :-- |",
            "| 1 | Offensive Line | Cross / Lucas | Critical |",
            "| 2 | Wide Receiver | Metcalf / JSN | High |",
            "| 3 | Cornerback | Woolen / Witherspoon | Moderate |",
            "| 4 | Edge Rusher | Mafe / Nwosu | Moderate |",
            "| 5 | Safety | Emmanwori / Neal | Low |",
        ].join("\n"),
    },
];

// ─── Render Functions ──────────────────────────────────────────────

async function renderCurrent(table, htmlResult, outputPath) {
    return renderTablePng({
        html: htmlResult.html,
        width: htmlResult.width,
        height: htmlResult.height,
        outputPath,
    });
}

async function renderPlaywright(table, htmlResult, outputPath) {
    return renderTablePngPlaywright({
        html: htmlResult.html,
        width: htmlResult.width,
        height: htmlResult.height,
        outputPath,
    });
}

async function renderCanvas(table, options, outputPath) {
    return renderTablePngCanvas({ table, options, outputPath });
}

// ─── Main ──────────────────────────────────────────────────────────

const results = [];

for (const scenario of SCENARIOS) {
    const table = parseMarkdownTable(scenario.markdown);

    for (const mobile of [false, true]) {
        const suffix = mobile ? "mobile" : "desktop";
        const opts = { title: scenario.label, template: scenario.template, mobile };
        const htmlResult = buildHtml(table, opts);

        // Backend A: Current (Chrome spawnSync)
        const nameA = `${scenario.id}-${suffix}-chrome.png`;
        const pathA = join(OUTPUT_DIR, nameA);
        const t0a = Date.now();
        try {
            const resA = await renderCurrent(table, htmlResult, pathA);
            results.push({ scenario: scenario.id, suffix, backend: "chrome", ...resA, ms: Date.now() - t0a, ok: true });
            console.log(`  ✓ chrome  ${scenario.id}/${suffix}: ${resA.width}×${resA.height} (${resA.bytes}b) ${Date.now()-t0a}ms`);
        } catch (e) {
            results.push({ scenario: scenario.id, suffix, backend: "chrome", ms: Date.now() - t0a, ok: false, error: e.message });
            console.log(`  ✗ chrome  ${scenario.id}/${suffix}: ${e.message}`);
        }

        // Backend B: Playwright
        const nameB = `${scenario.id}-${suffix}-playwright.png`;
        const pathB = join(OUTPUT_DIR, nameB);
        const t0b = Date.now();
        try {
            const resB = await renderPlaywright(table, htmlResult, pathB);
            results.push({ scenario: scenario.id, suffix, backend: "playwright", ...resB, ms: Date.now() - t0b, ok: true });
            console.log(`  ✓ playwright ${scenario.id}/${suffix}: ${resB.width}×${resB.height} (${resB.bytes}b) ${Date.now()-t0b}ms`);
        } catch (e) {
            results.push({ scenario: scenario.id, suffix, backend: "playwright", ms: Date.now() - t0b, ok: false, error: e.message });
            console.log(`  ✗ playwright ${scenario.id}/${suffix}: ${e.message}`);
        }

        // Backend C: Canvas
        const nameC = `${scenario.id}-${suffix}-canvas.png`;
        const pathC = join(OUTPUT_DIR, nameC);
        const t0c = Date.now();
        try {
            const resC = await renderCanvas(table, opts, pathC);
            results.push({ scenario: scenario.id, suffix, backend: "canvas", ...resC, ms: Date.now() - t0c, ok: true });
            console.log(`  ✓ canvas  ${scenario.id}/${suffix}: ${resC.width}×${resC.height} (${resC.bytes}b) ${Date.now()-t0c}ms`);
        } catch (e) {
            results.push({ scenario: scenario.id, suffix, backend: "canvas", ms: Date.now() - t0c, ok: false, error: e.message });
            console.log(`  ✗ canvas  ${scenario.id}/${suffix}: ${e.message}`);
        }
    }
    console.log();
}

await closeCoreBrowser();
await closePlaywrightBrowser();

// ─── Generate Article ──────────────────────────────────────────────

const imgRel = "../../images/table-renderer-comparison";

let md = `# Table Renderer Comparison: Chrome vs Playwright vs Canvas

*Side-by-side visual comparison across 6 scenarios, 3 backends, desktop + mobile*

Three rendering approaches evaluated:
- **A) Chrome spawnSync** — Current system. Headless Edge/Chrome via raw process spawn + PowerShell crop
- **B) Playwright** — Same HTML/CSS, but captured via Playwright's element screenshot API
- **C) Canvas** — Pure @napi-rs/canvas rendering. No browser, no HTML — all drawing is manual

---

## Performance Summary

| Backend | Avg Time | Browser? | CSS Support | Element Clip | Cross-Platform |
| :-- | --: | :-- | :-- | :-- | :-- |
`;

const backends = ["chrome", "playwright", "canvas"];
for (const b of backends) {
    const bResults = results.filter(r => r.backend === b && r.ok);
    const avgMs = bResults.length ? Math.round(bResults.reduce((s, r) => s + r.ms, 0) / bResults.length) : "N/A";
    const needsBrowser = b === "canvas" ? "No" : "Yes";
    const css = b === "canvas" ? "None" : "Full";
    const clip = b === "chrome" ? "PowerShell crop" : b === "playwright" ? "Native element" : "N/A";
    const xplat = b === "chrome" ? "Windows only" : "Yes";
    md += `| ${b.charAt(0).toUpperCase() + b.slice(1)} | ${avgMs}ms | ${needsBrowser} | ${css} | ${clip} | ${xplat} |\n`;
}

md += "\n---\n\n";

for (const scenario of SCENARIOS) {
    md += `## ${scenario.label}\n\n`;

    for (const suffix of ["desktop", "mobile"]) {
        md += `### ${suffix.charAt(0).toUpperCase() + suffix.slice(1)}\n\n`;

        for (const b of backends) {
            const r = results.find(r => r.scenario === scenario.id && r.suffix === suffix && r.backend === b);
            const file = `${scenario.id}-${suffix}-${b}.png`;
            if (r?.ok) {
                md += `**${b.charAt(0).toUpperCase() + b.slice(1)}** (${r.width}×${r.height}, ${r.ms}ms):\n\n`;
                md += `![${scenario.label} ${suffix} ${b}](${imgRel}/${file})\n\n`;
            } else {
                md += `**${b.charAt(0).toUpperCase() + b.slice(1)}**: ❌ Failed — ${r?.error || "unknown"}\n\n`;
            }
        }
    }
    md += "---\n\n";
}

md += `## Verdict

Review the images above and decide:
1. **Playwright** — Same quality as Chrome, but faster, cross-platform, no PowerShell hack
2. **Canvas** — Fastest, but visually basic (no gradients, rank pills, status chips, or rich formatting)
3. **Current (Chrome)** — Already works well, but Windows-only cropping is fragile

The HTML/CSS template system is the real asset. The screenshot backend is just a capture mechanism.
`;

writeFileSync(join(ARTICLE_DIR, "draft.md"), md, "utf-8");
console.log("✅ Article written to content/articles/table-renderer-comparison/draft.md");
console.log(`✅ ${results.filter(r => r.ok).length}/${results.length} renders succeeded`);

// Clean up test files
import { rmSync } from "node:fs";
for (const f of ["test-playwright.png", "test-canvas.png"]) {
    rmSync(join(OUTPUT_DIR, f), { force: true });
}

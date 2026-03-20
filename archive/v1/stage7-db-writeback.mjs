#!/usr/bin/env node
/**
 * Stage 7 DB Writeback
 *
 * Updates pipeline.db with new production draft URLs while keeping articles at
 * Stage 7 until the dashboard performs the live publish.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const CWD = process.cwd();
const PIPELINE_STATE = resolve(CWD, "content", "pipeline_state.py");
const PYTHON = process.env.PYTHON || "python";

function setDraftUrl(slug, draftUrl) {
    const result = spawnSync(PYTHON, [PIPELINE_STATE, "set-draft-url", "--article-id", slug, "--draft-url", draftUrl], {
        cwd: CWD,
        encoding: "utf-8",
        windowsHide: true,
    });

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(output || `pipeline_state.py exited with code ${result.status}`);
    }
}

function main() {
    const manifestPath = resolve(CWD, "stage7-prod-manifest.json");
    if (!existsSync(manifestPath)) {
        console.error("❌ stage7-prod-manifest.json not found");
        process.exit(1);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

    console.log(`\n📝 Stage 7 DB Writeback`);
    console.log(`   Processing manifest from: ${manifest.timestamp}`);
    console.log(`   Target: ${manifest.target}`);
    console.log("");

    const successes = manifest.articles.filter(a => a.status === "success");
    if (successes.length === 0) {
        console.log("No successful articles to write back.");
        return;
    }

    let updated = 0;
    for (const article of successes) {
        try {
            setDraftUrl(article.slug, article.draftUrl);
            console.log(`✅ ${article.slug}`);
            console.log(`   └─ URL: ${article.draftUrl}`);
            console.log(`   └─ Stage: stays at 7 (dashboard publishes live)`);
            updated++;
        } catch (err) {
            console.error(`❌ ${article.slug}: ${err.message}`);
        }
    }

    console.log(`\n${"─".repeat(60)}`);
    console.log(`✅ Updated: ${updated}/${successes.length}`);
    console.log(`📋 Database: content/pipeline.db`);
    console.log(`\n📌 Next steps:`);
    console.log(`   Stage 7: Dashboard review / live publish`);
    console.log(`   Manual action: Review in dashboard, then publish live from the article page`);
}

main();

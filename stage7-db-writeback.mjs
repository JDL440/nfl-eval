#!/usr/bin/env node
/**
 * Stage 7 DB Writeback
 * 
 * Updates pipeline.db with new production draft URLs and transitions articles to Stage 8.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const CWD = process.cwd();

function main() {
    const manifestPath = resolve(CWD, "stage7-prod-manifest.json");
    if (!existsSync(manifestPath)) {
        console.error("❌ stage7-prod-manifest.json not found");
        process.exit(1);
    }
    
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const dbPath = resolve(CWD, "content", "pipeline.db");
    const db = new DatabaseSync(dbPath);
    
    console.log(`\n📝 Stage 7 DB Writeback`);
    console.log(`   Processing manifest from: ${manifest.timestamp}`);
    console.log(`   Target: ${manifest.target}`);
    console.log("");
    
    const successes = manifest.articles.filter(a => a.status === "success");
    if (successes.length === 0) {
        console.log("No successful articles to write back.");
        db.close();
        return;
    }
    
    let updated = 0;
    for (const article of successes) {
        try {
            // Update articles table with production URL
            const updateArt = db.prepare(`
                UPDATE articles 
                SET 
                    substack_draft_url = ?,
                    current_stage = 8,
                    updated_at = datetime('now')
                WHERE id = ?
            `);
            updateArt.run(article.draftUrl, article.slug);
            
            // Record stage transition
            const insertTrans = db.prepare(`
                INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes)
                VALUES (?, 7, 8, ?, ?)
            `);
            const notes = `Pushed to production: ${article.draftUrl}`;
            insertTrans.run(article.slug, "stage7-prod-push.mjs", notes);
            
            console.log(`✅ ${article.slug}`);
            console.log(`   └─ URL: ${article.draftUrl}`);
            console.log(`   └─ Stage: 7 → 8`);
            updated++;
        } catch (err) {
            console.error(`❌ ${article.slug}: ${err.message}`);
        }
    }
    
    db.close();
    
    console.log(`\n${"─".repeat(60)}`);
    console.log(`✅ Updated: ${updated}/${successes.length}`);
    console.log(`📋 Database: content/pipeline.db`);
    console.log(`\n📌 Next steps:`);
    console.log(`   Stage 8: Editorial review / approval`);
    console.log(`   Manual action: Joe reviews draft at ${successes[0].draftUrl}`);
}

main();

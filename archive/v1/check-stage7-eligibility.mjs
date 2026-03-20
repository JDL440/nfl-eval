#!/usr/bin/env node
/**
 * Stage 7 — Production Draft Push (FILTERED)
 * 
 * Only processes articles that have:
 * 1. Full publisher pass completion (all 7 checkboxes)
 * 2. "in_production" or "approved" status
 * 3. Real article artifacts (draft.md exists)
 * 4. Staging (nfllabstage) draft URLs
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const CWD = process.cwd();
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SLUG_FILTER = args.find(a => a.startsWith("--slug="))?.split("=")[1] || null;

function getStagingArticlesEligible() {
    const dbPath = resolve(CWD, "content", "pipeline.db");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const stmt = db.prepare(`
        SELECT 
            a.id, 
            a.title, 
            a.subtitle, 
            a.primary_team, 
            a.article_path, 
            a.substack_draft_url,
            a.status,
            a.current_stage,
            COALESCE(p.title_final, 0) as title_final,
            COALESCE(p.subtitle_final, 0) as subtitle_final,
            COALESCE(p.body_clean, 0) as body_clean,
            COALESCE(p.section_assigned, 0) as section_assigned,
            COALESCE(p.tags_set, 0) as tags_set,
            COALESCE(p.names_verified, 0) as names_verified,
            COALESCE(p.numbers_current, 0) as numbers_current
        FROM articles a
        LEFT JOIN publisher_pass p ON a.id = p.article_id
        WHERE a.current_stage = 7 
        AND a.substack_draft_url LIKE '%nfllabstage%'
        AND a.status IN ('in_production', 'approved')
        ORDER BY a.updated_at DESC
    `);
    
    const eligible = [];
    for (const row of stmt.all()) {
        // Check if ALL publisher pass items are checked
        const pp_complete = !!(
            row.title_final && row.subtitle_final && row.body_clean && 
            row.section_assigned && row.tags_set && row.names_verified && 
            row.numbers_current
        );
        
        // Check if article file exists
        let has_artifact = false;
        if (row.article_path) {
            const filePath = resolve(CWD, row.article_path);
            has_artifact = existsSync(filePath);
        }
        
        if (pp_complete && has_artifact) {
            eligible.push(row);
        }
    }
    
    db.close();
    return eligible;
}

async function main() {
    const articles = getStagingArticlesEligible();
    
    console.log(`\n🔍 Stage 7 Eligibility Check`);
    console.log(`   Looking for: Full publisher pass + ready-to-publish + staging URLs`);
    console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "WOULD RUN LIVE"}`);
    console.log("");
    
    if (articles.length === 0) {
        console.log("❌ No eligible articles found for Stage 7 production push.");
        console.log("   (Articles must have full publisher pass AND staging draft URLs)");
        return;
    }
    
    console.log(`✅ Found ${articles.length} eligible article(s):\n`);
    for (let i = 0; i < articles.length; i++) {
        console.log(`  [${i+1}] ${articles[i].id}`);
        console.log(`      Title: ${articles[i].title.slice(0, 70)}`);
        console.log(`      Status: ${articles[i].status}`);
        console.log(`      Draft URL: ${articles[i].substack_draft_url.slice(0, 60)}...`);
        console.log("");
    }
    
    if (DRY_RUN) {
        console.log(`\n✨ To run Stage 7 production push LIVE on these articles:`);
        console.log(`   node stage7-prod-push.mjs`);
        console.log(`\n   To push single article:`);
        console.log(`   node stage7-prod-push.mjs --slug=${articles[0].id}`);
    }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });

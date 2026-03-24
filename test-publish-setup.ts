/**
 * test-publish-setup.ts — Prepare sandbox for publish workflow test
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SANDBOX_DIR = 'C:\\Users\\jdl44\\.nfl-lab-sandbox';
const ARTICLE_ID = 'the-nfls-next-big-date-is-closer-than-you-think-heres-why-it';

// 1. Check if article exists in DB
const dbPath = join(SANDBOX_DIR, 'pipeline.db');
const db = new DatabaseSync(dbPath);

console.log('=== Checking sandbox DB ===');
const article = db.prepare('SELECT id, title, current_stage, primary_team, substack_draft_url FROM articles WHERE id = ?')
  .get(ARTICLE_ID) as { id: string; title: string; current_stage: number; primary_team: string | null; substack_draft_url: string | null } | undefined;

if (article) {
  console.log('✅ Article found in DB:');
  console.log(JSON.stringify(article, null, 2));
} else {
  console.log('❌ Article NOT found in DB');
  
  // Let's check for similar articles
  console.log('\n=== SEA articles in DB (sample) ===');
  const seaStmt = db.prepare('SELECT id, current_stage FROM articles WHERE primary_team = ? LIMIT 10');
  const seaArticles = [];
  for (const row of seaStmt.iterate('seahawks') as IterableIterator<{ id: string; current_stage: number }>) {
    seaArticles.push(row);
    console.log(`${row.id} | stage=${row.current_stage}`);
  }
  
  // Insert a test article
  console.log('\n=== Creating test article in DB ===');
  db.prepare(`
    INSERT INTO articles (id, title, subtitle, primary_team, teams, league, current_stage, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    ARTICLE_ID,
    "The NFL's Next Big Date Is Closer Than You Think — Here's Why It Matters",
    "The 2023 fifth-year option deadline hits May 1. Seattle just made their choice on Devon Witherspoon and Jaxon Smith-Njigba.",
    'seahawks',
    '["seahawks"]',
    'nfl',
    7,
    'in_production'
  );
  console.log('✅ Article inserted');
}

// 2. Create article directory with draft.md
const articleDir = join(SANDBOX_DIR, 'leagues', 'nfl', 'articles', ARTICLE_ID);
if (!existsSync(articleDir)) {
  console.log('\n=== Creating article directory ===');
  mkdirSync(articleDir, { recursive: true });
  console.log('✅ Created:', articleDir);
}

// 3. Create draft.md with sample content
const draftPath = join(articleDir, 'draft.md');
const sampleDraft = `# The NFL's Next Big Date Is Closer Than You Think — Here's Why It Matters

*The 2023 fifth-year option deadline hits May 1. Seattle just made their choice on Devon Witherspoon and Jaxon Smith-Njigba.*

The Seahawks' Super Bowl LX championship is still fresh, but the front office is already racing against the NFL's most underrated deadline: **May 1, 2026** — the fifth-year option decision date for the 2023 draft class.

## What's at Stake

For first-round picks drafted in 2023, teams must decide by May 1 whether to exercise a fully guaranteed fifth-year option for the 2027 season. Miss the deadline, and the player becomes an unrestricted free agent after 2026.

Seattle has two critical decisions:
- **Devon Witherspoon** (CB, #5 overall) — the cornerstone of their defense
- **Jaxon Smith-Njigba** (WR, #20 overall) — the emerging WR1

::subscribe

## The Witherspoon Decision

Witherspoon's rookie season transformed Seattle's defense. His 2025 All-Pro campaign cemented his status as an elite cornerback. The fifth-year option for top-10 picks like Witherspoon averages **$17-20M** fully guaranteed.

**The Lab's Consensus:** Lock him in. No hesitation.

## The JSN Gamble

Smith-Njigba's emergence in 2025 (1,100+ yards, 8 TDs) makes him Seattle's clear WR1. But his fifth-year option (~$13M guaranteed) creates a timing squeeze with Witherspoon's extension window.

**The Split:**
- **Cap Analyst:** Exercise the option — buys leverage for extension talks
- **Mediator:** Risk it — bet on a team-friendly extension before he hits FA

## The Bigger Picture

This isn't just about two players. It's about Seattle's championship window. The Seahawks won Super Bowl LX with a young core. Keeping Witherspoon and JSN together through 2027+ is the difference between dynasty and rebuild.

**The deadline is May 1.** The clock is ticking.

---

*What would you do? Lock them both in, or take the cap risk? Drop your take in the comments.*`;

writeFileSync(draftPath, sampleDraft, 'utf-8');
console.log('\n=== Created draft.md ===');
console.log('Path:', draftPath);
console.log('Size:', Buffer.byteLength(sampleDraft), 'bytes');

// 4. Create images.json manifest
const imagesJsonPath = join(articleDir, 'images.json');
const imageManifest = [
  {
    type: 'cover',
    path: join(SANDBOX_DIR, 'leagues', 'nfl', 'images', ARTICLE_ID, `${ARTICLE_ID}-cover.png`),
    prompt: 'NFL fifth-year option deadline — calendar and contract papers'
  },
  {
    type: 'inline',
    path: join(SANDBOX_DIR, 'leagues', 'nfl', 'images', ARTICLE_ID, `${ARTICLE_ID}-inline-1.png`),
    prompt: 'Devon Witherspoon in Seahawks uniform — defensive play'
  }
];

writeFileSync(imagesJsonPath, JSON.stringify(imageManifest, null, 2), 'utf-8');
console.log('\n=== Created images.json ===');
console.log('Path:', imagesJsonPath);
console.log('Entries:', imageManifest.length);

// 5. Check if image files exist
console.log('\n=== Checking image files ===');
const imageDir = join(SANDBOX_DIR, 'leagues', 'nfl', 'images', ARTICLE_ID);
if (existsSync(imageDir)) {
  console.log('✅ Image directory exists:', imageDir);
  const files = readdirSync(imageDir);
  console.log('Files:', files);
} else {
  console.log('⚠️ Image directory does not exist — will be created on first upload');
  console.log('   Expected:', imageDir);
}

db.close();
console.log('\n=== Setup complete ===');
console.log('Sandbox ready for publish workflow test');

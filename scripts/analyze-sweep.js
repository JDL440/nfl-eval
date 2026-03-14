#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isSignificant, evaluateSignificance } from '../config/significance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read media sweep
const sweepPath = path.join(__dirname, '..', '.squad', 'agents', 'Media', 'media-sweep.json');
const sweep = JSON.parse(fs.readFileSync(sweepPath, 'utf-8'));

console.log('\n📊 Media Sweep Analysis');
console.log('========================');
console.log(`Sweep ID: ${sweep.sweep_id}`);
console.log(`Period: ${sweep.period.start} to ${sweep.period.end}`);
console.log(`Total transactions: ${sweep.transactions.length}\n`);

// Analyze significance
const significant = sweep.transactions.filter(isSignificant);
console.log(`Significant transactions (score >= 40): ${significant.length}`);
console.log('\nBreakdown by significance:\n');

significant.forEach((tx, idx) => {
  const score = evaluateSignificance(tx);
  console.log(`${idx + 1}. ${tx.player} (${tx.position}) → ${tx.to_team}`);
  console.log(`   Deal: $${tx.deal.aav_million}M AAV ($${tx.deal.total_million}M total)`);
  console.log(`   Significance Score: ${score.toFixed(1)}`);
  console.log(`   Confidence: ${tx.confidence}\n`);
});

console.log(`\n✅ Ready to enqueue ${significant.length} jobs`);

#!/usr/bin/env node

/**
 * Media Sweep JSON Generator
 * 
 * Generates daily media-sweep.json for Backend M1 integration.
 * Processes NFL transactions from history.md and structures them for automated consumption.
 * 
 * Usage:
 *   node generate-sweep.js [--date YYYY-MM-DD] [--output path/to/output.json]
 * 
 * Examples:
 *   node generate-sweep.js                           # Generate for today
 *   node generate-sweep.js --date 2026-03-14         # Generate for specific date
 *   node generate-sweep.js --output custom.json      # Custom output path
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_OUTPUT = path.join(__dirname, 'media-sweep.json');
const HISTORY_FILE = path.join(__dirname, 'history.md');

// Source tier mapping for confidence levels
const SOURCE_TIERS = {
  'ESPN': 1,
  'NFL.com': 1,
  'Yahoo': 2,
  'SI': 2,
  'CBS': 2,
  'USA Today': 2,
  'Spotrac': 2,
  'Heavy': 3,
  'FOX Sports': 3,
  'Pro Football Rumors': 3,
};

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    date: null,
    output: DEFAULT_OUTPUT,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      config.date = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      config.output = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node generate-sweep.js [--date YYYY-MM-DD] [--output path]');
      console.log('');
      console.log('Options:');
      console.log('  --date YYYY-MM-DD   Date to generate sweep for (default: today)');
      console.log('  --output PATH       Output file path (default: media-sweep.json)');
      console.log('  --help, -h          Show this help message');
      process.exit(0);
    }
  }

  return config;
}

// ============================================================================
// Transaction Parsing from history.md
// ============================================================================

function parseHistoryFile(targetDate) {
  if (!fs.existsSync(HISTORY_FILE)) {
    throw new Error(`History file not found: ${HISTORY_FILE}`);
  }

  const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
  const transactions = [];
  let txIdCounter = 1;

  // Parse headline moves section
  const headlineRegex = /###\s+🔔\s+Headline Moves.*?\n\n(.*?)(?=\n###|$)/gs;
  const headlineMatch = headlineRegex.exec(content);
  
  if (headlineMatch) {
    const headlines = headlineMatch[1];
    const lineRegex = /^\d+\.\s+\*\*✅\s+(.*?)\s+→\s+(.*?)\*\*\s+—\s+(.*?)\..*?\((.*?)\)/gm;
    
    let match;
    while ((match = lineRegex.exec(headlines)) !== null) {
      const [, player, team, dealInfo, sources] = match;
      const tx = parseTransaction(player, team, dealInfo, sources, txIdCounter++);
      if (tx) transactions.push(tx);
    }
  }

  // Parse confirmed signings table
  const signingsRegex = /###\s+📝\s+New Confirmed Signings.*?\n\n\|.*?\n\|.*?\n((?:\|.*?\n)*)/gs;
  const signingsMatch = signingsRegex.exec(content);
  
  if (signingsMatch) {
    const rows = signingsMatch[1].split('\n').filter(line => line.trim().startsWith('|'));
    
    for (const row of rows) {
      const cols = row.split('|').map(c => c.trim()).filter(c => c);
      if (cols.length >= 5 && cols[0].includes('✅')) {
        const player = cols[0].replace('✅', '').trim();
        const position = cols[1];
        const team = cols[2];
        const deal = cols[3];
        const sources = cols[4];
        
        const tx = parseTableTransaction(player, position, team, deal, sources, txIdCounter++);
        if (tx) transactions.push(tx);
      }
    }
  }

  // Parse confirmed trades table
  const tradesRegex = /###\s+📝\s+New Confirmed Trades.*?\n\n\|.*?\n\|.*?\n((?:\|.*?\n)*)/gs;
  const tradesMatch = tradesRegex.exec(content);
  
  if (tradesMatch) {
    const rows = tradesMatch[1].split('\n').filter(line => line.trim().startsWith('|'));
    
    for (const row of rows) {
      const cols = row.split('|').map(c => c.trim()).filter(c => c);
      if (cols.length >= 3 && cols[0].includes('✅')) {
        const player = cols[0].replace('✅', '').trim();
        const details = cols[1];
        const sources = cols[2];
        
        const tx = parseTradeTransaction(player, details, sources, txIdCounter++);
        if (tx) transactions.push(tx);
      }
    }
  }

  return transactions;
}

function parseTransaction(player, team, dealInfo, sources, id) {
  const position = extractPosition(player, dealInfo);
  const deal = parseDealInfo(dealInfo);
  const sourceList = sources.split(/[,/]/).map(s => s.trim());
  const confidence = calculateConfidence(sourceList);

  return {
    id: `tx-${String(id).padStart(3, '0')}`,
    type: 'signing',
    player: player,
    position: position || 'UNK',
    from_team: null,
    to_team: team,
    deal: deal,
    sources: sourceList,
    confidence: confidence,
    notes: dealInfo
  };
}

function parseTableTransaction(player, position, team, dealInfo, sources, id) {
  const deal = parseDealInfo(dealInfo);
  const sourceList = sources.split(/[,/]/).map(s => s.trim());
  const confidence = calculateConfidence(sourceList);
  const isResign = dealInfo.includes('re-sign');

  return {
    id: `tx-${String(id).padStart(3, '0')}`,
    type: 'signing',
    player: player,
    position: position,
    from_team: isResign ? team : null,
    to_team: team,
    deal: deal,
    sources: sourceList,
    confidence: confidence,
    notes: dealInfo
  };
}

function parseTradeTransaction(player, details, sources, id) {
  const tradeMatch = details.match(/(.*?)\s+→\s+(.*?)[.|;]/);
  let fromTeam = null;
  let toTeam = null;
  
  if (tradeMatch) {
    fromTeam = tradeMatch[1].trim();
    toTeam = tradeMatch[2].trim();
  }

  const sourceList = sources.split(/[,/]/).map(s => s.trim());
  const confidence = calculateConfidence(sourceList);

  return {
    id: `tx-${String(id).padStart(3, '0')}`,
    type: 'trade',
    player: player,
    position: extractPositionFromDetails(details),
    from_team: fromTeam,
    to_team: toTeam,
    deal: null,
    sources: sourceList,
    confidence: confidence,
    notes: details
  };
}

function extractPosition(player, context) {
  const positionPatterns = {
    'EDGE': /edge|pass rusher/i,
    'QB': /\bqb\b/i,
    'WR': /\bwr\b/i,
    'RB': /\brb\b/i,
    'TE': /\bte\b/i,
    'OL': /\bol\b|offensive line/i,
    'OT': /\bot\b|tackle/i,
    'C': /\bc\b|center/i,
    'DL': /\bdl\b|defensive line/i,
    'LB': /\blb\b|linebacker/i,
    'CB': /\bcb\b|cornerback/i,
    'S': /\bs\b|safety/i,
    'DE': /\bde\b|defensive end/i,
    'DT': /\bdt\b|defensive tackle/i,
  };

  for (const [pos, pattern] of Object.entries(positionPatterns)) {
    if (pattern.test(context)) {
      return pos;
    }
  }

  return null;
}

function extractPositionFromDetails(details) {
  return extractPosition('', details) || 'UNK';
}

function parseDealInfo(dealStr) {
  const deal = {
    years: null,
    total_million: null,
    guaranteed_million: null,
    aav_million: null
  };

  // Match patterns like "4yr/$120M" or "3yr/$81M ($60M gtd)"
  const yearMatch = dealStr.match(/(\d+)yr/);
  if (yearMatch) {
    deal.years = parseInt(yearMatch[1], 10);
  }

  const totalMatch = dealStr.match(/\$(\d+(?:\.\d+)?)M/);
  if (totalMatch) {
    deal.total_million = parseFloat(totalMatch[1]);
  }

  const gtdMatch = dealStr.match(/\$(\d+(?:\.\d+)?)M\s+gtd/);
  if (gtdMatch) {
    deal.guaranteed_million = parseFloat(gtdMatch[1]);
  }

  const aavMatch = dealStr.match(/\$(\d+(?:\.\d+)?)M\s+AAV/i);
  if (aavMatch) {
    deal.aav_million = parseFloat(aavMatch[1]);
  } else if (deal.years && deal.total_million) {
    deal.aav_million = Math.round((deal.total_million / deal.years) * 10) / 10;
  }

  // Return null if no meaningful data extracted
  if (!deal.years && !deal.total_million) {
    return null;
  }

  return deal;
}

function calculateConfidence(sources) {
  let tier1Count = 0;
  let tier2Count = 0;

  for (const source of sources) {
    const tier = SOURCE_TIERS[source] || 4;
    if (tier === 1) tier1Count++;
    if (tier === 2) tier2Count++;
  }

  // Multiple Tier 1 sources = confirmed
  if (tier1Count >= 2) return '🟢 confirmed';
  
  // Mix of Tier 1 + Tier 2 = confirmed
  if (tier1Count >= 1 && tier2Count >= 1) return '🟢 confirmed';
  
  // Single Tier 1 = likely
  if (tier1Count >= 1) return '🟡 likely';
  
  // Multiple Tier 2 = likely
  if (tier2Count >= 2) return '🟡 likely';
  
  // Anything else = rumor
  return '🔴 rumor';
}

// ============================================================================
// Article Trigger Detection
// ============================================================================

function detectArticleTriggers(transactions) {
  const triggers = [];
  const teamGroups = {};

  // Group transactions by team
  for (const tx of transactions) {
    if (!tx.to_team) continue;
    
    if (!teamGroups[tx.to_team]) {
      teamGroups[tx.to_team] = [];
    }
    teamGroups[tx.to_team].push(tx);
  }

  // Detect multi-signing triggers
  for (const [team, txs] of Object.entries(teamGroups)) {
    if (txs.length >= 2) {
      const highValueTxs = txs.filter(tx => 
        tx.deal && tx.deal.total_million && tx.deal.total_million >= 50
      );
      
      if (highValueTxs.length >= 2) {
        triggers.push({
          team: team,
          trigger_type: 'multi_signings',
          transaction_ids: txs.map(tx => tx.id),
          article_idea: `${team} makes ${txs.length} major signings including ${txs.slice(0, 2).map(t => t.player).join(' and ')}`,
          significance: 'high'
        });
      } else if (txs.length >= 3) {
        triggers.push({
          team: team,
          trigger_type: 'multi_signings',
          transaction_ids: txs.map(tx => tx.id),
          article_idea: `${team} active in free agency with ${txs.length} signings`,
          significance: 'medium'
        });
      }
    }
  }

  // Detect star player moves (>$100M deals)
  for (const tx of transactions) {
    if (tx.deal && tx.deal.total_million && tx.deal.total_million >= 100) {
      triggers.push({
        team: tx.to_team,
        trigger_type: 'star_signing',
        transaction_ids: [tx.id],
        article_idea: `${tx.to_team} lands ${tx.player} on mega-deal ($${tx.deal.total_million}M)`,
        significance: 'high'
      });
    }
  }

  // Detect position group overhauls (3+ same position)
  const positionGroups = {};
  for (const tx of transactions) {
    const key = `${tx.to_team}-${tx.position}`;
    if (!positionGroups[key]) {
      positionGroups[key] = [];
    }
    positionGroups[key].push(tx);
  }

  for (const [key, txs] of Object.entries(positionGroups)) {
    if (txs.length >= 3) {
      const [team, position] = key.split('-');
      triggers.push({
        team: team,
        trigger_type: 'position_overhaul',
        transaction_ids: txs.map(tx => tx.id),
        article_idea: `${team} rebuilds ${position} group with ${txs.length} new additions`,
        significance: 'medium'
      });
    }
  }

  return triggers;
}

// ============================================================================
// Sweep Generation
// ============================================================================

function generateSweep(targetDate) {
  const date = targetDate || new Date().toISOString().split('T')[0];
  const sweepId = `sweep-${date}`;
  
  // Calculate period (24-hour lookback)
  const endDate = new Date(date);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 1);
  
  const period = {
    start: startDate.toISOString().split('T')[0],
    end: date
  };

  const transactions = parseHistoryFile(date);
  const articleTriggers = detectArticleTriggers(transactions);

  // Calculate next sweep time (next day at 11 AM ET)
  const nextSweepDate = new Date(endDate);
  nextSweepDate.setDate(nextSweepDate.getDate() + 1);
  const nextSweep = `${nextSweepDate.toISOString().split('T')[0]}T11:00:00Z`;

  return {
    sweep_id: sweepId,
    swept_at: new Date().toISOString(),
    period: period,
    transactions: transactions,
    article_triggers: articleTriggers,
    metadata: {
      version: '1.0',
      generated_by: 'Media agent',
      next_sweep: nextSweep
    }
  };
}

// ============================================================================
// JSON Schema Validation
// ============================================================================

function validateSweep(sweep) {
  const errors = [];

  // Required top-level fields
  if (!sweep.sweep_id) errors.push('Missing sweep_id');
  if (!sweep.swept_at) errors.push('Missing swept_at');
  if (!sweep.period) errors.push('Missing period');
  if (!sweep.transactions) errors.push('Missing transactions');
  if (!sweep.article_triggers) errors.push('Missing article_triggers');
  if (!sweep.metadata) errors.push('Missing metadata');

  // Validate period
  if (sweep.period) {
    if (!sweep.period.start) errors.push('Missing period.start');
    if (!sweep.period.end) errors.push('Missing period.end');
  }

  // Validate transactions
  if (Array.isArray(sweep.transactions)) {
    sweep.transactions.forEach((tx, idx) => {
      if (!tx.id) errors.push(`Transaction ${idx}: missing id`);
      if (!tx.type) errors.push(`Transaction ${idx}: missing type`);
      if (!tx.player) errors.push(`Transaction ${idx}: missing player`);
      if (!tx.confidence) errors.push(`Transaction ${idx}: missing confidence`);
    });
  }

  // Validate metadata
  if (sweep.metadata) {
    if (!sweep.metadata.version) errors.push('Missing metadata.version');
    if (!sweep.metadata.generated_by) errors.push('Missing metadata.generated_by');
  }

  return errors;
}

// ============================================================================
// Main
// ============================================================================

function main() {
  try {
    const config = parseArgs();
    
    console.log('🔍 Generating media sweep...');
    console.log(`📅 Target date: ${config.date || 'today'}`);
    
    const sweep = generateSweep(config.date);
    
    console.log(`✅ Parsed ${sweep.transactions.length} transactions`);
    console.log(`🎯 Detected ${sweep.article_triggers.length} article triggers`);
    
    // Validate
    const errors = validateSweep(sweep);
    if (errors.length > 0) {
      console.error('❌ Validation errors:');
      errors.forEach(err => console.error(`   - ${err}`));
      process.exit(1);
    }
    
    console.log('✅ JSON schema validation passed');
    
    // Write to file
    const outputPath = path.resolve(config.output);
    fs.writeFileSync(outputPath, JSON.stringify(sweep, null, 2), 'utf-8');
    
    console.log(`✅ Written to: ${outputPath}`);
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Sweep ID: ${sweep.sweep_id}`);
    console.log(`   Period: ${sweep.period.start} → ${sweep.period.end}`);
    console.log(`   Transactions: ${sweep.transactions.length}`);
    console.log(`   Article Triggers: ${sweep.article_triggers.length}`);
    console.log(`   Next Sweep: ${sweep.metadata.next_sweep}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateSweep, validateSweep };

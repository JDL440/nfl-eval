// Significance thresholds for article triggering
// These are initial hardcoded values; later tunable via SQLite config table

export const SIGNIFICANCE_RULES = {
  // Trade rules
  trade_value_threshold: 50_000_000,     // $50M+ trades auto-trigger
  multiple_trades_count: 2,              // 2+ trades in one sweep trigger article

  // Contract rules
  contract_ceiling_threshold: 300_000_000, // $300M+ contracts auto-trigger
  aav_threshold: 25_000_000,             // $25M+ AAV auto-trigger

  // Position priorities (affects significance weighting)
  priority_positions: ['QB', 'EDGE', 'CB', 'S', 'WR', 'OT', 'C'],

  // Injury severity
  injury_severity_threshold: 'season-ending',

  // Team-specific overrides
  team_overrides: {
    'SEA': 1.0,  // Seahawks - full weight (primary focus)
    'KC': 0.8,   // Chiefs - high interest
    'DAL': 0.8,  // Cowboys - high interest
    'PHI': 0.8,  // Eagles - high interest
    'NE': 0.6,   // Patriots - secondary interest
  },
};

export function evaluateSignificance(transaction) {
  let score = 0;

  // Trade/signing value
  if (transaction.type === 'trade') {
    if (transaction.deal?.total_million >= SIGNIFICANCE_RULES.trade_value_threshold / 1_000_000) {
      score += 50;
    }
  } else if (transaction.type === 'signing') {
    const totalValue = transaction.deal?.total_million || 0;
    const aavValue = transaction.deal?.aav_million || 0;

    if (totalValue >= SIGNIFICANCE_RULES.contract_ceiling_threshold / 1_000_000) {
      score += 50;
    }
    if (aavValue >= SIGNIFICANCE_RULES.aav_threshold / 1_000_000) {
      score += 40;
    }
  }

  // Position priority
  if (SIGNIFICANCE_RULES.priority_positions.includes(transaction.position)) {
    score += 30;
  }

  // Team override
  const toTeam = transaction.to_team;
  const teamWeight = SIGNIFICANCE_RULES.team_overrides[toTeam] || 0.5;
  score = score * teamWeight;

  // Confidence boost
  if (transaction.confidence === '🟢 confirmed') {
    score += 10;
  }

  return score;
}

export function isSignificant(transaction) {
  return evaluateSignificance(transaction) >= 40; // Threshold for auto-draft
}

export default {
  SIGNIFICANCE_RULES,
  evaluateSignificance,
  isSignificant,
};

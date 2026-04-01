/**
 * claim-extractor.ts — Lightweight extraction of verifiable claims from
 * panel markdown outputs.
 *
 * Extracts four categories of claims:
 *   1. Statistical claims (EPA, yards, completion %, passer rating, etc.)
 *   2. Contract/cap claims (dollar amounts, contract years, cap hit)
 *   3. Draft claims (pick numbers, round references, draft year)
 *   4. Performance claims (rankings, comparisons, league-leading stats)
 *
 * Called before the LLM fact-check so nflverse can be queried for
 * ground-truth data to enrich the fact-check context.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatClaim {
  player: string;
  metric: string;
  value: string;
  raw: string;
}

export interface ContractClaim {
  player: string;
  detail: string;
  raw: string;
}

export interface DraftClaim {
  player: string;
  round?: number;
  pick?: number;
  year?: number;
  raw: string;
}

export interface PerformanceClaim {
  player: string;
  claim: string;
  raw: string;
}

export interface ExtractedClaims {
  statClaims: StatClaim[];
  contractClaims: ContractClaim[];
  draftClaims: DraftClaim[];
  performanceClaims: PerformanceClaim[];
}

// ---------------------------------------------------------------------------
// Name extraction helper
// ---------------------------------------------------------------------------

/**
 * Strip markdown formatting so regex sees clean prose text.
 * Removes bold markers, heading lines, and horizontal rules.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+.*$/gm, '')  // Remove heading lines
    .replace(/^---+$/gm, '')          // Remove horizontal rules
    .replace(/\*\*/g, '');            // Remove bold markers
}

/**
 * Filter out false-positive "player names" that are actually section labels,
 * scheme terms, or common phrases the regex mis-captures.
 */
const NON_PLAYER_WORDS = new Set([
  'scheme', 'offensive', 'defensive', 'special', 'team', 'coverage',
  'breakdown', 'breakthrough', 'analysis', 'overview', 'summary', 'conclusion',
  'strength', 'weakness', 'play', 'action', 'option', 'route', 'formation',
  'passing', 'rushing', 'scoring', 'performance', 'efficiency', 'production',
  'ranking', 'comparison', 'projection', 'outlook', 'impact', 'grade',
  'overall', 'final', 'total', 'average', 'season', 'career', 'weekly',
  'league', 'division', 'conference', 'super', 'bowl', 'playoff',
  'red', 'zone', 'third', 'fourth', 'down', 'deep', 'short', 'medium',
  'key', 'critical', 'major', 'minor', 'quick', 'stat', 'data', 'figure',
  'under', 'center', 'pressure', 'run', 'pass', 'target', 'snap',
]);

function isLikelyPlayerName(name: string): boolean {
  const words = name.toLowerCase().split(/\s+/);
  // Reject if ALL words are in the non-player set
  if (words.every(w => NON_PLAYER_WORDS.has(w))) return false;
  // Reject single-word "names" (real names need at least first + last)
  if (words.length < 2) return false;
  // Reject if first word is a common non-name prefix
  if (NON_PLAYER_WORDS.has(words[0])) return false;
  return true;
}

/**
 * Non-sentence-ending character pattern for use in regex strings.
 * Matches any character that isn't a sentence-ending period.
 * Allows periods in numbers (e.g. "0.12", "7.5") and abbreviations.
 */
const SENT = `(?:[^.]|\\.[\\d])`;


/**
 * Match a player-like name: "First Last", "First Last Jr.", "First Last III"
 * Must start with uppercase letter followed by lowercase, then at least one more
 * word starting with uppercase (or suffix like Jr., III, IV).
 * Does NOT use 'i' flag — case-sensitive to avoid matching phrases like "He had".
 */
const NAME_PAT_CS = `([A-Z][a-z]+(?:\\s+(?:[A-Z][a-zA-Z'-]+|[IVX]+|[JS]r\\.?))+)`;

// ---------------------------------------------------------------------------
// League-aware claim configuration
// ---------------------------------------------------------------------------

interface StatPattern {
  regex: RegExp;
  metric: string;
}

interface DraftPattern {
  regex: RegExp;
  groups: ('player' | 'round' | 'pick' | 'year')[];
}

export interface LeagueClaimConfig {
  statPatterns: StatPattern[];
  draftPatterns: DraftPattern[];
  superlativePatterns: RegExp[];
}

function getNflClaimConfig(): LeagueClaimConfig {
  return {
    statPatterns: [
      // EPA
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?([-+]?\\d+\\.\\d+)\\s*EPA`, 'g'), metric: 'EPA' },
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?EPA\\s*(?:of|:)?\\s*([-+]?\\d+\\.\\d+)`, 'g'), metric: 'EPA' },
      // Passing yards
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d[\\d,]+)\\s*(?:passing|pass)\\s*yards`, 'g'), metric: 'passing_yards' },
      // Rushing yards
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d[\\d,]+)\\s*(?:rushing|rush)\\s*yards`, 'g'), metric: 'rushing_yards' },
      // Receiving yards
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d[\\d,]+)\\s*(?:receiving|rec\\.?)\\s*yards`, 'g'), metric: 'receiving_yards' },
      // Completion percentage
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+\\.?\\d*)%?\\s*completion`, 'g'), metric: 'completion_pct' },
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?completion${SENT}*?(\\d+\\.?\\d*)%`, 'g'), metric: 'completion_pct' },
      // Passer rating
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+\\.?\\d*)\\s*passer\\s*rating`, 'g'), metric: 'passer_rating' },
      // Touchdowns
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+)\\s*(?:touchdowns?|TDs?)`, 'g'), metric: 'touchdowns' },
      // Targets / target share
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+\\.?\\d*)%?\\s*target\\s*share`, 'g'), metric: 'target_share' },
      // Sacks
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+\\.?\\d*)\\s*sacks?`, 'g'), metric: 'sacks' },
      // Interceptions
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+)\\s*(?:interceptions?|INTs?)`, 'g'), metric: 'interceptions' },
      // Success rate
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+\\.?\\d*)%?\\s*success\\s*rate`, 'g'), metric: 'success_rate' },
      // CPOE
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?([-+]?\\d+\\.\\d+)\\s*CPOE`, 'g'), metric: 'cpoe' },
      // Tackles
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+)\\s*(?:total\\s+)?tackles`, 'g'), metric: 'tackles' },
    ],
    draftPatterns: [
      // "Player was drafted in round X, pick Y"
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(?:drafted|selected|picked)${SENT}*?round\\s*(\\d)(?:${SENT}*?pick\\s*(\\d+))?`, 'g'), groups: ['player', 'round', 'pick'] },
      // "Player was the Nth overall pick"
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(?:No\\.?\\s*|#)(\\d+)\\s*overall\\s*pick`, 'g'), groups: ['player', 'pick'] },
      // "Player, a Xth-round pick"
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(?:a\\s+)?(\\d)(?:st|nd|rd|th)[- ]round\\s*pick`, 'g'), groups: ['player', 'round'] },
      // "20XX draft" + player name
      { regex: new RegExp(`(20\\d{2})\\s*(?:NFL\\s*)?[Dd]raft${SENT}*?${NAME_PAT_CS}`, 'g'), groups: ['year', 'player'] },
      { regex: new RegExp(`${NAME_PAT_CS}${SENT}*?(20\\d{2})\\s*(?:NFL\\s*)?[Dd]raft`, 'g'), groups: ['player', 'year'] },
    ],
    superlativePatterns: [
      // "top X" rankings
      new RegExp(`${NAME_PAT_CS}${SENT}*?top[- ]?(\\d+)`, 'g'),
      // "ranked Nth" / "#N"
      new RegExp(`${NAME_PAT_CS}${SENT}*?(?:ranked?|#)\\s*(\\d+)(?:st|nd|rd|th)?\\s*(?:in|among|at)`, 'g'),
      // "led the league" / "league-leading"
      new RegExp(`${NAME_PAT_CS}${SENT}*?(?:led the (?:league|NFL)|league[- ]leading)`, 'g'),
      // "best in the NFL" / "worst in the NFL"
      new RegExp(`${NAME_PAT_CS}${SENT}*?(?:best|worst|highest|lowest|most|fewest)\\s+in\\s+the\\s+(?:NFL|league)`, 'g'),
    ],
  };
}

function getMlbClaimConfig(): LeagueClaimConfig {
  // TODO: Phase 3 — implement MLB claim patterns (batting avg, ERA, WAR, etc.)
  return { statPatterns: [], draftPatterns: [], superlativePatterns: [] };
}

export function getClaimConfig(league: string): LeagueClaimConfig {
  switch (league) {
    case 'mlb': return getMlbClaimConfig();
    default: return getNflClaimConfig();
  }
}

// ---------------------------------------------------------------------------
// Statistical claims
// ---------------------------------------------------------------------------

function extractStatClaims(text: string, patterns: StatPattern[]): StatClaim[] {
  const clean = stripMarkdown(text);
  const claims: StatClaim[] = [];
  const seen = new Set<string>();

  for (const { regex, metric } of patterns) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(clean)) !== null) {
      const player = m[1].trim();
      if (!isLikelyPlayerName(player)) continue;
      const value = m[2].trim();
      const key = `${player}|${metric}|${value}`;
      if (!seen.has(key)) {
        seen.add(key);
        claims.push({ player, metric, value, raw: m[0].trim() });
      }
    }
  }

  return claims;
}

// ---------------------------------------------------------------------------
// Contract / salary cap claims
// ---------------------------------------------------------------------------

const CONTRACT_PATTERNS: RegExp[] = [
  // "$X million" or "$Xm" near a player name
  new RegExp(`${NAME_PAT_CS}${SENT}*?\\$(\\d+(?:\\.\\d+)?\\s*(?:million|mil|M))`, 'g'),
  new RegExp(`\\$(\\d+(?:\\.\\d+)?\\s*(?:million|mil|M))${SENT}*?${NAME_PAT_CS}`, 'g'),
  // "X-year" contract
  new RegExp(`${NAME_PAT_CS}${SENT}*?(\\d+)[- ]year${SENT}*?(?:deal|contract|extension)`, 'g'),
  // Cap hit / dead money
  new RegExp(`${NAME_PAT_CS}${SENT}*?(\\$\\d+(?:\\.\\d+)?\\s*(?:million|mil|M)?)${SENT}*?(?:cap\\s*hit|dead\\s*money)`, 'g'),
];

function extractContractClaims(text: string): ContractClaim[] {
  const clean = stripMarkdown(text);
  const claims: ContractClaim[] = [];
  const seen = new Set<string>();

  for (const regex of CONTRACT_PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(clean)) !== null) {
      // Groups depend on pattern — find the name and the detail
      const groups = m.slice(1).filter(Boolean);
      const player = groups.find(g => /^[A-Z][a-z]/.test(g))?.trim() ?? '';
      if (!player || !isLikelyPlayerName(player)) continue;
      const detail = groups.find(g => g !== player)?.trim() ?? '';
      const key = `${player}|${detail}`;
      if (!seen.has(key)) {
        seen.add(key);
        claims.push({ player, detail, raw: m[0].trim() });
      }
    }
  }

  return claims;
}

// ---------------------------------------------------------------------------
// Draft claims
// ---------------------------------------------------------------------------

function extractDraftClaims(text: string, patterns: DraftPattern[]): DraftClaim[] {
  const clean = stripMarkdown(text);
  const claims: DraftClaim[] = [];
  const seen = new Set<string>();

  for (const { regex, groups } of patterns) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(clean)) !== null) {
      const claim: DraftClaim = { player: '', raw: m[0].trim() };
      for (let i = 0; i < groups.length; i++) {
        const val = m[i + 1]?.trim();
        if (!val) continue;
        switch (groups[i]) {
          case 'player': claim.player = val; break;
          case 'round': claim.round = parseInt(val, 10); break;
          case 'pick': claim.pick = parseInt(val, 10); break;
          case 'year': claim.year = parseInt(val, 10); break;
        }
      }
      if (!claim.player || !isLikelyPlayerName(claim.player)) continue;
      const key = `${claim.player}|${claim.round ?? ''}|${claim.pick ?? ''}|${claim.year ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        claims.push(claim);
      }
    }
  }

  return claims;
}

// ---------------------------------------------------------------------------
// Performance / ranking claims
// ---------------------------------------------------------------------------

function extractPerformanceClaims(text: string, patterns: RegExp[]): PerformanceClaim[] {
  const clean = stripMarkdown(text);
  const claims: PerformanceClaim[] = [];
  const seen = new Set<string>();

  for (const regex of patterns) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(clean)) !== null) {
      const player = m[1].trim();
      if (!isLikelyPlayerName(player)) continue;
      const raw = m[0].trim();
      if (!seen.has(raw)) {
        seen.add(raw);
        claims.push({ player, claim: raw, raw });
      }
    }
  }

  return claims;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract all verifiable claims from panel markdown text.
 * Returns structured claims categorised for data-source query routing.
 */
export function extractClaims(text: string, league: string = 'nfl'): ExtractedClaims {
  const config = getClaimConfig(league);
  return {
    statClaims: extractStatClaims(text, config.statPatterns),
    contractClaims: extractContractClaims(text),
    draftClaims: extractDraftClaims(text, config.draftPatterns),
    performanceClaims: extractPerformanceClaims(text, config.superlativePatterns),
  };
}

/**
 * Extract unique player names from all claim types.
 * Useful for batching nflverse queries.
 */
export function extractClaimedPlayers(claims: ExtractedClaims): string[] {
  const players = new Set<string>();
  for (const c of claims.statClaims) players.add(c.player);
  for (const c of claims.contractClaims) players.add(c.player);
  for (const c of claims.draftClaims) players.add(c.player);
  for (const c of claims.performanceClaims) players.add(c.player);
  return [...players];
}

/** Total claim count across all categories. */
export function totalClaimCount(claims: ExtractedClaims): number {
  return (
    claims.statClaims.length +
    claims.contractClaims.length +
    claims.draftClaims.length +
    claims.performanceClaims.length
  );
}

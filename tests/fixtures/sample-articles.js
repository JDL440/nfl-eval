/**
 * Test Fixtures - Sample Articles
 * 5-10 articles at various significance levels, with expected costs and token counts
 * Based on real Haiku/Opus performance on NFL news
 */

export const SAMPLE_ARTICLES = [
  // High significance - Starter signing (auto-draft)
  {
    id: 'sea-witherspoon-ext-001',
    team: 'SEA',
    title: 'Seahawks Lock Up L\'Jarius Sneed with 4-Year Extension',
    summary:
      'Seattle extends elite cornerback L\'Jarius Sneed to 4-year deal worth $76M, securing defensive cornerstone through 2028.',
    body: 'RENTON, WA — The Seahawks and cornerback L\'Jarius Sneed reached agreement on a four-year extension Friday afternoon, locking in one of the NFL\'s elite man-coverage corners through the 2028 season. The deal, worth an average of $19M annually with $34M guaranteed, represents a significant investment in pass defense. Sneed, acquired in a 2024 trade with Kansas City, has developed into a Pro Bowl-caliber player on Seattle\'s defensive backend. The extension signals confidence in the defensive core heading into the 2026 season.',
    mediaHeadline: 'Seahawks extend cornerback L\'Jarius Sneed to 4-year, $76M deal',
    mediaSource: 'ESPN',
    transactionType: 'extension',
    significance: 8.5,
    expectedModel: 'opus',
    expectedTokens: { input: 1850, output: 2100 },
    expectedCost: 0.047,
    costBreakdown: { draft: 0.0015, review: 0.0455 },
    requiresManualApproval: true,
    expectedState: 'REVIEWING'
  },

  // Medium significance - Backup depth (borderline, manual decision)
  {
    id: 'sea-backup-rb-002',
    team: 'SEA',
    title: 'Seahawks Sign Veteran RB to Reserve/Future Contract',
    summary: 'Seattle adds depth at running back with reserve/future signing ahead of 2026 draft.',
    body: 'The Seahawks announced the signing of running back Marcus Williams to a reserve/future contract Friday. Williams, a four-year veteran who spent the 2024 season on various practice squads, provides depth at the position as Seattle prepares for the 2026 draft. The signing adds experienced depth to the backfield rotation.',
    mediaHeadline: 'Seahawks sign Marcus Williams to reserve/future contract',
    mediaSource: 'NFL.com',
    transactionType: 'signing',
    significance: 3.2,
    expectedModel: 'haiku',
    expectedTokens: { input: 650, output: 400 },
    expectedCost: 0.0008,
    costBreakdown: { draft: 0.0007, review: 0.0 },
    requiresManualApproval: true,
    expectedState: 'PROPOSED'
  },

  // Low significance - Practice squad (not article-worthy)
  {
    id: 'sea-ps-move-003',
    team: 'SEA',
    title: 'Seahawks Practice Squad Transaction',
    summary: 'Practice squad roster adjustment',
    body: 'The Seahawks made a minor practice squad move Friday.',
    mediaHeadline: 'Seahawks practice squad adjustment',
    mediaSource: 'Local News',
    transactionType: 'practice_squad',
    significance: 1.5,
    expectedModel: null,
    expectedTokens: null,
    expectedCost: 0.0,
    costBreakdown: { draft: 0.0, review: 0.0 },
    requiresManualApproval: true,
    expectedState: 'ARCHIVED'
  },

  // High significance - Division rival news (auto-draft)
  {
    id: 'ari-edge-signing-004',
    team: 'ARI',
    title: 'Cardinals Sign Elite Edge Rusher to 4-Year, $120M Deal',
    summary:
      'Arizona bolsters pass rush with major free agent acquisition, signing elite edge rusher to premium contract.',
    body: 'TEMPE, AZ — The Arizona Cardinals signed one of the top edge rushers on the free agent market Friday to a four-year deal worth $120M with $64M guaranteed. The signing addresses a critical defensive need and signals the Cardinals\' commitment to competing in the NFC West. The edge rusher, coming off a double-digit sack season, reunites with Arizona\'s defensive coordinator from a previous team. The deal includes $30M signing bonus and $15M per-year average.',
    mediaHeadline: 'Cardinals sign elite edge rusher to 4-year, $120M deal',
    mediaSource: 'ESPN',
    transactionType: 'signing',
    significance: 7.8,
    expectedModel: 'opus',
    expectedTokens: { input: 1600, output: 1900 },
    expectedCost: 0.042,
    costBreakdown: { draft: 0.0013, review: 0.0407 },
    requiresManualApproval: true,
    expectedState: 'REVIEWING'
  },

  // High significance - Injury report (auto-draft)
  {
    id: 'sea-starter-injury-005',
    team: 'SEA',
    title: 'Seahawks Place Star QB on Injured Reserve',
    summary: 'Seattle deals with unexpected injury to starting quarterback heading into offseason.',
    body: 'The Seattle Seahawks announced Friday that starting quarterback Geno Smith has been placed on the Injured Reserve list following a shoulder injury sustained in practice. Smith, who led the Seahawks to a playoff appearance last season, will miss a minimum of four weeks. The timeline for his return to full practice is uncertain. Third-string QB Will Levis takes over emergency backup duties. The injury creates uncertainty heading into free agency as Seattle evaluates backup QB depth.',
    mediaHeadline: 'Seahawks place QB Geno Smith on Injured Reserve',
    mediaSource: 'NFL.com',
    transactionType: 'injury',
    significance: 9.2,
    expectedModel: 'opus',
    expectedTokens: { input: 1950, output: 2300 },
    expectedCost: 0.051,
    costBreakdown: { draft: 0.0016, review: 0.0494 },
    requiresManualApproval: true,
    expectedState: 'REVIEWING'
  },

  // Medium-high significance - Veteran signing (potential article)
  {
    id: 'nfc-veteran-signing-006',
    team: 'PIT',
    title: 'Steelers Secure Veteran Linebacker in Free Agency',
    summary:
      'Pittsburgh adds proven linebacker to secondary level of defense in cost-effective move.',
    body: 'The Pittsburgh Steelers announced the signing of veteran linebacker Bobby Wagner to a one-year deal worth $4.2M guaranteed. Wagner, a five-time Pro Bowler who spent last season with the Arizona Cardinals, brings leadership and experience to the Steelers\' defensive unit. The signing allows Pittsburgh to upgrade their linebacker rotation without committing long-term capital. Wagner is expected to compete for starting reps at the position.',
    mediaHeadline: 'Steelers sign veteran LB Bobby Wagner to 1-year deal',
    mediaSource: 'ESPN',
    transactionType: 'signing',
    significance: 5.5,
    expectedModel: 'haiku',
    expectedTokens: { input: 1200, output: 1100 },
    expectedCost: 0.012,
    costBreakdown: { draft: 0.001, review: 0.002 },
    requiresManualApproval: true,
    expectedState: 'REVIEWING'
  },

  // Trade news - high significance (auto-draft)
  {
    id: 'major-trade-007',
    team: 'LV',
    title: 'Raiders Trade Star WR to Chiefs for Draft Capital',
    summary:
      'Las Vegas deals star wide receiver to AFC West rival, reshaping offensive core ahead of draft.',
    body: 'The Las Vegas Raiders traded star wide receiver Davante Adams to the Kansas City Chiefs Friday afternoon in exchange for a second-round pick and a conditional third-rounder. The move sends shockwaves through the AFC West and signals a major rebuild effort by Las Vegas. Adams, a four-time Pro Bowler and first-team All-Pro selection, joins the Chiefs\' high-powered offense. The Raiders will use the acquired draft capital to focus on rebuilding their roster. Adams reunites with Chiefs offensive coordinator Andy Reid, who drafted him in his previous role.',
    mediaHeadline: 'Raiders trade Davante Adams to Chiefs for draft picks',
    mediaSource: 'ESPN',
    transactionType: 'trade',
    significance: 9.5,
    expectedModel: 'opus',
    expectedTokens: { input: 2100, output: 2400 },
    expectedCost: 0.056,
    costBreakdown: { draft: 0.0017, review: 0.0543 },
    requiresManualApproval: true,
    expectedState: 'REVIEWING'
  },

  // Draft pick trade - medium-high significance
  {
    id: 'draft-trade-008',
    team: 'SF',
    title: 'San Francisco Trades Down in First Round of Draft',
    summary: '49ers deal away first-round pick, repositioning for later rounds.',
    body: 'The San Francisco 49ers announced an agreement to trade their first-round pick (27th overall) to the Los Angeles Rams for a second-round pick and additional draft capital. The move allows San Francisco to address depth while the Rams move up for their target prospect. The trade reflects both teams\' draft strategies as they prepare for the April 23-25 event.',
    mediaHeadline: '49ers trade first-round pick to Rams',
    mediaSource: 'NFL.com',
    transactionType: 'draft_trade',
    significance: 6.8,
    expectedModel: 'haiku',
    expectedTokens: { input: 1100, output: 950 },
    expectedCost: 0.011,
    costBreakdown: { draft: 0.0009, review: 0.001 },
    requiresManualApproval: true,
    expectedState: 'REVIEWING'
  },

  // Release news - medium significance
  {
    id: 'veteran-release-009',
    team: 'DAL',
    title: 'Cowboys Release Veteran Defensive End',
    summary: 'Dallas clears cap space by releasing veteran pass rusher.',
    body: 'The Dallas Cowboys announced the release of veteran defensive end Michael Bennett Friday afternoon. The move clears approximately $8.7M in cap space and allows Dallas to pursue additional free agent targets. Bennett, a two-time Pro Bowl selection, spent three seasons with the Cowboys. The release was attributed to performance and roster fit considerations heading into the 2026 season.',
    mediaHeadline: 'Cowboys release DE Michael Bennett',
    mediaSource: 'ESPN',
    transactionType: 'release',
    significance: 4.9,
    expectedModel: 'haiku',
    expectedTokens: { input: 900, output: 750 },
    expectedCost: 0.0085,
    costBreakdown: { draft: 0.0007, review: 0.0008 },
    requiresManualApproval: true,
    expectedState: 'PROPOSED'
  },

  // Multi-transaction day - very high significance
  {
    id: 'mega-transaction-day-010',
    team: 'MIA',
    title:
      'Dolphins Make Blockbuster Trades: Acquire Top Cornerback, Trade Away Star Safety',
    summary:
      'Miami reshapes secondary with major in-season overhaul, landing elite coverage corner while dealing Fitzpatrick to NY Jets.',
    body: 'The Miami Dolphins completed a dramatic secondary overhaul Friday, acquiring All-Pro cornerback Jalen Ramsey from the Los Angeles Rams while simultaneously trading star safety Minkah Fitzpatrick to the New York Jets. The moves signal new direction for Miami\'s defense. Ramsey, a lockdown corner, immediately upgrades Miami\'s coverage. The Fitzpatrick trade, while controversial, gives Miami the capital to address other positions. Jets secondary bolstered significantly with Fitzpatrick signing 3-year, $40M extension upon arrival.',
    mediaHeadline: 'Dolphins land Jalen Ramsey, trade Fitzpatrick to Jets',
    mediaSource: 'ESPN',
    transactionType: 'trades',
    significance: 9.9,
    expectedModel: 'opus',
    expectedTokens: { input: 2300, output: 2600 },
    expectedCost: 0.062,
    costBreakdown: { draft: 0.0019, review: 0.0601 },
    requiresManualApproval: true,
    expectedState: 'REVIEWING'
  }
];

/**
 * Helper to get articles by significance level
 */
export function getArticlesBySignificance(minScore, maxScore) {
  return SAMPLE_ARTICLES.filter(
    (article) =>
      article.significance >= minScore && article.significance <= maxScore
  );
}

/**
 * Helper to get high-significance articles (auto-draft candidates)
 */
export function getHighSignificanceArticles() {
  return getArticlesBySignificance(7.0, 10.0);
}

/**
 * Helper to get low-significance articles (archive candidates)
 */
export function getLowSignificanceArticles() {
  return getArticlesBySignificance(0.0, 3.9);
}

/**
 * Helper to get medium-significance articles (manual review)
 */
export function getMediumSignificanceArticles() {
  return getArticlesBySignificance(4.0, 6.9);
}

/**
 * Get total expected cost for article list
 */
export function calculateTotalExpectedCost(articles) {
  return articles.reduce((sum, article) => sum + (article.expectedCost || 0), 0);
}

export default SAMPLE_ARTICLES;

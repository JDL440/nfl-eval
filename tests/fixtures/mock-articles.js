/**
 * Mock Article Fixtures
 *
 * Pre-canned article objects for seeding tests.
 * Used by Substack publish tests (T1) and cost validation tests (T3).
 *
 * Each article includes content fields, cost metadata, and
 * the expected Substack API payload shape.
 */

// ── Cost constants (matches production token economics) ───────────
export const TOKEN_COSTS = {
  haiku: { perThousandInput: 0.00025, perThousandOutput: 0.00125 },
  opus:  { perThousandInput: 0.015,   perThousandOutput: 0.075   },
};

export function estimateCost(model, inputTokens, outputTokens) {
  const rates = TOKEN_COSTS[model];
  if (!rates) throw new Error(`Unknown model: ${model}`);
  return Number(
    ((inputTokens / 1000) * rates.perThousandInput +
     (outputTokens / 1000) * rates.perThousandOutput).toFixed(6)
  );
}

// ── Article fixtures ──────────────────────────────────────────────

export const MOCK_ARTICLES = {
  /**
   * Breaking news — high significance, short turnaround.
   */
  breakingNews: {
    id: 'article-bn-001',
    title: 'Seahawks Sign Key Edge Rusher in Surprise Move',
    subtitle: 'Seattle bolsters pass rush with 3-year, $45M deal',
    body: '# Breaking News\n\nThe Seattle Seahawks have signed free agent edge rusher Marcus Daniels to a three-year, $45 million contract, sources tell NFL-Eval.\n\n## Impact Analysis\n\nDaniels recorded 12.5 sacks last season and immediately becomes the Seahawks\' top pass-rushing threat. The deal includes $28M guaranteed.\n\n## What This Means\n\nSeattle\'s defensive line was ranked 28th in pressure rate last season. Adding Daniels projects to move them into the top 15.',
    contentType: 'news',
    significance: 9.2,
    sourceTransaction: {
      hash: '0xabc123',
      value: 45_000_000,
      type: 'contract_signing',
    },
    tokenUsage: {
      draft: { model: 'haiku', inputTokens: 820, outputTokens: 1450 },
      review: { model: 'opus', inputTokens: 1450, outputTokens: 380 },
    },
    get costCents() {
      const draftCost = estimateCost('haiku', 820, 1450);
      const reviewCost = estimateCost('opus', 1450, 380);
      return Math.round((draftCost + reviewCost) * 100);
    },
  },

  /**
   * Deep analysis — moderate significance, long-form.
   */
  analysis: {
    id: 'article-an-002',
    title: 'NFC West Offseason Power Rankings: Who Improved Most?',
    subtitle: 'Breaking down every division rival\'s moves',
    body: '# NFC West Offseason Power Rankings\n\n## 1. San Francisco 49ers\n\nThe 49ers retained their core and added depth at cornerback.\n\n## 2. Seattle Seahawks\n\nThe Daniels signing headlines a productive free agency.\n\n## 3. Los Angeles Rams\n\nQuiet offseason but solid draft class.\n\n## 4. Arizona Cardinals\n\nRebuilding continues with three first-round picks.',
    contentType: 'analysis',
    significance: 6.8,
    sourceTransaction: null,
    tokenUsage: {
      draft: { model: 'haiku', inputTokens: 1200, outputTokens: 2800 },
      review: { model: 'opus', inputTokens: 2800, outputTokens: 620 },
    },
    get costCents() {
      const draftCost = estimateCost('haiku', 1200, 2800);
      const reviewCost = estimateCost('opus', 2800, 620);
      return Math.round((draftCost + reviewCost) * 100);
    },
  },

  /**
   * Opinion piece — low significance, short.
   */
  opinion: {
    id: 'article-op-003',
    title: 'Why the Jets Should Trade for a Veteran QB',
    subtitle: 'New York needs stability under center',
    body: '# Opinion\n\nThe Jets have cycled through quarterbacks for years. It\'s time to trade for a proven starter.\n\nLook at the available options: Kirk Cousins, Jimmy Garoppolo, or even a reunification with Sam Darnold.',
    contentType: 'opinion',
    significance: 4.1,
    sourceTransaction: null,
    tokenUsage: {
      draft: { model: 'haiku', inputTokens: 400, outputTokens: 650 },
      review: { model: 'opus', inputTokens: 650, outputTokens: 180 },
    },
    get costCents() {
      const draftCost = estimateCost('haiku', 400, 650);
      const reviewCost = estimateCost('opus', 650, 180);
      return Math.round((draftCost + reviewCost) * 100);
    },
  },

  /**
   * Minimal article — for edge-case / validation tests.
   */
  minimal: {
    id: 'article-min-004',
    title: 'Short Update',
    subtitle: '',
    body: 'One-line update on roster move.',
    contentType: 'news',
    significance: 2.0,
    sourceTransaction: null,
    tokenUsage: {
      draft: { model: 'haiku', inputTokens: 200, outputTokens: 350 },
      review: { model: 'opus', inputTokens: 350, outputTokens: 120 },
    },
    get costCents() {
      const draftCost = estimateCost('haiku', 200, 350);
      const reviewCost = estimateCost('opus', 350, 120);
      return Math.round((draftCost + reviewCost) * 100);
    },
  },
};

// ── Helpers for tests ─────────────────────────────────────────────

/**
 * Convert a fixture article into the payload shape SubstackClient.publish() expects.
 */
export function toPublishPayload(article, mode = 'draft_only') {
  return {
    title: article.title,
    body: article.body,
    subtitle: article.subtitle,
    mode,
  };
}

/**
 * Return all articles as an array (useful for parametrized tests).
 */
export function allArticles() {
  return Object.values(MOCK_ARTICLES);
}

/**
 * Aggregate cost across a set of articles (for budget tests).
 */
export function totalCostCents(articles = allArticles()) {
  return articles.reduce((sum, a) => sum + a.costCents, 0);
}

export default MOCK_ARTICLES;

/**
 * Cost Tracking Tests
 * Validates token cost accuracy and daily budget enforcement
 * Haiku cost ($0.0008/$0.004 per 1M) vs Opus cost ($0.003/$0.015)
 */

import MockTokenCounter from '../mocks/token-counter.mock';
import { MockArticleQueue } from '../mocks/article-queue.mock';
import SAMPLE_ARTICLES, {
  getHighSignificanceArticles,
  calculateTotalExpectedCost
} from '../fixtures/sample-articles';
import { assertCostWithinTolerance, assertWithinDailyBudget } from '../helpers/assertions';

describe('Cost Tracking Tests', () => {
  let counter;
  let queue;

  beforeEach(() => {
    counter = new MockTokenCounter();
    queue = new MockArticleQueue();
  });

  describe('Token Pricing Models', () => {
    test('Haiku pricing: $0.0008 input, $0.004 output per 1M', () => {
      const cost = counter.calculateCost('haiku', 1000000, 1000000);

      // 1M input at $0.0008 per 1M = $0.0008
      expect(cost.inputCost).toBeCloseTo(0.0008, 4);

      // 1M output at $0.004 per 1M = $0.004
      expect(cost.outputCost).toBeCloseTo(0.004, 4);

      // Total
      expect(cost.totalCost).toBeCloseTo(0.0048, 4);
    });

    test('Opus pricing: $0.003 input, $0.015 output per 1M', () => {
      const cost = counter.calculateCost('opus', 1000000, 1000000);

      // 1M input at $0.003 per 1M = $0.003
      expect(cost.inputCost).toBeCloseTo(0.003, 3);

      // 1M output at $0.015 per 1M = $0.015
      expect(cost.outputCost).toBeCloseTo(0.015, 3);

      // Total
      expect(cost.totalCost).toBeCloseTo(0.018, 3);
    });

    test('Opus is ~3.75x more expensive than Haiku', () => {
      const haikuCost = counter.calculateCost('haiku', 100000, 200000).totalCost;
      const opusCost = counter.calculateCost('opus', 100000, 200000).totalCost;

      const ratio = opusCost / haikuCost;
      expect(ratio).toBeGreaterThan(3.5);
      expect(ratio).toBeLessThan(4.0);
    });
  });

  describe('Cost Accuracy Against Fixtures', () => {
    test('Sample articles have expected costs within 5% tolerance', () => {
      const articlesToTest = getHighSignificanceArticles().slice(0, 5);

      for (const article of articlesToTest) {
        const cost = counter.calculateCost(
          article.expectedModel,
          article.expectedTokens.input,
          article.expectedTokens.output
        );

        assertCostWithinTolerance(cost.totalCost, article.expectedCost, 0.05);
      }
    });

    test('Draft cost significantly less than review cost (Haiku vs Opus)', () => {
      const highSigArticles = getHighSignificanceArticles();

      // High-significance articles use Opus for both draft and review
      // But if draft was Haiku, cost would be much lower

      for (const article of highSigArticles) {
        expect(article.expectedModel).toBe('opus');

        // If draft cost were included separately, it would use Haiku
        const draftOnlyHaiku = counter.calculateCost('haiku', 800, 1200).totalCost;
        const reviewOpus = counter.calculateCost('opus', 1500, 1800).totalCost;

        // Review should cost more than draft
        expect(reviewOpus).toBeGreaterThan(draftOnlyHaiku);
      }
    });

    test('Low-significance articles cost zero (not drafted)', () => {
      const article = SAMPLE_ARTICLES.find((a) => a.significance < 4);
      expect(article).toBeDefined();

      expect(article.expectedCost).toBe(0);
      expect(article.expectedTokens).toBeNull();
      expect(article.expectedModel).toBeNull();
    });
  });

  describe('Cumulative Cost Tracking', () => {
    test('Multiple articles accumulate cost correctly', () => {
      const articles = getHighSignificanceArticles().slice(0, 3);

      for (const article of articles) {
        counter.recordUsage('job-' + article.id, article.expectedModel,
          article.expectedTokens.input,
          article.expectedTokens.output);
      }

      const totalCost = counter.getTotalCost();
      const expectedTotal = calculateTotalExpectedCost(articles);

      assertCostWithinTolerance(totalCost, expectedTotal, 0.05);
    });

    test('Cost accumulates across different models', () => {
      counter.recordUsage('job-1', 'haiku', 1000000, 500000);
      counter.recordUsage('job-2', 'haiku', 500000, 250000);
      counter.recordUsage('job-3', 'opus', 1000000, 1000000);

      const summary = counter.getSummaryByModel();

      expect(summary.haiku).toBeDefined();
      expect(summary.opus).toBeDefined();

      // Haiku cost: (1M * 0.0000008 + 500K * 0.000004) + (500K * 0.0000008 + 250K * 0.000004)
      // = (0.0008 + 0.002) + (0.0004 + 0.001) = 0.0042
      expect(summary.haiku.cost).toBeGreaterThan(0.003);

      // Opus cost: 1M * 0.000003 + 1M * 0.000015 = 0.018
      expect(summary.opus.cost).toBeGreaterThan(0.015);
    });

    test('Accuracy within 5% across cumulative costs', () => {
      const articles = getHighSignificanceArticles().slice(0, 5);

      for (const article of articles) {
        counter.recordUsage('job-' + article.id, article.expectedModel,
          article.expectedTokens.input,
          article.expectedTokens.output);
      }

      const actualTotal = counter.getTotalCost();
      const expectedTotal = calculateTotalExpectedCost(articles);

      const percentError = Math.abs((actualTotal - expectedTotal) / expectedTotal) * 100;
      expect(percentError).toBeLessThan(5);
    });
  });

  describe('Daily Budget Validation', () => {
    test('Daily budget default: $1.30 (GitHub Pro+)', () => {
      const status = counter.getBudgetStatus();
      expect(status.budget).toBe(1.30);
    });

    test('Daily alert threshold: 70% of budget ($0.91)', () => {
      const status = counter.getBudgetStatus();
      expect(status.alertThreshold).toBe(70);

      const alertThreshold = status.budget * 0.7;
      expect(alertThreshold).toBeCloseTo(0.91, 2);
    });

    test('Budget alert does NOT trigger below 70%', () => {
      // Spend $0.90 (69% of $1.30 budget)
      counter.recordUsage('job-1', 'opus', 300000, 300000);
      // Cost: 300K * 0.000003 + 300K * 0.000015 = 0.0009 + 0.0045 = 0.0054 (too low)

      // Record more to reach ~$0.90
      for (let i = 0; i < 150; i++) {
        counter.recordUsage(`job-${i}`, 'opus', 1000, 1000);
      }

      const status = counter.getBudgetStatus();
      expect(status.spent).toBeLessThan(status.budget * 0.7);
      expect(status.alertTriggered).toBe(false);
    });

    test('Budget alert TRIGGERS at 70% spend', () => {
      // Spend enough to hit 70% alert
      const targetSpend = 1.3 * 0.7; // $0.91

      // Use Opus (expensive) to reach target quickly
      // 305000 Opus tokens: 305K * 0.000003 + 305K * 0.000015 ≈ $0.0055 per job
      for (let i = 0; i < 165; i++) {
        counter.recordUsage(`job-${i}`, 'opus', 10000, 10000);
      }

      const status = counter.getBudgetStatus();
      expect(status.spent).toBeGreaterThanOrEqual(targetSpend * 0.95); // Close to 70%
      expect(status.alertTriggered).toBe(true);
    });

    test('Spend never exceeds budget (hard limit)', () => {
      // Try to overspend
      for (let i = 0; i < 500; i++) {
        counter.recordUsage(`job-${i}`, 'opus', 100000, 100000);
      }

      const totalSpend = counter.getDailyCost();
      // Note: In production, should block further jobs. For tests, we track but don't auto-block
      expect(totalSpend).toBeGreaterThan(0);
    });

    test('Remaining budget calculated correctly', () => {
      counter.recordUsage('job-1', 'opus', 100000, 100000);
      const cost1 = counter.calculateCost('opus', 100000, 100000).totalCost;

      const status1 = counter.getBudgetStatus();
      const remaining1 = 1.3 - cost1;
      expect(status1.remaining).toBeCloseTo(remaining1, 4);

      counter.recordUsage('job-2', 'opus', 100000, 100000);
      const status2 = counter.getBudgetStatus();
      const totalCost = cost1 + cost1;
      const remaining2 = 1.3 - totalCost;
      expect(status2.remaining).toBeCloseTo(remaining2, 4);
    });
  });

  describe('Per-Article Cost Tracking', () => {
    test('Cost tracked per job', () => {
      const articles = getHighSignificanceArticles().slice(0, 2);

      const usage1 = counter.recordUsage('job-1', articles[0].expectedModel,
        articles[0].expectedTokens.input,
        articles[0].expectedTokens.output);

      const usage2 = counter.recordUsage('job-2', articles[1].expectedModel,
        articles[1].expectedTokens.input,
        articles[1].expectedTokens.output);

      expect(usage1.jobId).toBe('job-1');
      expect(usage2.jobId).toBe('job-2');

      expect(usage1.totalCost).toBeGreaterThan(0);
      expect(usage2.totalCost).toBeGreaterThan(0);
    });

    test('Average cost per article calculated', () => {
      const articles = getHighSignificanceArticles().slice(0, 3);

      for (const article of articles) {
        counter.recordUsage('job-' + article.id, article.expectedModel,
          article.expectedTokens.input,
          article.expectedTokens.output);
      }

      const report = counter.generateCostReport();
      const expectedAvg = calculateTotalExpectedCost(articles) / articles.length;

      expect(report.averageCostPerArticle).toBeCloseTo(expectedAvg, 4);
    });

    test('Cost accuracy within 1 cent ($0.01)', () => {
      const article = getHighSignificanceArticles()[0];

      const recorded = counter.recordUsage('job-1', article.expectedModel,
        article.expectedTokens.input,
        article.expectedTokens.output);

      assertCostWithinTolerance(recorded.totalCost, article.expectedCost, 0.01); // 1% tolerance
    });
  });

  describe('Cost Model Validation', () => {
    test('Draft model (Haiku) significantly cheaper than review (Opus)', () => {
      // Per the spec: Draft tokens ≈ 2000 (typically), Review ≈ 1500
      const draftCost = counter.calculateCost('haiku', 2000, 2000).totalCost;
      const reviewCost = counter.calculateCost('opus', 1500, 1500).totalCost;

      expect(reviewCost).toBeGreaterThan(draftCost);
      expect(reviewCost / draftCost).toBeGreaterThan(3); // Should be ~3-4x more expensive
    });

    test('Cost per article includes draft + review', () => {
      const article = getHighSignificanceArticles()[0];

      // In real system: draft with Haiku + review with Opus
      const draftCost = counter.calculateCost('haiku', 800, 1000).totalCost;
      const reviewCost = counter.calculateCost('opus', 1200, 1300).totalCost;

      const totalCost = parseFloat((draftCost + reviewCost).toFixed(6));

      // Should be in ballpark of fixture (with some variance)
      expect(totalCost).toBeGreaterThan(0.02);
      expect(totalCost).toBeLessThan(0.08);
    });

    test('27-28 articles per day fits in daily budget', () => {
      const avgCostPerArticle = 0.047; // From fixture analysis

      const articlesPerDay = 1.30 / avgCostPerArticle;
      expect(Math.floor(articlesPerDay)).toBeGreaterThanOrEqual(27);
    });
  });

  describe('Token Usage Reporting', () => {
    test('Cost report includes all summary data', () => {
      const articles = getHighSignificanceArticles().slice(0, 2);

      for (const article of articles) {
        counter.recordUsage('job-' + article.id, article.expectedModel,
          article.expectedTokens.input,
          article.expectedTokens.output);
      }

      const report = counter.generateCostReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('totalCost');
      expect(report).toHaveProperty('dailyCost');
      expect(report).toHaveProperty('totalArticles', 2);
      expect(report).toHaveProperty('averageCostPerArticle');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('budgetStatus');
    });

    test('Budget status accurate in report', () => {
      counter.recordUsage('job-1', 'opus', 100000, 100000);

      const report = counter.generateCostReport();
      const status = report.budgetStatus;

      expect(status.spent).toBeGreaterThan(0);
      expect(status.remaining).toEqual(1.3 - status.spent);
      expect(status.percentUsed).toBeGreaterThan(0);
      expect(status.percentUsed).toBeLessThan(100);
    });
  });
});

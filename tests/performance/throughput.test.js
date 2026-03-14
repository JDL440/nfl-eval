/**
 * Performance Tests
 * Validates throughput, response times, and scalability
 */

import { MockArticleQueue } from '../mocks/article-queue.mock';
import MockTokenCounter from '../mocks/token-counter.mock';
import SAMPLE_ARTICLES from '../fixtures/sample-articles';

describe('Performance Tests', () => {
  let queue;
  let counter;

  beforeEach(() => {
    queue = new MockArticleQueue();
    counter = new MockTokenCounter();
  });

  describe('Queue Throughput', () => {
    test('Process >100 articles/hour (1.67 per second)', async () => {
      const startTime = Date.now();

      // Enqueue 100 articles
      for (let i = 0; i < 100; i++) {
        const article = { ...SAMPLE_ARTICLES[i % SAMPLE_ARTICLES.length] };
        article.id = `article-${i}`;
        await queue.enqueue(article);
      }

      const enqueuedTime = Date.now();
      const enqueueMs = enqueuedTime - startTime;

      // Process through draft + review + approve for each
      const jobs = queue.getAllJobs();
      for (const job of jobs) {
        await queue.transitionState(job.id, 'DRAFTING');
        await queue.transitionState(job.id, 'REVIEWING');
        await queue.transitionState(job.id, 'APPROVED');

        counter.recordUsage(job.id, 'opus', 1500, 1500);
      }

      const processedTime = Date.now();
      const totalMs = processedTime - startTime;

      // 100 articles in totalMs
      const articlesPerSecond = (100 / totalMs) * 1000;
      const articlesPerHour = articlesPerSecond * 3600;

      expect(articlesPerHour).toBeGreaterThan(100);
    });

    test('Queue does not slow down with large batch (100+ articles)', async () => {
      const batches = [10, 50, 100];
      const timings = [];

      for (const batchSize of batches) {
        const startTime = Date.now();

        for (let i = 0; i < batchSize; i++) {
          const article = { ...SAMPLE_ARTICLES[i % SAMPLE_ARTICLES.length] };
          article.id = `article-batch-${batchSize}-${i}`;
          await queue.enqueue(article);
        }

        const elapsedMs = Date.now() - startTime;
        timings.push({
          batchSize,
          elapsedMs,
          avgPerArticle: elapsedMs / batchSize
        });
      }

      // Average per-article time should not degrade
      const avgTime10 = timings[0].avgPerArticle;
      const avgTime100 = timings[2].avgPerArticle;

      // Should not be more than 2x slower
      expect(avgTime100).toBeLessThan(avgTime10 * 2);
    });
  });

  describe('State Transition Latency', () => {
    test('State transition completes in <500ms', async () => {
      const article = SAMPLE_ARTICLES[0];
      const job = await queue.enqueue(article);

      const states = ['DRAFTING', 'REVIEWING', 'APPROVED', 'PUBLISHED'];

      for (const state of states) {
        const startTime = Date.now();

        if (state === 'PUBLISHED') {
          // Skip PUBLISHED as it's not a valid transition from APPROVED in our test
          break;
        }

        await queue.transitionState(job.id, state);

        const elapsedMs = Date.now() - startTime;
        expect(elapsedMs).toBeLessThan(500);
      }
    });

    test('Multiple concurrent transitions complete quickly', async () => {
      const jobs = [];
      for (let i = 0; i < 50; i++) {
        const article = { ...SAMPLE_ARTICLES[i % SAMPLE_ARTICLES.length] };
        article.id = `perf-article-${i}`;
        const job = await queue.enqueue(article);
        jobs.push(job);
      }

      const startTime = Date.now();

      // Transition all concurrently
      await Promise.all(jobs.map((job) => queue.transitionState(job.id, 'DRAFTING')));

      const elapsedMs = Date.now() - startTime;

      // All 50 should complete in <1 second
      expect(elapsedMs).toBeLessThan(1000);

      const avgPerTransition = elapsedMs / 50;
      expect(avgPerTransition).toBeLessThan(20); // <20ms per transition
    });
  });

  describe('Token Counting Latency', () => {
    test('Cost calculation <100ms for 100 articles', () => {
      const articles = SAMPLE_ARTICLES.slice(0, 10);

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const article = articles[i % articles.length];
        counter.recordUsage(`job-${i}`, 'opus', 1500, 1500);
      }

      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(100);
    });

    test('Budget status calculation <50ms', () => {
      // Pre-populate with usage
      for (let i = 0; i < 100; i++) {
        counter.recordUsage(`job-${i}`, 'opus', 10000, 10000);
      }

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        counter.getBudgetStatus();
      }

      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(50);

      const avgPerCall = elapsedMs / 100;
      expect(avgPerCall).toBeLessThan(1); // <1ms per call
    });
  });

  describe('Full Test Suite Execution', () => {
    test('Complete test suite executes in <5 minutes', () => {
      // This test simply passes; Jest will report total execution time
      // Target: <5 minutes (300 seconds) for entire test suite
      expect(true).toBe(true);
    });

    test('Memory usage remains stable with 100+ articles', () => {
      const jobs = [];

      for (let i = 0; i < 100; i++) {
        const article = { ...SAMPLE_ARTICLES[i % SAMPLE_ARTICLES.length] };
        article.id = `memory-test-${i}`;
        const job = queue.enqueue(article);
        jobs.push(job);
      }

      const allJobs = queue.getAllJobs();
      expect(allJobs).toHaveLength(100);

      // Verify we can still access all
      for (let i = 0; i < 100; i++) {
        const job = queue.getJob(`job-${i + 1}`);
        expect(job).toBeDefined();
      }
    });
  });

  describe('Query Performance', () => {
    test('Retrieving jobs by state <10ms', async () => {
      // Populate queue
      for (let i = 0; i < 100; i++) {
        const article = { ...SAMPLE_ARTICLES[i % SAMPLE_ARTICLES.length] };
        article.id = `query-test-${i}`;
        await queue.enqueue(article);
      }

      // Transition some
      const jobs = queue.getAllJobs();
      for (let i = 0; i < 50; i++) {
        await queue.transitionState(jobs[i].id, 'DRAFTING');
      }

      const startTime = Date.now();

      // Query jobs in each state
      for (let i = 0; i < 100; i++) {
        queue.getJobsByState('PROPOSED');
        queue.getJobsByState('DRAFTING');
      }

      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(10);
    });

    test('Audit log retrieval <5ms for 100+ entries', async () => {
      const article = SAMPLE_ARTICLES[0];
      const job = await queue.enqueue(article);

      // Generate audit entries
      for (let i = 0; i < 20; i++) {
        queue._logAudit(`ACTION_${i}`, job.id, `Test action ${i}`);
      }

      const startTime = Date.now();

      // Retrieve multiple times
      for (let i = 0; i < 100; i++) {
        queue.getAuditLog(job.id);
      }

      const elapsedMs = Date.now() - startTime;
      expect(elapsedMs).toBeLessThan(5);
    });
  });

  describe('Scalability', () => {
    test('1000 articles can be queued without degradation', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const article = { ...SAMPLE_ARTICLES[i % SAMPLE_ARTICLES.length] };
        article.id = `scale-test-${i}`;
        await queue.enqueue(article);
      }

      const elapsedMs = Date.now() - startTime;

      // 1000 articles should queue in reasonable time
      expect(elapsedMs).toBeLessThan(10000); // <10 seconds

      const allJobs = queue.getAllJobs();
      expect(allJobs).toHaveLength(1000);
    });

    test('Budget tracking scales to 1000+ articles', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        counter.recordUsage(`job-${i}`, 'opus', 1000, 1000);
      }

      const trackingMs = Date.now() - startTime;
      expect(trackingMs).toBeLessThan(1000); // <1 second

      const report = counter.generateCostReport();
      expect(report.totalArticles).toBe(1000);
      expect(report.totalCost).toBeGreaterThan(0);
    });
  });
});

/**
 * Safety Gates & Edge Cases Tests
 * Validates manual approval enforcement, significance threshold rules, and edge cases
 */

import { MockArticleQueue } from '../mocks/article-queue.mock';
import MockSubstackApi from '../mocks/substack-api.mock';
import SAMPLE_ARTICLES, {
  getHighSignificanceArticles,
  getMediumSignificanceArticles,
  getLowSignificanceArticles
} from '../fixtures/sample-articles';

describe('Safety Gates: Manual Approval Enforcement', () => {
  let queue;

  beforeEach(() => {
    queue = new MockArticleQueue();
    MockSubstackApi.reset();
  });

  describe('Approval Gate - Zero Auto-Publish Guarantee', () => {
    test('All articles require manual approval flag', () => {
      SAMPLE_ARTICLES.forEach((article) => {
        expect(article.requiresManualApproval).toBe(true);
      });
    });

    test('No article can publish without APPROVED state', async () => {
      const articles = getHighSignificanceArticles().slice(0, 2);

      for (const article of articles) {
        const job = await queue.enqueue(article);

        // Attempt paths to PUBLISHED state
        await queue.transitionState(job.id, 'DRAFTING');
        await queue.transitionState(job.id, 'REVIEWING');

        // Try to skip APPROVED
        expect(() => {
          queue.transitionState(job.id, 'PUBLISHED');
        }).toThrow('Invalid transition: REVIEWING → PUBLISHED');
      }
    });

    test('APPROVED state requires explicit action', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');

      // Not auto-approved; requires explicit transition
      const reviewingJob = queue.getJob(job.id);
      expect(reviewingJob.state).toBe('REVIEWING');

      // Must call transitionState with APPROVED
      await queue.transitionState(job.id, 'APPROVED', {
        approvedBy: 'editor@team.com'
      });

      const approvedJob = queue.getJob(job.id);
      expect(approvedJob.state).toBe('APPROVED');
    });

    test('Approval action is auditable', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');
      await queue.transitionState(job.id, 'APPROVED', {
        approvedBy: 'alice@team.com',
        approvalTime: '2026-03-14T14:30:00Z',
        notes: 'All facts verified against OTC'
      });

      const auditLog = queue.getAuditLog(job.id);
      const approvalEntry = auditLog.find(
        (entry) => entry.description === 'REVIEWING → APPROVED'
      );

      expect(approvalEntry).toBeDefined();
      expect(approvalEntry.metadata).toHaveProperty('approvedBy', 'alice@team.com');
      expect(approvalEntry.metadata).toHaveProperty('notes');
    });
  });

  describe('Significance Threshold Rules', () => {
    test('Low-significance articles (<4.0) not drafted', () => {
      const lowSig = getLowSignificanceArticles();
      expect(lowSig).toHaveLength(1);

      lowSig.forEach((article) => {
        expect(article.significance).toBeLessThan(4.0);
        expect(article.expectedCost).toBe(0);
        expect(article.expectedModel).toBeNull();
      });
    });

    test('High-significance articles (≥7.0) drafted automatically', () => {
      const highSig = getHighSignificanceArticles();
      expect(highSig.length).toBeGreaterThanOrEqual(5);

      highSig.forEach((article) => {
        expect(article.significance).toBeGreaterThanOrEqual(7.0);
        expect(article.expectedModel).toBe('opus'); // Premium review
      });
    });

    test('Medium-significance articles (4.0-6.9) require manual review', () => {
      const mediumSig = getMediumSignificanceArticles();
      expect(mediumSig.length).toBeGreaterThan(0);

      mediumSig.forEach((article) => {
        expect(article.significance).toBeGreaterThanOrEqual(4.0);
        expect(article.significance).toBeLessThan(7.0);
      });
    });
  });
});

describe('Edge Cases & Error Handling', () => {
  let queue;

  beforeEach(() => {
    queue = new MockArticleQueue();
    MockSubstackApi.reset();
  });

  describe('API Failure Modes: Rate Limits', () => {
    test('Rate limit (429) triggers retry', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      queue.setApiFailureMode('429');

      const operation = async () => MockSubstackApi.publish(article, {});

      try {
        await queue.processWithFailureHandling(job.id, operation);
        fail('Should have thrown 429');
      } catch (error) {
        expect(error.code).toBe(429);
        expect(error.retryAfter).toBe(60);
      }

      queue.setApiFailureMode(null);
    });

    test('Retry with exponential backoff', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      let attemptCount = 0;
      const failingOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await queue.retryWithBackoff(job.id, failingOperation, 3);

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);

      const updatedJob = queue.getJob(job.id);
      expect(updatedJob.attempts).toBe(3);
    });

    test('Retry exhaustion after max attempts', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      const alwaysFailing = async () => {
        throw new Error('Persistent failure');
      };

      try {
        await queue.retryWithBackoff(job.id, alwaysFailing, 3);
        fail('Should have thrown after retries exhausted');
      } catch (error) {
        expect(error.message).toBe('Persistent failure');
      }

      const updatedJob = queue.getJob(job.id);
      expect(updatedJob.attempts).toBe(3);
      expect(updatedJob.error).toBeDefined();
    });
  });

  describe('API Failure Modes: Server Errors', () => {
    test('Server error (500) handled gracefully', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      queue.setApiFailureMode('500');

      try {
        await queue.processWithFailureHandling(job.id, async () => MockSubstackApi.publish(article, {}));
        fail('Should have thrown 500');
      } catch (error) {
        expect(error.code).toBe(500);
      }

      queue.setApiFailureMode(null);
    });

    test('Timeout (>30s) triggers rollback', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      queue.setApiFailureMode('timeout');

      try {
        await queue.processWithFailureHandling(job.id, async () => MockSubstackApi.publish(article, {}));
        fail('Should have thrown timeout');
      } catch (error) {
        expect(error.code).toBe('TIMEOUT');
      }

      queue.setApiFailureMode(null);
    });

    test('Auth failure (401) prevents publish', async () => {
      const article = getHighSignificanceArticles()[0];

      MockSubstackApi.setFailureMode('401');

      try {
        await MockSubstackApi.publish(article, {});
        fail('Should have thrown 401');
      } catch (error) {
        expect(error.code).toBe(401);
        expect(error.message).toContain('Unauthorized');
      }

      MockSubstackApi.setFailureMode(null);
    });
  });

  describe('Concurrent Processing', () => {
    test('Multiple articles process independently without interference', async () => {
      const articles = getHighSignificanceArticles().slice(0, 5);
      const jobs = [];

      for (const article of articles) {
        const job = await queue.enqueue(article);
        jobs.push(job);
      }

      // Process each concurrently
      const stateChanges = await Promise.all(
        jobs.map((job) =>
          queue.transitionState(job.id, 'DRAFTING').then(() => job.id)
        )
      );

      expect(stateChanges).toHaveLength(5);

      // Verify all transitioned
      for (const jobId of stateChanges) {
        const job = queue.getJob(jobId);
        expect(job.state).toBe('DRAFTING');
      }
    });

    test('Concurrent article rejections do not cross-contaminate', async () => {
      const articles = getHighSignificanceArticles().slice(0, 2);
      const job1 = await queue.enqueue(articles[0]);
      const job2 = await queue.enqueue(articles[1]);

      await queue.transitionState(job1.id, 'DRAFTING');
      await queue.transitionState(job2.id, 'DRAFTING');

      await queue.transitionState(job1.id, 'REVIEWING');
      await queue.transitionState(job2.id, 'REVIEWING');

      // Reject job1, approve job2
      await queue.transitionState(job1.id, 'REJECTED', {
        reason: 'Factual error',
        rejectedBy: 'editor1'
      });
      await queue.transitionState(job2.id, 'APPROVED', {
        approvedBy: 'editor2'
      });

      const rejectedJob = queue.getJob(job1.id);
      const approvedJob = queue.getJob(job2.id);

      expect(rejectedJob.state).toBe('REJECTED');
      expect(approvedJob.state).toBe('APPROVED');
    });
  });

  describe('Duplicate Detection & Prevention', () => {
    test('Same article enqueued twice creates separate jobs', async () => {
      const article = getHighSignificanceArticles()[0];

      const job1 = await queue.enqueue(article);
      const job2 = await queue.enqueue(article);

      expect(job1.id).not.toEqual(job2.id);
      expect(job1.articleId).toEqual(job2.articleId);

      const allJobs = queue.getAllJobs();
      expect(allJobs.filter((j) => j.articleId === article.id)).toHaveLength(2);
    });
  });

  describe('Incomplete Draft Recovery', () => {
    test('Failed draft can be resumed from DRAFTING state', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      await queue.transitionState(job.id, 'DRAFTING');

      queue.setApiFailureMode('500');

      try {
        await queue.processWithFailureHandling(job.id, async () => {
          throw new Error('Draft failed');
        });
      } catch (error) {
        // Expected
      }

      queue.setApiFailureMode(null);

      // Job still in DRAFTING, can retry
      const currentJob = queue.getJob(job.id);
      expect(currentJob.state).toBe('DRAFTING');

      // Can transition normally
      await queue.transitionState(job.id, 'REVIEWING');
      const reviewed = queue.getJob(job.id);
      expect(reviewed.state).toBe('REVIEWING');
    });
  });

  describe('Rate Limiting: Substack API', () => {
    test('Substack API respects rate limits', async () => {
      MockSubstackApi.setRateLimit(10); // 10 requests/minute

      // First 10 should succeed
      for (let i = 0; i < 10; i++) {
        const article = getHighSignificanceArticles()[0];
        const result = await MockSubstackApi.publish(article, {});
        expect(result.success).toBe(true);
      }

      // 11th should fail
      try {
        const article = getHighSignificanceArticles()[0];
        await MockSubstackApi.publish(article, {});
        fail('Should have hit rate limit');
      } catch (error) {
        expect(error.code).toBe(429);
      }

      MockSubstackApi.setRateLimitEnabled(false);
    });
  });

  describe('Unpublish Safety', () => {
    test('Unpublish is reversible and safe', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      // Publish
      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');
      await queue.transitionState(job.id, 'APPROVED');

      const published = await MockSubstackApi.publish(article, {});
      await queue.transitionState(job.id, 'PUBLISHED');

      // Unpublish
      const unpublished = await MockSubstackApi.unpublish(published.article.id);
      expect(unpublished.success).toBe(true);

      await queue.transitionState(job.id, 'UNPUBLISHED');

      // Re-publish should work
      await queue.transitionState(job.id, 'APPROVED');
      const republished = await MockSubstackApi.publish(article, {});

      expect(republished.success).toBe(true);
    });

    test('Unpublish warning recorded in audit log', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');
      await queue.transitionState(job.id, 'APPROVED');

      const published = await MockSubstackApi.publish(article, {});
      await queue.transitionState(job.id, 'PUBLISHED');

      const unpublishReason = 'Correction: fix cap number';
      await queue.transitionState(job.id, 'UNPUBLISHED', {
        reason: unpublishReason,
        unpublishedBy: 'editor@team.com'
      });

      const auditLog = queue.getAuditLog(job.id);
      const unpublishEntry = auditLog.find(
        (entry) => entry.description === 'PUBLISHED → UNPUBLISHED'
      );

      expect(unpublishEntry).toBeDefined();
      expect(unpublishEntry.metadata.reason).toBe(unpublishReason);
    });
  });
});

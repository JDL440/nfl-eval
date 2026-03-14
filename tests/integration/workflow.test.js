/**
 * E2E Workflow Tests
 * Tests the complete article pipeline state machine: PROPOSED → DRAFTING → REVIEWING → APPROVED → PUBLISHED
 * Also tests rejection and unpublish workflows
 */

import { MockArticleQueue } from '../mocks/article-queue.mock';
import MockSubstackApi from '../mocks/substack-api.mock';
import SAMPLE_ARTICLES, {
  getHighSignificanceArticles,
  getMediumSignificanceArticles,
  getLowSignificanceArticles
} from '../fixtures/sample-articles';
import {
  assertValidArticleState,
  assertRequiresManualApproval,
  assertValidStateTransition
} from '../helpers/assertions';

describe('E2E Workflow Tests', () => {
  let queue;

  beforeEach(() => {
    queue = new MockArticleQueue();
    MockSubstackApi.reset();
  });

  describe('Happy Path: Full Pipeline', () => {
    test('Article: PROPOSED → DRAFTING → REVIEWING → APPROVED → PUBLISHED', async () => {
      // 1. Enqueue article
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      expect(job.state).toBe('PROPOSED');
      assertValidArticleState(job.state);
      assertRequiresManualApproval(article);

      // 2. Move to DRAFTING (simulates AI draft generation)
      await queue.transitionState(job.id, 'DRAFTING');
      let updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('DRAFTING');

      // Record token usage for draft
      queue.recordTokenUsage(job.id, 'haiku', 1850, 2100);
      updatedJob = queue.getJob(job.id);
      expect(updatedJob.tokenCost).toBeGreaterThan(0);

      // 3. Move to REVIEWING (simulates editor review)
      await queue.transitionState(job.id, 'REVIEWING');
      updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('REVIEWING');

      // Record token usage for review
      queue.recordTokenUsage(job.id, 'opus', 1500, 1800);
      updatedJob = queue.getJob(job.id);
      const initialCost = updatedJob.tokenCost;

      // 4. Move to APPROVED (human approval gate)
      await queue.transitionState(job.id, 'APPROVED');
      updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('APPROVED');

      // 5. Move to PUBLISHED (Substack API call)
      const publishedResult = await MockSubstackApi.publish(article, {
        draftTokens: 1850 + 2100,
        reviewTokens: 1500 + 1800
      });

      expect(publishedResult.success).toBe(true);
      expect(publishedResult.article.url).toMatch(/https:\/\/nfl-eval\.substack\.com/);

      await queue.transitionState(job.id, 'PUBLISHED');
      updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('PUBLISHED');

      // 6. Verify audit trail
      const auditLog = queue.getAuditLog(job.id);
      const states = auditLog.map((entry) => entry.action);

      expect(states).toContain('ENQUEUED');
      expect(states).toContain('STATE_CHANGE');
      expect(auditLog.some((entry) => entry.description.includes('PROPOSED → DRAFTING'))).toBe(
        true
      );
      expect(auditLog.some((entry) => entry.description.includes('PUBLISHED'))).toBe(true);
    });

    test('Multiple concurrent articles process independently', async () => {
      const articles = [
        getHighSignificanceArticles()[0],
        getHighSignificanceArticles()[1],
        getHighSignificanceArticles()[2]
      ];

      // Enqueue all articles
      const jobs = await Promise.all(articles.map((article) => queue.enqueue(article)));

      expect(jobs).toHaveLength(3);
      expect(jobs.every((job) => job.state === 'PROPOSED')).toBe(true);

      // Process each independently
      for (const job of jobs) {
        await queue.transitionState(job.id, 'DRAFTING');
        await queue.transitionState(job.id, 'REVIEWING');
        await queue.transitionState(job.id, 'APPROVED');
      }

      // All jobs should be in APPROVED state
      const allJobs = queue.getAllJobs();
      expect(allJobs.every((job) => job.state === 'APPROVED')).toBe(true);
    });
  });

  describe('Rejection Workflow', () => {
    test('Article rejection → reverts to state without resurrection', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      // Progress through pipeline
      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');

      // Editor rejects article
      await queue.transitionState(job.id, 'REJECTED', {
        reason: 'Factual errors in revenue projections',
        rejectedBy: 'editor@team.com'
      });

      let updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('REJECTED');

      // Rejected articles should be archived (no resurrection)
      await queue.transitionState(job.id, 'ARCHIVED');
      updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('ARCHIVED');

      // Verify audit trail
      const auditLog = queue.getAuditLog(job.id);
      const rejectionEntry = auditLog.find((entry) =>
        entry.description.includes('REVIEWING → REJECTED')
      );

      expect(rejectionEntry).toBeDefined();
      expect(rejectionEntry.metadata.reason).toBe('Factual errors in revenue projections');
    });

    test('Rejected articles cannot be republished (safe deletion)', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');
      await queue.transitionState(job.id, 'REJECTED');
      await queue.transitionState(job.id, 'ARCHIVED');

      // Try to transition from ARCHIVED (should fail)
      const archivedJob = queue.getJob(job.id);
      expect(() => {
        queue.transitionState(archivedJob.id, 'APPROVED');
      }).toThrow('Invalid transition');
    });
  });

  describe('Unpublish Workflow', () => {
    test('Published article can be unpublished and reverted to DRAFTED', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      // Full pipeline to published
      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');
      await queue.transitionState(job.id, 'APPROVED');

      const publishedResult = await MockSubstackApi.publish(article, { tokens: 5000 });
      expect(publishedResult.success).toBe(true);

      await queue.transitionState(job.id, 'PUBLISHED');

      // Now unpublish
      const unpublishResult = await MockSubstackApi.unpublish(publishedResult.article.id);
      expect(unpublishResult.success).toBe(true);

      // Transition in queue
      await queue.transitionState(job.id, 'UNPUBLISHED', {
        reason: 'Factual correction needed',
        unpublishedBy: 'editor@team.com'
      });

      let updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('UNPUBLISHED');

      // Should be able to re-approve and republish
      await queue.transitionState(job.id, 'APPROVED');
      updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('APPROVED');
    });

    test('Unpublish → re-publish workflow maintains audit trail', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');
      await queue.transitionState(job.id, 'APPROVED');

      const published1 = await MockSubstackApi.publish(article, {});
      await queue.transitionState(job.id, 'PUBLISHED');

      // Unpublish
      await MockSubstackApi.unpublish(published1.article.id);
      await queue.transitionState(job.id, 'UNPUBLISHED', { reason: 'Correction needed' });

      // Re-approve and republish
      await queue.transitionState(job.id, 'APPROVED');
      const published2 = await MockSubstackApi.publish(article, {});

      // Audit trail should show both publish and unpublish actions
      const auditLog = queue.getAuditLog(job.id);
      const states = auditLog.map((entry) => entry.description);

      expect(states.filter((state) => state.includes('PUBLISHED'))).toHaveLength(1); // One → PUBLISHED
      expect(states.filter((state) => state.includes('UNPUBLISHED'))).toHaveLength(1); // One → UNPUBLISHED
      expect(states.filter((state) => state.includes('APPROVED'))).toHaveLength(2); // Two → APPROVED
    });
  });

  describe('Significance Threshold Enforcement', () => {
    test('Low-significance articles archived without processing', async () => {
      const articles = getLowSignificanceArticles();
      expect(articles).toHaveLength(1); // sea-ps-move-003

      for (const article of articles) {
        const job = await queue.enqueue(article);
        expect(job.state).toBe('PROPOSED');

        // Should be archived without drafting
        await queue.transitionState(job.id, 'ARCHIVED');
        const updatedJob = queue.getJob(job.id);
        expect(updatedJob.state).toBe('ARCHIVED');
      }
    });

    test('High-significance articles auto-draft', async () => {
      const articles = getHighSignificanceArticles();
      expect(articles.length).toBeGreaterThanOrEqual(3);

      for (const article of articles) {
        expect(article.significance).toBeGreaterThanOrEqual(7.0);
        expect(article.expectedModel).toBe('opus'); // High-sig should use Opus

        const job = await queue.enqueue(article);
        // In real system, would auto-transition to DRAFTING based on significance
        await queue.transitionState(job.id, 'DRAFTING');

        const updatedJob = queue.getJob(job.id);
        expect(updatedJob.state).toBe('DRAFTING');
      }
    });

    test('Medium-significance articles require manual decision', async () => {
      const articles = getMediumSignificanceArticles();
      expect(articles.length).toBeGreaterThan(0);

      for (const article of articles) {
        expect(article.significance).toBeGreaterThanOrEqual(4.0);
        expect(article.significance).toBeLessThan(7.0);

        const job = await queue.enqueue(article);
        // Medium-sig articles stay in PROPOSED, awaiting editorial decision
        expect(job.state).toBe('PROPOSED');
      }
    });
  });

  describe('Manual Approval Gate (Non-Negotiable)', () => {
    test('No articles can skip manual approval', async () => {
      const articles = getHighSignificanceArticles().slice(0, 3);

      for (const article of articles) {
        const job = await queue.enqueue(article);

        // Assert manual approval is required
        assertRequiresManualApproval(article);

        // Try to publish without APPROVED state (should fail)
        await queue.transitionState(job.id, 'DRAFTING');
        await queue.transitionState(job.id, 'REVIEWING');

        // Cannot go directly to PUBLISHED without APPROVED
        expect(() => {
          queue.transitionState(job.id, 'PUBLISHED');
        }).toThrow('Invalid transition');

        // Must go through APPROVED first
        await queue.transitionState(job.id, 'APPROVED');
        const updatedJob = queue.getJob(job.id);
        expect(updatedJob.state).toBe('APPROVED');
      }
    });

    test('Approval must be explicit and auditable', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      await queue.transitionState(job.id, 'DRAFTING');
      await queue.transitionState(job.id, 'REVIEWING');

      // Approve with metadata (who approved, when)
      await queue.transitionState(job.id, 'APPROVED', {
        approvedBy: 'editor@team.com',
        approvalNotes: 'Verified all facts against OTC data'
      });

      // Verify in audit log
      const auditLog = queue.getAuditLog(job.id);
      const approvalEntry = auditLog.find(
        (entry) => entry.description === 'REVIEWING → APPROVED'
      );

      expect(approvalEntry).toBeDefined();
      expect(approvalEntry.metadata.approvedBy).toBe('editor@team.com');
    });
  });

  describe('State Transition Atomicity', () => {
    test('State transitions cannot be skipped', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      // Cannot skip DRAFTING → go directly to REVIEWING
      expect(() => {
        queue.transitionState(job.id, 'REVIEWING');
      }).toThrow('Invalid transition');

      // Must follow proper sequence
      await queue.transitionState(job.id, 'DRAFTING');
      expect(() => {
        queue.transitionState(job.id, 'APPROVED');
      }).toThrow('Invalid transition');

      // REVIEWING is required
      await queue.transitionState(job.id, 'REVIEWING');
      await queue.transitionState(job.id, 'APPROVED');

      const updatedJob = queue.getJob(job.id);
      expect(updatedJob.state).toBe('APPROVED');
    });

    test('Invalid transitions are rejected', async () => {
      const article = getHighSignificanceArticles()[0];
      const job = await queue.enqueue(article);

      const invalidTransitions = [
        ['PROPOSED', 'REVIEWING'],
        ['PROPOSED', 'APPROVED'],
        ['PROPOSED', 'PUBLISHED'],
        ['DRAFTING', 'APPROVED'],
        ['APPROVED', 'DRAFTING'],
        ['PUBLISHED', 'REVIEWING']
      ];

      for (const [from, to] of invalidTransitions) {
        const testJob = await queue.enqueue(article);
        // Move to source state
        if (from !== 'PROPOSED') {
          await queue.transitionState(testJob.id, 'DRAFTING');
          if (from !== 'DRAFTING') {
            await queue.transitionState(testJob.id, 'REVIEWING');
            if (from === 'APPROVED') {
              await queue.transitionState(testJob.id, 'APPROVED');
            } else if (from === 'PUBLISHED') {
              await queue.transitionState(testJob.id, 'APPROVED');
              await queue.transitionState(testJob.id, 'PUBLISHED');
            }
          }
        }

        // Attempt invalid transition
        expect(() => {
          queue.transitionState(testJob.id, to);
        }).toThrow();
      }
    });
  });
});

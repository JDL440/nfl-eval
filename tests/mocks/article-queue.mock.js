/**
 * Mock Article Queue
 * Simulates BullMQ job queue behavior for testing
 * No external dependencies, fully controllable for E2E testing
 */

export class MockArticleQueue {
  constructor() {
    this.jobs = new Map(); // id -> job
    this.jobCounter = 0;
    this.history = [];
    this.auditLog = [];
    this.tokenUsage = [];
    this.apiFailureMode = null; // null, '429', '500', 'timeout'
  }

  /**
   * Create a new queue job
   */
  async enqueue(article) {
    const jobId = `job-${++this.jobCounter}`;
    const job = {
      id: jobId,
      articleId: article.id,
      state: 'PROPOSED',
      data: article,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokenCost: 0,
      attempts: 0,
      maxAttempts: 3,
      nextRetry: null,
      result: null
    };

    this.jobs.set(jobId, job);
    this.history.push({ action: 'enqueued', jobId, article: article.id });
    this._logAudit('ENQUEUED', jobId, `Article queued: ${article.id}`);

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs in a specific state
   */
  getJobsByState(state) {
    return Array.from(this.jobs.values()).filter((job) => job.state === state);
  }

  /**
   * Transition job state (draft, review, approve, publish, unpublish)
   */
  async transitionState(jobId, newState, metadata = {}) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const oldState = job.state;

    // Validate state transitions
    const validTransitions = {
      PROPOSED: ['DRAFTING', 'ARCHIVED'],
      DRAFTING: ['REVIEWING', 'ARCHIVED'],
      REVIEWING: ['APPROVED', 'REJECTED', 'ARCHIVED'],
      APPROVED: ['PUBLISHED', 'ARCHIVED'],
      PUBLISHED: ['UNPUBLISHED', 'ARCHIVED'],
      UNPUBLISHED: ['APPROVED', 'ARCHIVED'],
      REJECTED: ['ARCHIVED'],
      ARCHIVED: []
    };

    if (!validTransitions[oldState]?.includes(newState)) {
      throw new Error(
        `Invalid transition: ${oldState} → ${newState}. Valid: ${validTransitions[
          oldState
        ]?.join(', ')}`
      );
    }

    job.state = newState;
    job.updatedAt = new Date();

    this.history.push({
      action: 'state_transition',
      jobId,
      from: oldState,
      to: newState,
      metadata
    });
    this._logAudit('STATE_CHANGE', jobId, `${oldState} → ${newState}`, metadata);

    return job;
  }

  /**
   * Record token usage for a job (for cost tracking)
   */
  recordTokenUsage(jobId, model, inputTokens, outputTokens) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const cost = this._calculateTokenCost(
      model,
      inputTokens,
      outputTokens
    );

    const usage = {
      jobId,
      model,
      inputTokens,
      outputTokens,
      cost,
      timestamp: new Date()
    };

    this.tokenUsage.push(usage);
    job.tokenCost = (job.tokenCost || 0) + cost;

    this._logAudit('TOKEN_USAGE', jobId, `${model}: ${inputTokens} in, ${outputTokens} out`, {
      cost
    });

    return { cost, total: job.tokenCost };
  }

  /**
   * Get cumulative token usage and cost
   */
  getTokenUsageSummary() {
    const summary = {
      totalTokens: 0,
      totalCost: 0,
      byModel: {},
      usage: this.tokenUsage
    };

    for (const usage of this.tokenUsage) {
      summary.totalTokens += usage.inputTokens + usage.outputTokens;
      summary.totalCost += usage.cost;

      if (!summary.byModel[usage.model]) {
        summary.byModel[usage.model] = { cost: 0, tokens: 0 };
      }
      summary.byModel[usage.model].cost += usage.cost;
      summary.byModel[usage.model].tokens += usage.inputTokens + usage.outputTokens;
    }

    return summary;
  }

  /**
   * Simulate API failure modes (for edge case testing)
   */
  setApiFailureMode(mode) {
    // mode: null, '429' (rate limit), '500' (error), 'timeout'
    this.apiFailureMode = mode;
  }

  /**
   * Simulate processing with potential failures
   */
  async processWithFailureHandling(jobId, operation) {
    if (this.apiFailureMode === '429') {
      const retryAfter = 60; // seconds
      throw {
        code: 429,
        message: 'Rate limited',
        retryAfter
      };
    }

    if (this.apiFailureMode === '500') {
      throw {
        code: 500,
        message: 'Server error'
      };
    }

    if (this.apiFailureMode === 'timeout') {
      throw {
        code: 'TIMEOUT',
        message: 'Operation timed out after 30s'
      };
    }

    return await operation();
  }

  /**
   * Simulate retry logic with exponential backoff
   */
  async retryWithBackoff(jobId, operation, maxAttempts = 3) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        job.attempts = attempt;
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) {
          job.error = error;
          this._logAudit('RETRY_EXHAUSTED', jobId, `Failed after ${maxAttempts} attempts`, {
            error: error.message
          });
          throw error;
        }

        // Exponential backoff: 2^(attempt-1) seconds
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        job.nextRetry = new Date(Date.now() + backoffMs);

        this._logAudit('RETRY', jobId, `Attempt ${attempt}/${maxAttempts}, retry in ${backoffMs}ms`);
      }
    }
  }

  /**
   * Get audit log for a job
   */
  getAuditLog(jobId = null) {
    if (jobId) {
      return this.auditLog.filter((entry) => entry.jobId === jobId);
    }
    return this.auditLog;
  }

  /**
   * Calculate cost based on token counts and model
   */
  _calculateTokenCost(model, inputTokens, outputTokens) {
    // Claude Haiku: $0.80 per 1M input, $4.00 per 1M output
    // Claude Opus: $3.00 per 1M input, $15.00 per 1M output
    const rates = {
      haiku: { input: 0.0000008, output: 0.000004 },
      opus: { input: 0.000003, output: 0.000015 }
    };

    const modelRates = rates[model.toLowerCase()] || rates.haiku;
    return (inputTokens * modelRates.input + outputTokens * modelRates.output).toFixed(6);
  }

  /**
   * Internal: log audit entry
   */
  _logAudit(action, jobId, description, metadata = {}) {
    this.auditLog.push({
      timestamp: new Date(),
      action,
      jobId,
      description,
      metadata
    });
  }

  /**
   * Reset mock state (for test isolation)
   */
  reset() {
    this.jobs.clear();
    this.jobCounter = 0;
    this.history = [];
    this.auditLog = [];
    this.tokenUsage = [];
    this.apiFailureMode = null;
  }

  /**
   * Get all jobs
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job history
   */
  getHistory() {
    return this.history;
  }
}

export const mockArticleQueue = new MockArticleQueue();
export default MockArticleQueue;

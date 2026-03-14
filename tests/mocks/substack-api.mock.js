/**
 * Mock Substack API
 * Simulates publishing and unpublishing to Substack
 * Includes rate limiting and failure modes for edge case testing
 */

export class MockSubstackApi {
  constructor() {
    this.publishedArticles = new Map(); // id -> article
    this.publishCounter = 0;
    this.requestCount = 0;
    this.failureMode = null; // null, '401', '429', '500', 'timeout'
    this.rateLimit = {
      enabled: true,
      requestsPerMinute: 100,
      requests: [] // timestamps
    };
  }

  /**
   * Publish article to Substack
   * Returns published article with URL
   */
  async publish(article, draftData) {
    await this._checkRateLimit();
    await this._checkFailureMode();

    const publishedArticle = {
      ...article,
      ...draftData,
      id: `substack-${++this.publishCounter}`,
      url: `https://nfl-eval.substack.com/p/${article.id}-${this.publishCounter}`,
      publishedAt: new Date(),
      status: 'published'
    };

    this.publishedArticles.set(publishedArticle.id, publishedArticle);

    return {
      success: true,
      article: publishedArticle,
      message: `Article published to ${publishedArticle.url}`
    };
  }

  /**
   * Unpublish article from Substack
   * Sets status to 'draft' but keeps data intact
   */
  async unpublish(articleId) {
    await this._checkRateLimit();
    await this._checkFailureMode();

    const published = this.publishedArticles.get(articleId);
    if (!published) {
      throw {
        code: 404,
        message: `Article not found: ${articleId}`
      };
    }

    published.status = 'draft';
    published.unpublishedAt = new Date();

    return {
      success: true,
      article: published,
      message: `Article reverted to draft state`
    };
  }

  /**
   * Get published article
   */
  getPublishedArticle(articleId) {
    return this.publishedArticles.get(articleId);
  }

  /**
   * Get all published articles
   */
  getAllPublished() {
    return Array.from(this.publishedArticles.values()).filter(
      (article) => article.status === 'published'
    );
  }

  /**
   * Get all draft articles (unpublished)
   */
  getAllDrafts() {
    return Array.from(this.publishedArticles.values()).filter(
      (article) => article.status === 'draft'
    );
  }

  /**
   * Set failure mode for testing error scenarios
   */
  setFailureMode(mode) {
    // mode: null, '401' (auth), '429' (rate limit), '500' (error), 'timeout'
    this.failureMode = mode;
  }

  /**
   * Enable/disable rate limiting
   */
  setRateLimitEnabled(enabled) {
    this.rateLimit.enabled = enabled;
  }

  /**
   * Set rate limit parameters
   */
  setRateLimit(requestsPerMinute) {
    this.rateLimit.requestsPerMinute = requestsPerMinute;
  }

  /**
   * Check rate limit
   */
  async _checkRateLimit() {
    if (!this.rateLimit.enabled) return;

    this.requestCount++;
    const now = Date.now();

    // Remove requests older than 1 minute
    this.rateLimit.requests = this.rateLimit.requests.filter(
      (timestamp) => now - timestamp < 60000
    );

    this.rateLimit.requests.push(now);

    if (this.rateLimit.requests.length > this.rateLimit.requestsPerMinute) {
      throw {
        code: 429,
        message: `Rate limited: ${this.rateLimit.requests.length} requests/minute (limit: ${this.rateLimit.requestsPerMinute})`,
        retryAfter: 60
      };
    }
  }

  /**
   * Check failure mode
   */
  async _checkFailureMode() {
    if (this.failureMode === '401') {
      throw {
        code: 401,
        message: 'Unauthorized: Invalid API key'
      };
    }

    if (this.failureMode === '429') {
      throw {
        code: 429,
        message: 'Rate limited',
        retryAfter: 60
      };
    }

    if (this.failureMode === '500') {
      throw {
        code: 500,
        message: 'Internal Server Error'
      };
    }

    if (this.failureMode === 'timeout') {
      throw {
        code: 'TIMEOUT',
        message: 'Request timed out after 30s'
      };
    }
  }

  /**
   * Reset mock state
   */
  reset() {
    this.publishedArticles.clear();
    this.publishCounter = 0;
    this.requestCount = 0;
    this.failureMode = null;
    this.rateLimit.requests = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalPublished: this.getAllPublished().length,
      totalDrafts: this.getAllDrafts().length,
      totalRequests: this.requestCount,
      currentRequestsPerMinute: this.rateLimit.requests.length
    };
  }
}

export const mockSubstackApi = new MockSubstackApi();
export default MockSubstackApi;

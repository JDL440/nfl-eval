/**
 * Mock Token Counter
 * Tracks token usage and costs based on Claude Haiku/Opus pricing
 * Uses pre-calculated token fixtures for deterministic testing
 */

export class MockTokenCounter {
  constructor() {
    this.usage = [];
    this.dailyBudget = 1.30; // GitHub Copilot Pro+ daily
    this.budgetAlertThreshold = 0.7; // Alert at 70%
    this.startDate = new Date().toDateString();
    this.costHistory = [];
  }

  /**
   * Calculate cost for tokens based on model
   * Claude Haiku: $0.80/$4.00 per 1M tokens (input/output)
   * Claude Opus: $3.00/$15.00 per 1M tokens (input/output)
   */
  calculateCost(model, inputTokens, outputTokens) {
    const rates = {
      haiku: {
        input: 0.00000080, // $0.80 per 1M
        output: 0.000004 // $4.00 per 1M
      },
      opus: {
        input: 0.000003, // $3.00 per 1M
        output: 0.000015 // $15.00 per 1M
      }
    };

    const modelRates = rates[model.toLowerCase()];
    if (!modelRates) {
      throw new Error(`Unknown model: ${model}`);
    }

    const inputCost = inputTokens * modelRates.input;
    const outputCost = outputTokens * modelRates.output;
    const totalCost = inputCost + outputCost;

    return {
      inputCost: parseFloat(inputCost.toFixed(6)),
      outputCost: parseFloat(outputCost.toFixed(6)),
      totalCost: parseFloat(totalCost.toFixed(6)),
      breakdown: { inputTokens, outputTokens, inputRate: modelRates.input, outputRate: modelRates.output }
    };
  }

  /**
   * Record token usage for an article job
   */
  recordUsage(jobId, model, inputTokens, outputTokens, metadata = {}) {
    const costs = this.calculateCost(model, inputTokens, outputTokens);

    const entry = {
      jobId,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      ...costs,
      timestamp: new Date(),
      metadata
    };

    this.usage.push(entry);
    this.costHistory.push({
      timestamp: new Date(),
      cumulative: this.getTotalCost()
    });

    return entry;
  }

  /**
   * Get total cost to date
   */
  getTotalCost() {
    return this.usage.reduce((sum, entry) => sum + entry.totalCost, 0);
  }

  /**
   * Get daily cost (for current day)
   */
  getDailyCost() {
    const today = new Date().toDateString();
    return this.usage
      .filter((entry) => entry.timestamp.toDateString() === today)
      .reduce((sum, entry) => sum + entry.totalCost, 0);
  }

  /**
   * Check if daily budget alert threshold exceeded
   */
  isDailyBudgetAlertTriggered() {
    const dailyCost = this.getDailyCost();
    const alertThreshold = this.dailyBudget * this.budgetAlertThreshold;
    return dailyCost >= alertThreshold;
  }

  /**
   * Get budget status
   */
  getBudgetStatus() {
    const dailyCost = this.getDailyCost();
    const remaining = this.dailyBudget - dailyCost;
    const percentUsed = (dailyCost / this.dailyBudget) * 100;

    return {
      budget: this.dailyBudget,
      spent: parseFloat(dailyCost.toFixed(4)),
      remaining: parseFloat(remaining.toFixed(4)),
      percentUsed: parseFloat(percentUsed.toFixed(2)),
      alertThreshold: this.budgetAlertThreshold * 100,
      alertTriggered: this.isDailyBudgetAlertTriggered()
    };
  }

  /**
   * Get usage summary by model
   */
  getSummaryByModel() {
    const summary = {};

    for (const entry of this.usage) {
      if (!summary[entry.model]) {
        summary[entry.model] = {
          count: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: 0
        };
      }

      summary[entry.model].count++;
      summary[entry.model].inputTokens += entry.inputTokens;
      summary[entry.model].outputTokens += entry.outputTokens;
      summary[entry.model].totalTokens += entry.totalTokens;
      summary[entry.model].cost += entry.totalCost;
    }

    // Format costs
    for (const model in summary) {
      summary[model].cost = parseFloat(summary[model].cost.toFixed(6));
    }

    return summary;
  }

  /**
   * Get usage for a specific job
   */
  getUsageForJob(jobId) {
    return this.usage.find((entry) => entry.jobId === jobId);
  }

  /**
   * Get usage history
   */
  getHistory() {
    return this.usage;
  }

  /**
   * Get total tokens
   */
  getTotalTokens() {
    return this.usage.reduce((sum, entry) => sum + entry.totalTokens, 0);
  }

  /**
   * Check if within tolerance of expected cost
   * tolerance: 0.05 = ±5%
   */
  isWithinTolerance(actual, expected, tolerance = 0.05) {
    const allowedDifference = expected * tolerance;
    const actualDifference = Math.abs(actual - expected);
    return actualDifference <= allowedDifference;
  }

  /**
   * Reset mock state
   */
  reset() {
    this.usage = [];
    this.costHistory = [];
    this.startDate = new Date().toDateString();
  }

  /**
   * Get detailed cost report
   */
  generateCostReport() {
    const totalCost = this.getTotalCost();
    const dailyCost = this.getDailyCost();
    const summary = this.getSummaryByModel();
    const budgetStatus = this.getBudgetStatus();

    return {
      timestamp: new Date(),
      totalCost: parseFloat(totalCost.toFixed(6)),
      dailyCost: parseFloat(dailyCost.toFixed(6)),
      totalArticles: this.usage.length,
      averageCostPerArticle: parseFloat((totalCost / this.usage.length).toFixed(6)),
      summary,
      budgetStatus,
      allUsage: this.usage
    };
  }
}

// Export as both named and default
export const mockTokenCounter = new MockTokenCounter();
export default MockTokenCounter;

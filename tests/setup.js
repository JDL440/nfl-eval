/**
 * Jest test setup file
 * Runs before all tests
 */

// Custom matchers
expect.extend({
  toBeValidArticleState(received) {
    const validStates = [
      'PROPOSED',
      'DRAFTING',
      'REVIEWING',
      'APPROVED',
      'PUBLISHED',
      'UNPUBLISHED',
      'ARCHIVED',
      'REJECTED'
    ];

    const pass = validStates.includes(received);
    return {
      pass,
      message: () =>
        `expected ${received} to be a valid article state (${validStates.join(', ')})`
    };
  },

  toBeWithinTokenBudget(received, expected) {
    const tolerance = expected * 0.05; // 5% tolerance
    const pass = Math.abs(received - expected) <= tolerance;
    const diff = received - expected;

    return {
      pass,
      message: () =>
        `expected ${received} tokens to be within ±5% of ${expected} (tolerance: ${tolerance.toFixed(
          2
        )}). Difference: ${diff.toFixed(2)}`
    };
  },

  toBeWithinCostBudget(received, budget) {
    const pass = received <= budget;
    const remaining = budget - received;

    return {
      pass,
      message: () =>
        `expected cost $${received.toFixed(4)} to not exceed budget $${budget.toFixed(
          4
        )}. Remaining: $${remaining.toFixed(4)}`
    };
  },

  toHaveAutoApprovalBlocker(received) {
    const pass = received.requiresManualApproval === true;

    return {
      pass,
      message: () =>
        `expected article to have auto-approval blocker (requiresManualApproval: true), got: ${JSON.stringify(
          received
        )}`
    };
  }
});

// Silence console during tests unless explicitly needed
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Enable specific console output with DEBUG env var
if (process.env.DEBUG) {
  global.console.log = console.log;
  global.console.debug = console.debug;
  global.console.info = console.info;
  global.console.warn = console.warn;
  global.console.error = console.error;
}

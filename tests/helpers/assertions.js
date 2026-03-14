/**
 * Test Assertions
 * Custom Jest matchers for domain-specific assertions
 */

/**
 * Check if a cost is within a tolerance of expected
 */
export function assertCostWithinTolerance(actual, expected, tolerance = 0.05) {
  const allowedDifference = expected * tolerance;
  const actualDifference = Math.abs(actual - expected);

  if (actualDifference > allowedDifference) {
    throw new Error(
      `Cost $${actual.toFixed(4)} differs from expected $${expected.toFixed(
        4
      )} by more than ${tolerance * 100}% (${actualDifference.toFixed(6)})`
    );
  }
}

/**
 * Check if article has valid state
 */
export function assertValidArticleState(state) {
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

  if (!validStates.includes(state)) {
    throw new Error(`Invalid article state: ${state}. Valid: ${validStates.join(', ')}`);
  }
}

/**
 * Check if article requires manual approval
 */
export function assertRequiresManualApproval(article) {
  if (!article.requiresManualApproval) {
    throw new Error(
      `Article ${article.id} does not have requiresManualApproval flag set to true`
    );
  }
}

/**
 * Check if cost is within daily budget
 */
export function assertWithinDailyBudget(cost, budget) {
  if (cost > budget) {
    throw new Error(
      `Cost $${cost.toFixed(4)} exceeds daily budget $${budget.toFixed(4)}`
    );
  }
}

/**
 * Check if tokens are within expected range with tolerance
 */
export function assertTokensWithinTolerance(actual, expected, tolerance = 0.05) {
  const allowedDifference = Math.ceil(expected * tolerance);
  const actualDifference = Math.abs(actual - expected);

  if (actualDifference > allowedDifference) {
    throw new Error(
      `Token count ${actual} differs from expected ${expected} by more than ${tolerance * 100}% (allowed: ${allowedDifference})`
    );
  }
}

/**
 * Check if state transition is valid
 */
export function assertValidStateTransition(fromState, toState) {
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

  if (!validTransitions[fromState]?.includes(toState)) {
    throw new Error(
      `Invalid state transition: ${fromState} → ${toState}. Valid: ${validTransitions[
        fromState
      ]?.join(', ')}`
    );
  }
}

export default {
  assertCostWithinTolerance,
  assertValidArticleState,
  assertRequiresManualApproval,
  assertWithinDailyBudget,
  assertTokensWithinTolerance,
  assertValidStateTransition
};

import { describe, test, expect } from '@jest/globals';
import { isSignificant, evaluateSignificance, SIGNIFICANCE_RULES } from '../config/significance.js';

describe('Media Sweep Significance Tests', () => {
  test('should trigger on high-value trade', () => {
    const transaction = {
      type: 'trade',
      player: 'Test Player',
      position: 'EDGE',
      to_team: 'SEA',
      deal: {
        total_million: 100,
      },
      confidence: '🟢 confirmed',
    };

    expect(isSignificant(transaction)).toBe(true);
  });

  test('should trigger on high AAV signing', () => {
    const transaction = {
      type: 'signing',
      player: 'Star WR',
      position: 'WR',
      to_team: 'KC',
      deal: {
        total_million: 80,
        aav_million: 28,
      },
      confidence: '🟢 confirmed',
    };

    expect(isSignificant(transaction)).toBe(true);
  });

  test('should not trigger on low-value signing', () => {
    const transaction = {
      type: 'signing',
      player: 'Backup RB',
      position: 'RB',
      to_team: 'MIN',
      deal: {
        total_million: 5,
        aav_million: 2,
      },
      confidence: '🟢 confirmed',
    };

    expect(isSignificant(transaction)).toBe(false);
  });

  test('should evaluate significance score correctly', () => {
    const highValue = {
      type: 'signing',
      player: 'Elite Edge',
      position: 'EDGE',
      to_team: 'SEA',
      deal: {
        total_million: 120,
        aav_million: 30,
      },
      confidence: '🟢 confirmed',
    };

    const score = evaluateSignificance(highValue);
    expect(score).toBeGreaterThan(70);
  });

  test('should apply team overrides', () => {
    const seahawksTransaction = {
      type: 'signing',
      player: 'Test',
      position: 'WR',
      to_team: 'SEA',
      deal: { total_million: 20, aav_million: 5 },
      confidence: '🟢 confirmed',
    };

    const otherTeamTransaction = {
      type: 'signing',
      player: 'Test',
      position: 'WR',
      to_team: 'TB',
      deal: { total_million: 20, aav_million: 5 },
      confidence: '🟢 confirmed',
    };

    const seahawksScore = evaluateSignificance(seahawksTransaction);
    const otherScore = evaluateSignificance(otherTeamTransaction);

    expect(seahawksScore).toBeGreaterThan(otherScore);
  });

  test('should consider confidence level', () => {
    const confirmed = {
      type: 'signing',
      player: 'Test',
      position: 'WR',
      to_team: 'KC',
      deal: { total_million: 20, aav_million: 10 },
      confidence: '🟢 confirmed',
    };

    const rumored = {
      type: 'signing',
      player: 'Test',
      position: 'WR',
      to_team: 'KC',
      deal: { total_million: 20, aav_million: 10 },
      confidence: '🟡 possible',
    };

    const confirmedScore = evaluateSignificance(confirmed);
    const rumoredScore = evaluateSignificance(rumored);

    expect(confirmedScore).toBeGreaterThan(rumoredScore);
  });
});

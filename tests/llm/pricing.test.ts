import { describe, it, expect } from 'vitest';
import {
  estimateCost,
  getModelPricing,
  listPricedModels,
} from '../../src/llm/pricing.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pricing module', () => {
  // -- getModelPricing ------------------------------------------------------

  describe('getModelPricing', () => {
    it('returns pricing for known models', () => {
      const pricing = getModelPricing('claude-sonnet-4');
      expect(pricing).toBeDefined();
      expect(pricing!.inputPerMillion).toBeGreaterThan(0);
      expect(pricing!.outputPerMillion).toBeGreaterThan(0);
    });

    it('returns undefined for unknown models', () => {
      expect(getModelPricing('some-unknown-model')).toBeUndefined();
    });

    it('covers all major model families', () => {
      // Claude
      expect(getModelPricing('claude-opus-4.6')).toBeDefined();
      expect(getModelPricing('claude-sonnet-4.5')).toBeDefined();
      expect(getModelPricing('claude-haiku-4.5')).toBeDefined();

      // GPT
      expect(getModelPricing('gpt-5.4')).toBeDefined();
      expect(getModelPricing('gpt-5.4-mini')).toBeDefined();
      expect(getModelPricing('gpt-4.1')).toBeDefined();

      // Gemini
      expect(getModelPricing('gemini-3-pro-preview')).toBeDefined();
    });
  });

  // -- estimateCost ---------------------------------------------------------

  describe('estimateCost', () => {
    it('calculates cost for a known model', () => {
      // claude-sonnet-4: $3/M input, $15/M output
      const cost = estimateCost('claude-sonnet-4', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(3.0 + 15.0, 4);
    });

    it('calculates cost proportionally for smaller token counts', () => {
      // claude-sonnet-4: $3/M input, $15/M output
      // 1000 prompt tokens = 1000/1M * $3 = $0.003
      // 500 completion tokens = 500/1M * $15 = $0.0075
      const cost = estimateCost('claude-sonnet-4', 1000, 500);
      expect(cost).toBeCloseTo(0.003 + 0.0075, 6);
    });

    it('returns 0 for unknown models', () => {
      const cost = estimateCost('unknown-model', 1000, 500);
      expect(cost).toBe(0);
    });

    it('returns 0 for zero tokens', () => {
      const cost = estimateCost('claude-sonnet-4', 0, 0);
      expect(cost).toBe(0);
    });

    it('handles output-only cost (zero prompt tokens)', () => {
      // gpt-5.4-mini: $0.40/M input, $1.60/M output
      const cost = estimateCost('gpt-5.4-mini', 0, 10_000);
      // 10000/1M * $1.60 = $0.016
      expect(cost).toBeCloseTo(0.016, 6);
    });

    it('opus models are more expensive than sonnet', () => {
      const opusCost = estimateCost('claude-opus-4.6', 10_000, 5_000);
      const sonnetCost = estimateCost('claude-sonnet-4', 10_000, 5_000);
      expect(opusCost).toBeGreaterThan(sonnetCost);
    });

    it('mini models are cheaper than full models', () => {
      const fullCost = estimateCost('gpt-5.4', 10_000, 5_000);
      const miniCost = estimateCost('gpt-5.4-mini', 10_000, 5_000);
      expect(miniCost).toBeLessThan(fullCost);
    });
  });

  // -- listPricedModels -----------------------------------------------------

  describe('listPricedModels', () => {
    it('returns non-empty array', () => {
      const models = listPricedModels();
      expect(models.length).toBeGreaterThan(10);
    });

    it('includes common models', () => {
      const models = listPricedModels();
      expect(models).toContain('claude-sonnet-4');
      expect(models).toContain('gpt-5.4');
      expect(models).toContain('gemini-3-pro-preview');
    });
  });
});

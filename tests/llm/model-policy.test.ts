import { describe, it, expect, beforeEach } from 'vitest';
import { ModelPolicy } from '../../src/llm/model-policy.js';
import { join } from 'node:path';

describe('ModelPolicy', () => {
  let policy: ModelPolicy;

  beforeEach(() => {
    const configPath = join(process.cwd(), 'src', 'config', 'defaults', 'models.json');
    policy = new ModelPolicy(configPath);
  });

  describe('resolve', () => {
    it('resolves writer model', () => {
      const result = policy.resolve({ stageKey: 'writer' });
      expect(result.selectedModel).toBe('gpt-5-mini');
      expect(result.taskFamily).toBe('deep_reasoning');
    });

    it('resolves lightweight model', () => {
      const result = policy.resolve({ stageKey: 'lightweight' });
      expect(result.selectedModel).toBe('gpt-5-nano');
      expect(result.taskFamily).toBe('lightweight');
    });

    it('resolves panel model by depth level', () => {
      const casual = policy.resolve({ stageKey: 'panel', depthLevel: 1 });
      expect(casual.selectedModel).toBe('gpt-5-nano');

      const deep = policy.resolve({ stageKey: 'panel', depthLevel: 3 });
      expect(deep.selectedModel).toBe('gpt-5-mini');
    });

    it('requires depth level for panel stage', () => {
      expect(() => policy.resolve({ stageKey: 'panel' })).toThrow('depth_level is required');
    });

    it('resolves by task family directly', () => {
      const result = policy.resolve({ taskFamily: 'balanced' });
      expect(result.selectedModel).toBe('gpt-5-mini');
      expect(result.tier).toBe('low');
    });

    it('applies model override', () => {
      const result = policy.resolve({ stageKey: 'writer', overrideModel: 'gpt-5' });
      expect(result.selectedModel).toBe('gpt-5');
      expect(result.overrideApplied).toBe(true);
    });

    it('rejects unsupported override model', () => {
      expect(() => policy.resolve({ overrideModel: 'nonexistent-model' })).toThrow('Unsupported override');
    });

    it('returns correct output budget', () => {
      const result = policy.resolve({ stageKey: 'writer' });
      expect(result.outputBudgetTokens).toBe(5000);
    });

    it('resolves editor model', () => {
      const result = policy.resolve({ stageKey: 'editor' });
      expect(result.selectedModel).toBe('gpt-5-mini');
      expect(result.outputBudgetTokens).toBe(2500);
    });
  });

  describe('allSupportedModels', () => {
    it('returns all models across tiers', () => {
      const all = policy.allSupportedModels();
      expect(all.length).toBeGreaterThan(5);
      expect(all).toContain('gpt-5');
      expect(all).toContain('gpt-5-mini');
    });

    it('has no duplicates', () => {
      const all = policy.allSupportedModels();
      expect(new Set(all).size).toBe(all.length);
    });
  });

  describe('tierForModel', () => {
    it('finds tier for known model', () => {
      const [tier, rank] = policy.tierForModel('gpt-5');
      expect(tier).toBe('medium');
      expect(rank).toBe(2);
    });

    it('returns nulls for unknown model', () => {
      const [tier, rank] = policy.tierForModel('unknown-model');
      expect(tier).toBeNull();
      expect(rank).toBeNull();
    });
  });

  describe('getPanelSizeLimits', () => {
    it('returns limits for casual fan', () => {
      const limits = policy.getPanelSizeLimits(1);
      expect(limits).toEqual({ min: 2, max: 2 });
    });

    it('returns limits for deep dive', () => {
      const limits = policy.getPanelSizeLimits(3);
      expect(limits).toEqual({ min: 4, max: 5 });
    });

    it('returns limits for feature (depth 4)', () => {
      const limits = policy.getPanelSizeLimits(4);
      expect(limits).toEqual({ min: 4, max: 5 });
    });

    it('throws for invalid depth level', () => {
      expect(() => policy.getPanelSizeLimits(99)).toThrow();
    });
  });
});

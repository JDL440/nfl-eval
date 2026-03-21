/**
 * validation.test.ts — Tests for pipeline configuration validation.
 */

import { describe, it, expect } from 'vitest';
import { validatePipelineConfig, assertPipelineConfigValid } from '../../src/pipeline/validation.js';

describe('validatePipelineConfig', () => {
  it('returns no errors for the current production config', () => {
    const issues = validatePipelineConfig();
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(0);
  });

  it('returns no warnings for the current production config', () => {
    const issues = validatePipelineConfig();
    const warnings = issues.filter(i => i.level === 'warning');
    expect(warnings).toHaveLength(0);
  });

  it('assertPipelineConfigValid does not throw for valid config', () => {
    expect(() => assertPipelineConfigValid()).not.toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { VALID_STAGES, STAGE_NAMES, DEPTH_LEVEL_MAP } from '../src/types.js';

describe('types', () => {
  it('has 8 valid stages', () => {
    expect(VALID_STAGES).toHaveLength(8);
  });

  it('has stage names for all stages', () => {
    for (const stage of VALID_STAGES) {
      expect(STAGE_NAMES[stage]).toBeTruthy();
    }
  });

  it('has depth level map entries', () => {
    expect(DEPTH_LEVEL_MAP[1]).toBe('casual_fan');
    expect(DEPTH_LEVEL_MAP[2]).toBe('the_beat');
    expect(DEPTH_LEVEL_MAP[3]).toBe('deep_dive');
  });
});

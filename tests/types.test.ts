import { describe, it, expect } from 'vitest';
import { VALID_STAGES, STAGE_NAMES, DEPTH_LEVEL_MAP, resolveEditorialControls } from '../src/types.js';

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

  it('preserves mixed legacy tuples while deriving canonical controls', () => {
    expect(resolveEditorialControls({
      depth_level: 2,
      content_profile: 'deep_dive',
    })).toMatchObject({
      preset_id: 'technical_deep_dive',
      article_form: 'deep',
      legacy_depth_level: 2,
      legacy_content_profile: 'deep_dive',
    });

    expect(resolveEditorialControls({
      depth_level: 3,
      content_profile: 'accessible',
    })).toMatchObject({
      preset_id: 'beat_analysis',
      article_form: 'standard',
      legacy_depth_level: 3,
      legacy_content_profile: 'accessible',
    });
  });

  it('still derives legacy compatibility from explicit canonical controls', () => {
    expect(resolveEditorialControls({
      preset_id: 'narrative_feature',
      depth_level: 2,
      content_profile: 'accessible',
    })).toMatchObject({
      article_form: 'feature',
      legacy_depth_level: 4,
      legacy_content_profile: 'deep_dive',
    });
  });
});

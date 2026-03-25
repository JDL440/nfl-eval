import { describe, expect, it } from 'vitest';

import { getContextConfigDefaults } from '../../src/pipeline/context-config.js';

describe('context-config stage 5-7 defaults', () => {
  it('keeps balanced Stage 5-7 inputs narrowed to the simplified seams', () => {
    const defaults = getContextConfigDefaults('balanced');

    expect(defaults.writeDraft).toEqual({
      primary: 'discussion-summary.md',
      include: ['panel-factcheck.md', 'writer-factcheck.md'],
    });
    expect(defaults.runEditor).toEqual({
      primary: 'draft.md',
      include: ['writer-factcheck.md'],
    });
    expect(defaults.runPublisherPass).toEqual({
      primary: 'draft.md',
      include: ['editor-review.md'],
    });
  });

  it('keeps rich Stage 5-7 inputs aligned with the same narrowed defaults', () => {
    const defaults = getContextConfigDefaults('rich');

    expect(defaults.writeDraft.include).toEqual(['panel-factcheck.md', 'roster-context.md', 'fact-check-context.md', 'writer-factcheck.md']);
    expect(defaults.runEditor.include).toEqual(['roster-context.md', 'fact-check-context.md', 'writer-factcheck.md']);
    expect(defaults.runPublisherPass.include).toEqual(['editor-review.md']);
  });
});

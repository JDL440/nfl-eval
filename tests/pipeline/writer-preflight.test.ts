import { describe, expect, it } from 'vitest';

import { buildWriterPreflightArtifact, buildWriterPreflightChecklist, runWriterPreflight } from '../../src/pipeline/writer-preflight.js';

describe('writer preflight', () => {
  it('builds a short checklist focused on top blockers', () => {
    const checklist = buildWriterPreflightChecklist();

    expect(checklist).toContain('short essentials preflight');
    expect(checklist).toContain('do not invent fuller versions');
    expect(checklist).toContain('numbers, dates, draft facts, and contract details');
    expect(checklist).toContain('unsupported specifics');
  });

  it('flags unsupported name variants against supplied artifacts', () => {
    const state = runWriterPreflight({
      draft: '**Jackson Smith-Njigba** is about to become the offense\'s hinge point.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Jaxon Smith-Njigba is the featured separator in this offense.' },
      ],
    });

    expect(state.blockingIssues).toHaveLength(1);
    expect(state.blockingIssues[0]?.code).toBe('name-consistency');
    expect(state.blockingIssues[0]?.message).toContain('Jaxon Smith-Njigba');
  });

  it('does not treat sentence-openers plus a supported last name as an invented expansion', () => {
    const state = runWriterPreflight({
      draft: 'If Rodgers comes back, the offense still has to flow through structure. If Pat Freiermuth stays central, the tight end room still matters.',
      sourceArtifacts: [
        {
          name: 'discussion-summary.md',
          content: "Aaron Rodgers' headline value still matters. Pat Freiermuth stays central to the tight end room.",
        },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'name-consistency')).toBe(false);
    expect(state.blockingIssues.some((issue) => issue.code === 'unsupported-name-expansion')).toBe(false);
  });

  it('ignores NFL Lab team branding phrases when extracting supported names', () => {
    const state = runWriterPreflight({
      draft: '**Micah Parsons** is the hinge point of this Cowboys defense.',
      sourceArtifacts: [
        { name: 'idea.md', content: 'The NFL Lab Cowboys panel debated whether Dallas should build around Parsons.' },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.message.includes('Lab Cowboys'))).toBe(false);
    expect(state.blockingIssues.some((issue) => issue.message.includes('cowboys'))).toBe(false);
  });

  it('ignores sentence-opener pseudo-names like "Because San Francisco" in source artifacts', () => {
    const state = runWriterPreflight({
      draft: 'San Francisco still has to decide how aggressive to be at receiver.',
      sourceArtifacts: [
        {
          name: 'discussion-summary.md',
          content: 'Because San Francisco still lacks easy answers here, the panel kept circling the receiver question.',
        },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'name-consistency')).toBe(false);
    expect(state.blockingIssues.some((issue) => issue.code === 'unsupported-name-expansion')).toBe(false);
  });

  it('ignores sibling opener phrases when checking supported names', () => {
    const state = runWriterPreflight({
      draft: 'Seattle still needs another answer at guard.',
      sourceArtifacts: [
        {
          name: 'discussion-summary.md',
          content: 'If Seattle wants this offense to travel, it must get sturdier inside. When Seattle gets boxed in, the whole plan narrows.',
        },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'name-consistency')).toBe(false);
    expect(state.blockingIssues.some((issue) => issue.code === 'unsupported-name-expansion')).toBe(false);
  });

  it('flags unsupported precise claims but allows supported local claims through', () => {
    const unsupported = runWriterPreflight({
      draft: '**Geno Smith** has a $32 million extension lined up after his 4,320 passing yards in 2026.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Geno Smith remains the quarterback question, but keep contract language cautious.' },
      ],
    });

    expect(unsupported.blockingIssues.some((issue) => issue.code === 'unsourced-contract-claim')).toBe(true);
    expect(unsupported.blockingIssues.some((issue) => issue.code === 'unsourced-stat-claim')).toBe(true);

    const supported = runWriterPreflight({
      draft: '**Geno Smith** is playing on a $32 million extension after his 4,320 passing yards in 2026.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Geno Smith is playing on a $32 million extension after his 4,320 passing yards in 2026.' },
      ],
    });

    expect(supported.blockingIssues).toHaveLength(0);
  });

  it('flags placeholder leakage and can render a bounded artifact summary', () => {
    const initial = runWriterPreflight({
      draft: 'TODO: confirm the final lede before publish.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Keep the article publication-ready.' },
      ],
    });

    expect(initial.blockingIssues).toHaveLength(1);
    expect(initial.blockingIssues[0]?.code).toBe('placeholder-leakage');

    const artifact = buildWriterPreflightArtifact({
      initialState: initial,
      finalState: { blockingIssues: [], warnings: [] },
      repairTriggered: true,
    });

    expect(artifact).toContain('**Repair triggered:** yes');
    expect(artifact).toContain('[placeholder-leakage]');
    expect(artifact).toContain('No deterministic writer-preflight issues found.');
  });

  it('does not flag panel-agreement historical framing as an unsupported date claim', () => {
    const state = runWriterPreflight({
      draft: 'The panel agreed on the cleanest turning point in this whole conversation: the 2011 rookie wage scale.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'The article should explain why the rookie wage scale changed team-building incentives.' },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'unsourced-date-claim')).toBe(false);
  });

  it('ignores byline boilerplate when checking supported contract claims', () => {
    const state = runWriterPreflight({
      draft: `# Headline

*Subtitle*

> **📋 TLDR**
> - First takeaway
> - Second takeaway
> - Third takeaway
> - Fourth takeaway

**By: The NFL Lab Expert Panel**
**Geno Smith**'s $32 million extension would reshape the room.`,
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: "Geno Smith's $32 million extension would reshape the room." },
      ],
    });

    expect(state.blockingIssues).toHaveLength(0);
  });

  it('does not flag generic historical season framing as an unsupported date claim', () => {
    const state = runWriterPreflight({
      draft: 'The franchise has been chasing this since the 2020 season, when the roster reset really started.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Explain the long arc of the roster reset without overclaiming precise dates.' },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'unsourced-date-claim')).toBe(false);
  });

  it('accepts paraphrased supported timeline claims with the same dated event details', () => {
    const state = runWriterPreflight({
      draft: "Geno Smith's March 2026 extension changed the Seahawks' options.",
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'The Seahawks agreed to an extension with Geno Smith in March 2026, which changed their options.' },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'unsourced-date-claim')).toBe(false);
  });
});

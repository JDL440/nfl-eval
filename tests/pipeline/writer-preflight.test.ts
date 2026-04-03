import { describe, expect, it } from 'vitest';

import { buildWriterPreflightArtifact, buildWriterPreflightChecklist, findContentPurityIssues, runWriterPreflight } from '../../src/pipeline/writer-preflight.js';

describe('writer preflight', () => {
  it('builds a short checklist focused on top blockers', () => {
    const checklist = buildWriterPreflightChecklist();

    expect(checklist).toContain('short editor-style preflight on only the top blockers');
    expect(checklist).toContain('do not stop the draft over harmless name expansions');
    expect(checklist).toContain('contract figure, date, draft fact, or stat');
    expect(checklist).toContain('No guesswork');
  });

  it('downgrades unsupported name variants against supplied artifacts to warnings', () => {
    const state = runWriterPreflight({
      draft: '**Jackson Smith-Njigba** is about to become the offense\'s hinge point.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Jaxon Smith-Njigba is the featured separator in this offense.' },
      ],
    });

    expect(state.blockingIssues).toHaveLength(0);
    expect(state.warnings).toHaveLength(1);
    expect(state.warnings[0]?.code).toBe('name-consistency');
    expect(state.warnings[0]?.message).toContain('Jaxon Smith-Njigba');
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

  it('flags unsupported precise claims as advisory, allows supported local claims through', () => {
    const unsupported = runWriterPreflight({
      draft: '**Geno Smith** has a $32 million extension lined up after his 4,320 passing yards in 2026.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Geno Smith remains the quarterback question, but keep contract language cautious.' },
      ],
    });

    expect(unsupported.advisoryIssues.some((issue) => issue.code === 'unsourced-contract-claim')).toBe(true);
    expect(unsupported.advisoryIssues.some((issue) => issue.code === 'unsourced-stat-claim')).toBe(true);
    expect(unsupported.blockingIssues).toHaveLength(0);

    const supported = runWriterPreflight({
      draft: '**Geno Smith** is playing on a $32 million extension after his 4,320 passing yards in 2026.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Geno Smith is playing on a $32 million extension after his 4,320 passing yards in 2026.' },
      ],
    });

    expect(supported.blockingIssues).toHaveLength(0);
    expect(supported.advisoryIssues).toHaveLength(0);
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
      finalState: { blockingIssues: [], advisoryIssues: [], warnings: [] },
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
    expect(state.advisoryIssues.some((issue) => issue.code === 'unsourced-date-claim')).toBe(false);
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
    expect(state.advisoryIssues).toHaveLength(0);
  });

  it('does not flag generic historical season framing as an unsupported date claim', () => {
    const state = runWriterPreflight({
      draft: 'The franchise has been chasing this since the 2020 season, when the roster reset really started.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Explain the long arc of the roster reset without overclaiming precise dates.' },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'unsourced-date-claim')).toBe(false);
    expect(state.advisoryIssues.some((issue) => issue.code === 'unsourced-date-claim')).toBe(false);
  });

  it('accepts paraphrased supported timeline claims with the same dated event details', () => {
    const state = runWriterPreflight({
      draft: "Geno Smith's March 2026 extension changed the Seahawks' options.",
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'The Seahawks agreed to an extension with Geno Smith in March 2026, which changed their options.' },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'unsourced-date-claim')).toBe(false);
    expect(state.advisoryIssues.some((issue) => issue.code === 'unsourced-date-claim')).toBe(false);
  });

  it('classifies unsourced contract claims as advisory, not blocking', () => {
    const state = runWriterPreflight({
      draft: '**Geno Smith** should get a $25M AAV extension to compete in 2026.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'The panel discussed whether the team should pursue a veteran quarterback.' },
      ],
    });

    expect(state.blockingIssues).toHaveLength(0);
    expect(state.advisoryIssues.some((issue) => issue.code === 'unsourced-contract-claim')).toBe(true);
    expect(state.advisoryIssues[0]?.severity).toBe('advisory');
  });

  it('keeps placeholder leakage as blocking even though claims are advisory', () => {
    const state = runWriterPreflight({
      draft: 'TODO: finish lede. Also **Geno Smith** signed a $40M extension.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Write about the quarterback situation.' },
      ],
    });

    expect(state.blockingIssues.some((issue) => issue.code === 'placeholder-leakage')).toBe(true);
    expect(state.advisoryIssues.some((issue) => issue.code === 'unsourced-contract-claim')).toBe(true);
  });

  it('does not extract role titles like "Defense Analyst" as player names', () => {
    const state = runWriterPreflight({
      draft: 'Defense Analyst argues the secondary needs a $15M cornerback.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'Defense Analyst argues the secondary needs investment.' },
      ],
    });

    // Should not flag "Defense Analyst" as a name consistency issue
    expect(state.warnings.some((w) => w.message.includes('Defense Analyst'))).toBe(false);
  });

  it('matches fuzzy support when source contains "trade" keyword', () => {
    const state = runWriterPreflight({
      draft: 'A trade for a veteran QB at $25M would reshape the cap.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'A trade for a veteran QB at $25M would reshape the cap structure going forward.' },
      ],
    });

    expect(state.blockingIssues).toHaveLength(0);
    expect(state.advisoryIssues).toHaveLength(0);
  });

  it('includes advisory issues section in the preflight artifact', () => {
    const artifact = buildWriterPreflightArtifact({
      initialState: { blockingIssues: [], advisoryIssues: [], warnings: [] },
      finalState: {
        blockingIssues: [],
        advisoryIssues: [{
          severity: 'advisory',
          code: 'unsourced-contract-claim',
          message: 'Draft includes "$30M" contract figure',
        }],
        warnings: [],
      },
      repairTriggered: false,
    });

    expect(artifact).toContain('passed with advisories');
    expect(artifact).toContain('Advisory Issues (for human review at publish time)');
    expect(artifact).toContain('[unsourced-contract-claim]');
  });
});

describe('content purity', () => {
  it('flags raw agent IDs used as section headers', () => {
    const issues = findContentPurityIssues('## Introduction\n\nSome text.\n\n## CAP — Salary analysis\n\nMore text.');
    expect(issues.some((i) => i.code === 'raw-agent-id')).toBe(true);
    expect(issues[0]?.severity).toBe('advisory');
  });

  it('flags raw agent IDs used as prose labels', () => {
    const issues = findContentPurityIssues('MEDIA: reported that the team is looking at options. DEFENSE — suggests blitz packages.');
    expect(issues.some((i) => i.code === 'raw-agent-id')).toBe(true);
  });

  it('flags unexplained Path labels', () => {
    const issues = findContentPurityIssues('The team should consider Path A, which offers cap relief.');
    expect(issues.some((i) => i.code === 'unexplained-path-label')).toBe(true);
    expect(issues[0]?.severity).toBe('advisory');
  });

  it('flags meta-commentary about the writing process', () => {
    const issues = findContentPurityIssues('Here is the article based on the expert panel discussion.\n\n# Headline');
    expect(issues.some((i) => i.code === 'meta-commentary')).toBe(true);
  });

  it('flags "Based on the panel discussion" preamble', () => {
    const issues = findContentPurityIssues('Based on the panel discussion, we can see three key areas of concern.');
    expect(issues.some((i) => i.code === 'meta-commentary')).toBe(true);
  });

  it('does not flag clean article content', () => {
    const clean = `# The Seahawks' Cap Crossroads

*Why Seattle's next move defines their competitive window*

> **📋 TLDR**
> - The Seahawks face a $15M cap decision
> - The Salary Cap Analyst sees room for an extension
> - The Draft Analyst prefers trading back
> - The panel recommends a measured approach

**By: The NFL Lab Expert Panel**

The Seahawks are at a crossroads. Their salary cap flexibility this offseason could define the next three years.

> *"The cap structure actually gives Seattle more room than people think."* — **Salary Cap Analyst**`;

    const issues = findContentPurityIssues(clean);
    expect(issues).toHaveLength(0);
  });

  it('does not flag "Path" in non-label contexts', () => {
    const issues = findContentPurityIssues('The Seahawks have a clear path to the playoffs this season.');
    expect(issues).toHaveLength(0);
  });

  it('does not flag team abbreviations in non-label contexts', () => {
    const issues = findContentPurityIssues('The SEA offense ranked 12th in EPA per play last season.');
    expect(issues).toHaveLength(0);
  });

  it('integrates with runWriterPreflight as advisory issues', () => {
    const state = runWriterPreflight({
      draft: '## CAP — Cap Analysis\n\nPath A offers better long-term value.',
      sourceArtifacts: [
        { name: 'discussion-summary.md', content: 'The panel discussed cap implications.' },
      ],
    });

    expect(state.blockingIssues).toHaveLength(0);
    expect(state.advisoryIssues.some((i) => i.code === 'raw-agent-id')).toBe(true);
    expect(state.advisoryIssues.some((i) => i.code === 'unexplained-path-label')).toBe(true);
  });

  it('flags postamble commentary like "I hope this" or "Let me know if"', () => {
    const issues = findContentPurityIssues('Great analysis overall.\n\nI hope this captures the key dynamics of the Seahawks offseason.');
    expect(issues.some((i) => i.code === 'meta-commentary')).toBe(true);
  });

  it('flags "Feel free to adjust" closing notes', () => {
    const issues = findContentPurityIssues('The cap picture is clear.\n\nFeel free to adjust the tone as needed.');
    expect(issues.some((i) => i.code === 'meta-commentary')).toBe(true);
  });

  it('flags editor/reviewer voice leaked into article body', () => {
    const issues = findContentPurityIssues('The draft should include more specific contract numbers for the extension.');
    expect(issues.some((i) => i.code === 'meta-commentary')).toBe(true);
  });

  it('flags self-referential AI language', () => {
    const issues = findContentPurityIssues('As an AI analyst, the data suggests the Seahawks should trade back.');
    expect(issues.some((i) => i.code === 'meta-commentary')).toBe(true);
  });
});

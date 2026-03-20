/**
 * Mock LLM provider for testing and dashboard development.
 *
 * Returns realistic stage-specific content without calling any real LLM API.
 * Enable via MOCK_LLM=1 env var when starting the dashboard.
 */

import type { LLMProvider, ChatRequest, ChatResponse } from '../gateway.js';

// ---------------------------------------------------------------------------
// Stage-specific mock responses
// ---------------------------------------------------------------------------

const MOCK_RESPONSES: Record<string, string> = {
  'discussion-prompt': `# Discussion Prompt: Evaluating the Offseason Strategy

## Central Question
How should the team approach free agency and the draft given their current roster construction and salary cap position?

## Key Discussion Points

1. **Offensive Line Investment** — The unit ranked 22nd in pass block win rate last season. Is it worth spending premium draft capital on a tackle, or can mid-round picks and free agent depth solve the problem?

2. **Secondary Depth** — With two cornerbacks hitting free agency, should the front office prioritize retaining homegrown talent or target younger, cheaper alternatives in the draft?

3. **Quarterback Development** — The starter showed improvement in Year 2, posting a 92.3 passer rating. What investments in weapons or coaching would maximize the leap in Year 3?

4. **Salary Cap Flexibility** — With $45M in projected cap space, how aggressively should the team pursue top-tier free agents versus rolling cap forward for future extensions?

## Expected Deliverables
- Ranked priority list of positional needs
- Free agency targets with projected contract values
- Draft strategy framework (trade up, stand pat, or trade down)`,

  'panel-composition': `# Panel Composition

## Selected Analysts

### 1. Cap Economist — Sarah Mitchell
**Expertise:** Salary cap management, contract structures, dead money implications
**Perspective:** Financial sustainability and long-term roster flexibility
**Key Question:** Can the team address immediate needs without compromising the 2026–2027 windows?

### 2. Film Analyst — Marcus Chen
**Expertise:** All-22 film study, scheme fit analysis, technique evaluation
**Perspective:** On-field performance and schematic alignment
**Key Question:** Which positions are underperforming due to talent vs. coaching vs. scheme?

### 3. Draft Scout — Jameson Wright
**Expertise:** College prospect evaluation, historical draft value analysis
**Key Question:** Where does this draft class offer the best value relative to team needs?

### 4. Analytics Lead — Dr. Priya Sharma
**Expertise:** EPA modeling, win probability, roster construction optimization
**Perspective:** Data-driven decision-making and expected value maximization
**Key Question:** Which investments yield the highest marginal wins added per dollar?

## Panel Dynamics
This panel blends financial, scouting, film, and analytical perspectives to ensure a holistic evaluation of the team's offseason strategy.`,

  'discussion-summary': `# Panel Discussion Summary

## Key Findings

### Consensus Points
1. **Offensive line is the #1 priority** — All four panelists agreed that protecting the franchise QB is non-negotiable. The analytics show a 0.15 EPA/play swing between top-10 and bottom-10 pass-blocking units.

2. **Draft offers better value than free agency for CB** — The panel converged on targeting cornerback in rounds 2-3 rather than overpaying in free agency, citing a 62% hit rate for Day 2 corners vs. the declining performance curves of veteran FA corners.

3. **Retain the #1 WR at market rate** — Losing the top target would cost an estimated 1.2 wins based on replacement-level modeling.

### Points of Debate
- **Trade-up vs. stand pat in Round 1:** The scout favored trading up for the top tackle prospect (ranked #7 overall), while the cap economist warned about the draft capital cost.
- **Veteran pass rusher:** The film analyst pushed for a $15M/year edge rusher, but analytics showed diminishing returns above $12M APY for non-elite rushers.

### Recommended Strategy
1. Sign a mid-tier OT in free agency ($10-12M/year) as insurance
2. Draft BPA at OL/EDGE with the first-round pick
3. Target CB in rounds 2-3
4. Extend the #1 WR before the market resets higher

## Statistical Support
| Position | Draft Hit Rate (Rd 1-3) | FA Success Rate | Recommended Path |
|----------|------------------------|-----------------|------------------|
| OT       | 58%                    | 45%             | FA + Draft       |
| CB       | 62%                    | 38%             | Draft            |
| EDGE     | 52%                    | 41%             | FA (mid-tier)    |`,

  'draft': `# Building Through the Trenches: A Data-Driven Offseason Blueprint

*How one team can maximize its championship window by investing wisely in the 2025 offseason*

---

The conversation around roster building often defaults to skill positions — the flashy receivers, the dynamic running backs, the game-breaking tight ends. But the teams that win consistently in January and February are built from the inside out.

## The Foundation: Offensive Line Overhaul

Last season's pass protection numbers told a damning story. A 22nd-ranked pass block win rate isn't just a statistic — it's a direct threat to the franchise quarterback's development and the team's Super Bowl aspirations.

The data is clear: teams with top-10 offensive lines see a **0.15 EPA/play advantage** over those in the bottom third. Over a 17-game season, that translates to roughly 2.5 additional wins purely from the trenches.

### The Plan

The front office should pursue a two-pronged approach:
1. **Free agency:** Sign a proven veteran tackle in the $10-12M/year range
2. **Draft:** Target the best available offensive lineman in Round 1

This isn't an either/or situation. Championship-caliber lines need depth, and relying solely on one path creates unnecessary risk.

## Secondary Solutions Through the Draft

Here's where the data challenges conventional wisdom. While the instinct might be to splash in free agency for a shutdown corner, the numbers tell a different story:

- **Day 2 draft corners** have a 62% hit rate over the past decade
- **Veteran FA corners** show a 38% success rate relative to their contracts

The sweet spot? Targeting athletic, scheme-versatile cornerbacks in rounds 2-3 while letting the expensive free agent market pass by.

## The Extension That Matters Most

The team's #1 wide receiver is entering a contract year, and replacement-level modeling suggests losing this player would cost approximately **1.2 wins** next season. With the receiver market resetting upward, an early extension — even at a premium — represents better value than testing free agency.

## Looking Ahead

The teams that win championships don't just collect talent — they allocate resources efficiently. By investing in the trenches, drafting smart in the secondary, and locking up core players before the market escalates, this front office can maximize its championship window while maintaining the financial flexibility to adapt.

The blueprint is clear. The question is whether the front office has the discipline to execute it.`,

  'editor-review': `# Editor Review

## Verdict: PUBLISH

## Overall Assessment
Strong analytical piece with clear thesis and solid statistical support. The writing is engaging and accessible to the target audience. Minor adjustments recommended below.

## Strengths
- **Clear narrative arc** — The piece flows logically from problem identification to data analysis to actionable recommendations
- **Statistical integration** — EPA data and hit rates are woven naturally into the prose rather than dumped in isolation
- **Accessible tone** — Complex cap and analytics concepts are explained without condescension

## Suggestions (Minor)
1. **Paragraph 3, Section 1:** Consider adding a specific player comparison to ground the "0.15 EPA/play advantage" — readers connect better with names than abstract numbers
2. **Secondary section:** The 62% hit rate claim would benefit from 2-3 specific examples of successful Day 2 CB picks
3. **Conclusion:** Could be slightly more forward-looking — mention specific upcoming milestones (free agency opening day, draft date) to create urgency

## Fact-Check Items
- ✅ Pass block win rate ranking (22nd) — Verified against PFF data
- ✅ EPA/play advantage (0.15) — Consistent with nflfastR modeling
- ✅ Day 2 CB hit rate (62%) — Verified against draft history database
- ✅ Receiver market reset — Confirmed by recent contract trends

## Publication Notes
- Title is strong and SEO-friendly
- Subtitle effectively frames the analytical angle
- Length is appropriate for the depth level (≈800 words)
- Ready for images and final formatting`,

  'publisher-pass': `# Publisher Pass

## Pre-Publication Checklist

### Content Verification
- [x] **Title finalized:** "Building Through the Trenches: A Data-Driven Offseason Blueprint"
- [x] **Subtitle finalized:** "How one team can maximize its championship window by investing wisely in the 2025 offseason"
- [x] **Body clean:** No placeholder text, no TODO markers, no draft comments
- [x] **Sections assigned:** Analysis → Offseason Strategy
- [x] **Tags set:** offseason, draft, free-agency, offensive-line, analytics

### Metadata
- [x] **URL slug:** building-through-the-trenches-offseason-blueprint
- [x] **Cover image:** Hero image set (trenches illustration)
- [x] **Paywall setting:** Free (everyone)
- [x] **Publish datetime:** 2025-03-15T09:00:00-04:00
- [x] **Email send:** Enabled for all subscribers

### Accuracy Verification
- [x] **Names verified:** All player/personnel references double-checked
- [x] **Numbers current:** Statistics verified against latest available data
- [x] **No stale references:** No outdated transaction or injury references

### Final Status
✅ **READY FOR PUBLICATION**

All checklist items passed. Article is cleared for scheduling.`,
};

// ---------------------------------------------------------------------------
// Context detection
// ---------------------------------------------------------------------------

/** Detect which stage content to return based on request messages. */
function detectStageContext(messages: Array<{ role: string; content: string }>): string {
  const combined = messages.map((m) => m.content).join(' ').toLowerCase();

  if (combined.includes('discussion prompt') || combined.includes('generate a discussion prompt')) {
    return 'discussion-prompt';
  }
  if (combined.includes('panel') && (combined.includes('compose') || combined.includes('composition'))) {
    return 'panel-composition';
  }
  if (combined.includes('write') && (combined.includes('draft') || combined.includes('article draft'))) {
    return 'draft';
  }
  if (combined.includes('moderate') || (combined.includes('discussion') && combined.includes('summary'))) {
    return 'discussion-summary';
  }
  if (combined.includes('editor') && (combined.includes('review') || combined.includes('feedback'))) {
    return 'editor-review';
  }
  if (combined.includes('publisher') && (combined.includes('pass') || combined.includes('publication'))) {
    return 'publisher-pass';
  }

  return 'default';
}

// ---------------------------------------------------------------------------
// MockProvider
// ---------------------------------------------------------------------------

export class MockProvider implements LLMProvider {
  readonly id = 'mock';
  readonly name = 'Mock (Testing)';

  private _callCount = 0;
  private _lastRequest: ChatRequest | null = null;
  private _overrideResponse: string | null = null;
  private _overrideError: Error | null = null;

  /** Number of chat() calls made since creation or last reset. */
  get callCount(): number {
    return this._callCount;
  }

  /** The most recent ChatRequest received, or null if none. */
  get lastRequest(): ChatRequest | null {
    return this._lastRequest;
  }

  /** Override the default response for all subsequent calls. Pass null to clear. */
  setResponse(content: string | null): void {
    this._overrideResponse = content;
  }

  /** Make all subsequent chat() calls throw this error. Pass null to clear. */
  setError(error: Error | null): void {
    this._overrideError = error;
  }

  /** Reset call tracking counters. */
  resetStats(): void {
    this._callCount = 0;
    this._lastRequest = null;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this._callCount++;
    this._lastRequest = request;

    // Simulate realistic latency (200-500ms)
    const delay = 200 + Math.random() * 300;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Simulate failure if configured
    if (this._overrideError) {
      throw this._overrideError;
    }

    // Determine content
    let content: string;
    if (this._overrideResponse !== null) {
      content = this._overrideResponse;
    } else {
      const stage = detectStageContext(request.messages);
      content = MOCK_RESPONSES[stage] ?? `Mock response for request with ${request.messages.length} messages.`;
    }

    const promptTokens = Math.floor(100 + Math.random() * 400);
    const completionTokens = Math.floor(200 + Math.random() * 800);

    return {
      content,
      model: request.model ?? 'mock-model',
      provider: this.id,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: 'stop',
    };
  }

  listModels(): string[] {
    return ['mock-model'];
  }

  supportsModel(_model: string): boolean {
    return true;
  }
}

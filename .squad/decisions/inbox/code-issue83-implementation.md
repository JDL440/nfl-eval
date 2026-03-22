### Issue #83: K5a Wire Fact Checking Into Pipeline — Implementation

**By:** Code (🔧 Dev)
**Date:** 2025-07-19
**Issue:** #83
**PR:** #89 (merged)

**What:** Wired fact-checking into the article pipeline with three new modules covering Option A (pre-compute nflverse context for LLM fact-check) and Option C (deterministic stat/draft validators).

**New modules:**
- `src/pipeline/claim-extractor.ts` — Regex-based extraction of stat, contract, draft, and performance claims from markdown text. Case-sensitive name matching to avoid pronoun false positives.
- `src/pipeline/fact-check-context.ts` — Queries nflverse Python scripts (player EPA, draft history, rosters) and builds `fact-check-context.md` artifact. Follows roster-context.ts architecture: execFileSync, getGlobalCache(), graceful degradation.
- `src/pipeline/validators.ts` — Deterministic post-draft validators: stat claims (10% tolerance OR ±5 absolute), draft claims (round/pick/year match). Produces `fact-validation.md` report.

**Pipeline integration (actions.ts):**
- writeDraft (Stage 4→5): Extract claims from panel outputs → build nflverse lookup context → inject into LLM fact-check prompt
- runEditor (Stage 5→6): Include fact-check-context.md in editor context via context-config.ts
- runPublisherPass (Stage 6→7): Run deterministic validators after existing player mention check → write fact-validation.md artifact

**Key technical decisions:**
1. Regex-only claim extraction — no LLM calls, deterministic, fast (~1ms per article)
2. 10% tolerance + ±5 absolute floor for stat matching (avoids false positives on small numbers)
3. Graceful degradation everywhere — if Python scripts fail or cache is empty, pipeline proceeds normally
4. Pronoun limitation accepted: "He threw for 3,200 yards" won't extract because "He" isn't a player name. Only sentences with explicit name references are validated.

**Test coverage:** 29 new tests (17 claim-extractor, 12 validators). Total suite: 1315 tests passing.

**Future considerations:**
- Coreference resolution (pronoun → name mapping) could boost claim coverage but would require NLP or LLM
- Contract validation not yet wired to nflverse (no contract data in current Python scripts)
- Performance claims (rankings, percentiles) are extracted but not yet deterministically validated

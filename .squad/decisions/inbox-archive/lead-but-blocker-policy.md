# Decision: "But San Francisco" and Sentence-Opener False Positives in Stage 4 Preflight

**Date:** 2026-03-27  
**Owner:** Lead  
**Status:** Policy recommendation for Stage 4 blocker scope  

## Context

Backend raised: "What is actually triggering this and do we even need it to be a blocker?"

Question: Should phrases like "But San Francisco" remain hard Stage 4 blockers when they appear to be sentence openers rather than unsupported name expansions?

## Diagnosis

### What's Triggering It

The `isRejectedNameCandidate()` logic in `writer-preflight.ts` (line 488–499) correctly rejects candidate names whose first token is in `BANNED_FIRST_TOKENS`. The token "But" is in that set (line 75), so "But San Francisco" should be filtered out during name extraction and never contribute to the blocker list.

**If "But San Francisco" is still being reported as a blocker, the flag is likely coming from a different code path:**

1. **Sentence-opener variant:** The phrase appears mid-paragraph in a context the name-extraction regex matches (e.g., after line breaks or whitespace normalization strips markdown), but the rejection logic doesn't catch it.
2. **Writer Support name-consistency path:** If "San Francisco" alone (without "But") appears in supplied artifacts, and the draft says "But San Francisco," the name-consistency blocker (line 228) would flag it as an unsupported expansion of "Francisco."
3. **Edge case in tokenization:** The `tokenizeName()` function (line 481) may normalize "But" differently in some contexts, bypassing the banned-token check.

### True vs. False Positive

**True unsupported name expansion:**
- Artifacts support: `San Francisco 49ers` (or just `49ers`)
- Draft writes: `But San Francisco` ← treating a sentence opener as a location name
- **This is legitimately unsupported and should block.**

**Sentence-opener false positive:**
- Artifacts support: (something unrelated, e.g., `Kyle Shanahan`)
- Draft writes: "But San Francisco has depth at receiver because Kyle Shanahan…"
- Regex matches "But San Francisco" as a candidate name, then rejects it correctly
- **This should NOT block.**

## Policy Recommendation

### Keep the blocker, improve the filter

**Do not remove the name-expansion blocker entirely.** The rule is sound: writers should not invent full-name expansions that don't appear in supplied artifacts.

**Do improve the sentence-opener detection.** Current approach:

- `BANNED_FIRST_TOKENS` blocks common openers like "But," "And," "If," etc. ✓
- `LIVE_SENTENCE_OPENER_TOKENS` is under-populated (only `['If', 'Mention']`) ✗

**Recommended minimal fix:**

Expand `LIVE_SENTENCE_OPENER_TOKENS` from a whitelist of openers to include:
- All conjunctions: `But`, `And`, `Or`, `Yet`, `So`
- All common sentence starters already in `BANNED_FIRST_TOKENS` that are also likely to be followed by a proper noun:
  - Prepositions: `In`, `At`, `Near`, `Beyond`, `From`
  - Common discourse markers: `However`, `Still`, `Thus`, `Therefore` (if they appear in text)

**Why expand `LIVE_SENTENCE_OPENER_TOKENS`?**

The check at line 496 (`parts.slice(0, -1).some((part) => LIVE_SENTENCE_OPENER_TOKENS.has(part))`) is meant to catch multi-word names where a middle token is a sentence opener. It's stricter than the first-token check (line 498) because it doesn't reject entire names—it only rejects if a non-final token is a known opener.

Current code: "But" in position [0] rejects the name outright (line 498).  
Desired intent: "But" in position [0] should also count as a sentence opener, not a name.

### Keep the blocker, but soften the message

If "But San Francisco" is being caught by the NAME_PATTERN but correctly rejected, no blocker should be emitted. If one is being emitted despite rejection, that's a bug in the filtering logic, not a policy issue.

**Minimal message improvement (if a blocker does appear):**

Change the message from:
```
Draft expands "But San Francisco" even though the supplied artifacts only support the "Francisco" reference.
```

To:
```
Draft uses "But San Francisco" as a standalone phrase. If this is a sentence opener ("But San Francisco has…"), remove the capital S. If it's a proper location name, ensure it appears in the supplied artifacts.
```

This distinguishes between sentence openers (lowercase "but") and genuine name mismatches.

## Decision

**Do not redesign the Stage 4 blocker process.**

**Keep the rule:** Writers must not expand names beyond what appears in supplied artifacts.

**Recommended scope change:** 
- Ensure sentence-opener rejection is working correctly (test "But San Francisco" explicitly).
- If rejection is working, no blocker is emitted—no change needed.
- If a blocker is still emitted, debug the tokenization/rejection path rather than exempting the rule.

**Do not add a special exemption for "But X"** because the rule should catch all such cases generically through the existing banned-first-token mechanism.

## Next Steps

1. **Verify:** Run a test case with "But San Francisco" in draft text and no "San Francisco" in supplied artifacts. Confirm no blocker is emitted.
2. **If blocker is emitted despite rejection logic:** Debug `tokenizeName()` and `isRejectedNameCandidate()` to find why the rejection didn't work.
3. **If no blocker is emitted:** The system is already correct; document the expected behavior.

---

**Context artifacts:**
- `src/pipeline/writer-preflight.ts` lines 72–99, 419–500
- `src/pipeline/writer-support.ts` lines 43–71


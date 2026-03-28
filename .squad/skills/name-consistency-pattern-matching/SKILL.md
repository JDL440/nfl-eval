# Skill: Graceful Name Consistency in Prose Context

## Context

Writer-preflight enforces that draft prose uses exact names from source artifacts to avoid hallucination and unsupported expansion. However, natural prose often opens sentences with action verbs followed by person names (e.g., "Take Trent Williams", "Hit the linebacker position"), while artifacts list only bare names.

This skill describes how to handle the tension between regex-based name extraction and prose naturalness.

## Pattern

**The Problem:**
```
Artifacts:    "Trent Williams"
Draft prose:  "Take Trent Williams off the board"
Extracted:    "Take Trent Williams" → normalized to "take trent williams"
Comparison:   "take trent williams" ≠ "trent williams"
Result:       FALSE POSITIVE BLOCKER
```

## Solution: Staged Filtering

### Stage 1: Extraction (Greedy)
Use a greedy NAME_PATTERN regex to capture multi-word candidate names across 2-4 tokens:
```
NAME_PATTERN = /([A-Z][a-z]+...[A-Za-z'-]+)/g
```

Greedy extraction is intentional—it catches valid variations like "Aaron Rodgers", "Pat Freiermuth", "DeAndre Washington".

### Stage 2: Validation (Banned-Lists)
Filter out false positives using deterministic banned-lists:

#### BANNED_FIRST_TOKENS
- Exclude sentence-opener words that are not name parts.
- **Common action verbs (draft/contract context):** Take, Hit, Draft, Grab, Pick, Select, Land, Sign, Ink, Target, Pursue, Add, Trade, Watch, Build, Keep, Leave, Get.
- **Sentence connectors:** The, This, That, Because, If, While, etc. (already included).

#### BANNED_LAST_TOKENS
- Exclude words that close fake names (e.g., team names, artifact names).
- **Team names:** Cardinals, Falcons, Ravens, ..., Seahawks, Buccaneers, Titans, Commanders.
- **Artifact labels:** Panel, Check, Fact, Context, Summary, Prompt, Review, Input, Budget, Article, Verdict.

### Stage 3: Last-Name Fallback
If the extracted name doesn't match a supported name in the artifacts exactly, but the last-name matches, flag an unsupported-name-expansion issue instead of a hard blocker. This allows graceful degradation:
- "Take Trent Williams" → Not in allowlist → But "Williams" is → Warn (upgradeable to pass if writer-support allowlist says OK).

## Migration: Toward Deterministic Allowlists

This heuristic strategy is a **bridge solution** until `writer-support.md` is implemented. Once that artifact exists:

1. The preflight will parse writer-support.md first for the **canonical-names** section.
2. Names in that allowlist will be the source of truth, not fuzzy regex extraction.
3. The regex-based matching can be de-emphasized or removed entirely.

## Implementation Notes

- Keep BANNED_FIRST_TOKENS and BANNED_LAST_TOKENS **finite and specific**. They should reflect real language patterns, not theoretical ones.
- If new patterns emerge in draft prose, add them to the appropriate banned-list rather than expanding the regex complexity.
- Name-consistency should remain a **hard blocker** to catch genuine mismatches (e.g., "Jackson Smith-Njigba" vs. "Jaxon Smith-Njigba"), but the blocker should only fire on non-banned, non-supportable variations.

## Example Test Cases

```typescript
// Action verb + supported name → should PASS
"Take Trent Williams off the board" + "Trent Williams in artifacts" → ✓ no blocker

// Genuine typo + supported last name → should BLOCK
"Jackson Smith-Njigba" + "Jaxon Smith-Njigba in artifacts" → ✗ name-consistency blocker

// Full name not supported, only last name → should WARN (unsupported-name-expansion)
"Take Pat Freiermuth" + only "Freiermuth" in artifacts → ⚠ unsupported-name-expansion

// Sentence connector + supported name → should PASS
"If Aaron Rodgers returns..." + "Aaron Rodgers in artifacts" → ✓ no blocker
```

## Related Decisions

- **Writer Support Artifact:** Decided 2026-03-27; specifies canonical-names allowlist to replace regex matching.
- **Sentence Starter Policy:** Lead assessment 2026-03-27; specifies action verb banned-list as bridge solution.

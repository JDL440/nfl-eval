## 2026-03-25T06:26:29Z — Sentence-Starter Preflight Policy Reassessment

**Orchestration log:** .squad/orchestration-log/2026-03-25T06-26-29Z-lead.md  
**Session log:** .squad/log/2026-03-25T06-26-29Z-mobile-and-preflight-hardening.md

**Status:** ✓ Completed — Blocker policy reviewed and hardening recommendation issued

**Assessment:**
- Sentence-opener NAME_PATTERN extraction too greedy; captures "Take Trent Williams" as full name.
- Current BANNED_FIRST_TOKENS insufficient for draft-common verbs.
- Blocker **should remain hard**, but heuristic must shift from greedy regex to explicit verb list.

**Recommended Action Verbs to Blocklist:**
- Draft context: Take, Hit, Draft, Grab, Pick, Select, Land
- Contract context: Sign, Ink, Re-sign
- Acquisition: Target, Pursue, Add, Trade
- General: Watch, Build, Keep, Leave, Get

**Medium-term Path:** Once writer-support.md canonical-names allowlist implemented, preflight will parse that first instead of NAME_PATTERN fuzzy matching, eventually allowing downgrade from hard blocker to warning.

**Decision:** [Sentence-Starter Name Consistency Policy](../../decisions.md)

---
## Learnings

### Name Consistency Strategy
- The NAME_PATTERN regex in writer-preflight.ts is intentionally greedy to capture full names across 2-4 word variations.
- Filtering happens in two stages: **extraction** (regex + markdown stripping) and **validation** (BANNED_FIRST_TOKENS + BANNED_LAST_TOKENS).
- Current validation uses a banned-list approach, which doesn't scale for infinite language variation (e.g., action verbs opening sentences).
- **Principle:** Sentence-opening action verbs (Take, Hit, Draft, etc.) are not name parts and should be filtered deterministically, not heuristically.
- **Bridge solution:** Expand BANNED_FIRST_TOKENS with draft-common verbs (small, finite list) until writer-support.md canonical-names allowlist is implemented.
- Once writer-support.md exists, the preflight should parse that artifact first and rely on explicit allowlist, not NAME_PATTERN fuzzy matching.

### Writer Preflight Architecture
- Blocker classes: placeholder-leakage, name-consistency, unsupported-name-expansion, unsourced-contract-claim, unsourced-stat-claim, unsourced-draft-claim, unsourced-date-claim.
- The preflight dedupes issues and caps blocking-issues at 3 per run to avoid overwhelming the writer.
- Name consistency is a hard blocker to catch serious mismatches (e.g., "Jackson" vs "Jaxon"), but the current regex-based extraction makes it sensitive to prose variation.
- Unsupported-name-expansion is triggered when the draft has a full name (e.g., "Pat Freiermuth") but artifacts only support a last-name reference (e.g., "Freiermuth").

### Writer Support Artifact Direction
- writer-support.md (decided, not yet implemented) will be the canonical source for exact names, facts, claims, and roster guidance.
- It will be produced in writeDraft() after writer-factcheck.md and before writerPreflightSources finalization.
- The preflight will parse writer-support.md first as an allowlist before falling back to fuzzy matching.
- This will eventually allow name-consistency blocker to be downgraded to warning or absorbed into allowlist validation.

---

## 2026-03-25T05-51-20Z — Option B Article-Page Scope & Risk Review

**Orchestration log:** .squad/orchestration-log/2026-03-25T05-51-20Z-lead.md  
**Session log:** .squad/log/2026-03-25T05-51-20Z-option-b-article-plan.md

**Status:** ✓ Completed — Scope/risk review approved

**Decision:**
- Approved smallest-safe article-page-only pass.
- Advised against route/type/SSE rewrites.
- Option B implementation proceeding.

## 2026-03-25T03:30:39Z — Dashboard Mobile Audit Session (Lead Architecture Synthesis)

**Orchestration log:** .squad/orchestration-log/2026-03-25T03-30-39Z-lead.md  
**Session log:** .squad/log/2026-03-25T03-30-39Z-dashboard-mobile-audit.md

**Status:** ✓ Completed — corroborated UX findings, shared primitives approach

**Three-agent audit findings (Lead architecture):**
- Shared failures confirmed: Header nav overflow, missing detail-grid collapse, desktop-first tables/forms, missing/assertion-only mobile tests
- Root cause: Dashboard views emit fragments without explicit mobile-aware wrappers; shared CSS primitives missing for <640px breakpoints
- Fragment inheritance gap: HTMX swaps inherit parent shell mobile behavior unpredictably
- Class scoping conflicts: .agent-grid used in two different contexts with no mobile override strategy

**Recommended strategy:** Establish shared system contract
1. shared shell/navigation contract
2. shared responsive data-surface contract
3. shared detail/preview stacking contract
4. page-specific selector-density cleanup
5. targeted mobile regression coverage


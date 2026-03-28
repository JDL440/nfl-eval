---
name: Workflow Churn Simplification via Contract Boundary Clarification
domain: pipeline-architecture
confidence: high
tools: [lsp, grep, view]
---

# Workflow Churn Simplification via Contract Boundary Clarification

## When to Use

- A review/approval loop is cycling 5+ times on the same article with overlapping feedback
- Multiple agents (Writer, Validator, Editor, Lead) all validate the same aspect of an artifact
- Revision feedback is symmetric and unclear about priorities (both blocking and advisory mixed)
- Auto-approval or force-advance logic exists because the loop is too expensive to keep open
- Tests assert on complex retry behavior (e.g., max-revision force-approve, prior-review accumulation)

## Pattern

**Churn is usually structural, not prompting.**

When Writer, runtime validator, and Editor all police overlapping parts of the same contract, the system becomes:
1. **Unclear about responsibility:** Who owns draft quality? Structure? Accuracy?
2. **Expensive to revise:** Each agent's feedback must be addressed separately, but overlapping issues create multiple touch-cycles
3. **Asymmetric in feedback:** Writer sees both blocking issues (structure) and advisory (tone), doesn't know what matters
4. **Expensive to test:** Complex retry logic, state preservation, and escalation machinery clutters the control flow

The clean answer is **boundary simplification**, not smarter AI:

- **Writer** owns the draft (with better upfront support artifact)
- **Runtime** enforces only deterministic safety (empty draft? missing TLDR? obvious placeholders?)
- **Editor** enforces only accuracy (right names? supported stats? stale claims?)
- **Lead** escalates genuinely hard articles (not just "loop exhaustion")

## Implementation Guidance

### 1. Define explicit artifact contract boundaries

Create a support artifact that Writer consumes upfront (before drafting):

- Canonical names and title/nickname variants
- Exact supported facts (stats, dates, contract figures)
- Claims that are risky or require attribution
- Freshness notes (as_of dates, known stale info)

**Why:** Writer gets one source of truth instead of inferring from mixed prose + advisory context.

### 2. Minimize runtime validation to deterministic checks

Keep only blocking validation that prevents malformed input to downstream:

- **Keep:** Empty draft, headline missing, TLDR block missing
- **Downgrade to warnings:** Sentence-starter heuristics, uncertain names, soft claim flags

**Why:** Runtime guards prevent total garbage from reaching Editor, but shouldn't do Editor's job.

### 3. Collapse blocker types to strict taxonomy

Define exactly which blocker types the approval gate (Editor) may emit:

**Accuracy blockers (Editor's job):**
- `accuracy:wrong-name` — Player/coach/team mismatch
- `accuracy:unsupported-stat` — Fact claimed but not sourced
- `accuracy:stale-claim` — Outdated or contradicted info
- `accuracy:fabricated-quote` — Quote without attribution

**Do not emit:**
- `structure:missing-tldr` (Writer's job, caught by runtime)
- `structure:bad-placement` (Writer's job, not Editor's)
- `style:tone` (not a blocker; suggestion at best)

**Why:** Strict taxonomy prevents feature creep and makes escalation signal clear (repeated accuracy failures = real gap).

### 4. Cap revisions and escalate instead of force-approve

Replace max-revision force-approve logic with Lead escalation:

```
Revision attempt 1: fails → Editor feedback → Writer revises
Revision attempt 2: fails → Editor feedback → Writer revises
Revision attempt 3: fails → Escalate to Lead (not auto-approve)
```

**Why:** Honest signal (human review) instead of silent auto-approval. Surfaces genuinely hard articles.

### 5. Reduce context fed to Editor in revision loop

When an article is in revision (Stage 4, status='revision'):

- **Keep:** Latest draft + writer support artifact + minimal roster context
- **Drop:** "Your previous reviews" accumulation + revision history details

**Why:** If Editor is accuracy-only, it should judge the current draft, not maintain conversation history.

### 6. Align UX semantics to match the simplified workflow

When article is in revision state (Stage 4, status='revision'):

- **Stage label:** "Revision Workspace" (not "Panel Discussion")
- **Artifact priority:** Editor feedback → Latest draft → Discussion context
- **Status line:** "Revision requested · Next: Article Drafting" (not "Revision requested")

**Why:** UX should reflect the real workflow. Revision is draft work, not "back to discussion."

## Files to Update (Template)

| Phase | Component | Action |
|-------|-----------|--------|
| 1 | Writer charter | Add explicit support artifact reference |
| 1 | Writer context assembly | Create/assemble support artifact upfront |
| 2 | Runtime validator | Downgrade non-critical preflight to warnings |
| 2 | Structure inspector | Reduce to deterministic checks only |
| 3 | Editor charter | Rewrite as accuracy-only gate |
| 3 | Editor skill | Delete suggestions/notes sections; simplify output |
| 4 | Revision loop logic | Delete force-approve; add Lead escalation at cap |
| 5 | Editor context builder | Remove prior-reviews accumulation |
| 6 | Dashboard article view | Update labels + artifact priority for revision state |

## Testing Strategy

### Protected behaviors (must not regress)

- [ ] Revision regresses to Writer stage (not runtime-only)
- [ ] Lead escalation metadata is structured and tracked
- [ ] Blocker fingerprints match Editor output format
- [ ] Minimal structure validation still blocks truly malformed input

### New test assertions

- [ ] Editor emits only accuracy blocker types
- [ ] 3rd revision failure triggers Lead escalation (not force-approve)
- [ ] Prior-reviews context absent from Editor prompt during revision
- [ ] Draft revision loop is symmetric (Editor → Writer → Editor, not looping within Writer)

## Runtime Fallback: Blockerless REVISE Normalization

When the approval gate still returns `REVISE` but cannot name a canonical blocker, add a runtime seam before the revision loop continues:

1. Detect `REVISE` with zero `[BLOCKER type:id]` lines.
2. Re-run the editor once with a blocker-only normalization instruction.
3. If the normalized review still has no canonical blocker, downgrade it to advisory approval instead of consuming another revision cycle.

**Why:** this preserves hard blockers for obvious factual failures while preventing evidence-polish or teaser-polish complaints from exhausting the revision cap and falsely escalating to Lead.

### Validation batch process

1. After minimizing preflight: Monitor 20–30 articles. Confirm draft quality reaching Editor is acceptable.
2. After Editor accuracy-only: Confirm Editor outputs parse cleanly, no structure noise.
3. After revision cap: Run 50+ articles. Confirm escalation rate 5–10% (vs. current silent force-approve).
4. After UX alignment: Confirm revision workflow is intuitive; draft/feedback tabs prominent.

## Risks & Mitigations

| Risk | Exposure | Mitigation |
|------|----------|-----------|
| Worse drafts reach Editor | Medium | Better support artifact + good runtime guard = manageable |
| Structure slips | Medium-High | Keep minimal deterministic checks; TLDR block required |
| Lead sees more escalations | Expected | That is the goal; document reason in escalation artifact |
| Blocker vocabulary diverges | High | Define canonical types upfront; validate Editor output format |

## Example: NFL Lab Article Pipeline

**Before:** Writer → (writer-preflight blocker) → Editor → (revision loop, max 5–10, force-approve at cap) → Lead → Publish

**After:** 
- Writer (with better support artifact) → (minimal runtime guard: empty? placeholder?) → Editor (accuracy only) → (max 2 revisions, 3rd escalates to Lead) → Lead (genuine gaps, not loop exhaustion) → Publish

**Result:** 
- Revision cycles: 2.5–3.5 → 1.5–2.0
- Lead escalations: ~5% → ~10% (better quality signal, not loop exhaustion)
- Code reduction: 500+ lines (deleted revision machinery, simplified charters)

## See Also

- Sentence-Starter Name Consistency Policy (banned-list approach to action verb filtering)
- Article Status Hierarchy (UX for revision state labeling)
- Charter-Driven Agent Selector (when to use explicit charters vs. skill-based prompting)

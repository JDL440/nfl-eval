# Research Report: Why articles keep getting stuck before publishing, and what evidence/input the pipeline needs to stop that happening

## Executive Summary

This repo’s article pipeline gets stuck before publishing primarily when the **Stage 4→5 writer handoff** produces a draft that fails deterministic validation: structure checks, name-consistency checks, and unsupported exact-claim checks all run before the article can advance to Editor, and the pipeline only gives the writer **one self-heal retry** before failing the run.[^1][^2][^3]

In the Ravens / Isaiah Likely case, the blocker was **not primarily “Isaiah Likely is on the wrong team”**. The live failure was a writer-preflight parser problem: inline-code/backtick formatting and sentence-opener prose were being misread as exact contract/name claims, which produced bogus blockers like `Isaiah Likely\` in an `\$11M`, `If Flowers`, and `Mention Zay Flowers`.[^4][^5] A validated patch in the clean worktree hardens markdown stripping and name extraction, and when run against the live Ravens artifact mix it reduces the current live article to **zero writer-preflight blockers**.[^6][^7]

That said, the bigger process issue is real: the system still requires **better structured evidence upstream** if you want fewer stalls. In practice, the writer needs a canonical player-identity ledger, a structured exact-claim ledger, clearer separation between *analysis ranges* and *verified facts*, and fresh roster/transaction context with an explicit `as_of` contract. Without that, the writer is forced to infer too much from prose-heavy panel output, and deterministic preflight will keep catching it.[^2][^3][^8][^9]

## Architecture / Process Overview

The pipeline stages are defined as:

- Stage 4: `Panel Discussion`
- Stage 5: `Article Drafting`
- Stage 6: `Editor Pass`
- Stage 7: `Publisher Pass`
- Stage 8: `Published`[^10]

The relevant flow for this problem is:

```text
Panel discussion artifacts
        |
        v
writeDraft()  [Stage 4→5 handoff]
  |- gather panel artifacts
  |- ensure roster context
  |- build fact-check context
  |- run writer
  |- validate draft:
      * structure
      * writer preflight
  |- if failed: one self-heal retry
  |- if still failed: stage run fails
        |
        v
runEditor()   [Stage 5→6]
  |- roster/team validation instructions
        |
        v
runPublisherPass() [Stage 6→7]
  |- deterministic roster + fact validation
```

The writer handoff is implemented in `writeDraft()`: it gathers `discussion-summary.md`, panel artifacts, `panel-factcheck.md`, `fact-check-context.md`, `roster-context.md`, and `writer-factcheck.md`, then validates the draft and retries once if it fails. If the second pass still fails, the article does not advance.[^2] The writer task itself explicitly tells the model to use the bounded writer fact-check contract and then pass a short editor-style preflight before returning the article.[^3]

## What actually caused the Ravens / Isaiah Likely article to get stuck

The live article `the-ravens-biggest-2026-decision-isnt-wr-its-choosing-a-tigh` was still at `current_stage = 4`, and the latest `stage_runs` note showed a Stage 4 failure: `Writer draft failed validation after self-heal: Draft includes unsupported precise contract language ("Isaiah Likely\` in an \`\$11M")...`.[^4]

That error was misleading in two ways:

1. The source material **did** already contain contract-lane prose in the discussion summary, so the failure was not simply “the writer invented a number from nothing.” The panel summary included Likely / Andrews working ranges, but they were rendered in markdown-heavy prose and tables with code formatting around names and dollar values.[^11]
2. The preflight/name extraction logic on `main` was brittle. It used regex-based name and claim extraction plus light markdown stripping; that allowed formatted prose to generate garbage snippets and false names. On `main`, the preflight logic blocks unsupported names and unsupported exact figures, but its markdown stripping and banned-token logic are not yet robust enough for live-style prose like `If Flowers...` or code-span figures like `` `$11M-$15M` ``.[^12]

The pending fix in `C:\github\nfl-eval\worktrees\writer-contract-precision-fix` changes two important things:

- `claim-extractor.ts` now strips visible markdown formatting while preserving the inline text (including escaped dollars), sanitizes extracted raw snippets, and uses the cleaned text for contract/stat/draft/performance claim extraction.[^6]
- `writer-preflight.ts` now reuses that shared markdown cleanup and rejects sentence-opener pseudo-names such as `If` and `Mention`, along with other live-style prose traps, before they become blocking name issues.[^7]

Focused regressions were added for exactly the Ravens-style cases: malformed escaped-dollar contract snippets, sentence-opener name traps (`If Flowers`, `Mention Zay Flowers`), and a live-style artifact mix that should not generate bogus name blockers.[^13]

Most importantly, the patched build was run directly against the **live Ravens artifacts** from `~/.nfl-lab/pipeline.db`, and the result was:

- `blockingIssues: []`
- `warnings: []`[^5]

So, for this specific incident, the main reason the article got stuck was **parser / evidence-extraction noise**, not a legitimate hard fact that “Isaiah Likely is no longer on the Ravens.”

## Does Isaiah Likely being “not on the Ravens anymore” explain this failure?

Not in the current code path.

The repo’s local roster helper still returns Isaiah Likely as an active Baltimore player for the 2025 season (`team: BAL`, `status: ACT`).[^14] I could not confirm a 2026 roster change from repo-local tooling because the 2026 roster query path currently crashes on a schema mismatch (`week` column missing), so I cannot verify your belief from the local datasets alone.[^15]

More importantly, the Stage 4 writer failure path is **not where roster mismatches are enforced**. The stronger roster/team-assignment instructions appear in the **Editor** stage: the editor is told to use current roster context, flag “different team” as an error, and treat “not found in roster” as only a caution because roster data may lag recent transactions by 24–48 hours.[^16] Publisher then runs deterministic roster-validation and fact-validation near the 6→7 handoff.[^17]

So if Isaiah Likely truly had left Baltimore, that should be surfaced later as an editor/publisher fact problem — not as the malformed Stage 4 writer-preflight contract error you saw here.[^16][^17]

## What the writer actually needs to avoid getting stuck

### 1. A canonical player identity artifact, not just prose references

Writer preflight enforces exact-name consistency: if the draft uses a full name that the supplied artifacts do not support, it blocks the draft.[^12] That means prose-only panel summaries are fragile. If one artifact says `Flowers`, another says `Zay Flowers`, and another only implies the person in a table, the writer is forced to infer identity from context.

**What to provide:** a structured `player-ledger.md` or `player-ledger.json` per article with canonical full name, team, role, and allowed aliases. This should be generated upstream from roster context plus article participants, then injected into writer and editor contexts. The pipeline already has roster context generation; it just does not yet expose a dedicated identity artifact for exact-name support at the writer-preflight layer.[^2][^16]

### 2. A structured exact-claim ledger for stats / draft facts / contract figures

Writer preflight is intentionally strict: exact contract figures, dates, draft facts, and stats must be present in supplied artifacts or the bounded writer fact-check, or they block the draft.[^12] The writer task reiterates that rule before every draft.[^3]

At the same time, the bounded writer fact-check explicitly says there is **no deterministic contract helper** in this slice; contract claims are logged as omitted/advisory and should be attributed cautiously, softened, or omitted.[^8] That means the system currently lacks a strong middle layer for exact contract support.

**What to provide:** a machine-readable `claim-ledger` artifact with fields like:

- `claim_type` (`contract`, `stat`, `draft`, `date`)
- `subject`
- `exact_value`
- `support_status` (`verified`, `attributed`, `analysis_only`, `unsupported`)
- `source_artifact`
- `as_of`
- `allowed_prose_treatment`

This would prevent the writer from guessing whether a numeric range is a verified fact, a panel hypothesis, or something that must be softened.

### 3. Separation between “analysis lane/range” and “verified contract fact” 

The Ravens discussion summary mixed snap usage, role analysis, and contract-lane ranges inside prose/tables. That is fine for human reading, but risky for deterministic exact-claim parsing.[^11]

**What to provide:** separate sections or fields for:

- **Verified facts**
- **Attributed claims**
- **Panel analysis / working ranges**

If a panelist says “Likely is in an `$11M-$15M` working lane,” that should not be stored in the same semantic bucket as “Likely signed for $11M” unless it is verified. The current writer-fact-check artifact already has the right conceptual sections (`Verified Facts Used in Draft`, `Attributed but Not Fully Verified`, `Unverified / Omitted Claims`), but it needs stronger structured population upstream to reduce ambiguity.[^9]

### 4. Fresh roster / transaction context with `as_of` dates at writer time, not just editor time

The editor instructions already acknowledge roster drift and tell the editor not to reject purely because a player is missing from a lagging roster dataset.[^16] That is a good late-stage rule, but it arrives too late to help the writer decide how bold to be when framing player/team claims.

**What to provide:** a writer-visible transaction / roster artifact that includes:

- `as_of` timestamp
- team assignment confidence
- recent transactions or uncertainty notes
- “safe phrasing” guidance when data freshness is uncertain

This is especially important when the user’s mental model (“I don’t think Likely is still on the Ravens”) diverges from the locally cached roster data. Right now, the system can detect that discrepancy only imperfectly and mainly at later stages.[^14][^16]

### 5. Cleaner upstream formatting for machine-read artifacts

The claim extractor on `main` was originally too weak to handle markdown-heavy inline formatting robustly, which is exactly what the Ravens article exposed.[^12] The pending patch hardens this by stripping visible formatting while keeping the text content, and by sanitizing extracted claim snippets before preflight reports them.[^6][^7]

**What to provide:** less decorative markdown in machine-consumed artifacts. In particular:

- avoid wrapping every player name and number in code spans
- avoid escaped-dollar formatting when plain `$11M-$15M` is enough
- use simple tables or structured sections for exact facts

Even with the patch, normalized source formatting will make the system more stable.

### 6. More tolerance / routing for unresolved-but-analytical claims

Right now, preflight takes an all-or-nothing stance on unsupported exact figures, and `writeDraft()` only retries once.[^1][^2] Because `BLOCKING_ISSUE_LIMIT` is only 3, parser noise or multiple related exact-claim issues can easily consume the writer’s one self-heal and keep the article from reaching Editor.[^12]

**What to provide or change:**

- allow a deterministic downgrade path from `exact contract figure` → `analysis range / attributed claim`
- log that downgrade in `writer-factcheck.md`
- optionally route unresolved contract precision to Editor as a caution rather than a Stage 4 hard fail when the prose is clearly analytical rather than declarative fact

This is a product / policy choice, not just a parser fix, but it would reduce churn dramatically.

## Concrete recommendations, in priority order

### Priority 0: Ship the validated parser/preflight hardening

The clean worktree patch already fixes the Ravens-style markdown and sentence-opener failure family and validates cleanly on focused tests, `npm run v2:build`, and the live Ravens artifact mix.[^5][^6][^7][^13]

### Priority 1: Add a canonical per-article player ledger

This is the single highest-leverage input improvement. If writer preflight is going to enforce exact-name consistency, the writer needs a deterministic identity source instead of relying on prose.[^12]

### Priority 2: Add a structured claim ledger with support status

The writer and preflight should not have to infer whether `$11M-$15M` is a verified contract fact or just a panel working range. The current writer-fact-check contract is already organized around verified / attributed / omitted claims; it needs stronger structured inputs.[^8][^9]

### Priority 3: Give writer a fresher roster / transaction snapshot with `as_of`

This avoids confusion when a user believes a player has changed teams but the cached local roster disagrees. It also lets the writer pick safer wording before editor review.[^14][^16]

### Priority 4: Normalize panel-output formatting for machine consumption

Use plain text or structured fields for exact figures. Save the heavy markdown flourish for the final draft, not upstream machine-read artifacts.[^6][^11]

### Priority 5: Consider a softer fallback path for unresolved exact contract prose

If exact contract figures are unresolved and the writer-fact-check has no deterministic contract helper, the pipeline should be able to convert them into attributed/softened analysis instead of hard-failing the whole stage after one retry.[^1][^2][^8]

## Confidence Assessment

**High confidence:**

- Stage 4→5 writer validation is where this article got stuck, and the failure happened after one self-heal retry.[^1][^2][^4]
- This specific Ravens incident was caused largely by markdown/prose extraction noise, not purely by absence of evidence.[^4][^5][^6][^7]
- The pending patch in `writer-contract-precision-fix` removes the bogus blockers and validates against the live artifact mix.[^5][^6][^7][^13]
- The writer currently lacks a deterministic contract helper, so contract precision is still a structurally weak part of the pipeline.[^8]

**Medium confidence:**

- A canonical player ledger and structured claim ledger would materially reduce stalls, because they directly address the evidence gaps exposed by current preflight rules.[^2][^8][^9][^12]
- A softer fallback path for analytical contract ranges would reduce unnecessary hard failures, but that is a product-policy change and may have trade-offs around factual rigor.[^1][^2][^12]

**Low confidence / explicitly unverified:**

- I cannot confirm from repo-local data that Isaiah Likely is no longer on the Ravens in 2026. The 2025 local roster data still says BAL/ACT, and the 2026 local roster query path currently fails because of a schema bug in the query script.[^14][^15]

## Footnotes

[^1]: `C:\github\nfl-eval\src\pipeline\actions.ts:430-449` and `C:\github\nfl-eval\src\pipeline\actions.ts:453-468`.
[^2]: `C:\github\nfl-eval\src\pipeline\actions.ts:1027-1127` and `C:\github\nfl-eval\src\pipeline\actions.ts:1164-1239`.
[^3]: `C:\github\nfl-eval\src\pipeline\actions.ts:451-458` and `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:21-26`.
[^4]: Runtime inspection of `~/.nfl-lab/pipeline.db` on 2026-03-25 for article `the-ravens-biggest-2026-decision-isnt-wr-its-choosing-a-tigh`: `articles.current_stage = 4`; latest `stage_runs` row had `stage = 4`, `status = failed`, and note `Writer draft failed validation after self-heal: Draft includes unsupported precise contract language ("Isaiah Likely\` in an \`\$11M")...`.
[^5]: Runtime validation re-run from `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\dist\pipeline\writer-preflight.js` against the live Ravens artifacts in `~/.nfl-lab/pipeline.db` returned `{ "blockingIssues": [], "warnings": [] }` on 2026-03-25.
[^6]: `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\src\pipeline\claim-extractor.ts:57-89`, `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\src\pipeline\claim-extractor.ts:148-207`.
[^7]: `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\src\pipeline\writer-preflight.ts:28-37`, `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\src\pipeline\writer-preflight.ts:74-91`, `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\src\pipeline\writer-preflight.ts:351-429`.
[^8]: `C:\github\nfl-eval\src\pipeline\writer-factcheck.ts:276-287`.
[^9]: `C:\github\nfl-eval\src\config\defaults\skills\writer-fact-check.md:15-19`, `C:\github\nfl-eval\src\config\defaults\skills\writer-fact-check.md:21-39`, `C:\github\nfl-eval\src\config\defaults\skills\writer-fact-check.md:85-98`.
[^10]: `C:\github\nfl-eval\src\types.ts:1-18`.
[^11]: Runtime inspection of `~/.nfl-lab/pipeline.db` on 2026-03-25 for artifact `discussion-summary.md` on article `the-ravens-biggest-2026-decision-isnt-wr-its-choosing-a-tigh`; the panel summary included Likely / Andrews working ranges rendered in markdown-heavy table prose.
[^12]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:21-26`, `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:46-77`, `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:118-143`, `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:169-251`, `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:337-373`.
[^13]: `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\tests\pipeline\writer-preflight.test.ts:61-79`, `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\tests\pipeline\writer-preflight.test.ts:81-126`, `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\tests\pipeline\writer-preflight.test.ts:128-180`.
[^14]: `nfl-eval-local-query_rosters(player='Isaiah Likely', season=2025)` returned `team: BAL`, `status: ACT`, `position: TE`, `season: 2025`.
[^15]: `nfl-eval-local-query_rosters(player='Isaiah Likely', season=2026)` failed on 2026-03-25 with `ColumnNotFoundError: unable to find column "week"`, so repo-local 2026 roster status could not be verified from that path.
[^16]: `C:\github\nfl-eval\src\pipeline\actions.ts:1282-1288`.
[^17]: `C:\github\nfl-eval\src\pipeline\actions.ts:1354-1408`.

# What the two Stage 4 preflight errors say about the current changes

## Executive summary

The two surfaced errors are a sign that the new Stage 5 writer preflight is pointed at the right problem, but is still in an early hardening phase. It is now catching editor-style factual blockers *before* Editor, because `writeDraft()` injects the checklist, validates the writer output with `runWriterPreflight()`, retries once, and persists `writer-preflight.md` for visibility.[^actions-writer-task][^actions-preflight-flow] That is the good news.

The more important takeaway is that both failures came from the same design property: the current preflight is mostly **lexical and pattern-based**, not semantic. It scans the draft and source artifacts with regexes, token banlists, exact-text support checks, and a small fuzzy fallback.[^preflight-run][^preflight-name-patterns][^preflight-support] That makes it effective at catching obvious unsupported specifics, but also prone to false positives when article prose, branding, or historical framing happens to resemble a risky claim.

So my read is: **do not greatly simplify by removing the preflight**. Instead, keep it, but tighten the heuristics around a few structural and historical-framing seams. The current failures say the rollout has crossed from “missing the editor’s top blockers” into “tuning the false-positive boundary.”

## What the two specific errors reveal

### 1. `Lab Cowboys` showed that name support is still regex-first and banlist-driven

The name check works by extracting candidate multi-word proper names from *all supplied source artifacts* and from the writer draft using `NAME_PATTERN`, then comparing normalized forms and last-name support.[^preflight-name-patterns][^preflight-name-check] The original false positive happened because branding/team phrases could be interpreted as person-like names unless they were explicitly filtered out. The current code now blocks `NFL` and `Lab` as first tokens and blocks NFL team nicknames like `Cowboys` and `Seahawks` as last tokens.[^preflight-banned-tokens]

That fix is good and necessary, but it also tells us something important: the current name logic is still relying on **negative filtering after broad extraction**, not on a stronger notion of “this is actually a person mention.” In other words, it will continue to improve through better guardrails, but the mode of failure will tend to be “some title-cased phrase got treated like a name” whenever a new branding or heading pattern slips past the banlists.[^preflight-name-patterns][^preflight-banned-tokens]

### 2. The `2011 rookie wage scale` error showed that date/timeline detection is still too broad for historical prose

The date check flags any draft unit that contains both a date-like token and a timeline/event token, unless that exact unit is supported by the source text.[^preflight-date-check] The date trigger is intentionally broad: any `20xx` year or month name qualifies, and event words include `signed`, `injured`, `returned`, `traded`, `released`, `extension`, `contract`, `deal`, `week`, `season`, `drafted`, `picked`, plus `agreed to`.[^preflight-date-patterns]

This means the heuristic is not really detecting “unsupported exact dates” so much as “a sentence that looks date-ish and event-ish.” That is why the original conversational phrasing around the 2011 rookie wage scale got caught. The later fix to stop treating bare `agreed on` as an event was the right adjustment, and the regression test captures that exact case.[^preflight-date-patterns][^preflight-test-2011]

But the larger lesson is broader than that one phrase: **historical explanation and exact transactional timeline are still living in the same bucket**. That bucket is likely too coarse for analytical NFL prose, where “2011 rookie wage scale,” “since the 2020 season,” and “after the 2023 draft” are often framing devices rather than unsupported factual claims.

## What these errors say about the current changes overall

1. The new changes are valuable.

   The preflight is now wired directly into Stage 5 writer execution, not just hidden in static skills. Writer receives a short editor-style checklist, the draft is deterministically validated, Writer gets one targeted retry, and the result is written to `writer-preflight.md`.[^actions-writer-task][^actions-preflight-flow] That is exactly the right seam if the product goal is “catch editor blockers earlier.”

2. The remaining issues are mostly *false-positive tuning issues*, not evidence that the whole approach is wrong.

   The two reported failures were not cases where the Writer failed to learn the editor’s standards. They were cases where the deterministic validator over-read the prose. That is a much better class of problem to have, because it can be improved incrementally with narrow guardrails and regression tests.

3. The heuristic currently trusts text shape more than document structure.

   `runWriterPreflight()` combines panel/fact-check/roster/writer-fact-check artifacts into a single source text blob, then scans both source and draft with regex-style support checks.[^actions-preflight-sources][^preflight-run] `splitDraftUnits()` only removes a few top-level structures (`#` headings, TLDR block starts, units starting with `**By:`).[^preflight-split-units] That means the validator can still misread mixed-content paragraphs where boilerplate and prose sit together.

## Other examples like this that are likely worth fixing

### A. Byline or boilerplate contamination can still create fake “precise claim” failures

This looks like the next likely false-positive family.

`splitDraftUnits()` only excludes a unit if it *starts* with `**By:`.[^preflight-split-units] If the writer puts the byline and the first paragraph in the same block, that filter no longer removes it. Then `extractClaims()` runs on the raw markdown-ish text, and its contract extractor only strips headings, horizontal rules, and bold markers; it does **not** remove bylines or role labels.[^claim-strip-markdown][^claim-contract]

I confirmed this locally with a quick `tsx` probe against `runWriterPreflight()`: a paragraph containing `**By: The NFL Lab Expert Panel**` immediately followed by `**Geno Smith**'s $32 million extension...` produces an `unsourced-contract-claim` whose raw text is:

> `The NFL Lab Expert Panel\nGeno Smith's $32 million`

That is not a real user-facing claim problem; it is a unit-segmentation problem. This is a strong candidate for the next fix because it will create noisy failures even when the article is otherwise fine.

**Suggested fix:** normalize draft units before claim extraction by stripping author-line boilerplate anywhere in a unit, not only when it is the first line. A narrower version would strip `**By: ...**` lines before `extractClaims()` and before date scanning.

### B. Generic historical season framing is still likely to trip the date checker

This also looks real right now.

Because `DATE_PATTERN` accepts any `20xx` year and `DATE_EVENT_PATTERN` includes generic words like `season` and `week`, a sentence such as “The franchise has been chasing this since the 2020 season...” still qualifies as an unsupported date/timeline claim if the exact sentence is not present in the source artifacts.[^preflight-date-patterns][^preflight-date-check]

I confirmed that locally with a `tsx` probe: “The franchise has been chasing this since the 2020 season, when the roster reset really started.” is still flagged as `unsourced-date-claim`.

That means the earlier `agreed on` fix solved one conversational false positive, but the broader “historical framing vs. precise dated event” boundary is still too loose.

**Suggested fix:** split the current date checker into two buckets:

- **blocking:** exact month/day dates or explicit transaction dates tied to a concrete roster event
- **warning or ignore:** high-level historical framing such as `since the 2020 season`, `after the 2023 draft`, `in the post-rookie-wage-scale era`

If the team wants to stay conservative, generic season framing could still be a warning rather than a blocker.

### C. Paraphrased supported timeline claims may still fail because support is largely exact-text based

`findUnsourcedDateIssues()` only uses `claimHasSupport(unit, sourceText)`, which checks whether the normalized source blob contains the normalized full unit string.[^preflight-date-check][^preflight-support] Unlike stats/contracts/draft claims, the date path does not have a richer semantic matcher for “same claim, different wording.”

So even when the source materials support the timeline concept, a paraphrased draft sentence may still fail if the wording changes enough. That is especially likely for explanatory prose where the writer compresses or reframes a timeline rather than repeating it verbatim.

**Suggested fix:** give date/timeline support the same kind of bounded structured fallback that stats/contracts already get, or require a stricter trigger for date blockers so only obviously precise date claims are checked this way.

### D. Name extraction will likely remain a maintenance seam if it stays banlist-led

The current fix solved the immediate `NFL Lab <Team>` problem by expanding the banned token lists.[^preflight-banned-tokens] That is fine as a tactical move, but it signals a continuing maintenance pattern: any new title-case branding phrase, section label, or proper-noun artifact header can become a candidate “name” until explicitly filtered.

I do **not** think this is the most urgent next bug, because the recent team-branding fix removed the loudest offender and I did not find a similarly immediate failure in a quick probe. But it is still the long-term shape of the risk.

**Suggested fix:** prefer a few structural exclusions before broad name extraction, such as removing bylines, panel branding labels, and known artifact header prefixes from source text before running `NAME_PATTERN`.

## Recommended priority order

### Priority 1: fix structural contamination before adding more banlist entries

The best next improvement is to strip or segment boilerplate more aggressively before running claim/date detection. That addresses the highest-noise failure mode with low regression risk because it removes text that should never be interpreted as evidence or as a draft claim in the first place.[^preflight-split-units][^claim-strip-markdown]

### Priority 2: narrow date blockers to “precise dated event claims,” not all historical framing

The current date heuristic is the most likely remaining source of false positives because it treats broad analytical time framing as if it were a concrete unsupported transaction date.[^preflight-date-patterns][^preflight-date-check] This should probably be the next logic adjustment after structural cleanup.

### Priority 3: keep adding regression tests from real runtime failures

The current tests already do the right thing by pinning the exact `Lab Cowboys` and `2011 rookie wage scale` failures.[^preflight-test-lab-cowboys][^preflight-test-2011] The next additions I would make are:

- byline-plus-contract paragraph does **not** create an `unsourced-contract-claim`
- generic `since the 2020 season` framing does **not** create a blocking date failure
- paraphrased but supported historical timeline text does **not** fail solely because wording differs from the source artifacts

### Priority 4: avoid “great simplification” unless the team wants to accept more editor churn again

If we dramatically simplify by removing name/date/claim preflight checks, the likely result is that the editor catches these issues later again, which was the original product problem. The better move is targeted tightening, not rollback.

## Bottom line

These two errors do **not** say the writer/editor alignment work was a mistake. They say the new Stage 5 preflight is now operating in the right place and catching the right category of issues, but its current implementation still reads too much from surface text patterns.

The next wins are not broad redesigns. They are a small set of structural and historical-framing fixes:

1. strip byline/boilerplate before claim extraction,
2. treat generic season-era framing as non-blocking or warning-level,
3. keep turning real runtime failures into focused regressions.

That should preserve the core value of the preflight while reducing the noisy failures that make the writer look worse than it really is.

## Citations

[^actions-writer-task]: `C:\github\nfl-eval\src\pipeline\actions.ts:451-468`
[^actions-preflight-flow]: `C:\github\nfl-eval\src\pipeline\actions.ts:1106-1220`
[^actions-preflight-sources]: `C:\github\nfl-eval\src\pipeline\actions.ts:1105-1111`
[^preflight-run]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:104-127`
[^preflight-name-patterns]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:28-63`
[^preflight-banned-tokens]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:40-63`
[^preflight-name-check]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:153-195`
[^preflight-date-patterns]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:29-37`
[^preflight-date-check]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:238-253`
[^preflight-support]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:281-298`
[^preflight-split-units]: `C:\github\nfl-eval\src\pipeline\writer-preflight.ts:339-348`
[^claim-strip-markdown]: `C:\github\nfl-eval\src\pipeline\claim-extractor.ts:57-66`
[^claim-contract]: `C:\github\nfl-eval\src\pipeline\claim-extractor.ts:150-183`
[^preflight-test-lab-cowboys]: `C:\github\nfl-eval\tests\pipeline\writer-preflight.test.ts:28-38`
[^preflight-test-2011]: `C:\github\nfl-eval\tests\pipeline\writer-preflight.test.ts:83-92`

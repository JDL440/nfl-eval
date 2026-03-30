# Recommendation: earlier fact-checking in the NFL Lab pipeline

## Executive Summary

The repo already has a strong **final** accuracy gate: the canonical lifecycle makes Stage 6 "Editor Pass" mandatory, the Editor charter requires verification of names, stats, contracts, dates, roster assignments, quote attribution, and stale information, and Stage 7 repeats names/numbers/no-stale-reference checks before Joe publishes.[^1][^2][^3] The blind spot is **upstream**: Stage 4 asks panelists to flag data that should be verified, but Writer is explicitly told not to fact-check or independently research, so Writer drafts from raw panel material that may still contain conflicts or unsupported specifics.[^4][^5][^6] The external [tamirdresher/squad-skills](https://github.com/tamirdresher/squad-skills) fact-checking plugin is useful as a **method**—claim extraction, counter-hypotheses, verified/unverified/contradicted statuses, and structured review output—but it is generic and oriented toward technical documentation, URLs, APIs, and package names rather than NFL rosters, cap math, quote attribution, or article-level causal framing.[^7][^8] My recommendation is to add a **repo-specific fact-checking skill** plus a **required lightweight verification artifact between Stage 4 and Stage 5**, while keeping the existing 8-stage model and preserving Editor as the final gate.[^4][^10][^11]

## Key Repositories Summary

| Repository | Why it matters |
|---|---|
| [JDL440/nfl-eval](https://github.com/JDL440/nfl-eval) | Contains the current article pipeline, skill wiring, stage model, artifact inference, and dashboard behavior that any fact-checking change must respect.[^1][^10][^11][^12] |
| [tamirdresher/squad-skills](https://github.com/tamirdresher/squad-skills) | Supplies the generic fact-checking skill pattern and the install model for Squad-compatible skills.[^7][^8][^9] |

## Architecture/System Overview

The current lifecycle is:

```text
Stage 1 Idea
    ↓
Stage 2 Discussion Prompt
    ↓
Stage 3 Panel Composition
    ↓
Stage 4 Panel Discussion
    ↓
Stage 5 Writer Draft
    ↓
Phase 4b Images
    ↓
Stage 6 Editor Pass
    ↓
Stage 7 Publisher Pass
    ↓
Stage 8 Joe Approval / Publish
```

That sequence is documented in both the public README and the canonical lifecycle skill, and the code enforces the same 8-stage model through `PipelineState` and artifact-first stage inference.[^1][^10][^11] In practice, accuracy work is distributed unevenly: panelists are encouraged to surface data that should be verified, but the only *mandatory* verification gate before publication is still Editor, followed by Joe's publisher checklist.[^2][^3][^4]

The artifact/state model matters for implementation. `PipelineState` hardcodes valid stages as 1-8, and `article_board.py` and `dashboard/data.mjs` infer progress from a small set of artifact filenames such as `draft.md`, `editor-review*.md`, and `publisher-pass.md`.[^10][^11][^12] That makes a brand-new numbered “fact-check” stage substantially more expensive than a prompt/skill change, because it would ripple through DB validation, board inference, and dashboard grouping.[^10][^11][^12]

## What the external plugin actually gives you

The external fact-checking plugin is intentionally small. Its `SKILL.md` labels itself **low confidence**, tells the agent to ask what evidence supports or disproves each claim, generate counter-hypotheses, verify external references, and emit a structured report with ✅ Verified / ⚠️ Unverified / ❌ Contradicted statuses.[^7] The companion `manifest.json` describes it as “Agent fact-verification patterns for ensuring accuracy before publishing,” with capabilities like verifying claims, testing counter-hypotheses, validating external references, generating structured reports, and flagging confidence levels.[^7] The marketplace README also makes clear that Squad plugins are just markdown skills; for Squad, installation is literally copying the plugin folder into `.squad/skills/`, after which agents auto-discover the skill.[^8][^9]

That makes the plugin a good **seed**, but not a ready-made solution here. Its examples focus on technical claims like API endpoints, URLs, packages, and release notes.[^7][^8] NFL Lab needs a verifier that understands different claim types: player/team assignments, current-year contract figures, time-relative phrasing (“Year 2”, “this offseason”, “two weeks ago”), table/prose consistency, quote attribution back to panel files, and article-level causal claims about games, injuries, and roster strategy.[^2][^14][^15][^16]

## What Editor is catching today

The current review artifacts show three distinct failure classes, and they do **not** all originate in the same place.

| Failure mode | Representative evidence | Likely origin | Earliest useful catch |
|---|---|---|---|
| Writer invents or over-specifies unsupported details | The JSN review catches “Ryan Havenstein” → “Rob Havenstein” and explicitly says the source material omitted the first name, so Writer added it incorrectly.[^14] | Writer synthesis | Draft preflight |
| Writer blends or embellishes attribution | The JSN review flags a Cap/PlayerRep quote mashup and polished paraphrases presented as direct quotes; the Witherspoon review still notes one polished synthesis quote in an otherwise clean draft.[^14][^21] | Writer synthesis | Draft preflight |
| Panel/source artifact is already wrong | The RB Pick #64 review says the Charbonnet surgery year error came from the Injury position paper itself, and that source table mixes 2025 dates with a claimed 7.5–8 month runway to Week 1 2026.[^15][^16] | Panel/source artifact | Panel-output preflight |
| Source ambiguity propagates into article thesis | The Arizona review traces the Trubisky #2/#3 mistake back to `draft-section.md`, not just the article draft.[^17][^18] | Panel/source artifact | Panel-output preflight |
| Article logic is factually *framed* badly even if the raw data exists | The Waddle re-review says the prior approved review missed the AFCCG/Nix logic gap because it focused on stats, names, and a comp error rather than the causal structure of the argument.[^19] | Article-level reasoning | Editor + counter-hypothesis review |
| Some drafts are already clean | Witherspoon v2 had zero red errors across more than 70 verified data points, which argues for a lightweight earlier pass rather than a heavy new stage for every article.[^21] | None | Keep preflight lean |

Two conclusions fall out of that table. First, an earlier verifier would help with **source-level** problems and **Writer-introduced assembly** problems, because both are currently reaching Stage 6 before anyone is forced to reconcile them.[^14][^15][^17] Second, an earlier verifier would **not** replace Editor, because some of the highest-value catches are holistic narrative or causal problems that only appear when the entire article is read as an argument.[^2][^19]

A further wrinkle is workflow cost. The Substack skill generates article images immediately after Writer saves the draft and **before** Editor review, so a late factual correction can invalidate text, image prompts, or both.[^22] Catching obvious high-risk claims earlier therefore saves more than Editor time; it can also reduce image-generation churn.

## Recommendation

### Short answer

Yes: an earlier fact-check layer is useful here, but it should start as a **skill and preflight artifact**, not as a replacement for Editor and not as a new formal numbered stage.[^2][^4][^10][^11]

### Why this is worth doing

The current system already encourages strong, specific claims at Stage 4—numbers, projections, bottom-line recommendations, disagreements—and it already injects current NFL calendar context into panel prompts to reduce stale model assumptions.[^4][^5] That is good for article quality, but it also increases the cost of letting unsupported or conflicting facts flow straight into `draft.md`.[^5][^14][^15][^17] Because Writer is expressly a craft layer rather than a research layer, the repo is effectively asking Writer to make persuasive prose out of material that may still need reconciliation.[^6] A lightweight verification artifact closes that gap without undermining the Editor model.

### Why I would not start with a new permanent FactChecker agent

The repo already has the right abstraction for this kind of reusable logic: Squad supports skill-aware routing and can inject a relevant `.squad/skills/{name}/SKILL.md` into spawn prompts automatically, and the external marketplace README shows that a Squad-compatible plugin is just a copied skill folder.[^9][^13] By contrast, a brand-new agent would add another long-lived persona, more routing surface, and likely overlap with Editor before you have evidence that the workload warrants it.[^2][^13] If the skill proves useful and the queue grows, you can always promote it into a first-class FactChecker agent later; the squad add-member flow already supports merging plugin guidance into a new charter.[^13]

### Why I would not start with a new numeric stage

The stage machine is currently hardcoded in `content/pipeline_state.py`, and both `content/article_board.py` and `dashboard/data.mjs` assume the present artifact progression from panel outputs to `draft.md`, then `editor-review*.md`, then `publisher-pass.md`.[^10][^11][^12] A formal Stage 5.5 or Stage 6A would therefore require DB and UI plumbing before you even learn whether the verification pass delivers signal. A new **artifact** is much cheaper: it can exist inside the current Stage 4→5 handoff, and the board can continue to infer Stage 5 from `draft.md` until you deliberately decide to promote the pass into the stage model.[^11][^12]

## Concrete implementation path

### 1) Add a repo-specific skill, not a verbatim plugin copy

Create `.squad/skills/fact-checking/SKILL.md` or `.squad/skills/panel-factcheck/SKILL.md` and adapt the external plugin's methodology to NFL Lab's actual claim types.[^7][^13] The content should explicitly cover:

- player/coach/team name verification
- roster-assignment and transaction freshness
- contract / cap / guarantee verification
- season-year anchoring and relative-time language
- quote attribution back to panel files
- table-versus-prose consistency
- “unsafe to promote into prose” flags for unsupported specifics

That uses the plugin for what it is best at—method and output shape—while making the skill useful in this domain.[^7][^8]

### 2) Make verification a required Stage 4 exit artifact

Update `.squad/skills/article-lifecycle/SKILL.md` so Stage 4 is not “done” until Lead has a small verification artifact—something like `panel-factcheck.md` or `verification-report.md`—alongside the discussion summary.[^4][^11] The artifact should be lightweight and limited to the article's highest-risk claims, not a second full article review; the clean Witherspoon pass is a good reminder that this should not become bureaucratic overhead.[^21]

A practical template would look like:

```markdown
# Panel Fact Check — {slug}

| Claim | Status | Source of truth | Safe to promote into prose? | Notes |
|---|---|---|---|---|
| ... | ✅ / ⚠️ / ❌ | file + line | yes / no | ... |

## Source conflicts to resolve before drafting
- ...

## Exact quote map
- Quote / speaker / source file

## Unsafe details Writer must not add
- Unsupported first names
- Unsourced superlatives
- Approximate numbers that need softening
```

### 3) Insert the preflight before Writer and before image generation

Update `.squad/skills/substack-article/SKILL.md` so the flow becomes:

1. gather panel analysis
2. run fact-check preflight
3. hand Writer the prompt + panel outputs + verification artifact
4. generate images
5. run Editor

That change aligns the skill with the actual cost structure, because today image generation happens after drafting but before Editor.[^22] If the factual preflight does its job, fewer drafts and image prompts should need to be redone later.

### 4) Tighten Writer's guardrails around unsupported detail

The Writer charter should stay true to its current role—Writer is still not the final fact-checker—but it needs stronger negative rules based on the observed failure modes.[^6][^14][^21] I would add explicit instructions like:

- do not add a first name unless the verification artifact or source file provides it
- do not convert a paraphrase into a direct quote
- do not introduce superlatives unless the verification artifact explicitly clears them
- cross-check prose against article tables before handing off to Editor

Those are the mistakes the review artifacts keep surfacing, and they are cheaper to prevent than to clean up later.[^14][^15][^17]

### 5) Keep Editor as the final, narrative-aware verifier

Do **not** weaken Stage 6. Editor is still the mandatory last gate, and the Editor charter already covers the broader review surface—facts, attribution, structure, teaser realism, and image review—that the generic plugin does not.[^2][^3] If anything, I would borrow one idea from the external plugin and explicitly teach Editor to run a counter-hypothesis check on the article's main causal claim, because the Waddle re-review shows how a piece can be factually detailed but logically unfair.[^7][^19]

### 6) Decide whether you want dashboard visibility now or later

If you create `panel-factcheck.md` today, the current board and detail pages will not treat it as a stage-defining artifact. `article_board.py` will continue to infer stages from prompt/panel/draft/editor/publisher files, and `dashboard/data.mjs` will currently classify only known names like `discussion-prompt.md`, `draft.md`, `editor-review*.md`, and `publisher-pass.md` into the main groups.[^11][^12] That is fine if you want a low-friction rollout.

If you **do** want first-class UI visibility, add one small dashboard change in phase 1: teach `classifyDocumentGroup()` and `documentSortKey()` about the new filename so it shows up in the “panel” or “draft” bucket rather than “other.”[^12] I would still leave `PipelineState` and stage numbers alone until the preflight proves its value.[^10]

## Recommended rollout

### Phase 1: low-risk rollout
- Add the skill
- Add the verification artifact
- Update Stage 4/5 and Substack skill docs
- Tighten Writer rules
- Leave DB stages untouched[^4][^5][^6][^10][^11]

### Phase 2: UI polish
- Classify the new artifact in `dashboard/data.mjs`
- Optionally surface a “verification complete” note on the article detail page[^12]

### Phase 3: only if volume justifies it
- Promote the skill into a dedicated FactChecker agent
- Add routing entries and, if necessary, a formal stage or run record[^10][^13]

That sequence gives you measurable signal before you pay the cost of changing the state machine.[^10][^13]

## Confidence Assessment

**Certain:** the current pipeline shape, the Editor/Writer responsibility split, the 8-stage state model, the artifact-first inference rules, the external plugin's actual scope, and the sampled error classes are all directly evidenced in the files cited above.[^1][^2][^7][^10][^11]

**Inferred but well-supported:** a lightweight preflight will likely reduce late-stage rework, especially for source-inherited errors and Writer-added details, because those are the error classes the current reviews repeatedly surface before publication and because images are generated before Editor runs.[^14][^15][^17][^22] I am less certain about the eventual need for a dedicated permanent FactChecker agent, because that depends on article volume and how much the preflight actually reduces Editor churn; the current evidence supports starting with a skill rather than with a new staffed role.[^13][^21]

## Footnotes

[^1]: `C:\github\worktrees\factchecker\README.md:78-111`.
[^2]: `C:\github\worktrees\factchecker\.squad\agents\editor\charter.md:14-43,140-146`.
[^3]: `C:\github\worktrees\factchecker\.squad\skills\article-lifecycle\SKILL.md:366-383,424-440`.
[^4]: `C:\github\worktrees\factchecker\.squad\skills\article-lifecycle\SKILL.md:261-297`.
[^5]: `C:\github\worktrees\factchecker\.squad\skills\substack-article\SKILL.md:34-80`.
[^6]: `C:\github\worktrees\factchecker\.squad\agents\writer\charter.md:53-84,112-121`.
[^7]: [tamirdresher/squad-skills](https://github.com/tamirdresher/squad-skills) — `plugins/fact-checking/SKILL.md:1-44` and `plugins/fact-checking/manifest.json:2-16` (commit `b82dc0c`).
[^8]: [tamirdresher/squad-skills](https://github.com/tamirdresher/squad-skills) — `README.md:7-23,38-48` (commit `b82dc0c`).
[^9]: [tamirdresher/squad-skills](https://github.com/tamirdresher/squad-skills) — `README.md:70-76` (commit `b82dc0c`).
[^10]: `C:\github\worktrees\factchecker\content\pipeline_state.py:26-41,465-530`.
[^11]: `C:\github\worktrees\factchecker\content\article_board.py:202-313`.
[^12]: `C:\github\worktrees\factchecker\dashboard\data.mjs:202-243,287-307,360-431`.
[^13]: `C:\github\worktrees\factchecker\.github\agents\squad.agent.md:231-231,753-776`; `C:\github\worktrees\factchecker\.squad\templates\skill.md:1-25`.
[^14]: `C:\github\worktrees\factchecker\content\articles\jsn-extension-preview\editor-review.md:20-69,149-159`.
[^15]: `C:\github\worktrees\factchecker\content\articles\seahawks-rb-pick64-v2\editor-review.md:29-44,147-159`.
[^16]: `C:\github\worktrees\factchecker\content\articles\seahawks-rb-pick64-v2\injury-position.md:20-33`.
[^17]: `C:\github\worktrees\factchecker\content\articles\ari-2026-offseason\editor-review.md:10-22,132-139`.
[^18]: `C:\github\worktrees\factchecker\content\articles\ari-2026-offseason\draft-section.md:151-157,188-188`.
[^19]: `C:\github\worktrees\factchecker\content\articles\den-mia-waddle-trade\editor-review-3.md:11-24,39-58,88-100`.
[^21]: `C:\github\worktrees\factchecker\content\articles\witherspoon-extension-v2\editor-review.md:10-26,61-95`.
[^22]: `C:\github\worktrees\factchecker\.squad\skills\substack-article\SKILL.md:163-188,260-271`.

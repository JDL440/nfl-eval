# Research Report: Panel construction is too restrictive for cohort-style articles

## Executive Summary

The current restriction is real, but it is mostly a **prompt/design restriction**, not a hard runtime limit. The shipped `panel-composition` skill caps **Depth 2 / “The Beat”** at **3-4 panelists**, and Stage 3 repeats that same guidance in its task prompt, so a beat-level article about all six 2024 first-round QBs is very likely to be squeezed into a smaller panel even though the downstream Stage 4 executor can run any number of parsed panelists.[^1][^2][^3]

The bigger architectural issue is that the product does **not** have a first-class concept for “article type” or “composition strategy.” Instead, it mixes together `depth_level`, a single-primary-team assumption, optional pinned agents, and markdown-only “article type” examples embedded inside skills. That works for the common single-team article, but it does not cleanly represent cohort, comparison, or multi-team pieces.[^4][^5][^6]

My recommendation is to separate **article depth** from **article composition strategy**, and to model **subjects** separately from **panelists**. For your 2024 first-round-QB example, the six QBs should be first-class article subjects; then the system can choose either a compact expert panel or an explicit “one voice per subject/team” strategy without abusing depth-level panel caps.[^4][^7][^8]

## Architecture / System Overview

Today, the relevant flow looks like this:[^2][^5][^9]

```text
New Idea UI
  ├─ collects: prompt, teams[], depthLevel, pinnedAgents[]
  └─ sends request to dashboard server
            │
            ▼
Dashboard server
  ├─ generates idea prompt using depth label text
  ├─ persists article with depth_level
  ├─ stores only teams[0] as primary_team at creation time
  └─ stores pinned agents
            │
            ▼
Stage 3: composePanel()
  ├─ builds roster from available charters
  ├─ injects depth-level text like "3-4 agents"
  ├─ injects pinned agents as must-include
  └─ uses markdown skill "panel-composition"
            │
            ▼
panel-composition.md
  ├─ human-readable markdown
  └─ no structured schema / no first-class strategy field
            │
            ▼
Stage 4: runDiscussion()
  ├─ parse markdown bullets into panelists
  ├─ run one task per parsed panelist
  └─ fallback to single moderator if parsing fails
```

The main consequence is that panel behavior is driven by a mix of UI text, skill prose, and freeform markdown artifacts rather than by a single structured composition contract.[^1][^2][^5][^9]

## Findings

### 1. The current Beat-level restriction is encoded in prompts and config

The default `panel-composition` skill explicitly sets panel-size limits to **2 / 3-4 / 4-5** for depth levels 1-3 and says “Do not exceed these limits.” It also presents a hardcoded article-type matrix like “Draft pick evaluation” or “Trade evaluation,” which is effectively acting as the system’s only article-type taxonomy today.[^1]

Stage 3 duplicates that same rule in `composePanel()`: it builds a task string that says Depth 1 is “2 agents max,” Depth 2 is “3-4 agents,” and Depth 3 is “4-5 agents,” then tells the lead agent that “Panel size must respect the depth level limits.”[^2]

There is also a separate config source in `models.json` that maps `the_beat` to `{ min: 3, max: 4 }` and `deep_dive` to `{ min: 4, max: 5 }`, plus a `ModelPolicy.getPanelSizeLimits()` helper that reads those values. So panel sizing is defined in more than one place already, which is a smell: the UI, skill text, Stage 3 prompt text, and model policy all carry overlapping assumptions.[^3][^10]

### 2. The runtime does not appear to hard-enforce a maximum panel size

The interesting nuance is that Stage 4 does **not** enforce a max count. `runDiscussion()` parses panelists from `panel-composition.md` and then runs `Promise.all(panelists.map(...))`, so if Stage 3 emitted six valid bullet items, Stage 4 would try to run all six.[^8]

Likewise, the Stage 3 guard only checks that `panel-composition.md` exists and is non-empty; it counts bullet-like lines for the status message, but it does not reject oversize panels.[^9] That means your “system doesn’t add them all” observation is most likely coming from composition guidance upstream rather than a downstream executor refusing six panelists.[^2][^8][^9]

### 3. The data model has no first-class “article type” or “composition strategy”

The `Article` type has `depth_level`, `primary_team`, `teams`, and normal article metadata, but it has no `article_type`, `composition_strategy`, `subject_set`, or equivalent field.[^4] `Repository.createArticle()` likewise persists `id`, `title`, `primary_team`, `teams`, `league`, and `depth_level`, but nothing like a strategy/archetype field.[^5]

That matters because the current system is really doing two separate jobs with one knob:

1. `depth_level` is being used to express **reader depth / word count / cost envelope**.[^11][^12]
2. The same `depth_level` is also being used to express **panel topology** (how many voices, what kinds of voices, and whether multi-team coverage is acceptable).[^1][^2][^3]

Those are related, but they are not the same design dimension. A beat-level cohort article can still be ~1500 words while covering six subjects; it just needs a different composition strategy than a single-team beat article.[^11][^12]

### 4. The system still assumes a mostly single-team article shape

The skill docs repeatedly say “Always include the relevant team agent” in the singular, and they frame multiple team agents as usually wasteful overlap. That is a good default for single-team pieces, but it fights the shape of cross-team or cohort stories like “all six 2024 first-round QBs.”[^1][^7]

The dashboard “new idea” flow does accept `teams[]` and `pinnedAgents[]`, and it sends all selected teams into idea generation as prompt context.[^11] But at article creation time, the server persists `primary_team: teams[0]`, and `createArticle()` initializes the stored `teams` column from that single `primary_team`, not from the full input array. So multi-team intent is only partially first-class today.[^5][^12]

That mismatch helps explain why the product feels narrow: the UI hints at richer composition, but the pipeline state still centers on one primary team plus a compact analyst panel.[^5][^11][^12]

### 5. The artifact contract is too freeform for a composable system

`parsePanelComposition()` only understands a few markdown list formats: bullet or numbered items with bold agent names, non-bold names, or backtick-wrapped names.[^13] If the artifact is rich prose or a table, Stage 4 falls back to a single moderator instead of running individual panelists.[^8][^13]

This is not hypothetical. There are real `panel-composition.md` artifacts in `content\articles\...` that use tables and even “optional 4th agent” sections rather than the strict bullet-list contract. For example, the Saints offseason artifact is table-driven, models an optional fourth panelist, and documents the panel as “3 core + 1 optional.”[^14] That kind of flexibility is useful editorially, but the runtime cannot reliably consume it as a structured plan today.[^8][^13][^14]

So even if you broaden the article concept, the current markdown-only artifact will keep becoming the bottleneck. A composable system needs a structured composition artifact, not just better prose instructions.[^8][^13][^14]

### 6. There are already signs of configuration drift around panel semantics

The dashboard idea-generation label for Depth 2 says “~1500 words, 3 agents,” while Stage 3 says Depth 2 is “3-4 agents.”[^11][^12] The article detail page also warns that changing depth level after Stage 1 may “desync prompts/panel sizing,” which is effectively an admission that panel policy is spread across multiple prompt surfaces rather than computed from one durable source of truth.[^15]

This drift strengthens the case for moving from prose-driven policy to a structured composition spec owned by the article itself.[^3][^15]

## Why your 2024 first-round-QB article is awkward in the current model

A story about the six 2024 first-round QBs is really a **cohort comparison article**. The current system is optimized for a different pattern: a single-team angle with one team agent plus 1-3 specialists.[^1][^7][^11]

If you want one team voice per QB destination, the skill guidance pushes against that because Beat-level panels top out at four and multiple team agents are described as usually wasteful.[^1][^7] If you instead want all six QBs represented as article subjects, there is no structured “subject set” concept to capture them cleanly; they only exist inside prompt prose.[^4][^5][^11]

So the real problem is not just “raise the max from 4 to 6.” The real problem is that **subject coverage** and **panel composition** are conflated.[^4][^8][^13]

## Recommendation

### Recommended direction: split depth, subjects, and panel strategy

I recommend a three-part model:

| Dimension | What it should mean | Why |
|---|---|---|
| `depth_level` | Reader depth / word budget / model budget | Keeps current product meaning intact.[^3][^11][^15] |
| `subjects` | The entities the article is about: teams, players, draft cohort, cap market, etc. | Lets one article cover 1, 6, or 32 subjects without redefining the panel.[^4][^5][^11] |
| `composition_strategy` | How the discussion should be staffed: compact expert panel, one-team-per-subject, optional reserve voices, debate pair, etc. | Makes multi-team/cohort patterns explicit instead of implied by prose.[^1][^2][^7][^13] |

Concretely, that means replacing the current markdown-only “article type matrix” with a structured strategy object such as:

```json
{
  "subjects": {
    "mode": "cohort",
    "players": ["caleb-williams", "jayden-daniels", "drake-maye", "michael-penix-jr", "jj-mccarthy", "bo-nix"],
    "teams": ["chi", "wsh", "ne", "atl", "min", "den"]
  },
  "composition_strategy": {
    "mode": "cohort-compare",
    "panel_shape": "compact-expert-panel",
    "required_roles": ["draft", "analytics"],
    "preferred_roles": ["cap", "offense"],
    "allow_multiple_team_agents": true,
    "team_agent_policy": "subset-or-all",
    "soft_target": 4,
    "hard_max": 6
  }
}
```

That is an example, not a required schema, but the separation is the important part.[^4][^5][^13]

### Near-term product recommendation

If you want a smaller change first, I would **not** start by only bumping Beat from 4 to 6 globally. That would help your one use case, but it would also blur the distinction between ordinary beat pieces and special cohort pieces.[^1][^3]

Instead, I would add one new explicit per-article override or preset, something like:

- `composition_strategy = single-team-default`
- `composition_strategy = multi-team-compare`
- `composition_strategy = draft-cohort`
- `composition_strategy = transaction-two-sided`

Then let Stage 3 derive its selection rules from that preset instead of from a hardcoded article-type matrix embedded in markdown.[^1][^2][^4]

For your specific case, `draft-cohort` or `multi-team-compare` could allow six represented subjects at Beat depth without changing every Beat article in the system.[^1][^4][^11]

### Artifact recommendation: make panel composition structured

The strongest technical recommendation is to stop making `panel-composition.md` the machine contract. Keep a readable markdown view if you want, but add a structured artifact or frontmatter block that Stage 4 can consume deterministically.[^8][^13][^14]

Example:

```yaml
strategy: draft-cohort
subjects:
  players:
    - caleb-williams
    - jayden-daniels
    - drake-maye
    - michael-penix-jr
    - jj-mccarthy
    - bo-nix
panelists:
  - agent: draft
    lane: class-wide evaluation and prospect priors
    required: true
  - agent: analytics
    lane: rookie-year signal vs noise
    required: true
  - agent: chi
    lane: Caleb context
    required: false
  - agent: wsh
    lane: Daniels context
    required: false
```

With a structure like that, Stage 4 can decide whether to:

1. run **all** panelists,
2. run only the `required: true` set,
3. run required panelists plus a rotating subset of subject-specific voices,
4. or spawn grouped subpanels.[^8][^13][^14]

That would also support optional agents cleanly, which the current editorial artifacts already want to express but the parser cannot model.[^13][^14]

### Product recommendation for the 2024 QB use case

I would model that article one of two ways:

**Option A: compact expert panel, six article subjects.**  
Keep Beat depth. Subjects = all six QBs. Panelists = Draft + Analytics + Cap + one or two team/context voices. This is probably the best default if the goal is a readable comparison piece around ~1500 words.[^1][^3][^11]

**Option B: expanded subject-voice panel.**  
Keep Beat depth but use a `draft-cohort` strategy that allows up to six team voices or six subject slots. This is the right mode only if you specifically want each QB/team situation to speak with its own contextual voice.[^1][^7][^14]

The key is that these should be **two different strategies**, not two accidental side effects of the same `depth_level` field.[^4][^5][^15]

## Suggested implementation sequence

1. **Add a first-class composition field** to article metadata, even if it is just an enum at first. That gives the UI and pipeline a stable hook that is more expressive than depth level alone.[^4][^5][^12]

2. **Persist full `teams[]` on article creation** instead of collapsing to `teams[0]` at write time. Even if you still designate a primary team, the full multi-team intent should survive creation.[^5][^12]

3. **Generate structured panel artifacts** alongside markdown. Stage 4 should read the structured form first, then optionally render or archive markdown for humans.[^8][^13][^14]

4. **Move selection rules out of skill prose and into data-driven policy**, so the UI, Stage 3, and model policy all derive panel limits and shapes from one source of truth.[^1][^2][^3][^15]

5. **Keep depth-level limits as defaults, not absolutes.** Composition strategy should be allowed to override them for justified special cases like cohort coverage.[^1][^2][^3]

## Bottom line

My recommendation is **not** “just raise Beat to six.” My recommendation is:

- keep `depth_level` for depth/budget,
- add a first-class `composition_strategy`,
- model article `subjects` separately from panelists,
- and switch Stage 3/4 to a structured composition artifact.

That solves your immediate first-round-QB cohort problem and gives the system a clean path toward more abstract, composable article types instead of baking more one-off exceptions into prompt text.[^1][^4][^8][^13]

## Confidence Assessment

**High confidence**

- The current Beat-level panel cap is encoded in the shipped skill and in `composePanel()` task construction.[^1][^2]
- Stage 4 will run however many parsed panelists it receives; it does not itself cap the list.[^8]
- The codebase has no first-class `article_type` / `composition_strategy` concept in the `Article` data model.[^4][^5]
- The current artifact contract is markdown-first and parser-sensitive.[^8][^13][^14]

**Medium confidence**

- Your observed “it doesn’t add them all” behavior is most likely coming from Stage 3 prompt design rather than from a lower-level runtime cap. I am confident in that direction because the executor does not cap count, but I did not reproduce your exact article scenario end-to-end in this research pass.[^2][^8][^9]

**Inferred / design interpretation**

- I am inferring that the right abstraction is “subjects + composition strategy” because the current product already shows symptoms of that missing separation: multi-team UI input, single-team defaults, article-type prose matrices, optional panelists in real artifacts, and parser fallbacks. That conclusion is architectural judgment layered on verified code facts, not an explicit statement in the repository.[^1][^5][^11][^13][^14]

## Footnotes

[^1]: `C:\github\nfl-eval\src\config\defaults\skills\panel-composition.md:15-43`

[^2]: `C:\github\nfl-eval\src\pipeline\actions.ts:842-903`

[^3]: `C:\github\nfl-eval\src\config\defaults\models.json:23-33`

[^4]: `C:\github\nfl-eval\src\types.ts:20-29`, `C:\github\nfl-eval\src\types.ts:31-52`

[^5]: `C:\github\nfl-eval\src\db\repository.ts:1590-1620`

[^6]: `C:\github\nfl-eval\src\config\defaults\skills\article-discussion.md:98-125`

[^7]: `C:\github\nfl-eval\src\config\defaults\skills\panel-composition.md:25-31`, `C:\github\nfl-eval\src\config\defaults\skills\article-discussion.md:102-125`

[^8]: `C:\github\nfl-eval\src\pipeline\actions.ts:914-1031`

[^9]: `C:\github\nfl-eval\src\pipeline\engine.ts:71-89`

[^10]: `C:\github\nfl-eval\src\llm\model-policy.ts:156-165`, `C:\github\nfl-eval\src\llm\model-policy.ts:219-227`

[^11]: `C:\github\nfl-eval\src\dashboard\views\new-idea.ts:102-107`, `C:\github\nfl-eval\src\dashboard\views\new-idea.ts:201-218`

[^12]: `C:\github\nfl-eval\src\dashboard\server.ts:1138-1185`, `C:\github\nfl-eval\src\dashboard\server.ts:1225-1244`

[^13]: `C:\github\nfl-eval\src\pipeline\actions.ts:620-666`

[^14]: `C:\github\nfl-eval\content\articles\no-2026-offseason\panel-composition.md:3-16`, `C:\github\nfl-eval\content\articles\no-2026-offseason\panel-composition.md:41-54`, `C:\github\nfl-eval\content\articles\no-2026-offseason\panel-composition.md:77-85`

[^15]: `C:\github\nfl-eval\src\dashboard\views\article.ts:105-114`

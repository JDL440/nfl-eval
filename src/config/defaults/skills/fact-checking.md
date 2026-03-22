---
name: "fact-checking"
description: "Phase 1 preflight verification for high-risk claims before Writer drafting — panel output verification artifact"
domain: "content-production"
confidence: "medium"
source: "designed 2026-03-15 — Phase 1 rollout; sits between Stage 4 (Panel) and Stage 5 (Writer)"
---

# Fact-Checking — Skill

> **Confidence:** medium — Phase 1 rollout; lightweight preflight focus
> **Created:** 2026-03-15
> **Scope:** Panel output verification; not full fact-checking (that's Editor's job at Stage 6)

## Purpose

A focused, lightweight verification gate that runs **after panel discussion outputs** (Stage 4) and **before Writer drafting** (Stage 5). The fact-check preflight identifies high-risk claims in the raw panel analysis: contradictions, unsourced assertions, unsafe details, and source conflicts. It does NOT fact-check the final published article — Editor does that. Instead, it flags problems in the expert analysis so Writer can craft around them or Writer/Editor can request clarification.

**Key distinction:** This is a **preflight check on panel outputs**, not a full editorial fact-check. Writer uses the verified/flagged claims to avoid embedding errors into the draft.

## When to Use

- After all panel agents return their analysis (end of Stage 4)
- Before Writer assembles the draft (start of Stage 5)
- When a discussion prompt flags high-risk domains (contract figures, injury history, draft projections, statistical claims)

## Output Artifact: `panel-factcheck.md`

Saved to `content/articles/{slug}/panel-factcheck.md` after panel outputs are reviewed. Standard sections:

```markdown
# Fact-Check Preflight: {Article Title}

**Date:** {ISO date}
**Panel:** {Agent list}
**Status:** ✅ Clear to Draft / ⚠️ Caution / 🔴 Halt for Clarification

---

## Verified Claims

### {Category} — Verified ✅
- **Claim:** {Exact text from panel}
- **Source:** {Citation: "OTC {date}", "Spotrac {date}", "PFR {season}", "NFL.com {date}"}
- **Accuracy:** ✅ Matches source

---

## Unverified Claims

### {Category} — No Source Found ⚠️
- **Claim:** {Exact text from panel}
- **Why:** No direct source provided by agent; requires Writer clarification or Editor lookup
- **Action:** Writer should add source citation or clarify with {Agent} before drafting

---

## Contradicted Claims

### {Category} — Conflicting Sources 🔴
- **Claim from {Agent 1}:** {Exact quote}
- **Claim from {Agent 2}:** {Exact quote}
- **Source conflict:** {OTC shows X, Spotrac shows Y}
- **Action:** {Recommend—use most recent source / split as expert disagreement / request clarification}

---

## Source Conflicts

### {Example: Contract Figures}
- **OTC (2026-03-15):** {Team} cap space = ${X}
- **Spotrac (2026-03-13):** {Team} cap space = ${Y}
- **Variance:** $[difference]
- **Recommended:** Use OTC (most recent); note sourcing date in article text

---

## Exact Quote Map

### {Agent} Quotable Passages
- **Quote 1:** "{Exact}"
- **Context:** Where in their analysis (e.g., "Extension value recommendation")
- **Safe to publish:** ✅ Yes / ⚠️ Caution / 🔴 No (requires clarification)

---

## Unsafe Details Not Safe to Promote into Prose

### {Category} — Detail Risks
- **Detail:** {Claim from panel}
- **Risk:** {Privacy concern / Unverified rumor / Unattributed stat}
- **Recommendation:** Do not include in published prose; use general statement instead

**Examples:**
- ❌ "Agent told us the player demanded $X" (unverified source, private negotiation)
- ✅ "The market for {position} has reset to $X AAV" (market data, public)
- ❌ "Player's injury is worse than reported" (speculative medical claim)
- ✅ "Injury recovery timeline typically spans {X weeks} for this type" (general knowledge)

---

## Sign-Off

**Reviewed by:** {Agent name — typically Lead or Editor}
**Timestamp:** {datetime}

**Next step:** Writer proceeds to draft using verified claims and addressing flagged items.
```

## Roster Verification (Important)

**LLMs frequently hallucinate player-team assignments** because training data goes stale quickly — trades, cuts, and free-agent signings happen constantly. This is one of the most common and embarrassing error types in sports content.

### Data Freshness Caveat

The roster data comes from nflverse, which updates **approximately once daily**. During active transaction periods (free agency, trade deadline, roster cuts), there may be a **24-48 hour lag** between a reported transaction and its appearance in the data. Additionally, nflverse tracks official NFL transactions — rumored or reported-but-not-confirmed deals may not appear at all.

**Calibrate your confidence accordingly:**
- Player listed on a **different team** in roster data → high confidence the article is wrong (🔴 Error)
- Player **not found** in roster data → could be stale data OR could be wrong — flag as ⚠️ Caution, not 🔴 Error
- Player listed on the **correct team** → confirmed ✅

### How It Works

The pipeline automatically generates a `roster-context.md` artifact from nflverse data before fact-checking runs. This artifact contains the official roster plus snap-count percentages where available.

### What to Check

1. **Every player mentioned in panel outputs** — look them up in the roster context for the team being discussed
2. **Positional accuracy** — if an analyst says "their starting QB is X", verify X is listed as QB in the roster
3. **Departed players** — if a player is mentioned but appears on a **different team** in the roster data, flag as 🔴 Error. Common causes:
   - Player was traded (e.g., "Geno Smith is the Seahawks QB" — roster shows him on LV)
   - Player signed with another team in free agency
4. **Missing players** — if a player is mentioned but NOT found anywhere in the roster data, flag as ⚠️ Caution (not 🔴 Error). The player may be:
   - A very recent signing not yet reflected in daily data updates
   - A free agent whose signing was reported but not yet processed
   - A draft pick or UDFA not yet in the system
5. **Name spelling** — verify exact spelling matches the roster (e.g., "Riq Woolen" not "Jalen Woolen")

### Flagging Format

```markdown
## Roster Discrepancies

### 🔴 Error — Player on Different Team
- **Claim:** "Geno Smith under center gives the Seahawks..."
- **Roster Context:** Geno Smith is listed on LV (Raiders), NOT on SEA roster. Sam Darnold is SEA QB (96% snaps).
- **Action:** 🔴 ERROR — Article premise references a player confirmed on a different team.

### ⚠️ Caution — Player Not Found in Data
- **Claim:** "New signing John Doe bolsters the defensive line..."
- **Roster Context:** John Doe does not appear in nflverse roster data (last updated: {date}).
- **Action:** ⚠️ CAUTION — Player not found in data. May be a very recent transaction. Verify independently before publishing.
```

## Execution Workflow

### Step 1 — Panel Output Collection

After all panelists return analysis (Stage 4):
1. Collect all raw expert outputs
2. Note which claims are assertion vs. sourced (e.g., "OTC shows $X" vs. "The market for {pos} is around $X")

### Step 2 — Claim Extraction

For **high-risk categories only** (no need to verify every claim):

| Category | Why | Examples |
|----------|-----|----------|
| **Contract figures** | Dead money, cap implications are math-critical | "Cap space is $10M" / "$27M AAV" / "Restructure saves $5M" |
| **Statistics / rankings** | Wrong numbers damage credibility | "Ranked X in the league" / "EPA = Y" / "DVOA was Z" |
| **Injury timelines** | Safety-critical; recovery windows are specific | "4–6 weeks" / "Out for season" / "Week 1 return likely" |
| **Draft facts** | Prospect rankings, combine data, draft order | "Projected first round" / "40-time was 4.6" |
| **Team facts** | Coaching staff, recent transactions, depth chart | "Coach X is in year N" / "Player Y was cut" |
| **Player-team assignments** | Rosters change via trades, cuts, signings — stale data is common | "Player X is their QB" / "X and Y anchor the secondary" |
| **Direct quotes** | Agent claims someone said something | "Agent told us..." / "Coach said in interview..." |

### Step 3 — Cross-Reference (Lightweight)

For each high-risk claim:
1. **Check source within panel outputs:** Does the agent cite where they got it? (e.g., "OTC shows", "Spotrac lists", "PFR data")
2. **Verify player-team assignments against roster context:** If a `roster-context.md` artifact is available, cross-reference every player mentioned to confirm they are actually on the team being discussed. Flag any player who appears in the article but NOT in the roster context — they may have been traded, cut, or signed elsewhere.
3. **Flag if missing source:** Mark as ⚠️ Unverified, not ❌ Wrong
4. **Identify conflicts:** If two agents claim different numbers (e.g., Cap says $15M space, Team says $12M space), note and recommend source resolution
5. **Check against known errors:** Is this a known hallucination risk? (e.g., invented combine times, hallucinated stat lines, players on wrong teams)

### Step 4 — Safe-to-Publish Assessment

For each flagged claim, decide:

| Status | Meaning | Writer Action |
|--------|---------|---------------|
| ✅ Clear | Sourced, verified, no conflicts | Use as-is in draft |
| ⚠️ Caution | Unsourced or minor conflict | Add citation or clarify in text |
| 🔴 Halt | Major conflict or hallucination risk | Request panel clarification before drafting |

### Step 5 — Document & Hand Off

Save `panel-factcheck.md` to `content/articles/{slug}/`. Post summary comment to GitHub issue:

```
✅ Fact-check preflight complete — {status}.
{# of verified claims} verified ✅ | {# of caution claims} flagged ⚠️ | {# of halts} halted 🔴
See content/articles/{slug}/panel-factcheck.md for details.
Handing to Writer...
```

## Anti-Patterns

- ❌ **Doing full fact-checking here** — that's Editor's job at Stage 6. This is a **preflight** to catch obvious errors and conflicts.
- ❌ **Verifying every single claim** — focus on high-risk categories (contracts, stats, injury, draft, quotes). Skip narrative claims ("the team faced adversity").
- ❌ **Stalling Writer** — if a claim is unclear, mark it and let Writer decide whether to use it or ask for clarification.
- ❌ **Changing the panel outputs** — you're documenting risks, not editing the experts. Panel keeps their language; Writer addresses the flags.
- ❌ **Making it too heavy** — Phase 1 is lightweight. If you're spending more than 10–15 minutes on fact-check preflight, you're doing Editor's job.

## Validated On

- ✅ Zero articles to date — Phase 1 rollout (2026-03-15)

## Integration Points

### Stage 4 → Stage 5 Gate

**Current flow (before Phase 1):**
```
Panel agents submit → Writer drafts immediately
```

**Phase 1 flow:**
```
Panel agents submit → Fact-check preflight → Writer drafts (using preflight guidance)
```

### DB & Documentation

**Phase 1 does NOT add new DB tables or schema changes.** The `panel-factcheck.md` artifact is a standalone markdown file documenting the preflight output. No database writes are required for Phase 1.

The `panel-factcheck.md` artifact can be referenced manually in discussion summaries or future dashboard implementations (Phase 2+) if needed, but no code changes are required at this stage.

## Phase 1 Scope (Non-Scope)

✅ **IN SCOPE:**
- **Player-team roster verification** against live nflverse data (roster-context.md)
- Lightweight cross-reference of high-risk claims in panel outputs
- Identifying contradictions between panelists
- Flagging missing sources
- Documenting exact quotes and their safety for publication
- Suggesting which source to use when sources conflict

❌ **OUT OF SCOPE (Editor's job, Stage 6):**
- Full fact-check of final article prose
- Grammar / style review
- Substack formatting validation

## Future Phases

- **Phase 2:** Lightweight plagiarism check (comparing panel outputs to public sources)
- **Phase 3:** Injury / medical claim verification (consulting domain experts)
- **Phase 4:** Automated source lookups (e.g., hitting OTC/Spotrac API for contract figures)

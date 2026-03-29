# Research: Other Areas That Could Benefit from Official Roster Data

## Executive Summary

The official nflverse roster data (now available via `query_rosters.py` and `roster-context.ts`) is currently injected at 3 pipeline stages: `generatePrompt` (Stage 1→2), `writeDraft` factcheck (Stage 4→5), and `runEditor` (Stage 5→6). However, a comprehensive audit reveals **9 additional high-value integration points** across the dashboard, MCP tools, agent system, idea creation, and knowledge infrastructure where roster data would significantly improve accuracy and user experience.

---

## Current Roster Data Usage

| Stage/Location | Uses Roster? | Method |
|---|---|---|
| `generatePrompt` (1→2) | ✅ Yes | Manual injection via `ensureRosterContext()` |
| `composePanel` (2→3) | ❌ No | — |
| `runDiscussion` (3→4) | ❌ No | — |
| `writeDraft` factcheck (4→5) | ✅ Yes | Manual + CONTEXT_CONFIG include |
| `runEditor` (5→6) | ✅ Yes | Manual injection via `ensureRosterContext()` |
| `runPublisherPass` (6→7) | ❌ No | — |
| `publish` (7→8) | N/A | No agent involved |

**Key inconsistency:** Only `writeDraft` declares `roster-context.md` in `CONTEXT_CONFIG`[^1]. The other two injection points (`generatePrompt`, `runEditor`) inject manually in code but don't declare it in config — meaning per-article config overrides can't control roster inclusion consistently.

---

## Opportunity 1: MCP Roster Query Tool (HIGH PRIORITY)

**Current state:** The `nflverse-query` extension registers 10 MCP tools[^2] but **none expose roster data**. The `refresh_nflverse_cache` tool lists `rosters` as a cacheable dataset[^3], but there's no query tool to access it.

**Impact:** When Copilot CLI or any MCP client asks about a team's roster, there's no tool to answer. Agents in the panel discussion can't query "who is the current SEA QB?" on demand.

**Recommendation:** Add an 11th MCP tool `query_rosters` that wraps `query_rosters.py` with:
- `--team` (team abbreviation) 
- `--player` (player name lookup — "which team is Geno Smith on?")
- `--season` and `--status` filters

**Files to modify:**
- `.github/extensions/nflverse-query/tool.mjs` — add tool definition[^2]
- `mcp/server.mjs` — register the tool handler[^4]

---

## Opportunity 2: Idea Creation Validation (HIGH PRIORITY)

**Current state:** The `/api/ideas` POST endpoint[^5] accepts any team abbreviation and generates ideas via the Lead agent with the `idea-generation` skill. However:

1. **No roster context at idea creation** — The LLM generates ideas based on stale training data[^6]
2. **No API-level team validation** — Server accepts any string in `teams[]` array[^5]
3. **Year Accuracy Gate is documented but not enforced** — The idea-generation skill documents a checklist (confirm current year, correct cap figures, current coaching staff)[^7] but nothing programmatically verifies it

**Impact:** Bad premises (e.g., "Geno Smith under center gives the Seahawks...") flow into the pipeline at the very start. While `generatePrompt` catches these at Stage 1→2, it's wasteful — the idea itself is fundamentally flawed.

**Recommendation:** Inject roster context into the idea generation LLM call:
```typescript
// In server.ts /api/ideas handler (~line 672)
const rosterCtx = team ? buildTeamRosterContext(team) : null;
const taskWithRoster = rosterCtx 
  ? task + '\n\n---\n\n' + rosterCtx
  : task;
```

**Files to modify:**
- `src/dashboard/server.ts` — idea creation endpoint (~line 672)[^5]

---

## Opportunity 3: Panel Discussion — `runDiscussion` (MEDIUM PRIORITY)

**Current state:** Panel agents (Analytics, Cap, Defense, Offense, etc.) discuss article topics without roster context[^8]. Each panelist relies entirely on their LLM training data for player-team assignments.

**Impact:** 14 of 15 active agent charters reference players or teams directly[^9]. Key agents affected:

| Agent | Why Roster Data Helps |
|---|---|
| **Analytics** | Statistical comparisons reference specific players — needs to know who's on what team |
| **Cap** | Cap modeling requires knowing the actual roster for dead money, restructure analysis |
| **Defense** | Scheme fit analysis needs to know the current defensive personnel |
| **Offense** | Same — needs current offensive depth chart |
| **Draft** | "What pick fills the need?" requires knowing current roster gaps |
| **CollegeScout** | Prospect-to-team fit depends on current team composition |

**Recommendation:** Inject roster context into `runDiscussion` so all panelists see it:
```typescript
// In actions.ts runDiscussion (~line 372)
const rosterCtx = article.primary_team
  ? ensureRosterContext(ctx.repo, articleId, article.primary_team)
  : null;
// Append to discussion prompt context
```

**Files to modify:**
- `src/pipeline/actions.ts` — `runDiscussion` function[^8]

---

## Opportunity 4: Dashboard Roster Sidebar (MEDIUM PRIORITY)

**Current state:** The article detail view[^10] shows team badges and article metadata but no roster information. Users can't see the current roster for the article's team at a glance.

**Impact:** When reviewing an article about the Seahawks, the user has to mentally recall who's on the roster. A sidebar showing the official roster would:
- Help spot stale player references immediately
- Provide context while reading editor feedback
- Show backup QBs and IR players that might be relevant

**Recommendation:** Add a collapsible "Team Roster" panel in the article detail sidebar (under the existing Advanced section). Fetch via a new API endpoint `/api/roster/:team/:season` that calls `buildTeamRosterContext()`.

**Files to modify:**
- `src/dashboard/views/article.ts` — add roster sidebar component[^10]
- `src/dashboard/server.ts` — add `/api/roster/:team/:season` endpoint

---

## Opportunity 5: Agent System Prompt Injection (MEDIUM PRIORITY)

**Current state:** `composeSystemPrompt()` in `src/agents/runner.ts`[^11] builds the system prompt from: charter → responsibilities → skills → memories → boundaries. Roster data is NOT part of the system prompt — it's only injected into user messages at specific pipeline stages.

**Impact:** When agents are called outside the pipeline (e.g., ad-hoc queries, idea generation), they have no roster context in their system prompt. This means every non-pipeline agent call uses stale training data.

**Recommendation:** Add an optional `rosterContext` parameter to `composeSystemPrompt()` or to the `run()` method's `articleContext`:
```typescript
// In runner.ts composeSystemPrompt (~line 273)
if (rosterContext) {
  parts.push('## Current Team Roster\n' + rosterContext);
}
```

This would let any caller provide roster context, not just the 3 hardcoded pipeline stages.

**Files to modify:**
- `src/agents/runner.ts` — `composeSystemPrompt()` and/or `run()` method[^11]

---

## Opportunity 6: Pre-Publish Validation Gate (MEDIUM PRIORITY)

**Current state:** The `runPublisherPass` (Stage 6→7) focuses on formatting, tone, and structure[^12]. The final `publish` action (Stage 7→8) only checks that `substack_url` is set[^13]. **Neither performs roster validation.**

**Impact:** If a stale player reference somehow survives the editor pass (e.g., the editor approves with a minor note that gets missed), there's no final safety net before the article goes to Substack.

**Recommendation:** Add a lightweight automated roster cross-check at the publish stage — not a full LLM call, but a deterministic text scan:
```typescript
// Extract player names from draft.md
// Cross-reference against roster data
// Warn (not block) if unrecognized names found
```

This could be a new utility function (`validatePlayerMentions()`) that scans article text against the roster and returns warnings.

**Files to modify:**
- `src/pipeline/roster-context.ts` — add `validatePlayerMentions(text, team)` function
- `src/pipeline/actions.ts` — call it in `publish` or `runPublisherPass`

---

## Opportunity 7: Knowledge System Bootstrap (LOW-MEDIUM PRIORITY)

**Current state:** The knowledge system stores agent memories in SQLite[^14], but roster data is not part of the persistent knowledge base. Each article independently fetches roster context, even for the same team.

**Impact:** The bootstrap knowledge for new instances (e.g., `content/knowledge/nfl/`) doesn't include current roster data. When a new instance starts, agents have no roster grounding until an article triggers a fetch.

**Recommendation:** Include a periodic roster snapshot in the knowledge bootstrap:
- Run `query_rosters.py` for all 32 teams on a schedule (or at startup)
- Store as team-specific knowledge entries
- Agents can reference these even before any article is created

**Files to consider:**
- `src/agents/knowledge.ts` or knowledge bootstrap scripts
- `content/knowledge/nfl/` — bootstrap data directory

---

## Opportunity 8: Scheduler Roster Freshness Check (LOW PRIORITY)

**Current state:** The scheduler[^15] finds articles ready to advance and calls `autoAdvanceArticle()`. It doesn't check roster data freshness.

**Impact:** An article that's been sitting at Stage 3 for weeks could advance with a stale `roster-context.md` artifact. The cached artifact wouldn't reflect recent trades.

**Recommendation:** When the scheduler advances an article, force-refresh the roster context if it's older than a configurable threshold (e.g., 7 days):
```typescript
// In scheduler advanceSingle():
ensureRosterContext(repo, articleId, team, /* forceRefresh */ isStale);
```

**Files to modify:**
- `src/pipeline/scheduler.ts` — add staleness check[^15]
- `src/pipeline/roster-context.ts` — expose artifact age check

---

## Opportunity 9: CONTEXT_CONFIG Consistency (LOW PRIORITY, QUICK FIX)

**Current state:** Only `writeDraft` declares `roster-context.md` in CONTEXT_CONFIG[^1]. `generatePrompt` and `runEditor` inject it manually in code.

**Impact:** Per-article config overrides (stored as `_config.json` artifacts) can't consistently control roster inclusion across all stages.

**Recommendation:** Add `roster-context.md` to the include lists for `runEditor`:
```typescript
runEditor: { primary: 'draft.md', include: ['idea.md', 'discussion-summary.md', 'roster-context.md'] },
```

**Files to modify:**
- `src/pipeline/context-config.ts`[^1]

---

## Priority Summary

| # | Opportunity | Priority | Effort | Impact |
|---|---|---|---|---|
| 1 | MCP roster query tool | 🔴 HIGH | Small (add tool wrapper) | Agents can query rosters on demand |
| 2 | Idea creation roster injection | 🔴 HIGH | Small (3-5 lines) | Prevents bad premises from entering pipeline |
| 3 | Panel discussion roster context | 🟡 MEDIUM | Small (5-10 lines) | All panelists work with current data |
| 4 | Dashboard roster sidebar | 🟡 MEDIUM | Medium (new component + API) | Visual roster reference while reviewing |
| 5 | Agent system prompt injection | 🟡 MEDIUM | Small (optional param) | All agent calls get roster context |
| 6 | Pre-publish validation gate | 🟡 MEDIUM | Medium (new utility) | Deterministic final safety net |
| 7 | Knowledge bootstrap | 🟢 LOW-MED | Medium (scheduled refresh) | New instances start with roster data |
| 8 | Scheduler freshness check | 🟢 LOW | Small (staleness check) | Long-sitting articles get refreshed |
| 9 | CONTEXT_CONFIG consistency | 🟢 LOW | Trivial (1 line) | Config override consistency |

---

## Architecture Diagram: Current vs. Proposed Roster Data Flow

### Current (3 injection points):
```
                                     roster-context.ts
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐
  │ Stage 1 │→ │ Stage 2  │→ │ Stage 3  │→ │ Stage 4  │→ │ Stage 5  │→ │ Stage 6  │→ │Stage 7-8│
  │  Idea   │  │genPrompt │  │compPanel │  │ discuss  │  │writeDraft│  │ editor   │  │ publish │
  │         │  │  ✅ YES  │  │  ❌ NO   │  │  ❌ NO   │  │  ✅ YES  │  │  ✅ YES  │  │  ❌ NO  │
  └─────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘
```

### Proposed (8 injection points + MCP):
```
                                     roster-context.ts
                                           │
         ┌────────┬────────────────────────┼──────────────────────────┬──────────┐
         │        │                        │                          │          │
         ▼        ▼                        ▼                          ▼          ▼
  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐
  │ Stage 1 │→ │ Stage 2  │→ │ Stage 3  │→ │ Stage 4  │→ │ Stage 5  │→ │ Stage 6  │→ │Stage 7-8│
  │  Idea   │  │genPrompt │  │compPanel │  │ discuss  │  │writeDraft│  │ editor   │  │ publish │
  │ ✅ NEW  │  │  ✅ YES  │  │  ❌ NO   │  │  ✅ NEW  │  │  ✅ YES  │  │  ✅ YES  │  │ ✅ NEW  │
  └─────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘
       │                                                                                   │
       └── Idea form injects roster ──────────────────────── Deterministic text scan ──────┘

                    ┌──────────────────┐      ┌──────────────────┐
                    │  MCP Tool: NEW   │      │  Dashboard: NEW  │
                    │  query_rosters   │      │  Roster Sidebar  │
                    └──────────────────┘      └──────────────────┘
```

---

## Confidence Assessment

| Finding | Confidence | Basis |
|---|---|---|
| 9 integration opportunities identified | ✅ HIGH | Verified by reading source code of all relevant files |
| MCP tool gap is real | ✅ HIGH | Confirmed: 10 tools registered, none for rosters[^2] |
| Idea creation has no roster context | ✅ HIGH | Confirmed in server.ts[^5] |
| Panel discussion agents lack roster | ✅ HIGH | Confirmed in actions.ts[^8] |
| 14/15 agents reference player/team data | 🟡 MEDIUM | Based on charter analysis — some agents mention teams only tangentially |
| Pre-publish scan would catch errors | 🟡 MEDIUM | Depends on name extraction accuracy |
| Knowledge bootstrap value | 🟡 MEDIUM | Useful but depends on how often new instances are created |

---

## Footnotes

[^1]: `src/pipeline/context-config.ts:22-30` — CONTEXT_CONFIG definitions, `roster-context.md` only in writeDraft
[^2]: `.github/extensions/nflverse-query/tool.mjs:61-500` — 10 MCP tools, no roster query
[^3]: `content/data/fetch_nflverse.py:41` — `rosters` dataset in DATASETS catalog
[^4]: `mcp/server.mjs:110-210` — MCP tool handler registration
[^5]: `src/dashboard/server.ts:649-772` — `/api/ideas` POST endpoint, idea creation
[^6]: `src/config/defaults/skills/idea-generation.md:25-95` — idea generation rules
[^7]: `src/config/defaults/skills/idea-generation.md:85-95` — Year Accuracy Gate checklist
[^8]: `src/pipeline/actions.ts:372-470` — `runDiscussion` function, no roster injection
[^9]: `src/config/defaults/agents/charters/nfl/` — 15+ agent charters, 14 reference player/team data
[^10]: `src/dashboard/views/article.ts:49-96` — article detail view, team badges
[^11]: `src/agents/runner.ts:272-316` — `composeSystemPrompt()` assembly
[^12]: `src/pipeline/actions.ts:591-628` — `runPublisherPass`, formatting focus
[^13]: `src/pipeline/actions.ts:631-653` — `publish`, only checks substack_url
[^14]: `src/agents/memory.ts` — agent memory system, SQLite storage
[^15]: `src/pipeline/scheduler.ts` — findReady, advanceSingle, advanceBatch

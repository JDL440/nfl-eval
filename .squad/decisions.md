# Decisions\n\n### Issue #82: Publish Article Broken — Root Cause and Fix

**By:** Code (🔧 Dev)
**Date:** 2026-03-22
**Issue:** #82

**What:** The "Publish to Substack" button on the article detail page (stage 7) calls the wrong backend endpoint. It POSTs to the generic `/htmx/articles/:id/advance` handler which only updates the database stage — it never calls the Substack API. This caused the article to be marked "Published" (stage 8) without actually appearing on Substack.

**Root Cause Files:**
- `src/dashboard/views/article.ts:530` — button targets `/htmx/articles/:id/advance` instead of `/api/articles/:id/publish`
- `src/pipeline/engine.ts:270-274` — stage 7→8 guard only checks `requirePublisherPass`, missing `requireSubstackUrl` (which exists at line 216 but is unused)
- `src/pipeline/actions.ts:782` — `publish` action is intentionally a no-op ("handled externally")

**Fix Approach:**
1. Change button target in `article.ts:530` to POST to `/api/articles/:id/publish`
2. Add `requireSubstackUrl` as compound guard for stage 7→8 in `engine.ts`
3. Optionally block raw advance endpoints from reaching stage 8

**Scope:** Small (~30 lines). No schema changes. Should include regression test.

**Status:** Bug confirmed. Issue labeled `go:yes`. Ready for implementation.


---

### Issue #83: K5a Wire Fact Checking Into Pipeline — Implementation

**By:** Code (🔧 Dev)
**Date:** 2025-07-19
**Issue:** #83
**PR:** #89 (merged)

**What:** Wired fact-checking into the article pipeline with three new modules covering Option A (pre-compute nflverse context for LLM fact-check) and Option C (deterministic stat/draft validators).

**New modules:**
- `src/pipeline/claim-extractor.ts` — Regex-based extraction of stat, contract, draft, and performance claims from markdown text. Case-sensitive name matching to avoid pronoun false positives.
- `src/pipeline/fact-check-context.ts` — Queries nflverse Python scripts (player EPA, draft history, rosters) and builds `fact-check-context.md` artifact. Follows roster-context.ts architecture: execFileSync, getGlobalCache(), graceful degradation.
- `src/pipeline/validators.ts` — Deterministic post-draft validators: stat claims (10% tolerance OR ±5 absolute), draft claims (round/pick/year match). Produces `fact-validation.md` report.

**Pipeline integration (actions.ts):**
- writeDraft (Stage 4→5): Extract claims from panel outputs → build nflverse lookup context → inject into LLM fact-check prompt
- runEditor (Stage 5→6): Include fact-check-context.md in editor context via context-config.ts
- runPublisherPass (Stage 6→7): Run deterministic validators after existing player mention check → write fact-validation.md artifact

**Key technical decisions:**
1. Regex-only claim extraction — no LLM calls, deterministic, fast (~1ms per article)
2. 10% tolerance + ±5 absolute floor for stat matching (avoids false positives on small numbers)
3. Graceful degradation everywhere — if Python scripts fail or cache is empty, pipeline proceeds normally
4. Pronoun limitation accepted: "He threw for 3,200 yards" won't extract because "He" isn't a player name. Only sentences with explicit name references are validated.

**Test coverage:** 29 new tests (17 claim-extractor, 12 validators). Total suite: 1315 tests passing.

**Future considerations:**
- Coreference resolution (pronoun → name mapping) could boost claim coverage but would require NLP or LLM
- Contract validation not yet wired to nflverse (no contract data in current Python scripts)
- Performance claims (rankings, percentiles) are extracted but not yet deterministically validated


---

# Decision: Structured Domain Knowledge Infrastructure

**Issue:** #85 — K6a │ Structured domain knowledge
**Status:** PROPOSED
**Submitted by:** Research (🔍)
**For decision by:** Lead or Product Owner (Joe Robinson)
**Date:** 2025-07-19

---

## TLDR

The pipeline already has a structured domain knowledge system (SQLite agent memory + bootstrap JSON) and injects roster context live. To scale domain knowledge infrastructure, implement a hierarchical KB with: (1) Universal Glossaries (YAML), (2) Team Identity Sheets (Markdown), (3) Domain Knowledge Index (JSON with metadata), and (4) Monthly Refresh Job (cron). Effort: MEDIUM (5–7 days).

---

## Current State: Domain Knowledge Inventory

The infrastructure for structured domain knowledge exists but is fragmented:

### 1. Bootstrap Domain Knowledge (176 pre-loaded facts)
- **Location:** `src/config/defaults/bootstrap-memory.json`
- **Format:** JSON array injected into AgentMemory at app startup
- **Content:** 176 facts across categories (shared, analytics, editor, writer, cap, draft, lead)
- **Examples:** EPA definitions, salary cap mechanics, draft hit rates, positional value hierarchy, voice guidelines
- **Injection:** `src/agents/runner.ts` composeSystemPrompt() line 310–312

### 2. Live Roster Context (Dynamic per-article)
- **Location:** `src/pipeline/roster-context.ts`
- **Called at:** Idea→Prompt, Editor review, Factcheck stages
- **Data source:** nflverse official rosters (primary) + snap counts (supplementary)
- **Format:** Markdown artifact `roster-context.md`
- **Injection:** Stored in article artifacts, included in CONTEXT_CONFIG for Writer/Editor/Lead

### 3. Agent Memory System (SQLite persistence)
- **Location:** `src/agents/memory.ts`
- **Categories:** learning, decision, preference, domain_knowledge, error_pattern
- **Recall:** Agents retrieve top-10 memories per spawn (filtered by category)
- **Lifecycle:** Memories have relevance scores (updated on use), optional TTL, access counters
- **Durability:** Global per-project database survives across all sessions

### 4. Context Configuration (Per-article routing)
- **Location:** `src/pipeline/context-config.ts`
- **Pattern:** Each article stores `_config.json` artifact with upstream include lists
- **Default:** Writer receives [idea.md, discussion-summary.md, editor-review.md, panel-factcheck.md, roster-context.md]
- **Flexibility:** Per-article overrides via getArticleContextOverrides()

---

## Identified Gaps

| Gap | Impact | Example |
|-----|--------|---------|
| **No team-specific glossaries** | Scheme terminology not standardized | Writer doesn't know SEA's defensive terms (Nyseal scheme?) |
| **No hierarchical KB** | All 176 facts are flat | Cap facts mixed with analytics; hard to organize/find |
| **No factual currency** | Bootstrap loaded at startup, never refreshed | 2025 cap ($272.5M) becomes stale when CBA settles; coaching changes missed |
| **No source tracking** | Can't audit fact provenance | Unknown: "Is the 2025 cap still $272.5M?" "Where did this fact come from?" |
| **No team identity sheets** | Only roster provided | Writer lacks team colors, stadium, coaching staff, division, scheme identity |
| **No unified glossary** | Agents use terminology inconsistently | "Cover 2" vs "Tampa 2" vs "2-high" used interchangeably |
| **No inter-fact relationships** | Knowledge is siloed | Cap agent and Writer both explain proration independently |

---

## Proposed: Hierarchical KB Architecture

### Layer 1: Universal Glossaries (YAML files)
**Location:** `src/config/defaults/glossaries/`
**Examples:** analytics-metrics.yaml, cap-mechanics.yaml, nfl-scheme-defense.yaml, personnel-grouping.yaml
**Injection:** Runner loads relevant glossaries per agent skill set, appends to system prompt as "## Glossaries" section
**Contains:** Definitions, thresholds, sources, verified dates, TTL

### Layer 2: Team Identity Sheets (Markdown files)
**Location:** `content/data/team-sheets/{TEAM}.md` (32 files)
**Called at:** Stage 1 (generatePrompt action)
**Content:** Team colors, stadium, leadership, scheme identity, division, draft patterns, cap constraints
**Injection:** Stored as team-identity.md artifact, included in Writer/Editor/Lead contexts

### Layer 3: Domain Knowledge Index (Hierarchical JSON)
**Location:** `src/config/defaults/domain-knowledge-index.json`
**Purpose:** Reorganize 176 bootstrap facts by domain with metadata (source URL, verified date, TTL days)
**Benefit:** Enables refresh job detection, auditable by Editor

### Layer 4: Monthly Knowledge Refresh Job
**Location:** `scripts/refresh-domain-knowledge.ts`
**Trigger:** Scheduled 1st of each month (GitHub Actions cron)
**Logic:** Check fact TTL, fetch fresh data from sources (nflverse, OTC, NFL.com), update bootstrap + index, log changes
**Output:** scripts/domain-knowledge-refresh-log.md (immutable audit trail)

---

## Integration Points

### runner.ts (System Prompt Composition)
Add glossary loading before boundaries section:
```typescript
const glossaries = this.loadGlossaries(agentName, skillNames);
if (glossaries.length > 0) {
  const glossaryText = glossaries.map(g => `### ${g.name}\n${g.content}`).join('\n\n');
  parts.push('## Glossaries\n' + glossaryText);
}
```

### actions.ts (Article Pipeline)
At Stage 1 (generatePrompt):
```typescript
const teamSheet = buildTeamIdentitySheet(team); // -> markdown
repo.artifacts.put(articleId, 'team-identity.md', teamSheet);
CONTEXT_CONFIG.writeDraft.include.push('team-identity.md');
```

### Bootstrap Memory Reorganization
Reorganize 176 facts by domain with metadata; maintain backward compatibility for existing runner code.

---

## Effort: MEDIUM (5–7 days)

| Phase | Task | Days |
|-------|------|------|
| 1 | Design schemas + examples | 1–2 |
| 2 | Build 4 glossaries (analytics, cap, defense, personnel) | 1–2 |
| 3 | Team identity sheets (32 teams, 3 tested + 29 templated) | 0.5–1 |
| 4 | Runner/actions integration (glossary + team sheet injection) | 1 |
| 5 | Refresh job (cron + audit logging) | 1–2 |
| 6 | Documentation + testing | 0.5 |
| **TOTAL** | | **5–7** |

---

## Why This Matters

1. **Consistency:** Shared glossaries prevent agents from inventing definitions
2. **Freshness:** Auto-refresh monthly; stale facts (2025 cap, old coaches) updated without manual intervention
3. **Discoverability:** Writers have glossaries in system prompt; no need to search
4. **Scale:** New agents onboard with full KB immediately
5. **Trust:** Every fact has source + verified date; Editor can audit

---

## Success Criteria

- ✅ Glossaries loaded + injected into Writer/Analytics/Editor prompts
- ✅ Team sheets included in Writer/Editor/Lead artifacts
- ✅ Domain knowledge index created with source tracking
- ✅ Monthly refresh job runs without error
- ✅ Audit trail (refresh-log.md) tracks all fact updates
- ✅ No stale facts after first refresh cycle (month 2)

---

## Recommendation

Build Phases 1–3 (glossaries + team sheets) as proof of concept; extend to Phases 4–6 (refresh automation) after validation. Start with highest-impact glossaries (analytics-metrics, cap-mechanics) and 3 teams (SEA, KC, BUF). Timeline: 1 week for full implementation if prioritized.




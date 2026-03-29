# NFL Lab v2 — Prioritized Worklist

> **Goal:** Achieve v1 parity, then improve engineering efficiency.
> **Status:** v2 dashboard runs locally with LM Studio. 973 tests pass.
> Happy-path pipeline works (idea → publish-ready) but with gaps below.

---

## Phase A — Fix What's Broken (Quick Wins)

These are bugs or missing wiring in code that already exists. Each is a few hours or less.

### A1. Token usage not recorded ⚡
**Problem:** The entire token tracking chain works (providers return tokens → runner captures them → DB table exists → dashboard renders panel) BUT `actions.ts` never calls `repo.recordUsageEvent()` after agent runs.
**Fix:** Add `recordUsageEvent()` call after each of the 6 stage actions + idea generation. ~30 lines of code.
**Impact:** Usage panel on article page will populate; enables cost tracking.

### A2. Thinking separation test coverage
**Problem:** New `separateThinking()` and `writeAgentResult()` have zero dedicated tests.
**Fix:** Add ~10-15 tests for matched pairs, bare `</think>`, prose prefix, and no-thinking cases.
**Impact:** Prevents regressions on a critical path (Qwen/DeepSeek output parsing).

### A3. "Random Idea / Surprise Me" button on new-idea page
**Problem:** User must always type a prompt. V1 could generate ideas from current data/news.
**Fix:** Add a "🎲 Surprise Me" button that submits with prompt = `"Generate a random, timely NFL article idea based on current offseason storylines"`. Simple UI-only change.
**Impact:** Reduces friction for idea generation. Lays groundwork for future news-sourced ideas.

### A4. "Find Breaking News" button (stub)
**Problem:** V1 had media-sweep-generation skill for aggregating breaking news.
**Fix:** Add a "📰 Breaking News" button that calls a stub endpoint. Returns "Not yet implemented — requires external data source" for now. Wires the UI so the backend can be plugged in later.
**Impact:** Placeholder for future media sweep integration.

---

## Phase B — V1 Parity (Core Pipeline)

These close the biggest functional gaps between v1 and v2.

### B1. Wire Substack publishing end-to-end
**Problem:** `SubstackService` exists with `createDraft()`, `updateDraft()`, `publishDraft()`. Dashboard has publish UI (checklist, note composer, tweet composer). But the "Publish" button doesn't actually call SubstackService. `ProseMirror` conversion exists but isn't wired.
**Fix:** Wire the Stage 7 publish flow: markdown → ProseMirror → createDraft → store draft URL → publishDraft. Wire Note and Tweet composers to their services.
**Impact:** Articles can actually be published from the dashboard (currently they can't).

### B2. Wire Twitter/X publishing
**Problem:** `TwitterService` with OAuth 1.0a exists and is tested. Dashboard tweet composer exists. But submitting a tweet does nothing.
**Fix:** Wire tweet composer POST to `TwitterService.postTweet()`.
**Impact:** Social promotion from dashboard.

### B3. Image generation — basic integration
**Problem:** V1 generates cover + 2 inline images per article via Gemini Imagen. V2 has `StubImageProvider` (1×1 placeholder PNG) and a skeleton `GeminiImageProvider`.
**Fix (MVP):** Wire the existing MCP `generate_article_images` tool as the image provider. The tool already works. Add a "Generate Images" button on article page at Stage 5+. Store image references in artifacts DB.
**Impact:** Articles get real images before publish.

### B4. Panel discussion — multi-agent execution
**Problem:** V1 spawns 3-5 specialist agents in parallel, each with a unique "lane" (e.g., cap analysis, scheme fit). V2 uses a single "panel-moderator" that simulates all voices in one prompt. This loses expert disagreement as a product feature.
**Fix:** Implement parallel agent execution in `runDiscussion()`:
  1. Read `panel-composition.md` to get panelist names
  2. For each panelist, call `runner.run()` with that agent's charter + lane-specific instructions
  3. Run all calls concurrently (`Promise.all`)
  4. Feed individual outputs into a synthesis step (moderator summarizes)
**Impact:** Higher quality articles with genuine multi-perspective analysis. This is the #1 quality gap.

### B5. Data pipeline — wire nflverse MCP tools
**Problem:** V1 agents call Python query scripts for live NFL data (EPA, snap counts, combine, etc.). V2 has a `DataService` expecting an HTTP sidecar that doesn't exist. Meanwhile, 10 MCP tools already exist and work.
**Fix:** Two options:
  - **(a) Preferred:** Make `DataService` call the Python scripts directly via `child_process.execFile` (same as MCP tools do). No sidecar needed.
  - **(b) Alternative:** Start the MCP server as a sidecar and route DataService through it.
**Impact:** Agents get real NFL data in their prompts instead of hallucinating stats.

### B6. Copilot Pro+ provider
**Problem:** The `CopilotProvider` works but requires GitHub token auth to the GitHub Models API endpoint. Only verified models: gpt-4o, gpt-4.1, gpt-4.1-mini, o4-mini. Claude/GPT-5 fail. Running via Copilot CLI in a subprocess may expand model access.
**Fix:** Research and document which models work. Consider a bridge pattern: spawn `copilot` CLI as subprocess, feed prompts via stdin, capture stdout. Or accept current model limits and document them.
**Impact:** Enables using Copilot Pro+ subscription for inference without paying for separate API keys.

---

## Phase C — Engineering Efficiency

### C1. CI — GitHub Actions test workflow
**Problem:** No automated tests on push/PR. 973 tests only run manually.
**Fix:** Add `.github/workflows/test.yml` — run `npm test` on push to `v2` branch and PRs.
**Impact:** Catch regressions before merge. Essential for team development.

### C2. Test the happy path with real LLM (local)
**Problem:** E2e tests use MockProvider. No test validates actual LLM output quality or provider integration.
**Fix:** Add a manual/opt-in integration test that runs against LM Studio. Skip in CI, run locally with `INTEGRATION=1 npm test`.
**Impact:** Validates real LLM responses parse correctly, thinking separation works, etc.

### C3. V1 source cleanup and archival
**Problem:** V1 Python scripts, v1 dashboard, v1 squad infrastructure still in repo alongside v2. Confusing, adds maintenance burden.
**Fix:** Move v1-only files to `archive/v1/`. Keep: `content/data/` (Python query scripts used by MCP tools), `.squad/` (charters migrated but kept as reference), `mcp/` (MCP server still used). Delete: v1 dashboard, v1 pipeline_state.py, v1 article_board.py, v1 batch scripts.
**Impact:** Cleaner repo, less confusion about what's active.

### C4. Update documentation
**Problem:** README and docs still describe v1 architecture.
**Fix:** Update README with v2 architecture, setup instructions, and development workflow.
**Impact:** Onboarding, reference, and future-self clarity.

### C5. E2e test reliability
**Problem:** Current e2e tests cover happy path but limited error scenarios.
**Fix:** Add tests for: auto-advance failure + retry, stage regression + re-advance, editor REVISE verdict loop, concurrent article creation.
**Impact:** Confidence in pipeline correctness.

---

## Phase D — Dashboard & UX Polish

### D1. Configuration management UI
**Problem:** Model provider, model precedence, agent charters all configured via files. No dashboard UI to view or change.
**Fix (MVP):** Read-only "Configuration" page showing: active provider, model precedence by stage, loaded charters list, loaded skills list.
**Impact:** Visibility into system configuration without touching files.

### D2. Agent charter viewer/editor
**Problem:** Charters live as markdown files. Editing requires file access.
**Fix (Wave 1 — View):** Dashboard page listing all agent charters with markdown rendering.
**Fix (Wave 2 — Edit):** Inline editor with save-to-disk. Version history via git diff.
**Impact:** Manage agent behavior from the dashboard.

### D3. Status/debug page for runners
**Problem:** When auto-advance runs, there's no visibility into what's happening beyond the stage banner.
**Fix:** Add a "Pipeline Runs" page showing: active runs, recent completions, failures with full error + stack trace, model used, duration, token count.
**Impact:** Debugging pipeline issues without checking server logs.

### D4. Upstream context configuration UX
**Problem:** Agent upstream context is configurable in code (`CONTEXT_CONFIG` in actions.ts) but not from the dashboard. User previously asked for this.
**Fix:** Add settings panel to article page: checkboxes for which upstream artifacts each agent sees. Persist per-article or globally.
**Impact:** Test quality impact of different context strategies.

### D5. Article metadata editing
**Problem:** Depth level, team, title are set at creation and can't be changed.
**Fix:** Add edit controls on article page for: title, subtitle, depth level, primary team. Warn when changing depth level (may affect panel size). Re-trigger relevant stages on change.
**Impact:** Fix mistakes without recreating articles.

---

## Phase E — Future / External

These are larger features that require external dependencies, significant design work, or are explicitly deferred.

### E1. Multi-league extensibility (MLB, NBA, etc.)
**Current state:** Architecture already supports `league` field on articles, `config.league` in AppConfig, and charters organized by `~/.nfl-lab/agents/charters/{league}/`. The nflverse data tools are NFL-specific.
**Plan:** Each league needs: (a) data source adapters, (b) specialist agent charters, (c) league-specific skills, (d) team roster. The v2 architecture is designed to support this via the `league` config key and charter directory structure.
**When:** After v2 is stable. Bootstrap process: create `mlb/` charter directory, write 5-6 specialist charters, wire a data source (MLB Statcast?), configure model routing.

### E2. Advanced LLM providers (Anthropic, OpenAI direct)
**Current state:** LLM Gateway supports pluggable providers. Adding a new one = implement `LLMProvider` interface (3 methods).
**When:** When Copilot Pro+ or LM Studio aren't sufficient. Anthropic Claude for deep reasoning, OpenAI for structured output.

### E3. Image generation — advanced
**Current state:** MCP tool for Gemini Imagen exists. Hero-safe validation skill exists.
**Plan:** Integrate image generation into auto-advance at Stage 5. Add image review step. Support cover + inline placement. Social share thumbnail validation.
**When:** After B3 basic integration works.

### E4. Media sweep / breaking news detection
**Current state:** V1 had `media-sweep-generation` skill + `pro-football-rumors` skill for aggregating transaction data.
**Plan:** Build a scheduled background job that: (a) fetches RSS/API sources, (b) detects newsworthy events, (c) generates article ideas automatically.
**When:** After core pipeline is stable. Requires external data source integration.

### E5. Fantasy expert agent
**Idea:** Add a fantasy football specialist agent for fantasy-relevant analysis.
**When:** After multi-league extensibility.

### E6. Better token usage tracking dashboard
**Current state:** Basic usage panel per article. No cross-article aggregation.
**Plan:** Global usage page with: cost by provider, cost by model, cost by stage, trending over time, per-article breakdown.
**When:** After A1 (token recording fix).

### E7. SaaS / multi-tenant considerations
**Question:** Could this become a product? Multi-tenant dashboard, user auth, billing?
**Decision:** Not now. Focus on single-user local-first. But keep architecture clean (no hardcoded user assumptions, league-agnostic where possible).

### E8. GitHub project board / dev process
**Idea:** Set up a proper GitHub Project board for tracking this work.
**When:** When development pace warrants it. Current session-based workflow is fine for solo dev.

---

## Removed from Original List (with reasoning)

| Original Item | Reason |
|---|---|
| "Need a way to update team charter/history — seems like possibly lots of stale data?" | ✅ Already migrated to `~/.nfl-lab/agents/charters/nfl/`. Covered by D2 (charter viewer/editor). History.md replaced by SQLite memory. |
| "Add a skill to cleanup worktrees -force if needed" | Out of scope for v2 — worktrees are a v1/Copilot CLI artifact. Not relevant to v2 architecture. |
| "Setup proper squad - dev project loop" | Captured as E8 but deprioritized. Solo dev doesn't need a project board yet. |
| "Assign Model configuration Level? Or is this per stage/agent?" | ✅ Already implemented — `model-policy.ts` routes by stage key, `AGENT_STAGE_KEY` map in runner.ts routes agents → stages. Covered by D1 for UI visibility. |
| "Do a deeper dive on how squad framework was making this work in v1" | Analysis done in this session. Key insight: v1's parallel panel execution is the #1 quality gap (B4). v1's GitHub issue intake is deprioritized (dashboard-first is the right call for v2). |

---

## Suggested Execution Order

```
Phase A (Quick Wins)     → A1, A2, A3, A4        ~1 session
Phase B (V1 Parity)      → B1, B2, B5, B4, B3    ~3-4 sessions  
Phase C (Engineering)    → C1, C3, C4, C2, C5    ~2 sessions
Phase D (Dashboard UX)   → D1, D3, D2, D5, D4    ~2-3 sessions
Phase E (Future)         → As needed / opportunistic
```

**Critical path for "back to parity":** A1 → B1 → B5 → B4 → B3
**Critical path for "engineering efficiency":** C1 → C3 → C4 → A2

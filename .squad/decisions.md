# Decisions — NFL Lab

> Canonical decision ledger. Append-only. Agents write to `.squad/decisions/inbox/` → Scribe merges here.

---

### 2025-07-18: Team initialized with functional names
**By:** Joe Robinson (via Squad init)
**What:** Squad team uses functional role names (Lead, Code, Data, Publisher, Research, DevOps, UX) instead of fictional character names. No casting algorithm.
**Why:** Owner preference for clarity and simplicity over themed naming.

### 2025-07-18: @copilot auto-assignment enabled
**By:** Joe Robinson (via Squad init)
**What:** GitHub Copilot coding agent added to roster with auto-assignment enabled for `squad:copilot` labeled issues.
**Why:** Autonomous pickup of well-scoped issues (bug fixes, tests, docs) to keep the backlog moving.

### 2025-07-18: Human member — Joe Robinson as Product Owner / Tech Lead
**By:** Squad (Coordinator)
**What:** Joe Robinson is on the roster as a human member with final decision authority.
**Why:** Owner is actively involved in architecture and product decisions.

### 2026-03-22: TLDR required on all issue comments
**By:** Joe Robinson
**What:** Every Squad agent comment on a GitHub issue MUST start with `**TLDR:**` followed by a 2-3 sentence summary. Full analysis goes below the TLDR.
**Why:** Agent comments can be thousands of words. The TLDR lets the owner scan quickly and only drill into details when needed. This is how Tamir's squad works and it's proven effective for async communication.

### 2026-03-22: PR auto-merge enabled
**By:** Joe Robinson
**What:** Squad agents may create, review, and merge their own PRs without human approval. Exception: PRs touching authentication, secrets, or production deployment configs require human review.
**Why:** Reduces friction and keeps the backlog moving. The owner reviews when issues are flagged `pending-user` or when he chooses to inspect merged work.

### 2026-03-22: Squad and article pipeline are separate systems
**By:** Joe Robinson
**What:** The Squad team (`.squad/agents/`) handles project-level work: issues, PRs, infrastructure, research, publishing workflow. The article pipeline agents (`src/config/defaults/charters/nfl/`) handle content production (panel discussions, drafting, editing). These are independent — Squad does NOT modify pipeline agent charters, and pipeline agents do NOT participate in Squad ceremonies.
**Why:** The article pipeline has its own 8-stage state machine, model policy, and agent runner. Mixing the two systems would create confusion. Squad coordinates the *project*; the pipeline produces the *content*.

### 2026-03-22: Triage Round 1 — Backlog hygiene and routing
**By:** Lead (🏗️)
**What:** Triaged 5 open non-article project issues. Closed #73 (nflverse) and #72 (Substack Notes) as already implemented in v2. Routed #81 to UX, #76 to Code, #70 to UX with detailed TLDR comments.
**Why:** The backlog had stale research spikes that were fully shipped but never closed, creating a false impression of open work. Cleaning these up and routing actionable issues ensures the team focuses on real gaps. The v2 platform's capabilities (11 nflverse MCP tools, full Notes support) should be the baseline for future issue triage.

### 2026-03-22: Issue #81 — Token Usage Broken (Investigation Findings)
**By:** Code (🔧 Dev)
**What:** Confirmed three bugs in token usage tracking: (1) No pricing module — `cost_usd_estimate` always NULL; (2) Copilot CLI hard-codes `usage: undefined`; (3) No per-provider cost breakdown. Recommended approach: create pricing module, calculate cost in `recordAgentUsage()`, add provider-level aggregation to dashboard, implement token estimation for CLI.
**Why:** Token usage tracking is broken across the board, making cost analysis impossible. The pipeline needs accurate cost data for agent efficiency metrics. Implementation scope is medium (~300 lines) with no schema changes needed.
**Status:** Bug confirmed. Issue #81 labeled `go:yes`. Ready for implementation assignment.

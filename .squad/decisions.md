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

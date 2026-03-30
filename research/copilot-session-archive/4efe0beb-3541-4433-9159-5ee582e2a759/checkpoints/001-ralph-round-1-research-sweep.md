<overview>
User activated Ralph (Squad's Work Monitor) to scan the JDL440/nfl-eval GitHub issue board and process all actionable work items with maximum parallelism. The approach was to scan all open squad-labeled issues, categorize them (bugs vs research vs articles), and spawn agents for ALL actionable engineering issues simultaneously. Six background agents were launched in parallel to investigate/research issues #82, #83, #84, #85, #76, and #70. A critical discovery was that write operations (file creation, editing, git, gh CLI) were blocked this session, limiting output to research findings only.
</overview>

<history>
1. User said "Ralph, Go!" with explicit directives: maximize parallelism, update GitHub Project board, start comments with TLDR, auto-merge PRs, archive done items, respect pipeline separation.
   - Resolved team root (C:\github\nfl-eval), read team.md, routing.md, registry.json, and the github-project-board skill in parallel
   - Discovered `gh` CLI blocked with "Permission denied" — switched to GitHub MCP server tools for reading
   - Scanned all 39 open squad-labeled issues via github-mcp-server-list_issues
   - Categorized issues: 6 engineering/project issues actionable, 30+ article pipeline issues (separate per PIPELINE SEPARATION directive), 0 open PRs
   - Confirmed #81 (Token Usage) was already closed
   - Read issue comments for #82, #83, #84, #85 to understand triage state

2. Spawned 6 agents simultaneously (Round 1):
   - Code (claude-sonnet-4.5) → #82: Investigate broken publish workflow (BUG)
   - Code (claude-sonnet-4.5) → #84: Research staleness detection
   - Research (claude-haiku-4.5) → #85: Research structured domain knowledge
   - DevOps (claude-haiku-4.5) → #83: Research fact-checking pipeline wiring
   - Lead (claude-haiku-4.5) → #76: Architecture analysis for mass document update service
   - UX (claude-haiku-4.5) → #70: Research social link image generation

3. Collected results as agents completed:
   - DevOps #83, UX #70, Code #84, Lead #76 completed first (~315s)
   - Research #85 completed next (~658s)
   - Code #82 completed last (~1090s) — deep investigation of publish workflow
   - All agents produced comprehensive research findings

4. Discovered write operations completely blocked:
   - `create` tool: "Permission denied"
   - `edit` tool: "Permission denied"  
   - PowerShell file writes: "Permission denied"
   - `gh` CLI: "Permission denied"
   - `git` CLI: "Permission denied"
   - Read operations (view, glob, grep, Get-ChildItem) all worked fine
   - Could not post issue comments, create decision inbox files, update history, create branches/PRs, or update project board

5. Research #85's sub-agent ("update-files") successfully wrote files:
   - Updated .squad/agents/research/history.md with #85 findings
   - Created .squad/decisions/inbox/research-domain-knowledge.md

6. Scanned closed issues for "Done" archival — all recently closed issues (#81, #73, #72, #78) properly resolved, no stale items needing cleanup.

7. Reported board clear within current (read-only) permissions. Ralph idling.
</history>

<work_done>
Files updated (by Research #85 sub-agent only):
- `.squad/agents/research/history.md`: Appended Issue #85 research findings (lines 16-26)
- `.squad/decisions/inbox/research-domain-knowledge.md`: Created with full 4-layer KB architecture proposal

Work completed:
- [x] Scanned all 39 open squad-labeled issues
- [x] Categorized into engineering (6) vs article pipeline (30+)
- [x] Spawned 6 agents in parallel for all actionable engineering issues
- [x] Collected all 6 agent research results
- [x] Identified root cause for #82 publish bug
- [x] Scanned closed issues for archival candidates (none needed)
- [ ] Post research findings as comments on issues #82-85, #76, #70 (BLOCKED - no write access)
- [ ] Implement fix for #82 (BLOCKED - no write access)
- [ ] Update project board statuses (BLOCKED - no write access)
- [ ] Create decision inbox files for #83, #84, #70, #76 findings (BLOCKED - no write access)
- [ ] Move issues from go:needs-research → go:yes (BLOCKED - no write access)
</work_done>

<technical_details>
**Issue #82 Root Cause (CRITICAL BUG):**
- `SubstackService.publishDraft()` in `src/services/substack.ts` line 206 hardcodes `isPublished: true` without validating the Substack API response
- When Substack returns HTTP 200 but the article isn't actually published (scheduled, needs review, etc.), the pipeline still advances to Stage 8 "published" via `repo.recordPublish()`
- FIX: Validate API response for `post_date`/`is_draft` fields before advancing. Throw error if not actually published.

**Issue #83 Finding (Fact-Checking):**
- Pipeline already has panel-level fact-checking in `src/pipeline/actions.ts` within `writeDraft()` (lines 561-581)
- Uses `lead` agent with `fact-checking` skill, outputs `panel-factcheck.md`
- Gap: No draft-level validation. Proposed: `runDraftFactCheck()` sub-step in Editor Pass (Stage 5→6), ~150 LOC

**Issue #84 Finding (Staleness Detection):**
- TTL-based cache exists: 4h roster, 6h snaps, 24h draft, 30min predictions
- Manual publisher checklist flags exist but aren't automated
- Gap: No automated post-publish monitoring. 3-phase plan: cache observability → publisher automation → article monitoring (~20-29 hours)

**Issue #85 Finding (Structured Domain Knowledge):**
- 3 existing KB layers: 176 bootstrap facts (`src/config/defaults/bootstrap-memory.json`), live roster context, SQLite agent memory
- 7 gaps identified including no team glossaries, no hierarchical KB, no factual currency system
- Proposed 4-layer architecture: YAML glossaries + team identity sheets + domain index JSON + monthly refresh job (5-7 days)

**Issue #76 Finding (Mass Doc Update):**
- 4-phase rollout: inventory → local batch → Substack drafts → published merge
- Phase 1+2 = 80% value, LOW risk, ~1,120 LOC, 2.5 days. Phase 3-4 deferred.
- Service location: `src/services/batch-update.ts` + CLI

**Issue #70 Finding (Social Link Images):**
- Cover images already drive social previews via Gemini 3 Pro (16:9 format)
- Proposed: codify Witherspoon article's aesthetic + platform-specific crop validation (2-3 days)

**Session Permission Constraints:**
- This session has READ-ONLY access to the filesystem and external tools
- PowerShell Get-ChildItem and Test-Path work; all write commands blocked
- GitHub MCP server tools are read-only (no issue comment creation available)
- Sub-agents spawned via `task` tool CAN write files (Research #85's sub-agent succeeded)
- This suggests the coordinator's own tool calls are restricted but spawned agents have full access

**GitHub Project Board IDs (from .squad/skills/github-project-board/SKILL.md):**
- Project: `PVT_kwHOADzUCs4BScCq` (number: 1)
- Status field: `PVTSSF_lAHOADzUCs4BScCqzg_-OBk`
- Status option IDs: Todo=56d4a149, In Progress=d4a8378c, Pending User=b138f68b, Blocked=e435344d, For Review=b2dbea29, Done=d094e37d

**Team Configuration:**
- Team root: C:\github\nfl-eval
- Members: Lead, Code, Data, Publisher, Research, DevOps, UX, Ralph, Scribe + @copilot (auto-assign enabled) + Joe Robinson (human, Product Owner)
- Issue source: JDL440/nfl-eval with squad/squad:* labels
- User model preference: Do NOT use gpt-4.1. Use gpt-5.4 as fallback instead of opus 4.6.
</technical_details>

<important_files>
- `.squad/team.md`
   - Authoritative roster with Members table, human members, @copilot config
   - No changes made
   - Issue Source section at bottom (JDL440/nfl-eval)

- `.squad/routing.md`
   - Routing table for work assignment
   - No changes made

- `.squad/decisions.md`
   - Canonical decision ledger (7 existing decisions)
   - Key decisions: TLDR required, PR auto-merge enabled, pipeline separation
   - No changes made (write blocked)

- `.squad/skills/github-project-board/SKILL.md`
   - Project board IDs and status workflow commands
   - Critical for board status updates
   - Lines 26-31: gh project item-edit commands with IDs
   - Lines 44-55: All status option IDs

- `.squad/decisions/inbox/research-domain-knowledge.md`
   - Created by Research #85 sub-agent
   - Full 4-layer KB architecture proposal (153 lines)

- `.squad/agents/research/history.md`
   - Updated with #85 research findings at lines 16-26

- `src/services/substack.ts`
   - Contains the #82 bug at line 206 (publishDraft hardcodes isPublished: true)
   - NEEDS FIX: validate API response before advancing to Stage 8

- `src/pipeline/actions.ts`
   - Core pipeline action functions
   - Lines 561-581: existing panel-level fact-checking in writeDraft()
   - Where draft-level fact-check (#83) would be added

- `src/config/defaults/bootstrap-memory.json`
   - 176 pre-loaded domain facts (flat, no hierarchy)
   - Target for #85 structured domain knowledge work

- `src/pipeline/roster-context.ts`
   - Live roster context injection at 3 pipeline stages
   - Relevant to #84 staleness detection and #85 domain knowledge
</important_files>

<next_steps>
Remaining work (requires write-enabled session):

**Priority 1 — Fix #82 (publish bug):**
- Edit src/services/substack.ts:206 to validate Substack API response before setting isPublished: true
- Check for post_date/is_draft fields in response
- Create branch squad/82-fix-publish-workflow, commit, push, create PR, merge

**Priority 2 — Post research findings as issue comments:**
- #83: DevOps fact-checking findings (draft-level sub-step proposal)
- #84: Code staleness detection findings (3-phase plan)
- #85: Research domain knowledge findings (4-layer KB architecture) — partially done via sub-agent
- #76: Lead mass doc update architecture (4-phase rollout)
- #70: UX social link image findings (style codification)
- All comments must start with **TLDR:**

**Priority 3 — Update issue labels:**
- Move #83, #84, #85, #76, #70 from `go:needs-research` → `go:yes`

**Priority 4 — Update project board:**
- Move researched issues to appropriate statuses

**Priority 5 — Implement smallest win first:**
- #83 (fact-checking sub-step, ~150 LOC, effort: S)

**Priority 6 — Create decision inbox files:**
- devops-factcheck-research.md, code-staleness-research.md, ux-social-images.md, lead-mass-doc-update.md
- Spawn Scribe to merge inbox → decisions.md

Immediate next action: In a write-enabled session, say "Ralph, go" to resume the work loop. The coordinator should re-attempt writing the research findings and implementing the #82 fix.
</next_steps>
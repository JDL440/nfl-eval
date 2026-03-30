<overview>
This segment split into two parallel tracks: prompt/runtime cleanup in a new worktree, and deeper research on the special `CopilotCLIProvider` path for future tool/session work. The user also asked to fold Copilot CLI session reuse into the plan, then to narrow the Copilot/MCP scope to just the pipeline MCP server plus a data MCP server, explicitly excluding the broader extension-tool discussion.
</overview>

<history>
1. The user said context was getting full and asked whether to clear the session or start a new one.
   - Recommended starting a fresh session instead of wiping this one, because the session state already contained the key artifacts: `plan.md` plus prior research/checkpoints.
   - Suggested a concrete kickoff prompt for the new session to continue LLM tracing from `trace-schema-design`.

2. Several background agents completed (`code-tracing-runtime`, `lead-tracing-review`, `code-trace-capture`, `ux-tracing-surfaces`), and their outputs were read.
   - Pulled in runtime architecture findings:
     - existing observability = artifacts, thinking sidecars, usage events, stage runs, conversation history
     - missing piece = first-class prompt/request/response traces
     - best capture seam = `AgentRunner.run()` around `LLMGateway.chat()`
   - Pulled in UX findings:
     - best initial surfaces = article detail / Advanced and global `/runs`
     - no need to invent a brand-new page first
   - Used those results to strengthen the handoff recommendation for a new session.

3. The user asked to create a new worktree and provide a prompt for data/prompt cleanup work.
   - Queried current branch/worktrees.
   - Created new worktree `C:\github\worktrees\llm-prompt-cleanup` on branch `feature/llm-prompt-cleanup`.
   - Provided a ready-to-paste prompt instructing a new session to audit and clean prompt pollution in `~/.nfl-lab`, repo defaults, and migration paths.

4. The cleanup-track prompt was then given directly in this session.
   - Loaded prior `plan.md` and the earlier prompt-pollution research report from session-state.
   - Started a background `Squad` agent (`prompt-cleanup`) to coordinate the cleanup work in the new worktree.
   - Independently audited the live/runtime prompt sources:
     - confirmed runtime loads from `~/.nfl-lab\agents\charters\...` and `~/.nfl-lab\agents\skills\...`
     - confirmed migration copies `.squad` content into the v2 data dir
     - confirmed repo defaults still contain stale content like `Lead Ocean`, `.squad` references, hardcoded `claude-opus-4.6`, and old publication/image rules
   - Investigated seeding behavior:
     - `seedKnowledge()` only seeds when files are absent
     - existing live prompt files are not automatically refreshed from defaults
   - No cleanup edits were made before the conversation pivoted.

5. A new deep research task arrived about the Copilot CLI provider.
   - The task asked for a deeper dive on the special `CopilotCLIProvider`, with focus on:
     1. unboxing the agent from most of the tool restrictions
     2. giving it direct access to all repo-created MCP tools
     3. ensuring the entire flow shares a single context
   - Read the previous tool-calling research report.
   - Inspected:
     - `src\llm\providers\copilot-cli.ts`
     - `src\agents\runner.ts`
     - `src\llm\gateway.ts`
     - `src\mcp\server.ts`
     - `.github\extensions\**\tool.mjs`
     - tests covering the provider
   - Fetched Copilot CLI documentation and command reference from GitHub Docs, plus local `copilot help permissions` output.

6. Based on that research, a new research report was written and saved.
   - Created:
     `C:\Users\jdl44\.copilot\session-state\fded7635-6d90-4180-ae1f-02247f6d5b78\research\looking-at-the-add-tool-call-research-document-i-w.md`
   - Main findings in that report:
     - `CopilotCLIProvider` is currently a de-agentized one-shot wrapper
     - it flattens prompts, runs `copilot -p ... -s --no-ask-user`, uses a temp sandbox cwd, and injects a “do not use tools” constraint
     - the app does not pass provider `extraFlags`, so MCP/tool flags are not wired through at runtime
     - the app stores shared article conversation history, but the provider itself does not keep a persistent Copilot session across calls
   - Stored two memories:
     - Copilot CLI provider runs one-shot in a temp sandbox and forbids tools via prompt
     - app wiring exposes only `defaultModel`/`copilotPath`, not provider MCP/tool flags

7. The user then asked to update the plan to include reuse of Copilot CLI sessions via `--resume` and session GUIDs.
   - Re-read `plan.md`.
   - Updated `plan.md` to include:
     - evaluating Copilot CLI resumed-session mode
     - tracing both canonical prompt snapshots and incremental deltas
     - capturing `provider_session_id`, working directory / trusted-dir policy, and one-shot vs resumed-session mode
     - an explicit risk that resumed sessions could become a trace blind spot if request-level snapshots are not preserved

8. The user then asked to strip out everything about extension tools and scope MCP to just the pipeline MCP server plus a data MCP server (nflverse + prediction markets), leaving the rest of the tools off for now.
   - Began verifying the actual MCP topology before editing:
     - initially attempted to view `mcp\tool-registry.mjs` but that path did not exist in this worktree
     - found and read `C:\github\worktrees\llminputs\mcp\server.mjs`
   - Important discovery:
     - `mcp\server.mjs` already registers many repo-local tools, including publishing/image tools plus nflverse and prediction-market tools
     - this means the current “local MCP server” is broader than the user now wants
   - At compaction time, no edits had yet been applied for this last narrowing request, but the intended direction was clear:
     - revise the Copilot CLI research/plan to talk only about two MCP surfaces:
       1. pipeline MCP server
       2. data MCP server (nflverse + prediction markets)
     - remove discussion of the remaining extension tools from the immediate plan
</history>

<work_done>
Files created:
- `C:\Users\jdl44\.copilot\session-state\fded7635-6d90-4180-ae1f-02247f6d5b78\research\looking-at-the-add-tool-call-research-document-i-w.md`
  - New research report on the Copilot CLI provider.
  - Saved as requested.
  - Currently still contains extension-tool discussion that the user later asked to strip out.

Files modified:
- `C:\Users\jdl44\.copilot\session-state\fded7635-6d90-4180-ae1f-02247f6d5b78\plan.md`
  - Updated to include Copilot CLI resumed-session design considerations.
  - Added provider-session metadata, prompt delta tracing, and resumed-session risk note.

Repo/worktree operations:
- Created worktree: `C:\github\worktrees\llm-prompt-cleanup`
- Created branch: `feature/llm-prompt-cleanup`

Background agent work:
- Started `prompt-cleanup` Squad background agent for the cleanup worktree.
- Read completed agent outputs:
  - `code-tracing-runtime`
  - `lead-tracing-review`
  - `code-trace-capture`
  - `ux-tracing-surfaces`

Work completed:
- [x] Recommended new-session strategy instead of clearing context
- [x] Created cleanup worktree and handoff prompt
- [x] Audited live prompt pollution sources in `~/.nfl-lab`, repo defaults, and migration/seeding behavior
- [x] Researched `CopilotCLIProvider` deeply and saved a report
- [x] Updated `plan.md` to include Copilot session reuse / resumed-session tracing concerns
- [ ] Revise the Copilot CLI research report to remove extension-tool scope
- [ ] Update plan/research language to refer only to pipeline MCP server + data MCP server
- [ ] Decide how to describe the current `mcp\server.mjs` breadth vs the new narrowed desired scope

Current state:
- The Copilot CLI research exists and is useful, but it is now slightly out of date with the user’s latest scope decision about MCP.
- The tracing `plan.md` includes resumed-session thinking, but does not yet explicitly narrow MCP discussion to only the two desired servers.
- No code changes were made in the repository for Copilot provider behavior or prompt cleanup during this segment.
</work_done>

<technical_details>
- `CopilotCLIProvider` today:
  - uses `copilot -p ... -s --no-ask-user`
  - flattens all messages into one prompt string
  - runs from a temp sandbox directory
  - hardcodes a constraint telling Copilot not to read files, run commands, or use tools
  - estimates token usage from character counts because the CLI does not return real usage
  - supports `extraFlags`, but the app does not pass them in current runtime wiring
- App wiring:
  - `src\dashboard\server.ts` constructs `CopilotCLIProvider` with only `defaultModel` and `copilotPath`
  - so flags like `--available-tools`, `--allow-tool`, `--additional-mcp-config`, or GitHub MCP options are not exposed today
- Current runtime/context model:
  - `AgentRunner.run()` rebuilds a fresh system prompt and user prompt for every call
  - the app does already store shared article conversation history in `article_conversations`
  - some later stages pass `conversationContext`, but this is not the same as a persistent Copilot CLI session
  - true “single context always” would need either:
    - persistent Copilot session reuse (`--resume` / session ID / interactive session model), or
    - a provider-specific session abstraction
- Seeding / prompt cleanup findings:
  - runtime loads prompts from `~/.nfl-lab`, not directly from repo defaults
  - `src\migration\migrate.ts` copies `.squad` content into the v2 data dir
  - `seedKnowledge()` only seeds missing files; it does not refresh already-existing prompt files
  - therefore, fixing only repo defaults is insufficient for already-migrated installs
- Prompt pollution confirmed in both live files and defaults:
  - `Lead Ocean`
  - `.squad` references
  - old GitHub/operator workflow instructions
  - hardcoded `claude-opus-4.6`
  - outdated image/publication policies
- MCP topology discovered during the last request:
  - `src\mcp\server.ts` is the in-app pipeline MCP server with 7 tools
  - `C:\github\worktrees\llminputs\mcp\server.mjs` is a separate stdio MCP server that directly imports and registers many tool modules from `.github\extensions`
  - `mcp\server.mjs` currently includes far more than just nflverse + prediction markets:
    - publishing tools
    - image generation
    - table rendering
    - nflverse data
    - prediction markets
  - the user’s latest request is to conceptually narrow immediate scope to:
    1. pipeline MCP server
    2. data MCP server (nflverse + prediction markets)
    and leave the rest off for now
- One tool/path quirk encountered:
  - `view` on `C:\github\worktrees\llminputs\mcp\tool-registry.mjs` failed because that file does not exist in this worktree, even though earlier context had mentioned it from past sessions
- SQL/todo state:
  - session todo table still shows `trace-schema-design` as `in_progress`
  - no new todos were added for prompt cleanup or Copilot provider work in this segment
- Important uncertainty:
  - it is not yet documented in the plan/report how to reconcile the current all-in-one `mcp\server.mjs` with the user’s desired future split of “pipeline MCP server” and “data MCP server”
</technical_details>

<important_files>
- `C:\Users\jdl44\.copilot\session-state\fded7635-6d90-4180-ae1f-02247f6d5b78\plan.md`
  - Main implementation plan for tracing.
  - Updated during this segment to include Copilot CLI session reuse / resumed-session trace concerns.
  - Key edited section: Phase 3 provider notes and open-risks/notes area around lines ~104-125 and ~221-293.

- `C:\Users\jdl44\.copilot\session-state\fded7635-6d90-4180-ae1f-02247f6d5b78\research\looking-at-the-add-tool-call-research-document-i-w.md`
  - New deep research report focused on `CopilotCLIProvider`.
  - Important because it captures:
    - provider one-shot behavior
    - current tool suppression
    - lack of shared provider session
    - MCP/tool-policy options
  - Needs revision to remove extension-tool scope and align with the user’s narrower MCP request.
  - Key sections to revisit:
    - lines ~7-12 (executive summary)
    - lines ~99-178 (tool surfaces)
    - lines ~227-264 (MCP section)
    - lines ~351-367 (bottom-line answers/confidence)
    - footnotes ~374-389

- `C:\github\worktrees\llminputs\src\llm\providers\copilot-cli.ts`
  - Central to the Copilot provider research.
  - Verified current behavior:
    - temp sandbox cwd
    - hardcoded no-tools prompt constraint
    - one-shot `copilot -p`
    - `extraFlags` support
  - Key sections:
    - options/constructor ~84-128
    - `chat()` ~162-203
    - `buildPrompt()` ~214-252
    - command execution ~256-350

- `C:\github\worktrees\llminputs\src\dashboard\server.ts`
  - Important for actual runtime provider wiring.
  - Shows that only `defaultModel` and `copilotPath` are passed into `CopilotCLIProvider`.
  - Key section: ~2850-2910

- `C:\github\worktrees\llminputs\src\agents\runner.ts`
  - Important for understanding prompt rebuilding and skill `tools:` parsing.
  - Confirms fresh prompt assembly every run.
  - Key sections:
    - parse skill frontmatter/tools ~180-215
    - build user prompt / run flow ~409-557

- `C:\github\worktrees\llminputs\src\pipeline\conversation.ts`
  - Important for understanding shared article conversation state.
  - Confirms all agents share a single stored article thread.
  - Key sections:
    - file header + types ~1-22
    - `addConversationTurn()` / `getArticleConversation()` ~194-256

- `C:\github\worktrees\llminputs\src\pipeline\actions.ts`
  - Important for understanding where conversation context and trace metadata are threaded.
  - Key sections:
    - `runAgent()` / trace context ~507-533
    - stage actions using conversation context and repeated upstream artifact context ~805-1436
    - `gatherContext()` ~714-749

- `C:\github\worktrees\llminputs\src\pipeline\context-config.ts`
  - Important for identifying repeated upstream-context injection across stages.
  - Key sections: default per-stage include lists ~15-45

- `C:\github\worktrees\llminputs\src\mcp\server.ts`
  - In-app pipeline MCP server.
  - Important because it is one of the two MCP surfaces the user now wants to keep in scope.
  - Key sections:
    - tool list ~28-153
    - server creation/list tools ~200-217

- `C:\github\worktrees\llminputs\mcp\server.mjs`
  - Newly important because it revealed the actual “local MCP server” shape.
  - Registers tool modules from `.github\extensions`, including data + non-data tools.
  - Critical for the latest scope change, because this is what now needs to be mentally narrowed to “data MCP server only” in planning/research.
  - Key sections:
    - imports and server setup ~1-42
    - nflverse + prediction market registrations ~137-256
    - also registers publishing/image/table tools earlier in the file

- `C:\github\worktrees\llminputs\src\config\index.ts`
  - Important for prompt cleanup track.
  - Confirms runtime loads live prompts from data dir (`~/.nfl-lab`) and that seeding is separate.
  - Key sections:
    - `loadConfig()` data dirs ~238-277
    - `seedKnowledge()` behavior ~140-197

- `C:\github\worktrees\llminputs\src\migration\migrate.ts`
  - Important for prompt cleanup track.
  - Confirms `.squad` charters/skills/config/history are copied into the v2 data dir.
  - Key sections: ~260-380

- `C:\github\worktrees\llm-prompt-cleanup`
  - New worktree created for prompt cleanup work.
  - Branch: `feature/llm-prompt-cleanup`
</important_files>

<next_steps>
Remaining work:
- Revise the Copilot CLI provider research report so it no longer talks about the broad extension-tool catalog as immediate scope.
- Update the planning language to refer only to:
  1. the pipeline MCP server
  2. the data MCP server (nflverse + prediction markets)
- Decide how to describe the current `mcp\server.mjs` reality:
  - it currently bundles more than the desired “data MCP server”
  - but the user wants the plan to ignore the rest for now
- Continue or review the prompt-cleanup work in the separate worktree if that track resumes.

Immediate next steps when work resumes:
1. Edit `C:\Users\jdl44\.copilot\session-state\fded7635-6d90-4180-ae1f-02247f6d5b78\research\looking-at-the-add-tool-call-research-document-i-w.md`
   - remove the “three tool surfaces” framing
   - replace it with:
     - Copilot CLI native tools
     - pipeline MCP server
     - data MCP server
   - strip discussion of publishing/image/table extension tools from the immediate recommendations
   - update bottom-line answers and confidence section accordingly
   - adjust footnotes if needed so citations for the “data MCP server” can still point at `mcp\server.mjs` and the relevant data-tool sections

2. Optionally add a short note to `plan.md`
   - under the provider/Copilot CLI discussion, say future MCP integration should start with only the pipeline MCP server and the data MCP server
   - leave other repo-local tools out of scope for now

3. If needed, verify whether the repo should eventually split `mcp\server.mjs`
   - one pipeline server
   - one data server
   or just conceptually scope usage to the data subset for Copilot CLI
   - this is an open design question, not yet resolved

Blockers / open questions:
- The user’s latest directive is clear on desired scope, but the codebase currently has a broader local MCP server than the desired scope. The remaining work is editorial/planning alignment, not a discovered technical blocker.
</next_steps>
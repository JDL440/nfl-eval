---
name: Runtime Contract Sync for Externalized Agent Prompts
domain: workflow-architecture
confidence: high
tools: [view, grep]
---

# Runtime Contract Sync for Externalized Agent Prompts

## When to Use

- Workflow behavior is defined partly by prompt files or charters stored outside source control runtime paths
- A source review says behavior was simplified, but live runs still look like the old contract
- Agent prompts are seeded once into a data dir, home dir, or app state folder
- Review findings depend on whether the running server is reading repo defaults or persisted runtime copies

## Pattern

**Treat prompt/charter synchronization as architecture, not operations trivia.**

If runtime agents load contracts from a seeded data directory instead of directly from `src/config/defaults/**`, then a workflow simplification is incomplete unless you also define how those runtime files are updated.

Typical failure shape:

1. Source defaults are simplified in-repo
2. The live app keeps reading old seeded prompt files
3. Real articles still churn under the old contract
4. Reviewers incorrectly conclude the simplification itself failed

## Review Checklist

1. **Find the real prompt source**
   - Does runtime read repo defaults directly, or a copied/separate data dir?
   - Identify the exact read path in config + runner code

2. **Check seed semantics**
   - Is seeding one-time only?
   - Does startup sync, overwrite, version, or only fill missing files?

3. **Compare live and source contracts**
   - Read both the source default file and the runtime-loaded file
   - Compare timestamps and substantive instructions, not just filenames

4. **Check live artifacts**
   - Confirm whether article behavior matches the runtime file or the source file
   - Use the actual stuck article artifacts/logs as the tie-breaker

5. **Protect escalation metadata**
   - If the workflow depends on structured blocker tags or signatures, verify the live contract still emits them
   - Missing metadata can silently degrade escalation even when verdict parsing still works

## NFL Lab Example

- `loadConfig()` points `chartersDir` / `skillsDir` at `~/.nfl-lab/...`
- `seedKnowledge()` copies defaults only when files are missing
- `AgentRunner` loads prompt files from the seeded runtime directory
- Result: editing `worktrees/V3/src/config/defaults/**` does not update the live editor/writer contract unless runtime knowledge is explicitly refreshed

## Preserved Behaviors

When loosening a workflow after detecting runtime drift, still preserve:

- deterministic malformed-input guards
- canonical verdict parsing
- structured blocker metadata for repeated-blocker escalation
- honest escalation instead of force-pass

## Anti-Pattern

Do **not** conclude “Stage 5 is still too strict” or “the new Editor contract failed” until you verify the live runtime is actually using the reviewed prompt files.

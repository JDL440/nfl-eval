---
name: Copilot Session Artifact Harvest
domain: research-operations
confidence: high
tools: [powershell, glob, view, sql]
---

# Copilot Session Artifact Harvest

## When to use

- You need to recover research/planning documents from prior Copilot CLI sessions.
- Session data is spread across many UUID folders and nearby CLI-managed directories.
- You want to archive only human-authored documents, not logs, caches, or packaged runtime docs.

## Pattern

1. Inspect repo status first so you understand whether the working tree is already dirty.
2. Search the likely Windows roots:
   - `C:\Users\<user>\.copilot\session-state`
   - `C:\Users\<user>\.copilot`
   - `C:\Users\<user>\AppData\Local\copilot`
   - `C:\Users\<user>\AppData\Local\GitHub CLI`
   - `C:\Users\<user>\AppData\Roaming\GitHub CLI`
3. Treat `session-state` as the primary archive source. The other roots are usually config/package locations and should normally be excluded.
4. Harvest only high-signal seams:
   - root-level preserved markdown docs
   - `plan.md`
   - `checkpoints\*.md`
   - `research\*.md`
5. Use session-store metadata or session summaries to map UUID folders back to project context before recommending copies.
6. Propose collision-safe destination names that preserve:
   - date
   - session summary/context
   - session id
   - original basename

## Exclusions

- Logs, caches, lockfiles, DB files, permissions/config state
- Packaged SDK/runtime docs under `AppData\Local\copilot\pkg`
- Scratch paste files unless their content is clearly a preserved deliverable

## Why this works

- The Copilot CLI already preserves its best human-facing artifacts in `session-state`, so you can recover meaningful research without scraping noisy runtime internals.
- UUID folder names alone are not enough; pairing them with session summaries makes the archive understandable later.
- Provenance-rich filenames prevent `plan.md` collisions and keep future research imports reviewable.

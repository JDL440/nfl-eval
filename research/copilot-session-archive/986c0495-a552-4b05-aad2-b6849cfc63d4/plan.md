# Implementation plan

Problem: Implement Phase 1 and Phase 2 of the earlier fact-checking rollout for the NFL Lab pipeline.

Approach:
1. Add a repo-specific fact-checking skill and define a standard `panel-factcheck.md` artifact.
2. Update lifecycle and article-generation guidance so the fact-check preflight sits between panel output and Writer, without changing the 8-stage DB model.
3. Tighten Writer guardrails around unsupported specifics, invented names, and quote handling.
4. Add dashboard/document-classification support so the new artifact shows up in the right UI grouping and can be surfaced as a completion note.
5. Validate touched files and review diffs.

Implementation scope:
- `.squad/skills/fact-checking/SKILL.md`
- `.squad/skills/article-lifecycle/SKILL.md`
- `.squad/skills/substack-article/SKILL.md`
- `.squad/agents/writer/charter.md`
- dashboard UI/document grouping files as needed
- README updates only if needed to keep the public pipeline description accurate

Notes:
- Keep the 8-stage numeric pipeline unchanged in `content/pipeline_state.py`.
- Treat the new fact-check artifact as a Stage 4 exit / Stage 5 entry gate, not a new numbered stage.
- Keep Editor as the final mandatory review gate.

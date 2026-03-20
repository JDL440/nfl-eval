# Session: Article Pipeline Telemetry Research

**Date:** 2026-03-18T00:00:00Z  
**Topic:** article pipeline per-article usage telemetry research  
**Requestor:** Backend  
**Agent:** Lead

---

## What Happened

Lead completed a full audit of the NFL Lab article pipeline to identify surfaces for runtime usage instrumentation (model selection, token counts, cost tracking).

## Key Findings

- **Stage persistence:** Well-structured in `content/schema.sql` (table: `stage_transitions`); agent name + timestamp captured, but model and tokens are NOT recorded.
- **Model config:** Documented in `.squad/config/models.json` but NOT enforced at spawn time.
- **Non-LLM tools:** Substack publisher, Gemini image gen, and table renderer lack usage logging.
- **Metadata:** Can be stored in `stage_transitions.notes` as JSON without schema change.

## Decisions Made

1. **Phase 1 (1 hour):** Add optional metadata dict to `PipelineState.advance_stage()`, serialize to JSON, store in notes.
2. **Phase 2 (2–3 hours):** Create `llm_call_log` table + `PipelineState.record_llm_call()` method.
3. **Phase 3 (4–6 hours):** Load `.squad/config/models.json`, validate model at spawn time.
4. **Phase 4 (1–2 weeks):** Build Datasette cost dashboard.

## Artifact Produced

`.squad/decisions/inbox/lead-article-telemetry-infrastructure.md` — Complete design memo with implementation examples.

## Next Steps

- Scribe merges decision inbox into `decisions.md`
- Backend begins Phase 1 implementation
- Lead instruments next article pipeline run to validate Phase 1

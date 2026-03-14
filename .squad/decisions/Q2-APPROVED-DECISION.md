# Q#2 APPROVED DECISION — Media API Integration Method

**Date:** 2026-03-14  
**Decision:** Option B (Structured JSON Export from Media Agent)  
**Lead Approval:** Joe Robinson  

---

## Summary

Backend M1 implementation will await a structured JSON export from the Media agent instead of parsing the markdown history file. This provides:
- ✅ Unambiguous, structured data (no regex fragility)
- ✅ Pre-filtered article triggers (Media handles significance logic)
- ✅ Cleaner handoff between agents
- ⏱️ 1-2 day delay (Media prepares schema + export)

---

## Implementation Plan

### Phase 1: Media Agent Prepares JSON Schema (1-2 days)
- Media generates daily `media-sweep.json` at `.squad/agents/media/media-sweep.json`
- Schema matches spec in `.squad/decisions/inbox/media-api-integration-spec.md` (Section "Option B")
- Includes: transactions, deal details, significance triggers, source attribution
- First export covers 2026-03-14 sweep

### Phase 2: Backend Integrates JSON Parser (Days 3-4, after Media completes)
- Backend implements JSON parser (simple, no regex logic needed)
- GitHub Actions workflow reads `media-sweep.json` daily (after Media sweep completes)
- Enqueues `draft-article` jobs based on `article_triggers` array
- Commits media-sweep.json + queue.db to git audit trail

---

## JSON Schema (Final Spec)

Media agent must generate:

```json
{
  "sweep_id": "sweep-2026-03-14",
  "swept_at": "2026-03-14T11:00:00Z",
  "period": {
    "start": "2026-03-13",
    "end": "2026-03-14"
  },
  "transactions": [
    {
      "id": "tx-001",
      "type": "signing|trade|release|draft|injury",
      "player": "Jaelan Phillips",
      "position": "EDGE",
      "from_team": "MIA",
      "to_team": "CAR",
      "deal": {
        "years": 4,
        "total_million": 120,
        "guaranteed_million": 80,
        "aav_million": 30
      },
      "sources": ["ESPN", "Yahoo", "SI"],
      "confidence": "🟢 confirmed|🟡 likely|🔴 rumor",
      "notes": "narrative context"
    }
  ],
  "article_triggers": [
    {
      "team": "CAR",
      "trigger_type": "multi_signings",
      "transaction_ids": ["tx-001", "tx-002"],
      "article_idea": "Panthers defensive rebuild with Phillips + 1 more signing",
      "significance": "high|medium|low"
    }
  ],
  "metadata": {
    "version": "1.0",
    "generated_by": "Media agent",
    "next_sweep": "2026-03-15T11:00:00Z"
  }
}
```

---

## Timeline Impact

| Phase | Original | Updated | Impact |
|-------|----------|---------|--------|
| **M1 Days 1-2** | ✅ Start today | ✅ Start today | No change (BullMQ setup) |
| **M1 Days 3-4** | ⏳ Blocked on Q#2 | ✅ Ready after Media prep | +1-2 days (acceptable) |
| **M2 Start** | ✅ Start today | ✅ Start today | No change (independent) |
| **M3 Start** | ✅ Start today | ✅ Start today | No change (independent) |
| **Total M1 Duration** | 3-4 days | 3-5 days | +1-2 days acceptable |

M1 completes ~2026-03-16 (instead of 2026-03-15). Still within original 4-day estimate.

---

## Action Items

### Media Agent
- [ ] Read spec in Section "Option B" of `media-api-integration-spec.md`
- [ ] Generate `media-sweep.json` following schema above
- [ ] Save to `.squad/agents/media/media-sweep.json`
- [ ] Commit to git with message: `feat: daily media sweep JSON export for M1 integration`
- [ ] Expected: Ready by EOD 2026-03-15

### Backend
- [ ] Wait for Media to complete JSON schema + first export
- [ ] Implement JSON parser (`.squad/decisions/inbox/media-api-integration-spec.md` Section "Option B")
- [ ] Days 3-4: GitHub Actions workflow + media-sweep job
- [ ] Test with Media's exported JSON (no regex, no parsing fragility)

### Lead (Coordinator)
- [ ] Notify Media agent of JSON schema requirement
- [ ] Confirm Media has capacity to generate daily export
- [ ] Track completion and unblock Backend on Day 3

---

## Benefits of This Decision

✅ **Robust:** No regex parsing, no fragility  
✅ **Clear:** Media owns article significance logic, Backend owns job queue logic  
✅ **Auditable:** JSON schema is explicit, errors are obvious  
✅ **Scalable:** Easy to evolve schema without Backend changes  
✅ **Maintainable:** JSON is version-controlled, backward-compat is possible  

---

## Fallback Plan

If Media cannot complete JSON export by EOD 2026-03-15:
1. Backend falls back to Option A (regex parsing) temporarily
2. Continue with regex until JSON is ready
3. Switch to JSON once available (no code rework needed)

---

**Decision Approved by:** Joe Robinson (Lead/Coordinator)  
**Timestamp:** 2026-03-14  
**Reference:** `.squad/decisions/inbox/media-api-integration-spec.md`

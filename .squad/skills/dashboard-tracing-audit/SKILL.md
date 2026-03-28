---
name: Dashboard Tracing Audit
domain: dashboard-ux
confidence: high
tools: [view, rg, server.ts, vitest]
---

# Dashboard Tracing Audit

## When to use

- You need to audit UI surfaces that expose LLM request/response tracing (observability).
- The system is using SSE, HTMX partials, and SQLite-backed event logging.
- You're designing first-class tracing visibility for operators without breaking existing UX.

## Pattern

1. **Identify data flow from origin to operator view:**
   - Where is the request initiated? (`src/agents/runner.ts` prompt composition)
   - Where is it recorded? (`src/db/repository.ts` → `usage_events` table)
   - Where should operators see it? (dashboard surfaces in `src/dashboard/views/`)

2. **Map existing observability surfaces:**
   - What surfaces already exist that *could* expose tracing?
   - What data is already persisted but not visible?
   - What SSE events/HTMX refresh patterns are in place?

3. **Propose four-layer visibility:**
   - **Global surface** (runs page): Request envelope at-a-glance (provider, tokens, status)
   - **Article-detail inline** (action panel): Model/provider attribution without clicking
   - **Advanced panel** (collapsed details): Per-stage execution trace (tokens, duration, finish reason)
   - **Telemetry breakdown** (sidebar): Aggregate token/cost flow across stages and providers

4. **Design for three constraints:**
   - **SSE/HTMX coupling:** Refresh patterns must respect existing event emission and fragment scoping
   - **Mobile safety:** Progressive disclosure via `<details>` and responsive charts, no hover-only UX
   - **No schema churn:** Reuse existing tables (`stage_runs`, `usage_events`); defer new columns until v3

5. **Mitigate common risks:**
   - **Fragment staleness:** Use outer-scope SSE triggers to refresh whole article detail, not individual sections
   - **Tooltip inaccessibility:** Provide `<details>` fallback on mobile
   - **Bar chart overflow:** Use percentage widths, not fixed pixels
   - **Real-time delay:** Ensure recording is synchronous, SSE emitted after DB commit

## Key surfaces to audit

| Surface | File | Current Exposure | Tracing Opportunity |
|---------|------|------------------|---------------------|
| Runs page | `src/dashboard/views/runs.ts` | Status, duration, tokens | Add provider, input tokens, finish reason |
| Article detail | `src/dashboard/views/article.ts` | Stage timeline, artifacts | Add model badge to action panel, inline attribution |
| Advanced panel | `src/dashboard/views/article.ts` | Stage runs (collapsed) | Add Audit Log subsection with per-run trace |
| Usage sidebar | `src/dashboard/views/article.ts` | Total tokens/cost | Add token-by-stage and cost-by-provider breakdown |

## Data contracts to verify

| Table | Relevant Columns | Current Use | For Tracing |
|-------|------------------|-------------|-------------|
| `stage_runs` | `requested_model`, `output_budget_tokens`, `started_at`, `completed_at` | Model routing, timing | Provider inference, duration |
| `usage_events` | `provider`, `model_or_tool`, `prompt_tokens`, `output_tokens`, `metadata_json`, `cost_usd_estimate` | Cost tracking | Request envelope, finish reason from metadata |
| `article_conversations` | `content`, `token_count`, `created_at` | Conversation history | Input token attribution (optional, deferred) |

## Phased rollout template

Phase 1: Global surface visibility (runs page, inline attribution)
Phase 2: Article-detail tracing depth (advanced panel audit log)
Phase 3: Telemetry aggregation (token/cost breakdown)
Phase 4: Mobile hardening + performance

Each phase should:
- Add test coverage in existing test files (`tests/dashboard/server.test.ts`, `tests/dashboard/wave2.test.ts`)
- Emit SSE events at appropriate moments (after `recordUsageEvent()` or on `stage_changed`)
- Respect existing HTMX fragment patterns (no new endpoints, just new render calls)

## Common pitfalls

- **Showing only recent usage:** Always query the full `usage_events` history for an article, not a convenience limit.
- **Hover-only UX on mobile:** Provide `<details>` disclosure fallback for stage badge tooltips on <768px.
- **Stale fragment after SSE refresh:** Subscribe to SSE on the parent container (`.article-detail`), not the specific section.
- **Missing finish reason:** Check if it's already in `usage_events.metadata_json` before adding a schema column.
- **Coupling to provider ID format:** Provider name should be inferred from `usage_events.provider` (normalize/map if needed).

## Implementation checklist

- [ ] Audit current usage_events table: verify finish_reason is recorded (metadata vs. column)
- [ ] Map SSE event flow: when is `usage_recorded` event emitted?
- [ ] Identify render calls: which view functions take article + usage_events?
- [ ] Test HTMX refresh: does article-detail refresh on SSE without stale fragments?
- [ ] Mobile test: do tooltips/charts render on 320px/375px/768px viewports?
- [ ] Phased rollout plan: which surfaces go live in which sprint?

## Key files

- `src/dashboard/views/runs.ts` — runs page rendering
- `src/dashboard/views/article.ts` — article detail (action panel, advanced panel, usage panel)
- `src/dashboard/server.ts` — route handlers, data passing, SSE emission
- `src/dashboard/sse.ts` — event types and SSE helpers
- `src/db/schema.sql` — usage_events and stage_runs tables
- `src/db/repository.ts` — usage_events recording and query
- `tests/dashboard/server.test.ts` — route and render coverage
- `tests/dashboard/wave2.test.ts` — mobile viewport assertions

## Reference

See `.squad/decisions/inbox/ux-llm-tracing-surfaces.md` for the full v3 tracing design.

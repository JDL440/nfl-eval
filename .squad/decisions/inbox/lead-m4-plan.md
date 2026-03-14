# M4 — Production Deployment Plan

**Author:** Lead (Lead Orchestrator)
**Date:** 2026-03-14
**Status:** PROPOSED — Awaiting team acknowledgment before execution begins
**Priority:** P0
**Depends on:** M1 ✅, M2 ✅, M3 ✅ (all merged to main)

---

## M4 Overview

M4 takes the validated article pipeline (queue → draft → review → approve) live by adding Substack publishing, hourly news ingestion, production monitoring, cost reporting, and rate-limit resilience. This is the "flip the switch" milestone — after M4, the system produces and publishes NFL articles with one-click human approval and zero manual infrastructure work.

---

## Decomposition

### Backend (5 work items, ~4-5 days)

| ID | Work Item | Description | Est. |
|----|-----------|-------------|------|
| **B1** | Substack API client | Implement `src/integrations/substack-client.js`. POST article (title, body, subtitle) to Substack Publication API. Handle auth (API key from env), response parsing, error mapping. Support draft-only and publish modes. Retry on 5xx with exponential backoff (3 attempts, 1s/2s/4s). | 1 day |
| **B2** | Hourly cron sweep | Upgrade GitHub Actions cron from daily (6 AM ET) to hourly during active hours (7 AM–11 PM ET). New workflow `hourly-sweep.yml` reads `media-sweep.json`, scores significance, enqueues `draft-article` jobs. Include a dedup check — skip transactions already processed (by `tx.id`). | 0.5 day |
| **B3** | Production monitoring + alerting | Add health-check endpoint (`/health`) that returns queue depth, last sweep time, Redis connectivity, and error count. Implement alerting: (1) Slack/email webhook if queue error rate >5% in 1 hour, (2) alert if no sweep runs for >2 hours, (3) alert if Redis disconnects. Use GitHub Actions `workflow_dispatch` as manual recovery trigger. | 1 day |
| **B4** | Daily token budget email report | Build `src/reports/daily-budget-report.js`. Aggregates: articles drafted today, tokens consumed (by model), cost breakdown (Haiku vs Opus), cumulative spend vs daily budget ($1.30), projected weekly/monthly burn. Sends via SendGrid/Resend (env-configured). Triggers at 11 PM ET via cron. Alert threshold: 70% ($0.91) sends immediate warning; 90% ($1.17) pauses queue. | 1 day |
| **B5** | Rate limit fallback workflows | Implement circuit breaker pattern for external APIs (Substack, Media sources). On HTTP 429: (1) respect `Retry-After` header, (2) exponential backoff up to 5 min, (3) after 3 consecutive 429s, pause that API for 30 min and alert. On persistent failure: move job to `FAILED_RETRIABLE` state, surface in dashboard. On budget exhaustion: hard-stop all draft jobs, allow only approve/publish of existing articles. | 1 day |

### Frontend (4 work items, ~3-4 days)

| ID | Work Item | Description | Est. |
|----|-----------|-------------|------|
| **F1** | Publish button integration | Wire dashboard "Approve" action to trigger Backend's Substack publish endpoint. Show publish confirmation modal with article preview. Display Substack URL after successful publish. Handle publish failures with retry option. | 1 day |
| **F2** | Production monitoring dashboard | New `/status` page showing: system health (green/yellow/red), queue depth chart (last 24h via Recharts), sweep history timeline, error log (last 50 errors), Redis status. Auto-refresh every 30 seconds. | 1 day |
| **F3** | Cost reporting UI | New `/costs` page showing: today's spend vs budget (progress bar), per-article cost breakdown table, Haiku vs Opus usage pie chart, 7-day trend line, projected monthly burn. Pull data from Backend cost aggregation endpoint. | 0.5 day |
| **F4** | Production hardening | Add error boundary components (catch React crashes gracefully). Implement loading states for all API calls. Add offline detection banner. Configure production build optimization (code splitting, asset hashing). Set `<meta>` tags for production URL. Environment-based API URL config (dev vs prod). | 0.5 day |

### Tester (5 work items, ~3-4 days)

| ID | Work Item | Description | Est. |
|----|-----------|-------------|------|
| **T1** | Substack publish E2E tests | Test full flow: approve article → Substack API call → article published → URL returned → dashboard updated. Test publish failure → retry. Test publish → unpublish → Substack draft revert. Use mock Substack API (no live calls in CI). | 1 day |
| **T2** | Hourly cron integration tests | Test: sweep runs → transactions parsed → significance scored → jobs enqueued → dedup works (same tx not re-enqueued). Test sweep with 0 new transactions (no-op). Test sweep with 50+ transactions (load handling). | 0.5 day |
| **T3** | Monitoring + alerting tests | Test: health endpoint returns correct status. Test: alert fires when error rate exceeds 5%. Test: alert fires when sweep stalls >2 hours. Test: queue pauses at 90% budget. Mock the webhook/email to verify payload format. | 0.5 day |
| **T4** | Rate limit + circuit breaker tests | Test: 429 response → backoff → retry succeeds. Test: 3 consecutive 429s → 30-min pause → alert sent. Test: budget exhaustion → draft jobs blocked, approve/publish still works. Test: API timeout (30s) → job marked retriable. | 0.5 day |
| **T5** | Production readiness validation | Smoke test suite that runs against live (staging) environment: (1) health endpoint responds, (2) dashboard loads <2s, (3) approve → publish round-trip <10s, (4) cost endpoint returns valid data, (5) sweep completes without error. This is the final gate before go-live. | 1 day |

---

## Dependencies & Sequencing

```
Week 1 (Days 1-3): Foundation
─────────────────────────────
B1 (Substack client)  ──────────────────────────┐
B2 (Hourly cron)      ────────────┐              │
F4 (Production hardening) ────────┤              │
                                  ▼              ▼
                        T2 (Cron tests)   T1 (Substack tests)
                                  │              │
Week 2 (Days 3-5): Integration    ▼              ▼
─────────────────────────────
B3 (Monitoring)    ──────────→ T3 (Monitor tests)
B4 (Budget email)  ──────────→ F3 (Cost UI)
B5 (Rate limits)   ──────────→ T4 (Circuit breaker tests)
F1 (Publish button) ←──────── B1 (Substack client must exist)
F2 (Status page)   ←──────── B3 (Health endpoint must exist)

Week 2 (Day 5): Final Gate
──────────────────────────
T5 (Production validation) ← ALL above must pass
```

**Critical path:** B1 → F1 → T1 → T5 (Substack publish is the longest dependency chain)

**Parallel tracks:**
- B2 + B3 + B4 can run in parallel (independent Backend work)
- F2 + F3 can start as soon as B3 + B4 endpoints exist
- T2 + T3 + T4 can run in parallel once their Backend counterparts land

**Hard blockers:**
- B1 blocks F1 and T1 (can't test what doesn't exist)
- B3 blocks F2 (dashboard needs health data)
- ALL work items block T5 (production validation is final gate)

---

## Integration Points with M1/M2/M3

### M1 (BullMQ Queue) — Extends
| M4 Component | M1 Integration | Change Type |
|--------------|---------------|-------------|
| B1 (Substack) | New job type: `publish-article` added to existing queue | Additive |
| B2 (Hourly cron) | Existing `media-sweep` job, new schedule (hourly vs daily) | Config change |
| B4 (Budget email) | Reads token_usage from existing job records | Read-only |
| B5 (Rate limits) | New job states: `FAILED_RETRIABLE`, `PAUSED_RATE_LIMIT` | Schema extension |

### M2 (React Dashboard) — Extends
| M4 Component | M2 Integration | Change Type |
|--------------|---------------|-------------|
| F1 (Publish) | Adds real Substack action to existing approve flow | Extends existing button |
| F2 (Status) | New page, reuses existing layout/nav | Additive |
| F3 (Costs) | New page, reuses Recharts from M2 | Additive |
| F4 (Hardening) | Wraps existing components in error boundaries | Non-breaking |

### M3 (E2E Tests) — Extends
| M4 Component | M3 Integration | Change Type |
|--------------|---------------|-------------|
| T1-T4 | New test suites added alongside existing M3 suites | Additive |
| T5 | New smoke suite (production-only, not in CI) | Additive |
| All | Existing mock infrastructure (mock-media-api, mock-substack-api) reused | Reuse |

**Key principle:** M4 extends M1/M2/M3 — it does NOT rewrite them. All M1/M2/M3 tests must continue to pass.

---

## Test Strategy

### Test Pyramid

```
                    ┌─────────────┐
                    │   T5 Smoke  │  ← 5 tests, runs against staging
                    │  (live env) │
                    ├─────────────┤
                 ┌──┤ T1-T4 E2E  ├──┐  ← 20-30 tests, mock APIs
                 │  │  (mocked)  │  │
                 │  ├─────────────┤  │
              ┌──┤  │ Unit Tests  │  ├──┐  ← 40-60 tests, pure logic
              │  │  │ (per module)│  │  │
              │  │  └─────────────┘  │  │
              └──┴───────────────────┴──┘
```

### Coverage Targets

| Module | Target | Rationale |
|--------|--------|-----------|
| substack-client.js | >90% | Publishing is the most critical path |
| hourly-sweep workflow | >85% | Scheduling errors compound fast |
| budget-report.js | >85% | Financial accuracy is non-negotiable |
| circuit-breaker.js | >90% | Failure handling must be bulletproof |
| Dashboard publish flow | >80% | User-facing critical path |
| Health endpoint | >95% | Must be reliable to detect problems |

### What We Test vs. What We Don't

**We test (with mocks):**
- Substack API request format, auth headers, error handling
- Cron scheduling logic, dedup, significance scoring
- Budget calculations, alert thresholds, email payload format
- Circuit breaker state transitions, backoff timing
- Dashboard UI flows, error states, loading states

**We do NOT test (deferred to staging/production):**
- Actual Substack API response behavior (T5 smoke only)
- Real email delivery (verify in staging)
- Production Redis performance under load
- Real-world cron timing accuracy (GitHub Actions handles this)

### CI Integration

All T1-T4 tests run in `phase2-ci.yml` alongside existing M3 tests:
```yaml
# New job added to phase2-ci.yml
m4-tests:
  needs: [backend-tests, frontend-unit-tests]
  steps:
    - run: npm test -- --testPathPattern="tests/m4/"
```

T5 (smoke tests) runs separately via `workflow_dispatch` against staging.

---

## Rollout Plan

### Stage 1: Staging Environment (Day 5)
1. Deploy to staging URL (e.g., `nfl-staging.fly.dev` or similar)
2. Configure Substack API key (test publication, not real)
3. Run T5 smoke suite against staging
4. Backend manually triggers one sweep → draft → publish cycle
5. Verify article appears on test Substack publication
6. **Gate:** T5 passes, manual publish verified

### Stage 2: Shadow Mode (Days 6-7)
1. Enable hourly sweeps on production, but with `publish_mode: "draft_only"`
2. All articles queue and draft automatically, but publish button sends to Substack as DRAFT (not published)
3. Human reviews 3-5 drafts on real Substack dashboard
4. Verify: cost tracking accurate, no unexpected behavior, sweep cadence stable
5. **Gate:** 24 hours of clean shadow-mode operation, 3+ articles drafted successfully

### Stage 3: Live Publish (Day 8)
1. Flip `publish_mode: "live"` in environment config
2. First human-approved article publishes to real Substack
3. Verify article renders correctly on Substack (formatting, images, links)
4. Monitor: error rate, token spend, sweep timing for 24 hours
5. **Gate:** First article published successfully, no alerts in 24h

### Stage 4: Steady State (Day 9+)
1. Enable daily budget email reports
2. Enable all monitoring alerts (Slack/email)
3. Document runbook: common failure modes + recovery steps
4. Hand off to Joe Robinson for daily approval workflow
5. **Gate:** Joe approves 2+ articles end-to-end without engineering help

### Rollback Plan
At any stage, if critical issues arise:
1. Disable hourly cron (comment out schedule in workflow file)
2. Set `publish_mode: "disabled"` — dashboard still works, no Substack calls
3. All queued articles remain in M1 queue, no data loss
4. Fix → re-run T1-T5 → restart from current stage

---

## Success Criteria

All items must be met before M4 merges to main:

### Functional (Must Pass)
- [ ] **Substack publish works:** Approve article → appears on Substack within 10 seconds
- [ ] **Hourly sweep runs:** Cron triggers every hour (7 AM–11 PM ET), processes new transactions
- [ ] **Dedup works:** Same transaction ID is never processed twice
- [ ] **Manual approval enforced:** Zero articles auto-publish in any scenario
- [ ] **Unpublish works:** Published article can be reverted to draft on Substack
- [ ] **Rejection flow works:** Rejected article is archived, not resurfaced

### Reliability (Must Pass)
- [ ] **Rate limit handled:** 429 → backoff → retry succeeds (verified in T4)
- [ ] **Circuit breaker activates:** 3 consecutive failures → 30-min pause → alert sent
- [ ] **Budget hard-stop works:** At 90% daily budget, draft jobs pause automatically
- [ ] **API timeout handled:** 30-second timeout → job marked retriable
- [ ] **Health endpoint accurate:** Reports correct queue depth, sweep time, Redis status

### Cost & Reporting (Must Pass)
- [ ] **Token tracking accurate:** Within 5% of actual API bill
- [ ] **Daily email sends:** Correct cost breakdown, budget remaining, projection
- [ ] **70% alert fires:** Immediate notification when daily spend hits $0.91
- [ ] **Cost UI matches Backend:** Dashboard `/costs` page matches email report data

### Performance (Must Pass)
- [ ] **Dashboard loads <2s** on desktop, <3s on mobile
- [ ] **Publish round-trip <10s** from approve click to Substack confirmation
- [ ] **Sweep completes <60s** for up to 50 transactions
- [ ] **Health endpoint responds <200ms**

### Test Coverage (Must Pass)
- [ ] **All M3 tests still pass** (no regressions)
- [ ] **M4 test suites pass:** T1-T4 green in CI
- [ ] **T5 smoke passes** against staging environment
- [ ] **Coverage >80%** on all new M4 modules
- [ ] **Zero flaky tests** (3 consecutive green CI runs required)

### Operational (Must Pass Before Go-Live)
- [ ] **Runbook written:** Common failure modes + recovery steps documented
- [ ] **Secrets configured:** Substack API key, SendGrid key in GitHub Secrets + production env
- [ ] **Monitoring verified:** At least 1 test alert received and acknowledged
- [ ] **Shadow mode clean:** 24 hours of draft-only operation with no errors
- [ ] **Joe approves 2+ articles** end-to-end without engineering help

---

## Open Questions for Joe Robinson

1. **Substack API access:** Do we have API credentials for the Seahawks publication? (Substack's API is invite-only — may need to apply or use email-to-post as fallback)
2. **Email provider for reports:** Preference on SendGrid vs Resend vs simple SMTP?
3. **Staging environment:** Fly.io free tier, Railway, or local-only staging?
4. **Alert channel:** Slack webhook, email, or both?
5. **Go-live target date:** Aiming for end of this week or next?

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Substack API access denied (invite-only) | 🔴 High | Fallback: email-to-post integration (Substack supports email publishing). Less elegant but functional. |
| Hourly sweeps exceed token budget | 🟡 Medium | Budget hard-stop at 90%. Hourly cadence only during active news hours. Can throttle to every 2h if needed. |
| GitHub Actions cron drift (±15 min) | 🟢 Low | Dedup by transaction ID handles overlap. Acceptable for news ingestion. |
| SendGrid/email delivery failures | 🟡 Medium | Fallback: write cost report to git-committed JSON. Dashboard `/costs` page is primary; email is backup. |
| Production Redis instability | 🟡 Medium | BullMQ has built-in reconnection. Queue state also persisted to SQLite. No single point of failure. |

---

**Next step:** Backend starts B1 (Substack client). Frontend starts F4 (production hardening). Tester prepares T1 test scaffolding (mock Substack API). All three can begin in parallel.

*— Lead, 2026-03-14*

# M3 — End-to-End Test Suite Implementation Strategy

**Status:** Planning Phase — Ready to scaffold immediately  
**Author:** Tester (QA & Test Automation Engineer)  
**Date:** 2026-03-14  
**Priority:** P0 (blocks M4 production deployment)  
**Effort:** 2-3 days scaffold + mock work (now) + 2-3 days test suites + 2-3 days integration (after M1+M2)

---

## Quick Summary

M3 delivers end-to-end testing of the article pipeline automation with 9 key validations:

1. ✅ **Workflow correctness** — Article state machine (PROPOSED → PUBLISHED)
2. ✅ **Token cost accuracy** — Predictions match actual within ±5%
3. ✅ **Haiku vs Opus cost model** — Draft cost vs review cost (3x difference validated)
4. ✅ **Safety gates** — Manual approval mandatory, zero auto-publishes
5. ✅ **Rejection flows** — Article rejection → archive (no resurrection)
6. ✅ **Unpublish safety** — Revert to DRAFTED state (reversible, safe)
7. ✅ **Performance baseline** — 100+ articles/hour throughput
8. ✅ **Edge cases** — Rate limits (429), API failures (5xx), timeouts, retries
9. ✅ **Daily budget** — Alert fires at 70% spend ($0.91 of $1.30 GitHub Pro+ budget)

**Key insight:** Mock-based approach means test scaffold can begin immediately — **no blockers on M1/M2 completion**. By Week 1, mocks + test suites ready to integrate.

---

## Test Architecture Overview

### Phase 1: Project Scaffolding (1 day — Start Now)

**What to create:**
```
tests/
├── e2e/
│   ├── fixtures/
│   │   ├── sample-articles.js        # 5-10 test articles
│   │   ├── mock-media-api.js         # Mock news feed
│   │   ├── mock-substack-api.js      # Mock publishing
│   │   └── token-samples.js          # Pre-calculated token counts
│   ├── mocks/
│   │   ├── article-queue.mock.js     # Mock BullMQ interface
│   │   ├── token-counter.mock.js     # Mock token counting
│   │   └── git-repo.mock.js          # Mock git state
│   ├── suites/
│   │   ├── workflow.test.js          # State machine tests
│   │   ├── cost-tracking.test.js     # Cost accuracy tests
│   │   ├── safety-gates.test.js      # Manual approval tests
│   │   ├── edge-cases.test.js        # Rate limits, failures, etc
│   │   └── performance.test.js       # Throughput benchmarks
│   └── helpers/
│       ├── test-runner.js
│       ├── assertions.js
│       └── report-generator.js
├── jest.config.js
└── package.json
```

**Key files:**
- `package.json` — Jest, test libraries
- `jest.config.js` — Jest configuration, coverage thresholds
- `.env.test` — Test environment variables

### Phase 2: Mock Infrastructure (2-3 days — Week 1)

Mock APIs **fully independent** — can be built and tested before M1/M2 completion.

**Mock Media API:**
- Simulates daily news feed (transactions, injuries, etc.)
- Pre-populated with 5-10 test scenarios
- Can inject rate limits (429), API failures (5xx) for edge case testing

**Mock Substack API:**
- Simulates publishing and unpublishing
- Tracks published articles
- Can inject failures to test retry logic

**Mock Token Counter:**
- Pre-calculated token counts (based on real Claude Opus/Haiku runs)
- Tracks cumulative cost and daily budget
- Validates cost accuracy within ±5%

**Sample Articles (5-10):**
- High significance (auto-draft): Seahawks starter signing
- Medium significance (borderline): Backup depth player
- Low significance (archived): Practice squad move
- Division rival: ARI major signing
- Injury report: Key player IR

### Phase 3: Test Suites (3-4 days — Week 1-2)

Five independent Jest test suites, each focusing on a specific validation:

#### 3.1 Workflow Tests (`workflow.test.js`)
```javascript
✓ PROPOSED → DRAFTING → REVIEWING → APPROVED → PUBLISHED
✓ Rejection path: REVIEWING → ARCHIVED (no resurrection)
✓ Unpublish path: PUBLISHED → DRAFTED → APPROVED → PUBLISHED (reversible)
✓ State transitions atomic (no skipping states)
✓ Concurrent articles don't interfere with state
```

#### 3.2 Cost Tracking Tests (`cost-tracking.test.js`)
```javascript
✓ Haiku draft cost vs Opus review cost (3x difference validated)
✓ Predicted cost matches actual within ±5%
✓ Cumulative cost tracking across 5-10 articles
✓ Daily budget alert triggers at 70% spend ($0.91/$1.30)
✓ Per-article cost accurate to within ±$0.01
```

#### 3.3 Safety Gate Tests (`safety-gates.test.js`)
```javascript
✓ Zero articles auto-publish (manual approval required)
✓ Manual approval gate enforced at all significance levels
✓ Unpublish reverts safely to DRAFTED state
✓ Significance threshold rules respected (score ≥4 → auto-draft)
✓ Approved but not published stays in APPROVED state
```

#### 3.4 Edge Case Tests (`edge-cases.test.js`)
```javascript
✓ Rate limit (429) triggers retry with exponential backoff
✓ API failure (5xx) handled with fallback logic
✓ Timeout (>30s) rolls back draft to retry-eligible state
✓ Duplicate news detection (same transaction twice → no duplicate draft)
✓ Incomplete draft recovery (resumable after failure)
```

#### 3.5 Performance Tests (`performance.test.js`)
```javascript
✓ Queue throughput: >100 articles/hour at 2 concurrent drafts
✓ Full test suite execution: <5 minutes
✓ Dashboard query response: <2 seconds (M2 requirement)
✓ Cost calculation: <100ms for 100 articles
✓ State machine transitions: <500ms each
```

### Phase 4: Test Execution & Reporting (1-2 days — Week 2)

**Test runner:**
```bash
npm test                 # Run all tests
npm run test:e2e        # Run E2E tests only
npm run test:watch      # Watch mode for development
npm run test:coverage   # Generate coverage report
```

**Custom Jest assertions:**
```javascript
expect(state).toBeValidArticleState()           // Validates state enum
expect(tokens).toBeWithinTokenBudget(expected)   // ±5% tolerance
expect(cost).toBeWithinCostBudget(dailyBudget)   // Cost ≤ budget
expect(article).toHaveAutoApprovalBlocker()      // Manual gate enforced
```

**Coverage thresholds:**
- Branches: >80%
- Functions: >80%
- Lines: >80%
- Statements: >80%

### Phase 5: Integration Tests (2-3 days — Week 3, After M1+M2)

Once Backend (M1) and Frontend (M2) are complete, full end-to-end integration:

```javascript
describe('Full Pipeline Integration', () => {
  test('Cron → Draft → Review → Approve → Publish (real components)')
  test('Real BullMQ queue interactions')
  test('Real React dashboard approval workflow')
  test('Real Substack API publishing')
  test('Cost tracking matches real token usage')
})
```

---

## Sample Test Articles

All 5 articles must be tested:

| ID | Team | Topic | Significance | Expected State | Cost |
|----|------|-------|--------------|---|---|
| `sea-witherspoon-ext` | SEA | Starter signing | 6 | REVIEWING | $0.047 |
| `sea-backup-rb` | SEA | Backup depth | 3 | PROPOSED | — |
| `sea-ps-move` | SEA | Practice squad | 1 | ARCHIVED | — |
| `ari-edge-rusher` | ARI | Division rival | 5 | REVIEWING | $0.048 |
| `sea-starter-injury` | SEA | Key player IR | 5 | REVIEWING | $0.045 |

---

## Token Cost Model (Validated by Tests)

**Pricing (as of 2026-03-14):**
- Claude Haiku: ~$0.0008 per 1K tokens (draft phase)
- Claude Opus: ~$0.03 per 1K tokens (review phase)

**Per-Article Economics:**
- Draft tokens: 1200-3000 (typical: 2000)
- Review tokens: 800-2000 (typical: 1500)
- Draft cost: ~$0.0016 per article
- Review cost: ~$0.045 per article
- **Total per article: ~$0.047**

**Daily Budget (GitHub Copilot Pro+):**
- Monthly cost: $39
- Daily budget: ~$1.30
- 70% alert threshold: $0.91
- Capacity: ~27-28 articles/day

---

## Success Criteria (All Required for M4)

- [ ] All workflow state transitions pass (100% success rate)
- [ ] Token cost tracking accurate within 5% of predicted
- [ ] Zero articles auto-publish in any scenario (manual approval verified)
- [ ] Daily budget alert triggers correctly at 70% threshold
- [ ] Unpublish/revert works safely (reversible, no data loss)
- [ ] Edge cases (rate limits, retries, failures) handled gracefully
- [ ] Performance: queue throughput >100 articles/hour
- [ ] Test execution time <5 minutes (full suite)
- [ ] Code coverage >80% on queue + cost-tracking modules
- [ ] All 5-10 sample articles processed without errors
- [ ] Integration tests pass with real M1+M2 components

**If any test fails** → M4 production deployment blocked until fixed.

---

## Blockers & Dependencies

### No Blockers for Phase 1-2 (Now)
- Mock infrastructure fully independent
- Can scaffold and test without M1/M2

### Requires M1 for Phase 5 (Week 3)
- Real BullMQ queue instance
- Real token counter integration
- Real GitHub Actions triggers

### Requires M2 for Phase 5 (Week 3)
- Real React dashboard
- Real approval workflow UI
- Real-time queue status display

---

## Implementation Timeline

| Phase | Week | Duration | Deliverable | Blocker |
|-------|------|----------|-------------|---------|
| 1. Scaffolding | Now | 1 day | Jest setup, package.json | None (start now) |
| 2. Mocks | 1 | 2-3 days | Mock APIs, token counter, sample articles | None (start now) |
| 3. Test Suites | 1-2 | 3-4 days | 5 Jest test suites | Mocks (phase 2) |
| 4. Execution | 2 | 1 day | Test runner, assertions, reporting | Test suites (phase 3) |
| 5. Integration | 3 | 2-3 days | Full E2E with real components | M1 + M2 completion |

**Total:** 2-3 days scaffold/mocks (NOW) + 2-3 days test suites (next week) + 2-3 days integration (week 3, after M1+M2).

---

## Collaboration Points

### With Backend (M1)
- Backend implements BullMQ queue matching `IArticleQueue` interface (see test-api-contracts.md)
- Backend provides token counter matching `ITokenCounter` interface
- Tests import queue + counter; validate behavior

### With Frontend (M2)
- Frontend implements React dashboard with approve/reject/unpublish buttons
- Tests can drive dashboard UI and verify state updates
- Full integration validates end-to-end user workflow

### With Lead (M4)
- Lead makes go/no-go decision based on M3 test results
- All 9 acceptance criteria must pass
- Zero tolerance for manual approval gate failures

---

## Key Files & References

- **Implementation Plan:** `.squad/agents/Tester/history.md`
- **Test Strategy:** `.squad/decisions.md` (search "M3 Test Strategy")
- **API Contracts:** `.squad/decisions/inbox/test-api-contracts.md` (defines interfaces for M1/M2)
- **Issue:** GitHub #3 (acceptance criteria source)
- **VISION.md:** Enterprise context and cost model

---

## Quick Start Commands

```bash
# Setup
npm install

# Run tests
npm test                    # All tests
npm run test:e2e           # E2E only
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report

# Phase 1: Create project structure
mkdir -p tests/e2e/{fixtures,mocks,suites,helpers}
touch jest.config.js package.json .env.test

# Phase 2: Create mocks
touch tests/e2e/fixtures/{sample-articles,mock-media-api,mock-substack-api,token-samples}.js
touch tests/e2e/mocks/{article-queue,token-counter,git-repo}.mock.js

# Phase 3: Create test suites
touch tests/e2e/suites/{workflow,cost-tracking,safety-gates,edge-cases,performance}.test.js

# Phase 4: Create helpers
touch tests/e2e/helpers/{test-runner,assertions,report-generator}.js
```

---

## Next Session Priorities

1. **Phase 1:** Create Jest project structure + package.json
2. **Phase 2:** Implement mock APIs (Media, Substack, Token Counter)
3. **Phase 3:** Write all 5 test suites using mocks
4. **Wait:** M1 + M2 completion
5. **Phase 5:** Integrate with real components, validate end-to-end

---

**Questions?** See Tester charter (`.squad/agents/Tester/charter.md`) or reach out to the team in decisions.md.

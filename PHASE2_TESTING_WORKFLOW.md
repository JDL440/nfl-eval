# Phase 2 Automation — Local Testing & Review Workflow

## For Backend / Frontend Agents

### Before Pushing Your Code

1. **Run all tests locally:**
   ```bash
   # For dashboard (Frontend)
   cd dashboard
   npm test                    # Jest unit tests
   npm run test:e2e            # Playwright E2E tests
   npm run test:all            # Both
   
   # For backend/queue
   cd tests
   npm test                    # All unit + integration tests
   ```

2. **Check test results** — all must pass (green checkmarks):
   - Unit tests: typically <30s
   - E2E tests: typically <2min
   - Integration tests: typically <1min
   - Total: ~3-4 minutes

3. **Build & verify no warnings:**
   ```bash
   # Dashboard
   cd dashboard && npm run build
   
   # Backend verification
   npm run test -- queue.test.js
   ```

### Creating Your PR

4. **Commit message should include test summary:**
   ```
   [M1] Add token counting for Opus articles
   
   - Implements token cost calculation for Opus model
   - 3 new unit tests, all passing
   - Backwards compatible with existing Haiku tracking
   
   Tests: ✅ 24/24 unit tests pass | ✅ 8/8 integration tests pass
   E2E: N/A (backend change)
   Load time: <100ms token calculation
   ```

5. **PR title format:**
   ```
   [M1/M2/M3] Brief description of change
   ```

### What Lead Will Review

Lead will use the CI workflow results to approve or request changes:

- **Test results:** All tests passing? Coverage adequate?
- **Code quality:** Using Opus 4.6 model standards (clear variable names, proper error handling)
- **Integration:** Does this work with other components?
- **Performance:** Load time, queue throughput, token calculation speed
- **Architecture:** Does it follow existing patterns?

### Example: Backend Agent PR

```markdown
**PR:** #42 - [M1] Add Opus token counting

**Changes:**
- New function `calculateOpusTokens()` in `scripts/token-counter.js`
- Updated `scripts/job-processor.js` to use both Haiku + Opus models
- 3 new unit tests for edge cases (long articles, multiple drafts)

**Tests Passing:**
✅ queue.test.js — 6/6 pass (added 2 new Opus-specific cases)
✅ media-sweep.test.js — 3/3 pass (no changes)
✅ cost-tracking.test.js — 14/14 pass (new Opus pricing verified)

**Performance:**
- Token calculation: 45ms avg (target: <100ms) ✓
- Queue initialization: unchanged
- No new dependencies

**Local validation:**
```bash
npm test                              # All green
npm run test:all -- --coverage        # 87% coverage
```

**Ready for review!**
```

## CI Automation (GitHub Actions)

When you push to a `squad/*` branch or open a PR:

1. **GitHub Actions runs automatically** — phase2-ci.yml triggers
2. **Pipeline jobs run in parallel:**
   - Backend tests (queue, media parser, integration)
   - Frontend unit tests (Jest)
   - Frontend E2E tests (Playwright on Chromium)
   - Performance tests
3. **Results appear as PR checks:**
   - ✅ All passing = ready for Lead review
   - ❌ Any failure = Lead cannot approve until fixed
4. **PR comment auto-posted** with test summary (if all pass)

## Local Testing Troubleshooting

### Playwright tests fail locally but pass in CI

```bash
# Install browsers
cd dashboard
npx playwright install

# Run with debug output
npm run test:e2e -- --debug

# Use UI mode to watch tests
npm run test:e2e:ui
```

### Jest tests timeout

```bash
# Run with extended timeout
npm test -- --testTimeout=10000

# Check for hanging processes
ps aux | grep node
```

### Queue tests fail (SQLite issues)

```bash
# Clear stale database files
rm -f .queue/jobs.db .queue/jobs.db-wal .queue/jobs.db-shm

# Re-initialize
npm run test -- queue.test.js
```

## Key Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| Unit test execution | <1min | — |
| E2E test execution | <2min | — |
| Dashboard load time | <2s | — |
| Token calc latency | <100ms | — |
| Test coverage | >80% | — |
| PR cycle time | <4 hours | — |

## When Lead Requests Changes

1. **Read the feedback carefully** — Lead provides specific reasons
2. **Fix locally, re-run tests** — all must pass before pushing
3. **Force-push to the same branch** — PR updates automatically
4. **Comment:** "Fixed — tests still passing" + results
5. **CI re-runs** → Lead approves or requests more changes

Once approved, merge via GitHub and lead will post-merge checklist.

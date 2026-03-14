# Phase 2 Automation — GitHub Issues Templates

Create these 4 issues in your GitHub repo to kick off the implementation.

---

## [M1] Build BullMQ job queue + GitHub Actions cron sweep

```
Title: [M1] Build BullMQ job queue + GitHub Actions cron sweep
Labels: squad, squad:backend, phase2-automation, milestone-1
Priority: Critical
Milestone: Phase 2 Automation

**Acceptance Criteria:**
- BullMQ queue initialized and running locally
- Job states (pending, processing, completed, failed) tracked
- GitHub Actions cron trigger working (daily Media API sweep at 6 AM ET)
- Event-driven trigger support (manual article request from dashboard)
- Job retry logic with exponential backoff
- Token cost tracking per job (model + input/output token count)
- Significance threshold rules (hard-coded; manual approval gate always applies)

**Tech Stack:**
- Node.js + BullMQ (free, open-source)
- SQLite for queue state (.db file committed to git)
- Git for article state (JSON files in content/articles/)

**Scope Notes:**
- Integrate with Media API to fetch NFL trades/contracts daily
- Draft articles using Haiku model (cost optimization)
- Store draft in queue pending human approval
- No auto-publish (all articles require manual approval)

**Estimated Effort:** 3-4 days
**Blocks:** M2, M3, M4
```

---

## [M2] Build web dashboard for article approval workflow

```
Title: [M2] Build web dashboard for article approval workflow
Labels: squad, squad:frontend, phase2-automation, milestone-2
Priority: High
Milestone: Phase 2 Automation
Depends On: #1 (M1 must be complete)

**Acceptance Criteria:**
- Dashboard shows queue jobs (pending, drafted, ready for review)
- Display article preview (headline, summary, body from agent)
- Approve / Reject / Edit controls
- Token cost display per article
- Audit log: all actions (generated, approved, rejected, published, unpublished)
- Significance score visible
- Responsive layout (desktop + mobile)
- Unpublish capability (reverts to drafted, creates audit entry)

**Tech Stack:**
- React (or lightweight alternative)
- Connect to SQLite queue for live status
- Git diff view for edits before approval

**Scope Notes:**
- Manual approval required for ALL articles (no auto-publish)
- Display estimated vs. actual token cost per article
- Show article rejection reasons (human feedback for learning)

**Estimated Effort:** 3-4 days
**Blocks:** M3, M4
```

---

## [M3] Write end-to-end test suite + token cost tracking

```
Title: [M3] Write end-to-end test suite + token cost tracking
Labels: squad, squad:tester, phase2-automation, milestone-3
Priority: High
Milestone: Phase 2 Automation
Depends On: #1 + #2 (M1 and M2 must be complete)

**Acceptance Criteria:**
- Integration test: full article flow (cron → draft → approve → publish)
- Test: article rejection → manual resubmission
- Test: unpublish → revert to drafted state
- Test: token cost tracking accuracy (vs. predicted)
- Test: Haiku for drafts, Opus for reviews (cost model validation)
- Test: significance threshold rules (auto-draft vs. manual approval)
- Performance: queue throughput (articles/hour at scale)
- Edge cases: rate limits, API failures, retry exhaustion
- Manual approval gate enforced (zero auto-publishes)

**Test Coverage:**
- Local tests (mock Substack API, no external dependencies)
- 5-10 sample articles (various significance levels)
- Cost report: cumulative tokens, remaining quota, projection
- Daily budget validation (alert at 70% spend)

**Estimated Effort:** 2-3 days
**Blocks:** M4
```

---

## [M4] Deploy to production + Substack API integration

```
Title: [M4] Deploy to production + Substack API integration
Labels: squad, squad:backend, squad:frontend, phase2-automation, milestone-4
Priority: Highest
Milestone: Phase 2 Automation
Depends On: #1 + #2 + #3 (All milestones must pass)

**Acceptance Criteria:**
- Substack API integration live (direct publish, not copy-paste)
- Cron sweep running hourly against live Media API
- Dashboard accessible at production URL
- Article approval → Substack publish end-to-end
- Monitoring: job failures, API errors, token spend
- Audit trail queryable in dashboard
- Unpublish capability tested and safe
- Daily token cost email report
- Fallback: if Substack API rate-limited, manual copy-paste workflow documented
- Human approval gate remains mandatory

**Scope Notes:**
- Token alerts if daily spend > 70% of budget
- Slack notifications for job failures
- Backfill decision: publish historical or start fresh?
- ~1 hour/week human oversight confirmed

**Estimated Effort:** 2-3 days
**Unblocks:** Team ready for go-live
```

---

## How to Create These Issues

1. Go to your GitHub repo: https://github.com/{owner}/nfl-eval/issues/new
2. Copy each template above into the issue body
3. Apply the labels listed (create `squad`, `squad:backend`, etc. if needed)
4. Create issue
5. Squad will auto-route to the correct agent based on `squad:{role}` label

**Squad will then:**
- Assign issue to the labeled agent
- Agent creates branch: `squad/{issue-number}-{slug}`
- Agent commits and pushes work
- Agent opens PR from branch
- Lead reviews and approves
- PR merges, issue closes

---

## Parallel Work Opportunities

- While Backend builds M1, Tester can scaffold M3 test fixtures
- While Frontend builds M2 UI, Backend is implementing M1 queue
- M2 and M1 can overlap (Frontend designs UI while Backend finishes job persistence)

---

## Go-Live Checklist (After M4)

- [ ] Cron finding NFL trades/contracts daily
- [ ] Dashboard approving/rejecting articles
- [ ] Token budget tracked (no overspending)
- [ ] Substack publishing end-to-end
- [ ] Audit trail working
- [ ] ~1 hour/week human overhead confirmed
- [ ] Team ready for operational handoff

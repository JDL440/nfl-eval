# Phase 2 Architecture Decisions

> **Author:** Lead (Technical Lead Agent)  
> **Date:** 2026-03-14  
> **Status:** Proposed — awaiting user input on open questions  
> **Full Proposal:** `content/proposals/phase2-automation-proposal.md`

---

## Decisions Made (Proposed)

### 1. Article Lifecycle State Machine

**Decision:** 6-state article lifecycle

```
PROPOSED → DRAFTING → REVIEWING → APPROVED → PUBLISHED
                              ↘ ARCHIVED (rejected/superseded)
```

**Rationale:**
- Clear transitions with defined triggers
- Every state has recovery semantics if system crashes
- Human approval gate before publish (no auto-publish)
- Archived state for rejected or superseded articles

**Affected Components:** Queue system, dashboard, state persistence

---

### 2. Job Queue Technology

**Decision:** BullMQ (Node.js + Redis)

**Alternatives Considered:**
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| BullMQ | Native cron, priority queues, excellent retry | Requires Redis | ✅ Recommended |
| GitHub Actions only | No infra | Limited control | ❌ Too limited |
| Python + Celery | Mature | Language mismatch | ❌ Pass |

**Rationale:** BullMQ provides priority handling (breaking news > routine), built-in retry with backoff, and job scheduling—all features we need for the pipeline.

**Dependency:** Redis (can use free tier on Railway/Upstash for MVP)

---

### 3. Scheduling Strategy

**Decision:** Hybrid (GitHub Actions + BullMQ)

| Task | Scheduler | Why |
|------|-----------|-----|
| Daily Media Sweep | GitHub Actions cron | Free, auditable, reliable |
| Article Draft/Review | BullMQ event | Needs priority, retry, concurrency |
| Weekly Knowledge Sync | GitHub Actions cron | Low-priority background |
| Publish | BullMQ (manual trigger) | Needs error handling |

**Rationale:** GitHub Actions is free and works great for scheduled jobs. BullMQ handles event-driven complexity.

---

### 4. Persistence Strategy

**Decision:** Git-based JSON for MVP → SQLite at scale

**Phase 2 (MVP):** `content/queue/pipeline-state.json` committed to git
- Full audit trail
- No database setup
- Human-readable

**Phase 3 (32-team):** Migrate to `data/pipeline.db` (SQLite)
- Better query performance
- Proper concurrency handling
- Transaction support

**Rationale:** Don't over-engineer for MVP. Git works for single-team. Migration path is clear.

---

### 5. Significance Scoring Rules

**Decision:** Points-based trigger for auto-drafting

| Signal | Points |
|--------|--------|
| Seahawks involved | +3 |
| Division rival (ARI, LAR, SF) | +2 |
| Contract > $10M AAV | +2 |
| Draft pick top-60 | +2 |
| Position of need (EDGE, RB, CB) | +1 |
| Confirmed (not rumor) | +1 |
| **Threshold to draft** | **≥4** |

**Examples:**
- Seahawks sign EDGE ($15M AAV): 3 + 2 + 1 + 1 = **7** → Draft article
- 49ers sign WR ($20M AAV): 2 + 2 + 1 = **5** → Draft article (division impact)
- Cardinals depth signing: 2 = **2** → No article

**Rationale:** Prevents article spam while catching genuinely interesting news.

---

### 6. Cost Model

**Decision:** Tiered model strategy (proposed, pending user input)

| Task | Model | Est. Cost |
|------|-------|-----------|
| Expert analysis (×4) | Sonnet | $0.50 |
| Writer | Opus | $0.60 |
| Editor | Opus | $0.40 |
| **Total per article** | | **~$1.50** |

**Alternative (quality-first):** Opus everywhere = ~$3.20/article

**Rationale:** Writer and Editor are quality-critical (voice and accuracy). Expert analysis can use Sonnet without major quality loss.

**Pending:** User preference on cost vs quality tradeoff.

---

### 7. Dashboard Technology

**Decision:** Express + EJS (server-rendered HTML)

**Alternatives Considered:**
| Option | Complexity | UX | Verdict |
|--------|------------|-----|---------|
| Express + EJS | Low | Basic | ✅ MVP |
| React SPA | High | Rich | Phase 3 |
| CLI only | Very low | Poor | ❌ Pass |

**Features (MVP):**
- Queue view (list by state)
- Article detail view
- Approve/Archive buttons
- Cost per article display
- Error log

**Rationale:** Server-rendered HTML is fast to build and sufficient for one human operator reviewing 4-5 articles/week.

---

## Open Questions (Awaiting User Input)

1. **Confirm BullMQ + Redis?** Or prefer simpler approach?
2. **Cost strategy?** Opus everywhere ($3.20) vs tiered ($1.50)?
3. **Substack integration?** Email-to-post vs Puppeteer vs manual?
4. **Target date for first automated article?** Before/during/after draft?
5. **Confirm Seahawks-only for Phase 2?** Any second team pilot?

---

## Implementation Dependencies

```
Milestone 1 (Queue + Cron)
├── Redis instance (free tier OK)
├── BullMQ package
├── GitHub Actions workflow files
└── pipeline-state.json schema

Milestone 2 (Dashboard)
├── Express server
├── EJS templates
└── Basic CSS

Milestone 3 (End-to-End Test)
├── agent spawn scripts
├── Editor auto-review
└── error recovery logic

Milestone 4 (Launch)
├── Substack integration
└── monitoring/alerts
```

---

*These decisions are proposals. Implementation should not begin until user confirms tech stack preferences via the open questions in the full proposal.*

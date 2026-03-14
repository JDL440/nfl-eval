# Phase 2 Automation Proposal — NFL Content Pipeline

> **Status:** Proposal for Review  
> **Author:** Lead (Technical Lead Agent)  
> **Created:** 2026-03-14  
> **Scope:** Seahawks-focused MVP; architecture designed for 32-team scale

---

## Executive Summary

Phase 1 proved the model: 47 agents producing expert-grade NFL analysis with a fact-checking pipeline that catches real errors. Two Seahawks articles (~3,500 words each) demonstrated publication-quality output with authentic expert disagreement.

Phase 2 automates the pipeline: daily news ingestion → automatic article drafting → editorial review → human approval queue → one-click publish. Target: **one human hour per week** to operate the Seahawks Substack.

---

## 1. Current State Analysis

### What Phase 1 Proved

| Capability | Evidence | Confidence |
|-----------|----------|------------|
| Multi-agent disagreement produces valuable content | Cap ($27M) vs PlayerRep ($33M) on Witherspoon — opposite conclusions, same data | ✅ High |
| Cross-agent synthesis | 6 agents converged on Jadarian Price (RB) — a player casual fans haven't heard of | ✅ High |
| Automated fact-checking catches real errors | Editor found 6 errors in one article: McDuffie All-Pro count, Witherspoon hometown, contract figures, Emmanwori name confusion | ✅ High |
| Daily news ingestion + distribution | Media swept 20+ transactions, distributed to 18-20 team agents per sweep | ✅ High |
| Publication-quality long-form | Two ~3,500-word articles with data tables, expert quotes, clear recommendations | ✅ High |
| 32-team knowledge base | All 32 team agents trained with roster, cap, coaching, needs | ✅ Built |

### Current Manual Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   MEDIA     │───▶│   WRITER    │───▶│   EDITOR    │───▶│   PUBLISH   │
│ (manual     │    │ (manual     │    │ (manual     │    │ (manual     │
│  trigger)   │    │  trigger)   │    │  trigger)   │    │  copy/paste)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
   Human runs         Human spawns      Human reviews
   Media sweep        Writer + experts  Editor output
```

**Time per article (current):** ~2-3 hours human involvement  
**Steps requiring human input:** 4 (sweep trigger, expert spawns, editor review, publish)

### What Works

| Component | Status | Notes |
|-----------|--------|-------|
| Agent charters | ✅ Solid | Clear boundaries, responsibilities, voice |
| Data sources | ✅ Validated | OTC, Spotrac, ESPN, NFL.com all work; PFR blocked |
| Editorial pipeline | ✅ Proven | Writer → Editor flow catches errors |
| Rumor tracking | ✅ Working | Confidence levels (🟢/🟡/🔴), lifecycle management |
| Knowledge recording | ✅ Standardized | Skills documented, learnings captured |

### What's Fragile

| Component | Issue | Risk |
|-----------|-------|------|
| Knowledge staleness | Agent knowledge drifts daily | 🟡 Medium |
| Manual triggers | Every step requires human | 🟡 Medium |
| FA availability | Recommended players already signed | 🟡 Medium (mitigated by Media sweeps) |
| Context limits | Long sessions hit window limits | 🟡 Medium (1M fallback exists) |

### What Scales

| Component | Scalability | Notes |
|-----------|-------------|-------|
| Agent architecture | ✅ 32 teams ready | All team agents exist with rosters |
| Specialist pool | ✅ Good | Domain experts serve all teams |
| Data sources | ✅ Good | OTC/Spotrac/ESPN are league-wide |
| Article template | ✅ Validated | Same SKILL.md works for any team |
| Editorial process | ⚠️ Bottleneck | Editor is single-threaded |

---

## 2. Phase 2 Automation Goals

From VISION.md, Phase 2 targets (Post-Draft → Training Camp):

| Goal | Success Metric | Priority |
|------|---------------|----------|
| **Daily cron-triggered Media sweeps** | Zero manual trigger for news gathering | P0 |
| **Auto-draft articles on significant news** | Article draft within 1 hour of breaking news | P1 |
| **Auto-review via Editor** | Fact-check pipeline runs without human trigger | P0 |
| **Human approval queue** | All pending articles visible in one view | P0 |
| **One-click publish to Substack** | Publish button → live on Substack | P1 |
| **One human hour per week** | 4-5 articles approved + published in 60 minutes | Target |

### What "Significant News" Means

Not every transaction triggers an article. Significance criteria:

| News Type | Auto-Draft? | Rationale |
|-----------|-------------|-----------|
| Seahawks sign/extend starter | ✅ Yes | Core roster change |
| Seahawks trade involving picks | ✅ Yes | Capital + roster impact |
| Key Seahawks player injury (IR) | ✅ Yes | Roster hole analysis |
| Division rival major signing | 🟡 Maybe | Depends on SEA impact |
| Rumor about SEA FA target | ❌ No | Wait for confirmation |
| League-wide rule change | 🟡 Maybe | If cap/roster impact |
| Routine depth signing | ❌ No | Not article-worthy |

Significance scoring (proposed):
- **+3:** Seahawks starter involved
- **+2:** Contract value > $10M AAV or draft pick top-60
- **+2:** Division rival (ARI, LAR, SF) involved
- **+1:** Position of need (currently: EDGE, RB, CB)
- **Threshold:** Score ≥ 4 triggers auto-draft

---

## 3. Architecture Proposal

### 3.1 State Machine — Article Lifecycle

```
                                    ┌──────────────────┐
                                    │    ARCHIVED      │
                                    │  (not published) │
                                    └────────▲─────────┘
                                             │ reject
┌────────────┐    ┌────────────┐    ┌────────┴────────┐    ┌────────────┐    ┌────────────┐
│  PROPOSED  │───▶│  DRAFTING  │───▶│    REVIEWING    │───▶│  APPROVED  │───▶│  PUBLISHED │
│            │    │            │    │                 │    │            │    │            │
└────────────┘    └────────────┘    └─────────────────┘    └────────────┘    └────────────┘
                        │                    │                    │
                        │                    │                    │
                        ▼                    ▼                    ▼
                   Writer +            Editor runs           Human clicks
                   Experts             fact-check            "Approve"
                   spawn               auto                  in dashboard
```

**States:**

| State | Description | Transitions |
|-------|-------------|-------------|
| `PROPOSED` | Significant news detected; article queued | → `DRAFTING` (auto, when queue slot available) |
| `DRAFTING` | Writer + experts generating content | → `REVIEWING` (auto, on completion) |
| `REVIEWING` | Editor fact-checking | → `APPROVED` (if ✅), → `DRAFTING` (if 🟡 revise), → `ARCHIVED` (if 🔴 reject) |
| `APPROVED` | Human-approved, ready to publish | → `PUBLISHED` (human click) |
| `PUBLISHED` | Live on Substack | Terminal state |
| `ARCHIVED` | Rejected or superseded | Terminal state |

**Data per article:**

```json
{
  "id": "sea-witherspoon-extension-2026-03-14",
  "team": "SEA",
  "topic": "Witherspoon contract extension analysis",
  "state": "REVIEWING",
  "created_at": "2026-03-14T10:30:00Z",
  "updated_at": "2026-03-14T11:45:00Z",
  "trigger": {
    "type": "news",
    "news_id": "media-sweep-2026-03-14-witherspoon-signed"
  },
  "draft_path": "content/articles/witherspoon-extension-cap-vs-agent.md",
  "editor_report_path": "content/reviews/witherspoon-extension-review.md",
  "editor_verdict": "APPROVED",
  "errors_fixed": 6,
  "cost_usd": 2.45,
  "publish_url": null
}
```

### 3.2 Job Queue Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           JOB QUEUE (Bull/BullMQ)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │  media-sweep    │  │  article-draft  │  │  article-review │        │
│  │  (cron: daily)  │  │  (event-driven) │  │  (event-driven) │        │
│  │  priority: low  │  │  priority: med  │  │  priority: high │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐                              │
│  │  article-publish│  │  knowledge-sync │                              │
│  │  (manual trigger)│  │  (weekly cron)  │                              │
│  │  priority: high │  │  priority: low  │                              │
│  └─────────────────┘  └─────────────────┘                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Queue Configuration:**

| Queue | Trigger | Concurrency | Timeout | Retry |
|-------|---------|-------------|---------|-------|
| `media-sweep` | Cron (6am PT daily) | 1 | 10 min | 3x |
| `article-draft` | Event (significant news) | 2 | 30 min | 2x |
| `article-review` | Event (draft complete) | 1 | 15 min | 2x |
| `article-publish` | Manual (dashboard click) | 1 | 2 min | 3x |
| `knowledge-sync` | Cron (Sunday 3am PT) | 1 | 60 min | 1x |

**Priority Rules:**
- Breaking news (confirmed trade/signing): `priority: 1` (highest)
- Scheduled content (editorial calendar): `priority: 5` (normal)
- Routine sweeps: `priority: 10` (background)

### 3.3 Integrations

#### GitHub Actions (Cron + Webhooks)

```yaml
# .github/workflows/media-sweep.yml
name: Daily Media Sweep
on:
  schedule:
    - cron: '0 13 * * *'  # 6am PT (13:00 UTC)
  workflow_dispatch:       # Manual trigger option

jobs:
  sweep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Media Sweep
        run: node scripts/media-sweep.js
      - name: Commit updates
        run: |
          git config user.name "NFL Bot"
          git config user.email "bot@seahawksbotblog.com"
          git add .squad/agents/media/history.md
          git commit -m "Daily media sweep $(date +%Y-%m-%d)" || echo "No changes"
          git push
```

```yaml
# .github/workflows/article-pipeline.yml
name: Article Pipeline
on:
  push:
    paths:
      - '.squad/agents/media/history.md'
  workflow_dispatch:
    inputs:
      article_topic:
        description: 'Force article on topic'
        required: false

jobs:
  check-significance:
    runs-on: ubuntu-latest
    outputs:
      should_draft: ${{ steps.check.outputs.should_draft }}
      topic: ${{ steps.check.outputs.topic }}
    steps:
      - uses: actions/checkout@v4
      - id: check
        run: node scripts/check-significance.js
        
  draft-article:
    needs: check-significance
    if: needs.check-significance.outputs.should_draft == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Draft Article
        run: node scripts/draft-article.js "${{ needs.check-significance.outputs.topic }}"
```

#### Agent Framework API

Agents are invoked via the existing Copilot CLI infrastructure:

```javascript
// scripts/spawn-agent.js
async function spawnAgent(agentName, prompt, options = {}) {
  const result = await copilotCli.task({
    agent_type: 'general-purpose',
    prompt: `
      You are ${agentName}. Read your charter at .squad/agents/${agentName}/charter.md
      and your history at .squad/agents/${agentName}/history.md.
      
      ${prompt}
    `,
    model: options.model || 'claude-opus-4.6',
    mode: 'sync'
  });
  
  return result;
}

// Parallel expert spawns
async function gatherExpertAnalysis(topic, experts) {
  const spawns = experts.map(expert => 
    spawnAgent(expert.name, expert.prompt)
  );
  return Promise.all(spawns);
}
```

#### Substack API

```javascript
// scripts/publish-to-substack.js
const SubstackAPI = require('substack-api'); // hypothetical

async function publishArticle(articlePath) {
  const markdown = fs.readFileSync(articlePath, 'utf8');
  const { title, subtitle, body } = parseArticle(markdown);
  
  const api = new SubstackAPI({
    email: process.env.SUBSTACK_EMAIL,
    password: process.env.SUBSTACK_PASSWORD,
    publication: 'seahawksbotblog'
  });
  
  const post = await api.createPost({
    title,
    subtitle,
    body: markdownToHtml(body),
    publish: true,
    audience: 'everyone' // or 'subscribers'
  });
  
  return post.url;
}
```

**Note:** Substack doesn't have a public API. Options:
1. **Puppeteer automation** — browser automation to post
2. **Email-to-post** — Substack supports posting via email
3. **Manual copy-paste** — dashboard shows formatted HTML, human pastes

**Recommendation:** Start with email-to-post (simplest), upgrade to Puppeteer if needed.

### 3.4 Data Model

**Option A: Git-based (Recommended for MVP)**

```
content/
├── articles/
│   ├── witherspoon-extension-cap-vs-agent.md  # Published
│   └── seahawks-rb1a-target-board.md          # Published
├── drafts/
│   └── seahawks-oline-analysis.md             # State: DRAFTING
├── reviews/
│   └── seahawks-oline-analysis-review.md      # Editor report
├── queue/
│   └── pipeline-state.json                    # All article states
└── proposals/
    └── phase2-automation-proposal.md          # This document
```

**pipeline-state.json:**
```json
{
  "articles": [
    {
      "id": "sea-oline-2026-03-15",
      "state": "REVIEWING",
      "draft_path": "content/drafts/seahawks-oline-analysis.md",
      "created_at": "2026-03-15T10:00:00Z"
    }
  ],
  "last_media_sweep": "2026-03-15T13:00:00Z",
  "pending_approval_count": 2
}
```

**Pros:**
- Version controlled (full audit trail)
- Works with GitHub Actions natively
- No database setup
- Human-readable state

**Cons:**
- Concurrent writes need locking (GitHub doesn't handle well)
- Query performance poor at scale
- No transactional guarantees

**Option B: SQLite (Recommended for Scale)**

```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  topic TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('proposed', 'drafting', 'reviewing', 'approved', 'published', 'archived')),
  draft_path TEXT,
  review_path TEXT,
  publish_url TEXT,
  cost_usd REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE article_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT REFERENCES articles(id),
  event_type TEXT NOT NULL,
  event_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE media_sweeps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sweep_date DATE NOT NULL,
  transactions_found INTEGER,
  articles_triggered INTEGER,
  completed_at TIMESTAMP
);
```

**Recommendation:** Start with Git-based for MVP (simpler), migrate to SQLite before 32-team scale.

### 3.5 Error Handling

| Failure Type | Detection | Recovery | Alert |
|--------------|-----------|----------|-------|
| **Network timeout** | HTTP timeout > 30s | Retry with exponential backoff (3x) | Log only |
| **Model timeout** | Agent spawn > 10 min | Retry once, then queue for manual | Slack/Discord |
| **Partial draft** | Draft < 500 words | Re-spawn Writer with more explicit prompt | Log |
| **Editor rejection** | Verdict = 🔴 REJECT | Archive article, notify human | Dashboard flag |
| **Substack publish fail** | API error | Queue for retry, human fallback | High-priority alert |
| **Pipeline crash** | Process exit | Restart from last checkpoint (state machine) | Auto-restart + alert |

**State Recovery:**

```javascript
// On startup, recover incomplete jobs
async function recoverPipeline() {
  const state = JSON.parse(fs.readFileSync('content/queue/pipeline-state.json'));
  
  for (const article of state.articles) {
    switch (article.state) {
      case 'drafting':
        // Check if draft exists and is valid
        if (!fs.existsSync(article.draft_path) || isDraftIncomplete(article.draft_path)) {
          queue.add('article-draft', { articleId: article.id, retry: true });
        } else {
          // Draft complete, move to review
          queue.add('article-review', { articleId: article.id });
        }
        break;
      case 'reviewing':
        // Re-run editor (idempotent)
        queue.add('article-review', { articleId: article.id });
        break;
      // approved and published are stable states
    }
  }
}
```

---

## 4. Implementation Scope (Phase 2 MVP)

### In Scope

| Component | Description | Priority |
|-----------|-------------|----------|
| **Daily Media Sweep** | Cron-triggered, commits to git | P0 |
| **Significance Scoring** | Rules engine for auto-draft triggers | P0 |
| **Article Draft Pipeline** | Writer + experts spawn, parallel execution | P0 |
| **Editor Auto-Review** | Fact-check runs automatically post-draft | P0 |
| **Approval Dashboard** | Simple HTML page showing pending articles | P1 |
| **One-Click Approve** | Button to move article to APPROVED | P1 |
| **Substack Publish** | Email-to-post or Puppeteer automation | P2 |
| **Cost Tracking** | Log API costs per article | P1 |
| **Error Recovery** | State machine with checkpointing | P1 |

### Out of Scope (Phase 3+)

| Component | Reason | Phase |
|-----------|--------|-------|
| **Multi-team scaling** | Architecture supports it, but defer execution | Phase 3 |
| **Advanced dashboard** | React app with filters, charts, etc. | Phase 3 |
| **Cost optimization ML** | Model selection based on topic complexity | Phase 4 |
| **Reader analytics** | Substack engagement tracking | Phase 4 |
| **A/B headline testing** | Test multiple headlines per article | Phase 4 |
| **Scheduled publishing** | Queue articles for optimal post times | Phase 3 |
| **Multi-publication** | Beyond Substack (Twitter threads, etc.) | Phase 4 |

### Explicit Constraints

- **Single team (Seahawks)** — don't build 32-team infrastructure yet
- **Single publication** — Seahawks Bot Blog only
- **No subscriber management** — Substack handles this
- **No payment processing** — Substack handles this
- **No custom domain** — use seahawksbotblog.substack.com

---

## 5. Tech Stack Recommendations

### Workflow Engine

**Recommendation: Node.js + BullMQ**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **BullMQ** | Redis-backed, mature, good DX, job scheduling built-in | Requires Redis | ✅ Recommended |
| **Agenda** | MongoDB-backed, simpler | Less mature than Bull | Consider if using MongoDB |
| **GitHub Actions only** | No additional infra | Limited job control, no priority, no retry control | ❌ Too limited |
| **Python + Celery** | Very mature | Different language from agent spawning | ❌ Language mismatch |

**Why BullMQ:**
- Native cron support (`queue.add({ repeat: { cron: '0 13 * * *' } })`)
- Priority queues out of the box
- Redis is lightweight for MVP scale
- Excellent failure/retry handling
- Dashboard (Bull Board) available

### Persistence

**Recommendation: Git-based for MVP, SQLite for growth**

| Option | MVP | 32-Team | Notes |
|--------|-----|---------|-------|
| **Git files** | ✅ Great | ❌ Poor | Audit trail built-in, no setup |
| **SQLite** | ✅ Good | ✅ Good | Single file, no server, queries fast |
| **PostgreSQL** | ⚠️ Overkill | ✅ Great | Defer until team scaling |

**Migration Path:**
1. **MVP:** JSON files in `content/queue/` committed to git
2. **Growth:** SQLite in `data/pipeline.db` (not committed)
3. **Scale:** PostgreSQL for multi-user, multi-instance

### Scheduling

**Recommendation: Hybrid (GitHub Actions + BullMQ)**

| Task | Scheduler | Rationale |
|------|-----------|-----------|
| **Daily Media Sweep** | GitHub Actions cron | Free, reliable, auditable |
| **Article Draft** | BullMQ event | Needs priority, retry, concurrency control |
| **Editor Review** | BullMQ event | Needs to chain from draft completion |
| **Publish** | Manual trigger → BullMQ | Human approval required first |
| **Weekly Knowledge Sync** | GitHub Actions cron | Low-priority background task |

### Dashboard

**Recommendation: Simple Express + HTML for MVP**

```
dashboard/
├── server.js          # Express server
├── views/
│   ├── queue.ejs      # Approval queue view
│   ├── article.ejs    # Single article detail
│   └── layout.ejs     # Shared layout
├── public/
│   └── style.css      # Basic styling
└── api/
    ├── approve.js     # POST /api/approve/:id
    └── publish.js     # POST /api/publish/:id
```

**Why not React:**
- MVP doesn't need SPA complexity
- Server-rendered HTML is simpler to deploy
- Can upgrade to React in Phase 3 if needed

**Dashboard Features (MVP):**
- List of articles in each state
- Click to view draft
- "Approve" button (moves to APPROVED)
- "Publish" button (triggers Substack post)
- Cost per article display
- Error log view

---

## 6. Risk Assessment & Mitigation

### API Costs

**Risk:** Premium models (Opus) are expensive. Uncontrolled costs could make the project unsustainable.

| Component | Model | Est. Cost per Call | Calls per Article | Cost per Article |
|-----------|-------|-------------------|-------------------|------------------|
| Expert spawn (×4) | Opus | $0.50 | 4 | $2.00 |
| Writer | Opus | $0.60 | 1 | $0.60 |
| Editor | Opus | $0.40 | 1-2 | $0.60 |
| **Total** | | | | **$3.20** |

**Mitigation:**
1. **Track costs per article** — log in pipeline-state.json
2. **Use cheaper models for drafts** — Sonnet for initial expert analysis, Opus only for Writer/Editor
3. **Batch expert calls** — combine 2-3 experts into single prompt where possible
4. **Set daily spend cap** — pause pipeline if > $20/day

**Tiered Model Strategy:**

| Task | Current Model | Cost-Optimized Model | Quality Impact |
|------|--------------|---------------------|----------------|
| Expert analysis | Opus | Sonnet | 🟡 Moderate (opinions less nuanced) |
| Writer draft | Opus | Opus | ❌ Don't downgrade (voice quality critical) |
| Editor fact-check | Opus | Opus | ❌ Don't downgrade (accuracy critical) |
| Media sweep | Opus | Haiku | ✅ Safe (just data extraction) |

### Knowledge Staleness

**Risk:** Agent knowledge drifts. Today's roster data becomes stale within days.

**Mitigation:**
1. **Daily Media sweeps** — transactions update agent histories
2. **Weekly knowledge sync** — full roster refresh for SEA agent
3. **Timestamp all facts** — agent histories include `[2026-03-14]` dates
4. **Editor catches staleness** — fact-check verifies current rosters

### Hallucination

**Risk:** AI generates plausible but false information. One bad error kills credibility.

**Mitigation:**
1. **Editor gates everything** — mandatory fact-check before approve
2. **Human approval required** — no auto-publish
3. **Confidence flagging** — Editor can flag "low confidence" claims for human review
4. **Source citations** — all data claims include source (OTC, Spotrac, ESPN)

**Proposed Confidence Score:**

```markdown
## Editor Review

### Fact-Check Results
| Claim | Source | Verified | Confidence |
|-------|--------|----------|------------|
| Witherspoon cap hit $27M | OTC | ✅ | 🟢 High |
| 49ers have $16.1M cap space | OTC | ✅ | 🟢 High |
| Seahawks "have interest" in Bosa | Media sweep | ⚠️ | 🟡 Medium (rumor) |
| Millionaire tax effective 2028 | SB 6346 | ✅ | 🟢 High |

**Overall Confidence:** 🟢 High (3/4 claims verified, 1 rumor flagged)
```

### Scale (32 Teams)

**Risk:** Architecture designed for Seahawks doesn't scale to 32 teams.

**Assessment:**

| Component | Seahawks-Only | 32-Team Scale | Bottleneck? |
|-----------|---------------|---------------|-------------|
| Media sweep | 1 sweep/day | 1 sweep/day (same) | ✅ No change |
| Expert spawns | 4 agents/article | 4 agents/article | ⚠️ Cost (32x articles) |
| Editor | 1 review/article | 1 review/article | 🔴 Single-threaded |
| Dashboard | 5 pending | 160 pending | 🔴 UX overload |
| Git state | 10 files | 320 files | 🟡 Performance |

**32-Team Mitigations (Phase 3):**
1. **Parallel Editor instances** — spawn multiple Editors with different "beats"
2. **Team-grouped approval** — dashboard shows by team, not flat list
3. **SQLite migration** — replace git state with database
4. **Prioritization** — not all 32 teams publish daily; tier by subscriber count

### Failure Recovery

**Risk:** System crashes mid-pipeline. Articles stuck in invalid states.

**Mitigation:**
1. **Idempotent operations** — re-running draft/review is safe
2. **State checkpointing** — every state change persists to disk immediately
3. **Recovery on startup** — scan for incomplete articles, resume
4. **Manual override** — dashboard allows "retry" or "archive" for stuck articles

**Recovery Matrix:**

| Failure Point | State Stuck In | Recovery Action |
|---------------|---------------|-----------------|
| Crash during draft | `DRAFTING` | Re-spawn Writer (draft file partial or missing) |
| Crash during review | `REVIEWING` | Re-run Editor (idempotent) |
| Crash during publish | `APPROVED` | Check Substack, retry publish |
| Network error (OTC) | `DRAFTING` | Retry with backoff |
| Model timeout | `DRAFTING` | Retry once, then manual |

---

## 7. Timeline & Milestones

### Milestone 1: Queue System + Cron Triggers

**Deliverables:**
- [ ] BullMQ setup with Redis
- [ ] GitHub Actions cron for daily Media sweep
- [ ] Media sweep commits updates to agent history
- [ ] Significance scoring rules engine
- [ ] `pipeline-state.json` state management
- [ ] Basic logging + cost tracking

**Success Criteria:** Media sweep runs daily at 6am PT without human trigger. Significant news events are logged.

### Milestone 2: Approval Dashboard

**Deliverables:**
- [ ] Express server + EJS templates
- [ ] Queue view (list all articles by state)
- [ ] Article detail view (read draft, see Editor report)
- [ ] "Approve" button (state → APPROVED)
- [ ] "Archive" button (state → ARCHIVED)
- [ ] Error log view

**Success Criteria:** Human can view all pending articles and approve/reject in dashboard.

### Milestone 3: End-to-End Test

**Deliverables:**
- [ ] Full pipeline: Media → significance check → draft → review → approve → (mock) publish
- [ ] Test with real Seahawks news event
- [ ] Verify Editor catches intentional errors
- [ ] Cost tracking accurate
- [ ] Recovery from simulated crash

**Success Criteria:** One article flows from news detection to "ready to publish" with zero human intervention until approval.

### Milestone 4: Seahawks Launch

**Deliverables:**
- [ ] Substack email-to-post integration (or Puppeteer)
- [ ] "Publish" button live
- [ ] First automated article published to real Substack
- [ ] Monitor for 1 week: 3-5 articles through pipeline
- [ ] Measure: time to approve, cost per article, error rate

**Success Criteria:** Seahawks Bot Blog receives its first automated article. Human time < 1 hour/week.

---

## 8. Open Questions for the User

### Tech Stack Decisions

1. **Workflow engine preference?**
   - Option A: Node.js + BullMQ (recommended)
   - Option B: Python + Celery
   - Option C: GitHub Actions only (simpler but limited)

2. **Persistence preference?**
   - Option A: Git-based JSON files (simpler, audit trail)
   - Option B: SQLite from the start (better for queries)
   - Recommendation: Start Git, migrate to SQLite before 32-team

3. **Dashboard preference?**
   - Option A: Simple Express + HTML (recommended for MVP)
   - Option B: React SPA (more work, better UX)
   - Option C: CLI-only (no web dashboard)

### Cost Strategy

4. **How aggressive on cost optimization?**
   - Option A: Opus for everything (highest quality, ~$3.20/article)
   - Option B: Sonnet for experts, Opus for Writer/Editor (~$2.00/article)
   - Option C: Aggressive optimization, Haiku where possible (~$1.00/article)
   - Recommendation: Option B (quality where it matters)

5. **Daily spend cap?**
   - Proposed: $20/day for Seahawks-only
   - What's your comfort level?

### Publishing

6. **Substack integration approach?**
   - Option A: Email-to-post (simplest, manual formatting)
   - Option B: Puppeteer automation (fully automated, more complex)
   - Option C: Manual copy-paste from dashboard (fallback)

7. **When do you want first automated article live?**
   - This determines urgency of Milestones 3-4
   - Before draft (April 23)? During draft? Post-draft?

### Scope Confirmation

8. **Confirm Seahawks-only for Phase 2?**
   - Recommendation: Yes, don't attempt 32-team until pipeline proven
   - Any desire to pilot a second team early?

9. **Confirm no Substack subscriber features?**
   - Free vs. paid tier management
   - Comment moderation
   - Email campaigns
   - Recommendation: All out of scope for Phase 2

---

## Appendix A: Directory Structure (Proposed)

```
nfl-eval/
├── .github/
│   └── workflows/
│       ├── media-sweep.yml          # Daily cron
│       └── article-pipeline.yml     # Event-driven
├── .squad/                          # Agent infrastructure (existing)
│   ├── agents/
│   ├── decisions/
│   └── skills/
├── content/
│   ├── articles/                    # Published articles
│   ├── drafts/                      # In-progress drafts
│   ├── reviews/                     # Editor reports
│   ├── queue/
│   │   └── pipeline-state.json      # State machine
│   └── proposals/
│       └── phase2-automation-proposal.md
├── dashboard/
│   ├── server.js
│   ├── views/
│   └── public/
├── scripts/
│   ├── media-sweep.js
│   ├── check-significance.js
│   ├── draft-article.js
│   ├── review-article.js
│   ├── publish-article.js
│   └── spawn-agent.js
├── data/
│   └── pipeline.db                  # SQLite (Phase 2.5+)
└── VISION.md
```

---

## Appendix B: Significance Scoring Examples

```javascript
// scripts/check-significance.js

const SIGNIFICANCE_RULES = {
  // Team involvement
  seahawks_involved: 3,
  division_rival_involved: 2,  // ARI, LAR, SF
  
  // Transaction type
  starter_transaction: 3,
  draft_pick_top_60: 2,
  contract_over_10m_aav: 2,
  
  // Position relevance
  position_of_need: 1,  // EDGE, RB, CB for SEA
  
  // News confidence
  confirmed_not_rumor: 1,
  
  // Threshold
  DRAFT_THRESHOLD: 4
};

function scoreNewsItem(item) {
  let score = 0;
  
  if (item.teams.includes('SEA')) score += SIGNIFICANCE_RULES.seahawks_involved;
  if (item.teams.some(t => ['ARI', 'LAR', 'SF'].includes(t))) {
    score += SIGNIFICANCE_RULES.division_rival_involved;
  }
  if (item.player_role === 'starter') score += SIGNIFICANCE_RULES.starter_transaction;
  if (item.contract_aav >= 10_000_000) score += SIGNIFICANCE_RULES.contract_over_10m_aav;
  if (['EDGE', 'RB', 'CB'].includes(item.position)) score += SIGNIFICANCE_RULES.position_of_need;
  if (item.confidence === 'CONFIRMED') score += SIGNIFICANCE_RULES.confirmed_not_rumor;
  
  return {
    score,
    should_draft: score >= SIGNIFICANCE_RULES.DRAFT_THRESHOLD,
    reasoning: `Score ${score}: ${item.summary}`
  };
}
```

---

## Appendix C: Cost Tracking Schema

```javascript
// Logged per article in pipeline-state.json
{
  "cost_breakdown": {
    "expert_spawns": [
      { "agent": "SEA", "model": "opus", "tokens_in": 4200, "tokens_out": 1800, "cost_usd": 0.48 },
      { "agent": "Cap", "model": "opus", "tokens_in": 3800, "tokens_out": 2100, "cost_usd": 0.52 },
      { "agent": "PlayerRep", "model": "opus", "tokens_in": 3500, "tokens_out": 1900, "cost_usd": 0.45 },
      { "agent": "Injury", "model": "opus", "tokens_in": 2800, "tokens_out": 1200, "cost_usd": 0.32 }
    ],
    "writer": { "model": "opus", "tokens_in": 12000, "tokens_out": 4500, "cost_usd": 0.68 },
    "editor": { "model": "opus", "tokens_in": 8000, "tokens_out": 2200, "cost_usd": 0.42 },
    "total_cost_usd": 2.87
  }
}
```

---

*This proposal provides the technical north star for Backend, Frontend, and Tester to implement Phase 2 automation. All decisions are preliminary and subject to user input on the open questions.*

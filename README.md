# NFL Content Intelligence Platform

> 47 AI agents analyze the NFL so you don't have to read 200 beat reporters. They argue with each other, and the best analysis wins.

**Status:** Prototype proven — 2 published articles, 32 teams loaded, full editorial pipeline operational.
**Focus:** 2026 NFL Offseason (Seahawks-first, expanding to all 32 teams).

---

## What's Here

This repo is an AI-powered NFL analysis engine. It's not a codebase in the traditional sense — there's no application code. It's **pure agent orchestration**: 47 specialized agents coordinated through markdown files, persistent memory, and structured prompts.

**The agent roster:**

| Category | Count | What They Do |
|----------|-------|-------------|
| **Team Agents** | 32 | One per NFL team. Deep roster, cap, coaching, draft needs, and divisional rival knowledge. |
| **Lead** | 1 | GM-level analyst. Runs evaluations, synthesizes cross-agent input, makes final calls. |
| **Cap** | 1 | Salary cap expert. Contract structures, dead money, cap projections. |
| **Draft** | 1 | Draft class evaluator. Board rankings, scheme fits, trade-up/down scenarios. |
| **Offense / Defense / SpecialTeams** | 3 | Scheme specialists. Evaluate players through their respective lenses. |
| **Injury** | 1 | Injury history, recovery timelines, durability risk flags. |
| **Media** | 1 | Tracks free agency, trades, and rumors daily. Distributes news to affected team agents. |
| **Analytics** | 1 | Advanced metrics. EPA, DVOA, PFF grades, win probability models. |
| **CollegeScout** | 1 | Evaluates college prospects. Combine data, film traits, NFL translation profiles. |
| **PlayerRep** | 1 | CBA expert and player advocate. Contract comparables, market value, agent perspective. |
| **Writer** | 1 | Turns expert analysis into publication-ready Substack articles. |
| **Editor** | 1 | Fact-checks every article. Catches errors before they reach readers. |
| **Scribe** | 1 | Session logger. Records decisions, knowledge updates, and agent interactions. |
| **Ralph** | 1 | Work monitor. Tracks what's in progress across agents. |

**What they've produced so far:**
- 2 published long-form articles (~3,500 words each) on the NFL Lab
- An editorial calendar mapped through the 2026 NFL season
- 19+ article ideas in the pipeline
- ~20,000+ lines of accumulated NFL intelligence across agent history files
- 6 reusable skills (OTC data pulls, Spotrac lookups, roster research, knowledge recording, project conventions, Substack article formatting)

---

## How to Use It

This is an interactive system. You talk to the agents through GitHub Copilot CLI.

### Setup
1. Open the repo in **VS Code**
2. Make sure **GitHub Copilot CLI** is installed with the `squad` agent extension
3. Open the Copilot chat panel

### Local MCP Server

This repo also ships a local MCP server for non-Copilot clients.

```bash
npm run mcp:server
```

Client-specific config details for Codex, Codex Desktop, Claude Code, OpenCode, and GitHub Copilot live in [`docs/mcp-server.md`](./docs/mcp-server.md).

### Publishing Setup (one-time)

To enable automated Substack publishing:

1. Log in to Substack in Chrome
2. Open DevTools → Application → Cookies → `https://substack.com`
3. Copy the values of `substack.sid` and `connect.sid`
4. Generate your token:
   ```
   node -e "console.log(Buffer.from(JSON.stringify({ substack_sid: 'YOUR_SID', connect_sid: 'YOUR_CONNECT_SID' })).toString('base64'))"
   ```
5. Create a `.env` file from `.env.example` and fill in `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL`

Once configured, agents can use `publish_to_substack` when a draft push is needed, while the default article flow now pauses at dashboard-ready Stage 7 before any Substack publish step.

### Talking to Agents

Address any agent by name in the chat. Examples:

```
"Media, run today's free agency sweep."
"Cap, break down Kansas City's cap situation for 2026."
"SEA, what are the Seahawks' biggest roster needs heading into the draft?"
"CollegeScout, evaluate the top 5 edge rushers in this class."
"Lead, run a full evaluation of the Cowboys' offseason moves."
```

You can also kick off the full article pipeline:

```
"Team, let's write an article on the Seahawks running back situation."
```

This triggers the expert panel → preflight verification → Writer → Editor → human review flow (see below).

---

## The Pipeline

Every article follows the same path. No shortcuts.

```
1. EXPERT ANALYSIS
   Multiple agents weigh in on the topic. They pull data, run evaluations,
   and — critically — disagree with each other when the data supports it.
   (Cap says $27M. PlayerRep says $33M. Both are right. That's the article.)

2. PREFLIGHT VERIFICATION
   A lightweight fact-check of panel outputs flags high-risk claims:
   contradictions, missing sources, unsafe details. Writer gets a summary
   (panel-factcheck.md) to craft around known issues. Editor does full
   fact-check later.

3. WRITER
   Takes the raw expert output and crafts it into a Substack article.
   Voice: data-driven, opinionated, readable. Ringer meets OverTheCap.

4. EDITOR
   Fact-checks everything. Player names, contract figures, draft positions,
   statistical claims. Catches errors before they embarrass anyone.
   (Editor caught 6 factual errors in one article. The system works.)

4. DASHBOARD REVIEW
   Joe reviews the final article in the local dashboard, using preview and validation
   before the live publish step.

5. LIVE PUBLISH + PROMOTION
   The dashboard publish action sends the article live to the NFL Lab (Substack)
   and can dispatch the default Substack Note in the same step.
```

The expert disagreement isn't a bug — it's the product. When Cap and PlayerRep argue about Devon Witherspoon's extension value, readers get two expert perspectives backed by real data. That's what makes this different from a single columnist's opinion.

---

## Data Sources

All agent knowledge comes from public sources:

| Source | What It Provides |
|--------|-----------------|
| [OverTheCap](https://overthecap.com) | Salary cap data, contract details, cap projections |
| [Spotrac](https://spotrac.com) | Contract breakdowns, free agent trackers, market value estimates |
| [ESPN](https://espn.com) | News, transactions, depth charts, game coverage |
| [NFL.com](https://nfl.com) | Official transactions, combine results, draft data |
| [Pro Football Reference](https://pro-football-reference.com) | Historical stats, player comparisons, advanced metrics |

---

## What's Next

> **TODO — Joe will fill this in as capabilities come online.**

Planned but not yet built:

- [ ] **Image creation** — Article header images, player graphics, data visualizations
- [x] **Automated publishing** — Dashboard review can publish live to Substack and trigger the default promotion Note; shared Substack tooling still supports draft create/update where needed
- [x] **MCP servers / extensions** — `publish_to_substack` plus the dashboard publish flow handle Substack draft/live publishing with tag-based routing
- [x] **32-team sections** — All NFL teams have dedicated Substack sections with official brand colors on both `nfllab` and `nfllabstage`
- [ ] **New agent roles** — Growth/Distribution agent (audience strategy, SEO, social), Graphic Designer agent
- [ ] **Automated pipeline** — Cron-triggered Media sweeps → auto-draft → Editor review → publish queue
- [ ] **Multi-team activation** — Sections created for all 32 teams; content pipeline currently Seahawks-focused
- [ ] **Cost tracking** — API spend per article, unit economics at 32-team scale

---

## Repo Structure

```
nfl-eval/
├── .squad/              # Agent system: charters, history, decisions, skills
│   ├── agents/          # 47 agent directories (charter.md + history.md each)
│   ├── skills/          # 6 reusable workflows (OTC, Spotrac, roster research, etc.)
│   ├── decisions/       # Logged decisions and rationale
│   └── team.md          # Full agent roster and project context
├── content/
│   ├── articles/        # Published and in-progress articles
│   ├── pipeline.db      # SQLite pipeline state (source of truth for stages)
│   ├── article-ideas.md # Editorial calendar and idea pipeline
│   └── proposals/       # Article proposals awaiting approval
├── dashboard/           # Local pipeline dashboard (read-only)
│   ├── server.mjs       # HTTP server — `npm run dashboard` to start
│   ├── data.mjs         # Read model (pipeline.db + article artifact scanning)
│   ├── render.mjs       # Canonical ProseMirror preview (uses shared/substack-prosemirror.mjs)
│   ├── templates.mjs    # Server-rendered HTML pages
│   └── public/          # Static assets (CSS)
├── VISION.md            # Internal strategy doc (not for public sharing)
└── README.md            # You are here
```

---

## Dashboard

A local pipeline dashboard for the article workflow. It shows every article's stage, artifacts, drift status, editor verdicts, a canonical publisher-aligned preview, and the live publish / Notes action from the article detail page.

```bash
npm run dashboard          # start at http://localhost:3456
npm run dashboard:dev      # start with --watch (auto-reload on file changes)
npm run dashboard -- --port 8080       # custom port (cross-platform)
$env:DASHBOARD_PORT=8080; npm run dashboard  # custom port from PowerShell
DASHBOARD_PORT=8080 npm run dashboard        # custom port from bash/zsh
```

If `3456` is already in use, the dashboard now prints the existing URL and alternate-port commands instead of crashing with a raw stack trace.

**Pages / actions:**
- **Board** (`/`) — All articles with stage, status, drift, and next-action columns. Filter by text, stage, or status.
- **Article detail** (`/article/:slug`) — Left-rail summary + tabs: Overview, Prompt & Panel, Draft & Edits, Assets, Preview, Publish/Notes, Timeline.
- **Preview** (`/preview/:slug`) — Renders `draft.md` through the canonical ProseMirror pipeline (subscribe buttons, hero-image safety, dense-table warnings).
- **Live publish** (`POST /api/publish/:slug`) — Creates or refreshes the production draft, publishes it live, and optionally posts the default Substack Note from the dashboard article page.
- **API** (`/api/board`, `/api/article/:slug`, `/api/publish/:slug`) — JSON endpoints for tooling.

**Requirements:** Node 22+ (uses `node:sqlite`). Zero external dependencies.

**Validation notes:** The dashboard includes optional browser/mobile validation hooks. Important details:

- Validation requires `SUBSTACK_TOKEN` in `.env` (see 'Publishing Setup' above) to authenticate Playwright sessions.
- Dashboard-triggered validation is stage-only: it will refuse to run against production draft URLs. Use the Stage publication URLs (`*.nfllabstage.substack.com`).
- Validation runs in a background child process and calls the existing Playwright CLI scripts; original validation scripts are not modified.
- Validation artifacts (screenshots) are stored under `content/images/stage-validation-screenshots/{slug}/` and results are persisted to `dashboard/validation-results.json`.
- Trigger validation manually from the article page Validation tab or via POST `/api/validate/editor/{slug}` and `/api/validate/mobile/{slug}`; poll `/api/validation/{slug}` for status updates.
- Live publish results are persisted to `dashboard/publish-results.json`, and publish screenshots are stored under `content/images/publish-artifacts/{slug}/`.


# Building a Multi-Agent App: From Prompt Engineering to Production Platform

*A practitioner's guide to what actually happens when you try to make AI agents work together — and the lessons that apply to any domain, not just NFL content.*

---

## The Short Version

I built an AI-powered NFL content platform where 47 specialized agents argue with each other to produce expert-grade football analysis. It started as copy-pasting prompts into ChatGPT. It's now a 24,000-line TypeScript platform with a deterministic pipeline, multi-provider LLM routing, tool calling, fact-checking, and full observability.

Every stage of that evolution taught me something that I wish someone had written down before I started. This is that document.

---

## Phase 0: The Prompt (Week 1)

It started the way every AI project starts: a text box and a question.

> "You are a Seahawks salary cap expert. Analyze the Devon Witherspoon extension."

The output was... fine. Generic. It had the right structure — cap hit, guaranteed money, comparison to league benchmarks — but it read like a Wikipedia summary. No opinion. No tension. No reason to keep reading.

The first insight came from asking a different question:

> "You are a player representative who negotiated Devon Witherspoon's contract. Defend why $33M/year was fair."

Now the output had conviction. It argued for premium safety pay. It cited Witherspoon's age-adjusted value curve. It made a case.

Then I asked the cap expert again:

> "The player's agent says $33M/year was fair. You think it was too much. Make your case."

**That's when the magic happened.** Two AI "experts" with different incentives, arguing the same data, produced analysis that was genuinely better than either one alone. The cap expert said $27M was the ceiling. The player rep said $33M was the floor. The truth was somewhere in between, and the tension between them was the story.

**Lesson 1: One AI produces summaries. Multiple AIs with different perspectives produce analysis.**

---

## Phase 1: The Knowledge Base (Weeks 2-4)

The prompts worked, so I scaled them. I created detailed "agent" definitions for every NFL team and every domain specialty:

- **32 team agents** — each trained with roster data, salary cap situation, coaching staff, draft needs, divisional rivals
- **13 domain specialists** — Cap Expert, Draft Analyst, Injury Specialist, Offensive Scheme Expert, Defensive Analyst, Special Teams, Media Monitor, Analytics, College Scout, Player Representative, Lead Analyst, Editor, Writer
- **2 infrastructure agents** — Scribe (documentation) and Ralph (internal tooling)

Each agent got a **charter** — a structured markdown file defining who they are:

```markdown
# Charter — Cap

## Identity
- Name: Cap
- Role: Salary Cap Analyst
- Badge: 💰 Cap

## Scope
Salary cap analysis, contract evaluation, dead money projections,
cap space optimization. Cap is the domain expert for all financial
aspects of NFL roster management.

## Domain Knowledge
- NFL salary cap mechanics (top-51, minimum spending, rollover)
- Contract structures (signing bonus proration, void years, escalators)
- OverTheCap and Spotrac as primary data sources
- Historical contract comparisons by position

## Boundaries
- Does NOT evaluate on-field performance (routes to team agents)
- Does NOT make roster cut recommendations (routes to Lead)
- Financial analysis only — no editorial opinion on player character
```

And a **history file** — curated knowledge that accumulated over time:

```markdown
## 2026-03-15: Witherspoon Extension Analysis

Cap hit breakdown:
- 2026: $18.2M (signing bonus proration + base)
- 2027: $31.5M (first full-value year)
- 2028: $35.1M (peak cap hit)
- Total guaranteed: $96M (72% of total value)

Key insight: The void-year structure pushes $12M in dead money to
2030 — a bet that Witherspoon stays elite through age 27. If he
declines, this becomes the 4th-largest dead cap hit for a CB in
NFL history.

Comparable contracts: Sauce Gardner ($27M AAV), Pat Surtain ($26M),
Derek Stingley ($25.5M). Witherspoon's $33M is 22% above the next-
highest CB — unprecedented premium.
```

I hand-curated **20,000+ lines** of this kind of domain intelligence across all 47 agents. Every agent knew their specialty deeply.

At this point, the workflow was: open Copilot CLI, paste the right charter + history + question, get analysis, manually stitch responses together into articles. I published two articles this way — a Seahawks RB evaluation where 6 agents converged on Jadarian Price (a player most casual fans had never heard of), and the Witherspoon extension analysis where Cap and Player Rep genuinely disagreed on value.

**The articles were good.** The Editor agent caught 6 factual errors in one draft, including a name confusion between two players that would have destroyed credibility.

**But the process was brutal.** Each article took hours of manual prompt-pasting, copy-pasting between agents, and hand-stitching. Nothing was automated. Nothing was tracked. Business logic was embedded in prompts.

**Lesson 2: Agents need structured identity (charters) and persistent knowledge (history). But manual orchestration doesn't scale past the first few outputs.**

---

## Phase 2: The Failed First Automation (Weeks 4-6)

The obvious next step was automation. I tried the obvious approach: **BullMQ job queues.**

The idea: each agent is a worker, each stage is a job. Article enters the queue at Stage 1, each worker picks up the next stage, processes it, and enqueues the result.

I built it. I even built an approval dashboard. I wrote end-to-end tests.

Then I deleted all of it.

```
8ce76ea4 chore: remove pipeline/dashboard infrastructure
65f428e2 chore: remove pipeline squad agents and stale decisions
```

**Why it failed:**

1. **Job queues are for independent tasks.** Article stages are sequential with complex dependencies. You can't run Stage 5 (Writer) until Stage 4 (Panel Discussion) produces artifacts that Stage 5 needs. BullMQ doesn't model that naturally.

2. **The agents weren't workers.** A queue worker processes one item identically. An agent needs its charter, skills, current article context, conversation history, and the right LLM provider — all assembled differently for each invocation.

3. **Error handling was wrong.** When an LLM returns garbage, you don't want to retry the job. You want to inspect the trace, understand why, and potentially adjust the prompt or route to a different agent. Queue retry semantics don't fit.

4. **Observability was impossible.** I couldn't see what any agent was thinking. Prompts went in, text came out, and if the text was wrong, I had no way to diagnose whether the charter was bad, the context was missing, or the model was hallucinating.

**Lesson 3: Multi-agent workflows are NOT job queues. They're state machines. The difference matters enormously: state machines have guards, transitions, and introspectable state. Queues just have "next."**

---

## Phase 3: The Replatform — Building It Right (Weeks 6-16)

I sat down and wrote a proper architecture document. It identified 6 structural problems:

1. Business logic embedded in LLM prompts (not testable, not versionable)
2. Agent data mixed with source code in Git (charters changed faster than code)
3. Tight coupling to Copilot CLI (couldn't run without a specific IDE)
4. No persistent state (articles had no status, no stage tracking, no audit trail)
5. No multi-provider support (locked to one LLM vendor)
6. No observability (couldn't see what agents were doing or why)

The solution was a complete TypeScript replatform with 5 core components:

### Component 1: The Pipeline Engine (State Machine)

The pipeline is an 8-stage state machine where each transition has a **guard function** that checks prerequisites:

```
[Idea] → [Discussion Prompt] → [Panel Composition] → [Panel Discussion]
                                                            ↓
[Published] ← [Publisher Pass] ← [Editor Pass] ← [Article Draft]
                                       ↑               ↓
                                       └─── REVISE ────┘
```

```typescript
export const TRANSITION_MAP: TransitionDef[] = [
  {
    from: 1, to: 2,
    action: 'generatePrompt',
    guard: (store, id) => requireIdea(store, id),
  },
  {
    from: 5, to: 6,
    action: 'runEditor',
    guard: (store, id) => requireDraft(store, id),
  },
  // ...
];
```

Guards are **pure functions** that inspect artifacts. `requireDraft` checks that the draft exists, has 200+ words, contains a TLDR block with 4+ bullet points, and passes structural validation. No LLM involved — deterministic checks that run in microseconds.

**Why this matters:** When an article is stuck at Stage 5, I can ask "why?" and get a deterministic answer: "Draft has 142 words (minimum 200)" — not "the AI decided it wasn't ready."

### Component 2: The Agent Runner (Composition Engine)

The Runner loads charters from the filesystem, merges them with skills, and composes a system prompt:

```typescript
async run(params: AgentRunParams): Promise<AgentRunResult> {
  // 1. Load charter (identity, responsibilities, knowledge, boundaries)
  const charter = this.loadCharter(agentName);
  
  // 2. Load requested skills (reusable expertise modules)
  const skills = skillNames.map(n => this.loadSkill(n)).filter(Boolean);
  
  // 3. Compose system prompt from charter + skills + roster context
  const systemPrompt = this.composeSystemPrompt(charter, skills, memories, rosterContext);
  
  // 4. Route to LLM via gateway
  const response = await this.gateway.chat({
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: task }],
    model: charter.model,
    // ...
  });
  
  return { content: response.content, model: response.model, provider: response.provider };
}
```

Charters and skills live in `~/.nfl-lab/` — separate from the repo. They change on a different cadence than code. An agent's charter might be updated hourly during active development but the TypeScript code deploying that charter changes weekly.

**Lesson 4: Separate agent definitions (what they know) from agent infrastructure (how they run). Charter files are content. The Runner is code. They change at different speeds and for different reasons.**

### Component 3: The LLM Gateway (Provider Abstraction)

Every LLM provider (Copilot, Anthropic, OpenAI, Gemini, LM Studio, local models) implements one interface:

```typescript
export interface LLMProvider {
  id: string;
  name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  listModels(): string[];
  supportsModel(model: string): boolean;
}
```

The Gateway routes requests based on a **Model Policy** — a JSON configuration that maps pipeline stages to model tiers:

- Draft stage → use a cheaper model (high volume, rough output)
- Editor stage → use the best model (precision matters)
- Panel discussion → use the model that's best at argumentation

I can switch an entire pipeline's LLM provider by changing one environment variable. During development I use LM Studio (free, local). For production articles I route to Anthropic or OpenAI. For testing, there's a mock provider that returns deterministic responses.

**Lesson 5: Never hardcode your LLM provider. You WILL switch models, and you will switch more often than you think. Build the abstraction on day one.**

### Component 4: The SQLite Repository (Source of Truth)

Everything lives in SQLite: articles, stage transitions, LLM traces, usage events, editor reviews, artifacts, conversations, retrospectives. 20+ tables.

The key insight was storing **artifacts in the database**, not on the filesystem:

```sql
CREATE TABLE artifacts (
    article_id TEXT NOT NULL,
    name       TEXT NOT NULL,      -- e.g. 'idea.md', 'draft.md', 'editor-review.md'
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(article_id, name)
);
```

Every article's idea, discussion prompt, panel composition, discussion summary, draft, editor review, and publisher checklist are rows in this table. Guard functions read from this table. The dashboard reads from this table. LLM traces reference this table. One source of truth.

**Lesson 6: If your agents produce artifacts, put them in a database, not on a filesystem. Databases give you transactions, queries, and relational integrity. Filesystems give you race conditions.**

### Component 5: The Dashboard (Editorial Workstation)

Built with Hono (server) + HTMX (client). No React, no build step for the frontend. Server-rendered HTML with HTMX partials for interactivity.

The dashboard shows:
- Pipeline board (all articles, their current stage, available actions)
- Article detail (full artifact history, conversation thread, revision timeline)
- Trace inspector (every LLM prompt and response, with token counts and latency)
- Config view (active providers, model policy, settings)

The trace inspector turned out to be **the most important debugging tool in the entire system.** When an article draft is bad, I click through to the trace, see the exact system prompt that was composed, the user message, and the raw LLM response. I can see if the charter was missing context, if the skills were wrong, or if the model just hallucinated.

**Lesson 7: Full-prompt observability is not optional. If you can't see exactly what went into and came out of every LLM call, you're flying blind. Build your trace system before you build your second agent.**

---

## Phase 4: Production Hardening (Weeks 16-24)

Shipping the replatform was just the beginning. Real articles exposed real problems.

### Problem 1: The Writer/Editor Death Loop

Articles kept getting stuck. Writer would produce a draft. Editor would flag 3 issues — one of which was always "need stronger evidence for claim X." Writer would revise, but couldn't actually research claim X (Writer has no data tools). Editor would flag the same issue. Loop forever.

**Root cause:** The Editor was identifying evidence gaps but routing them back to the Writer, who had no ability to fill those gaps. The right agent for evidence gathering was the Research agent, but there was no routing path from Editor → Research.

**Solution (still in progress):** Structured blocker tracking. When the Editor flags an issue, it's now classified by type: `stylistic` (Writer can fix), `structural` (Writer can fix), `evidence_deficit` (route to Research), `factual_error` (route to fact-check). Each type has a different routing path.

**Lesson 8: Multi-agent systems fail at handoff points, not within individual agents. The most important architecture decision is: when Agent A identifies a problem, which Agent B should handle it? Get the routing wrong and the system loops.**

### Problem 2: Prompt Pollution

When I migrated from v1 to v2, I copied all 47 agent charters and history files to the new runtime directory (`~/.nfl-lab/`). But the charters still contained v1-era references — mentions of `.squad/` paths, BullMQ concepts, GitHub Issue workflows that no longer existed.

The LLMs dutifully followed these stale instructions, producing outputs that referenced non-existent systems.

**Solution:** Audit and clean all 47 charters. Remove v1 references. Add version headers. Establish a charter review cadence.

**Lesson 9: Agent knowledge rots faster than you think. If you give an agent a fact on Monday, that fact might be wrong by Friday. Build freshness tracking into your knowledge management from the start.**

### Problem 3: The Fact Problem

An early draft stated that "Emmanwori earned Second-Team All-Pro honors in 2025." The player's name was Emmanwori, but the analysis was actually about a different player entirely — a hallucination that mixed two players' achievements into one. If published, this would have destroyed credibility.

The Editor caught it. But catching it by accident isn't a system — it's luck.

**Solution:** A three-layer fact-checking system:

1. **Writer Preflight** — Deterministic checks before the Editor ever sees a draft. Name consistency (is every player name used consistently?), structural checks (TLDR present? Section headers?), and contract precision (dollar amounts with proper citation).

2. **Claim Extraction** — A dedicated module that pulls verifiable claims from drafts: player stats, contract figures, historical records, comparative assertions. Each claim gets tagged with confidence level and source requirement.

3. **Budgeted Fact-Checking** — The Writer can now check specific risky claims, but with guardrails: approved sources only (nflverse roster data, official team sites, OverTheCap), budgeted verification passes (1 local + 3 external for fresh drafts), and wall-clock time limits (5 minutes max per stage).

```typescript
export const WRITER_FACTCHECK_POLICY: WriterFactCheckPolicy = {
  riskyClaimsOnly: true,
  rawWebSearchAllowed: false,
  editorRemainsFinalAuthority: true,
  approvedSourceOrder: ['local_runtime', 'official_primary', 'trusted_reference'],
  freshDraft: { localDeterministicPasses: 1, externalChecks: 3, wallClockMinutes: 5 },
  revision:   { localDeterministicPasses: 1, externalChecks: 1, wallClockMinutes: 5 },
};
```

**Lesson 10: Never trust an LLM's output without verification. But "verify everything" is too expensive. The art is knowing which claims are risky enough to verify and having a bounded, auditable process for doing so.**

---

## Phase 5: Tool Calling & Intelligence (Weeks 24-present)

The most recent evolution: giving agents the ability to use tools.

### Before Tool Calling
An agent's only capability was text generation. Ask a question → get text back. If the text referenced stale data, tough luck. If you needed a calculation, the agent would approximate.

### After Tool Calling
Agents can now:
- Query live nflverse data (rosters, stats, cap numbers)
- Search for specific player information
- Look up prediction market prices
- Read and write pipeline artifacts
- Trigger downstream pipeline actions

The tool calling system uses a bounded, app-managed loop:

```typescript
toolCalling: {
  enabled: true,
  maxToolCalls: 12,                    // Hard limit — prevent infinite loops
  includeLocalExtensions: true,        // MCP-registered tools
  includePipelineTools: true,          // Article-aware tools
  includeWebSearch: true,              // Bounded web search
  allowWriteTools: false,              // Read-only by default (safety)
}
```

Each tool call is traced — the tool name, arguments, response, and latency are all recorded in the `llm_traces` table alongside the prompt/response.

**Lesson 11: Tool calling transforms agents from "text generators" to "actors that can observe and interact with the world." But tools need safety boundaries: max calls, read-only defaults, approved sources. An unbounded agent with tools is a liability, not a feature.**

---

## Phase 6: What's Next

Three futures I'm considering:

### A. The Content Factory
Cron-triggered daily production across 32 NFL teams. Each team gets automated Media sweeps → article drafts → Editor review → human approve → publish. Target: one human hour per week to run the entire operation.

**What's missing:** Pipeline automation (cron triggers), multi-team quality proof, cost measurement, and a human approval queue.

### B. The Intelligence Platform
License the agent infrastructure to media companies. "Plug in your editorial voice, get AI-powered analysis at scale." SaaS model with multi-tenant isolation, API access, and self-serve onboarding.

**What's missing:** Multi-tenant architecture, API layer, onboarding flow, and at least one reference customer.

### C. The Editorial Copilot
Individual journalists use the dashboard as their AI editorial room. Human provides angles and decisions; AI handles research, drafting, fact-checking, formatting. Not autonomous — co-pilot model with human quality gate.

**What's missing:** UX redesign for non-technical users, onboarding/tutorial flow, simplified configuration, and real-time collaborative editing.

---

## The Lessons, Collected

If you're building a multi-agent system — in any domain — these are the lessons I learned the hard way:

1. **One AI produces summaries. Multiple AIs with different perspectives produce analysis.** The "expert disagreement" format is genuinely novel and produces better content than any single model.

2. **Agents need structured identity and persistent knowledge.** Charters (who am I, what do I know, what are my boundaries) and history (what have I learned) are the foundation. Without them, every agent is a generic text generator.

3. **Multi-agent workflows are state machines, not job queues.** You need guards, transitions, and introspectable state. "Put it on the queue" is not an architecture.

4. **Separate agent definitions from agent infrastructure.** Charters are content. Runners are code. They change at different speeds and for different reasons.

5. **Never hardcode your LLM provider.** Build the multi-provider abstraction on day one. You will switch models more often than you think.

6. **Put artifacts in a database, not on a filesystem.** Transactions, queries, and relational integrity beat race conditions and glob patterns.

7. **Full-prompt observability is not optional.** If you can't inspect every LLM call — system prompt, user message, response, latency, tokens — you're flying blind.

8. **Multi-agent systems fail at handoff points.** The routing between agents is more important than the agents themselves. When Agent A finds a problem, which Agent B fixes it?

9. **Agent knowledge rots faster than you think.** Build freshness tracking and refresh automation from the start.

10. **Never trust an LLM's output without verification.** But verification must be bounded and auditable — you can't check everything, so know which claims matter.

11. **Tool calling transforms agents from text generators to actors.** But tools need safety boundaries: max calls, read-only defaults, approved sources. Unbounded agents with tools are a liability.

---

## By the Numbers

| Metric | Value |
|--------|-------|
| Total agents | 47 (32 teams + 13 specialists + 2 infrastructure) |
| Source files (TypeScript) | 66 |
| Source lines of code | 23,922 |
| Test files | 67 |
| Test lines of code | 23,417 |
| Database tables | 20+ |
| LLM providers supported | 9 |
| Pipeline stages | 8 |
| nflverse data integrations | 11 |
| Git commits | 694 |
| Hand-curated NFL intelligence | ~20,000 lines |
| Articles published | 2 (so far) |
| Architecture rewrites | 1 major (v1→v2), 1 removal (BullMQ) |
| Weeks of development | ~24 |

---

*The code is at [github.com/JDL440/nfl-eval](https://github.com/JDL440/nfl-eval). The football content is at [Substack]. The lessons apply to any domain where multiple AI agents need to collaborate — not just sports.*

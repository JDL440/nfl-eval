# VISION.md — NFL Content Intelligence Platform

> **Status:** v2 application architecture is live. Scaling, automation, and audience validation are the next phase.
> **Last updated:** 2026-03-20
> **Owner:** Joe Robinson

---

## What This Is

An AI-powered NFL content intelligence platform that uses a network of specialized agents to produce expert-grade football analysis at scale. Each agent has deep domain knowledge, persistent memory, and a defined role — and they argue with each other to produce better analysis than any single writer could.

**Current state:** v2 is now a TypeScript + Hono + SQLite platform with a live dashboard, multi-provider LLM routing, 47 agent charters loaded into the new runtime, and published proof-of-concept output. The original v1 implementation is available in git history.

**End state:** A 32-team autonomous content network producing daily analysis for every NFL franchise, with minimal human oversight.

---

## What We've Proven

| Capability | Status | Evidence |
|-----------|--------|----------|
| Multi-agent analysis that surfaces real disagreements | ✅ Proven | Cap ($27M) vs PlayerRep ($33M) on Witherspoon — two experts, same data, opposite conclusions. This IS the product. |
| Cross-agent synthesis on complex questions | ✅ Proven | Seahawks RB evaluation: 6 agents (SEA, Cap, Injury, CollegeScout, Offense, Media) converged on Jadarian Price — a player most casual fans have never heard of. |
| Automated fact-checking catches real errors | ✅ Proven | Editor caught 6 factual errors in one article (McDuffie All-Pro count, Witherspoon hometown, contract figures). The Emmanwori name confusion would've killed credibility. |
| Daily news ingestion and cross-team distribution | ✅ Proven | Media's daily sweeps pulled 20+ transactions, distributed to 18-20 affected team agents per sweep. |
| Publication-quality long-form articles | ✅ Proven | Two ~3,500-word articles with data tables, expert quotes, and clear recommendations. Reader-quality is there. |
| 32-team knowledge base | ✅ Built | All 32 team agents trained with roster, cap, coaching, needs, rivals. Specialists trained league-wide. |

## What We Haven't Proven Yet

| Capability | Status | What's Needed |
|-----------|--------|---------------|
| Automation (hands-off content pipeline) | ❌ Not built | Cron-triggered Media sweeps → auto-draft articles → Editor review → human approve → publish |
| Multi-team article production | ❌ Not tested | We've only published Seahawks content. Need to prove the same pipeline works for any team. |
| Reader engagement / audience validation | ❌ Early | Initial publishing and section setup exist, but there is still no meaningful subscriber or engagement dataset. |
| Scale economics (cost per article at 32x) | ❌ Unknown | Need to measure: API costs per article, per team, per day. Is this $5/article or $50? |
| Content consistency across 32 voices | ❌ Not tested | Can Writer maintain quality and voice when producing for KC, DAL, PHI — not just SEA? |
| Freshness / staleness management | ❌ Fragile | Agent knowledge drifts. Today's knowledge is current; next week it won't be without refreshes. |

---

## The Enterprise Vision

### Phase 1: Prove the Model (NOW → Draft 2026)
**Goal:** Launch SEA Substack, publish 1×/week through the draft. Build a small audience that validates content quality.

- [ ] Publish 5-8 articles on Seahawks Substack (football content only — don't reveal the infrastructure)
- [ ] Run Editor on every article before publish
- [ ] Measure: open rates, read time, subscriber growth, comments
- [ ] Prove the "expert panel disagrees" format resonates with readers
- [ ] Cost: track API spend per article

### Phase 2: Automate the Pipeline (Post-Draft → Training Camp)
**Goal:** Reduce human involvement to "approve" button. The system proposes, drafts, reviews, and queues articles.

- [ ] Build automated daily Media sweep (cron or GitHub Action)
- [ ] Auto-trigger article drafts when significant news affects a team
- [ ] Writer auto-drafts → Editor auto-reviews → human reviews queue → publish
- [ ] Dashboard: what's in the queue, what's been published, what's pending approval
- [ ] Target: one human hour per week to run the SEA Substack

### Phase 3: Scale to 32 Teams (Training Camp → Season)
**Goal:** Clone the SEA playbook to every NFL team. Each team gets its own Substack (or section of a master site).

- [ ] Templatize the article pipeline so any team agent can drive it
- [ ] Buy/register 32 Substack domains (or one master domain with 32 sections)
- [ ] Run a "proof of scale" week: produce one article per team (32 articles in one week)
- [ ] Validate quality across teams — does the Cowboys article read as well as the Seahawks one?
- [ ] Cost model: what does 32×/week cost in API calls?

### Phase 4: Monetize (Regular Season)
**Goal:** Revenue from content and/or infrastructure licensing.

**Option A — Direct Subscription:**
- 32 team Substacks × $5/mo × subscribers
- Free tier (1 article/week) + paid tier (all articles, draft coverage, trade deadline war room)
- Revenue scales with subscriber count per team

**Option B — Infrastructure License:**
- License the agent infrastructure to existing media companies (The Athletic, ESPN, local beat writers)
- "Plug in your editorial voice, get AI-powered analysis at scale"
- SaaS model: per-team, per-month

**Option C — Both:**
- Run the Substacks as proof of product → license the platform as the real business
- The Substacks are marketing for the platform

---

## Competitive Moat

**What's defensible:**
- The agent architecture (47 specialized agents with persistent memory, cross-agent synthesis, fact-checking pipeline)
- The knowledge base (20K+ lines of curated, structured NFL intelligence — not just raw data)
- The editorial workflow (Writer → Editor pipeline catches errors that pure AI content misses)
- The "expert disagreement" format — nobody else is doing multi-agent debate as a content product

**What's NOT defensible (yet):**
- The raw data (OverTheCap, Spotrac, ESPN are public)
- The AI models (anyone can use Claude/GPT)
- The Substack format (trivially copyable)

**Moat strategy:** Speed + depth + trust. Be the first to scale to 32 teams with consistent quality. Build subscriber trust before competitors figure out the model. The infrastructure becomes defensible when it has 6+ months of accumulated knowledge, proven editorial accuracy, and a subscriber base.

---

## What NOT to Share Publicly

⚠️ **Do not publish:**
- How the agent infrastructure works (the "47 agents" story)
- The specific agent architecture (team agents + specialists + Editor + Writer)
- The multi-agent disagreement mechanic as a deliberate design choice
- API costs, agent counts, or technical implementation details
- This document

**Why:** This is the competitive playbook. The moment you publish "here's how 47 AI agents create NFL content," every sports media company and AI developer has your blueprint. Let the content quality speak for itself. The tech story becomes the pitch deck for investors or licensees — not a blog post for readers.

**What TO share:** Just the football content. Let it be suspiciously good. Readers will notice the depth, the data, the multiple perspectives — and they'll subscribe because the analysis is better than what they get anywhere else.

---

## Key Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **AI hallucination in published content** | 🔴 High | Editor fact-checks every article. The Emmanwori catch proves the system works. But one bad error in a high-profile article could kill trust. |
| **API cost explosion at scale** | 🟡 Medium | Need to measure cost per article. Opus-tier models are expensive. May need to optimize: use cheaper models for drafts, premium for final review. |
| **Knowledge staleness** | 🟡 Medium | Agent knowledge drifts within days. Need automated daily refresh or at minimum weekly Media sweeps with cross-agent distribution. |
| **Competitor replication** | 🟡 Medium | Keep the architecture private. Move fast on the 32-team scale. First-mover advantage matters in content. |
| **Platform dependency (AI model changes)** | 🟡 Medium | Currently all-in on Claude Opus. Model deprecation or pricing changes could disrupt. Build model-agnostic where possible. |
| **Legal: scraping / data source terms** | 🟡 Medium | OverTheCap, Spotrac, ESPN data is publicly available but TOS may restrict automated scraping. Need to evaluate. |
| **Audience: do fans want AI-written content?** | 🔴 Unknown | The biggest unknown. Some readers will love the depth. Some will reject "AI content" on principle. The stealth approach (don't reveal the AI) mitigates this but creates its own ethics question. |

---

## Current System Inventory

| Component | Count | Status |
|-----------|-------|--------|
| Team agents (one per NFL team) | 32 | ✅ Trained, league-wide knowledge |
| Domain specialists | 13 | ✅ Cap, Draft, Injury, Offense, Defense, SpecialTeams, Media, Analytics, CollegeScout, PlayerRep, Lead, Editor, Writer |
| Infrastructure agents | 2 | ✅ Scribe, Ralph |
| Total agents | 47 | ✅ All operational |
| Published articles | 2 | ✅ RB target board + Witherspoon extension |
| Editorial calendar | 1 | ✅ Through 2026 season |
| Article ideas in pipeline | 19+ | ✅ Mapped to NFL calendar |
| Skills (reusable workflows) | 6 | ✅ OTC data, Spotrac, roster research, knowledge recording, conventions, substack article |
| Lines of NFL intelligence | ~20,000+ | ✅ Across all agent history files |
| Git repo | JDL440/nfl-eval | ✅ Pushed and current |

---

## Next Session Priorities

1. **Prove multi-team output** — Pick a non-Seahawks team (maybe KC or DAL for audience size) and produce an article. Proves the system isn't Seattle-only.
2. **Measure cost** — Track API calls for one full article pipeline (experts → Writer → Editor). Understand unit economics.
3. **Automate Media sweeps** — Build a cron/Action that runs Media daily without human trigger.
4. **Publish to actual Substack** — Even if it's just one article, get it live and see if real humans read it.


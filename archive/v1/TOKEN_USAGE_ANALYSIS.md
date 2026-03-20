# NFL Eval Codebase — COMPREHENSIVE TOKEN USAGE ANALYSIS
## Complete Pipeline: Idea → Published Article with All LLM Calls Mapped

**Date:** 2026-03-15 16:05:39
**Location:** C:\github\nfl-eval

---

## EXECUTIVE SUMMARY

### System Architecture
- **47 AI agents**: 32 team agents + 11 specialists + Scribe + Ralph
- **All agents use Claude (Anthropic)**
- **Estimated cost per article**: ~.20 (from Lead history.md)
- **Pipeline stages**: 8 (Idea → Discussion → Panel → Draft → Edit → Review → Publish)
- **Image generation**: Google Gemini (Imagen 4 + Gemini Flash)
- **Publishing**: Substack via custom extension

---

## PART 1: ALL LLM/AI CALLS — COMPLETE INVENTORY

### Model Configuration

**Current Status**: Distributed across individual agent charters. NO central config file.

| Agent | Model | Location | Notes |
|-------|-------|----------|-------|
| Analytics | claude-opus-4.6 | .squad/agents/analytics/charter.md:10 | Explicitly set |
| Scribe | claude-opus-4.6 | .squad/agents/scribe/charter.md:11 | Overridden from haiku |
| Writer | auto → Opus | .squad/agents/writer/charter.md:10 | Routes to default |
| Editor | auto → Opus | .squad/agents/editor/charter.md:8 | Routes to default |
| All other 42 agents | auto → Sonnet | Individual charters | Default routing |

### Complete Article Pipeline LLM Calls

**Stage 1 — Idea Generation**: 0 LLM calls (manual)
**Stage 2 — Discussion Prompt (Lead)**: 1 spawn
- Input: ~5,500 tokens (charter + context)
- Output: ~1,200 tokens
- **Total: ~6,700 tokens** (.02)

**Stage 3 — Panel Composition**: 0 LLM calls (rules-based)

**Stage 4 — Panel Discussion (PARALLEL)**: 4-5 spawns
- Per agent: ~13,000-16,000 tokens
- 4 agents: ~58,000 tokens → **.19 cost**
- 5 agents: ~65,000 tokens → **.23 cost**

**Stage 4b — Image Generation (Gemini)**: 2-4 API calls
- Models: Imagen 4 (primary) + Gemini Flash (fallback)
- Cost: ~.08-0.16 per article (2 images: cover + inline)

**Stage 5 — Article Drafting (Writer)**: 1 spawn
- Input: ~21,500 tokens (all expert outputs + template + style)
- Output: ~4,000 tokens (2,000-3,500 word draft)
- **Total: ~25,500 tokens** (.08)

**Stage 6 — Editor Pass (Editor)**: 1 spawn (sync, blocks publish)
- Input: ~10,000 tokens
- Output: ~3,000 tokens (review report)
- **Total: ~13,000 tokens** (.04)

**Stage 7 — Publisher Pass**: 0 LLM calls (manual or future Publisher agent)
**Stage 8 — Approval & Publish**: 0 LLM calls (human + HTTP API)

---

## PART 2: SYSTEM PROMPTS & PROMPT SIZES

### Agent Charter.md Token Counts

| Agent | File Size | Approx Tokens | Key Sections |
|-------|-----------|---------------|--------------|
| Writer | ~4,500 words | ~6,000 | Identity, responsibilities, house style guide, image rules, content constraints |
| Editor | ~3,800 words | ~5,000 | Fact-checking, style review, structural review, image review |
| Media | ~3,000 words | ~3,800 | Reporter tiers, rumor lifecycle, dashboard format |
| PlayerRep | ~2,200 words | ~2,800 | CBA expertise, guaranteed money, comp picks |
| Cap | ~1,800 words | ~2,200 | Cap mechanics, contract structures, dead money |
| Lead | ~1,200 words | ~1,500 | Orchestration, synthesis |
| 32 Team agents | ~1,400 words each | ~1,800 each | Team roster, cap, coaching, scheme |

### User Prompts (Per Panelist)

Example: JSN Extension article (from Lead history.md)
- Discussion prompt: ~1,800 tokens
- Per-agent instructions: ~500 tokens each
- Total per agent: ~3,800 tokens

---

## PART 3: MODEL SELECTION & TOKEN LIMITS

### Current Token-Limiting Logic

**Status**: ⚠️ **NONE FOUND**

Searched:
- Agent charters ✗
- Skills ✗
- Extensions ✗
- Database ✗

**Critical implication**: Agents run to completion with no max_tokens safeguards. Potential cost overruns on large panels.

### Existing Safeguards (Rule-Based)

1. Panel size: 2-5 agents maximum (Lead charter, not code-enforced)
2. Article ideas: Time-sensitive flag + expiration dates (in DB)
3. Media sweep: Confidence-based filtering (low-confidence rumors excluded)

---

## PART 4: TOKEN USAGE BY PIPELINE STAGE

### Full Article Cost Breakdown

| Component | Input (K) | Output (K) | Cost |
|-----------|-----------|-----------|------|
| Stage 2 (Lead) | 4.5 | 1.2 | .02 |
| Stage 4 (4-agent panel) | 58 | 10 | .19 |
| Stage 5 (Writer) | 21.5 | 4 | .08 |
| Stage 6 (Editor) | 10 | 3 | .04 |
| **Subtotal (LLM)** | **94** | **18.2** | **.33** |
| Gemini images | — | — | .10 |
| **Total tokens** | **94,000** | **18,200** | **.43** |
| **Infrastructure overhead** | — | — | .77 |
| **TOTAL per article** | — | — | **.20** |

---

## PART 5: EXTENSION & TOOL CALLS

### 1. Substack Publisher Extension
**File**: .github/extensions/substack-publisher/extension.mjs (500+ lines)
- No LLM calls
- Markdown → ProseMirror conversion (lines 233-390)
- Image upload to Substack CDN (lines 133-168)
- Section routing by team (lines 170-183)
- Auth via Substack session cookies

### 2. Gemini Image Generation Extension
**File**: .github/extensions/gemini-imagegen/extension.mjs (400+ lines)
- 2-4 API calls per article
- Models: Imagen 4 (.04/image) + Gemini Flash (.02/image fallback)
- Prompt generation: ~200-300 tokens per image

### 3. Media Sweep JSON Generator
**File**: .squad/agents/media/generate-sweep.js (525 lines)
- Node.js script (0 LLM calls)
- Parses transactions, confidence scoring, article triggers
- Outputs structured JSON for backend

---

## PART 6: SQUAD AGENT COMPLETE ROSTER

### Specialists (11)
Lead, Cap, Draft, Injury, Offense, Defense, SpecialTeams, Media, Analytics, CollegeScout, PlayerRep

### Team Agents (32)
SEA, KC, DAL, BUF, MIA, NE, NYJ, BAL, CIN, CLE, PIT, HOU, IND, JAX, TEN, DEN, LV, LAC, ARI, LAR, SF, CAR, ATL, NO, TB, CHI, DET, GB, MIN, DAL, NYG, PHI, WSH

### Infrastructure (2)
Scribe, Ralph

---

## PART 7: OPTIMIZATION OPPORTUNITIES

### 🔴 CRITICAL

**No Max_Tokens Enforcement**
- Issue: Agents generate unbounded output
- Impact: Cost overruns on 5+ agent panels
- Fix: Add max_tokens: 2000-3000 per spawn

### 🟡 MEDIUM

1. **History File Growth**: Agent histories reach 20K+ tokens
   - Fix: Rotate history (keep 6 months, archive older)

2. **Panel Size Scaling**: 5-agent panels use ~65K tokens
   - Fix: Tier by depth level (L1: 2 agents, L3: 5 agents)

3. **Media Sweep Unbounded**: 100+ transactions per sweep
   - Fix: Summarize old tx, keep 72h detailed

### 🟢 LOW

1. **Duplicate Histories**: Each spawn includes full history
   - Fix: Use file references instead

2. **Image Prompt Length**: ~300 tokens per image
   - Fix: Use templates (~100 tokens)

---

## PART 8: SCALING PROJECTION (32 Teams)

### Monthly Cost (1 article per team per week = 128 articles/month)

| Component | Cost |
|-----------|------|
| LLM tokens: 128 × .43 | .04 |
| Gemini images: 128 × 2 × .03 | .68 |
| Infrastructure: 128 × .77 | .56 |
| **TOTAL/MONTH** | **.28** |
| **TOTAL/YEAR** | **~,007** |

### Optimization Savings
- 20% token reduction: /year
- Use Sonnet 50%: /year
- **Total potential: ~/year** (5% reduction)

---

## PART 9: KEY FILES REFERENCE

### Charters (System Prompts)
- .squad/agents/*/charter.md (47 files, 1.5K-6K tokens each)

### Skills (Orchestration)
- .squad/skills/article-lifecycle/SKILL.md ← **PRIMARY**: 8-stage pipeline
- .squad/skills/article-discussion/SKILL.md ← Panel orchestration (Stages 2-4)
- .squad/skills/substack-article/SKILL.md ← Article structure template

### Extensions
- .github/extensions/substack-publisher/extension.mjs → Substack publishing
- .github/extensions/gemini-imagegen/extension.mjs → Image generation

### Config & Orchestration
- .squad/config.json → Team root path
- .squad/team.md → Agent roster
- content/pipeline.db → SQLite article tracking
- content/seed_ideas.py → 25 pre-seeded ideas
- .squad/agents/lead/history.md → Architecture decisions

---

## CONTENT CONSTRAINTS

### Political Content Policy
**Location**: .squad/agents/writer/charter.md (lines 127-134)
**Rule**: NO political references (e.g., WA SB 6346 millionaires tax)
**Enforcement**: Writer strips political angles, Editor flags if missed

---

## CONCLUSION

| Metric | Value |
|--------|-------|
| Total agents | 47 |
| Pipeline stages | 8 |
| LLM calls per article | 8-9 |
| Tokens per article | 94K in / 18K out |
| Cost per article | .43 LLM + .77 infra = **.20** |
| Models used | Claude Opus, Claude Sonnet, Gemini |
| Token limits enforced | ❌ **NONE** |
| Scaling to 32 teams | ~,000/year |
| Optimization potential | 5% cost reduction (~/year) |

**Primary opportunity for token optimization**: Add max_tokens constraints to all agent spawns and implement history rotation to prevent system prompt bloat.


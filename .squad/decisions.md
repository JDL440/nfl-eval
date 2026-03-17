# Decisions

> Active decisions for the NFL 2026 Offseason project. Entries are organized by date (newest first). Older entries (30+ days) are archived in decisions-archive.md.

---

### 2026-07-26: Waddle Trade Article — Issue #78 Created
**By:** Lead (issue creator)
**Status:** ✅ ACCEPTED — Issue created, pipeline queued at Stage 2
**Affects:** DEN agent, MIA agent, Cap agent, Offense agent, article pipeline

**What:**
Created issue #78 as a dual-team trade reaction article for the confirmed Jaylen Waddle trade (MIA → DEN). Used specific, fact-checked angle rather than generic "IDEA GENERATION REQUIRED" template.

**Trade Details (verified):**
- **To DEN:** WR Jaylen Waddle + MIA 2026 4th (No. 111)
- **To MIA:** DEN 2026 1st (No. 30), 3rd (No. 94), 4th (No. 130)
- **Contract:** 3yr/$84.75M extension (2024). Cap: $5M → $27M → $30M

**Rationale:**
Trade confirmed across ESPN, CBS Sports, SI, Pro Football Network. For confirmed events, write a specific angle immediately — saves one pipeline step. Expected panel: DEN, MIA, Cap, Offense.

**Pattern:** For confirmed transactions (trades, signings, extensions), skip "IDEA GENERATION REQUIRED" template and write a specific angle with verified facts. Reserve the generic template for team-overview issues.

---

### 2026-07-25: Article Footer Boilerplate — "War Room" Brand (Option A)
**By:** Lead; approved by Joe Robinson
**Status:** ✅ APPROVED + IMPLEMENTED — Forward-looking rollout
**Affects:** `.squad/skills/substack-article/SKILL.md`, `.squad/agents/writer/charter.md`, `.squad/skills/substack-publishing/SKILL.md`, `.squad/skills/publisher/SKILL.md`, `extension.mjs`, `batch-publish-prod.mjs`

**What:**
Replaced misaligned footer boilerplate ("powered by a 46-agent AI expert panel...consensus view") with brand-aligned copy from the welcome article. New default:

> *The NFL Lab is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement is the analysis. Welcome to the War Room.*
>
> *Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.*

**Rollout:** Forward-looking only. 18 existing articles retain old footer (not batch-rewritten). Old footer regex patterns preserved in `FOOTER_PARAGRAPH_PATTERNS` for backward compatibility. 4 skill/charter templates + 2 publisher scripts updated.

---

### 2026-07-25: Prod-Default Publishing
**By:** Joe Robinson (directive), Lead (implementation)
**Status:** ✅ ACCEPTED — Enforced in workflow
**Affects:** All article publishing; extension.mjs, batch-publish-prod.mjs, squad orchestration, Lead routing

**What:**
Normal article drafts go directly to prod (`nfllab.substack.com`) by default. Extension default changed from `"stage"` to `"prod"` (`args.target || "prod"`). Stage is preserved as explicit opt-in via `target: "stage"` or `node batch-publish-prod.mjs stage <slug>` — use when testing new publisher/rendering functionality.

**Safety preserved:** Published-article guard, ProseMirror validation, hero-safe image check, dense table blocker, DB writeback requirement all still active.

**Related todo:** prod-default-publishing

---

## Current State



### 2026-07-25: Stage 7 Batch Production Push — 20 articles promoted to nfllab.substack.com
**By:** Writer (Substack Content Writer)
**Status:** Executed
**Affects:** All Stage 7 articles, pipeline.db, Joe's review queue

**What:**
Built a standalone Node.js script (adapted from `.github/extensions/substack-publisher/extension.mjs`) to batch-push 20 staging-only articles from `nfllabstage.substack.com` to `nfllab.substack.com` as production drafts. All 20 succeeded after handling Substack's rate limiting (HTTP 429). Pipeline.db `substack_draft_url` columns updated to production URLs. Manifest at `stage7-prod-manifest.json`.

**Key findings:**
- Substack rate-limits at ~4 rapid `POST /api/v1/drafts` calls with 1.5s delay; 8s delay + 10s/20s backoff on 429 resolves it.
- The extension's core functions are SDK-free and work standalone with zero modification.
- Markdown-extracted titles are the source of truth; DB titles are stale placeholders for most articles.

**Why:** All 20 articles were editor-approved and sitting at Stage 7 on staging only. Joe needs production draft URLs on nfllab.substack.com to proceed with Stage 8 review and publish.



### 🔴 Fixes Required (3):
1. **"Ryan Havenstein" → "Rob Havenstein"** (line 116) — wrong first name
2. **Quote misattribution** (line 52) — draft-slot argument is PlayerRep's, not Cap's. Split or rewrite the quote.
3. **"Best any Shanahan-tree receiver" superlative** (line 58) — Kupp's 1,947-yard season makes this technically incorrect. Add qualifier.



### 🟡 Top Recommendations:
- Add JSN's 2025 stat specifics (catches, TDs, target share) — "1,800 yards" alone isn't enough for the central argument
- Fix polished-paraphrase quotes presented as direct attribution (lines 87, 91, 165)
- Add DK Metcalf's Pittsburgh AAV ($30M/yr per project data) for narrative context



### What's Working:
- Structure, voice, tables, and data accuracy are excellent
- Four-path framework is compelling
- Verdict ($32-33M) takes a clear, well-supported position
- No political/tax content violations
- 22/23 verifiable facts checked clean



### Path to ✅ APPROVED:
Fix the 3 🔴 items → address top 🟡 suggestions → resubmit for final sign-off.

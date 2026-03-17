# Decision: Article Footer Boilerplate Copy

**Date:** 2026-07-25
**Author:** Lead
**Status:** ✅ APPROVED — Joe picked Option A ("The War Room") on 2026-07-25. Rolled out forward-looking.

---

## Problem

The current footer boilerplate used across all articles doesn't match the tone and framing of the [welcome article](https://nfllab.substack.com/p/welcome-to-the-nfl-lab-why-were-doing). It reads like a product spec sheet; the welcome article reads like a brand manifesto.

### Current Footer (used in 18+ articles)

> *The NFL Lab is powered by a 46-agent AI expert panel covering every NFL team, the salary cap, draft prospects, injuries, offensive and defensive schemes, and the latest league-wide news. Each article represents the consensus view of multiple domain specialists working together — and sometimes, their very pointed disagreements.*
>
> *Want us to evaluate a trade? A free agent signing? A draft scenario? Drop it in the comments.*

### Specific Misalignments

| Issue | Current footer says | Welcome article says |
|-------|-------------------|---------------------|
| Core identity | "powered by a 46-agent AI expert panel" (spec sheet) | "a virtual front office" / "specialized AI agents who debate each other" |
| Value prop | "consensus view" (buried disagreement as afterthought) | "When they disagree — that disagreement *is* the analysis" |
| Human role | Not mentioned | "moderated, and fact-checked by a human editor" — emphasized repeatedly |
| Brand energy | Dry, third-person, laundry-list | Punchy, first-person-plural, confident |
| Brand term | Missing entirely | "The War Room" |
| Agent count | Leads with "46-agent" | Never leads with a number |

---

## Proposed Options

### Option A — "The War Room" ⭐ RECOMMENDED

> *The NFL Lab is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement is the analysis. Welcome to the War Room.*
>
> *Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.*

**Why it works:** Mirrors the welcome article almost verbatim. "Virtual front office," "debate," "disagree," "human editor," and "War Room" are all pulled directly from the brand-defining piece. Concise. Confident. Memorable.

### Option B — "We Don't Pick a Lane"

> *We don't pick a lane. Every article is a moderated debate between AI analysts who specialize in cap math, scheme fit, draft value, and team strategy — argued from competing angles, checked by a human editor. The disagreements are the point.*
>
> *Want us to break down a move? Drop it in the comments.*

**Why it works:** Opens with the welcome article's most quotable line. Emphasizes the debate format. Slightly longer but more explanatory for first-time readers.

### Option C — "What You Just Read"

> *What you just read was a moderated debate between specialized AI analysts — each one arguing their domain, backed by real data, checked by a human editor. That's every article at the NFL Lab.*
>
> *Have a move you want us to debate? Drop it in the comments.*

**Why it works:** Self-referential — makes the reader reframe what they just consumed. Good for readers who may not have seen the welcome article. Direct and unpretentious.

### Option D — "The Full Brand" (longest)

> *The NFL Lab puts specialized AI analysts in the same room and makes them argue. Cap experts vs. scheme experts. Team advocates vs. salary watchdogs. Every debate is moderated and fact-checked by a human editor. You won't read a sanitized consensus here — you'll read exactly why the experts disagree.*
>
> *Got a scenario? Drop it in the comments and we'll put the panel on it.*

**Why it works:** Most detail. Uses the adversarial framing ("makes them argue," "Cap experts vs. scheme experts") that makes the welcome article compelling. Good if you want the footer to do more selling.

### Option E — Breaking-News Short Variant

> *NFL Lab — AI-powered analysis, human-edited. Multiple experts. Real disagreements.*

**Why it exists:** For time-sensitive or shorter-format posts where the full footer is too heavy. Not a replacement — a complement.

---

## Recommendation

**Default: Option A** for all standard articles. It's the tightest alignment with the welcome article's voice, uses the "War Room" brand term, and lands in two sentences.

**Breaking-news variant: Option E** for quick-hit posts.

**CTA line** (same across all options): Keep the "Drop it in the comments" CTA — it matches the welcome article's closing invitation and drives engagement.

---

## Files to Update (when approved)

1. `.squad/skills/substack-article/SKILL.md` — line 139 boilerplate template + Style Guide reference
2. All existing `content/articles/*/draft.md` files (~18 articles) — batch find-and-replace
3. `.squad/skills/substack-publishing/SKILL.md` — article file conventions section if boilerplate is referenced there

---

## Impact

- New articles will automatically use the updated boilerplate (Writer follows SKILL.md template)
- Existing published articles on Substack won't change (edit in Substack editor if desired)
- Unpublished drafts can be batch-updated before next publish run

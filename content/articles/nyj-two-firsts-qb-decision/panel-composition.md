# Panel Composition: NYJ — Two Bites at the Apple

**Article:** nyj-two-firsts-qb-decision
**Depth Level:** 2 — The Beat
**Panel Size:** 3 agents (within Level 2 limit of 3-4)

## Selected Panel

| Agent | Role | Why on This Panel | Focus Lane |
|-------|------|-------------------|------------|
| **Draft** | Draft Expert | Two first-round picks make draft strategy THE central decision — need prospect evaluation + trade value math | QB prospect profiles, #2 pick trade-back value, #2/#16 strategy tree optimization |
| **NYJ** | New York Jets Expert | Teardown context and roster needs define which draft path makes sense | Roster audit post-Gardner/Williams trades, positional emergencies, teardown coherence, win timeline |
| **Cap** | Salary Cap Expert | ~$36M cap space + franchise tag + two top-20 rookie contracts create real financial constraints | Effective spending power, Hall tag analysis, rookie pool impact, rebuild spending model |

## Rationale

- **Why 3 agents, not 4?** The article's tension is draft strategy + team context + financial constraints. These three lanes cover it completely. Adding Offense or Defense would fragment the discussion — the Jets' scheme is TBD with a rebuilding roster, so scheme-specific analysis would be speculative. CollegeScout would overlap with Draft's prospect evaluation lane. Three agents keep the panel tight and differentiated.
- **Why Draft leads?** The #2 and #16 picks ARE the story. Every other decision — cap allocation, roster building, QB timeline — flows from what the Jets do on draft night. Draft must establish the prospect landscape and trade value math before the other paths can be evaluated.
- **Why not PlayerRep?** No active contract negotiation in play. Hall's franchise tag is already set ($14.3M); Geno Smith's deal is signed. PlayerRep's expertise in negotiation dynamics doesn't apply here.
- **Why not Analytics?** Analytics would add value on win-probability modeling, but the core debate is strategic (QB now vs. later), not statistical. The three selected agents can handle the data-driven arguments within their lanes.

## Model Selection

Per `.squad/config/models.json`, Level 2 (The Beat) panel agents use `claude-opus-4.6`.

## Output Targets

Each panelist: 300-500 words, saved to:
- `content/articles/nyj-two-firsts-qb-decision/draft-position.md`
- `content/articles/nyj-two-firsts-qb-decision/nyj-position.md`
- `content/articles/nyj-two-firsts-qb-decision/cap-position.md`

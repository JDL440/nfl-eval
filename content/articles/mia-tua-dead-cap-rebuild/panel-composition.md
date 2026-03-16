# Panel Composition: MIA — $99 Million Ghost

**Article:** mia-tua-dead-cap-rebuild
**Depth Level:** 2 — The Beat
**Panel Size:** 3 agents (within Level 2 limit of 3-4)

## Selected Panel

| Agent | Role | Why on This Panel | Focus Lane |
|-------|------|-------------------|------------|
| **Cap** | Salary Cap Expert | Dead cap mechanics are THE story — need the definitive financial model | Cap math, dead money timeline, historical comps (Rams/Broncos/Texans) |
| **MIA** | Miami Dolphins Expert | Rebuild requires deep roster knowledge + regime evaluation | Roster audit, Hafley/Sullivan evaluation, competitive trajectory |
| **Draft** | Draft Expert | 8 picks must do the heavy lifting in a cap-constrained rebuild | Draft strategy, trade-up math, prospect fit, Day 2 value |

## Rationale

- **Why not 4 agents?** The tension is financial + organizational, not scheme-specific. Adding Offense or Defense would dilute without adding unique perspective. The 3-agent panel keeps it tight: Cap covers the money, MIA covers the football, Draft covers the rebuild tool.
- **Why Cap lead?** The $99.2M dead cap hit IS the article. It's the constraint that makes every other decision harder. Cap must establish the financial baseline before MIA and Draft can evaluate what's possible within it.
- **Why not PlayerRep?** No active negotiation to model — Tua is already cut. PlayerRep's value is in live contract negotiations, not post-mortem financial analysis.

## Model Selection

Per `.squad/config/models.json`, Level 2 panel agents use `claude-opus-4.6`.

## Output Targets

Each panelist: 300-500 words, saved to:
- `content/articles/mia-tua-dead-cap-rebuild/cap-position.md`
- `content/articles/mia-tua-dead-cap-rebuild/mia-position.md`
- `content/articles/mia-tua-dead-cap-rebuild/draft-position.md`

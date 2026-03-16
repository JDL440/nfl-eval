# Panel Composition: PHI — The Eagles' Pass-Rush Emergency and the Jalen Carter Decision

**Article:** phi-2026-offseason
**Depth Level:** 2 — The Beat
**Panel Size:** 3 agents (within Level 2 limit of 3–4)

## Selected Panel

| Agent | Role | Why on This Panel | Focus Lane |
|-------|------|-------------------|------------|
| **Cap** | Salary Cap Expert | $52M dead money + $6.4M effective space + Carter extension economics are THE constraint. Every roster decision flows through cap math. | Restructure waterfall, Carter extension vs. trade economics, 2026-2027 cap modeling, historical DT extension comps |
| **PHI** | Philadelphia Eagles Expert | Carter's on-field value, Nolan Smith projection, Ebiketie evaluation, Roseman's organizational DNA, TE room assessment | Roster audit, player evaluation, organizational context, internal development bets |
| **Defense** | Defensive Scheme Expert | Fangio's 3-4 scheme is specifically built around interior dominance. Losing Carter is a scheme-level crisis, not just a talent loss. | Scheme implications with/without Carter, EDGE replacement archetypes, draft prospect scheme fits, blitz package adjustments |

## Rationale

- **Why 3 agents, not 4?** The article's tension is a single decision (Carter) and its cascading effects on cap, scheme, and roster. Three agents cover the essential triangle: financial reality (Cap), organizational context and player evaluation (PHI), and scheme implications (Defense). A fourth agent (e.g., Draft) would overlap with PHI's prospect evaluation and Defense's scheme-fit analysis without adding a distinct analytical lane.
- **Why Cap?** The Eagles are 26th in effective cap space with $52M in dead money. Every path — extend Carter, trade Carter, sign an EDGE — requires cap engineering. Cap establishes the financial constraints that bound PHI's and Defense's recommendations.
- **Why PHI instead of a generic team expert?** This article is deeply franchise-specific. Roseman's trade history, Sirianni's coaching seat, the Fangio hire, the organizational identity — PHI brings the institutional knowledge that makes the analysis credible to Eagles fans. A generic team expert would miss the cultural context.
- **Why Defense over Offense?** The article's core crisis is defensive — the EDGE void and Carter's interior anchoring role. Offense is stable (Hurts, Brown, Smith, Barkley, elite OL). Defense brings scheme-specific expertise about how Carter's presence enables Fangio's 3-4 and what happens to the pass rush in each scenario.
- **Why not Draft?** The Eagles have 9 picks, but the draft angle (EDGE at #23, TE at #54, trade-up scenarios) is adequately covered by PHI's roster evaluation and Defense's scheme-fit analysis. A standalone Draft agent would rehash prospect profiles without the team-specific context that makes them meaningful.

## Model Selection

Per `.squad/decisions.md`, all agents use **`claude-opus-4.6`** (Joe Robinson directive, 2026-03-12).

## Output Targets

Each panelist: 300–500 words, saved to:
- `content/articles/phi-2026-offseason/cap-position.md`
- `content/articles/phi-2026-offseason/phi-position.md`
- `content/articles/phi-2026-offseason/defense-position.md`

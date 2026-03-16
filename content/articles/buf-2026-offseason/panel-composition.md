# Panel Composition: BUF — Buffalo's Last Best Window

**Article:** buf-2026-offseason
**Depth Level:** 2 — The Beat
**Panel Size:** 3 agents (within Level 2 limit of 3–4)

## Selected Panel

| Agent | Role | Why on This Panel | Focus Lane |
|-------|------|-------------------|------------|
| **Cap** | Salary Cap Expert | $11M over the cap is the constraint that shapes every decision — need precise financial modeling | Cap math, restructure waterfall, UFA replacement cost, Allen contract tail |
| **BUF** | Buffalo Bills Expert | Seven-year playoff streak + three straight divisional exits requires deep organizational context | Roster audit, UFA replaceability, McDermott evaluation, window assessment |
| **Defense** | Defensive Scheme Expert | Losing Bosa/Milano/Epenesa/White in one offseason is a scheme-level crisis, not just a talent loss | Scheme implications, replacement archetypes, positional priority, defensive identity |

## Rationale

- **Why 3 agents, not 4?** The article's tension is cap-constrained roster retooling, not a scheme deep-dive or draft evaluation. Three agents cover the essential triangle: financial reality (Cap), organizational context (BUF), and the specific positional crisis (Defense). Adding a fourth (e.g., Draft or Offense) would dilute focus without adding a distinct analytical lane — BUF and Defense can address draft-eligible replacement profiles within their own positions.
- **Why Cap?** Buffalo is $11M over the cap before doing anything. Every roster decision — which UFAs to retain, whether to cut Knox, how aggressively to restructure Allen — flows through the cap math. Cap establishes the financial baseline that constrains BUF's and Defense's recommendations.
- **Why Defense over Offense?** The article's core crisis is defensive, not offensive. Allen's production is stable (25 TD, 14 rush TD) even without a WR1 — the question is whether the defense can survive losing four starters. An Offense agent would largely echo BUF's roster evaluation; Defense brings the scheme-specific expertise that neither Cap nor BUF can replicate.
- **Why not Draft?** Buffalo has only 7 picks with no extra first-rounders — this isn't a draft-capital-rich rebuild story like Miami. The draft angle (what to do with pick 25-26) is adequately covered by BUF's roster audit and Defense's replacement archetype analysis. A standalone Draft agent would be underutilized.
- **Why not PlayerRep?** No active contract negotiation to model. Allen's deal is signed. The UFA market value projections are Cap's domain. PlayerRep adds value in live negotiation scenarios, not roster construction analysis.

## Model Selection

Per `.squad/config/models.json`, Level 2 (The Beat) panel agents use **`claude-opus-4.6`** (`models.panel_beat`).

## Output Targets

Each panelist: 300–500 words, saved to:
- `content/articles/buf-2026-offseason/cap-position.md`
- `content/articles/buf-2026-offseason/buf-position.md`
- `content/articles/buf-2026-offseason/defense-position.md`

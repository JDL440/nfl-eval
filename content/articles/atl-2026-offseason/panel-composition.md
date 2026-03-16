# Panel Composition: ATL — Two QBs, Zero Guarantees

**Article:** atl-2026-offseason
**Depth Level:** 2 — The Beat
**Panel Size:** 3 agents (within Level 2 limit of 3–4)

## Selected Panel

| Agent | Role | Why on This Panel | Focus Lane |
|-------|------|-------------------|------------|
| **ATL** | Atlanta Falcons Expert | Owns the full roster context, coaching staff knowledge, division dynamics, and 2025 season narrative. The connective tissue. | Roster audit, 2026 ceiling/floor, offseason grade, division landscape, QB room evaluation |
| **Cap** | Salary Cap Expert | The 2026→2027 cap transition is the structural backbone of this story. $17M now vs. $156M next year defines every decision. | Cap waterfall, restructure modeling, Cousins dead cap impact, 2027 projection, extension timeline for Pitts/Bijan/London |
| **Offense** | Offensive Scheme Expert | Stefanski's system is the X-factor — a run-heavy, play-action offense might be the EXACT right scheme for a team with elite RB/TE and uncertain QB play. | Stefanski scheme fit, Bijan/London/Pitts usage projections, WR2 impact, Tommy Rees evaluation, QB-masking potential |

## Rationale

- **Why 3 agents, not 4?** The article's tension is bridge-year contention vs. patience — that's a triangle of team context (ATL), financial reality (Cap), and scheme viability (Offense). Defense is strong enough (young core, Ulbrich retained) that it's not the crisis point — ATL can address defensive nuances within their roster audit. Adding a 4th agent (e.g., Defense or Draft) would dilute focus without adding a distinct lane.
- **Why ATL?** Non-negotiable for any team-specific article. ATL holds the deepest roster knowledge, coaching staff context, and division competitive landscape.
- **Why Cap?** The entire "bridge year vs. contention year" question hinges on financial mechanics. Can they create space now without destroying 2027? Cap answers this.
- **Why Offense over Defense?** The defensive identity is established (Ulbrich retained, young core in place). The offensive identity is brand-new and uncertain — Stefanski's first year, Rees's first time calling plays, two injury-risk QBs. The offense is where the article's tension lives. Can the SCHEME compensate for QB uncertainty?
- **Why not Draft?** ATL has no R1 and only 5 picks. The draft angle (what to target at #48) is important but not central enough to justify a standalone panelist. ATL can cover "what we need from the draft" within their roster audit.
- **Why not Injury?** While Penix's ACL rehab is critical, the injury assessment is binary (he's healthy by Week 1 or he's not). ATL and Offense can address the QB health variable within their scope. A standalone Injury agent would be underutilized at Depth Level 2.

## Expected Disagreements

- **Cap vs. Offense:** Cap may argue for maximum 2027 preservation (don't restructure, accept a down year), while Offense may argue the scheme can compete NOW and the team should invest in a WR2 or depth piece.
- **ATL vs. Cap:** ATL may have more optimism about the roster's talent level than the cap numbers suggest is achievable. The "8-9 was an underperformance" argument vs. "8-9 is the real talent level given the cap constraints" debate.

## Model Selection

Per `.squad/config/models.json`, Level 2 (The Beat) panel agents use **`claude-opus-4.6`** (`models.panel_beat`).

## Output Targets

Each panelist: 300–500 words, saved to:
- `content/articles/atl-2026-offseason/atl-position.md`
- `content/articles/atl-2026-offseason/cap-position.md`
- `content/articles/atl-2026-offseason/offense-position.md`

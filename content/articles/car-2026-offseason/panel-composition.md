# Panel Composition: CAR — The $165 Million Bet on Bryce Young

**Article:** car-2026-offseason
**Depth Level:** 2 — The Beat
**Panel Size:** 3 agents (within Level 2 limit of 3–4)

## Selected Panel

| Agent | Role | Why on This Panel | Focus Lane |
|-------|------|-------------------|------------|
| **CAR** | Carolina Panthers Expert | Deep roster/season knowledge — owns the Bryce Young evaluation and NFC South context | QB tape synthesis, roster audit, division window assessment, 5th-year option football implications |
| **Cap** | Salary Cap Expert | 5th-year option is a financial decision with cascading cap consequences; Phillips/Lloyd contracts create hidden complexity | Option cost modeling, real cap picture (post-Phillips/Lloyd), financial decision tree, comparable option exercises |
| **Offense** | Offensive Scheme Expert | Young's development is inseparable from scheme fit — Canales' system must be evaluated alongside the QB | Scheme-QB alignment, offensive identity analysis, McMillan usage optimization, development roadmap |

## Rationale

- **Why 3 agents, not 4?** The article's tension lives at the intersection of QB evaluation, cap mechanics, and offensive scheme. Three agents cover the essential triangle without dilution. Adding Defense would overlap with CAR's roster audit (the defensive signings are context, not the central question). Adding Draft would be premature — the draft angle is secondary to the option decision.
- **Why CAR?** This is a team-expert-led article. CAR has the deepest context on Young's 2025 season (game-by-game), the roster construction philosophy, the NFC South competitive landscape, and the organizational culture under Canales/Morgan. No other agent can synthesize "is Bryce Young the guy?" with the same granularity.
- **Why Cap?** The 5th-year option is fundamentally a cap decision. Phillips/Lloyd's contracts haven't hit OTC yet — the real cap picture requires original analysis. Cap also brings comparable data: how have other teams handled similar option deadlines for inconsistent-but-talented young QBs?
- **Why Offense over Defense?** The article's central question is about the quarterback. Offense evaluates whether the system maximizes or limits Young — scheme fit IS the development question. The defensive investment (Phillips/Lloyd) is important context but CAR can cover it in their roster audit. A standalone Defense agent would overlap with CAR's existing knowledge.
- **Why not Draft?** The draft is secondary to the option decision. Pick #19 matters, but the angle is "should you commit to Young" not "who to draft." CAR and Offense can address draft-relevant gaps (WR3, CB2) within their analyses.

## Model Selection

Per `.squad/config/models.json`, Level 2 (The Beat) panel agents use **`claude-opus-4.6`** (`models.panel_beat`).

## Output Targets

Each panelist: 300–500 words, saved to:
- `content/articles/car-2026-offseason/car-position.md`
- `content/articles/car-2026-offseason/cap-position.md`
- `content/articles/car-2026-offseason/offense-position.md`

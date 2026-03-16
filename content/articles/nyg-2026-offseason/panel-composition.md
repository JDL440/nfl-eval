# Panel Composition: NYG — Ravens South or Dart's Team?

**Article:** nyg-2026-offseason
**Depth Level:** 2 — The Beat
**Panel Size:** 4 agents (within Level 2 limit of 3-4)

## Selected Panel

| Agent | Role | Why on This Panel | Focus Lane |
|-------|------|-------------------|------------|
| **NYG** | New York Giants Expert | Franchise context, Dart's trajectory, NFC East arms race, organizational direction under Harbaugh | Dart's Year 2 readiness, roster window timeline (2026 bridge vs. 2027 contention), NFC East competitive landscape, Harbaugh's culture import |
| **Cap** | Salary Cap Expert | The $27M→$110M+ cap swing from 2026→2027 is THE financial variable — it determines whether patience or aggression is correct | 2026 effective cap reality, #5 pick slot value, Dart's rookie deal window math, 2027 spending plan implications |
| **Draft** | Draft Expert | The #5 pick is the article's fulcrum — need rigorous Styles vs. Tate prospect evaluation and trade-down analysis | Sonny Styles vs. Carnell Tate as prospects, positional value at #5, trade-down scenarios and partner identification, Day 2 WR/LB alternatives |
| **Defense** | Defensive Scheme Expert | Harbaugh's defensive identity is half the debate — need an honest assessment of whether the defense needs a top-5 investment after the FA overhaul | Post-FA secondary strength (Adebo/Holland/Newsome), Burns/Carter/Lawrence front seven evaluation, where Styles fits (or doesn't), diminishing returns argument |

## Rationale

- **Why 4 agents?** This is a genuine 4-lane debate. The franchise identity question requires team context (NYG), financial framing (Cap), prospect evaluation (Draft), and defensive scheme analysis (Defense). Dropping any one would leave a critical gap — e.g., without Defense, we can't honestly evaluate whether Styles is needed or redundant after the FA rebuild.
- **Why NYG leads?** As team expert, NYG provides the connective tissue — how does Harbaugh's philosophy intersect with Dart's development timeline and the NFC East's trajectory? NYG frames the strategic question that Cap, Draft, and Defense answer from their domains.
- **Why not Offense?** The offensive scheme under Nagy is still forming. The offensive argument (arm Dart now) is best made by NYG (who knows the roster) and Draft (who evaluates Tate). A dedicated Offense agent would overlap without adding clarity on a scheme that hasn't been installed yet.
- **Why not CollegeScout?** Draft already covers prospect evaluation at this depth level. CollegeScout would be valuable at Depth 3 for film breakdowns, but at Level 2, Draft's analysis is sufficient.

## Model Selection

Per `.squad/config/models.json`, Level 2 (The Beat) panel agents use `claude-opus-4.6`.

## Output Targets

Each panelist: 400-600 words, saved to:
- `content/articles/nyg-2026-offseason/nyg-position.md`
- `content/articles/nyg-2026-offseason/cap-position.md`
- `content/articles/nyg-2026-offseason/draft-position.md`
- `content/articles/nyg-2026-offseason/defense-position.md`

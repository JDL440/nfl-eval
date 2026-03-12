# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Cross-team evaluation | Lead | "Compare the Bills and Chiefs rosters", "Who won the offseason?", multi-team trade analysis |
| Salary cap analysis | Cap | Cap space, contract breakdowns, restructure scenarios, dead money, tag implications |
| Injury evaluation | Injury | Player injury history, recovery timelines, medical risk assessment |
| Draft analysis | Draft | Prospect evaluation, mock drafts, draft strategy, pick value, trade-up math |
| Offensive scheme fit | Offense | "Does Player X fit a wide-zone scheme?", offensive system analysis, personnel packages |
| Defensive scheme fit | Defense | "Can this CB play man?", defensive front analysis, coverage scheme evaluation |
| Special teams value | SpecialTeams | Kicker/punter evaluation, return game, ST roster spots, rule impact |
| Team-specific questions | {TEAM} | "What do the Bills need?", "Show me the Eagles roster", team cap situation |
| Advanced analytics, stats, metrics | Analytics | EPA, PFF grades, player comps, efficiency rankings, contract value |
| College prospect evaluation | CollegeScout | Prospect scouting, measurables, film evaluation, college production |
| News, rumors, transactions | Media | Breaking news, rumor tracking, transaction monitoring, reporter intel |
| Session logging | Scribe | Automatic - never needs routing |
| Work monitoring | Ralph | Backlog, issue tracking, pipeline management |

## Multi-Agent Evaluation Routing

Complex evaluations require multiple agents. Lead orchestrates these.

| Scenario | Agents Involved |
|----------|----------------|
| "Should Team X sign Player Y?" | Lead + {Team X agent} + Cap + relevant scheme expert + Injury (if injury concern) |
| "Evaluate this trade" | Lead + both team agents + Cap (cap implications) |
| "Who should Team X draft at pick N?" | Lead + {Team X agent} + Draft + relevant scheme expert(s) |
| "Rate this free agent class by position" | Lead + Cap (market values) + relevant scheme expert |
| "Offseason grade for Team X" | Lead + {Team X agent} + Cap + all relevant specialists |

## Rumor Routing

| Signal | Action |
|--------|--------|
| Confirmed transaction | Route to team agent(s) involved - update knowledge as CONFIRMED |
| Reported but unofficial | Route to team agent(s) - flag as RUMOR with source and confidence level |
| Speculation / mock scenario | Route to Lead for scenario analysis - tag as SCENARIO |

## Confidence Levels for Rumors

| Level | Meaning | Sources |
|-------|---------|---------|
| Likely | Multiple reliable reporters confirming | Schefter, Rapoport, Pelissero, team beat writers |
| Possible | Single reporter or indirect signals | One insider, agent leaks, workout visits |
| Speculative | Fan/media speculation, mock scenarios | Social media, opinion pieces, "what if" analysis |

## Rules

1. **Team agents advocate for their team** - they evaluate moves from their team's perspective.
2. **Specialists provide objective analysis** - cap mechanics, injury risk, scheme fit are factual, not partisan.
3. **Lead synthesizes** - when team interest and specialist analysis conflict, Lead presents both perspectives.
4. **Eager by default** - spawn all agents who could usefully contribute, including anticipatory work.
5. **Scribe always runs** after substantial work, always as background.
6. **Quick facts -> coordinator answers directly.** Don't spawn for "who is the Bills QB?"
7. **"Team, ..." -> fan-out.** Spawn all relevant agents in parallel.
8. **Cross-team trades always involve both team agents** - each advocates for their side.

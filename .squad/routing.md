# Routing Rules — NFL Lab

## Primary Routing

| Signal / Keywords | Route To | Notes |
|-------------------|----------|-------|
| TypeScript, Node.js, Hono, implementation, code review, vitest, testing, bug fix, refactor | Code | Core implementation work |
| NFL data, nflverse, analytics, statistics, Python, data pipeline, queries | Data | Data engineering and analytics |
| Substack, publish, social media, Twitter/X, distribution, Markdown, content | Publisher | Content distribution |
| Documentation, research, analysis, report, knowledge, tech research | Research | Docs and research |
| GitHub Actions, CI/CD, MCP server, infrastructure, workflows, .github/ | DevOps | Build and deploy |
| Dashboard, UI, HTMX, SSE, frontend, views, user experience, CSS | UX | Dashboard and frontend |
| Architecture, triage, cross-functional, design decision, scope | Lead | Coordination and architecture |
| Issue queue, backlog, board, monitoring, heartbeat | Ralph | Work queue management |

## Multi-Domain Routing

| Pattern | Agents | Notes |
|---------|--------|-------|
| New feature (full-stack) | Lead (architecture) + Code (impl) + UX (UI) | Lead decides structure first |
| Pipeline changes | Code (runtime) + Data (analytics) | May also need Publisher if output changes |
| Dashboard feature | UX (UI) + Code (backend) | UX leads, Code supports API |
| New MCP tool | DevOps (infra) + Code (integration) | DevOps leads setup |
| Publishing workflow | Publisher (flow) + Code (integration) | Publisher leads |
| Data + visualization | Data (queries) + UX (charts) | Data leads |

## Review Routing

| Artifact Type | Primary Reviewer | Notes |
|---------------|-----------------|-------|
| TypeScript code | Lead | Architecture + correctness |
| Data queries / analytics | Data | Domain accuracy |
| Dashboard UI | UX | UX quality |
| CI/CD workflows | DevOps | Infrastructure correctness |
| Published content | Publisher | Content quality |

## Escalation

- Ambiguous → Lead triages
- Cross-cutting (3+ domains) → Lead coordinates, spawns relevant agents
- User-directed ("Code, fix this") → Route to named agent directly

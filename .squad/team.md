# Squad Team — NFL Lab (nfl-eval)

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Description:** 8-stage article pipeline (idea → panel discussion → draft → edit → publish), 47 article pipeline agents, Hono + HTMX editorial dashboard (port 3456), multi-provider LLM gateway (Copilot, Anthropic, OpenAI, Gemini, Ollama), MCP tools for Substack/image gen/nflverse, Substack publication + Twitter/X promotion.

## Members

| Name | Role | Scope | Badge |
|------|------|-------|-------|
| Lead | Lead | Triage, coordination, architecture decisions, cross-functional work | 🏗️ Lead |
| Code | Core Dev | TypeScript/Node.js implementation, code reviews, testing (vitest), Hono framework | 🔧 Dev |
| Data | Data Engineer | NFL analytics, nflverse Python queries, data pipeline, statistical analysis | 📊 Data |
| Publisher | Publisher | Substack publishing, social media (Twitter/X), content distribution, Markdown→HTML | 📝 Publisher |
| Research | Researcher | Documentation, analysis reports, tech research, knowledge management | 🔍 Research |
| DevOps | DevOps | GitHub Actions, CI/CD, MCP server infrastructure, .github/extensions/ | ⚙️ DevOps |
| UX | UX Engineer | Dashboard UI, HTMX views, SSE, user experience, frontend | ⚛️ UX |
| Ralph | Work Monitor | Issue queue scanning, project board automation, heartbeat | 🔄 Monitor |
| Scribe | Session Logger | Memory, decisions, session logs, cross-agent context sharing | 📋 Scribe |
| Fantasy | Fantasy Football Expert | Fantasy football analysis, rankings, dynasty/redraft evaluation, scoring impact | 🏈 Fantasy |

## Human Members

| Name | Role | Notes |
|------|------|-------|
| 👤 Joe Robinson | Product Owner / Tech Lead | Project owner, final decision authority |

## Copilot Coding Agent

<!-- copilot-auto-assign: true -->

| Name | Role | Notes |
|------|------|-------|
| 🤖 @copilot | Coding Agent | Autonomous issue pickup via `copilot-swe-agent*` label, creates `copilot/*` branches |

### Capability Profile

| Category | Rating | Notes |
|----------|--------|-------|
| Single-file bug fixes | 🟢 Strong | Well-scoped, clear acceptance criteria |
| Test writing | 🟢 Strong | Adding tests for existing code |
| Small feature additions | 🟢 Strong | Self-contained features with clear specs |
| Documentation updates | 🟢 Strong | README, inline docs, comment cleanup |
| Multi-file refactors | 🟡 Moderate | Needs clear instructions, may miss cross-file impacts |
| Architecture changes | 🔴 Avoid | Requires team context and design decisions |
| Pipeline agent charter edits | 🔴 Avoid | Domain-specific knowledge required |
| Dashboard UI work | 🟡 Moderate | HTMX patterns need explicit guidance |

## Issue Source

- **Repository:** JDL440/nfl-eval
- **Connected:** 2025-07-18
- **Filters:** Labels `squad`, `squad:*`

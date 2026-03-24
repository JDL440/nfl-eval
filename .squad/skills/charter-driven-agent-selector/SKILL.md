---
name: Charter-Driven Agent Selector
domain: dashboard-ui
confidence: high
tools: [view, rg, vitest]
---

# Charter-Driven Agent Selector

## When to Use

- A dashboard form needs to render a list of selectable agents or roles without hardcoding the visible options in the view.
- You need to trace where an agent-picker gets its options and whether the list comes from runtime charter files or frontend constants.
- You want to keep selection UX lightweight: server-rendered HTML plus tiny inline client-side state.

## Pattern

1. Build the option list in the route, not the template:
   - source it from `AgentRunner.listAgents()`
   - filter out categories that should never appear in that picker
   - pass the final string array into the view renderer
2. Keep the view simple:
   - render one button per agent with a stable `data-agent`
   - store selected values in a hidden input and mirror them in removable chips
3. Submit a plain array in the fetch payload:
   - client-side `Set` manages selected agents
   - POST body includes `pinnedAgents: Array.from(pinnedAgents)`
4. Style the picker with narrowly scoped class names so directory/card views do not override form-picker layouts.

## Repo Map

- Route seam: `src/dashboard/server.ts` GET `/ideas/new`
- Runtime source: `src/agents/runner.ts` → `listAgents()`
- Data root: `config.chartersDir` from `src/config/index.ts`
- Seeded defaults: `src/config/defaults/charters/nfl/`
- View + inline state: `src/dashboard/views/new-idea.ts`
- Styles: `src/dashboard/public/styles.css`

## Heuristics

Ask these questions in order:

1. **Is the list live from charters or duplicated in the UI?**
2. **Are production/system agents filtered server-side before render?**
3. **Is the rendered order deterministic, or does it depend on `readdirSync` order?**
4. **Are selector CSS classes scoped enough to avoid collisions with other agent-list pages?**
5. **Do tests cover the actual filtered/rendered options, not just page existence?**

## Current Example

On `/ideas/new`, `src/dashboard/server.ts` builds `expertAgents` from `runner.listAgents()`, excludes PROD roles and team abbreviations, and passes the array into `renderNewIdeaPage()`. The view renders `.agent-badge` buttons, tracks selected names in a `Set`, mirrors them into `#selected-agents`, and submits `pinnedAgents` in the `/api/ideas` JSON body.

The same page also has a separate team-like selector driven by the static `NFL_TEAMS` array in `src/dashboard/views/new-idea.ts`. For league-wide coverage, the UI key is `NFL` but the runtime agent/charter key is lowercase `nfl`, so any team-style filtering must keep both forms aligned or the NFL-wide agent will drift into the expert picker.

## Watch-outs

- No explicit sort means the visible option order may drift with filesystem ordering.
- Reusing a generic class like `.agent-grid` across unrelated pages can cause late CSS rules to change picker layout unexpectedly.
- Without targeted tests for the filtered list, a charter rename or filter change can silently alter the UI.

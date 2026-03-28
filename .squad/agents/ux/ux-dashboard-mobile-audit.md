# 1) Top-line assessment

The dashboard behaves like one desktop workstation squeezed onto a phone, not like a mobile system. The core failures are shared across the shell (`src/dashboard/views/layout.ts`), shared CSS (`src/dashboard/public/styles.css`), and HTMX/SSE fragment seams, so the minimum viable fix is a shared mobile shell + shared responsive data/action patterns, then a short pass through the highest-traffic views.

# 2) 4-8 system-level findings, each with evidence

## Finding 1 — The shared shell has no real mobile navigation pattern

**Why it matters in human terms:** every dashboard page starts with a header that consumes too much horizontal space before the operator can do anything useful.

**Evidence**
- `src/dashboard/views/layout.ts:44-55` renders one `header-nav` row with six controls plus the env badge: Agents, Memory, Runs, Config, New Idea, theme toggle, and `.env-badge`.
- `src/dashboard/public/styles.css:90-133` styles `.site-header`, `.header-inner`, `.btn-header`, and `.env-badge`, but there is **no `.header-nav` rule at all** and no header breakpoint logic.
- `src/dashboard/public/styles.css:99-106` keeps `.header-inner` at a fixed `height: 56px` with `justify-content: space-between`.
- `src/dashboard/public/styles.css:827-835` is the main mobile block, and it does not touch the header.

**System effect**
- The shell stays desktop-first on every route.
- The first interaction zone is crowded before page content even begins.
- Any page-level mobile fix still lands inside a cramped, unchanged header.

## Finding 2 — The layout system collapses columns, but not hierarchy

**Why it matters in human terms:** the UI stacks on phones, but it does not become easier to use; it just becomes taller.

**Evidence**
- `src/dashboard/public/styles.css:143-147` defines `.dashboard-grid` as a two-column desktop grid.
- `src/dashboard/public/styles.css:479-483` defines `.detail-grid` as `2fr 1fr`.
- `src/dashboard/public/styles.css:827-835` only changes `.dashboard-grid` and `.detail-grid` to one column at `768px`; it does not reprioritize actions, summaries, or diagnostics.
- `src/dashboard/views/article.ts:193-215` places actions, artifacts, usage, stage runs, and advanced diagnostics into the same desktop-derived order.
- `src/dashboard/views/publish.ts:155-178` uses the same `.detail-grid` split, putting preview on one side and workflow/promotions on the other.

**System effect**
- Critical mobile questions (“what am I looking at?” and “what should I do next?”) are not answered faster on phone.
- The dashboard becomes long-scroll operational UI instead of mobile-first workflow UI.

## Finding 3 — Shared action surfaces are dense, small, and inconsistent

**Why it matters in human terms:** the dashboard asks for precise tapping when it should support quick, thumb-friendly actions.

**Evidence**
- `src/dashboard/public/styles.css:123-132` gives `.btn-header` desktop-sized padding.
- `src/dashboard/public/styles.css:569-570` defines `.action-bar` as a wrapping flex row, not a mobile action stack.
- `src/dashboard/public/styles.css:1544-1561` keeps `.composer-meta` and `.composer-actions` as horizontal desktop patterns.
- `src/dashboard/views/article.ts:597-615`, `644-665`, and `690-717` put primary, secondary, retry, and send-back controls into the same `.action-bar`.
- `src/dashboard/views/publish.ts:281-290`, `355-363`, `388-396`, and `428-438` adds more stacked/horizontal action groups without a shared mobile action contract.
- `src/dashboard/views/home.ts:36-70` uses a dense `.filter-bar` plus an inline checkbox label with inline styles.

**System effect**
- Primary and secondary actions compete visually.
- Buttons remain small even when they wrap.
- Operators get “all controls at once” instead of a clear mobile action hierarchy.

## Finding 4 — Operational data surfaces still assume tables and horizontal width

**Why it matters in human terms:** the dashboard’s monitoring and admin pages are readable on desktop but force sideways scanning on phones.

**Evidence**
- `src/dashboard/views/runs.ts:177-196` renders an 8-column `.runs-table`.
- `src/dashboard/public/styles.css:1660-1675` gives `.runs-table-wrap` only `overflow-x: auto`; there is no mobile card/list treatment.
- `src/dashboard/views/memory.ts:141-157` renders a multi-column `.memory-table`.
- `src/dashboard/public/styles.css:2248-2303` only shrinks `.memory-table` font size and content width on mobile; it does not change the presentation model.
- `src/dashboard/views/config.ts:36-48`, `64-83`, `101-127` uses `.artifact-table` repeatedly for routing and env status.
- `src/dashboard/public/styles.css:1189-1211` styles `.artifact-table` as a normal table with no mobile transform.

**System effect**
- `/runs`, `/memory`, and `/config` remain desktop data pages with phone-sized text.
- Horizontal overflow becomes the default mobile strategy instead of the fallback.

## Finding 5 — HTMX/SSE fragments preserve desktop markup, so mobile fixes cannot live only at page level

**Why it matters in human terms:** real-time and partial updates will keep reintroducing desktop-shaped UI unless the fragment contract itself is mobile-aware.

**Evidence**
- `src/dashboard/views/article.ts:183-214` swaps `#live-meta`, `#live-artifacts`, and `.detail-sidebar` independently.
- `src/dashboard/public/styles.css:1999-2003` explicitly styles those live-swapped regions for HTMX request state.
- `src/dashboard/views/runs.ts:98-111`, `165-168`, and `213-214` updates `#runs-results` via HTMX, but `renderRunsTable()` still returns the same wide table.
- `src/dashboard/views/memory.ts:213-217`, `232-242`, `249-250`, and `257-261` uses HTMX for filter and action refreshes, but `renderMemoryTable()` still returns the same table.
- `src/dashboard/views/publish.ts:261-269`, `357-360`, `390-393` swaps workflow/composer regions independently.

**System effect**
- A page-only wrapper cannot solve mobile on its own.
- Shared CSS and fragment markup must carry the mobile pattern, or refreshed content will fall back to desktop behavior.

## Finding 6 — The dashboard has selector collisions and one-off layout decisions instead of a stable mobile component system

**Why it matters in human terms:** new dashboard work will keep recreating the same mobile regressions unless shared components are made explicit.

**Evidence**
- `src/dashboard/public/styles.css:1010-1015` defines `.agent-grid` for the New Idea chip picker as a flex wrap row.
- `src/dashboard/public/styles.css:2009` redefines `.agent-grid` for the Agents directory as a card grid.
- `src/dashboard/views/new-idea.ts:188-190` and `src/dashboard/views/agents.ts:114-126` both rely on `.agent-grid` for different meanings.
- `src/dashboard/views/publish.ts:158-163` and `281-290` uses inline styles for layout behavior inside shared action surfaces.
- `src/dashboard/views/login.ts:24-28` also relies on inline styles for spacing/layout rather than shared shell/form primitives.

**System effect**
- Shared mobile CSS changes are risky because selectors already mean different things on different pages.
- The system lacks a reliable vocabulary for “mobile action group,” “mobile data card,” and “mobile shell header.”

## Finding 7 — Current tests protect workflow copy and route behavior, not mobile system behavior

**Why it matters in human terms:** the dashboard can continue shipping mobile regressions while tests stay green.

**Evidence**
- `tests/dashboard/server.test.ts`, `publish.test.ts`, `runs.test.ts`, `new-idea.test.ts`, and `wave2.test.ts` assert content/workflow behavior, but repo searches show no assertions around mobile classes, responsive shells, overflow hooks, or mobile-specific fragment structure.
- Existing route assertions such as `tests/dashboard/server.test.ts:158` and `:879-881` confirm page copy, not shell/layout behavior.

**System effect**
- There is no automated backstop for shared mobile regressions.
- Shell/nav/data-surface fixes can drift unless Code adds structural assertions for the new responsive contract.

# 3) Minimum system change set

1. **Add one shared mobile shell contract**
   - Give `layout.ts` an explicit mobile nav pattern for `.header-nav` instead of relying on the desktop row.
   - Reduce shell density first: compact header, smaller chrome, clear page-header stack.

2. **Create three shared responsive primitives in `styles.css`**
   - **Mobile action stack** for `.action-bar`, composer actions, filter actions, and detail-page toolbars.
   - **Mobile data surface** for `.runs-table`, `.memory-table`, and `.artifact-table` so operational tables become readable stacked rows/cards on narrow screens.
   - **Mobile secondary-panel pattern** so sidebar diagnostics, advanced sections, and low-frequency controls collapse behind disclosures instead of taking full vertical priority.

3. **Scope overloaded selectors before adding more mobile rules**
   - Split the reused `.agent-grid` meaning between New Idea and Agents.
   - Remove layout-critical inline styles in shared action/header areas and replace them with named classes.

4. **Make HTMX/SSE fragment outputs honor the same mobile primitives**
   - Apply the same named classes inside `renderRunsTable()`, `renderMemoryTable()`, publish workflow fragments, and live article fragments so refreshed content stays mobile-safe.

5. **Add lightweight structural tests for the mobile contract**
   - Assert the shell exposes mobile-nav hooks.
   - Assert data fragments include the classes/attributes needed for the mobile presentation model.
   - Assert shared action groups use the new stackable primitives.

# 4) UX vs Code implementation sequence

## UX-owned sequence

1. **Lock the mobile system contract**
   - Define the shared shell behavior for `.site-header`, `.header-inner`, `.header-nav`, `.content`, and page-header spacing.
   - Define the mobile action, data-surface, and secondary-panel patterns once.

2. **Choose the minimum responsive behavior for each shared surface**
   - Header/nav: compact row + disclosure pattern.
   - Actions: primary-first full-width stack on phone.
   - Data surfaces: stacked cards/rows for operational tables; intentional horizontal scroll only for artifact tabs/timelines.
   - Secondary regions: collapse diagnostics/advanced panels by default on phone.

3. **Hand Code a small selector map instead of page mockups for every route**
   - Shared selectors first.
   - Then only the page-specific exceptions: article detail, publish/preview, New Idea selector density.

## Code-owned sequence

1. **Implement the shared shell first**
   - Update `src/dashboard/views/layout.ts`.
   - Add the shared responsive shell rules in `src/dashboard/public/styles.css`.

2. **Implement shared primitives second**
   - Action-stack rules.
   - Data-surface/card rules.
   - Secondary-panel/disclosure rules.

3. **Apply the primitives to the highest-value pages**
   - `src/dashboard/views/article.ts` and `publish.ts` first.
   - Then `runs.ts`, `memory.ts`, and `config.ts`.
   - Then `home.ts`, `new-idea.ts`, `agents.ts`, and `login.ts`.

4. **Update fragment seams**
   - Ensure HTMX/SSE-rendered fragments use the same named classes and mobile-safe structure.

5. **Add regression coverage**
   - Extend the dashboard test suite with structural assertions for shell hooks, fragment hooks, and responsive data/action markup.

# 5) Note what you appended/created under .squad

- **Created:** `.squad/agents/ux/ux-dashboard-mobile-audit.md`
- **Created:** `.squad/decisions/inbox/ux-dashboard-mobile-audit.md`
- **Appended:** `.squad/agents/ux/history.md` under `## Learnings`
- **Updated:** `.squad/skills/mobile-first-dashboard-shell/SKILL.md` with dashboard-specific guidance for shared mobile shell, action groups, data surfaces, and HTMX/SSE fragment behavior

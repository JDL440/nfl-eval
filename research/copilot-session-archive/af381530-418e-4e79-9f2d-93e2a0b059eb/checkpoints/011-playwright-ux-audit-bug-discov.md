<overview>
Joe Robinson is building nfl-lab — a Django 5.2/Python/Celery/Redis control plane for NFL analysis and AI-powered article-generation workflows. This session focused on: (1) resuming Ralph's work loop after a prior session ended, spawning Saul to review/merge open PRs #8 and #10, and (2) using playwright-cli to walk through the running app at localhost:8000 and audit the UX for bugs. Four distinct bugs were discovered during the walkthrough, one of which (AI generation falling back to template library) is a root-cause infrastructure issue.
</overview>

<history>
1. **User asked for a status report**
   - Checked GitHub: 2 open PRs (#8 panel composition+published, #10 article detail+promote controls), 2 open issues (#7 team dropdown, #9 Substack research)
   - agent-4 (Rusty) completed: PR #8 created on branch `squad/2-panel-composition-6-published-archive`
   - agent-5 (Linus) completed: PR #10 created on branch `squad/1-3-4-5-pipeline-ux-promote-controls`
   - All 16 SQL todos remain marked done from prior session

2. **User said "spawn saul"**
   - Read Saul's charter from `.squad/agents/saul/charter.md`
   - Spawned agent-6 (Saul) as background agent to review PRs #8 and #10
   - Saul instructed to: checkout each branch, run `manage.py check`, patch minor issues, squash-merge with `--delete-branch`, close linked issues

3. **User asked to use playwright-cli to walk through the app and report failures**
   - Loaded playwright-cli skill
   - Verified server running at localhost:8000 (HTTP 200)
   - Opened browser (msedge, default), navigated to `/ideas/`
   - Took snapshots and screenshots of each major page
   - Walked: Ideas → Add Idea form → Generate Ideas → Pipeline → Article Run Detail → Panel Discussion → Article Writing → Editor Review → Published → `/admin/experts/` → Panel Composition

4. **Bug discovered: `/admin/experts/` URL conflict**
   - Navigating to `/admin/experts/` redirected to Django admin login
   - Root cause: `config/urls.py` has `path("admin/", admin.site.urls)` BEFORE `path("", include("apps.experts.urls"))`, so Django's admin middleware intercepts the URL

5. **Bug discovered: Stats counter renders "1111111" instead of a count**
   - After generating 5 ideas, page showed "Total ideas: 110 | Draft: 1111111"
   - Root cause in `idea_list.html` line 11-16: template uses `{% for group %}{{ group.ideas|length }}{% endfor %}` which concatenates strings, not sums integers

6. **Bug discovered: Team dropdown empty in Add Idea and Generate Ideas forms**
   - Both dropdowns show only the placeholder option ("— No team —" / "— Any Team —")
   - View passes `context['teams'] = ExpertTeam.objects.filter(is_active=True)` and there ARE 2 active teams in DB
   - Template has correct `{% for team in teams %}` loop
   - Playwright snapshot confirms only 1 option renders — likely a server-not-restarted or worktree/main mismatch issue

7. **Bug discovered: AI generation using template library instead of real AI**
   - User noted "Generated 2 idea(s) via template library" on prior run
   - Confirmed: `python manage.py shell` shows `PROVIDER: ` (empty) and `TOKEN: MISSING`
   - Root cause: `python-dotenv` is NOT in requirements, and neither `manage.py` nor `dev.py` loads the `.env` file
   - The `.env` file exists with `GITHUB_TOKEN`, `COPILOT_PROVIDER_CLASS`, and model settings, but they're never read by Django

8. **User asked to also open an issue for the AI generation failure**
   - Not yet done — session compacted before filing
</history>

<work_done>
Files examined (no edits made yet — this was an audit session):
- `config/urls.py` — URL ordering bug identified (admin before experts)
- `templates/dashboard/idea_list.html` — Stats rendering bug identified (lines 11-16)
- `apps/dashboard/views.py` — IdeaListView confirmed correct; GenerateIdeasView confirmed; AI fallback logic confirmed
- `apps/providers/registry.py` — Confirmed fallback to MockProvider when env not loaded
- `apps/providers/copilot_provider.py` — Uses `os.getenv("GITHUB_TOKEN")`, confirmed it's unset at runtime
- `config/settings/base.py` — No dotenv loading, uses `os.getenv()` directly
- `config/settings/dev.py` — Just `from .base import *`, no dotenv

Work completed this session:
- [x] Status report delivered
- [x] Saul spawned (agent-6) to review PRs #8 and #10
- [x] Playwright walkthrough of entire app
- [x] 4 bugs identified and documented
- [ ] Saul's review result not yet collected (still running when compaction occurred)
- [ ] GitHub issues not yet filed for the 4 new bugs
- [ ] Fixes not yet implemented

**Current known bugs:**

| # | Bug | Severity | Root Cause |
|---|-----|----------|------------|
| A | `/admin/experts/` → Django admin login | High | URL ordering in config/urls.py |
| B | Stats counter shows "1111111" | Medium | Template string concat in idea_list.html lines 11-16 |
| C | Team dropdowns empty on Ideas page | Medium | Possibly worktree/server mismatch — needs verification |
| D | AI generation falls back to template library | High | `python-dotenv` not installed; `.env` never loaded |
</work_done>

<technical_details>
- **Worktree setup**: Working in `C:\github\worktrees\uxwork` (worktree) while main checkout is `C:\github\nfl-lab`. Server at localhost:8000 is running from the main checkout. Playwright artifacts save to `C:\github\worktrees\uxwork\.playwright-cli\` (CWD of shell).

- **URL conflict**: Django URL resolution is first-match. `path("admin/", ...)` in `config/urls.py` line 15 intercepts `/admin/experts/` before the experts app's `path("admin/experts/", ...)` (line 18 via include). Fix options: (a) rename expert URLs to `/experts/` prefix, or (b) move experts include before admin. Option (a) is safer and cleaner.

- **Stats template bug**: Django templates don't support integer addition with `{% with count=0 %}` — you can't increment a variable. The `{{ group.ideas|length }}` calls just concatenate their text output. Fix: pass computed counts from the view's `get_context_data` as integers in the context dict.

- **AI provider chain**: `get_default_provider()` reads `settings.COPILOT_PROVIDER_CLASS`. Settings reads `os.getenv("COPILOT_PROVIDER_CLASS", "")`. Without dotenv, this is always empty → falls back to `MockProvider` → `_generate_ideas_via_ai()` returns `None` → stub used. Fix: add `python-dotenv` to requirements + load in `manage.py` or `settings/dev.py`.

- **`COPILOT_DEFAULT_MODEL=gpt-5.4`**: Joe set this in `.env`. Note: this model name needs to be verified against GitHub Models API catalog — "gpt-5.4" may not be a valid model name.

- **Panel Composition chicken-and-egg**: `/articles/<uuid>/panel/` requires an ArticleRun to exist. For articles with no run, the page just says "No run exists" and links to the run page. The run page also has no "Start" button. This is a UX gap but not a critical bug.

- **Playwright on Windows**: Chrome not installed, falls back to msedge (default). Snapshot files save to CWD of the shell, which is `C:\github\worktrees\uxwork\.playwright-cli\`. Screenshots saved to same dir with custom `--filename` go to CWD root.

- **Template team dropdown**: Despite view passing `context['teams']` with 2 active teams, playwright snapshot shows only placeholder option. Most likely the server (main checkout, `C:\github\nfl-lab`) is running on an older commit that predates the `context['teams']` addition, OR there's a branch mismatch. Needs re-verification after server restart.

- **Saul's merge approach**: `gh pr merge --squash --delete-branch`. Joe never reviews PRs. Saul is the final gate.

- **Issue #9 (Substack)**: Basher assigned, not started. Research doc target: `docs/publishing-research.md`.
</technical_details>

<important_files>
- `config/urls.py`
  - URL routing root — has the ordering bug causing `/admin/experts/` to 404
  - Line 15: `path("admin/", admin.site.urls)` — must come AFTER experts, or experts must be renamed
  - Line 18: `path("", include("apps.experts.urls"))` — experts routes

- `templates/dashboard/idea_list.html`
  - Ideas page template — has stats rendering bug
  - Lines 11-16: broken stat counters using string-concatenating template loops
  - Lines 37-43: team dropdown (uses `{% for team in teams %}` — correct if context is right)
  - Lines 48-65: Generate Ideas form

- `apps/dashboard/views.py`
  - All dashboard views: IdeaListView, GenerateIdeasView, ArticleRunView, etc.
  - Line 101: `context['teams'] = ExpertTeam.objects.filter(is_active=True)` — teams ARE passed
  - Lines 153-214: `_generate_ideas_via_ai()` — checks for MockProvider and skips AI if found
  - Lines 247-266: `GenerateIdeasView.post()` — AI fallback logic

- `apps/providers/copilot_provider.py`
  - GitHub Models API integration
  - Line 51: `return os.getenv("GITHUB_TOKEN") or getattr(settings, "GITHUB_TOKEN", None)` — needs env loaded
  - Line 53-54: `is_configured()` just checks if token is set

- `apps/providers/registry.py`
  - `get_default_provider()` reads `settings.COPILOT_PROVIDER_CLASS` (line 55)
  - Falls back to MockProvider on any config failure (lines 22-47)

- `config/settings/base.py`
  - Line 1-2: Only `import os` / `from pathlib import Path` — NO dotenv loading
  - Uses `os.getenv()` throughout — works only if env vars set in OS environment

- `.env`
  - Has `GITHUB_TOKEN`, `COPILOT_PROVIDER_CLASS=apps.providers.copilot_provider.CopilotProvider`, `COPILOT_DEFAULT_MODEL=gpt-5.4`, `COPILOT_REASONING_EFFORT=medium`
  - Never loaded — root cause of AI failure

- `apps/experts/urls.py`
  - Lines 6-9: All routes prefixed with `admin/experts/` — conflicts with Django admin

- `.squad/agents/saul/charter.md`
  - Saul's reviewer role — squash-merge authority, no-merge rules
</important_files>

<next_steps>
Immediate — collect Saul's result:
- Read agent-6 (Saul) result — check if PRs #8 and #10 were merged and issues #1-#6 closed

File GitHub issues for new bugs found in playwright audit:
- Issue: `/admin/experts/` URL conflict → Django admin login (fix: rename to `/experts/` prefix)
- Issue: Stats counter string concat bug in idea_list.html
- Issue: Team dropdowns empty on Ideas page (verify cause first)
- Issue: AI generation not working — `python-dotenv` not installed, `.env` not loaded

Fix the critical AI bug (python-dotenv):
1. Add `python-dotenv` to `requirements/base.txt`
2. Add dotenv loading to `manage.py`: `from dotenv import load_dotenv; load_dotenv()`
3. Restart the Django dev server
4. Verify AI generation works end-to-end

Fix the URL conflict:
- Change `apps/experts/urls.py` to use `experts/` prefix instead of `admin/experts/`
- Update `base.html` nav link from `/admin/experts/` to `/experts/`

Fix stats counter:
- Move status counts into `get_context_data()` as a dict
- Update `idea_list.html` to render from context integers instead of template loops

Verify team dropdown (after server restart):
- If it was a stale server issue, may self-resolve
- If not, investigate why `context['teams']` isn't rendering

Continuing Ralph loop:
- After Saul merges #8 and #10, issues #1-#6 should close
- Remaining open: #7 (team dropdown), #9 (Substack), + new bugs above
</next_steps>
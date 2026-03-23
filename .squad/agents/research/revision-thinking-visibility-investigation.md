# Research Report — Revision and Thinking Visibility

Date: 2026-03-22  
Requested by: Backend (via Squad)

## Findings

### 1) How article revisions / iterations are persisted and rendered

- Revision history is persisted in **three parallel forms**:
  1. **Artifact iterations on disk/DB** via numbered review files such as `editor-review-2.md`, `editor-review-3.md`, and `editor-review-4.md`; real article folders already use this pattern (`content/articles/den-mia-waddle-trade/editor-review-2.md:1-7`, `content/articles/den-mia-waddle-trade/editor-review-4.md:1-7`, `content/articles/jsn-extension-preview/editor-review-3.md:1-7`).
  2. **Structured review rows** in `editor_reviews`, which store verdict + counts + `review_number` (`src/db/schema.sql:162-171`, `src/db/repository.ts:789-813`).
  3. **Revision-loop summaries and shared conversation turns** in `revision_summaries` and `article_conversations`, which record iteration number, stage rollback, issues, and agent turns (`src/db/schema.sql:280-313`, `src/pipeline/conversation.ts:120-145`, `src/pipeline/conversation.ts:184-237`, `src/pipeline/conversation.ts:257-359`).

- Tests confirm numbered review files are first-class pipeline inputs, not ad hoc content:
  - Stage inference picks the **highest-numbered** editor review file (`tests/pipeline/artifact-scanner.test.ts:235-243`, `tests/pipeline/artifact-scanner.test.ts:394-403`).
  - Full lifecycle tests accept `editor-review-2.md` and let the latest numbered review decide advancement (`tests/e2e/full-lifecycle.test.ts:285-316`).

- Dashboard rendering is only **partially revision-aware**:
  - The article page hydrates `reviews: repo.getEditorReviews(id)` plus artifact names (`src/dashboard/server.ts:455-469`).
  - It renders summary cards from `editor_reviews` (`src/dashboard/views/article.ts:735-759`), but artifact tabs are hard-coded to the canonical six files only: `idea`, `discussion-prompt`, `panel-composition`, `discussion-summary`, `draft`, `editor-review` (`src/dashboard/views/article.ts:22-32`, `src/dashboard/views/article.ts:333-372`).
  - The artifact route rejects any non-canonical non-panel filename, so `editor-review-2.md` / `editor-review-3.md` are not directly viewable from the dashboard (`src/dashboard/server.ts:1214-1233`).

### 2) How thinking / debug artifacts are persisted and rendered

- Thinking is persisted as **companion sidecar artifacts**. `writeAgentResult()` writes the main markdown file plus `{base}.thinking.md` when `result.thinking` exists, including agent/model/artifact metadata in the header (`src/pipeline/actions.ts:73-86`).
- Tests verify this persistence contract for canonical artifacts such as `draft.md` and `editor-review.md` (`tests/pipeline/write-agent-result.test.ts:24-97`).
- Dashboard rendering already has a **partial thinking UI**:
  - Canonical artifact tabs show a 💭 button when the matching sidecar exists (`src/dashboard/views/article.ts:333-360`).
  - The content renderer can also extract inline `<think>`, `<thinking>`, `<reasoning>`, and Qwen-style `</think>` traces from a single artifact payload (`src/dashboard/views/article.ts:400-458`), with dedicated extraction tests (`tests/dashboard/extract-thinking.test.ts:4-73`).

- But the visibility is incomplete:
  - There are **no checked-in `content/articles/**/*thinking*.md` files** in the current seeded article corpus, so the repo demonstrates persistence in tests more than in sample content.
  - The dashboard route can load panel artifacts and their thinking companions because it allows `panel-*.md` plus `*.thinking.md` variants (`src/dashboard/server.ts:1220-1233`).
  - However, the tab bar never enumerates panel artifacts at all, and only shows thinking buttons beside the six canonical artifact names (`src/dashboard/views/article.ts:333-360`). So panel debug traces are effectively persisted/routable but not discoverable from the article UI.
  - The panel-discussion flow writes individual `panel-*.md` artifacts and then synthesizes them, which means the missing dashboard surface is hiding already-persisted intermediate work (`src/pipeline/actions.ts:518-546`, `tests/pipeline/actions.test.ts:325-340`).

### 3) Separate fixes or one redesign?

- This is **not one persistence redesign problem**. Persistence already exists for:
  - revision summaries + conversation turns (`src/db/schema.sql:280-313`),
  - numbered review artifacts and DB review rows (`tests/pipeline/artifact-scanner.test.ts:235-243`, `src/db/repository.ts:789-813`),
  - thinking sidecars (`src/pipeline/actions.ts:73-86`, `tests/pipeline/write-agent-result.test.ts:39-97`).

- It is best described as **two visibility gaps on the same dashboard artifact browser**:
  1. **Revision visibility gap:** the UI does not enumerate numbered review artifacts or expose iteration content, even though the pipeline and content model support them.
  2. **Thinking visibility gap:** the UI only exposes thinking for hard-coded canonical artifacts, not for the broader artifact set already persisted/routable.

- So the smallest implementation path could ship as **two targeted UI fixes**, but the cleanest product framing is **one dashboard artifact-explorer redesign**: stop hard-coding the tab bar to six filenames and instead surface all article artifacts, grouped by base artifact / iteration / debug sidecar.

### 4) Already partially implemented but not surfaced

- **Numbered editor reviews are already real pipeline state** but not dashboard-visible:
  - accepted in lifecycle tests (`tests/e2e/full-lifecycle.test.ts:285-316`),
  - preferred by artifact scanning (`tests/pipeline/artifact-scanner.test.ts:235-243`, `tests/pipeline/artifact-scanner.test.ts:394-403`),
  - present in real article folders (`content/articles/den-mia-waddle-trade/editor-review-4.md:1-7`, `content/articles/jsn-extension-preview/editor-review-3.md:1-7`),
  - blocked from article-detail artifact viewing by the current route/tab model (`src/dashboard/views/article.ts:333-372`, `src/dashboard/server.ts:1214-1233`).

- **Panel artifacts are already routable** but not surfaced:
  - `runDiscussion()` writes `panel-{agent}.md` artifacts (`src/pipeline/actions.ts:518-523`);
  - the route will serve them (`src/dashboard/server.ts:1220-1233`);
  - the article page never lists them (`src/dashboard/views/article.ts:333-372`).

- **Stage-run artifact provenance is partly wired but unused**:
  - `stage_runs` has an `artifact_path` column (`src/db/schema.sql:68-84`);
  - repository finish logic stores it (`src/db/repository.ts:494-507`);
  - transition auditing can attach it in metadata (`src/pipeline/actions.ts:1002-1054`);
  - but the action tests still expect `artifactPath` to be absent (`tests/pipeline/actions.test.ts:576-585`), and dashboard run views do not render artifact links (`src/dashboard/views/runs.ts:124-196`, `src/dashboard/views/article.ts:1088-1122`).

- **Conversation/revision DB state is runtime-only today**:
  - writer/editor/publisher prompt handoff uses `article_conversations` + `revision_summaries` (`src/pipeline/conversation.ts:257-359`, `tests/pipeline/conversation.test.ts:166-187`, `tests/pipeline/conversation.test.ts:331-363`);
  - the dashboard article detail page does not render either table.

## Recommended framing for Code / Lead

1. Do **not** redesign storage first.
2. Treat this as an **artifact discovery and history navigation** problem in the dashboard.
3. If scope must stay small, prioritize:
   - surfacing numbered `editor-review*.md` iterations,
   - surfacing non-canonical `panel-*.md` artifacts,
   - surfacing any matching `*.thinking.md` sidecars for all surfaced artifacts.

## Squad artifact files edited

- `.squad/agents/research/revision-thinking-visibility-investigation.md`
- `.squad/agents/research/history.md`
- `.squad/decisions/inbox/research-investigation.md`
- `.squad/skills/dashboard-artifact-visibility-audit/SKILL.md`

## Supporting files inspected

- `.squad/agents/research/history.md`
- `.squad/decisions.md`
- `.squad/skills/llm-observability-audit/SKILL.md`
- `.squad/identity/now.md`
- `.squad/templates/skill.md` *(requested path does not exist)*
- `README.md`
- `tests/pipeline/conversation.test.ts`
- `tests/pipeline/write-agent-result.test.ts`
- `tests/pipeline/actions.test.ts`
- `tests/pipeline/artifact-scanner.test.ts`
- `tests/dashboard/server.test.ts`
- `tests/dashboard/extract-thinking.test.ts`
- `tests/e2e/full-lifecycle.test.ts`
- `tests/e2e/ux-happy-path.test.ts`
- `tests/db/repository.test.ts`
- `tests/db/article-lifecycle.test.ts`
- `tests/dashboard/image-generation.test.ts`
- `tests/pipeline/audit.test.ts`
- `tests/e2e/live-server.test.ts`
- `content/articles/den-mia-waddle-trade/editor-review-2.md`
- `content/articles/den-mia-waddle-trade/editor-review-4.md`
- `content/articles/jsn-extension-preview/editor-review-3.md`
- `content/articles/jsn-extension-preview/publisher-pass.md`
- `content/articles/sea-emmanwori-rookie-eval/editor-review.md`
- `src/dashboard/views/article.ts`
- `src/dashboard/server.ts`
- `src/dashboard/views/runs.ts`
- `src/pipeline/actions.ts`
- `src/pipeline/conversation.ts`
- `src/pipeline/artifact-scanner.ts`
- `src/db/repository.ts`
- `src/db/schema.sql`

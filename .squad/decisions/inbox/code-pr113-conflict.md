# Decision: Rebase PR #113 to replay only the Stage 7 publish fix

- **Issue:** #111 / PR #113
- **Context:** PR #113 was opened from a branch still stacked on `ux/issue-93-copilot-usage`, so after PR #112 landed the PR still carried unrelated history and showed a dirty merge state against `main`.
- **Decision:** Rebase `fix/issue-111-publish-ui` directly onto `origin/main` and keep only the Stage 7 manual publish action-panel change plus its focused regression.
- **Why:** The actual bug is local to the article detail action panel: Stage 7 manual publish should be enabled when `substack_draft_url` exists, even though the pipeline advance guard still expects `substack_url` for Stage 7→8 advancement.
- **Implementation paths:** `src/dashboard/views/article.ts`, `tests/dashboard/server.test.ts`.

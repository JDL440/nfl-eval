# Session Log — Issue #93 Token Usage

- **Timestamp:** 2026-03-22T19:20:00Z UTC
- Issue #93 traced the token-usage gap across provider, runner, pipeline, repository, and dashboard seams.
- Root cause: `Repository.getUsageEvents()` defaulted article reads to the newest 100 rows, which hid early Copilot CLI events once later activity accumulated.
- Result: article usage panels should default to full per-article history, with explicit limits reserved for bounded callers.

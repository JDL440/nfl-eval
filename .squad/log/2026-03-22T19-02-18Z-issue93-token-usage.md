# Session Log — Issue #93 Token Usage

- **Timestamp:** 2026-03-22T19:02:18Z UTC
- Issue #93 traced the token-usage gap from provider emission through persistence to article usage rendering.
- Root cause: `Repository.getUsageEvents()` defaulted article reads to the newest 100 rows, which hid early provider events once later dashboard activity accumulated.
- Result: article usage panels should default to full per-article history, with explicit limits reserved for bounded callers.

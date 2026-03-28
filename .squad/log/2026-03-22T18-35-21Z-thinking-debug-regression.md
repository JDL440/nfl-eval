# Session Log — Thinking Debug Regression

- **Timestamp:** 2026-03-22T18:35:21Z UTC
- Lead investigated the missing collapsible agent-thinking/debug section on article detail pages.
- Diagnosis: pipeline changes persist thinking separately into companion `*.thinking.md` artifacts, so inline-only collapse logic no longer captures the primary debug trace.
- Restoration guidance: keep the dashboard collapsible section, prefer persisted thinking artifacts, and fall back to inline `<think>` / `<reasoning>` only for legacy content.

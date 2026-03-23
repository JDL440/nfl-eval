# Session Log — Substack Config Investigation

**Timestamp:** 2026-03-23T04:18:42Z

## Summary

Investigated the dashboard publish 500 path, confirmed the startup wiring bug, and recorded orchestration notes for Publisher and Code.

## Notes

- Decision inbox entries were already reflected in `decisions.md`, so the inbox files were treated as duplicates and removed after verification.
- The actionable follow-up remains wiring `SubstackService` into `startServer()` and keeping the UI distinction between missing config and unavailable service.

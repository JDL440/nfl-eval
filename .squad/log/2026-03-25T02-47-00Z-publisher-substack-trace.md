# Session Log — Publisher Substack Config Trace
**Timestamp:** 2026-03-25T02:47:00Z  
**Topic:** Dashboard Publish 500 Error Root Cause  

## Outcome
Publisher investigation confirmed dashboard publish 500 is caused by **missing runtime SubstackService wiring in startServer()**, not missing environment variables.

## Key Finding
`createApp()` expects `substackService` dependency (src/dashboard/server.ts:167-177), but `startServer()` calls it without constructing/passing SubstackService (src/dashboard/server.ts:2455-2495). Routes then immediately return HTTP 500.

## UX Impact
Current error message "Substack publishing is not configured for this environment" is misleading. Issue is startup wiring, not configuration.

---
**Logged by:** Scribe

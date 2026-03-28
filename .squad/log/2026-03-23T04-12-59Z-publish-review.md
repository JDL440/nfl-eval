# Session Log — UX Dashboard Publish Review

**Timestamp:** 2026-03-23T04:12:59Z  
**Topic:** Dashboard publish/draft missing Substack configuration messaging  
**Agent:** UX (explore)

## Summary

Read-only UX review of dashboard publish flow error messaging and Substack service configuration state. Examined HTMX error surfacing, adjacent dashboard conventions, and recommended smallest actionable recovery message. Findings support Code decision to return HTML fragments instead of 500 responses for HTMX publish requests.

## Key Recommendation

Return HTML fragment from `renderPublishWorkflow()` with setup guidance for HTMX requests when `substackService` is unconfigured; keep JSON 500 responses for non-HTMX callers.

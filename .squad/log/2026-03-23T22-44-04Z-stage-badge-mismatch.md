# Session Log — Stage Badge Mismatch Investigation & Fix

**Date:** 2026-03-23T22:44:04Z  
**Topic:** Dashboard Stage Runs badge display correction  
**Status:** ✅ COMPLETE

## Summary

Investigation and fix for dashboard badge mismatch: article header badge and Stage Runs panel displayed different stage numbers for the same article.

**Root cause:** `renderStageRunsPanel()` rendered `r.stage + 1` instead of the persisted `r.stage` value.

**Fix:** Narrow implementation in `src/dashboard/views/article.ts` renders persisted stage directly. Updated tests lock the contract.

**Validation:** All tests passing, build complete.

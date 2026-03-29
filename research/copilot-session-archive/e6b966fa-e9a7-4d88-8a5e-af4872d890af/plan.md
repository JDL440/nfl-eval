# Token Telemetry Dashboard

## Problem
The pipeline.db has `usage_events` table with 32 events (image gen, table renders, publishes) but the dashboard article page shows only a placeholder ("📊 Not yet instrumented"). User wants:
1. Working telemetry on the article Overview tab
2. A new `/telemetry` page showing all usage data per article/stage across time

## Approach
Four files to modify, zero new dependencies:

### data.mjs — Query functions
- `getUsageEvents(slug)` — all events for one article
- `getUsageEventsSummary(slug)` — aggregated by surface/stage
- `getAllUsageSummary()` — cross-article aggregates for telemetry page

### server.mjs — Routes
- `GET /telemetry` — HTML telemetry page
- `GET /api/telemetry` — JSON: all articles' aggregated usage
- `GET /api/telemetry/{slug}` — JSON: single article usage events

### templates.mjs — Rendering
- Replace `overviewTab` placeholder with telemetry cards + table
- New `telemetryPage()` export: KPI strip, per-article table, timeline chart
- Add nav link for Telemetry

### style.css — New styles
- Telemetry summary cards, stage-breakdown table, timeline bars

## Todos
- add-data-queries: Add usage_events query functions to data.mjs
- update-overview-tab: Replace placeholder in overviewTab with live telemetry
- add-telemetry-page: Add telemetryPage template + server route
- add-telemetry-styles: CSS for telemetry components
- add-nav-link: Add Telemetry to header nav
- test-dashboard: Verify dashboard starts and both views render

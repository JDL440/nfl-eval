# Dashboard Publish Flow Overhaul

## Problem
1. The "Publish" button uses fragile Playwright browser automation to click through Substack's multi-step publish modal — fails on popups
2. Publish button is buried in the 7th of 8 tabs on the article detail page
3. Note and Twitter promotion options aren't visible/accessible during the publish action
4. Dashboard publish is hardcoded to "prod" target — can't test on nfllabstage

## Approach
1. Replace browser-based publish with direct Substack API call
2. Add a prominent publish bar at the top of the article detail page (always visible)
3. Include Note/Twitter checkboxes in the top publish bar
4. Add "target" (prod/stage) support to the publish workflow
5. Test full flow on nfllabstage, verify article lands in "published" not just "drafts"
6. Clean up test post

## Tasks
1. **api-publish** — Write a test script to discover the correct Substack API endpoint for publishing a draft directly (test on nfllabstage)
2. **replace-browser-publish** — Replace `publishDraftThroughBrowser` in publish.mjs with direct API publish
3. **add-target-support** — Add stage/prod target support to publish workflow + server routes
4. **prominent-publish-bar** — Add always-visible publish bar at top of article detail page with Note/Twitter checkboxes
5. **cleanup-publish-tab** — Simplify the existing Publish tab (remove duplicate controls)
6. **e2e-test-stage** — Test full publish flow on nfllabstage, verify article is published (not just drafted)
7. **cleanup** — Delete test post from nfllabstage

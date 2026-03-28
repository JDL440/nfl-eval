# Session Log — Publisher Substack Gap Investigation

**Date:** 2026-03-25  
**Topic:** Substack Output Gap Trace  
**Agent:** Publisher

## Summary

Publisher traced the Stage 7 draft/publish payload assembly and identified why local previews appear rich but Substack drafts are missing critical elements: images, subscribe widgets, paywall nodes.

**Key finding:** Draft payload (`substackBody`) and local preview (`htmlBody`) fork at `src/dashboard/server.ts:262-317` and diverge through separate rendering pipelines. Preview adds chrome outside the article body that never enters Substack. Publish page lacks explicit rendering for payload-native v1 node types.

**Decision:** Treat Substack payload as the source of truth. Fix order: payload builder first, then align preview to reflect it.

**Validation:** Recommend `sea-emmanwori-rookie-eval/draft.md` as first real republish candidate (has subscribe markers + inline images).

## Decisions Written

- `.squad/decisions/inbox/publisher-output-gap-trace.md` — Payload/preview parity gap analysis and classification

## Skills Written

- `.squad/skills/substack-preview-payload-parity/SKILL.md` — Diagnostic workflow for this class of problem

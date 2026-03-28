# Session Log — Multi-provider LLM Review (2026-03-26T05:56:52Z)

**Date:** 2026-03-26T05:56:52Z  
**Topic:** Multi-provider LLM rollout architecture review and guardrails  
**Agents:** Lead, Code, UX  
**Status:** Decisions extracted; inbox → decisions.md in progress

## Summary

Architecture review validated smallest safe rollout: additive provider registration at startup, optional provider preference threading through gateway/runner, and article-level provider override persisted and visible in metadata. Key guardrails: keep ModelPolicy model-first, preserve auto/unset behavior, treat article override as prefer-not-require, and ensure requested vs actual provider telemetry divergence stays visible.

## Scope Boundaries

- **In:** Additive startup registration, gateway/runner hint semantics, article metadata UI, requested-provider observability
- **Out:** ModelPolicy redesign, provider-first policy engine, require semantics in this pass
- **Protected:** auto routing, config truthfulness, JSON/HTMX metadata parity, LM Studio model fidelity assumptions explicit

## Next

Execute seam wiring: src/dashboard/server.ts (startup) → gateway (hints) → runner (propagation) → pipeline actions (integration) → repository/schema (persistence).

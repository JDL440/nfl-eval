---
name: "article-lifecycle"
description: "Canonical 8-stage process for producing articles from idea to dashboard review and live publish"
domain: "content-production"
confidence: "medium"
source: "runtime-cleaned reference aligned to the current prompt-only app flow"
---

# Article Lifecycle — Skill

## Purpose

This is the canonical high-level process for how an article moves through the NFL Lab pipeline. It is a coordination reference, not an operator script.

Use this skill to keep Lead, Writer, Editor, and Publisher aligned on:

- what each stage is for
- what artifact should exist after that stage
- where human review begins

## Runtime Contract

The in-app runtime is prompt-only.

- Agents do **not** browse the web, read arbitrary files, run shell commands, post GitHub comments, update labels, or publish directly from inside the prompt.
- The application runtime handles model routing, stage persistence, artifact storage, and dashboard publishing workflows.
- Prompt text should describe decisions, outputs, and stage intent — not pretend to execute infrastructure steps.

## Lifecycle Overview

| Stage | Name | Owner | Primary Output |
|------:|------|-------|----------------|
| 1 | Idea Generation | Lead | article idea / angle |
| 2 | Discussion Prompt | Lead | discussion prompt |
| 3 | Panel Composition | Lead | selected panel + lanes |
| 4 | Panel Discussion | Panel + Lead | discussion summary |
| 5 | Article Drafting | Writer | draft article |
| 6 | Editor Pass | Editor | structured review + verdict |
| 7 | Publisher Pass | Publisher / Lead | dashboard-ready handoff |
| 8 | Published | Human via dashboard | live article |

## Stage Guidance

### Stage 1 — Idea Generation

- produce one sharp, current-season angle
- use supplied context only
- call out uncertainty if the prompt lacks enough current detail

### Stage 2 — Discussion Prompt

- define the central question
- state the real tension
- identify the evidence the panel should use

### Stage 3 — Panel Composition

- choose a compact panel with distinct analytical lanes
- always include the relevant team context and at least one specialist perspective

### Stage 4 — Panel Discussion

- gather position statements
- preserve meaningful disagreement
- synthesize the panel into one clean discussion summary for Writer

### Stage 5 — Article Drafting

- turn the panel output into a readable article
- follow the canonical `substack-article` structure
- keep the "Next from the panel" teaser specific and real

### Stage 6 — Editor Pass

- verify facts, names, structure, and image usage
- return one of `APPROVED`, `REVISE`, or `REJECT`
- if the main problem is structural, revise the existing draft instead of restarting from scratch

### Stage 7 — Publisher Pass

- verify formatting and handoff readiness
- stop at dashboard review / publish handoff
- do not describe direct publishing as if the model performs it autonomously

### Stage 8 — Published

- publication is confirmed outside the prompt loop
- human review remains the final gate

## Notes

- Keep stage descriptions aligned with the current runtime, not older `.squad` operator flows.
- If a prompt mentions tool use, direct file writes, GitHub side effects, or autonomous publishing, that instruction is stale and should be ignored in favor of the runtime contract above.

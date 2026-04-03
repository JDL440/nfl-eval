---
name: Idea Prompt Mirroring
domain: content-production
confidence: high
tools: [view, rg]
---

# Idea Prompt Mirroring

## When to Use

- You need to create or revise an idea-intake prompt without drifting from the repo’s live “new idea” workflow.
- You are comparing dashboard copy, runtime prompt assembly, issue templates, and generated artifacts to find the real source of truth.
- You want a scheduled or recurring idea flow to feel native to the existing NFL Lab editorial system.

## Pattern

1. Start with the live runtime prompt, not the page copy.
   - Treat `src/pipeline/idea-generation.ts` as the canonical execution layer.
   - Mirror `buildIdeaTask()` for audience, preset, analytics, and panel guidance.
2. Reuse the canonical markdown skeleton.
   - Treat `src/dashboard/views/new-idea.ts` `IDEA_TEMPLATE` as the structure source of truth.
   - Keep the same major sections: Working Title, Angle / Tension, Primary Team, Editorial metadata, Suggested Panel, context, score.
3. Pull rules from the skill file, not from old artifacts.
   - Use `src/config/defaults/skills/idea-generation.md` for freshness, year-accuracy, and “name missing inputs instead of bluffing” guardrails.
4. Use artifacts as tone references only.
   - `content/articles/*/idea.md` often drift in section names and extras.
   - `content/articles/*/discussion-prompt.md` are better for downstream tone and panel framing than for canonical idea structure.
5. For recurring casual slots, keep the framing lightweight and accessible.
   - Tuesday-style recurring slots should usually map to `casual_explainer`, `reader_profile=casual`, `article_form=brief`, and `analytics_mode=explain_only`.
   - Make the angle timely, specific, and fan-useful without sounding over-engineered.

## Repo Map

- Live idea task assembly: `src/pipeline/idea-generation.ts`
- Canonical idea template + dashboard intake: `src/dashboard/views/new-idea.ts`
- Idea-generation rules: `src/config/defaults/skills/idea-generation.md`
- Human intake phrasing: `.github/ISSUE_TEMPLATE/article-idea.yml`
- Scheduled-slot hints: `src/dashboard/views/config.ts`, `src/dashboard/views/schedules.ts`
- Tone/examples: `content/articles/*/idea.md`, `content/articles/*/discussion-prompt.md`

## Heuristics

Ask these questions in order:

1. **Am I mirroring the live runtime prompt or just the UI copy?**
2. **Which sections are canonical vs. historical drift?**
3. **Does the prompt lead with one sharp tension, not a vague topic?**
4. **Are freshness and year-accuracy guardrails explicit?**
5. **Does the analytics posture match the intended reader profile?**
6. **For recurring casual slots, does the framing stay conversational and plain-language?**

## Current Example

The repo’s active “new idea” flow is assembled in `src/pipeline/idea-generation.ts`, which injects editorial preset, reader profile, article form, panel shape, analytics mode, and the `IDEA_TEMPLATE` structure from `src/dashboard/views/new-idea.ts`. The associated skill file in `src/config/defaults/skills/idea-generation.md` adds the crucial behavioral rules: use current context first, avoid invented freshness, and call out missing inputs.

For a Tuesday casual Seahawks workflow, mirror the structure from `IDEA_TEMPLATE`, the honesty/freshness rules from `idea-generation.md`, and the accessibility posture signaled in `src/dashboard/views/config.ts` / `src/dashboard/views/schedules.ts` (“Tuesday-style slots map cleanly to Casual Explainer” and “should usually stay explain-only”). Use Seahawks discussion-prompt artifacts as tone examples, not as the canonical schema.

## Watch-outs

- Do not treat the dashboard textarea placeholder or “Surprise Me” seed as the full instruction set.
- Do not copy old `idea.md` artifacts section-for-section; they vary by era and workflow.
- Do not let “feature” or “deep” language silently turn into a panel-size command unless explicit constraints require it.
- Do not write a “casual” recurring prompt that still sounds like analyst jargon or assumes reader fluency with advanced metrics.

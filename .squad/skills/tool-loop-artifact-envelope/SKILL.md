---
name: tool-loop-artifact-envelope
description: Keep artifact-producing prompts aligned with the app-managed tool-loop envelope when the runner expects `{ type, ... }` JSON turns.
domain: llm-runtime
confidence: high
source: manual
tools: [view, rg, vitest]
---

# Tool-Loop Artifact Envelope

## Purpose

Use this pattern when a surface wants a model to produce a rich artifact (markdown, plan, brief, idea, etc.) **and** the runtime is driving an app-managed tool loop that requires structured control messages such as `{ "type": "tool_call" }` and `{ "type": "final" }`.

## When to Use

- `AgentRunner` or an equivalent loop is calling `chatStructured()` / `chatStructuredWithResponse()` with a strict control schema.
- The user-facing task also includes an output template for the final artifact body.
- A provider/model starts returning the artifact directly instead of wrapping it in the loop envelope.

## Pattern

1. Trace the caller contract first.
   - Confirm the exact structured control shape required by the runner (`tool_call`, `final`, required keys).
2. Check the surface task/prompt, not just the skill.
   - Artifact templates often teach the model the body format but omit how that body must be packaged for the runtime.
3. Keep the tool loop if the surface genuinely benefits from read-only research tools.
   - Do not remove the loop just because the final answer formatting drifted.
4. Add explicit final-envelope instructions in the caller task.
   - Example: `return {"type":"final","content":"..."} and put the completed artifact in content`.
   - Also forbid raw markdown or alternate JSON schemas outside the final envelope.
5. Add a focused route/caller test.
   - Assert the task text handed to the runner includes the final-envelope requirement.

## NFL Lab Example

- `src\dashboard\server.ts` POST `/api/ideas` enables read-only tool calling for idea generation.
- `src\agents\runner.ts` validates structured turns with `TOOL_LOOP_RESPONSE_SCHEMA`.
- The idea template in `src\dashboard\views\new-idea.ts` describes the markdown body, so the route task must also say that the markdown belongs inside `{"type":"final","content":"..."}`.

## Anti-Pattern

Do **not** relax the runner schema to accept raw artifact payloads when the runtime is intentionally app-managing tool decisions. That hides the contract drift and makes multi-turn tool execution less reliable.

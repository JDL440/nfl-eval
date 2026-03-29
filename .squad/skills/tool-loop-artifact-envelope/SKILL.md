# Skill: Tool-Loop Artifact Envelope

**Confidence:** high
**Domain:** v4 server routes, runner.ts, gateway.ts
**First observed:** session investigating "invalid option expected one of final|tool_call" error
**Confirmed by:** two separate fixes across two route groups (ideas + knowledge refresh)

## Pattern

Every route in `v4/src/dashboard/server.ts` that calls `runner.run()` with
`toolCalling: { enabled: true }` MUST include the final envelope instruction in the
**task string itself**, not only in the system prompt.

Required phrases (both must appear):
```
When you are ready to answer, return {"type":"final","content":"..."} and put your completed [result] inside content.
Do not emit any other JSON schema or raw markdown outside that final envelope.
```

## Why

`TOOL_LOOP_RESPONSE_SCHEMA` in `v4/src/agents/runner.ts:144` validates each LLM turn as:
```typescript
z.object({ type: z.enum(['final', 'tool_call']), ... })
```
When the model returns raw markdown instead of `{"type":"final","content":"..."}`, the schema
parse fails with: "invalid option expected one of final|tool_call". The error is reported at
`v4/src/llm/gateway.ts:296` as "LLM response does not match schema: ...".

`buildToolCatalogPrompt()` (`v4/src/agents/local-tools.ts:178`) injects the envelope into the
**system prompt**, but smaller models (Qwen via LM Studio) follow task-level instructions over
system prompts when both are present. Task-level reinforcement is required.

## Implementation Pattern

Use a named constant for the footer:
```typescript
const KNOWLEDGE_REFRESH_ENVELOPE_FOOTER = [
  'If runtime tools are available, follow the tool-loop JSON protocol from the system instructions exactly.',
  'When you are ready to answer, return {"type":"final","content":"..."} and put your completed knowledge brief inside content.',
  'Do not emit any other JSON schema or raw markdown outside that final envelope.',
].join('\n');

function knowledgePromptFor(agentName: string): string {
  let base: string;
  // ... set base per branch ...
  return `${base}\n\n${KNOWLEDGE_REFRESH_ENVELOPE_FOOTER}`;
}
```

## Test Enforcement

Write a test that:
1. Mocks `runner.run()` with `vi.fn()`
2. POSTs to the route
3. Waits `await new Promise((r) => setTimeout(r, 50))` for fire-and-forget to settle
4. Asserts `mockRun.mock.calls[0][0].task` contains both required envelope phrases

See: `tests/dashboard/agents.test.ts` — "Knowledge Refresh Routes — tool-loop final envelope contract"
See: `tests/dashboard/new-idea.test.ts` — "tells the lead task to return the tool-loop final envelope"

## Checklist for new routes

- [ ] Does the route call `runner.run()` with `toolCalling: { enabled: true }`?
- [ ] Does the task string include `return {"type":"final","content":"..."}`?
- [ ] Does the task string include `Do not emit any other JSON schema or raw markdown outside that final envelope.`?
- [ ] Is there a regression test asserting both phrases?

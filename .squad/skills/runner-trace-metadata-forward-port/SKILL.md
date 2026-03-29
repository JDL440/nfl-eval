# Runner Trace Metadata Forward-Port

## When to use
- Forward-porting v4 runner/tool-trace changes onto a newer main branch.
- Debugging why traces show configured tools but not executed tool calls.
- Validating provider-managed tool loops, especially `copilot-cli`, after merge work.

## Pattern
1. Compare `src\agents\runner.ts` between the source lane and the integration lane first.
2. Preserve trace-start metadata for `availableTools` even if the runner later bypasses its own tool loop.
3. On trace completion, merge the tool-call metadata from the active execution path:
   - app-managed loop results when the runner executed tools directly
   - provider-reported tool-loop calls when the provider owns the loop
4. Re-run focused proof suites before broader dashboard validation:
   - `tests\agents\runner.test.ts`
   - `tests\agents\tool-trace-copilot-cli.test.ts`
   - `tests\llm\provider-copilot-cli.test.ts`
   - `tests\llm\gateway.test.ts`

## Notes
- In this repo, `copilot-cli` can legitimately bypass the app-managed loop, so an empty runner-side `toolCalls` array is not itself a bug.
- The real regression is lost observability when completion metadata drops `availableTools` or ignores provider-reported tool-loop calls.

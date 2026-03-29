# Skill: Copilot CLI Working-Directory Trace

**Confidence:** high  
**Domain:** `src\llm\providers\copilot-cli.ts`, provider metadata, trace/debug surfaces  
**First observed:** v4 cwd-metadata regression coverage

## Pattern

When `CopilotCLIProvider` records provider metadata, `workingDirectory` must come
from the executed plan's effective cwd (`plan.cwd`), not the provider's configured
`workingDirectory`.

## Why

The provider can intentionally execute in a sandbox cwd that differs from the repo
root or configured working directory. A concrete case is `toolAccessMode: 'none'`,
where the Copilot CLI call runs from `.copilot\cli-sandbox`. If metadata reports the
configured repo root instead, traces lie about where the command actually ran and
cwd-related debugging becomes misleading.

## Implementation Rule

Use:

```typescript
return {
  providerMode: plan.mode,
  providerSessionId: plan.sessionId,
  workingDirectory: plan.cwd,
  incrementalPrompt: prompt,
  // ...
};
```

Do **not** fall back to `this.workingDirectory` for the reported trace cwd when a
plan has already resolved the real execution directory.

## Regression Test

Add a provider test that:

1. Builds `CopilotCLIProvider` with `workingDirectory` set to the repo root
2. Uses `toolAccessMode: 'none'`
3. Captures the actual exec options cwd
4. Asserts `providerMetadata.workingDirectory === actualCwd`
5. Asserts the value contains `.copilot\cli-sandbox` and is not the repo root

See: `worktrees\v4\tests\llm\provider-copilot-cli.test.ts`

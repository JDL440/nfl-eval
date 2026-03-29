---
name: NodeNext JS Specifier Diagnosis
domain: typescript-build
confidence: high
tools: [view, rg, powershell]
---

# NodeNext JS Specifier Diagnosis

## When to use

- A TypeScript repo imports local modules with `.js` specifiers even though the source file on disk is `.ts`
- Someone reports `Cannot find module ...copilot-cli.js` or similar during build/review
- `package.json` / `tsconfig.json` might be mixing CommonJS runtime output with `NodeNext` resolution

## Pattern

Treat `.js` specifiers in TypeScript source as a resolution question, not automatically a missing-file bug.

1. Check the real build entrypoint in `package.json`
2. Check `tsconfig.json` for `module`, `moduleResolution`, `rootDir`, and `outDir`
3. Search for both `.js` and extensionless imports
4. Run `npx tsc --traceResolution --noEmit` and confirm whether TypeScript strips `.js` and resolves to the `.ts` source file
5. Build once and verify the emitted `dist\...\*.js` file actually exists

## NFL Lab example

- `src\llm\index.ts` and `src\dashboard\server.ts` import `copilot-cli.js`
- `tests\llm\provider-copilot-cli.test.ts` imports `../../src/llm/providers/copilot-cli` without an extension
- `package.json` builds with `tsc`
- `tsconfig.json` uses `module: NodeNext`, `moduleResolution: NodeNext`, `rootDir: src`, and `outDir: dist`
- `npx tsc --traceResolution --noEmit` resolves `copilot-cli.js` to `src\llm\providers\copilot-cli.ts`
- `npm run v2:build -- --pretty false` emits `dist\llm\providers\copilot-cli.js`

## Narrowest fix rule

If the repo build already resolves and emits correctly, do **not** rewrite imports just to silence an external complaint.

Fix the complaining tool to either:

- use the TypeScript build,
- read from `dist`, or
- honor NodeNext resolution.

## Anti-patterns

- Assuming `.js` in TS source means the source file must literally be `.js`
- Rewriting import specifiers before checking `tsc --traceResolution`
- Blaming tests when `tsconfig.json` excludes `tests`

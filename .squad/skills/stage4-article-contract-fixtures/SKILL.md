---
name: Stage 4 Article Contract Fixtures
domain: testing
confidence: high
tools: [typescript, vitest]
---

# Stage 4 Article Contract Fixtures

## When to use

- A test writes `discussion-summary.md` at stage 4 and then advances to stage 5 or beyond
- E2E tests that exercise full lifecycle flows from stage 1 through stage 7+
- Helper functions that fast-forward articles through multiple stages via direct DB manipulation

## Pattern

1. After writing `discussion-summary.md` in any test, immediately write `article-contract.md` before advancing to stage 5 or beyond
2. Use the standard template: `'# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n{N} words'` where N matches the expected draft word count for the scenario
3. In helper functions like `advanceToStage()`, automatically write both artifacts when advancing through or to stage 4

## NFL Lab examples

### Direct fixture write before advance
```typescript
// tests/e2e/full-lifecycle.test.ts
writeArtifact(slug, 'discussion-summary.md', '# Summary\n\nThe panel concluded...');
writeArtifact(slug, 'article-contract.md', '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n800 words');

const res = await htmxAdvance(slug);
expect(res.status).toBe(200);
```

### Helper function pattern
```typescript
// tests/e2e/edge-cases.test.ts advanceToStage()
for (let s = 1; s < targetStage; s++) {
  const artifact = STAGE_ARTIFACTS[s];
  if (artifact) writeArtifact(slug, artifact.name, artifact.content);
  
  // After writing discussion-summary.md (stage 4), also write article-contract.md
  if (s === 4) {
    writeArtifact(slug, 'article-contract.md', '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n300 words');
  }
  
  repo.advanceStage(slug, s, (s + 1) as Stage, 'test-setup');
}
```

## Why this works

- Stage 4→5 advancement guards require both `discussion-summary.md` and `article-contract.md` artifacts
- Without `article-contract.md`, tests fail with guard errors even though the test scenario is valid
- This pattern keeps e2e tests aligned with production guard logic
- Makes the fixture dependency explicit and discoverable for future test authors

## Related

- See `.squad/skills/stage5-valid-draft-fixtures/SKILL.md` for stage 5→6 draft fixture patterns
- Stage 4→5 guard logic in `src/pipeline/engine.ts` or similar guard validation code

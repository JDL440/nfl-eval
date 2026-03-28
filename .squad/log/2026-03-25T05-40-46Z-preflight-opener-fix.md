# Session Log — Preflight Opener False Positives Fix

**Timestamp:** 2026-03-25T05:40:46Z  
**Topic:** Writer Preflight Sentence-Opener Filtering  
**Agent:** Code  

---

## Summary

Fixed "Because San Francisco" false-positive blocker by aligning sentence-opener filtering across writer-preflight.ts and writer-support.ts. Added 25+ conjunctions/openers to BANNED_FIRST_TOKENS (Because, If, When, While, Although, etc.). Complementary fix: shifted preflight to trust writer-support canonical names as primary authority, falling back to raw extraction only if support is empty.

---

## Decisions Merged

1. **code-because-failure.md** — Root cause: "Because" missing from BANNED_FIRST_TOKENS in both files (separate lists)
2. **code-runtime-regressions.md** — Validation: focused regression tests + v2:build
3. **lead-smarter-preflight.md** — Architecture: Path A (opener filtering) + Path B (structured support priority)

---

## Files Changed

- src\pipeline\writer-preflight.ts (BANNED_FIRST_TOKENS expansion, name-consistency logic)
- src\pipeline\writer-support.ts (BANNED_FIRST_TOKENS alignment)
- tests\pipeline\writer-preflight.test.ts (new focused regressions)
- tests\pipeline\writer-support.test.ts (new focused regressions)

---

## Validation

✅ Focused regression tests pass  
✅ npm run v2:build passes  
✅ No breaking changes to existing test suite  

---

## Next Steps

Code review + merge to main.

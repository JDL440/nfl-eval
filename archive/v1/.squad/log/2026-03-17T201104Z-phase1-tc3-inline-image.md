# Session Log — Phase 1 Test Case 3 Inline Image (nfllabstage)

- **Who:** Lead (executed Phase 1 inline-image note test; Scribe recorded the session).
- **What:** Ran Phase 1 Test Case 3 on nfllabstage with an inline image payload, created Note ID 229296054 (HTTP 200), deleted it immediately (HTTP 404 on re-check), and updated docs/notes-api-discovery.md with the inline-image findings.
- **Decisions:** Inline-image notes must deliver attachments at the payload level rather than as ProseMirror image nodes; the Notes API rejects the latter.
- **Key outcomes:**
  1. Inline-image POST succeeded on nfllabstage (HTTP 200).
  2. Note 229296054 removed and confirmed absent (HTTP 404).
  3. Docs now emphasize payload-level attachments for Notes images.

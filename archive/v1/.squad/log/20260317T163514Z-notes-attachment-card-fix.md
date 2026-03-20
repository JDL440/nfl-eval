# Notes Attachment Card Fix

## Context

Stage review Notes were still rendering article promotions as plain text after the previous revision, which meant the intended article-card behavior was not actually being triggered. User feedback clarified the real acceptance bar: article-promotion Notes must render as real article cards, not plain links.

## Actions

1. Editor re-checked the failing Notes and confirmed the earlier revision had not fixed the rendering behavior.
2. Editor diagnosed the real requirement: published article cards in Notes must be registered through `/api/v1/comment/attachment`, and the resulting attachment IDs must be passed in the Note payload as `attachmentIds`.
3. Editor updated the Substack publisher extension to use the attachment-registration flow and then replaced all 5 affected stage review Notes.
4. Coordinator verification reviewed the extension for `registerPostAttachment()` and `attachmentIds`, fetched a fresh Note permalink for validation, and recorded the verification tidemark.

## Outcome

The notes-attachment-card-fix effort is resolved. The extension now uses the attachment-based card flow, the 5 stage review Notes were replaced with corrected versions, and verification confirmed the new Note path aligns with the expected article-card behavior.

## Key Learnings

- Article cards in Substack Notes are attachment-backed, not link-only behavior.
- The durable pattern is: register the published article URL with `/api/v1/comment/attachment`, then include the returned ID(s) in `attachmentIds` when creating the Note.
- A fresh permalink check is the right verification step after replacing broken Notes because it confirms the final rendered artifact, not just the code path.

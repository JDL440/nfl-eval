Problem: Issue #75 is fully landed and clean. The next focus is a new article issue for the confirmed Jaylen Waddle trade to Denver.

Approach:
- Treat issue #75 as complete and archived.
- Track the new article setup work so Lead can continue from a clean handoff.
- Use the new GitHub issue as the source of truth for the Waddle/Denver article pipeline.

Todos:
- Done: issue #75 implementation, revision, merge to main, and local cleanup.
- Done: created new article issue #78 for the Jaylen Waddle to Denver trade and routed it to Lead.
- Done: issue #78 pipeline reached Stage 7 and produced a prod draft URL.
- Done: the prod draft for issue #78 was repaired after missing-image diagnosis; two inline images were generated, inserted, republished, and re-approved.
- Done: Editor identified AFCCG framing problems in the Waddle article; Writer revised the argument, Editor re-approved it, and the existing prod draft was updated with the corrected text.
- Next: Joe can review the repaired prod draft in Substack and publish when ready.

Notes:
- Team root is the current worktree: C:\github\worktrees\mobiletable
- New story issue: `#78` — `Article: DEN/MIA — The Jaylen Waddle Trade — Denver's Bold Bet, Miami's Full Reset`
- Lead reported the trade as fact-checked/confirmed and labeled the new issue `article`, `squad`, `squad:lead`, `go:yes`.
- The article content itself has cleared re-review after earlier factual fixes; the remaining defect is draft imagery/publisher state.
- Root cause for the missing-image defect: `generate_article_images` was skipped in the original Stage 5-7 run. Repair used 2 generated inline images, republished to the existing prod draft URL, and passed final Editor image review.
- AFCCG re-review result: the original framing overstated the receiver-room case by leaning on a backup-QB playoff loss. Writer corrected the article to separate the acute AFCCG problem (Nix out / Stidham starting) from the structural receiver-ceiling argument, and the live prod draft was refreshed.

Problem: Ralph is running the all-teams article backlog at maximum parallelism. Many team folders have reached panel-complete state, but Claude writer/editor lanes are hitting rate limits and need active harvesting plus rerouting so completed panels become drafts and then editor-reviewed articles.

Approach:
- Continuously harvest finished agent work from the filesystem rather than trusting agent summaries alone.
- Treat panel-complete article folders as ready for drafting and keep launching downstream work without waiting for manual confirmation.
- Reroute blocked writer work from saturated Claude models onto GPT writer lanes.
- As drafts land, immediately queue editor review and keep reconciling remaining issue/folder state.

Todos:
- Harvest GPT writer completions and confirm which article folders now contain fresh `draft.md` files
- Queue Editor on every newly created draft as soon as it lands
- Continue filling remaining incomplete folders (`ATL`, `DAL`, `DET`, `TB`, `CHI`, `MIN`, plus any lagging retries) so they can join the writer queue
- Reconcile stale SQL todo status with the actual filesystem/agent state

Notes:
- Claude Opus/Sonnet agent final responses are often failing with 429s even when artifacts were written successfully, so filesystem verification is the source of truth.
- Current active writer retry batch uses `gpt-5.4` for `BUF`, `DEN`, `GB`, `HOU`, `JAX`, `KC`, `LV`, `PHI`, `TEN`, and `WSH`.
- Secondary writer lanes for `CAR`, `NYG`, and `NO` were attempted on Claude and need verification/reroute if no drafts appear.

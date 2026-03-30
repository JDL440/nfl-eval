Problem: On the article detail page, editor revision history currently appears above the artifact area and uses a high-emphasis card treatment, which makes it feel like a primary control rather than supplemental context.

Approach:
- Move revision history below the artifacts stack on the article page.
- Collapse it into a less-prominent supplemental details section instead of a fully expanded main panel.
- Add focused test coverage that locks in the new placement and preserves the revision content.

Todos:
- Update `src/dashboard/views/article.ts` to reposition revision history after artifacts and render it in a quieter supplemental container.
- Update `src/dashboard/public/styles.css` so revision history reads as secondary/supporting UI.
- Update `tests/dashboard/server.test.ts` to cover the new placement and presentation.
- Run focused dashboard tests plus `npm run v2:build`.

Notes:
- Preserve the current revision data and wording; this is a layout/prominence change, not a behavioral change.
- Keep editor reviews visible when there is no revision history, as today.

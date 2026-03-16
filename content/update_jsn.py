"""
update_jsn.py — One-off patch for jsn-extension-preview.

Migrated to use PipelineState helper with numeric stage semantics.
Original version used raw SQL with string stage 'discussion_prompt'.
"""

import os
import sys

# Allow running from repo root: python content/update_jsn.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from content.pipeline_state import PipelineState

ARTICLE_ID = "jsn-extension-preview"

with PipelineState() as ps:
    article = ps.get_article(ARTICLE_ID)
    if article is None:
        print(f"Article '{ARTICLE_ID}' not found in pipeline.db")
        sys.exit(1)

    old_stage = article["current_stage"]

    # Update metadata via direct SQL (PipelineState doesn't expose title/subtitle setters)
    ps._conn.execute(
        """UPDATE articles SET
            title = 'Jaxon Smith-Njigba''s Contract Is Coming. Here Are the 4 Paths Seattle Can Take.',
            subtitle = 'JSN enters Year 3 of his rookie deal with superstar production and a WR market that just reset at $35M+/year. Does Seattle lock him up now, wait for the 5th-year option window, let him play out the deal, or risk a franchise tag war? Our Cap expert and player rep walk every path — and only one keeps the dynasty intact.',
            publish_window = 'evergreen',
            depth_level = 3,
            time_sensitive = 0
        WHERE id = ?""",
        (ARTICLE_ID,),
    )
    ps._conn.commit()

    # Advance stage using shared helper (numeric 2 = Discussion Prompt)
    from_stage = old_stage if isinstance(old_stage, int) else None
    if from_stage is None and not isinstance(old_stage, int):
        # Repair string stage first, then advance
        ps.repair_string_stage(ARTICLE_ID, 1, agent="update_jsn")
        from_stage = 1

    ps.advance_stage(ARTICLE_ID, from_stage=from_stage, to_stage=2,
                     agent="Lead", status="in_discussion")

    updated = ps.get_article(ARTICLE_ID)
    print("Updated:")
    print(f"  ID: {updated['id']}")
    print(f"  Title: {updated['title']}")
    print(f"  Status: {updated['status']}")
    print(f"  Stage: {updated['current_stage']} (numeric)")
    print(f"  Depth: {updated['depth_level']} | Window: {updated['publish_window']}")

"""
set_discussion_path.py — One-off patch for jsn-extension-preview discussion_path.

Migrated to use PipelineState helper with numeric stage semantics.
Original version used raw SQL with datetime('now') instead of ISO-8601 UTC.
"""

import os
import sys

# Allow running from repo root: python content/set_discussion_path.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from content.pipeline_state import PipelineState

ARTICLE_ID = "jsn-extension-preview"
DISCUSSION_PATH = "content/articles/jsn-extension-preview/discussion-summary.md"

with PipelineState() as ps:
    article = ps.get_article(ARTICLE_ID)
    if article is None:
        print(f"Article '{ARTICLE_ID}' not found in pipeline.db")
        sys.exit(1)

    ps.set_discussion_path(ARTICLE_ID, DISCUSSION_PATH)
    print("discussion_path updated")

    updated = ps.get_article(ARTICLE_ID)
    print(f"  ID: {updated['id']}")
    print(f"  Status: {updated['status']}")
    print(f"  Stage: {updated['current_stage']} (numeric)")
    print(f"  discussion_path: {updated['discussion_path']}")

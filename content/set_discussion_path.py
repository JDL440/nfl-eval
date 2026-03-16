import sqlite3

# DEPRECATED: Use content/pipeline_state.py instead.
# This script was a one-off patch for jsn-extension-preview discussion_path.
# Kept for historical reference only — do not run.
# Example replacement:
#   from content.pipeline_state import PipelineState
#   ps = PipelineState()
#   ps.set_discussion_path('jsn-extension-preview', 'content/articles/jsn-extension-preview/discussion-summary.md')

conn = sqlite3.connect("content/pipeline.db")
conn.execute(
    "UPDATE articles SET discussion_path = ?, updated_at = datetime('now') WHERE id = ?",
    ("content/articles/jsn-extension-preview/discussion-summary.md", "jsn-extension-preview")
)
conn.commit()
print("discussion_path updated")

cur = conn.cursor()
cur.execute("SELECT id, status, current_stage, discussion_path FROM articles WHERE id = ?", ("jsn-extension-preview",))
row = cur.fetchone()
print(row)
conn.close()

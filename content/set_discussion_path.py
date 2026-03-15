import sqlite3

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

import sqlite3
from datetime import datetime

conn = sqlite3.connect('content/pipeline.db')

# Update the existing idea with richer framing and advance to in_discussion
conn.execute("""
    UPDATE articles SET
        title = 'Jaxon Smith-Njigba''s Contract Is Coming. Here Are the 4 Paths Seattle Can Take.',
        subtitle = 'JSN enters Year 3 of his rookie deal with superstar production and a WR market that just reset at $35M+/year. Does Seattle lock him up now, wait for the 5th-year option window, let him play out the deal, or risk a franchise tag war? Our Cap expert and player rep walk every path — and only one keeps the dynasty intact.',
        status = 'in_discussion',
        current_stage = 'discussion_prompt',
        publish_window = 'evergreen',
        depth_level = 3,
        time_sensitive = 0,
        updated_at = ?
    WHERE id = 'jsn-extension-preview'
""", (datetime.utcnow().isoformat(),))

conn.commit()

row = conn.execute("""
    SELECT id, title, status, current_stage, depth_level, publish_window 
    FROM articles WHERE id = 'jsn-extension-preview'
""").fetchone()

print("Updated:")
print(f"  ID: {row[0]}")
print(f"  Title: {row[1]}")
print(f"  Status: {row[2]}")
print(f"  Stage: {row[3]}")
print(f"  Depth: {row[4]} | Window: {row[5]}")
conn.close()

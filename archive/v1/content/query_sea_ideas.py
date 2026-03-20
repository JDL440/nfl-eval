import sqlite3

conn = sqlite3.connect('content/pipeline.db')
conn.row_factory = sqlite3.Row
rows = conn.execute("""
  SELECT id, title, subtitle, depth_level, publish_window, target_publish_date, time_sensitive, expires_at, status
  FROM articles
  WHERE primary_team = 'seahawks' OR teams LIKE '%seahawks%'
  ORDER BY time_sensitive DESC, target_publish_date ASC NULLS LAST
""").fetchall()
for r in rows:
    print(f"[{r['status']}] {r['id']}")
    print(f"  Title: {r['title']}")
    print(f"  Window: {r['publish_window']} | Depth: {r['depth_level']} | Urgent: {bool(r['time_sensitive'])}")
    print(f"  Summary: {r['subtitle'][:120] if r['subtitle'] else '(no subtitle)'}")
    print()
conn.close()

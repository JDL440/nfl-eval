#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('content/pipeline.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Check substack_draft_url for eligible articles
eligible_slugs = ['witherspoon-extension-v2', 'mia-tua-dead-cap-rebuild', 'den-2026-offseason']

for slug in eligible_slugs:
    cursor.execute('''
    SELECT 
        id,
        title,
        substack_draft_url,
        current_stage,
        status
    FROM articles
    WHERE id = ?
    ''', (slug,))
    
    row = cursor.fetchone()
    if row:
        print(f"\n{row['id']}:")
        print(f"  Title: {row['title']}")
        print(f"  Stage: {row['current_stage']}")
        print(f"  Status: {row['status']}")
        print(f"  Draft URL: {row['substack_draft_url']}")
    else:
        print(f"\n{slug}: NOT FOUND")

conn.close()

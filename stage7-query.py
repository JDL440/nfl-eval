#!/usr/bin/env python3
import sqlite3
import json
from pathlib import Path

conn = sqlite3.connect('content/pipeline.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Articles at stage 7 with publisher pass complete
cursor.execute('''
SELECT 
    a.id, 
    a.title, 
    a.status, 
    a.current_stage, 
    a.article_path,
    p.title_final,
    p.subtitle_final,
    p.body_clean,
    p.section_assigned,
    p.tags_set,
    p.names_verified,
    p.numbers_current,
    p.publish_datetime
FROM articles a
LEFT JOIN publisher_pass p ON a.id = p.article_id
WHERE a.current_stage = 7
ORDER BY a.updated_at DESC
''')

rows = cursor.fetchall()
print(f'Total Stage 7 articles: {len(rows)}\n')
print('=' * 80)

eligible = []

for row in rows:
    # Check if all publisher pass items are checked
    pp_items = [
        row['title_final'],
        row['subtitle_final'], 
        row['body_clean'],
        row['section_assigned'],
        row['tags_set'],
        row['names_verified'],
        row['numbers_current']
    ]
    all_checked = all(pp_items)
    
    # Check if article file exists
    article_path = row['article_path']
    has_artifact = False
    if article_path:
        full_path = Path(article_path)
        has_artifact = full_path.exists()
    
    status_ready = row['status'] in ['in_production', 'approved']
    
    is_eligible = all_checked and has_artifact and status_ready
    
    print(f"ID: {row['id']}")
    print(f"  Title: {row['title'][:60]}...")
    print(f"  Status: {row['status']}")
    print(f"  Publisher Pass Complete: {all_checked} ({sum(pp_items)}/7 items)")
    print(f"  Article Artifact Exists: {has_artifact}")
    print(f"  Ready Status: {status_ready}")
    print(f"  ✓ ELIGIBLE FOR STAGE 7 PUSH: {is_eligible}")
    print()
    
    if is_eligible:
        eligible.append({
            'id': row['id'],
            'title': row['title'],
            'article_path': article_path
        })

print('=' * 80)
print(f'\nEligible articles for Stage 7 production push: {len(eligible)}\n')
for art in eligible:
    print(f"  • {art['id']}: {art['title'][:60]}...")

conn.close()

# Save eligible list for stage7-prod-push.mjs to use
import json
with open('stage7-eligible.json', 'w') as f:
    json.dump(eligible, f, indent=2)

print(f'\nSaved eligible articles to: stage7-eligible.json')

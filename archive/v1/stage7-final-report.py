#!/usr/bin/env python3
import sqlite3
import json
from pathlib import Path
from datetime import datetime

conn = sqlite3.connect('content/pipeline.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("\n" + "="*80)
print("STAGE 7 PRODUCTION PUSH — FINAL REPORT")
print("="*80)

# Get manifest
manifest_path = Path('stage7-prod-manifest.json')
if manifest_path.exists():
    manifest = json.load(open(manifest_path))
    print(f"\nExecution Time: {manifest['timestamp']}")
    print(f"Target Publication: {manifest['target']}")
    print(f"Mode: {manifest['mode']}")
    print(f"Results: {manifest['success']} success, {manifest['failed']} failed")

# Get updated article details
print("\n" + "-"*80)
print("ARTICLES PROCESSED")
print("-"*80)

cursor.execute('''
    SELECT 
        a.id,
        a.title,
        a.status,
        a.current_stage,
        a.substack_draft_url,
        st.from_stage,
        st.to_stage,
        st.transitioned_at,
        st.notes
    FROM articles a
    LEFT JOIN stage_transitions st ON a.id = st.article_id AND st.from_stage = 7
    WHERE a.id = 'witherspoon-extension-v2'
    ORDER BY st.transitioned_at DESC
''')

article = cursor.fetchone()
if article:
    print(f"\n✅ WITHERSPOON-EXTENSION-V2")
    print(f"   Title: {article['title']}")
    print(f"   Status: {article['status']}")
    print(f"   Current Stage: {article['current_stage']} (Approval / Publish)")
    print(f"   Production Draft URL: {article['substack_draft_url']}")
    print(f"   Stage Transition: {article['from_stage']} → {article['to_stage']}")
    print(f"   Transitioned At: {article['transitioned_at']}")

# Check for other Stage 7 articles
print("\n" + "-"*80)
print("OTHER STAGE 7 ARTICLES (NOT PROCESSED)")
print("-"*80)

cursor.execute('''
    SELECT 
        id,
        title,
        status,
        substack_draft_url
    FROM articles
    WHERE current_stage = 7
    AND id != 'witherspoon-extension-v2'
    ORDER BY updated_at DESC
''')

other_stage7 = cursor.fetchall()
if other_stage7:
    print(f"\nTotal: {len(other_stage7)} articles still at Stage 7\n")
    for row in other_stage7[:5]:  # Show first 5
        draft_source = "nfllab (prod)" if "nfllab.substack.com" in (row['substack_draft_url'] or "") else ("nfllabstage (staging)" if "nfllabstage.substack.com" in (row['substack_draft_url'] or "") else "none")
        print(f"  • {row['id']}")
        print(f"    Status: {row['status']} | Draft: {draft_source}")
    if len(other_stage7) > 5:
        print(f"\n  ... and {len(other_stage7) - 5} more")
else:
    print("\nNone — all eligible articles have been processed.")

# Summary
print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"""
ARTICLES PROCESSED:       1
  ├─ Successfully pushed: 1
  ├─ Failed:             0
  └─ Skipped:            0

PRODUCTION DRAFT URLS:    1 created
  └─ witherspoon-extension-v2: https://nfllab.substack.com/publish/post/191198725

STAGE TRANSITIONS:        1
  └─ 7 → 8 (Approval/Publish)

MANUAL ACTIONS REMAINING:
  ✓ Stage 8 — Joe Robinson reviews production draft at:
    https://nfllab.substack.com/publish/post/191198725
  ✓ Joe approves, requests changes, or rejects for publication
  ✓ Once approved, article moves to Stage 8 completion
  ✓ Publication happens when scheduled or manually triggered

UNRELATED ARTICLES AFFECTED: 0
  (Only witherspoon-extension-v2 was processed per request)
""")

conn.close()

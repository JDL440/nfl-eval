"""
Initialize content/pipeline.db from content/schema.sql and seed existing published articles.
Run from repo root: python content/init_db.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "pipeline.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")

def main():
    print(f"Initializing {DB_PATH} ...")
    with open(SCHEMA_PATH, "r") as f:
        schema = f.read()

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(schema)

    # Seed pre-DB published articles
    articles = [
        (
            "witherspoon-extension-cap-vs-agent",
            "Our Cap Expert Says $27 Million. Witherspoon's Agent Will Demand $33 Million. Here's Why They're Both Right.",
            "The NFL Lab expert panel breaks down the most important negotiation of Seattle's offseason — and why the two sides are $25 million apart before they even sit down.",
            "seahawks",
            '["seahawks"]',
            "published",
            8,
            "content/articles/witherspoon-extension-cap-vs-agent.md",
            "2026-03-14",
            "2026-03-14",
            "2026-03-14",
        ),
        (
            "seahawks-rb1a-target-board",
            "The Seahawks Have a Hole at RB. Here's Why Pick #64 Might Be the Smartest Play Seattle Makes All Draft.",
            "A deep-dive from the NFL Lab expert panel — our Cap Analyst, Injury Specialist, College Scout, Offensive Scheme Expert, and Media correspondent break down everything you need to know about Seattle's running back situation heading into the 2026 draft.",
            "seahawks",
            '["seahawks"]',
            "published",
            8,
            "content/articles/seahawks-rb1a-target-board.md",
            "2026-03-14",
            "2026-03-14",
            "2026-03-14",
        ),
    ]

    conn.executemany(
        """INSERT OR IGNORE INTO articles
           (id, title, subtitle, primary_team, teams, status, current_stage,
            article_path, published_at, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        articles,
    )

    stage_transitions = [
        ("witherspoon-extension-cap-vs-agent", None, 8, "Joe",
         "Seeded from pre-DB publish. Article was live before pipeline.db existed.", "2026-03-14"),
        ("seahawks-rb1a-target-board", None, 8, "Joe",
         "Seeded from pre-DB publish. Article was live before pipeline.db existed.", "2026-03-14"),
    ]
    conn.executemany(
        """INSERT INTO stage_transitions
           (article_id, from_stage, to_stage, agent, notes, transitioned_at)
           VALUES (?,?,?,?,?,?)""",
        stage_transitions,
    )

    panels = [
        ("witherspoon-extension-cap-vs-agent", "Cap Analyst", "Contract valuation", 1),
        ("witherspoon-extension-cap-vs-agent", "Player Representative", "Agent-side negotiation position", 1),
        ("seahawks-rb1a-target-board", "Cap Analyst", "Cap space / contract strategy", 1),
        ("seahawks-rb1a-target-board", "Injury Specialist", "Charbonnet ACL timeline / risk", 1),
        ("seahawks-rb1a-target-board", "College Scout", "Draft prospect evaluation", 1),
        ("seahawks-rb1a-target-board", "Offensive Scheme Expert", "Wide-zone fit at RB", 1),
        ("seahawks-rb1a-target-board", "Media", "Market context / fan sentiment", 1),
    ]
    conn.executemany(
        """INSERT INTO article_panels (article_id, agent_name, role, analysis_complete)
           VALUES (?,?,?,?)""",
        panels,
    )

    conn.commit()

    # Verify
    print("\n=== pipeline_board ===")
    for row in conn.execute("SELECT id, status, stage_name FROM pipeline_board"):
        print(f"  {row[0]} | {row[1]} | {row[2]}")

    print("\n=== article_panels ===")
    for row in conn.execute("SELECT article_id, agent_name FROM article_panels ORDER BY article_id"):
        print(f"  {row[0]} | {row[1]}")

    conn.close()
    print("\n✅ pipeline.db initialized and seeded.")

if __name__ == "__main__":
    main()

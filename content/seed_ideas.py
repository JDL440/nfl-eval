"""
Migrate pipeline.db: add time relevance columns, then seed all article ideas from article-ideas.md.
Run from repo root: python content/seed_ideas.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "pipeline.db")
conn = sqlite3.connect(DB_PATH)

# ── 1. Add new columns (idempotent) ──────────────────────────────────────────
for col, defn in [
    ("target_publish_date", "TEXT"),
    ("publish_window",      "TEXT"),
    ("time_sensitive",      "INTEGER NOT NULL DEFAULT 0"),
    ("expires_at",          "TEXT"),
]:
    try:
        conn.execute(f"ALTER TABLE articles ADD COLUMN {col} {defn}")
        print(f"  + added {col}")
    except Exception:
        print(f"  · {col} already exists")
conn.commit()

# ── 2. Article ideas to seed ─────────────────────────────────────────────────
# Fields: id, title, subtitle, primary_team, teams, status, current_stage,
#         depth_level, target_publish_date, publish_window, time_sensitive, expires_at
ideas = [
    # ── PUBLISH NOW (FA Wave 1, Mar 14-20) ───────────────────────────────────
    (
        "seahawks-offseason-defense-recap",
        "Seattle Won the Super Bowl and Lost Half Its Defense. Here's Why That's Actually Fine.",
        "Full offseason departures recap — Walker, Mafe, Woolen, Bryant gone. What's left, what's the plan. Reassure fans.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-03-17", "fa-wave-1", 1, "2026-03-21"
    ),
    (
        "seahawks-fa-under-radar-fit",
        "The Free Agent Nobody's Talking About That Could Win Seattle Another Ring",
        "Deep dive on a specific under-the-radar FA fit — Bobby Wagner reunion? Asante Samuel Jr.? Jauan Jennings?",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-03-18", "fa-wave-1", 1, "2026-03-25"
    ),
    (
        "brian-fleury-scheme-change-seahawks",
        "Brian Fleury Isn't Running Klint Kubiak's Offense. Here's What Changes.",
        "Shanahan-tree vs. Kubiak-tree scheme comparison. What Fleury's SF film tells us. Personnel implications.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-03-20", "fa-wave-1", 1, "2026-03-28"
    ),
    # ── PRE-DRAFT (Mar 21 – Apr 22) ───────────────────────────────────────────
    (
        "seahawks-cb-draft-pick-32-board",
        "The Seahawks Draft Board at #32: Every CB Who Could Fall to the Last Pick in Round 1",
        "CB prospect breakdown for the defending champs. Cissé, Hood, Moore — who's the pick?",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        "2026-03-25", "pre-draft", 1, "2026-04-23"
    ),
    (
        "seahawks-trade-back-champions-draft",
        "32nd Pick Problems: How Super Bowl Champions Draft — and Why Seattle Should Trade Back",
        "Historical analysis of how champions navigate the draft. Case for trading #32 for multiple picks.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        "2026-04-01", "pre-draft", 1, "2026-04-23"
    ),
    (
        "seahawks-edge-rusher-draft-scheme-fit",
        "We Ran Every Edge Rusher in the Draft Through Macdonald's Scheme. Only 3 Fit.",
        "EDGE prospect scheme fit analysis — who replaces Mafe's production at #64 or #96?",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        "2026-04-08", "pre-draft", 1, "2026-04-23"
    ),
    (
        "seahawks-4pick-mock-draft-consensus",
        "The Mock Draft Our 46 Experts Agree On (They Almost Never Agree)",
        "Full Seahawks 4-pick mock with consensus from the entire panel. Each pick gets expert analysis.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        "2026-04-15", "pre-draft", 1, "2026-04-23"
    ),
    (
        "jadarian-price-achilles-draft-steal",
        "The 2026 Draft's Best-Kept Secret: Why Jadarian Price at #64 Is a Steal (If Seattle Can Get Past the Achilles)",
        "Expanded RB analysis — deeper draft context, where he falls on boards.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        "2026-04-20", "pre-draft", 1, "2026-04-23"
    ),
    # ── DRAFT WEEK (Apr 23-25) ────────────────────────────────────────────────
    (
        "seahawks-round-1-pick-reaction",
        "LIVE: Seahawks Round 1 Pick — Instant Expert Panel Reaction",
        "Real-time reaction to #32 pick. Scheme fit, value grade, cap impact.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-04-23", "draft-week", 1, "2026-04-26"
    ),
    (
        "seahawks-day-2-draft-grades",
        "Day 2 Grades: Did Seattle Nail #64 and #96?",
        "Morning-after analysis of Rounds 2-3 picks.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-04-25", "draft-week", 1, "2026-04-28"
    ),
    (
        "seahawks-2026-draft-report-card",
        "The Complete 2026 Seahawks Draft Report Card — From 46 Experts Who Can't Stop Arguing",
        "Full draft class review with grades from each expert. Disagreements highlighted.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        "2026-04-27", "draft-week", 1, "2026-05-05"
    ),
    # ── MAY ───────────────────────────────────────────────────────────────────
    (
        "witherspoon-5th-year-option-deadline",
        "The Witherspoon Decision: Why May 1 Is the Most Important Date on Seattle's Calendar",
        "5th-year option deadline explainer. Exercise it + extend? Just exercise? The strategy.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-04-29", "may", 1, "2026-05-01"
    ),
    (
        "seahawks-2026-schedule-ranked",
        "Your 2026 Seahawks Schedule, Ranked: The 5 Games That Will Define the Season",
        "Schedule release reaction — rank every game, identify primetime slots, circle the revenge games.",
        "seahawks", '["seahawks"]', "proposed", 1, 1,
        "2026-05-14", "may", 1, "2026-05-20"
    ),
    (
        "seahawks-patriots-kickoff-preview",
        "The Super Bowl Rematch Nobody Expected: Why Seahawks-Patriots in September Is Must-Watch TV",
        "Deep preview of the kickoff game opponent. NE under Vrabel with Drake Maye.",
        "seahawks", '["seahawks", "patriots"]', "proposed", 1, 2,
        "2026-05-20", "may", 1, "2026-09-10"
    ),
    # ── JUNE-JULY ─────────────────────────────────────────────────────────────
    (
        "seahawks-53man-roster-projection",
        "53-Man Roster Projection: The 9 Roster Battles That Will Define Seattle's Defense",
        "Position-by-position breakdown. Who makes it, who gets cut, who's a surprise.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        "2026-06-15", "camp-preview", 1, "2026-08-01"
    ),
    (
        "wa-millionaires-tax-nfl-free-agency",
        "The WA Millionaires Tax Is Coming. Here's How It Changes NFL Free Agency in Seattle — Forever.",
        "Deep dive on SB 6346. How the 9.9% tax affects recruiting, extensions, and the Seahawks' pitch.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        "2026-06-22", "camp-preview", 0, None
    ),
    (
        "seahawks-training-camp-preview-2026",
        "Training Camp Preview: 10 Things to Watch When the Super Bowl Champions Report",
        "Camp storylines — Charbonnet's ACL return, rookie integration, OC Fleury's scheme install.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-07-15", "camp-preview", 1, "2026-07-25"
    ),
    # ── PRESEASON ─────────────────────────────────────────────────────────────
    (
        "seahawks-cut-day-bubble-players",
        "Cut Day Is Coming: The 12 Seahawks Most Likely to Lose Their Jobs",
        "90→53 projection. Who's on the bubble? Who's a surprise cut? Cap implications of each.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-08-19", "preseason", 1, "2026-08-27"
    ),
    (
        "seahawks-2026-defense-better-than-2025",
        "The Seahawks' Super Bowl Defense Is Better Than Last Year's. Let Me Explain.",
        "Bold pre-season take. Compare 2025 vs 2026 rosters position-by-position.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        "2026-08-28", "preseason", 1, "2026-09-05"
    ),
    # ── EVERGREEN ─────────────────────────────────────────────────────────────
    (
        "how-we-built-46-agent-ai-panel",
        "How We Built a 46-Agent AI Expert Panel to Cover the NFL (And What We've Learned)",
        "Meta/behind-the-scenes. How the Substack works. Great for growth.",
        None, '[]', "proposed", 1, 1,
        None, "evergreen", 0, None
    ),
    (
        "nfc-west-power-rankings",
        "The NFC West Power Rankings Our Experts Won't Stop Fighting About",
        "Division breakdown with internal disagreements. ARI, LAR, SF, SEA.",
        None, '["seahawks","cardinals","rams","49ers"]', "proposed", 1, 2,
        None, "evergreen", 0, None
    ),
    (
        "sam-darnold-contract-best-deal",
        "Sam Darnold's Contract Is the Best Deal in Football. Here's the Math.",
        "Cap analysis of Darnold's value vs. market.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        None, "evergreen", 0, None
    ),
    (
        "jsn-extension-preview",
        "Jaxon Smith-Njigba's Extension Is Coming. Here's What It'll Cost.",
        "JSN extension preview (same Cap vs PlayerRep format as Witherspoon).",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        None, "evergreen", 0, None
    ),
    (
        "nfc-west-biggest-weaknesses",
        "Every NFC West Team's Biggest Weakness — Exposed by Our Division Experts",
        "4-team roast. Each team expert calls out the rivals.",
        None, '["seahawks","cardinals","rams","49ers"]', "proposed", 1, 2,
        None, "evergreen", 0, None
    ),
    (
        "jay-harbaugh-special-teams-super-bowl",
        "The Seahawks' Secret Weapon: How Jay Harbaugh's Special Teams Unit Won the Super Bowl",
        "ST deep dive — Shaheed returns, Dickson punts, Myers clutch kicks.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        None, "evergreen", 0, None
    ),
    (
        "charbonnet-injury-contingency-plan",
        "What If Charbonnet Can't Go Week 1? Seattle's Contingency Plan, Explained.",
        "Injury timeline + backup plan analysis.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        None, "evergreen", 0, None
    ),
    # ── BACKLOG ───────────────────────────────────────────────────────────────
    (
        "seahawks-cap-deep-dive-visual",
        "Seahawks Salary Cap Deep Dive — Where Every Dollar Goes",
        "Visual cap breakdown — every contract, every dollar, every dead cap hit.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        None, "backlog", 0, None
    ),
    (
        "if-i-were-john-schneider",
        "If I Were John Schneider — What the GM Should Do, By the Numbers",
        "GM-chair analysis. Data-driven offseason strategy proposal.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        None, "backlog", 0, None
    ),
    (
        "seahawks-post-june1-cuts",
        "Post-June 1 Cut Candidates and Their Cap Savings",
        "Which veterans get cut after June 1 to free cap space?",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        None, "backlog", 1, "2026-06-15"
    ),
    (
        "seahawks-draft-picks-since-2020",
        "Ranking Every Seahawks Draft Pick Since 2020 — Hits and Misses",
        "6-year draft audit. Who delivered, who flopped, what the data says.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        None, "backlog", 0, None
    ),
    (
        "seahawks-best-udfa-2026-draft",
        "The Best UDFA Seattle Should Target After the Draft",
        "Undrafted free agent targets — position needs, college film, fit.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        None, "backlog", 1, "2026-04-28"
    ),
    (
        "cooper-kupp-age-33-season",
        "Cooper Kupp Age-33 Season — What to Expect From Historical Comps",
        "Aging curve analysis for Kupp based on similar WR career arcs.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        None, "backlog", 0, None
    ),
    (
        "demarcus-lawrence-last-ride",
        "DeMarcus Lawrence at 34 — Is This the Last Ride?",
        "Veteran EDGE durability, production trends, and Seattle's plan if he declines.",
        "seahawks", '["seahawks"]', "proposed", 1, 2,
        None, "backlog", 0, None
    ),
    (
        "nwosu-injury-concern-20m",
        "The Uchenna Nwosu Injury Concern — $20M for a Guy Who Can't Stay Healthy?",
        "Nwosu availability history, injury risk analysis, and cap value.",
        "seahawks", '["seahawks"]', "proposed", 1, 3,
        None, "backlog", 0, None
    ),
]

# ── 3. Insert ideas (skip already-existing IDs) ───────────────────────────────
inserted = 0
skipped = 0
for idea in ideas:
    try:
        conn.execute(
            """INSERT INTO articles
               (id, title, subtitle, primary_team, teams, status, current_stage,
                depth_level, target_publish_date, publish_window, time_sensitive, expires_at,
                created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))""",
            idea
        )
        inserted += 1
    except sqlite3.IntegrityError:
        skipped += 1

conn.commit()

# ── 4. Verify ─────────────────────────────────────────────────────────────────
print(f"\n✅ Inserted {inserted} ideas | Skipped {skipped} existing\n")
print("=== Pipeline Board ===")
for row in conn.execute("""
    SELECT status, publish_window, COUNT(*) as n
    FROM articles
    GROUP BY status, publish_window
    ORDER BY status, publish_window
"""):
    print(f"  {row[0]:12} | {str(row[1]):18} | {row[2]} articles")

print("\n=== Time-Sensitive Ideas (soonest first) ===")
for row in conn.execute("""
    SELECT id, target_publish_date, expires_at, publish_window
    FROM articles
    WHERE time_sensitive = 1 AND status = 'proposed'
    ORDER BY target_publish_date NULLS LAST
    LIMIT 10
"""):
    exp = f"  expires {row[2]}" if row[2] else ""
    print(f"  {str(row[1]):12} {row[3]:15} {row[0]}{exp}")

conn.close()

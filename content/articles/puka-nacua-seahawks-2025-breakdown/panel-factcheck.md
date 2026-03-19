# Panel Fact-Check Preflight: Puka Nacua vs Seattle (2025)

**Article:** `puka-nacua-seahawks-2025-breakdown`  
**Stage:** 4 → 5 gate  
**Owner:** Lead  
**Status:** ✅ Clear to Draft with cautions

---

## Verified Claims

| Claim | Status | Notes |
|-------|--------|-------|
| Puka posted 24 targets, 19 catches, 300 yards, 2 TD, 17.457 EPA vs Seattle in the 2025 regular season | ✅ Clear | Verified from `pbp_2025.parquet` with `receiver_player_name='P.Nacua'` |
| Week 11 split: 8 targets, 7 catches, 75 yards, 0 TD, 0.147 EPA | ✅ Clear | Verified from `game_id='2025_11_SEA_LA'` |
| Week 16 split: 16 targets, 12 catches, 225 yards, 2 TD, 17.310 EPA | ✅ Clear | Verified from `game_id='2025_16_LA_SEA'` |
| Week 16 accounted for 75.0% of the yards and 99.2% of the EPA in the Seattle split | ✅ Clear | Arithmetic verified from game splits |
| Puka's 2025 season line: 166 targets, 129 catches, 1,715 yards, 10 TD, 115.700 EPA | ✅ Clear | Verified from `player_stats_2025.parquet` and query script |
| Seattle's 2025 defense: -0.121 EPA/play allowed, 42.5% success rate allowed, 47 sacks, 18 INT | ✅ Clear | Verified from `query_team_efficiency.py --team SEA --season 2025` |
| LA's 2025 offense: 0.138 EPA/play, 53.6% success rate, 0.252 pass EPA/play | ✅ Clear | Verified from `query_team_efficiency.py --team LA --season 2025` |
| Seattle was Puka's biggest opponent split by receiving yardage in 2025 | ✅ Clear | Verified by grouping `pbp_2025.parquet` by `defteam` |

---

## Cautions

| Claim Type | Status | Guidance |
|------------|--------|----------|
| "Seattle had no answer" | ⚠️ Caution | Too absolute. Week 11 was productive but manageable; Week 16 drove most of the damage. |
| "Seattle was uniquely helpless" | ⚠️ Caution | Not fully supported. Puka posted a higher opponent EPA total against Arizona than against Seattle. |
| Motion / leverage / route-family mechanism claims | ⚠️ Caution | These are football inferences from the Offense lane, not directly measured by the provided data. Present as interpretation, not charted fact. |
| "This proves a broken Seattle defense" | ⚠️ Caution | Conflicts with Seattle's season-long elite defensive profile. Keep the frame to a divisional stress point or structural tradeoff. |

---

## Unsafe / Unsupported Details to Avoid

| Detail | Status | Why |
|--------|--------|-----|
| Specific route-charting or alignment counts for Puka vs Seattle | 🔴 Halt | Not present in the provided artifacts |
| Assigning blame to one individual defender on specific snaps | 🔴 Halt | The source set does not include charted coverage responsibility |
| Claiming the Rams repeated one exact concept from Week 11 into Week 16 as a documented fact | 🔴 Halt | Plausible football inference, but not verified by a route-chart source in the artifact set |

---

## Quotable Passages Safe for Writer

- SEA: "An elite defense can still have one opponent-specific leak, and in 2025 Puka Nacua was Seattle's leak."
- Analytics: "If you strip away the rhetoric, Week 16 produced 75% of the yards and 99% of the EPA in this entire Seattle split."
- LAR: "Week 16 was not the Rams discovering Puka against Seattle; it was the Rams realizing Seattle still had no better answer once the game turned into a volume fight."
- Offense: "The Rams did not just feed Puka; they kept making Seattle defend him on the move, and that is where the structure started losing."

---

## Draft Guidance

Writer should frame the article around a narrow but strong question:

- Seattle did have a real Puka problem in 2025.
- The evidence for the scale of that problem is heavily concentrated in Week 16.
- The mechanism is best written as a schematic interpretation, not a charted certainty.
- The safest verdict is that Seattle faced a real divisional stress point, not that the defense was fundamentally unsound.

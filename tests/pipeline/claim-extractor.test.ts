import { describe, it, expect } from 'vitest';
import {
  extractClaims,
  extractClaimedPlayers,
  totalClaimCount,
  type ExtractedClaims,
} from '../../src/pipeline/claim-extractor.js';

// ---------------------------------------------------------------------------
// Test data — sample panel markdown containing various claim types
// ---------------------------------------------------------------------------

const SAMPLE_PANEL = `
## SEA — Seahawks Team Context

The Seahawks are in an interesting position this offseason. **Sam Darnold** has posted a solid
+0.12 EPA per dropback since arriving, which ranks among the top 15 quarterbacks in the league.
He threw for 3,200 passing yards and 22 touchdowns against 14 interceptions. His completion
percentage of 65.8% completion rate is respectable but not elite.

**Kenneth Walker III** contributed 1,050 rushing yards and the team's run game saw a 42.5% success rate.

**Jaxon Smith-Njigba** finished with 1,120 receiving yards and a 24.3% target share, ranking him
as a top 10 receiver by target volume.

## Cap — Salary Cap Analysis

The extension for **Devon Witherspoon** is expected to cost $19.5 million per year on a
5-year deal worth roughly $98 million. The cap hit in year one would be approximately
$12 million cap hit, with dead money protections kicking in after year 3.

**Leonard Williams** carries a $22 million cap hit this season.

## Draft — Historical Context

**Jaxon Smith-Njigba** was selected in round 1, pick 20 overall of the 2023 NFL Draft.
He was a 1st-round pick who has outperformed most receivers taken in that range.

**Kenneth Walker III**, a 2nd-round pick drafted in round 2 of the 2022 draft, has been
a solid contributor. He was the No. 41 overall pick.

**Devon Witherspoon** was the No. 5 overall pick in the 2023 NFL Draft and quickly became
one of the best cornerbacks in football.

## Analytics — Advanced Metrics

**Sam Darnold** posted a +2.5 CPOE and an 88.4 passer rating. Among qualified starters,
he ranked #12 in passing EPA. His performance was the best in the NFL among mid-tier
quarterback contracts.

**Leonard Williams** recorded 7.5 sacks and led the league in pressures among interior
defensive linemen. He had 52 total tackles on the season.
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('claim-extractor', () => {
  describe('extractClaims', () => {
    let claims: ExtractedClaims;

    // Extract once, test many
    claims = extractClaims(SAMPLE_PANEL);

    it('extracts statistical claims', () => {
      expect(claims.statClaims.length).toBeGreaterThan(0);

      // Check for specific stat claims (name must appear in the same sentence)
      const epa = claims.statClaims.find(c => c.player === 'Sam Darnold' && c.metric === 'EPA');
      expect(epa).toBeDefined();

      // "He threw for 3,200 passing yards" uses pronoun — not extractable from SAMPLE.
      // Verify direct name references work:
      const directClaims = extractClaims('Sam Darnold threw for 3,200 passing yards this season.');
      const passingYards = directClaims.statClaims.find(c =>
        c.player === 'Sam Darnold' && c.metric === 'passing_yards',
      );
      expect(passingYards).toBeDefined();
      expect(passingYards?.value).toContain('3,200');

      const rushYards = claims.statClaims.find(c =>
        c.player === 'Kenneth Walker III' && c.metric === 'rushing_yards',
      );
      expect(rushYards).toBeDefined();

      const recYards = claims.statClaims.find(c =>
        c.player === 'Jaxon Smith-Njigba' && c.metric === 'receiving_yards',
      );
      expect(recYards).toBeDefined();
    });

    it('extracts touchdown claims when name is in same sentence', () => {
      // In SAMPLE, "He threw for...22 touchdowns" uses pronoun — not extractable.
      // Direct name reference works:
      const directClaims = extractClaims('Sam Darnold threw for 22 touchdowns this season.');
      const tds = directClaims.statClaims.find(c =>
        c.player === 'Sam Darnold' && c.metric === 'touchdowns',
      );
      expect(tds).toBeDefined();
      expect(tds?.value).toBe('22');
    });

    it('extracts interception claims when name is adjacent', () => {
      // In the sample, "He threw for ... 14 interceptions" uses a pronoun.
      // Direct name reference works:
      const directText = 'Sam Darnold threw for 3,200 passing yards and 22 touchdowns against 14 interceptions.';
      const directClaims = extractClaims(directText);
      const ints = directClaims.statClaims.find(c =>
        c.player === 'Sam Darnold' && c.metric === 'interceptions',
      );
      expect(ints).toBeDefined();
      expect(ints?.value).toBe('14');
    });

    it('extracts sack claims', () => {
      const sacks = claims.statClaims.find(c =>
        c.player === 'Leonard Williams' && c.metric === 'sacks',
      );
      expect(sacks).toBeDefined();
      expect(sacks?.value).toBe('7.5');
    });

    it('extracts target share claims', () => {
      const ts = claims.statClaims.find(c =>
        c.player === 'Jaxon Smith-Njigba' && c.metric === 'target_share',
      );
      expect(ts).toBeDefined();
      expect(ts?.value).toBe('24.3');
    });

    it('extracts CPOE claims', () => {
      const cpoe = claims.statClaims.find(c =>
        c.player === 'Sam Darnold' && c.metric === 'cpoe',
      );
      expect(cpoe).toBeDefined();
    });

    it('extracts tackle claims when name is adjacent', () => {
      // Note: "He had 52 tackles" uses a pronoun, not a name — not extractable.
      // But "Leonard Williams recorded 52 tackles" would be.
      const directText = 'Leonard Williams recorded 52 total tackles this season.';
      const directClaims = extractClaims(directText);
      const tackles = directClaims.statClaims.find(c =>
        c.player === 'Leonard Williams' && c.metric === 'tackles',
      );
      expect(tackles).toBeDefined();
      expect(tackles?.value).toBe('52');
    });

    it('extracts contract claims', () => {
      expect(claims.contractClaims.length).toBeGreaterThan(0);

      const witherspoonContract = claims.contractClaims.find(c =>
        c.player === 'Devon Witherspoon',
      );
      expect(witherspoonContract).toBeDefined();
    });

    it('extracts draft claims', () => {
      expect(claims.draftClaims.length).toBeGreaterThan(0);

      const jsnDraft = claims.draftClaims.find(c =>
        c.player === 'Jaxon Smith-Njigba',
      );
      expect(jsnDraft).toBeDefined();
      if (jsnDraft?.round) expect(jsnDraft.round).toBe(1);
      if (jsnDraft?.pick) expect(jsnDraft.pick).toBe(20);

      const walker = claims.draftClaims.find(c =>
        c.player === 'Kenneth Walker III',
      );
      expect(walker).toBeDefined();

      const witherspoon = claims.draftClaims.find(c =>
        c.player === 'Devon Witherspoon',
      );
      expect(witherspoon).toBeDefined();
      if (witherspoon?.pick) expect(witherspoon.pick).toBe(5);
    });

    it('extracts performance/ranking claims', () => {
      expect(claims.performanceClaims.length).toBeGreaterThan(0);

      // "top 15" / "top 10" / "ranked #12" / "led the league" / "best in the NFL"
      const hasRanking = claims.performanceClaims.some(c =>
        c.raw.toLowerCase().includes('top') ||
        c.raw.toLowerCase().includes('ranked') ||
        c.raw.toLowerCase().includes('led the league') ||
        c.raw.toLowerCase().includes('best in the nfl'),
      );
      expect(hasRanking).toBe(true);
    });
  });

  describe('extractClaimedPlayers', () => {
    it('returns unique player names across all claim types', () => {
      const claims = extractClaims(SAMPLE_PANEL);
      const players = extractClaimedPlayers(claims);

      expect(players).toContain('Sam Darnold');
      expect(players).toContain('Kenneth Walker III');
      expect(players).toContain('Jaxon Smith-Njigba');
      expect(players).toContain('Devon Witherspoon');
      expect(players).toContain('Leonard Williams');

      // No duplicates
      expect(new Set(players).size).toBe(players.length);
    });
  });

  describe('totalClaimCount', () => {
    it('sums claims across all categories', () => {
      const claims = extractClaims(SAMPLE_PANEL);
      const total = totalClaimCount(claims);

      expect(total).toBeGreaterThan(10); // Should have many claims from the sample
      expect(total).toBe(
        claims.statClaims.length +
        claims.contractClaims.length +
        claims.draftClaims.length +
        claims.performanceClaims.length,
      );
    });

    it('returns 0 for text with no claims', () => {
      const claims = extractClaims('This is a plain text article about the offseason with no statistics.');
      expect(totalClaimCount(claims)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const claims = extractClaims('');
      expect(totalClaimCount(claims)).toBe(0);
    });

    it('handles text with no player names', () => {
      const claims = extractClaims('The team needs to improve their 45.2% success rate and reduce the 3.5 sacks per game.');
      expect(claims.statClaims.length).toBe(0);
    });

    it('handles players with suffixes (Jr., III)', () => {
      const text = '**Kenneth Walker III** rushed for 1,050 rushing yards. **Odell Beckham Jr.** had 500 receiving yards.';
      const claims = extractClaims(text);

      const walker = claims.statClaims.find(c => c.player === 'Kenneth Walker III');
      expect(walker).toBeDefined();
    });

    it('deduplicates identical claims', () => {
      const text = '**Sam Darnold** threw for 3,200 passing yards. As mentioned, **Sam Darnold** had 3,200 passing yards.';
      const claims = extractClaims(text);
      const passingYardsClaims = claims.statClaims.filter(c =>
        c.player === 'Sam Darnold' && c.metric === 'passing_yards',
      );
      expect(passingYardsClaims.length).toBe(1);
    });
  });
});

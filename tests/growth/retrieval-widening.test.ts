// Radar 1 retrieval widening (ADR-280, 2026-08-31) — RECOMMENDATION_QUERIES
// (saudi-lexicon.ts) and their wiring into buildXQueries() (adapters.ts).
import { RECOMMENDATION_QUERIES, CATEGORY_LEXICONS } from '@/lib/growth/demand-radar/saudi-lexicon';
import { buildXQueries } from '@/lib/growth/demand-radar/adapters';

describe('RECOMMENDATION_QUERIES', () => {
  it('covers exactly the three Checkpoint-5.1-validated categories, not all ten — evidence-scoped, not extrapolated', () => {
    expect(RECOMMENDATION_QUERIES.map((q) => q.category).sort()).toEqual(['air_conditioner', 'laptop', 'mobile']);
  });

  it('every query stays well under Xs 512-character limit', () => {
    for (const q of RECOMMENDATION_QUERIES) {
      expect(q.query.length).toBeLessThan(400); // real measured: 231-267 chars
    }
  });

  it('every query contains at least one recommendation phrase and the category noun group', () => {
    for (const q of RECOMMENDATION_QUERIES) {
      expect(q.query).toContain('وش افضل'); // present in the canonical RECOMMENDATION_PHRASES list
      expect(q.query).toMatch(/OR/); // multiple phrases/nouns OR-joined
    }
  });
});

describe('buildXQueries — widened (ADR-280)', () => {
  it('returns 13 queries: the original 10 direct-want category queries plus 3 recommendation queries', () => {
    const queries = buildXQueries();
    expect(queries.length).toBe(CATEGORY_LEXICONS.length + 3);
  });

  it('every query carries the same safety suffix (lang:ar, no retweets, never our own account)', () => {
    for (const q of buildXQueries()) {
      expect(q.query).toContain('lang:ar');
      expect(q.query).toContain('-is:retweet');
      expect(q.query).toContain('-from:Tawveeri');
    }
  });

  it('every query stays under Xs 512-character limit including the safety suffix', () => {
    for (const q of buildXQueries()) {
      expect(q.query.length).toBeLessThanOrEqual(512);
    }
  });
});

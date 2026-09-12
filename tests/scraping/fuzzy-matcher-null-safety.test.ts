// Samsung KSA official-catalog closure mission (2026-09-12). Proven live: a production
// recovery run crashed with "Cannot read properties of null (reading 'toLowerCase')" for
// every fuzzy-match candidate whose existing DB row had model=null — ProductMatcher.fuzzyMatch
// fetches candidates filtered only by brand+category (no model condition), so null-model rows
// are never excluded before reaching matchProducts(). This is GENERIC matching code shared by
// every merchant, not Samsung-specific: the fix must never crash on a missing model, and must
// never let two products that both merely lack a parsed model tie on a fabricated "100% model
// match" (calculateSimilarity('', '') returns 1 by its own contract) and falsely merge.
import { matchProducts } from '../../src/lib/scraping/matching/fuzzy-matcher';

const GALAXY_A = 'Samsung Galaxy A55 128GB Awesome Navy';
const GALAXY_A_MODEL_1 = 'SM-A556BZKAMEA';
// Genuinely different model string (not a near-identical color-suffix variant) — this test
// exists to prove non-null behavior is UNCHANGED by the fix, not to characterize the
// pre-existing (unmodified, out of scope) string-similarity scoring of near-identical models.
const GALAXY_A_MODEL_2 = 'SM-X710NZAAXSA';

describe('matchProducts — null/undefined/empty model never crashes, never fabricates a match', () => {
  it('null model on the existing-row side does not throw', () => {
    expect(() => matchProducts(GALAXY_A, 'Samsung', GALAXY_A_MODEL_1, GALAXY_A, 'Samsung', null)).not.toThrow();
  });

  it('undefined model on the existing-row side does not throw', () => {
    expect(() => matchProducts(GALAXY_A, 'Samsung', GALAXY_A_MODEL_1, GALAXY_A, 'Samsung', undefined)).not.toThrow();
  });

  it('empty-string model on the existing-row side does not throw', () => {
    expect(() => matchProducts(GALAXY_A, 'Samsung', GALAXY_A_MODEL_1, GALAXY_A, 'Samsung', '')).not.toThrow();
  });

  it('null model on the NEW-product side does not throw either (defense in depth)', () => {
    expect(() => matchProducts(GALAXY_A, 'Samsung', null, GALAXY_A, 'Samsung', GALAXY_A_MODEL_1)).not.toThrow();
  });

  it('same title, different real model: does not throw and returns a finite, real score (not NaN/crash)', () => {
    const score = matchProducts(GALAXY_A, 'Samsung', GALAXY_A_MODEL_1, GALAXY_A, 'Samsung', GALAXY_A_MODEL_2);
    expect(Number.isFinite(score)).toBe(true);
  });

  it('different title AND missing model on one side: low score, not a crash, not a fabricated tie', () => {
    const score = matchProducts('Samsung Galaxy S24 Ultra 512GB', 'Samsung', GALAXY_A_MODEL_1, 'Samsung Galaxy Tab S9', 'Samsung', null);
    expect(score).toBeLessThan(0.5);
  });

  it('CORE INVARIANT: two DIFFERENT products that both lack a model never tie at 100% model similarity', () => {
    // Before the fix, calculateSimilarity('', '') === 1 (its own "maxLength===0" contract),
    // which fed a fabricated perfect model-similarity into two otherwise-unrelated products.
    const score = matchProducts('Samsung Robot Vacuum Cleaner', 'Samsung', null, 'Samsung Air Purifier', 'Samsung', null);
    expect(score).toBeLessThan(0.7); // below the real matcher's own fuzzy-accept threshold
  });

  it('valid exact model on both sides still matches with high confidence (the fix must not weaken real matches)', () => {
    const score = matchProducts(GALAXY_A, 'Samsung', GALAXY_A_MODEL_1, GALAXY_A, 'Samsung', GALAXY_A_MODEL_1);
    expect(score).toBeGreaterThan(0.9);
  });

  it('no false duplicate: a real model mismatch still pulls the score down relative to an exact model match (proves modelSimilarity=0 is applied, not skipped)', () => {
    const exactMatchScore = matchProducts(GALAXY_A, 'Samsung', GALAXY_A_MODEL_1, GALAXY_A, 'Samsung', GALAXY_A_MODEL_1);
    const mismatchScore = matchProducts(GALAXY_A, 'Samsung', GALAXY_A_MODEL_1, GALAXY_A, 'Samsung', GALAXY_A_MODEL_2);
    expect(mismatchScore).toBeLessThan(exactMatchScore);
  });

  it('no false canonical merge: different brand short-circuits to 0 regardless of model nulls on either side', () => {
    expect(matchProducts(GALAXY_A, 'Samsung', null, 'LG Velvet 128GB', 'LG', null)).toBe(0);
  });

  it('missing brand on either side is also UNKNOWN, not a wildcard — never ties two brandless listings', () => {
    expect(matchProducts(GALAXY_A, null, GALAXY_A_MODEL_1, GALAXY_A, null, GALAXY_A_MODEL_1)).toBe(0);
    expect(matchProducts(GALAXY_A, undefined, GALAXY_A_MODEL_1, GALAXY_A, 'Samsung', GALAXY_A_MODEL_1)).toBe(0);
  });
});

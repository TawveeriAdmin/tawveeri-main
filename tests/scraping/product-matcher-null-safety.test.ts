// Samsung KSA official-catalog closure mission (2026-09-12). Companion to
// fuzzy-matcher-null-safety.test.ts — pins normalizeForMatching's own null-safety, the
// second call site in this generic matching code that touches DB-row brand/model values.
import { ProductMatcher } from '../../src/lib/scraping/matching/product-matcher';

describe('ProductMatcher.normalizeForMatching — null-safe, never fabricates equality', () => {
  const matcher = new ProductMatcher();

  it('null input never throws and normalizes to empty string', () => {
    expect(() => matcher.normalizeForMatching(null)).not.toThrow();
    expect(matcher.normalizeForMatching(null)).toBe('');
  });

  it('undefined input never throws and normalizes to empty string', () => {
    expect(() => matcher.normalizeForMatching(undefined)).not.toThrow();
    expect(matcher.normalizeForMatching(undefined)).toBe('');
  });

  it('a real value still normalizes exactly as before (lowercase, trimmed, special chars stripped)', () => {
    expect(matcher.normalizeForMatching('  SM-A556B/DS!  ')).toBe('sma556bds');
  });

  it('null never equals a real scraped value — no false exact-match', () => {
    const normalizedNull = matcher.normalizeForMatching(null);
    const normalizedReal = matcher.normalizeForMatching('SM-A556BZKAMEA');
    expect(normalizedNull).not.toBe(normalizedReal);
  });
});

// tests/analytics/referral-link.test.ts
// Referral-loop follow-up (2026-08-25, docs/CATEGORY-PAGES-PLAN.md §8). Pure round-trip:
// the referral code is a DERIVED slice of an already-existing identifier, never a new
// stored value — these tests pin the derivation and URL-building behavior directly,
// without a DB or a browser.
import { deriveReferralCode, appendReferralParams } from '@/lib/analytics/referral-link';

describe('deriveReferralCode', () => {
  it('takes the first 8 characters of a dash-free hex token verbatim', () => {
    expect(deriveReferralCode('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).toBe('a1b2c3d4');
  });

  it('strips dashes from a UUID session id before truncating (does not shortchange the budget)', () => {
    expect(deriveReferralCode('90638054-7fb3-4c8f-a73c-4ec2ab076048')).toBe('90638054');
  });

  it('is deterministic — the same source always yields the same code', () => {
    const source = 'b063f672-0bd0-49be-b421-cef60641f58d';
    expect(deriveReferralCode(source)).toBe(deriveReferralCode(source));
  });

  it('lowercases the result', () => {
    expect(deriveReferralCode('ABCD1234EFGH')).toBe('abcd1234');
  });

  it('strips any non-alphanumeric separator, not just dashes', () => {
    expect(deriveReferralCode('s-abc123def456')).toBe('sabc123d');
  });

  it('returns a shorter string (not padded/erroring) when the source itself is short', () => {
    expect(deriveReferralCode('ab')).toBe('ab');
  });

  it('never returns more than 8 characters, however long the source', () => {
    expect(deriveReferralCode('x'.repeat(200)).length).toBe(8);
  });
});

describe('appendReferralParams', () => {
  it('appends the exact 3-field UTM set (utm_campaign deliberately absent) to a URL with no existing query', () => {
    const url = appendReferralParams('https://tawveeri.com/ar/plan/abcd1234efgh', 'home_mission_share', 'abcd1234');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('utm_source')).toBe('referral');
    expect(parsed.searchParams.get('utm_medium')).toBe('home_mission_share');
    expect(parsed.searchParams.get('utm_content')).toBe('abcd1234');
    expect(parsed.searchParams.has('utm_campaign')).toBe(false);
  });

  it('appends with & when the URL already carries a query string (Decision Card share of a /search?q=... URL)', () => {
    const url = appendReferralParams('https://tawveeri.com/ar/search?q=iphone', 'decision_card_share', '90638054');
    expect(url).toBe('https://tawveeri.com/ar/search?q=iphone&utm_source=referral&utm_medium=decision_card_share&utm_content=90638054');
  });

  it('never mutates the path or an existing param — only ever appends new query params', () => {
    const url = appendReferralParams('https://tawveeri.com/ar/plan/xyz?foo=bar', 'home_mission_share', 'xyz12345');
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/ar/plan/xyz');
    expect(parsed.searchParams.get('foo')).toBe('bar');
  });

  it('the resulting URL round-trips through initCampaignFromUrl\'s own read shape (utm_source present + truthy)', () => {
    const url = appendReferralParams('/ar/plan/tok', 'home_mission_share', 'code1234');
    const qs = url.split('?')[1];
    const params = new URLSearchParams(qs);
    expect(params.get('utm_source')).toBeTruthy();
  });
});

// tests/campaigns/traffic-eligibility.test.ts
// Founder mission §4 — merchant-specific traffic eligibility contract, pure functions.
import { classifyTrafficSource, isTrafficEligibleForMerchant } from '@/lib/campaigns/traffic-eligibility';

describe('classifyTrafficSource', () => {
  it('no campaign cookie at all → organic_direct (the default, safe majority case)', () => {
    expect(classifyTrafficSource(null, false)).toBe('organic_direct');
    expect(classifyTrafficSource(undefined, false)).toBe('organic_direct');
  });

  it('a campaign object with no utm_source → organic_direct', () => {
    expect(classifyTrafficSource({}, false)).toBe('organic_direct');
  });

  it('is_test always wins, regardless of any campaign params present', () => {
    expect(classifyTrafficSource({ utm_source: 'google', utm_medium: 'cpc' }, true)).toBe('internal_test');
  });

  it('google + a paid medium → google_paid_search', () => {
    expect(classifyTrafficSource({ utm_source: 'google', utm_medium: 'cpc' }, false)).toBe('google_paid_search');
  });

  it('a non-google paid medium → other_paid_social', () => {
    expect(classifyTrafficSource({ utm_source: 'facebook', utm_medium: 'paid_social' }, false)).toBe('other_paid_social');
  });

  it('x/twitter without a paid medium → x_organic', () => {
    expect(classifyTrafficSource({ utm_source: 'x', utm_medium: 'social' }, false)).toBe('x_organic');
    expect(classifyTrafficSource({ utm_source: 'twitter', utm_medium: 'social' }, false)).toBe('x_organic');
  });

  it('tiktok without a paid medium → tiktok_organic', () => {
    expect(classifyTrafficSource({ utm_source: 'tiktok', utm_medium: 'social' }, false)).toBe('tiktok_organic');
  });

  it('email medium → email', () => {
    expect(classifyTrafficSource({ utm_source: 'newsletter', utm_medium: 'email' }, false)).toBe('email');
  });

  it('referral medium → referral', () => {
    expect(classifyTrafficSource({ utm_source: 'partner-site', utm_medium: 'referral' }, false)).toBe('referral');
  });

  it('an unrecognized source/medium combo → unknown, never guessed into organic', () => {
    expect(classifyTrafficSource({ utm_source: 'some-weird-thing', utm_medium: 'mystery' }, false)).toBe('unknown');
  });
});

describe('isTrafficEligibleForMerchant', () => {
  it('organic_direct is eligible for both merchants', () => {
    expect(isTrafficEligibleForMerchant('amazon', 'organic_direct').eligibility).toBe('eligible');
    expect(isTrafficEligibleForMerchant('noon', 'organic_direct').eligibility).toBe('eligible');
  });

  it('internal_test is ineligible for both merchants', () => {
    expect(isTrafficEligibleForMerchant('amazon', 'internal_test').eligibility).toBe('ineligible');
    expect(isTrafficEligibleForMerchant('noon', 'internal_test').eligibility).toBe('ineligible');
  });

  it('paid search is ineligible for both merchants today, with a merchant-specific reason code', () => {
    const amazon = isTrafficEligibleForMerchant('amazon', 'google_paid_search');
    const noon = isTrafficEligibleForMerchant('noon', 'google_paid_search');
    expect(amazon.eligibility).toBe('ineligible');
    expect(noon.eligibility).toBe('ineligible');
    expect(amazon.reasonCode).not.toBe(noon.reasonCode); // per-merchant table, not a shared constant
  });

  it('unknown provenance is NEVER treated as eligible — mission §4\'s own rule', () => {
    expect(isTrafficEligibleForMerchant('amazon', 'unknown').eligibility).toBe('unknown');
    expect(isTrafficEligibleForMerchant('noon', 'unknown').eligibility).toBe('unknown');
    expect(isTrafficEligibleForMerchant('amazon', 'unknown').eligibility).not.toBe('eligible');
  });

  it('x_organic, tiktok_organic, email, referral are all eligible for both merchants', () => {
    for (const cls of ['x_organic', 'tiktok_organic', 'email', 'referral', 'seo'] as const) {
      expect(isTrafficEligibleForMerchant('amazon', cls).eligibility).toBe('eligible');
      expect(isTrafficEligibleForMerchant('noon', cls).eligibility).toBe('eligible');
    }
  });
});

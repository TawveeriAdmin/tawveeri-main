// tests/campaigns/destination-resolver.test.ts
// Amazon Decision Layer V2 §12 regression proofs for resolveAmazonDestination().
import {
  resolveAmazonDestination,
  sanitizeModelSearchTerm,
  EXACT_IDENTITY_CONFIDENCE_THRESHOLD,
  type LiveCategoryDestination,
} from '@/lib/campaigns/destination-resolver';

const LIVE = new Map<string, LiveCategoryDestination>([
  ['tv', { destinationUrl: 'https://www.amazon.sa/s?rh=n:16966461031', trackingId: 'tawveeri0f-tv-21' }],
  ['tablet', { destinationUrl: 'https://www.amazon.sa/s?rh=n:16966433031', trackingId: 'tawveeri0f-tablet-21' }],
]);

function baseGoodRequest() {
  return {
    category: 'tv',
    canonicalProductId: 'prod-1',
    canonicalIdentityConfidence: 0.95,
    exactAmazonProductUrl: 'https://www.amazon.sa/dp/B0EXACT123',
    offerFreshnessHours: 12,
    liveCategoryCampaigns: LIVE,
  };
}

describe('resolveAmazonDestination — CATEGORY mode (fail-closed default)', () => {
  it('returns the live category destination when no product/identity evidence is supplied', () => {
    const r = resolveAmazonDestination({ category: 'tv', liveCategoryCampaigns: LIVE });
    expect(r.mode).toBe('category');
    expect(r.destination).toBe('https://www.amazon.sa/s?rh=n:16966461031');
    expect(r.trackingId).toBe('tawveeri0f-tv-21');
    expect(r.allowPriceDisplay).toBe(false);
  });

  it('is unavailable for a category not in the live map (never fabricates a destination)', () => {
    const r = resolveAmazonDestination({ category: 'air_fryer', liveCategoryCampaigns: LIVE });
    expect(r.mode).toBe('unavailable');
    expect(r.destination).toBeNull();
    expect(r.reasonCode).toBe('category_not_live');
  });

  it('is unavailable when category is null/unresolved', () => {
    const r = resolveAmazonDestination({ category: null, liveCategoryCampaigns: LIVE });
    expect(r.mode).toBe('unavailable');
    expect(r.reasonCode).toBe('category_unresolved');
  });

  it('a disabled/new category can never reach this resolver even with strong product evidence, because the caller controls the live map (§5 structural guarantee)', () => {
    const r = resolveAmazonDestination({
      ...baseGoodRequest(),
      category: 'air_fryer', // not in LIVE
    });
    expect(r.mode).toBe('unavailable');
  });
});

describe('resolveAmazonDestination — EXACT_PRODUCT mode', () => {
  it('resolves exact_product when every gate passes', () => {
    const r = resolveAmazonDestination(baseGoodRequest());
    expect(r.mode).toBe('exact_product');
    expect(r.destination).toBe('https://www.amazon.sa/dp/B0EXACT123');
    expect(r.canonicalProductId).toBe('prod-1');
    expect(r.allowPriceDisplay).toBe(false);
  });

  it('falls back when canonical identity confidence is below threshold (ambiguous identity never becomes exact)', () => {
    const r = resolveAmazonDestination({ ...baseGoodRequest(), canonicalIdentityConfidence: EXACT_IDENTITY_CONFIDENCE_THRESHOLD - 0.01 });
    expect(r.mode).not.toBe('exact_product');
  });

  it('falls back when there is no canonical product id at all', () => {
    const r = resolveAmazonDestination({ ...baseGoodRequest(), canonicalProductId: null });
    expect(r.mode).not.toBe('exact_product');
  });

  it('falls back when the Amazon offer is stale beyond MAX_OFFER_FRESHNESS_HOURS', () => {
    const r = resolveAmazonDestination({ ...baseGoodRequest(), offerFreshnessHours: 9999 });
    expect(r.mode).not.toBe('exact_product');
  });

  it('falls back when offer freshness is unknown (null) — unknown never defaults to fresh', () => {
    const r = resolveAmazonDestination({ ...baseGoodRequest(), offerFreshnessHours: null });
    expect(r.mode).not.toBe('exact_product');
  });

  it('fails closed on accessory leakage risk (never routes an accessory query to a device exact-match)', () => {
    const r = resolveAmazonDestination({ ...baseGoodRequest(), accessoryLeakageRisk: true });
    expect(r.mode).not.toBe('exact_product');
  });

  it('fails closed on a renewed/new condition mismatch', () => {
    const r = resolveAmazonDestination({ ...baseGoodRequest(), conditionMismatch: true });
    expect(r.mode).not.toBe('exact_product');
  });

  it('fails closed on a storage/model/capacity mismatch', () => {
    const r = resolveAmazonDestination({ ...baseGoodRequest(), storageOrModelMismatch: true });
    expect(r.mode).not.toBe('exact_product');
  });

  it('fails closed on an open quality incident', () => {
    const r = resolveAmazonDestination({ ...baseGoodRequest(), openQualityIncident: true });
    expect(r.mode).not.toBe('exact_product');
  });

  it('never displays a price regardless of how strong the evidence is', () => {
    const r = resolveAmazonDestination(baseGoodRequest());
    expect(r.allowPriceDisplay).toBe(false);
  });
});

describe('resolveAmazonDestination — MODEL_SEARCH mode', () => {
  it('falls back to model_search with a sanitized k= term when exact_product is blocked but a query exists', () => {
    const r = resolveAmazonDestination({ category: 'tv', queryText: 'سوني 55 بوصة', liveCategoryCampaigns: LIVE });
    expect(r.mode).toBe('model_search');
    const url = new URL(r.destination!);
    expect(url.searchParams.get('rh')).toBe('n:16966461031');
    expect(url.searchParams.get('k')).toBe('سوني 55 بوصة');
    expect(r.trackingId).toBe('tawveeri0f-tv-21');
  });

  it('never passes arbitrary unsanitized user text through — punctuation/scripting characters are stripped', () => {
    const term = sanitizeModelSearchTerm('<script>alert(1)</script> سوني!!');
    expect(term).not.toContain('<');
    expect(term).not.toContain('>');
    expect(term).not.toContain('(');
    expect(term).not.toContain('!');
  });

  it('sanitizeModelSearchTerm returns null for empty/whitespace/punctuation-only input', () => {
    expect(sanitizeModelSearchTerm('')).toBeNull();
    expect(sanitizeModelSearchTerm('   ')).toBeNull();
    expect(sanitizeModelSearchTerm('!!!...')).toBeNull();
    expect(sanitizeModelSearchTerm(null)).toBeNull();
    expect(sanitizeModelSearchTerm(undefined)).toBeNull();
  });

  it('caps an overlong query at 60 characters', () => {
    const long = 'a'.repeat(200);
    const term = sanitizeModelSearchTerm(long);
    expect(term!.length).toBeLessThanOrEqual(60);
  });
});

describe('resolveAmazonDestination — tracking ID never becomes user/session-specific', () => {
  it('the resolved trackingId is always exactly the campaign-level id from the live map, never derived from request context', () => {
    const withQuery = resolveAmazonDestination({ category: 'tablet', queryText: 'ابل ايباد', liveCategoryCampaigns: LIVE });
    const withoutQuery = resolveAmazonDestination({ category: 'tablet', liveCategoryCampaigns: LIVE });
    expect(withQuery.trackingId).toBe('tawveeri0f-tablet-21');
    expect(withoutQuery.trackingId).toBe('tawveeri0f-tablet-21');
    expect(withQuery.trackingId).toBe(withoutQuery.trackingId);
  });

  it('the resolution object never carries a session/user identifier field', () => {
    const r = resolveAmazonDestination(baseGoodRequest());
    expect(Object.keys(r)).not.toContain('sessionId');
    expect(Object.keys(r)).not.toContain('userId');
  });
});

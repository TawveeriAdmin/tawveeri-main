// tests/intelligence/merchant-twin.test.ts
// Pure unit tests for the Merchant Digital Twin — no DB, synthetic rows only.

import {
  computeMerchantTwin,
  CORROBORATION_MIN,
  MERCHANT_TWIN_VERSION,
  type MerchantTwinInput,
  type MerchantOfferRow,
  type MerchantObservationRow,
} from '@/lib/intelligence/merchant-twin';

const NOW = new Date('2026-07-20T00:00:00.000Z');

function offer(
  id: string,
  category: string | null,
  store_count: number | null,
  cheapest_store: string | null,
): MerchantOfferRow {
  return { canonical_product_id: id, category, store_count, cheapest_store };
}

function obs(availability: string | null, scraped_at?: string): MerchantObservationRow {
  return { availability, price: 100, scraped_at };
}

// Extra (store 4) carrying 5 products:
//  - p1 tv, 3 stores, Extra cheapest
//  - p2 tv, 2 stores, Amazon cheapest
//  - p3 mobile, 2 stores, Extra cheapest
//  - p4 laptop, 1 store (not corroborated)
//  - p5 no category, 1 store (not corroborated)
function extraInput(): MerchantTwinInput {
  return {
    store_id: 4,
    store_name: 'Extra',
    store_aliases: ['extra', 'اكسترا'],
    observation_count: 41340,
    observations: [
      obs('in_stock', '2026-07-19T10:00:00Z'),
      obs('in_stock', '2026-07-20T09:00:00Z'),
      obs('out_of_stock', '2026-07-18T10:00:00Z'),
      obs(null, '2026-07-17T10:00:00Z'),
    ],
    offers: [
      offer('p1', 'tv', 3, 'اكسترا'),
      offer('p2', 'tv', 2, 'أمازون'),
      offer('p3', 'mobile', 2, 'اكسترا'),
      offer('p4', 'laptop', 1, 'جرير'),
      offer('p5', null, 1, null),
    ],
    now: NOW,
  };
}

describe('computeMerchantTwin', () => {
  it('reports store identity, version and ranking-blind marker', () => {
    const t = computeMerchantTwin(extraInput());
    expect(t.store_id).toBe(4);
    expect(t.store_name).toBe('Extra');
    expect(t.version).toBe(MERCHANT_TWIN_VERSION);
    expect(t.ranking_blind).toBe(true);
    expect(t.generated_at).toBe('2026-07-20T00:00:00.000Z');
  });

  it('counts observations and distinct products', () => {
    const t = computeMerchantTwin(extraInput());
    expect(t.observation_count).toBe(41340); // authoritative total, not sample size
    expect(t.distinct_products).toBe(5);
  });

  it('computes category_coverage with distinct-product counts, sorted desc', () => {
    const t = computeMerchantTwin(extraInput());
    expect(t.category_coverage).toEqual([
      { category: 'tv', product_count: 2 },
      // ties broken alphabetically: laptop < mobile
      { category: 'laptop', product_count: 1 },
      { category: 'mobile', product_count: 1 },
    ]);
    // p5 (null category) is excluded from coverage.
  });

  it('computes corroborated_share (≥2-store products / distinct products)', () => {
    const t = computeMerchantTwin(extraInput());
    // p1,p2,p3 are ≥2-store → 3 of 5 = 0.6
    expect(t.corroboration.corroborated_products).toBe(3);
    expect(t.corroboration.corroborated_share).toBe(0.6);
  });

  it('computes price_competitiveness only over corroborated products', () => {
    const t = computeMerchantTwin(extraInput());
    // corroborated = p1,p2,p3 (3). Extra is cheapest on p1 & p3 → 2 of 3 ≈ 0.67
    expect(t.price_competitiveness.corroborated_products).toBe(3);
    expect(t.price_competitiveness.cheapest_count).toBe(2);
    expect(t.price_competitiveness.cheapest_share).toBe(0.67);
  });

  it('matches cheapest_store across alias forms (Arabic + slug), Arabic-normalized', () => {
    const t = computeMerchantTwin({
      ...extraInput(),
      offers: [
        offer('a', 'tv', 2, 'اكسترا'), // Arabic form
        offer('b', 'tv', 2, 'extra'), // slug form
        offer('c', 'tv', 2, 'أمازون'), // another store
      ],
    });
    expect(t.price_competitiveness.cheapest_count).toBe(2);
    expect(t.price_competitiveness.cheapest_share).toBe(0.67);
  });

  it('computes availability over KNOWN statuses only (unknown excluded from share)', () => {
    const t = computeMerchantTwin(extraInput());
    expect(t.availability.sampled).toBe(4);
    expect(t.availability.in_stock).toBe(2);
    expect(t.availability.out_of_stock).toBe(1);
    expect(t.availability.unknown).toBe(1);
    // in_stock / (in_stock + out_of_stock) = 2/3 ≈ 0.67
    expect(t.availability.in_stock_share).toBe(0.67);
    expect(t.availability.latest_observed_at).toBe('2026-07-20T09:00:00Z');
  });

  it('computes data_completeness as the mean of five evidence factors', () => {
    const t = computeMerchantTwin(extraInput());
    // observations=1, identity=1, category=4/5=0.8, corroboration=0.6, availability=1
    expect(t.data_completeness_factors).toEqual({
      observations: 1,
      identity_resolution: 1,
      category_coverage: 0.8,
      corroboration: 0.6,
      availability: 1,
    });
    // mean = (1+1+0.8+0.6+1)/5 = 0.88
    expect(t.data_completeness).toBe(0.88);
  });

  it('uses the constitutional corroboration threshold of 2', () => {
    expect(CORROBORATION_MIN).toBe(2);
    const t = computeMerchantTwin({
      ...extraInput(),
      offers: [offer('x', 'tv', 1, null), offer('y', 'tv', 2, 'اكسترا')],
    });
    expect(t.corroboration.corroborated_products).toBe(1); // only the 2-store one
  });

  it('returns null shares (never a fabricated 0-of-0) when there is no denominator', () => {
    const t = computeMerchantTwin({
      store_id: 2,
      store_name: 'Amazon',
      store_aliases: ['amazon', 'أمازون'],
      observation_count: 0,
      observations: [],
      offers: [],
    });
    expect(t.distinct_products).toBe(0);
    expect(t.corroboration.corroborated_share).toBeNull();
    expect(t.price_competitiveness.cheapest_share).toBeNull();
    expect(t.availability.in_stock_share).toBeNull();
    expect(t.availability.latest_observed_at).toBeNull();
    // all five factors zero → completeness 0
    expect(t.data_completeness).toBe(0);
  });

  it('cheapest_share is null when the store has no corroborated products', () => {
    const t = computeMerchantTwin({
      ...extraInput(),
      offers: [offer('p', 'tv', 1, 'اكسترا')], // single-store only
    });
    expect(t.corroboration.corroborated_share).toBe(0);
    expect(t.price_competitiveness.corroborated_products).toBe(0);
    expect(t.price_competitiveness.cheapest_share).toBeNull();
  });

  it('deduplicates offers by canonical id (defensive against duplicate price rows)', () => {
    const t = computeMerchantTwin({
      ...extraInput(),
      offers: [
        offer('dup', 'tv', 2, 'اكسترا'),
        offer('dup', 'tv', 2, 'اكسترا'),
        offer('dup', 'tv', 2, 'اكسترا'),
      ],
    });
    expect(t.distinct_products).toBe(1);
    expect(t.corroboration.corroborated_products).toBe(1);
  });

  it('emits no commercial / ranking fields anywhere in the output', () => {
    const t = computeMerchantTwin(extraInput());
    const json = JSON.stringify(t).toLowerCase();
    for (const banned of ['commission', 'affiliate', 'revenue', 'go_url', 'payout']) {
      expect(json).not.toContain(banned);
    }
  });
});

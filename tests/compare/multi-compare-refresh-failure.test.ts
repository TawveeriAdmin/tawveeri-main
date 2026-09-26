// tests/compare/multi-compare-refresh-failure.test.ts — ADR-389 §7.
// What the multi-product tool does when the knowledge-layer refresh FAILS, proven with an
// injected fetch (no network, no production). Fixed clock. Distinguishes a network failure
// (snapshot kept, disclosed) from a correct answer that says "no offers" (nothing resurrected).
import { refreshFromKnowledgeLayer, deriveProductOfferFacts, type ProductStore } from '@/app/[locale]/(public)/compare/page';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const store = (id: string, price: number, observed_at: string | null): ProductStore => ({
  id: `store-${id}`, current_price: price, original_price: null, availability: 'in_stock',
  delivery_time_days: null, delivery_cost: null, is_free_delivery: null, product_url: '/go/snap', affiliate_url: '/go/snap', observed_at,
  stores: { id, name_ar: id, name_en: id, logo_url: null, website_url: '', delivery_info_ar: null, delivery_info_en: null, return_policy_ar: null, return_policy_en: null, warranty_info_ar: null, warranty_info_en: null },
});
const base = { id: 'grouped-x', name_ar: 'x', name_en: 'x', slug: 'x', category: 'air_conditioner' as const, brand: 'lg', model: '', image_urls: null, specifications: null, tps_identity_key: 'lg|split|ArtCool|18000|Inverter|cool_only' };
const freshSnapshot = { ...base, id: 'fresh', product_stores: [store('alnakheelk', 3269, daysAgo(1)), store('extra', 3669, daysAgo(2))] };
const staleSnapshot = { ...base, id: 'stale', product_stores: [store('amazon', 2949, daysAgo(12)), store('noon', 3369, daysAgo(36))] };

const failingFetch = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
const status = (code: number, body?: unknown) => (async () => ({ ok: code >= 200 && code < 300, status: code, json: async () => body })) as unknown as typeof fetch;

describe('refreshFromKnowledgeLayer — failure semantics', () => {
  it('network failure: the snapshot is kept with its ORIGINAL observation times and flagged failed', async () => {
    const [out] = await refreshFromKnowledgeLayer([freshSnapshot], 'ar', failingFetch);
    expect(out.refresh_status).toBe('failed');
    expect(out.product_stores.map((s) => s.observed_at)).toEqual(freshSnapshot.product_stores.map((s) => s.observed_at));
    expect(out.product_stores[0].product_url).toBe('/go/snap');
  });

  it('a fresh snapshot stays eligible after a failed refresh; a stale one is excluded and NOT crowned', async () => {
    const [fresh, stale] = await refreshFromKnowledgeLayer([freshSnapshot, staleSnapshot], 'ar', failingFetch);
    const f = deriveProductOfferFacts(fresh.product_stores, NOW);
    expect(f.eligibleStoreCount).toBe(2);
    expect(f.bestIsEligible).toBe(true);
    const s = deriveProductOfferFacts(stale.product_stores, NOW);
    expect(s.eligibleStoreCount).toBe(0);
    expect(s.bestIsEligible).toBe(false); // shown as last observed, never crowned
    expect(s.best?.current_price).toBe(2949);
  });

  it('the moment of reading the cache never becomes an observation time', async () => {
    const [out] = await refreshFromKnowledgeLayer([staleSnapshot], 'ar', failingFetch);
    for (const o of out.product_stores) expect(Date.parse(o.observed_at as string)).toBeLessThan(NOW - 10 * 86_400_000);
  });

  it('5xx / 429 are failures (snapshot kept); 404 means the identity is gone (no current offers)', async () => {
    const [five] = await refreshFromKnowledgeLayer([freshSnapshot], 'ar', status(503));
    expect(five.refresh_status).toBe('failed');
    expect(five.product_stores).toHaveLength(2);
    const [limited] = await refreshFromKnowledgeLayer([freshSnapshot], 'ar', status(429));
    expect(limited.refresh_status).toBe('failed');
    const [gone] = await refreshFromKnowledgeLayer([freshSnapshot], 'ar', status(404, { error: 'not found' }));
    expect(gone.refresh_status).toBe('gone');
    expect(gone.product_stores).toEqual([]);
  });

  it('a correct 200 with no offers removes the snapshot offers (a deleted offer is not re-shown)', async () => {
    const [out] = await refreshFromKnowledgeLayer([freshSnapshot], 'ar', status(200, { canonical: {}, offers: [] }));
    expect(out.refresh_status).toBe('ok');
    expect(out.product_stores).toEqual([]);
  });

  it('a correct 200 replaces the snapshot entirely — an offer missing from the response disappears', async () => {
    const [out] = await refreshFromKnowledgeLayer([freshSnapshot], 'ar', status(200, { offers: [
      { store_slug: 'alnakheelk', store_name: 'متجر النخيل', price: 3299, availability: 'in_stock', product_url: '/go/new', observed_at: daysAgo(0.1) },
    ] }));
    expect(out.refresh_status).toBe('ok');
    expect(out.product_stores.map((s) => s.stores?.id)).toEqual(['alnakheelk']);
    expect(out.product_stores[0].current_price).toBe(3299);
  });

  it('items without an identity key are passed through untouched', async () => {
    const legacy = { ...base, id: 'legacy', tps_identity_key: null, product_stores: [store('a', 100, null)] };
    const [out] = await refreshFromKnowledgeLayer([legacy], 'ar', failingFetch);
    expect(out).toBe(legacy);
  });
});

// tests/compare/multi-compare-knowledge-refresh.test.ts — ADR-388.
// The multi-product tool restores CURRENT offers for a tray item from its saved identity key
// (the knowledge layer's own comparison) instead of trusting the localStorage snapshot.
import { applyKnowledgeLayerComparison, deriveProductOfferFacts, storeAvailabilityLabel, type ProductStore } from '@/app/[locale]/(public)/compare/page';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const snapshotStore = (id: string, price: number, observed_at: string | null): ProductStore => ({
  id: `store-${id}-x`, current_price: price, original_price: 3999, availability: 'in_stock',
  delivery_time_days: null, delivery_cost: null, is_free_delivery: null, product_url: '/go/old', affiliate_url: '/go/old', observed_at,
  stores: { id, name_ar: id, name_en: id, logo_url: null, website_url: '', delivery_info_ar: null, delivery_info_en: null, return_policy_ar: null, return_policy_en: null, warranty_info_ar: null, warranty_info_en: null },
});

const snapshot = {
  id: 'eea9c4f2-69a6-4116-b59e-1282cc7715a1', name_ar: 'مكيف سبليت ArtCool إل جي', name_en: 'LG ArtCool 18000', slug: 'lg-split-artcool-18000-inverter-cool_only',
  category: 'air_conditioner' as const, brand: 'lg', model: '', image_urls: null, specifications: null,
  tps_identity_key: 'lg|split|ArtCool|18000|Inverter|cool_only',
  // stale snapshot: taken 10 days ago, when Amazon 2,949 was 2 days old
  product_stores: [snapshotStore('amazon', 2949, daysAgo(12)), snapshotStore('alnakheel', 3199, daysAgo(10))],
};

describe('applyKnowledgeLayerComparison', () => {
  it('replaces the snapshot offers with the knowledge layer\'s current offers and keeps the identity', () => {
    const out = applyKnowledgeLayerComparison(snapshot, {
      canonical: { name_ar: 'مكيف سبليت ArtCool إل جي، 18000 وحدة، انفرتر، بارد فقط', image_url: 'https://img/x.jpg' },
      offers: [
        { store_slug: 'alnakheelk', store_name: 'متجر النخيل', price: 3269, availability: 'in_stock', product_url: '/go/new-1', observed_at: daysAgo(1) },
        { store_slug: 'extra', store_name: 'إكسترا', price: 3669, availability: 'in_stock', product_url: '/go/new-2', observed_at: daysAgo(2) },
        { store_slug: 'amazon', store_name: 'أمازون', price: 2949, availability: 'in_stock', product_url: '/go/new-3', observed_at: daysAgo(12) },
      ],
    });
    expect(out.tps_identity_key).toBe(snapshot.tps_identity_key);
    expect(out.name_ar).toMatch(/18000 وحدة/);
    expect(out.image_urls).toEqual(['https://img/x.jpg']);
    expect(out.product_stores.map((s) => [s.stores?.id, s.current_price, s.product_url])).toEqual([
      ['alnakheelk', 3269, '/go/new-1'], ['extra', 3669, '/go/new-2'], ['amazon', 2949, '/go/new-3'],
    ]);
    // no merchant "was" price is carried over — that figure is not ours to repeat
    expect(out.product_stores.every((s) => s.original_price === null)).toBe(true);
    const facts = deriveProductOfferFacts(out.product_stores, NOW);
    expect(facts.best?.stores?.id).toBe('alnakheelk');
    expect(facts.eligibleStoreCount).toBe(2);
    expect(facts.spread).toBe(400);
  });

  it('an offer with NO availability statement stays eligible (not out of stock) and is labelled as unstated — live: Extra was dropped and the spread read 30 instead of 400', () => {
    const out = applyKnowledgeLayerComparison(snapshot, {
      offers: [
        { store_slug: 'alnakheelk', store_name: 'متجر النخيل', price: 3269, availability: 'in_stock', product_url: '/go/1', observed_at: daysAgo(1) },
        { store_slug: 'shaker', store_name: 'شاكر', price: 3299.35, availability: 'in_stock', product_url: '/go/2', observed_at: daysAgo(1) },
        { store_slug: 'extra', store_name: 'إكسترا', price: 3669, availability: null, product_url: '/go/3', observed_at: daysAgo(2) },
      ],
    });
    const extra = out.product_stores.find((s) => s.stores?.id === 'extra')!;
    expect(extra.availability).toBe('in_stock');
    expect(extra.availability_unstated).toBe(true);
    expect(storeAvailabilityLabel(extra, false, true)).toEqual({ text: 'التوفر غير مذكور عند آخر رصد', tone: 'muted' });
    expect(storeAvailabilityLabel(out.product_stores[0], false, true)?.text).toBe('متوفر');
    const facts = deriveProductOfferFacts(out.product_stores, NOW);
    expect(facts.eligibleStoreCount).toBe(3);
    expect(facts.spread).toBe(400);
  });

  it('ADR-389: a malformed/absent response keeps the snapshot and flags the refresh as failed', () => {
    expect(applyKnowledgeLayerComparison(snapshot, null)).toEqual({ ...snapshot, refresh_status: 'failed' });
    expect(applyKnowledgeLayerComparison(snapshot, { canonical: null })).toEqual({ ...snapshot, refresh_status: 'failed' });
  });

  it('ADR-389: a well-formed response with NO usable offers is authoritative — the snapshot offer is not resurrected', () => {
    expect(applyKnowledgeLayerComparison(snapshot, { offers: [] }).product_stores).toEqual([]);
    const zero = applyKnowledgeLayerComparison(snapshot, { offers: [{ store_slug: 'x', store_name: 'x', price: 0, availability: 'in_stock', product_url: null, observed_at: daysAgo(1) }] });
    expect(zero.product_stores).toEqual([]);
    expect(zero.refresh_status).toBe('ok');
  });

  it('never overwrites an existing image or name with an empty canonical field', () => {
    const withImage = { ...snapshot, image_urls: ['https://img/mine.jpg'] };
    const out = applyKnowledgeLayerComparison(withImage, { canonical: { name_ar: '', image_url: null }, offers: [{ store_slug: 'extra', store_name: 'إكسترا', price: 3669, availability: 'in_stock', product_url: '/go/1', observed_at: daysAgo(1) }] });
    expect(out.image_urls).toEqual(['https://img/mine.jpg']);
    expect(out.name_ar).toBe(snapshot.name_ar);
  });
});

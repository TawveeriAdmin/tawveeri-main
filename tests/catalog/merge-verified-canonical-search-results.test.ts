/**
 * Search-results cross-store visibility fix (2026-09-25, ADR-382).
 *
 * Live-reproduced: searching "Samsung 55 inch OLED" returned extra's
 * "Samsung 55 inch 4K Smart Tv OLED 165 Hz" and amazon's "Samsung 55 Inch OLED
 * S90H..." as TWO SEPARATE cards (`toGroupedSearchProduct` builds one card per
 * `products.id`, and the DB fallback's fuzzy title grouper never runs on
 * DB-sourced cards) even though both are the exact same product at the exact
 * same 6,499 SAR price. This locks in the fix: only a VERIFIED identity link
 * merges two cards, never a blanket merge; duplicate same-store offers on any
 * card (from either source) collapse to the one CONFIRMED, valid price.
 *
 * Pure unit test: @/lib/database is mocked, no database required.
 */

import { mergeVerifiedCanonicalSearchResults } from '@/lib/catalog/merge-verified-canonical-search-results';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';

function offer(store: string, current_price: number, availability = 'in_stock'): SearchProduct {
  return {
    name_ar: store, name_en: store, brand: 'Samsung', model: '', sku: null,
    current_price, original_price: null, availability, product_url: `https://${store}.example/x`,
    image_urls: [], specifications: {}, category: 'tv', description_ar: null, description_en: null,
    is_free_delivery: false, delivery_time_days: null, delivery_cost: 0, is_deal: false, coupon_code: null,
    store, store_name: store, rating: null, review_count: null,
  } as unknown as SearchProduct;
}

function card(productId: string, store: string, price: number, availability = 'in_stock'): GroupedSearchProduct {
  const o = offer(store, price, availability);
  return { ...o, stores: [o], best_price: price, store_count: 1, product_id: productId } as GroupedSearchProduct;
}

let ownLinks: Record<string, string | undefined>;
jest.mock('@/lib/database', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => ({
          match: () => Promise.resolve({
            data: ids
              .filter((id) => ownLinks[id])
              .map((id) => ({ product_id: id, canonical_product_id: ownLinks[id] })),
          }),
        }),
      }),
    }),
  }),
}));

describe('mergeVerifiedCanonicalSearchResults', () => {
  it('merges two cards into ONE when both are linked to the SAME verified canonical (live case: extra 6499 / amazon 6499)', async () => {
    ownLinks = { 'product-extra': 'canon-s90h', 'product-amazon': 'canon-s90h' };
    const cards = [card('product-extra', 'extra', 6499), card('product-amazon', 'amazon', 6499)];
    const result = await mergeVerifiedCanonicalSearchResults(cards);
    expect(result).toHaveLength(1);
    expect(result[0].stores.map((s) => s.store).sort()).toEqual(['amazon', 'extra']);
    expect(result[0].best_price).toBe(6499);
    expect(result[0].store_count).toBe(2);
  });

  it('does NOT merge cards with no verified link (never a blanket merge of every split group)', async () => {
    ownLinks = {};
    const cards = [card('product-extra', 'extra', 6499), card('product-amazon', 'amazon', 6499)];
    const result = await mergeVerifiedCanonicalSearchResults(cards);
    expect(result).toHaveLength(2);
  });

  it('leaves an unrelated card untouched alongside a real merge', async () => {
    ownLinks = { 'product-extra': 'canon-s90h', 'product-amazon': 'canon-s90h' };
    const cards = [card('product-extra', 'extra', 6499), card('product-amazon', 'amazon', 6499), card('product-other', 'jarir', 999)];
    const result = await mergeVerifiedCanonicalSearchResults(cards);
    expect(result).toHaveLength(2);
    const jarirCard = result.find((r) => r.stores.some((s) => s.store === 'jarir'));
    expect(jarirCard?.stores).toHaveLength(1);
  });

  it('never shows the same store twice with conflicting prices after a merge', async () => {
    ownLinks = { 'product-a': 'canon-x', 'product-b': 'canon-x' };
    // A pathological input: BOTH sides somehow carry an amazon offer (e.g. each split
    // product had its own duplicate amazon row) — the merged card must still show amazon once.
    const cardA = card('product-a', 'amazon', 469);
    const cardB = card('product-b', 'amazon', 449);
    const result = await mergeVerifiedCanonicalSearchResults([cardA, cardB]);
    expect(result).toHaveLength(1);
    expect(result[0].stores).toHaveLength(1);
  });

  it('collapses a single card\'s own duplicate same-store offers, preferring a valid one over out-of-stock', async () => {
    ownLinks = {};
    const dup = card('product-solo', 'amazon', 100);
    dup.stores = [offer('amazon', 100, 'out_of_stock'), offer('amazon', 449, 'in_stock')];
    const result = await mergeVerifiedCanonicalSearchResults([dup, card('product-other', 'extra', 200)]);
    const merged = result.find((r) => r.product_id === 'product-solo')!;
    expect(merged.stores).toHaveLength(1);
    expect(merged.stores[0].current_price).toBe(449);
    expect(merged.stores[0].availability).toBe('in_stock');
  });

  it('fails closed to the original (store-deduped) list when the identity lookup errors', async () => {
    ownLinks = { 'product-extra': 'canon-s90h', 'product-amazon': 'canon-s90h' };
    const original = createServerClientMockThrow();
    const cards = [card('product-extra', 'extra', 6499), card('product-amazon', 'amazon', 6499)];
    const result = await mergeVerifiedCanonicalSearchResults(cards);
    original.restore();
    expect(result).toHaveLength(2);
  });
});

function createServerClientMockThrow() {
  const dbModule = jest.requireMock('@/lib/database') as { createServerClient: () => unknown };
  const real = dbModule.createServerClient;
  dbModule.createServerClient = () => {
    throw new Error('boom');
  };
  return { restore: () => { dbModule.createServerClient = real; } };
}

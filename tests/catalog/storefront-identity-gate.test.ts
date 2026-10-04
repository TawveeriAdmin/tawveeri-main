/**
 * ADR-405 — the two places the storefront layer asserts "the same product across stores" (product-page sibling
 * merge, search-card merge) honour the identity verdicts every other grouping surface already reads.
 * The verdict index is injected; the loader itself is covered in storefront-identity-gate-loader.test.ts.
 */
import { getCrossCanonicalOffers } from '@/lib/catalog/get-cross-canonical-offers';
import { mergeVerifiedCanonicalSearchResults } from '@/lib/catalog/merge-verified-canonical-search-results';
import { loadStorefrontIdentitySignals } from '@/lib/catalog/storefront-identity-gate';
import type { GroupedSearchProduct } from '@/lib/scraping/search/product-grouper';
import type { SearchProduct } from '@/lib/scraping/search/types';

jest.mock('@/lib/catalog/storefront-identity-gate', () => ({ loadStorefrontIdentitySignals: jest.fn() }));
const loadSignals = loadStorefrontIdentitySignals as jest.Mock;

let links: Record<string, string | undefined>; // product_id → canonical (verified link); key "own" = the page's own link
let siblings: string[]; // product ids returned for the cross-offer sibling query
let psRows: Record<string, unknown>[];
jest.mock('@/lib/database', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.in = (_c: string, vals: string[]) => (table === 'product_stores'
        ? Promise.resolve({ data: psRows.filter((r) => vals.includes(r.product_id as string)) })
        : b);
      b.match = () => Object.assign(Promise.resolve({
        data: Object.entries(links).filter(([, c]) => c).map(([product_id, canonical_product_id]) => ({ product_id, canonical_product_id })),
      }), {
        maybeSingle: () => Promise.resolve({ data: links['own'] ? { canonical_product_id: links['own'] } : null }),
        neq: () => Promise.resolve({ data: siblings.map((product_id) => ({ product_id })) }),
      });
      return b;
    },
  }),
}));

const STORE = (id: number, slug: string) => ({ id, slug, name_ar: slug, name_en: slug, logo_url: null, average_rating: null, total_reviews: null });
const row = (id: string, product_id: string, store_id: number, slug: string, price: number) => ({
  id, product_id, current_price: price, original_price: null, currency: 'SAR', availability: 'in_stock', stock_quantity: null,
  product_url: `https://${slug}.example/x`, delivery_time_days: null, delivery_cost: null, is_free_delivery: false, is_deal: false,
  deal_expires_at: null, coupon_code: null, updated_at: '2026-10-04T00:00:00Z', last_seen_at: '2026-10-04T00:00:00Z',
  price_quarantined_at: null, store_id, stores: STORE(store_id, slug),
});
const index = (entries: Record<string, 'review' | 'reject'>) => new Map(Object.entries(entries));

beforeEach(() => { loadSignals.mockReset(); loadSignals.mockResolvedValue(new Map()); });

describe('getCrossCanonicalOffers — identity gate', () => {
  beforeEach(() => {
    links = { own: 'canon-1' }; siblings = ['p-amazon', 'p-jarir'];
    psRows = [row('ps-a', 'p-amazon', 2, 'amazon', 3000), row('ps-j', 'p-jarir', 4, 'jarir', 3100)];
  });
  it('no verdicts: unchanged — both siblings merge', async () => {
    expect((await getCrossCanonicalOffers('p-own', new Set([1]))).map((o) => o.id).sort()).toEqual(['ps-a', 'ps-j']);
  });
  it('a review/reject sibling listing is never merged in; the confirmed one still is', async () => {
    loadSignals.mockResolvedValue(index({ 'canon-1|2': 'review' }));
    expect((await getCrossCanonicalOffers('p-own', new Set([1]))).map((o) => o.id)).toEqual(['ps-j']);
  });
  it("when the page's OWN listing is unconfirmed the page makes no cross-store claim at all", async () => {
    loadSignals.mockResolvedValue(index({ 'canon-1|1': 'reject' }));
    expect(await getCrossCanonicalOffers('p-own', new Set([1]))).toEqual([]);
  });
  it("verdicts are looked up for the page's canonical only", async () => {
    await getCrossCanonicalOffers('p-own', new Set([1]));
    expect(loadSignals).toHaveBeenCalledWith(expect.anything(), ['canon-1']);
  });
});

function offer(store: string, price: number): SearchProduct {
  return {
    name_ar: store, name_en: store, brand: 'TCL', model: '', sku: null, current_price: price, original_price: null, availability: 'in_stock',
    product_url: `https://${store}.example/x`, image_urls: [], specifications: {}, category: 'tv', description_ar: null, description_en: null,
    is_free_delivery: false, delivery_time_days: null, delivery_cost: 0, is_deal: false, coupon_code: null, store, store_name: store, rating: null, review_count: null,
  } as unknown as SearchProduct;
}
const card = (pid: string, store: string, price: number): GroupedSearchProduct =>
  ({ ...offer(store, price), stores: [offer(store, price)], best_price: price, store_count: 1, product_id: pid } as GroupedSearchProduct);

describe('mergeVerifiedCanonicalSearchResults — identity gate', () => {
  beforeEach(() => { links = { 'p-extra': 'canon-1', 'p-amazon': 'canon-1', 'p-jarir': 'canon-1' }; siblings = []; psRows = []; });
  const cards = () => [card('p-extra', 'extra', 2900), card('p-amazon', 'amazon', 3000), card('p-jarir', 'jarir', 3100)];
  it('no verdicts: all three verified cards merge into one (unchanged)', async () => {
    const r = await mergeVerifiedCanonicalSearchResults(cards());
    expect(r).toHaveLength(1); expect(r[0].store_count).toBe(3);
  });
  it('a card carrying a review listing stays its OWN card; the confirmed cards still merge among themselves', async () => {
    loadSignals.mockResolvedValue(index({ 'canon-1|extra': 'review' }));
    const r = await mergeVerifiedCanonicalSearchResults(cards());
    expect(r).toHaveLength(2);
    expect(r.find((c) => c.stores.some((s) => s.store === 'extra'))!.store_count).toBe(1);
    expect(r.find((c) => c.stores.some((s) => s.store === 'amazon'))!.stores.map((s) => s.store).sort()).toEqual(['amazon', 'jarir']);
  });
  it('a 1-vs-1 unresolved conflict (both review) leaves two single-store cards — no merged "best price" claim', async () => {
    links = { 'p-extra': 'canon-1', 'p-amazon': 'canon-1' };
    loadSignals.mockResolvedValue(index({ 'canon-1|extra': 'review', 'canon-1|amazon': 'review' }));
    const r = await mergeVerifiedCanonicalSearchResults([card('p-extra', 'extra', 2900), card('p-amazon', 'amazon', 3000)]);
    expect(r).toHaveLength(2); expect(r.every((c) => c.store_count === 1)).toBe(true);
  });
});

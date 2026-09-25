/**
 * Cross-store comparison-visibility fix (2026-09-25, ADR-381).
 *
 * A live production check found 15+ real cases where amazon holds a genuinely
 * comparable, correctly-priced offer for the SAME product already sold by
 * extra/almanea, but it lives on a DIFFERENT `products.id` row (created because
 * ProductMatcher didn't recognize it as the same product at ingest time) — so
 * it never appears on the customer-facing `/products/[slug]` page the shopper
 * actually lands on. This locks in the fix: only a VERIFIED (ADR-242
 * convergence-v1, active, valid) identity link is trusted to merge offers
 * across product rows — never a bare, possibly-legacy `canonical_product_id`.
 *
 * Pure unit test: @/lib/database is mocked, no database required.
 */

import { getCrossCanonicalOffers } from '@/lib/catalog/get-cross-canonical-offers';

type Filters = Record<string, unknown>;

function makeMockClient(opts: {
  ownLink: { canonical_product_id?: string } | null;
  siblingLinks: { product_id: string }[];
  productStoresRows: Record<string, unknown>[];
}) {
  function from(table: string) {
    const filters: Filters = {};
    const builder = {
      select() { return this; },
      eq(col: string, val: unknown) { filters[col] = val; return this; },
      match(f: Filters) { Object.assign(filters, f); return this; },
      neq(col: string, val: unknown) {
        // sibling-links query: table=storefront_identity_links, verified filter already applied.
        if (table === 'storefront_identity_links') {
          const filtered = opts.siblingLinks.filter((r) => r.product_id !== val);
          return Promise.resolve({ data: filtered });
        }
        return Promise.resolve({ data: [] });
      },
      maybeSingle() {
        return Promise.resolve({ data: opts.ownLink });
      },
      in(col: string, vals: string[]) {
        const filtered = opts.productStoresRows.filter((r) => vals.includes(r.product_id as string));
        return Promise.resolve({ data: filtered });
      },
    };
    return builder;
  }
  return { from };
}

let currentMock: ReturnType<typeof makeMockClient>;
jest.mock('@/lib/database', () => ({
  createServerClient: () => currentMock,
}));

const AMAZON_STORE = { id: 2, slug: 'amazon', name_ar: 'أمازون', name_en: 'Amazon', logo_url: null, average_rating: null, total_reviews: null };
const UNAPPROVED_STORE = { id: 999, slug: 'not-approved', name_ar: 'x', name_en: 'x', logo_url: null, average_rating: null, total_reviews: null };

describe('getCrossCanonicalOffers', () => {
  it('returns nothing when the current product has no VERIFIED identity link', async () => {
    currentMock = makeMockClient({ ownLink: null, siblingLinks: [], productStoresRows: [] });
    const offers = await getCrossCanonicalOffers('product-extra', new Set());
    expect(offers).toEqual([]);
  });

  it('merges an approved-store sibling offer found via a verified canonical link', async () => {
    currentMock = makeMockClient({
      ownLink: { canonical_product_id: 'canon-1' },
      siblingLinks: [{ product_id: 'product-amazon' }],
      productStoresRows: [
        { id: 'ps-amazon-1', product_id: 'product-amazon', current_price: 6499, original_price: null, currency: 'SAR', availability: 'in_stock', stock_quantity: null, product_url: 'https://amazon.sa/x', delivery_time_days: null, delivery_cost: null, is_free_delivery: null, is_deal: false, deal_expires_at: null, coupon_code: null, updated_at: '2026-09-25T00:00:00Z', store_id: 2, stores: AMAZON_STORE },
      ],
    });
    const offers = await getCrossCanonicalOffers('product-extra', new Set());
    expect(offers).toHaveLength(1);
    expect(offers[0].id).toBe('ps-amazon-1');
    expect(offers[0].current_price).toBe(6499);
    expect(offers[0].stores.slug).toBe('amazon');
    expect(offers[0].affiliate_url).toBeNull();
  });

  it('excludes a store already present on the current product (no duplicate card)', async () => {
    currentMock = makeMockClient({
      ownLink: { canonical_product_id: 'canon-1' },
      siblingLinks: [{ product_id: 'product-amazon' }],
      productStoresRows: [
        { id: 'ps-amazon-1', product_id: 'product-amazon', current_price: 6499, original_price: null, currency: 'SAR', availability: 'in_stock', stock_quantity: null, product_url: 'https://amazon.sa/x', delivery_time_days: null, delivery_cost: null, is_free_delivery: null, is_deal: false, deal_expires_at: null, coupon_code: null, updated_at: '2026-09-25T00:00:00Z', store_id: 2, stores: AMAZON_STORE },
      ],
    });
    const offers = await getCrossCanonicalOffers('product-extra', new Set([2]));
    expect(offers).toEqual([]);
  });

  it('excludes a non-approved-retailer store even if it shares a verified canonical', async () => {
    currentMock = makeMockClient({
      ownLink: { canonical_product_id: 'canon-1' },
      siblingLinks: [{ product_id: 'product-other' }],
      productStoresRows: [
        { id: 'ps-other-1', product_id: 'product-other', current_price: 100, original_price: null, currency: 'SAR', availability: 'in_stock', stock_quantity: null, product_url: 'https://x.com', delivery_time_days: null, delivery_cost: null, is_free_delivery: null, is_deal: false, deal_expires_at: null, coupon_code: null, updated_at: '2026-09-25T00:00:00Z', store_id: 999, stores: UNAPPROVED_STORE },
      ],
    });
    const offers = await getCrossCanonicalOffers('product-extra', new Set());
    expect(offers).toEqual([]);
  });

  it('returns nothing when the canonical link exists but no sibling product carries the same VERIFIED canonical', async () => {
    currentMock = makeMockClient({ ownLink: { canonical_product_id: 'canon-1' }, siblingLinks: [], productStoresRows: [] });
    const offers = await getCrossCanonicalOffers('product-extra', new Set());
    expect(offers).toEqual([]);
  });
});

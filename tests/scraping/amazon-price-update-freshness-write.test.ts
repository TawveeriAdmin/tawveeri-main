/**
 * `product_stores.updated_at` freshness write-path fix (2026-09-25, amazon comparison-
 * visibility investigation; docs/DECISIONS.md ADR-380).
 *
 * ADR-334 (2026-09-10) already found that `product_stores` has NO database trigger on
 * `updated_at` and that no price-only write path set it explicitly — so the column only
 * ever reflected row-INSERT time, never "last successfully confirmed price". That
 * correction was recorded but never applied to `updateProductPrice()`/`linkProductToStore()`
 * themselves. `src/lib/catalog/select-best-price-offer.ts` (the storefront /products/[slug]
 * comparison page) filters "best price" eligibility by `isFreshObservation(updated_at)` on
 * the explicit assumption that `updated_at` already means "last successfully confirmed
 * price" — for EVERY store, not just amazon. This test locks in the fix: a credible price
 * confirmation now sets `updated_at`; a rejected (quarantined) observation does not.
 *
 * Pure unit test: @/lib/database is mocked, no database required.
 */

import { ProductService } from '@/lib/scraping/services/product-service';

type Update = { table: string; payload: Record<string, unknown>; filters: Record<string, unknown> };

function makeMockClient(existingRow: { id: string; current_price: number | null; price_pending_value: number | null }) {
  const updates: Update[] = [];

  function from(table: string) {
    const filters: Record<string, unknown> = {};
    const builder: any = {
      select(cols: string) { this._select = cols; return this; },
      eq(col: string, val: unknown) { filters[col] = val; return this; },
      order() { return this; },
      limit() { return this; },
      update(payload: Record<string, unknown>) {
        const entry: Update = { table, payload, filters: {} };
        updates.push(entry);
        return {
          eq(col: string, val: unknown) {
            entry.filters[col] = val;
            return Promise.resolve({ error: null });
          },
        };
      },
      insert() {
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'ph-1' }, error: null }) }) };
      },
      // `updateProductPrice`/`linkProductToStore` await the select/eq/order chain directly
      // (no terminal .single()/.maybeSingle()) — the builder itself must be thenable.
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        if (table === 'product_stores' && typeof this._select === 'string' && this._select.includes('current_price, price_pending_value')) {
          return Promise.resolve({ data: [existingRow], error: null }).then(resolve, reject);
        }
        // supportsRefreshTracking()'s capability probe — report supported.
        return Promise.resolve({ data: [{}], error: null }).then(resolve, reject);
      },
    };
    return builder;
  }

  return { client: { from }, updates };
}

let currentMock = makeMockClient({ id: 'ps-1', current_price: 1000, price_pending_value: null });
jest.mock('@/lib/database', () => ({
  createServerClient: () => currentMock.client,
}));

describe("updateProductPrice sets product_stores.updated_at only on a credible confirmation", () => {
  it('sets updated_at when the new price is a credible continuation (small change)', async () => {
    currentMock = makeMockClient({ id: 'ps-1', current_price: 1000, price_pending_value: null });
    const svc = new ProductService();
    await svc.updateProductPrice('product-1', 'store-1', 1050, 'in_stock');

    const write = currentMock.updates.find((u) => u.table === 'product_stores' && u.filters.id === 'ps-1');
    expect(write).toBeDefined();
    expect(write!.payload.current_price).toBe(1050);
    expect(write!.payload.updated_at).toEqual(expect.any(String));
  });

  it('sets updated_at even when the price is confirmed UNCHANGED (not just on a price change)', async () => {
    currentMock = makeMockClient({ id: 'ps-1', current_price: 1000, price_pending_value: null });
    const svc = new ProductService();
    await svc.updateProductPrice('product-1', 'store-1', 1000, 'in_stock');

    const write = currentMock.updates.find((u) => u.table === 'product_stores' && u.filters.id === 'ps-1');
    expect(write).toBeDefined();
    expect(write!.payload.updated_at).toEqual(expect.any(String));
  });

  it('does NOT set updated_at when the new price is rejected as an incredible transition (quarantined)', async () => {
    // >4x jump vs. the trusted prior price — SANITY_MAX_RATIO rejects this as incredible.
    currentMock = makeMockClient({ id: 'ps-1', current_price: 1000, price_pending_value: null });
    const svc = new ProductService();
    await svc.updateProductPrice('product-1', 'store-1', 9000, 'in_stock');

    const write = currentMock.updates.find((u) => u.table === 'product_stores' && u.filters.id === 'ps-1');
    expect(write).toBeDefined();
    expect(write!.payload.price_quarantined_at).toEqual(expect.any(String));
    expect(write!.payload.updated_at).toBeUndefined();
    expect(write!.payload.current_price).toBeUndefined();
  });
});

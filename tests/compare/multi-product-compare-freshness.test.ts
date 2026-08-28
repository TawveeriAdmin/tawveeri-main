/**
 * QUALITY PROGRAM P1 §19.2 item 2 (2026-08-28): the separate localStorage-backed
 * multi-product compare TOOL (`compare/page.tsx`, distinct from `/compare/[key]` which
 * §12 already fixed) crowned "best price" from the raw cheapest in-stock offer with no
 * freshness check — the storefront-layer twin of the gap §17.1/§19.1 fixed elsewhere.
 * `selectBestPriceStore` here mirrors product-card.tsx's function of the same name but
 * preserves this page's own exact original fallback tiering: fresh in-stock > stale
 * in-stock > any in-stock > cheapest overall (only when NOTHING is in stock — unchanged
 * from before this fix, never a new state).
 */
import { selectBestPriceStore, type ProductStore } from "@/app/[locale]/(public)/compare/page";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const store = (over: Partial<ProductStore>): ProductStore => ({
  id: over.id ?? "s1",
  current_price: over.current_price ?? 100,
  original_price: over.original_price ?? null,
  availability: over.availability ?? "in_stock",
  delivery_time_days: null,
  delivery_cost: null,
  is_free_delivery: null,
  product_url: null,
  affiliate_url: null,
  observed_at: over.observed_at ?? null,
  stores: null,
});

// Mirrors this page's own getStoresByPrice: current_price > 0, sorted ascending.
const sorted = (stores: ProductStore[]) => [...stores].sort((a, b) => a.current_price - b.current_price);

describe("compare/page.tsx — selectBestPriceStore", () => {
  it("no freshness data at all — behaves exactly as the original raw price/availability logic", () => {
    const stores = sorted([store({ id: "a", current_price: 200 }), store({ id: "b", current_price: 100 })]);
    expect(selectBestPriceStore(stores)?.id).toBe("b");
  });

  it("stale cheapest + fresh more-expensive offer — the fresh one wins", () => {
    const stores = sorted([
      store({ id: "stale-cheap", current_price: 100, observed_at: hoursAgo(400) }),
      store({ id: "fresh-pricier", current_price: 150, observed_at: hoursAgo(2) }),
    ]);
    expect(selectBestPriceStore(stores)?.id).toBe("fresh-pricier");
  });

  it("stale-only offers — falls back to the raw cheapest in-stock rather than null", () => {
    const stores = sorted([
      store({ id: "a", current_price: 200, observed_at: hoursAgo(400) }),
      store({ id: "b", current_price: 100, observed_at: hoursAgo(500) }),
    ]);
    expect(selectBestPriceStore(stores)?.id).toBe("b");
  });

  it("all out of stock — falls back to the cheapest overall (unchanged original behavior, not null)", () => {
    const stores = sorted([
      store({ id: "a", current_price: 200, availability: "out_of_stock", observed_at: hoursAgo(1) }),
      store({ id: "b", current_price: 100, availability: "out_of_stock", observed_at: hoursAgo(1) }),
    ]);
    expect(selectBestPriceStore(stores)?.id).toBe("b");
  });

  it("out-of-stock cheap store excluded in favor of a pricier in-stock one, regardless of freshness", () => {
    const stores = sorted([
      store({ id: "oos-cheap", current_price: 50, availability: "out_of_stock", observed_at: hoursAgo(1) }),
      store({ id: "in-stock", current_price: 100, observed_at: hoursAgo(1) }),
    ]);
    expect(selectBestPriceStore(stores)?.id).toBe("in-stock");
  });

  it("just inside vs just outside the 168h floor", () => {
    const fresh = sorted([store({ id: "fresh", current_price: 100, observed_at: hoursAgo(167.9) })]);
    const staleTwo = sorted([
      store({ id: "stale-a", current_price: 100, observed_at: hoursAgo(168.1) }),
      store({ id: "stale-b", current_price: 200, observed_at: hoursAgo(168.1) }),
    ]);
    expect(selectBestPriceStore(fresh)?.id).toBe("fresh");
    expect(selectBestPriceStore(staleTwo)?.id).toBe("stale-a"); // cheapest of the stale set, not null
  });

  it("empty list returns null (no product_stores at all)", () => {
    expect(selectBestPriceStore([])).toBeNull();
  });

  it("never mutates the input array", () => {
    const stores = sorted([
      store({ id: "a", current_price: 200, observed_at: hoursAgo(400) }),
      store({ id: "b", current_price: 100, observed_at: hoursAgo(1) }),
    ]);
    const before = stores.map((s) => s.id);
    selectBestPriceStore(stores);
    expect(stores.map((s) => s.id)).toEqual(before);
  });
});

/**
 * QUALITY PROGRAM P1 §14.1/§14.2 (2026-08-28): the storefront-layer twin of the §11/§12
 * TPS-layer stale-cheapest-store fix. `product-card.tsx` (the single most prominent
 * surface in the app) crowned "Best Price"/"Hot Deal" purely from `product_stores` price
 * comparison with no freshness check at all. `selectBestPriceStore` gates the CLAIM on
 * `isFreshObservation` (the same 168h floor) — but only when freshness data is actually
 * supplied, so a caller not yet wired to `product_stores.last_checked_at` regresses
 * nothing.
 */
import { selectBestPriceStore } from "@/components/products/product-card";

type Store = Parameters<typeof selectBestPriceStore>[0][number];

// Relative to the real clock at test-run time, not a fixed date — `isFreshObservation`
// (evidence-engine.ts) defaults `nowMs` to `Date.now()`, so a fixed past date would drift
// out of the 168h floor as time passes and make the boundary case flaky.
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const store = (over: Partial<Store>): Store => ({
  id: over.id ?? "s1",
  current_price: over.current_price ?? 100,
  original_price: over.original_price ?? null,
  availability: over.availability ?? "in_stock",
  observed_at: over.observed_at ?? null,
  stores: over.stores ?? { id: "extra", name_ar: "اكسترا", name_en: "Extra", logo_url: null },
});

describe("selectBestPriceStore", () => {
  it("no freshness data at all (legacy storefront caller) — behaves exactly as before, unfiltered", () => {
    const stores = [
      store({ id: "a", current_price: 200 }),
      store({ id: "b", current_price: 100 }),
    ];
    const { bestPrice, storesWithPrices } = selectBestPriceStore(stores);
    expect(bestPrice?.id).toBe("b");
    expect(storesWithPrices).toHaveLength(2);
  });

  it("stale cheapest + fresh more-expensive offer — the fresh one wins, stale one not deleted from the set", () => {
    const stores = [
      store({ id: "stale-cheap", current_price: 100, observed_at: hoursAgo(400) }), // >168h
      store({ id: "fresh-pricier", current_price: 150, observed_at: hoursAgo(2) }),
    ];
    const { bestPrice, storesWithPrices } = selectBestPriceStore(stores);
    expect(bestPrice?.id).toBe("fresh-pricier");
    expect(storesWithPrices.map((s) => s.id)).toEqual(expect.arrayContaining(["stale-cheap", "fresh-pricier"]));
  });

  it("stale-only offers — falls back to the raw cheapest rather than showing nothing (product_stores is never emptied)", () => {
    const stores = [
      store({ id: "a", current_price: 200, observed_at: hoursAgo(400) }),
      store({ id: "b", current_price: 100, observed_at: hoursAgo(500) }),
    ];
    const { bestPrice, storesWithPrices } = selectBestPriceStore(stores);
    expect(bestPrice?.id).toBe("b"); // still the cheapest of the stale set
    expect(storesWithPrices).toHaveLength(2); // nothing hidden
  });

  it("multiple fresh offers — cheapest fresh one wins", () => {
    const stores = [
      store({ id: "a", current_price: 300, observed_at: hoursAgo(1) }),
      store({ id: "b", current_price: 200, observed_at: hoursAgo(2) }),
      store({ id: "c", current_price: 250, observed_at: hoursAgo(3) }),
    ];
    expect(selectBestPriceStore(stores).bestPrice?.id).toBe("b");
  });

  it("just inside the 168h floor counts as fresh, just outside does not (boundary, not exact-microsecond-flaky)", () => {
    // Exact-168.000h against a live wall clock is inherently racy (microseconds of test
    // execution time can push it either side) — pinned a hair either side instead, which
    // still proves the floor is inclusive without depending on exact-instant timing.
    const justInside = [store({ id: "fresh", current_price: 100, observed_at: hoursAgo(167.9) })];
    const justOutside = [
      store({ id: "stale", current_price: 100, observed_at: hoursAgo(168.1) }),
      store({ id: "fallback", current_price: 200, observed_at: hoursAgo(168.1) }),
    ];
    expect(selectBestPriceStore(justInside).bestPrice?.id).toBe("fresh");
    // both stale -> falls back to raw cheapest of the stale set, not "fresh-only" logic
    expect(selectBestPriceStore(justOutside).bestPrice?.id).toBe("stale");
  });

  it("single-store product — works the same with one store", () => {
    const stores = [store({ id: "only", current_price: 100, observed_at: hoursAgo(5) })];
    expect(selectBestPriceStore(stores).bestPrice?.id).toBe("only");
  });

  it("unavailable/out-of-stock stale winner — excluded from bestPrice regardless of freshness", () => {
    const stores = [
      store({ id: "oos-cheap", current_price: 50, availability: "out_of_stock", observed_at: hoursAgo(1) }),
      store({ id: "in-stock", current_price: 100, observed_at: hoursAgo(1) }),
    ];
    expect(selectBestPriceStore(stores).bestPrice?.id).toBe("in-stock");
  });

  it("hasDeal only counts a fresh discount when freshness data exists", () => {
    const staleDealOnly = [
      store({ id: "a", current_price: 80, original_price: 100, observed_at: hoursAgo(400) }),
    ];
    expect(selectBestPriceStore(staleDealOnly).hasDeal).toBe(false);

    const freshDeal = [
      store({ id: "a", current_price: 80, original_price: 100, observed_at: hoursAgo(1) }),
    ];
    expect(selectBestPriceStore(freshDeal).hasDeal).toBe(true);

    const noFreshnessDataDeal = [
      store({ id: "a", current_price: 80, original_price: 100 }),
    ];
    expect(selectBestPriceStore(noFreshnessDataDeal).hasDeal).toBe(true); // unfiltered, as before
  });

  it("never mutates or drops the input stores array (no false coverage loss)", () => {
    const stores = [
      store({ id: "a", current_price: 200, observed_at: hoursAgo(400) }),
      store({ id: "b", current_price: 100, observed_at: hoursAgo(1) }),
    ];
    const { storesWithPrices } = selectBestPriceStore(stores);
    expect(storesWithPrices).toHaveLength(stores.length);
    expect(stores).toHaveLength(2); // original untouched
  });
});

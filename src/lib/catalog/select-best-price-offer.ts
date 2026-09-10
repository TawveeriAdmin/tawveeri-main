import { isFreshObservation } from '@/lib/intelligence/evidence-engine';

/**
 * Storefront-layer counterpart to `deriveComparisonSummary` (src/lib/compare/get-comparison.ts):
 * the SAME "prefer fresh, don't let a stale price win merely because it's numerically lower"
 * rule the TPS-layer compare page and search already apply via `isFreshObservation`, extended
 * to `/products/[slug]` (the storefront `product_stores.updated_at` timestamp, not a TPS
 * `observed_at`, is the freshness signal here — `updated_at` only advances on a genuinely
 * successful price change/confirmation; `last_checked_at` advances on every attempt, success
 * or failure, and must never be used for a freshness claim — see stampChecked() in
 * scraping-orchestrator.ts).
 *
 * Noon commerce data truth mission (2026-09-10): `/products/[slug]` picked "best price" by
 * raw `current_price` with no freshness gate at all — the one customer-facing best-price
 * surface that had not received the 2026-08-07 P0 stale-price-safety fix already live on
 * compare/search. A full production census (all 15 multi-store products carrying a Noon
 * offer) found zero live cases where this actually flips a "cheapest" verdict today — but the
 * gap is real and would silently let a future stale-vs-fresh mismatch win. Falls back to the
 * full (possibly-stale) offer set when NONE are fresh, so a single-store or all-stale product
 * still shows a price — same graceful-degradation behavior as before, just never letting a
 * stale offer beat an actually-fresher one when a fresher one exists.
 */
export interface PriceOffer {
  id: string;
  current_price: number;
  availability: string | null;
  updated_at: string | null;
}

export function selectBestPriceOffer<T extends PriceOffer>(
  offers: T[],
  nowMs: number = Date.now(),
): { sorted: T[]; best: T | null; highestPrice: number } {
  const inStock = offers.filter((o) => o.availability !== 'out_of_stock');
  const fresh = inStock.filter((o) => isFreshObservation(o.updated_at, nowMs));
  const ranked = fresh.length > 0 ? fresh : inStock;
  const sorted = [...ranked].sort((a, b) => a.current_price - b.current_price);
  return {
    sorted,
    best: sorted[0] ?? null,
    highestPrice: sorted[sorted.length - 1]?.current_price ?? 0,
  };
}

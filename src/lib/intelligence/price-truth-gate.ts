// src/lib/intelligence/price-truth-gate.ts
// ─────────────────────────────────────────────────────────────────────────────
// Price-truth gate — storefront layer (product_stores).
//
// P0 incident 2026-08-05: Amazon offer B0F8JHSMMD (LG OLED65C56LA) showed SAR 259
// against a real live price of SAR 8,699 (~98% off). Root cause: the storefront
// price-refresh write path (ProductService.updateProductPrice) applied a scraped
// price with ZERO sanity check, and the Best Deals read path (getDeals.ts) applied
// zero outlier/corroboration check before publishing a discount claim. The Amazon
// PDP parser bug itself (a page-global price selector that could match a DIFFERENT
// product's price in a carousel) was already fixed by ADR-200/ADR-204 — this module
// is the missing independent layer: even a correct parser can occasionally return
// a wrong number, and nothing before this gate would have caught it.
//
// Two checks, used at different points in the pipeline:
//   assessPriceTransition — WRITE time. Is a freshly scraped price a credible
//     continuation of the price we already trust for this exact listing?
//   isExtremeUncorroboratedDiscount — READ time (Best Deals). Is a discount claim
//     large enough that it must not be published from a single retailer alone?
// ─────────────────────────────────────────────────────────────────────────────

/** ADR-200's accepted sanity bound, reused here for the storefront layer: a price
 *  more than 4x higher or less than 1/4 of the last trusted price is rejected as
 *  unknown-beats-incorrect, not silently written. */
export const SANITY_MAX_RATIO = 4;

/** Empirically the real (non-fabricated) promotional ceiling measured against live
 *  retailer pages: Extra's genuine flash discounts repeat at exactly 69.99% (see
 *  PRICE_INTEGRITY.md, verified live 2026-07-28). A single-retailer claim beyond
 *  this must corroborate with at least one more store before it can be published
 *  as a deal — otherwise it is quarantined for revalidation, never auto-promoted. */
export const EXTREME_DISCOUNT_PCT = 75;

export interface PriceTransition {
  credible: boolean;
  reason: string | null;
  /** true when this transition CONFIRMS a previously pending/quarantined value
   *  (two consecutive independent observations agreeing) and should be written. */
  confirmsPending: boolean;
}

/**
 * Evaluate whether `newPrice` is a credible continuation of `priorPrice` for the
 * SAME listing. A lone anomalous read is quarantined, not written; if the same
 * anomalous value is re-observed on a later call (`pendingValue` within 2%), it is
 * treated as a genuine — if surprising — market move and confirmed.
 */
export function assessPriceTransition(input: {
  newPrice: number;
  priorPrice: number | null;
  pendingValue: number | null;
}): PriceTransition {
  const { newPrice, priorPrice, pendingValue } = input;

  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return { credible: false, reason: "non-positive or non-finite price", confirmsPending: false };
  }

  if (priorPrice !== null && Number.isFinite(priorPrice) && priorPrice > 0) {
    const ratio = newPrice / priorPrice;
    const withinSanityBound = ratio <= SANITY_MAX_RATIO && ratio >= 1 / SANITY_MAX_RATIO;

    if (!withinSanityBound) {
      // Does this reading confirm a value we already flagged pending?
      if (pendingValue !== null && Number.isFinite(pendingValue) && pendingValue > 0) {
        const agreement = Math.abs(newPrice - pendingValue) / pendingValue;
        if (agreement <= 0.02) {
          return { credible: true, reason: null, confirmsPending: true };
        }
      }
      return {
        credible: false,
        reason: `price moved ${ratio.toFixed(2)}x vs last known price (${priorPrice} -> ${newPrice}), exceeds the ${SANITY_MAX_RATIO}x/${(1 / SANITY_MAX_RATIO).toFixed(2)}x sanity bound (ADR-200)`,
        confirmsPending: false,
      };
    }
  }

  return { credible: true, reason: null, confirmsPending: false };
}

/**
 * Best Deals contract: an extreme, single-retailer discount claim is not honest
 * without corroboration. Returns true when the offer must NOT be published with a
 * discount claim as-is.
 */
export function isExtremeUncorroboratedDiscount(input: {
  discountPct: number;
  corroboratingStoreCount: number;
}): boolean {
  return input.discountPct >= EXTREME_DISCOUNT_PCT && input.corroboratingStoreCount < 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADR-211 bounded closeout (2026-08-05) — the smallest truthful public-label rule.
//
// A "best price" / "strong deal" claim is a superiority claim: it says this offer
// beats the alternatives. That is only true when we actually have alternatives to
// compare against — either other retailers, or our own price history for the same
// listing. Neither of those is optional evidence; each tier below states exactly
// what it requires and nothing is claimed beyond it.
// ─────────────────────────────────────────────────────────────────────────────

export type DealLabelTier = "single" | "single_stable_baseline" | "multi_store";

/**
 * Threshold for "reproducible and sufficiently stable" price-history baseline
 * (tier single_stable_baseline). NOT hardcoded blind — verified against production
 * 2026-08-05 first: of 741 then-live single/multi-store deal rows, 649 (87.6%) had
 * ZERO price_history observations, only 1 had >=5, and only 1 spanned >=7 distinct
 * days (avg span 1.6 days). These thresholds are therefore near-dormant BY HONEST
 * NECESSITY today, not a bug — they encode what "stable" actually requires and will
 * start firing as price_history genuinely deepens, rather than being loosened to
 * manufacture claims the data doesn't support.
 */
export const STABLE_BASELINE_MIN_OBSERVATIONS = 5;
export const STABLE_BASELINE_MIN_DISTINCT_DAYS = 7;

export function classifyDealLabelTier(input: {
  corroboratingStoreCount: number;
  priceHistoryObservationCount: number;
  priceHistoryDistinctDays: number;
}): DealLabelTier {
  if (input.corroboratingStoreCount >= 2) return "multi_store";
  if (
    input.priceHistoryObservationCount >= STABLE_BASELINE_MIN_OBSERVATIONS &&
    input.priceHistoryDistinctDays >= STABLE_BASELINE_MIN_DISTINCT_DAYS
  ) {
    return "single_stable_baseline";
  }
  return "single";
}

/** Whether a "hot"/"strong deal" superiority badge may be shown for this tier. A
 *  plain single-retailer offer with no historical baseline never earns it — that is
 *  exactly the "عرض قوي" claim this ADR exists to stop making on one retailer alone. */
export function tierAllowsStrongDealBadge(tier: DealLabelTier): boolean {
  return tier !== "single";
}

export function dealLabelText(tier: DealLabelTier, storeName: string): { ar: string; en: string } {
  switch (tier) {
    case "multi_store":
      return { ar: "أقل سعر بين المتاجر المتاحة", en: "Lowest among available retailers" };
    case "single_stable_baseline":
      return { ar: "سعر منخفض عن المعتاد", en: "Lower than usual" };
    case "single":
    default:
      return { ar: `السعر المتاح لدى ${storeName}`, en: `Available at ${storeName}` };
  }
}

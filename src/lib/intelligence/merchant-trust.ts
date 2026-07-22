// src/lib/intelligence/merchant-trust.ts
// ─────────────────────────────────────────────────────────────────────────────
// MERCHANT TRUST INTELLIGENCE — a deterministic, evidence-based trust profile per
// store, derived ONLY from what Tawveeri actually observed. Novel & defensible: no
// comparison platform scores merchants on OBSERVED discount honesty + real price
// competitiveness. Dual-value: a consumer trust signal AND a B2B data product
// (Strategic Brief §5.8 Merchant Digital Twin, §5.12 Data Quality as a Service).
//
// PRINCIPLES: precision-first & NON-ACCUSATORY. We distinguish "makes no advertised
// discounts" from "advertised discounts are honest" (very different). "Inflated" means
// only "the advertised 'was' is a price we never observed" — not fraud. Ranking-blind:
// this is a trust signal, never a commercial input. Pure function → fully testable.
// ─────────────────────────────────────────────────────────────────────────────

export interface StoreTrustInput {
  store_id: number | string;
  store_name: string;
  facts_analyzed: number;      // listings we have price-tracked for this store (0 ⇒ not analyzed)
  discount_inflated: number;   // listings where advertised "was" was never observed
  discount_verified: number;   // listings with a genuine observed drop
  cheapest_count: number;      // times cheapest among corroborated products
  corroborated_appearances: number; // appearances on corroborated products
  distinct_products: number;
}

export type DiscountBehavior = "aggressive_claims" | "some_claims" | "no_advertised_discounts" | "insufficient_data";

export interface StoreTrust {
  store_id: number | string;
  store_name: string;
  discount_behavior: DiscountBehavior;
  evaluable_claims: number;              // inflated + verified (claims we could check)
  discount_inflation_pct: number | null; // % of evaluable claims that are inflated
  verified_deals: number;
  price_competitiveness_pct: number | null; // cheapest share on corroborated
  distinct_products: number;
  headline: { ar: string; en: string };
}

const AGGRESSIVE_MIN = 50; // ≥ this many evaluable claims ⇒ a systematic pattern

export function computeStoreTrust(i: StoreTrustInput): StoreTrust {
  const claims = i.discount_inflated + i.discount_verified;
  const inflationPct = claims > 0 ? Math.round((i.discount_inflated / claims) * 100) : null;
  const compPct = i.corroborated_appearances > 0 ? Math.round((i.cheapest_count / i.corroborated_appearances) * 100) : null;
  // Honest states: not-analyzed ≠ makes-no-discounts. Only claim "no advertised
  // discounts" when we HAVE analyzed the store's listings and found none.
  const behavior: DiscountBehavior =
    i.facts_analyzed === 0 ? "insufficient_data"
      : claims === 0 ? "no_advertised_discounts"
        : claims >= AGGRESSIVE_MIN ? "aggressive_claims" : "some_claims";

  // Honest, nuanced headline — separates discount theatre from real price value.
  let ar = "", en = "";
  const compAr = compPct != null ? `الأرخص فعليًا ${compPct}٪ من الوقت` : "بيانات المقارنة السعرية محدودة";
  const compEn = compPct != null ? `genuinely cheapest ${compPct}% of the time` : "limited price-comparison data";
  if (behavior === "insufficient_data") {
    ar = `لم نحلّل سجل خصومات هذا المتجر بعد${compPct != null ? ` — ${compAr}` : ""}.`;
    en = `We haven't analyzed this store's discount history yet${compPct != null ? ` — ${compEn}` : ""}.`;
  } else if (behavior === "no_advertised_discounts") {
    ar = `لا يعلن خصومات «قبل/بعد» نرصدها — ${compAr}.`;
    en = `Advertises no "was/now" discounts we track — ${compEn}.`;
  } else if (inflationPct != null && inflationPct >= 70) {
    ar = `يعلن خصمًا على كثير من المنتجات؛ ${inflationPct}٪ منها يشير لسعر لم نرصده — لكنه ${compAr}. الخلاصة: ثق بالسعر لا بنسبة الخصم.`;
    en = `Advertises discounts widely; ${inflationPct}% reference a price we never observed — yet it's ${compEn}. Bottom line: trust the price, not the discount %.`;
  } else {
    ar = `${inflationPct != null ? `${inflationPct}٪ من خصوماته المعلنة تشير لسعر لم نرصده؛ ` : ""}${compAr}.`;
    en = `${inflationPct != null ? `${inflationPct}% of advertised discounts reference a price we never observed; ` : ""}${compEn}.`;
  }

  return {
    store_id: i.store_id, store_name: i.store_name, discount_behavior: behavior,
    evaluable_claims: claims, discount_inflation_pct: inflationPct, verified_deals: i.discount_verified,
    price_competitiveness_pct: compPct, distinct_products: i.distinct_products,
    headline: { ar, en },
  };
}

/** Rank stores for a neutral "trust" list: real price value first, then honesty,
 *  then coverage. NEVER commission (there is none here). Deterministic. */
export function rankStoresByTrust(stores: StoreTrust[]): StoreTrust[] {
  return [...stores].sort((a, b) =>
    (b.price_competitiveness_pct ?? -1) - (a.price_competitiveness_pct ?? -1) ||
    (a.discount_inflation_pct ?? 101) - (b.discount_inflation_pct ?? 101) ||
    b.distinct_products - a.distinct_products
  );
}

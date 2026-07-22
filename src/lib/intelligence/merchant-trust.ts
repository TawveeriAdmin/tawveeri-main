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
  discount_inflated: number;   // listings whose advertised "was" we did NOT observe in our window
  discount_verified: number;   // listings with a genuine observed drop
  cheapest_count: number;      // times cheapest among corroborated products
  corroborated_appearances: number; // appearances on corroborated products
  distinct_products: number;
  observation_window_days?: number;  // longest tracking window across the store's listings
  data_age_days?: number;            // days since the freshest observation (freshness)
}

export type DiscountBehavior = "unobserved_reference" | "some_unobserved_reference" | "no_advertised_discounts" | "insufficient_data";
export type Confidence = "high" | "medium" | "low";

export interface StoreTrust {
  store_id: number | string;
  store_name: string;
  discount_behavior: DiscountBehavior;
  evaluable_claims: number;              // inflated + verified (claims we could check)
  unobserved_reference_pct: number | null; // % of evaluable claims whose "was" we never observed
  verified_deals: number;
  price_competitiveness_pct: number | null; // cheapest share on corroborated
  distinct_products: number;
  /** Evidence context — never state more than this supports (founder standard). */
  evidence: { sample_size: number; observation_window_days: number | null; data_age_days: number | null; confidence: Confidence };
  headline: { ar: string; en: string };
}

const AGGRESSIVE_MIN = 50; // ≥ this many evaluable claims ⇒ a systematic pattern

function confidenceFor(sample: number): Confidence {
  return sample >= 100 ? "high" : sample >= 20 ? "medium" : "low";
}

export function computeStoreTrust(i: StoreTrustInput): StoreTrust {
  const claims = i.discount_inflated + i.discount_verified;
  const unobservedPct = claims > 0 ? Math.round((i.discount_inflated / claims) * 100) : null;
  const compPct = i.corroborated_appearances > 0 ? Math.round((i.cheapest_count / i.corroborated_appearances) * 100) : null;
  // Honest states: not-analyzed ≠ makes-no-discounts. Only claim "no advertised
  // discounts" when we HAVE analyzed the store's listings and found none.
  const behavior: DiscountBehavior =
    i.facts_analyzed === 0 ? "insufficient_data"
      : claims === 0 ? "no_advertised_discounts"
        : claims >= AGGRESSIVE_MIN ? "unobserved_reference" : "some_unobserved_reference";

  // Sample the evidence supports: claims for discount behavior, facts for "no discounts".
  const sample = claims > 0 ? claims : i.facts_analyzed;
  const win = i.observation_window_days ?? null;
  const winAr = win != null ? ` خلال ${win} يوم من التتبّع` : "";
  const winEn = win != null ? ` over ${win} days of tracking` : "";

  // Precise, NON-ACCUSATORY headline (founder standard): "did not observe" ≠ "fabricated".
  let ar = "", en = "";
  const compAr = compPct != null ? `الأرخص فعليًا ${compPct}٪ من المنتجات المقارَنة` : "بيانات المقارنة السعرية محدودة";
  const compEn = compPct != null ? `genuinely cheapest on ${compPct}% of compared products` : "limited price-comparison data";
  if (behavior === "insufficient_data") {
    ar = `لم نحلّل سجل خصومات هذا المتجر بعد${compPct != null ? ` — ${compAr}` : ""}.`;
    en = `We haven't analyzed this store's discount history yet${compPct != null ? ` — ${compEn}` : ""}.`;
  } else if (behavior === "no_advertised_discounts") {
    ar = `لم نرصد خصومات «قبل/بعد» على ${sample} منتجًا تتبّعناه${winAr} — ${compAr}.`;
    en = `We observed no "was/now" discount claims across ${sample} listings we tracked${winEn} — ${compEn}.`;
  } else if (unobservedPct != null && unobservedPct >= 70) {
    ar = `في ${unobservedPct}٪ من خصوماته المعلنة (عيّنة ${sample}${winAr}) لم نرصد سعر «قبل» المعلن في سجلّنا — لكنه ${compAr}. الخلاصة: قارن السعر الفعلي لا نسبة الخصم.`;
    en = `On ${unobservedPct}% of its advertised discounts (sample ${sample}${winEn}) we did not observe the advertised "was" price in our history — yet it's ${compEn}. Bottom line: compare the actual price, not the discount %.`;
  } else {
    ar = `${unobservedPct != null ? `في ${unobservedPct}٪ من خصوماته المعلنة (عيّنة ${sample}) لم نرصد سعر «قبل» المعلن؛ ` : ""}${compAr}.`;
    en = `${unobservedPct != null ? `On ${unobservedPct}% of its advertised discounts (sample ${sample}) we did not observe the advertised "was" price; ` : ""}${compEn}.`;
  }

  return {
    store_id: i.store_id, store_name: i.store_name, discount_behavior: behavior,
    evaluable_claims: claims, unobserved_reference_pct: unobservedPct, verified_deals: i.discount_verified,
    price_competitiveness_pct: compPct, distinct_products: i.distinct_products,
    evidence: { sample_size: sample, observation_window_days: win, data_age_days: i.data_age_days ?? null, confidence: confidenceFor(sample) },
    headline: { ar, en },
  };
}

/** Rank stores for a neutral "trust" list: real price value first, then honesty,
 *  then coverage. NEVER commission (there is none here). Deterministic. */
export function rankStoresByTrust(stores: StoreTrust[]): StoreTrust[] {
  return [...stores].sort((a, b) =>
    (b.price_competitiveness_pct ?? -1) - (a.price_competitiveness_pct ?? -1) ||
    (a.unobserved_reference_pct ?? 101) - (b.unobserved_reference_pct ?? 101) ||
    b.distinct_products - a.distinct_products
  );
}

// src/lib/intelligence/evidence-engine.ts
// ─────────────────────────────────────────────────────────────────────────────
// TRUST & EVIDENCE ENGINE (Phase 2 — Decision Intelligence, ADR-087)
//
// Tawveeri's differentiator is "evidence, not opinions." This engine turns the raw
// signals TPS already produces (corroboration, identity confidence, price history,
// freshness, cross-store consistency, discount integrity) into ONE transparent,
// deterministic Trust Assessment per product: a 0–100 score, a tier, and — crucially —
// a factor-by-factor breakdown where every factor CITES the evidence it came from and
// every weakness is surfaced as an honest caveat.
//
// It composes the existing intelligence primitives; it does not re-derive them. It
// replaces the Decision Agent's ad-hoc `((identity_confidence ?? 70)+store_count*8)/1.2`
// with something explainable and evidence-grounded.
//
// TPS invariants:
//   • Corroboration IS trust — it carries the largest weight (Constitution principle).
//   • Unknown beats incorrect — a MISSING signal never inflates the score; it lowers it
//     and appears as a caveat. We never fabricate confidence we cannot evidence.
//   • Precision over recall — a single-store product is honestly low-trust for PRICE
//     (it cannot be compared), regardless of how well it is identified.
//   • Deterministic — pure function, no LLM in the score path (ADR-002).
// ─────────────────────────────────────────────────────────────────────────────

export type TrustTier = "high" | "medium" | "low";
export type FactorStatus = "strong" | "ok" | "weak" | "unknown";

export interface TrustFactor {
  key: "corroboration" | "identity" | "price_history" | "freshness" | "price_consistency" | "deal_integrity";
  label_ar: string;
  label_en: string;
  weight: number;        // share of the 0–100 score this factor can contribute
  value: number;         // 0..1 strength derived from evidence
  contribution: number;  // round(weight * value * 100), points added to the score
  status: FactorStatus;
  evidence_ar: string;   // cited provenance ("corroborated by 3 stores", …)
  evidence_en: string;
}

export interface TrustAssessment {
  score: number;         // 0..100 deterministic
  tier: TrustTier;
  factors: TrustFactor[];
  caveats_ar: string[];
  caveats_en: string[];
  version: string;
}

/** All evidence is OPTIONAL — a missing signal is treated conservatively, not ignored. */
export interface EvidenceInput {
  store_count?: number | null;
  identity_confidence?: number | null;   // 0..100
  /** true when a price-determining spec is unstated (e.g. mobile NO_STORAGE). */
  specs_incomplete?: boolean;
  has_comparison?: boolean | null;
  price_spread_pct?: number | null;       // cross-store spread %, when comparable
  /** From the deterministic price verdict (price-intelligence.ts). */
  price_confident?: boolean | null;
  price_distinct_days?: number | null;
  /** Hours since the freshest observation. */
  data_age_hours?: number | null;
  /** From discount integrity — true only when a claimed discount is corroborated. */
  discount_honest?: boolean | null;
  /** Whether a discount is even being claimed (so we don't penalize its absence). */
  discount_claimed?: boolean | null;
}

export const EVIDENCE_ENGINE_VERSION = "trust-v1";

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const statusFor = (v: number, known: boolean): FactorStatus =>
  !known ? "unknown" : v >= 0.8 ? "strong" : v >= 0.55 ? "ok" : "weak";

/**
 * Assess trust for one product from whatever evidence is available.
 * Weights are fixed and sum to 1.0; corroboration dominates (TPS).
 */
export function assessTrust(e: EvidenceInput): TrustAssessment {
  const factors: TrustFactor[] = [];
  const caveats_ar: string[] = [];
  const caveats_en: string[] = [];

  // ── 1. Corroboration (0.32) — how many independent stores agree. TPS core. ──
  {
    const sc = e.store_count ?? 0;
    const known = e.store_count != null;
    // Corroboration is the platform's core value. A single store cannot be
    // price-compared, so it is deliberately weak here (a rich single-store product
    // can still reach 'medium' via price-history/freshness, but never on identity alone).
    const value = sc >= 4 ? 1 : sc === 3 ? 0.9 : sc === 2 ? 0.72 : sc === 1 ? 0.2 : 0.05;
    factors.push({
      key: "corroboration", label_ar: "التوافق بين المتاجر", label_en: "Cross-store corroboration",
      weight: 0.32, value, contribution: Math.round(0.32 * value * 100), status: statusFor(value, known),
      evidence_ar: sc >= 2 ? `مؤكَّد ومُقارَن في ${sc} متاجر` : sc === 1 ? "متجر واحد فقط — لا يمكن مقارنة السعر" : "لا توجد عروض مؤكدة",
      evidence_en: sc >= 2 ? `corroborated across ${sc} stores` : sc === 1 ? "single store — price not comparable" : "no corroborated offers",
    });
    if (sc < 2) { caveats_ar.push("متوفر في متجر واحد — لا مقارنة سعر"); caveats_en.push("Single store — no price comparison"); }
  }

  // ── 2. Identity precision (0.22) — how completely the product was identified. ──
  {
    const idc = e.identity_confidence != null ? clamp01(e.identity_confidence / 100) : 0.5;
    const known = e.identity_confidence != null;
    // A price-determining spec left unstated caps identity trust (e.g. NO_STORAGE).
    const value = e.specs_incomplete ? Math.min(idc, 0.55) : idc;
    factors.push({
      key: "identity", label_ar: "دقة تحديد المنتج", label_en: "Identity precision",
      weight: 0.22, value, contribution: Math.round(0.22 * value * 100), status: statusFor(value, known),
      evidence_ar: e.specs_incomplete ? "مواصفة مؤثرة غير محددة (مثل السعة)" : `دقة الهوية ${Math.round(idc * 100)}%`,
      evidence_en: e.specs_incomplete ? "a price-determining spec is unspecified" : `identity confidence ${Math.round(idc * 100)}%`,
    });
    if (e.specs_incomplete) { caveats_ar.push("مواصفة مؤثرة على السعر غير محددة"); caveats_en.push("A price-determining spec is unspecified"); }
  }

  // ── 3. Price-history depth (0.20) — is the price claim backed by evidence over time? ──
  {
    const known = e.price_confident != null || e.price_distinct_days != null;
    const days = e.price_distinct_days ?? 0;
    const value = e.price_confident ? clamp01(0.6 + Math.min(days, 14) / 35) : days > 0 ? clamp01(days / 14) * 0.5 : 0.25;
    factors.push({
      key: "price_history", label_ar: "عمق سجل السعر", label_en: "Price-history depth",
      weight: 0.20, value, contribution: Math.round(0.20 * value * 100), status: statusFor(value, known),
      evidence_ar: e.price_confident ? `سعر متتبَّع عبر ${days} يوم رصد` : "سجل السعر قيد التكوين",
      evidence_en: e.price_confident ? `price tracked over ${days} observed days` : "price history still building",
    });
    if (known && !e.price_confident) { caveats_ar.push("سجل السعر قيد التكوين — الحكم على السعر تقريبي"); caveats_en.push("Price history still building — price judgement is preliminary"); }
  }

  // ── 4. Freshness (0.14) — how recent is the evidence? ──
  {
    const known = e.data_age_hours != null;
    const h = e.data_age_hours ?? 999;
    const value = !known ? 0.5 : h <= 6 ? 1 : h <= 24 ? 0.85 : h <= 72 ? 0.6 : h <= 168 ? 0.4 : 0.25;
    factors.push({
      key: "freshness", label_ar: "حداثة البيانات", label_en: "Data freshness",
      weight: 0.14, value, contribution: Math.round(0.14 * value * 100), status: statusFor(value, known),
      evidence_ar: known ? `آخر رصد قبل ${h < 1 ? "أقل من ساعة" : Math.round(h) + " ساعة"}` : "زمن آخر رصد غير معروف",
      evidence_en: known ? `last observed ${h < 1 ? "under an hour" : Math.round(h) + "h"} ago` : "observation time unknown",
    });
    if (known && h > 72) { caveats_ar.push("قد تكون البيانات غير حديثة"); caveats_en.push("Data may be stale"); }
  }

  // ── 5. Price consistency (0.08) — low cross-store spread = verification (ADR-077). ──
  {
    const comparable = e.has_comparison === true && e.price_spread_pct != null;
    const spread = e.price_spread_pct ?? 0;
    const value = !comparable ? 0.5 : spread <= 20 ? 1 : spread <= 60 ? 0.8 : spread <= 150 ? 0.5 : 0.25;
    factors.push({
      key: "price_consistency", label_ar: "اتساق الأسعار", label_en: "Price consistency",
      weight: 0.08, value, contribution: Math.round(0.08 * value * 100), status: statusFor(value, comparable),
      evidence_ar: comparable ? `فارق السعر بين المتاجر ${Math.round(spread)}%` : "لا تنطبق (متجر واحد)",
      evidence_en: comparable ? `${Math.round(spread)}% price spread across stores` : "n/a (single store)",
    });
    if (comparable && spread > 150) { caveats_ar.push("فارق سعر كبير — قد تختلف المنتجات فعلياً"); caveats_en.push("Large price spread — listings may differ"); }
  }

  // ── 6. Deal integrity (0.04) — only meaningful when a discount is claimed. ──
  {
    const claimed = e.discount_claimed === true;
    const known = claimed && e.discount_honest != null;
    const value = !claimed ? 1 : e.discount_honest ? 1 : 0.2; // no claim ⇒ nothing to distrust
    factors.push({
      key: "deal_integrity", label_ar: "مصداقية الخصم", label_en: "Discount integrity",
      weight: 0.04, value, contribution: Math.round(0.04 * value * 100), status: !claimed ? "ok" : statusFor(value, known),
      evidence_ar: !claimed ? "لا يوجد خصم مُعلن" : e.discount_honest ? "الخصم مؤكَّد من سجل السعر" : "الخصم غير مؤكَّد من سجل السعر",
      evidence_en: !claimed ? "no discount claimed" : e.discount_honest ? "discount verified against price history" : "claimed discount not supported by history",
    });
    if (claimed && e.discount_honest === false) { caveats_ar.push("الخصم المُعلن غير مؤكَّد من سجل السعر"); caveats_en.push("Claimed discount not supported by price history"); }
  }

  const score = Math.max(0, Math.min(100, factors.reduce((a, f) => a + f.contribution, 0)));
  const tier: TrustTier = score >= 72 ? "high" : score >= 50 ? "medium" : "low";
  return { score, tier, factors, caveats_ar, caveats_en, version: EVIDENCE_ENGINE_VERSION };
}

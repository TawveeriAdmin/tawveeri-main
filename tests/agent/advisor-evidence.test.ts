// tests/agent/advisor-evidence.test.ts
// The customer-facing trust taxonomy (Founder Directive Part 2): evidenceGroups must
// let a shopper DISTINGUISH verified fact vs inference vs unknown vs insufficient — and
// must never invent evidence (it only reclassifies the engine's cited output).
import { evidenceGroups, suitabilityPhrase, type AdvisorRecommendation } from "../../src/lib/agent/advisor-api";

const base: AdvisorRecommendation = {
  canonical_id: "c1", tps_identity_key: "k1", title_ar: "منتج", title_en: "Product", brand: "samsung",
  unit_price: 1000, total_cost_estimate: 1000, cost_breakdown: { unit: 1000, installation: null, annual_electricity: null },
  // 0..1 — the scale `decision-engine.ts` actually emits. This fixture said 88, which let the
  // view render `${score}%` for years without a test noticing it published "0.89%" in production.
  store_count: 3, comparison_available: true, suitability_score: 0.88, confidence: 80, is_smart_pick: true,
  reasons_ar: ["الأنسب لطلبك"], dna: {}, go_offer_hint: "", go_url: "/go/x",
  stores: ["المنيع", "اكسترا", "أمازون"], data_age_hours: 3,
  trust: {
    score: 80, tier: "high",
    factors: [
      { key: "corroboration", label_ar: "التوافق", label_en: "Corroboration", status: "strong", evidence_ar: "مؤكَّد ومُقارَن في 3 متاجر", evidence_en: "corroborated across 3 stores" },
      { key: "price_history", label_ar: "سجل السعر", label_en: "Price history", status: "ok", evidence_ar: "سعر متتبَّع عبر 12 يوم رصد", evidence_en: "price tracked over 12 observed days" },
      { key: "freshness", label_ar: "الحداثة", label_en: "Freshness", status: "strong", evidence_ar: "آخر رصد قبل 3 ساعة", evidence_en: "last observed 3h ago" },
      { key: "identity", label_ar: "الهوية", label_en: "Identity", status: "weak", evidence_ar: "مواصفة مؤثرة غير محددة", evidence_en: "a price-determining spec is unspecified" },
      { key: "deal_integrity", label_ar: "الخصم", label_en: "Discount", status: "unknown", evidence_ar: "زمن آخر رصد غير معروف", evidence_en: "unknown" },
    ],
    caveats_ar: ["مواصفة مؤثرة على السعر غير محددة"],
  },
};

describe("evidenceGroups — the Part-2 trust taxonomy", () => {
  it("shows NAMED corroboration as a verified fact (not just a count)", () => {
    const g = evidenceGroups(base, "ar");
    expect(g.facts.some((f) => f.includes("المنيع") && f.includes("اكسترا") && f.includes("أمازون"))).toBe(true);
  });
  it("routes strong/ok factors to facts, weak to insufficient, unknown to unknown", () => {
    const g = evidenceGroups(base, "ar");
    expect(g.facts.some((f) => /12 يوم/.test(f))).toBe(true);      // price history (ok)
    expect(g.facts.some((f) => /3 ساعة/.test(f))).toBe(true);      // freshness (strong)
    expect(g.insufficient.some((f) => /مواصفة/.test(f))).toBe(true); // identity (weak) + caveat
    expect(g.unknown.some((f) => /غير معروف/.test(f))).toBe(true);   // deal_integrity (unknown)
  });
  it("classifies total-cost estimate and suitability as INFERENCES, not facts", () => {
    const withCost: AdvisorRecommendation = { ...base, total_cost_estimate: 1300, cost_breakdown: { unit: 1000, installation: 300, annual_electricity: null } };
    const g = evidenceGroups(withCost, "ar");
    expect(g.inferences.some((f) => /تقديرية/.test(f))).toBe(true);   // total cost is inferred
    expect(g.inferences).toContain("مطابق لما طلبته");                // suitability is inferred
    expect(g.facts.some((f) => /تقديرية/.test(f))).toBe(false);       // never a "fact"
  });
  it("states fit in words, never as a raw percentage", () => {
    // The defect: a 0..1 score suffixed with '%' published "0.89%" — read as "almost no
    // match" — on the product ranked FIRST. No evidence line may carry a bare % again.
    for (const s of [0.05, 0.49, 0.5, 0.7, 0.83, 0.89, 1]) {
      const g = evidenceGroups({ ...base, suitability_score: s }, "ar");
      expect(g.inferences.some((f) => f.includes("%"))).toBe(false);
      expect(g.inferences).toContain(suitabilityPhrase(s, "ar"));
    }
  });
  it("suitabilityPhrase is banded, bilingual, and silent when there is no score", () => {
    expect(suitabilityPhrase(0.9, "ar")).toBe("مطابق لما طلبته");
    expect(suitabilityPhrase(0.75, "ar")).toBe("مناسب لطلبك");
    expect(suitabilityPhrase(0.55, "ar")).toBe("مناسب جزئيًا لطلبك");
    expect(suitabilityPhrase(0.2, "ar")).toBe("ملاءمته لطلبك محدودة");
    expect(suitabilityPhrase(0.9, "en")).toBe("Matches what you asked for");
    for (const empty of [0, -1, null, undefined, NaN]) {
      expect(suitabilityPhrase(empty as number, "ar")).toBeNull();
    }
  });
  it("single-store product surfaces insufficient-evidence, no named corroboration fact", () => {
    const single: AdvisorRecommendation = { ...base, comparison_available: false, store_count: 1, stores: ["المنيع"],
      trust: { score: 30, tier: "low", factors: [
        { key: "corroboration", label_ar: "", label_en: "", status: "weak", evidence_ar: "متجر واحد فقط — لا يمكن مقارنة السعر", evidence_en: "single store — price not comparable" },
      ], caveats_ar: ["متوفر في متجر واحد — لا مقارنة سعر"] } };
    const g = evidenceGroups(single, "ar");
    expect(g.facts.some((f) => f.includes("مقارَن في"))).toBe(false);
    expect(g.insufficient.some((f) => /متجر واحد/.test(f))).toBe(true);
  });
  it("never fabricates: a rec with no trust data yields empty fact/unknown groups", () => {
    const bare: AdvisorRecommendation = { ...base, trust: null, stores: null, comparison_available: false, suitability_score: 0, total_cost_estimate: null };
    const g = evidenceGroups(bare, "ar");
    expect(g.facts).toEqual([]);
    expect(g.unknown).toEqual([]);
    expect(g.insufficient).toEqual([]);
  });
});

/**
 * SAUDI SHOPPER LANGUAGE & DEMAND DISCOVERY mission (2026-08-11) — pins the general
 * structural gaps found via external research + a full repo audit + a new evaluation corpus
 * (scripts/shopper-demand-eval/), NOT the closed Waffar/Search-eligibility workstream. Every
 * fix here is ADDITIVE to task-parser.ts's existing vocabulary/detectors — no accessory-
 * eligibility, category-classifier, or DecisionState logic from checkpoint #70 is touched.
 */
import { parseShoppingTask } from "@/lib/agent/task-parser";
import { routeQuery } from "@/lib/agent/route-query";
import { decideWashingMachine } from "@/lib/agent/decision-engine";
import type { CanonicalRow } from "@/lib/agent/decision-engine";

describe("«value» priority — quality/reasonable-price intent, distinct from CHEAPEST_MARKER and numeric budget", () => {
  it("bare «رخيص» and «سعره مناسب/كويس/معقول» all resolve the value priority", () => {
    expect(parseShoppingTask("ابي مكيف رخيص وجودته عالية").priorities).toContain("value");
    expect(parseShoppingTask("ابي جوال وسعره مناسب").priorities).toContain("value");
    expect(parseShoppingTask("ابي ثلاجة سعرها كويس").priorities).toContain("value");
    expect(parseShoppingTask("وش افضل ايباد بسعر معقول").priorities).toContain("value");
  });

  it("English value phrasings resolve the same key", () => {
    expect(parseShoppingTask("an affordable laptop for university").priorities).toContain("value");
    expect(parseShoppingTask("looking for good value on a washing machine").priorities).toContain("value");
  });

  it("does NOT collide with CHEAPEST_MARKER — «أرخص» still means sort-to-cheapest, not the value priority alone", () => {
    const cheapest = parseShoppingTask("أرخص لابتوب");
    expect(cheapest.wants_cheapest).toBe(true);
  });

  it("«value» is negatable through the SAME polarity system every other priority uses (no special-cased exemption)", () => {
    const task = parseShoppingTask("لابتوب مو مهم رخيص");
    expect(task.priorities ?? []).not.toContain("value");
    expect(task.deprioritized_priorities).toContain("value");
  });
});

describe("wants_discount — first-turn deal-seeking intent, distinct from the follow-up DEAL_EVALUATION intent", () => {
  it("Arabic and English deal markers all resolve wants_discount=true", () => {
    expect(parseShoppingTask("ابي ايباد جديد وعليه تخفيض").wants_discount).toBe(true);
    expect(parseShoppingTask("ابحث عن مكيف عليه عرض حاليا").wants_discount).toBe(true);
    expect(parseShoppingTask("ابي ثلاجة تكفي عائلة كبيرة وفيها خصم").wants_discount).toBe(true);
    expect(parseShoppingTask("looking for a TV on sale under 2500").wants_discount).toBe(true);
    expect(parseShoppingTask("any fridge deals right now").wants_discount).toBe(true);
    expect(parseShoppingTask("is there a good offer on any phone right now").wants_discount).toBe(true);
  });

  it("a query with no deal language leaves wants_discount unset", () => {
    expect(parseShoppingTask("ابي لابتوب للجامعه").wants_discount).toBeUndefined();
  });
});

describe("dryer_combo — washing-machine combo-dryer want promoted to a real, negatable priority key", () => {
  it("resolves as a positive priority from multiple phrasings", () => {
    expect(parseShoppingTask("ابي غسالة فيها نشافة").priorities).toContain("dryer_combo");
    expect(parseShoppingTask("أريد غسالة بخاصية التجفيف").priorities).toContain("dryer_combo");
  });

  it("can be EXCLUDED («ما ابي»/«بدون») — impossible before this mission (no keyword existed to negate)", () => {
    const excl = parseShoppingTask("ابي غسالة عادية ما ابي نشافة");
    expect(excl.excluded_priorities).toContain("dryer_combo");
  });

  it("decideWashingMachine reads dryer_combo from priorities[] (not only the legacy raw-text regex)", () => {
    const rows: CanonicalRow[] = [
      { canonical_id: "a", tps_identity_key: "a", display_name_ar: "غسالة مع نشافة", display_name_en: null, brand: "x", category: "washing_machine", image_url: null, lowest_price: 2000, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { capacity_kg: 9, has_dryer: true } },
      { canonical_id: "b", tps_identity_key: "b", display_name_ar: "غسالة عادية", display_name_en: null, brand: "x", category: "washing_machine", image_url: null, lowest_price: 2000, store_count: 2, has_comparison: true, identity_confidence: 0.9, attributes: { capacity_kg: 9, has_dryer: false } },
    ];
    const recs = decideWashingMachine({ category: "washing_machine", priorities: ["dryer_combo"] }, rows);
    const withDryer = recs.find((r) => r.canonical_id === "a")!;
    const withoutDryer = recs.find((r) => r.canonical_id === "b")!;
    expect(withDryer.suitability_score).toBeGreaterThan(withoutDryer.suitability_score);
  });
});

describe("cross-category regression guards — possessive-morpheme camera, colloquial low_electricity, «latest» synonym", () => {
  it("«كاميرته»/«كاميرتها» (possessive) resolves camera, same class as the already-fixed «بطاريت» battery gap", () => {
    expect(parseShoppingTask("جوال كاميرته زينة").priorities).toContain("camera");
  });

  it("«كهرب» (colloquial, no formal اء ending) resolves low_electricity same as «كهرباء»", () => {
    expect(parseShoppingTask("ابي مكيف ما يصرف كهرب كثير").priorities).toContain("low_electricity");
  });

  it("«حديث»/«حديث الإصدار» resolves the same «latest» key as «جديد»", () => {
    expect(parseShoppingTask("ابحث عن آيباد حديث الإصدار").priorities).toContain("latest");
  });
});

describe("bare-superlative recommendation marker — «افضل X» without a leading «وش» or trailing «لي»", () => {
  it("resolves wants_recommendation for a leading bare superlative", () => {
    expect(parseShoppingTask("افضل ثلاجه كبيره للعائله").wants_recommendation).toBe(true);
    expect(parseShoppingTask("ابي افضل جوال بكاميرا ممتازة").wants_recommendation).toBe(true);
  });

  it("does not change «وش أفضل»/«ايش أفضل»'s existing routing to PRODUCT_COMPARISON (compare-intent.ts owns that classification, unaffected by this file)", () => {
    const route = routeQuery("وش افضل مكيف وسعره رخيص جيد مناسب");
    expect(route.mode).toBe("comparison");
  });

  it("English 'what is a good/best X' and 'is there a good X' also resolve wants_recommendation", () => {
    expect(parseShoppingTask("what is a good fridge that is not overpriced").wants_recommendation).toBe(true);
    expect(parseShoppingTask("is there a good offer on any phone right now").wants_recommendation).toBe(true);
  });
});

describe("regression guard — the closed workstream's own acceptance phrases are untouched", () => {
  it("the founder's checkpoint #70 laptop phrases still resolve category=laptop with productivity", () => {
    for (const p of ["ابي لاب توب للجامعه", "ابي لابتوب للجامعه", "ابي لاب توب للدراسه", "ابي لاب توب للتصميم"]) {
      const task = parseShoppingTask(p);
      expect(task.category).toBe("laptop");
    }
  });
});

/**
 * Neutral Advisor UI — presentation helpers. These must ONLY reformat what the
 * deterministic engine returned (labels, badges, cost lines), never fabricate a
 * price, store, or comparison. Bilingual output is asserted for both locales.
 */
import {
  categoryLabel, priorityLabel, recTitle, comparisonBadge, costLines,
  hasTotalBeyondUnit, parsedSummary, parsedConstraintChips, exitHref, verdictTone, verdictText, choiceReasons, discountLine,
  type AdvisorRecommendation, type PriceIntel,
} from "../../src/lib/agent/advisor-api";

const rec = (over: Partial<AdvisorRecommendation> = {}): AdvisorRecommendation => ({
  canonical_id: "c1", tps_identity_key: "haier|split|24000", title_ar: "مكيف هايسنس", title_en: "Haier split AC",
  brand: "haier", unit_price: 2000, total_cost_estimate: 2710,
  cost_breakdown: { unit: 2000, installation: 350, annual_electricity: 360 },
  store_count: 3, comparison_available: true, suitability_score: 0.8, confidence: 88,
  is_smart_pick: true, reasons_ar: ["إنفرتر — أوفر"], dna: {}, go_offer_hint: "c1", go_url: "/go/abc", ...over,
});

describe("Advisor labels (bilingual, deterministic)", () => {
  it("localizes known categories and priorities", () => {
    expect(categoryLabel("air_conditioner", "ar")).toBe("مكيف");
    expect(categoryLabel("air_conditioner", "en")).toBe("Air conditioner");
    expect(categoryLabel("dishwasher", "ar")).toBe("غسالة صحون");
    expect(priorityLabel("low_electricity", "ar")).toBe("موفر للكهرباء");
    expect(priorityLabel("gaming", "en")).toBe("Gaming");
  });
  it("falls back to a de-slugged label for unknown categories (no crash)", () => {
    expect(categoryLabel("space_heater", "en")).toBe("space heater");
    expect(categoryLabel(undefined, "ar")).toBe("");
  });
});

describe("recTitle — locale with graceful fallback", () => {
  it("prefers the locale title, falls back to the other language", () => {
    expect(recTitle(rec(), "en")).toBe("Haier split AC");
    expect(recTitle(rec(), "ar")).toBe("مكيف هايسنس");
    expect(recTitle(rec({ title_ar: null }), "ar")).toBe("Haier split AC");
    expect(recTitle(rec({ title_ar: null, title_en: null }), "ar")).toBe("haier");
  });
});

describe("comparisonBadge — honest trust signal (never fabricates comparison)", () => {
  it("labels a ≥2-store corroborated pick as verified", () => {
    const b = comparisonBadge(rec({ store_count: 3, comparison_available: true }), "ar");
    expect(b.verified).toBe(true);
    expect(b.text).toMatch(/موثّقة/);
  });
  it("labels a single-store pick honestly (not verified)", () => {
    const b = comparisonBadge(rec({ store_count: 1, comparison_available: false }), "en");
    expect(b.verified).toBe(false);
    expect(b.text).toMatch(/Single store/);
  });
});

describe("costLines — only engine-supplied, non-zero parts", () => {
  it("shows unit + installation + annual electricity when present", () => {
    const lines = costLines(rec(), "ar");
    expect(lines.map((l) => l.amount)).toEqual([2000, 350, 360]);
  });
  it("omits zero/null installation and electricity (e.g. small appliance)", () => {
    const lines = costLines(rec({ cost_breakdown: { unit: 120, installation: null, annual_electricity: 0 } }), "en");
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(120);
  });
  it("hasTotalBeyondUnit is true only when total exceeds unit", () => {
    expect(hasTotalBeyondUnit(rec())).toBe(true);
    expect(hasTotalBeyondUnit(rec({ total_cost_estimate: 2000, unit_price: 2000 }))).toBe(false);
  });
});

describe("parsedSummary — how the free text was understood", () => {
  it("summarizes category, room size, budget, priorities", () => {
    const chips = parsedSummary({ category: "air_conditioner", room_size_m2: 30, budget_total: 4000, priorities: ["quiet", "low_electricity"] }, "ar");
    expect(chips).toEqual(["مكيف", "30 م²", "تحت 4000 ريال", "هادئ", "موفر للكهرباء"]);
  });
  it("returns empty for no parse", () => {
    expect(parsedSummary(undefined, "ar")).toEqual([]);
  });
});

describe("parsedConstraintChips — the Constraint Ledger's field-tagged chips (Section 7)", () => {
  it("tags every chip with its source field", () => {
    const chips = parsedConstraintChips(
      { category: "air_conditioner", room_size_m2: 30, budget_total: 4000, priorities: ["quiet"] }, "ar",
    );
    expect(chips.map((c) => c.field)).toEqual(["category", "room_size_m2", "budget_total", "priority:quiet"]);
  });
  it("category is never removable — it is the subject, not a constraint", () => {
    const chips = parsedConstraintChips({ category: "laptop" }, "ar");
    expect(chips.find((c) => c.field === "category")?.removable).toBe(false);
  });
  it("every other field IS removable", () => {
    const chips = parsedConstraintChips({ category: "laptop", budget_total: 3000, city: "Riyadh" }, "en");
    expect(chips.filter((c) => c.field !== "category").every((c) => c.removable)).toBe(true);
  });
  it("returns empty for no parse (same as parsedSummary)", () => {
    expect(parsedConstraintChips(undefined, "ar")).toEqual([]);
  });
});

describe("price verdict presentation (buy-timing intelligence)", () => {
  const pi = (over: Partial<PriceIntel> = {}): PriceIntel => ({
    verdict: "great_price", confident: true, is_observed_low: true, days_tracked: 27, distinct_days: 20,
    current_best: 990, typical: 1100, pct_vs_typical: -10, trend: "falling",
    text: { ar: "أفضل سعر منذ بدء التتبع", en: "Best price since tracking began" }, ...over,
  });
  it("maps each verdict to a deterministic tone", () => {
    expect(verdictTone("great_price")).toBe("great");
    expect(verdictTone("good_price")).toBe("good");
    expect(verdictTone("typical")).toBe("neutral");
    expect(verdictTone("elevated")).toBe("warn");
    expect(verdictTone("building_history")).toBe("muted");
  });
  it("returns localized verdict text with fallback", () => {
    expect(verdictText(pi(), "en")).toMatch(/Best price/);
    expect(verdictText(pi(), "ar")).toMatch(/أفضل سعر/);
    expect(verdictText(pi({ text: { ar: "نبني سجل السعر", en: "" } }), "en")).toBe("نبني سجل السعر");
    expect(verdictText(null, "ar")).toBe("");
  });
});

describe("choiceReasons — reasoned comparison presentation (§5.5)", () => {
  it("returns localized comparison when present", () => {
    const r = rec({ chosen_over: { alternative_title_ar: "الخيار الثاني", alternative_title_en: "Runner-up", reasons_ar: ["أوفر بـ300 ريال"], reasons_en: ["300 SAR cheaper"] } });
    expect(choiceReasons(r, "ar")).toEqual({ alt: "الخيار الثاني", reasons: ["أوفر بـ300 ريال"] });
    expect(choiceReasons(r, "en")).toEqual({ alt: "Runner-up", reasons: ["300 SAR cheaper"] });
  });
  it("returns null when there is no comparison (honest — no fabricated superiority)", () => {
    expect(choiceReasons(rec({ chosen_over: null }), "ar")).toBeNull();
    expect(choiceReasons(rec(), "ar")).toBeNull();
  });
});

describe("discountLine — honest discount truth on the card", () => {
  it("shows a green line for a verified real drop", () => {
    const r = rec({ discount_intel: { verdict: "verified_drop", real_saving_pct: 61, advertised_saving_pct: 61, text: { ar: "انخفاض حقيقي", en: "Genuine drop 61%" } } });
    expect(discountLine(r, "en")).toEqual({ text: "Genuine drop 61%", tone: "great" });
  });
  it("warns on an inflated advertised discount", () => {
    const r = rec({ discount_intel: { verdict: "inflated_reference", real_saving_pct: 0, advertised_saving_pct: 25, text: { ar: "لم نرصده", en: "never observed" } } });
    expect(discountLine(r, "ar")?.tone).toBe("warn");
  });
  it("is silent on stable/absent (no noise, no accusation)", () => {
    expect(discountLine(rec({ discount_intel: { verdict: "stable", real_saving_pct: 0, advertised_saving_pct: null, text: { ar: "", en: "" } } }), "ar")).toBeNull();
    expect(discountLine(rec(), "ar")).toBeNull();
  });
});

describe("exitHref — measured exit with honest fallback", () => {
  it("uses the measured-exit go_url when present", () => {
    expect(exitHref(rec({ go_url: "/go/xyz" }), "ar")).toBe("/go/xyz");
  });
  it("falls back to the internal compare page when go_url is absent", () => {
    expect(exitHref(rec({ go_url: null, tps_identity_key: "lg|split|18000" }), "en")).toBe("/en/compare/lg%7Csplit%7C18000");
  });
});

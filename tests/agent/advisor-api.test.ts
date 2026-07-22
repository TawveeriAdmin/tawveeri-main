/**
 * Neutral Advisor UI — presentation helpers. These must ONLY reformat what the
 * deterministic engine returned (labels, badges, cost lines), never fabricate a
 * price, store, or comparison. Bilingual output is asserted for both locales.
 */
import {
  categoryLabel, priorityLabel, recTitle, comparisonBadge, costLines,
  hasTotalBeyondUnit, parsedSummary, exitHref, type AdvisorRecommendation,
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

describe("exitHref — measured exit with honest fallback", () => {
  it("uses the measured-exit go_url when present", () => {
    expect(exitHref(rec({ go_url: "/go/xyz" }), "ar")).toBe("/go/xyz");
  });
  it("falls back to the internal compare page when go_url is absent", () => {
    expect(exitHref(rec({ go_url: null, tps_identity_key: "lg|split|18000" }), "en")).toBe("/en/compare/lg%7Csplit%7C18000");
  });
});

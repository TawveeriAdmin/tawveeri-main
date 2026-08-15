// Mission-workspace presentation helpers (Mobile Experience Pass, ADR-250).
// Pure display derivation — grouping, budget bar, chips, diff framing, delta parser.
import {
  groupLegs, budgetBar, fitChip, evidenceChip, energyChip, diffLabel, parseDelta,
  type LegOut, type RecOut, type Mission,
} from "@/lib/agent/home-mission-view";

const rec = (over: Partial<RecOut>): RecOut => ({
  canonical_id: "x", title_ar: "منتج", title_en: "Product", brand: "b", image_url: null,
  unit_price: 1000, store_count: 1, stores: ["اكسترا"], data_age_hours: 10,
  claim_kind: "single", claim_ar: "متاح لدينا حاليًا من متجر واحد", claim_en: "one store",
  reasons_ar: [], reason_kinds: [], headline_reasons: [], trust: { score: 70, tier: "medium" },
  dna: {}, go_url: "/go/1", ...over,
});
const okLeg = (over: Partial<LegOut>): LegOut => ({
  leg_id: "l", category: "tv", label_ar: "التلفزيون", label_en: "TV", emphasis: "normal",
  state: "ok", picked: rec({}), ...over,
});

describe("groupLegs — the 3 ACs are ONE mission section", () => {
  it("groups same-category legs with subtotal, decided count, and worst-child rollup", () => {
    const groups = groupLegs([
      okLeg({ leg_id: "ac_1", category: "air_conditioner", picked: rec({ unit_price: 1800, claim_kind: "compared", store_count: 2, stores: ["اكسترا", "نجم"] }) }),
      okLeg({ leg_id: "ac_2", category: "air_conditioner", picked: rec({ unit_price: 1800, claim_kind: "compared", store_count: 2, stores: ["اكسترا", "نجم"] }) }),
      { leg_id: "ac_3", category: "air_conditioner", label_ar: "مكيف", label_en: "AC", emphasis: "normal", state: "needs_area" },
      okLeg({ leg_id: "tv" }),
    ]);
    expect(groups.length).toBe(2);
    const ac = groups[0];
    expect(ac.key).toBe("air_conditioner");
    expect(ac.label_ar).toBe("التكييف");
    expect(ac.legs.length).toBe(3);
    expect(ac.decided).toBe(2);
    expect(ac.subtotal).toBe(3600);
    // needs_area child rolls up: a collapsed group may never look healthier than its contents
    expect(ac.worst).toBe("needs_input");
    // single-store TV rolls up as evidence-check
    expect(groups[1].worst).toBe("stale_or_single");
  });
  it("healthy group rolls up ok; stale child rolls up", () => {
    const fresh = okLeg({ picked: rec({ claim_kind: "compared", store_count: 2, data_age_hours: 10 }) });
    expect(groupLegs([fresh])[0].worst).toBe("ok");
    const stale = okLeg({ picked: rec({ claim_kind: "compared", store_count: 2, data_age_hours: 100 }) });
    expect(groupLegs([stale])[0].worst).toBe("stale_or_single");
  });
});

describe("budgetBar", () => {
  it("computes pct + tone (ok / tight <10% headroom / over)", () => {
    expect(budgetBar(20000, 14488)).toEqual({ pct: 72, tone: "ok" });
    expect(budgetBar(20000, 19000)).toEqual({ pct: 95, tone: "tight" });
    expect(budgetBar(10000, 12000)).toEqual({ pct: 100, tone: "over" });
    expect(budgetBar(null, 5000)).toBeNull();
  });
});

describe("chips — evidence compression never STRENGTHENS a claim (§17/§18)", () => {
  it("claim kinds map to distinct chips; availability never says verified", () => {
    const compared = evidenceChip(rec({ claim_kind: "compared", store_count: 2 }), "ar");
    const avail = evidenceChip(rec({ claim_kind: "availability", store_count: 3 }), "ar");
    const single = evidenceChip(rec({ claim_kind: "single" }), "ar");
    expect(compared.text).toContain("موثقة");
    expect(avail.text).toContain("بدون تأكيد الموديل");
    expect(avail.text).not.toContain("موثق");
    expect(single.text).toContain("متجر واحد");
    expect(single.tone).toBe("warn");
  });
  it("energy chip is technology-neutral — no efficiency claim", () => {
    const chip = energyChip(rec({ dna: { inverter: true } }), "ar")!;
    expect(chip.text).toContain("إنفرتر");
    expect(chip.text).not.toMatch(/كفاءة|أوفر|كهرباء/);
    expect(energyChip(rec({ dna: {} }), "ar")).toBeNull();
  });
  it("AC fit chip states BTU-for-area from the leg's own facts", () => {
    const leg = okLeg({
      category: "air_conditioner",
      space: { key: "s1", label_ar: "الصالة", label_en: "Living", area_m2: 28 },
      picked: rec({ dna: { capacity_btu: 24000 } }),
    });
    expect(fitChip(leg, "ar")!.text).toBe("24000 وحدة لـ28م²");
  });
});

describe("diffLabel — alternatives framed by the two shown prices only", () => {
  it("cheaper / more expensive / equal", () => {
    expect(diffLabel(1500, 2000, "ar")!.text).toBe("أرخص بـ500 ر.س");
    expect(diffLabel(2500, 2000, "ar")!.text).toBe("أغلى بـ500 ر.س");
    expect(diffLabel(2000, 2000, "ar")).toBeNull();
  });
});

describe("parseDelta — typed mutations survive the move to the view lib", () => {
  const mission: Mission = {
    spaces: [], household_size: 4, budget_total: 12000,
    categories: { tv: "normal", air_conditioner: "high" },
    priorities: [], deprioritized_priorities: [], excluded_priorities: [],
    whole_home: true, unsupported_mentions: [], parsed_from_text: "x",
  };
  it("absolute budget («خلها 16 ألف»)", () => {
    expect(parseDelta("خلها 16 ألف", mission)!.next.budget_total).toBe(16000);
  });
  it("relative budget («زد الميزانية 3000»)", () => {
    expect(parseDelta("زد الميزانية 3000", mission)!.next.budget_total).toBe(15000);
  });
  it("category exclusion («شيل التلفزيون»)", () => {
    expect(parseDelta("شيل التلفزيون", mission)!.next.categories.tv).toBe("excluded");
  });
  it("household («عدد الأسرة 6»)", () => {
    expect(parseDelta("عدد الأسرة 6", mission)!.next.household_size).toBe(6);
  });
  it("unrecognized input → null (treated as a new mission by the caller)", () => {
    expect(parseDelta("وش رايك بالجو اليوم", mission)).toBeNull();
  });
});

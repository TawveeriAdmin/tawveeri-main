// Mission-workspace presentation helpers (Mobile Experience Pass, ADR-250).
// Pure display derivation — grouping, budget bar, chips, diff framing, delta parser.
import { setQuantity } from "@/lib/agent/home-mission-view";
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
    spaces: [], household_size: 4, budget_total: 12000, posture: null, property_type: null,
    categories: { tv: "normal", air_conditioner: "high" },
    quantities: { tv: 1, air_conditioner: 2 },
    priorities: [], deprioritized_priorities: [], excluded_priorities: [],
    whole_home: true, unsupported_mentions: [], parsed_from_text: "x",
  };
  it("absolute budget («خلها 16 ألف»)", () => {
    expect(parseDelta("خلها 16 ألف", mission)!.next.budget_total).toBe(16000);
  });
  it("relative budget («زد الميزانية 3000»)", () => {
    expect(parseDelta("زد الميزانية 3000", mission)!.next.budget_total).toBe(15000);
  });
  it("category exclusion («شيل التلفزيون») → quantity zero AND excluded (one state)", () => {
    const r = parseDelta("شيل التلفزيون", mission)!;
    expect(r.next.categories.tv).toBe("excluded");
    expect(r.next.quantities.tv).toBe(0);
  });
  it("«رجع التلفزيون» restores quantity 1", () => {
    const removed = parseDelta("شيل التلفزيون", mission)!.next;
    const r = parseDelta("رجع التلفزيون", removed)!;
    expect(r.next.quantities.tv).toBe(1);
    expect(r.next.categories.tv).toBe("normal");
  });
  it("quantity mutation («خل المكيفات 4») resizes the AC target spaces too", () => {
    const r = parseDelta("خل المكيفات 4", mission)!;
    expect(r.next.quantities.air_conditioner).toBe(4);
    expect(r.next.spaces.length).toBe(4);
    expect(r.next.spaces.every((s) => s.area_m2 === null)).toBe(true);
  });
  it("new disclosure-tier category («ابي مكنسة»)", () => {
    const r = parseDelta("ابي مكنسة", mission)!;
    expect(r.next.quantities.vacuum).toBe(1);
    expect(r.next.categories.vacuum).toBe("normal");
  });
  it("household («عدد الأسرة 6»)", () => {
    expect(parseDelta("عدد الأسرة 6", mission)!.next.household_size).toBe(6);
  });
  it("unrecognized input → null (treated as a new mission by the caller)", () => {
    expect(parseDelta("وش رايك بالجو اليوم", mission)).toBeNull();
  });
});

describe("setQuantity — quantities, categories and AC spaces move as ONE state (ADR-253)", () => {
  const mission: Mission = {
    spaces: [{ key: "space_1", label_ar: "غرفة النوم", label_en: "Bedroom", area_m2: 16 }],
    household_size: null, budget_total: null, posture: null, property_type: null,
    categories: { air_conditioner: "normal" }, quantities: { air_conditioner: 1 },
    priorities: [], deprioritized_priorities: [], excluded_priorities: [],
    whole_home: false, unsupported_mentions: [], parsed_from_text: "",
  };
  it("raising AC quantity pads unknown-area spaces (named rooms preserved)", () => {
    const m = setQuantity(mission, "air_conditioner", 3);
    expect(m.spaces.length).toBe(3);
    expect(m.spaces[0].area_m2).toBe(16);
    expect(m.spaces[1].area_m2).toBeNull();
  });
  it("lowering AC quantity trims spaces from the end", () => {
    const up = setQuantity(mission, "air_conditioner", 3);
    const down = setQuantity(up, "air_conditioner", 1);
    expect(down.spaces.length).toBe(1);
    expect(down.spaces[0].area_m2).toBe(16);
  });
  it("zero excludes; positive re-includes", () => {
    const z = setQuantity(mission, "air_conditioner", 0);
    expect(z.categories.air_conditioner).toBe("excluded");
    expect(z.spaces.length).toBe(0);
    const back = setQuantity(z, "air_conditioner", 2);
    expect(back.categories.air_conditioner).toBe("normal");
    expect(back.quantities.air_conditioner).toBe(2);
  });
});

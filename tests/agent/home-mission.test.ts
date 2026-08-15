// Home Mission deterministic core — parser, legs, hard eligibility, claim gate, allocator.
// (Part B of the Home Decision Intelligence mission; AUDIT_REPORT_HOME §19–20.)
import {
  parseHomeMission, buildLegs, eligibleRows, allocateBudget, comparisonClaim,
  tvSizeOf, litersBandFor, kgBandFor, MISSION_CATEGORIES,
} from "@/lib/agent/home-mission";
import type { CanonicalRow } from "@/lib/agent/decision-engine";

const row = (over: Partial<CanonicalRow>): CanonicalRow => ({
  canonical_id: "id", tps_identity_key: "brand|x", display_name_ar: null, display_name_en: null,
  brand: "b", category: "tv", image_url: null, lowest_price: 1000, store_count: 1,
  has_comparison: false, identity_confidence: 90, attributes: {}, ...over,
});

describe("parseHomeMission — the founder's own example", () => {
  const text =
    "انتقلت لشقة جديدة. أسرتنا 4 أشخاص. غرفة النوم 16 متر، غرفة الأطفال 14 متر، الصالة 28 متر. " +
    "ميزانيتي للأجهزة 20 ألف. أهم شيء المكيفات تكون هادية وما أبي أصرف فلوسي في مواصفات ما أحتاجها.";
  const p = parseHomeMission(text);

  it("extracts the three spaces with their areas", () => {
    expect(p.spaces.map((s) => s.area_m2)).toEqual([16, 14, 28]);
    expect(p.spaces[0].label_ar).toBe("غرفة النوم");
    expect(p.spaces[2].label_ar).toBe("الصالة");
  });
  it("extracts household 4 and budget 20000 (Saudi thousand-form)", () => {
    expect(p.household_size).toBe(4);
    expect(p.budget_total).toBe(20000);
  });
  it("whole-home signal defaults all four audited categories, AC marked high", () => {
    expect(p.whole_home).toBe(true);
    for (const c of MISSION_CATEGORIES) expect(p.categories[c]).toBeDefined();
    expect(p.categories.air_conditioner).toBe("high");
  });
});

describe("parseHomeMission — polarity, digits, unsupported", () => {
  it("«ما أبي تلفزيون» → excluded; «ما يهمني التلفزيون» → deprioritized", () => {
    expect(parseHomeMission("جهز بيتي بس ما أبي تلفزيون").categories.tv).toBe("excluded");
    expect(parseHomeMission("جهز بيتي وما يهمني التلفزيون كثير").categories.tv).toBe("deprioritized");
  });
  it("Arabic-Indic digits parse («غرفة ١٦ متر» «ميزانيتي ١٢ الف»)", () => {
    const p = parseHomeMission("غرفة النوم ١٦ متر وميزانيتي ١٢ الف ومكيف");
    expect(p.spaces[0].area_m2).toBe(16);
    expect(p.budget_total).toBe(12000);
  });
  it("newly-married reads household 2", () => {
    expect(parseHomeMission("متزوج جديد وأبي أجهز شقة").household_size).toBe(2);
  });
  it("فرن is recognized but honestly unsupported (audit-excluded category)", () => {
    const p = parseHomeMission("جهز بيتي وأبي فرن بعد");
    expect(p.unsupported_mentions).toContain("فرن");
    expect((p.categories as Record<string, unknown>).oven).toBeUndefined();
  });
  it("a bare number is never an area («تحت 4000» stays money)", () => {
    const p = parseHomeMission("ابي مكيف تحت 4000");
    expect(p.spaces.length).toBe(0);
    expect(p.budget_total).toBe(4000);
  });
});

describe("buildLegs", () => {
  it("one AC leg per space; fridge/washer bands from household; excluded builds no leg", () => {
    const p = parseHomeMission(
      "انتقلت لشقة جديدة. أسرتنا 4 أشخاص. غرفة النوم 16 متر والصالة 28 متر. ما أبي تلفزيون.");
    const legs = buildLegs(p);
    const ac = legs.filter((l) => l.category === "air_conditioner");
    expect(ac.length).toBe(2);
    expect(ac[0].btu_required).toBe(18000); // 16m² × 700 → min 18000
    expect(ac[1].btu_required).toBe(24000); // 28m² × 700 = 19600 → next standard up
    expect(legs.find((l) => l.category === "refrigerator")?.liters_band).toEqual([350, 600]);
    expect(legs.find((l) => l.category === "washing_machine")?.kg_band).toEqual([7, 10]);
    expect(legs.find((l) => l.category === "tv")).toBeUndefined();
  });
  it("space with no area → needs room_area (honest input state, never a guess)", () => {
    const legs = buildLegs(parseHomeMission("ابي مكيف لغرفة النوم"));
    expect(legs[0].needs).toBe("room_area");
  });
});

describe("capacity bands (manufacturer-published — audit §12)", () => {
  it("household → bands; unknown household → null (never guessed)", () => {
    expect(litersBandFor(2)).toEqual([150, 400]);
    expect(litersBandFor(4)).toEqual([350, 600]);
    expect(litersBandFor(6)).toEqual([450, 900]);
    expect(litersBandFor(null)).toBeNull();
    expect(kgBandFor(4)).toEqual([7, 10]);
    expect(kgBandFor(null)).toBeNull();
  });
});

describe("tvSizeOf + accessory floor (the audit's Frame-bezel trap)", () => {
  it("reads structured size, then title text; the 299-SAR bezel is priced out by the floor", () => {
    expect(tvSizeOf(row({ attributes: { screen_size: 55 } }))).toBe(55);
    expect(tvSizeOf(row({ display_name_en: "Samsung 65 Inch OLED S90H" }))).toBe(65);
    // The bezel: title carries "65" (model code VG-SCFF65…), so SIZE alone cannot exclude
    // it — the price floor is what stops it (500-SAR TV minimum + 15% of median).
    const bezel = row({ canonical_id: "bezel", display_name_ar: "تلفزيون سامسونج VG-SCFF65WTBZN", lowest_price: 299 });
    const tvs = [
      bezel,
      row({ canonical_id: "a", display_name_en: "TCL 55 Inch QLED", lowest_price: 1800 }),
      row({ canonical_id: "b", display_name_en: "LG 65 Inch OLED", lowest_price: 6000 }),
      row({ canonical_id: "c", display_name_en: "Samsung 50 Inch UHD", lowest_price: 1500 }),
      row({ canonical_id: "d", display_name_en: "Hisense 58 Inch UHD", lowest_price: 2000 }),
    ];
    const leg = buildLegs(parseHomeMission("ابي تلفزيون"))[0];
    const elig = eligibleRows(leg, tvs, () => 24);
    expect(elig.rows.map((r) => r.canonical_id)).not.toContain("bezel");
    expect(elig.dropped.floor).toBe(1);
  });
});

describe("eligibleRows — freshness and bands are HARD (audit §52/§19-7)", () => {
  const leg = buildLegs(parseHomeMission("ابي مكيف لغرفة 16 متر"))[0]; // required 18000
  const acs = [
    row({ canonical_id: "fit", category: "air_conditioner", attributes: { capacity_btu: 18000 }, lowest_price: 1500 }),
    row({ canonical_id: "small", category: "air_conditioner", attributes: { capacity_btu: 12000 }, lowest_price: 1000 }),
    row({ canonical_id: "huge", category: "air_conditioner", attributes: { capacity_btu: 36000 }, lowest_price: 4000 }),
    row({ canonical_id: "stale", category: "air_conditioner", attributes: { capacity_btu: 18000 }, lowest_price: 1400 }),
  ];
  it("undersize, oversize beyond one step, and >168h evidence are all excluded", () => {
    const elig = eligibleRows(leg, acs, (id) => (id === "stale" ? 400 : 24));
    expect(elig.rows.map((r) => r.canonical_id)).toEqual(["fit"]);
    expect(elig.dropped.stale).toBe(1);
    expect(elig.dropped.band).toBe(2);
  });
  it("unknown age is not mission-eligible", () => {
    const elig = eligibleRows(leg, acs.slice(0, 1), () => null);
    expect(elig.rows.length).toBe(0);
  });
});

describe("comparisonClaim — the audit's honesty contract §19-1", () => {
  const base = { store_names: ["اكسترا", "المنيع"], data_age_hours: 24, tps_identity_key: "samsung|MODEL:QA55S90HA", model_number: null };
  it("model-keyed, fresh, ≥2 stores → compared", () => {
    expect(comparisonClaim(base)).toBe("compared");
  });
  it("degraded key (NO_SERIES + NO_TECH) never claims comparison — the LG 18000 merge case", () => {
    expect(comparisonClaim({ ...base, tps_identity_key: "lg|split|NO_SERIES|18000|NO_TECH|hot_cold" })).toBe("availability");
  });
  it("stale second evidence (>72h) → availability, not comparison", () => {
    expect(comparisonClaim({ ...base, data_age_hours: 100 })).toBe("availability");
  });
  it("one store → single", () => {
    expect(comparisonClaim({ ...base, store_names: ["اكسترا"] })).toBe("single");
  });
  it("a model_number can substitute for a MODEL: key", () => {
    expect(comparisonClaim({ ...base, tps_identity_key: "gree|window|NO_SERIES|18000|Inverter|cool_only", model_number: "GJC18AG-D6DRTG1A" })).toBe("compared");
  });
});

describe("allocateBudget — shared budget is one allocation problem (audit §15)", () => {
  const legs = buildLegs(parseHomeMission("جهز بيتي. أسرتنا 4. غرفة 16 متر. أهم شيء المكيفات وما يهمني التلفزيون."));
  const withCands = (budget: number | null) =>
    allocateBudget(
      legs.map((leg) => ({
        leg,
        candidates: [
          { canonical_id: `${leg.id}_best`, price: 2000, rank: 0 },
          { canonical_id: `${leg.id}_mid`, price: 1400, rank: 1 },
          { canonical_id: `${leg.id}_cheap`, price: 800, rank: 2 },
        ],
      })),
      budget,
    );
  it("infeasible budget → honest shortfall, no fabricated plan", () => {
    const r = withCands(1000); // 4 legs × 800 min = 3200
    expect(r.feasible).toBe(false);
    expect(r.min_total).toBe(3200);
    expect(r.shortfall).toBe(2200);
    expect(r.allocations.every((a) => a.picked === null)).toBe(true);
  });
  it("ample budget → every leg upgrades to the engine's top pick", () => {
    const r = withCands(10000);
    expect(r.feasible).toBe(true);
    expect(r.allocations.every((a) => a.picked?.endsWith("_best"))).toBe(true);
    expect(r.total_allocated).toBe(8000);
    expect(r.remaining).toBe(2000);
  });
  it("tight budget upgrades HIGH-emphasis legs first (AC before deprioritized TV)", () => {
    const r = withCands(4400); // min 3200, slack 1200 → one full upgrade (cheap→best = +1200)
    const byLeg = new Map(r.allocations.map((a) => [a.leg_id, a]));
    expect(byLeg.get("ac_space_1")?.picked).toBe("ac_space_1_best");
    expect(byLeg.get("tv")?.picked).toBe("tv_cheap");
    // the TV leg records what +SAR would buy — the trade-off sentence's figure
    expect(byLeg.get("tv")?.next_upgrade?.extra_cost).toBeGreaterThan(0);
  });
  it("no budget stated → engine top pick per leg, no gate applied", () => {
    const r = withCands(null);
    expect(r.feasible).toBe(true);
    expect(r.allocations.every((a) => a.picked?.endsWith("_best"))).toBe(true);
  });
});

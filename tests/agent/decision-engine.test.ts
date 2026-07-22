/**
 * Saudi Agent Benchmark v1 — Stage-1 Decision Agent (deterministic core).
 * Encodes the flagship AC shopping-task rubrics: KSA-hot BTU sizing, inverter-for-
 * electricity, TOTAL COST (unit+install+electricity), trust via corroboration,
 * neutrality (ranking not price-alone), and NO FABRICATION (undersize flagged).
 * Every rubric is an assertion — regressions fail loud in CI.
 */
import { requiredBtuForRoom, deriveAcDna, decideAc, decideTv, decideTablet, decideMobile, decide, type CanonicalRow, type ShoppingTask } from "../../src/lib/agent/decision-engine";

const tv = (o: { size: number; res: string; panel: string; hz: number; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `tv-${o.panel}-${o.hz}-${o.price}`, tps_identity_key: "k", display_name_ar: `تلفزيون ${o.panel}`, display_name_en: "TV",
  brand: "samsung", category: "tv", image_url: null, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, identity_confidence: 80,
  attributes: { screen_size: o.size, resolution: o.res, panel: o.panel, refresh_rate: o.hz },
});
const tab = (o: { line: string; storage: number; conn: string; size: number; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `tab-${o.line}-${o.storage}-${o.conn}`, tps_identity_key: "k", display_name_ar: `تابلت ${o.line}`, display_name_en: "Tablet",
  brand: "samsung", category: "tablet", image_url: null, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, identity_confidence: 80,
  attributes: { line: o.line, storage: o.storage, connectivity: o.conn, screen_size: o.size },
});

const ac = (over: Partial<CanonicalRow> & { btu: number; tech: string; cool?: string; price: number; stores: number }): CanonicalRow => ({
  canonical_id: over.canonical_id ?? `c-${over.btu}-${over.tech}-${over.price}`,
  tps_identity_key: "k", display_name_ar: over.display_name_ar ?? `مكيف ${over.btu}`, display_name_en: "AC",
  brand: over.brand ?? "gree", category: "air_conditioner", image_url: null,
  lowest_price: over.price, store_count: over.stores, has_comparison: over.stores >= 2, identity_confidence: 80,
  attributes: { capacity_btu: over.btu, technology: over.tech, cooling_mode: over.cool ?? "cool_only", ac_type: "split" },
});

describe("KSA-hot BTU sizing (never undersize)", () => {
  it("rounds UP to standard capacity for KSA climate", () => {
    expect(requiredBtuForRoom(30)).toBe(24000); // 30*700=21000 -> 24000
    expect(requiredBtuForRoom(15)).toBe(18000); // floor 18000
    expect(requiredBtuForRoom(45)).toBe(36000); // 45*700=31500 -> 36000
  });
});

describe("Product DNA (AC) — deterministic derivation", () => {
  it("derives inverter, room fit, energy class from attributes", () => {
    const dna = deriveAcDna(ac({ btu: 24000, tech: "Inverter", price: 2500, stores: 2 }));
    expect(dna.inverter).toBe(true);
    expect(dna.energy_efficiency).toBe("high");
    expect(dna.recommended_room_m2).toBe(Math.round(24000 / 700));
    expect(dna.installation_class).toBe("split_professional");
  });
});

describe("Flagship task: AC, 30m² Riyadh, low_electricity", () => {
  const task: ShoppingTask = { category: "air_conditioner", room_size_m2: 30, city: "Riyadh", priorities: ["quiet", "low_electricity"] };
  const rows = [
    ac({ btu: 24000, tech: "Inverter", price: 2600, stores: 2, canonical_id: "inv-fit" }),
    ac({ btu: 24000, tech: "Standard", price: 2200, stores: 2, canonical_id: "std-fit-cheap" }),
    ac({ btu: 18000, tech: "Inverter", price: 2000, stores: 1, canonical_id: "inv-undersize" }),
  ];

  it("inverter (fit) beats cheaper non-inverter when electricity is a priority (NOT price-alone)", () => {
    const recs = decideAc(task, rows);
    expect(recs[0].canonical_id).toBe("inv-fit");
    expect(recs.find((r) => r.canonical_id === "std-fit-cheap")!.suitability_score)
      .toBeLessThan(recs[0].suitability_score);
  });
  it("total cost includes installation + annual electricity (> sticker price)", () => {
    const r = decideAc(task, rows)[0];
    expect(r.total_cost_estimate).toBeGreaterThan(r.unit_price!);
    expect(r.cost_breakdown.installation).toBeGreaterThan(0);
    expect(r.cost_breakdown.annual_electricity).toBeGreaterThan(0);
  });
  it("NO FABRICATION: an undersized unit is flagged, not silently recommended", () => {
    const und = decideAc(task, rows).find((r) => r.canonical_id === "inv-undersize")!;
    expect(und.reasons_ar.some((x) => x.includes("أقل من المطلوب"))).toBe(true);
  });
  it("inverter unit surfaces an electricity-saving reason", () => {
    const r = decideAc(task, rows)[0];
    expect(r.reasons_ar.some((x) => x.includes("إنفرتر"))).toBe(true);
  });
  it("smart_pick is the top-ranked and marked once", () => {
    const recs = decideAc(task, rows);
    expect(recs[0].is_smart_pick).toBe(true);
    expect(recs.filter((r) => r.is_smart_pick).length).toBe(1);
  });
});

describe("TV decision — use-fit (deterministic, ranking-blind)", () => {
  it("gaming: high refresh (144Hz) outranks 60Hz at similar price", () => {
    const recs = decideTv({ category: "tv", priorities: ["gaming"] }, [
      tv({ size: 55, res: "4k", panel: "qled", hz: 60, price: 2000, stores: 2, id: "hz60" }),
      tv({ size: 55, res: "4k", panel: "qled", hz: 144, price: 2100, stores: 2, id: "hz144" }),
    ]);
    expect(recs[0].canonical_id).toBe("hz144");
    expect(recs[0].reasons_ar.some((r) => r.includes("144"))).toBe(true);
  });
  it("movies: OLED outranks LED (panel quality)", () => {
    const recs = decideTv({ category: "tv", priorities: ["movies"] }, [
      tv({ size: 55, res: "4k", panel: "led", hz: 60, price: 2000, stores: 2, id: "led" }),
      tv({ size: 55, res: "4k", panel: "oled", hz: 120, price: 2500, stores: 2, id: "oled" }),
    ]);
    expect(recs[0].canonical_id).toBe("oled");
  });
});

describe("Tablet decision — connectivity/storage fit (deterministic)", () => {
  it("cellular need: a 5G/LTE tablet outranks a Wi-Fi-only one", () => {
    const recs = decideTablet({ category: "tablet", connectivity_needed: "cellular" } as never, [
      tab({ line: "galaxy tab a11", storage: 128, conn: "wifi", size: 11, price: 900, stores: 2, id: "wifi" }),
      tab({ line: "galaxy tab a11", storage: 128, conn: "5g", size: 11, price: 1100, stores: 2, id: "cell" }),
    ]);
    expect(recs[0].canonical_id).toBe("cell");
  });
  it("storage_min: below-minimum is flagged, not silently chosen", () => {
    const recs = decideTablet({ category: "tablet", storage_min: 256 } as never, [
      tab({ line: "ipad air", storage: 128, conn: "wifi", size: 11, price: 2500, stores: 2, id: "s128" }),
    ]);
    expect(recs[0].reasons_ar.some((r) => r.includes("أقل من المطلوب"))).toBe(true);
  });
});

const mob = (o: { family: string; gen: string; variant: string; storage: string; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `m-${o.gen}-${o.variant}`, tps_identity_key: "k", display_name_ar: `${o.family} ${o.gen} ${o.variant}`, display_name_en: "phone",
  brand: "apple", category: "mobile", image_url: null, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, identity_confidence: 90,
  attributes: { family: o.family, generation: o.gen, variant: o.variant, storage: o.storage, ram_values: [] },
});

describe("Mobile decision — variant/generation/storage fit (deterministic)", () => {
  it("camera priority: Pro Max outranks Standard (variant tier)", () => {
    const recs = decideMobile({ category: "mobile", priorities: ["camera"] }, [
      mob({ family: "iPhone", gen: "16", variant: "Standard", storage: "128", price: 3200, stores: 2, id: "std" }),
      mob({ family: "iPhone", gen: "16", variant: "Pro Max", storage: "256", price: 5000, stores: 2, id: "promax" }),
    ]);
    expect(recs[0].canonical_id).toBe("promax");
  });
  it("latest priority: newer generation outranks older", () => {
    const recs = decideMobile({ category: "mobile", priorities: ["latest"] }, [
      mob({ family: "iPhone", gen: "15", variant: "Standard", storage: "128", price: 2800, stores: 2, id: "g15" }),
      mob({ family: "iPhone", gen: "17", variant: "Standard", storage: "128", price: 3000, stores: 2, id: "g17" }),
    ]);
    expect(recs[0].canonical_id).toBe("g17");
  });
  it("storage_min: below minimum is flagged", () => {
    const recs = decideMobile({ category: "mobile", storage_min: 256 } as never, [
      mob({ family: "iPhone", gen: "16", variant: "Standard", storage: "128", price: 3200, stores: 2 }),
    ]);
    expect(recs[0].reasons_ar.some((r) => r.includes("أقل من المطلوب"))).toBe(true);
  });
});

describe("Category dispatcher", () => {
  it("dispatches ac/tv/tablet/mobile as supported; unknown is neutral fallback (not supported)", () => {
    for (const c of ["air_conditioner", "tv", "tablet", "mobile"]) expect(decide({ category: c }, []).supported).toBe(true);
    expect(decide({ category: "microwave" }, []).supported).toBe(false);
  });
});

describe("Trust: corroboration contributes to suitability", () => {
  it("a 2-store unit outranks an identical 1-store unit", () => {
    const task: ShoppingTask = { category: "air_conditioner", room_size_m2: 30 };
    const recs = decideAc(task, [
      ac({ btu: 24000, tech: "Inverter", price: 2500, stores: 1, canonical_id: "single" }),
      ac({ btu: 24000, tech: "Inverter", price: 2500, stores: 2, canonical_id: "corrob" }),
    ]);
    expect(recs[0].canonical_id).toBe("corrob");
    expect(recs[0].comparison_available).toBe(true);
  });
});

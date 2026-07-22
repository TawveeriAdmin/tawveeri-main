/**
 * Saudi Agent Benchmark v1 — Stage-1 Decision Agent (deterministic core).
 * Encodes the flagship AC shopping-task rubrics: KSA-hot BTU sizing, inverter-for-
 * electricity, TOTAL COST (unit+install+electricity), trust via corroboration,
 * neutrality (ranking not price-alone), and NO FABRICATION (undersize flagged).
 * Every rubric is an assertion — regressions fail loud in CI.
 */
import { requiredBtuForRoom, deriveAcDna, decideAc, decideTv, decideTablet, decideMobile, decideLaptop, decideRefrigerator, decideWashingMachine, decide, type CanonicalRow, type ShoppingTask } from "../../src/lib/agent/decision-engine";

const fridge = (o: { type: string; liters: number; inverter: boolean; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `f-${o.type}-${o.liters}`, tps_identity_key: "k", display_name_ar: `ثلاجة ${o.type}`, display_name_en: "fridge",
  brand: "samsung", category: "refrigerator", image_url: null, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, identity_confidence: 75,
  attributes: { fridge_type: o.type, capacity_liters: o.liters, inverter: o.inverter },
});
const washer = (o: { type: string; kg: number; inverter: boolean; dryer: boolean; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `w-${o.type}-${o.kg}`, tps_identity_key: "k", display_name_ar: `غسالة ${o.type}`, display_name_en: "washer",
  brand: "lg", category: "washing_machine", image_url: null, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, identity_confidence: 75,
  attributes: { washer_type: o.type, capacity_kg: o.kg, inverter: o.inverter, has_dryer: o.dryer },
});

const lap = (o: { family: string; cpu: string; ram: number; storage: number; screen: number; gpu: string; price: number; stores: number; id?: string }): CanonicalRow => ({
  canonical_id: o.id ?? `l-${o.family}-${o.gpu}`, tps_identity_key: "k", display_name_ar: `لابتوب ${o.family}`, display_name_en: "laptop",
  brand: "hp", category: "laptop", image_url: null, lowest_price: o.price, store_count: o.stores, has_comparison: o.stores >= 2, identity_confidence: 75,
  attributes: { family: o.family, cpu: o.cpu, ram: o.ram, storage: o.storage, screen: o.screen, gpu: o.gpu },
});

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

describe("Laptop decision — use-fit (deterministic, single-store honest)", () => {
  it("gaming: discrete GPU outranks integrated", () => {
    const recs = decideLaptop({ category: "laptop", priorities: ["gaming"] }, [
      lap({ family: "pavilion", cpu: "i5-13", ram: 16, storage: 512, screen: 15.6, gpu: "igpu", price: 2800, stores: 1, id: "igpu" }),
      lap({ family: "victus", cpu: "i7-13", ram: 16, storage: 512, screen: 15.6, gpu: "rtx4060", price: 4500, stores: 1, id: "discrete" }),
    ]);
    expect(recs[0].canonical_id).toBe("discrete");
    expect(recs[0].comparison_available).toBe(false); // laptops are single-store — labelled honestly
  });
  it("portability: a 13\" laptop outranks a 17\" for portability", () => {
    const recs = decideLaptop({ category: "laptop", priorities: ["portability"] }, [
      lap({ family: "spectre", cpu: "ultra7", ram: 16, storage: 512, screen: 13.5, gpu: "igpu", price: 5000, stores: 1, id: "small" }),
      lap({ family: "omen", cpu: "i9", ram: 32, storage: 1024, screen: 17, gpu: "rtx4080", price: 8000, stores: 1, id: "big" }),
    ]);
    expect(recs[0].canonical_id).toBe("small");
  });
});

describe("Category dispatcher", () => {
  it("dispatches ac/tv/tablet/mobile/laptop as supported; unknown is neutral fallback", () => {
    for (const c of ["air_conditioner", "tv", "tablet", "mobile", "laptop"]) expect(decide({ category: c }, []).supported).toBe(true);
    expect(decide({ category: "microwave" }, []).supported).toBe(false);
  });
});

describe("Refrigerator decision — efficiency + capacity (deterministic, single-store honest)", () => {
  it("inverter is preferred when low_electricity is a priority (runs 24/7)", () => {
    const task = { category: "refrigerator", priorities: ["low_electricity"] } as ShoppingTask;
    const recs = decideRefrigerator(task, [
      fridge({ type: "single_door", liters: 200, inverter: false, price: 1200, stores: 1, id: "std" }),
      fridge({ type: "single_door", liters: 200, inverter: true, price: 1300, stores: 1, id: "inv" }),
    ]);
    expect(recs[0].canonical_id).toBe("inv");
    expect(recs[0].reasons_ar.join(" ")).toMatch(/إنفرتر/);
  });
  it("total cost includes estimated annual electricity (fridge runs 24/7)", () => {
    const recs = decideRefrigerator({ category: "refrigerator" } as ShoppingTask, [
      fridge({ type: "side_by_side", liters: 500, inverter: true, price: 3000, stores: 1 }),
    ]);
    expect(recs[0].cost_breakdown.annual_electricity).toBeGreaterThan(0);
    expect(recs[0].total_cost_estimate).toBeGreaterThan(recs[0].unit_price!);
  });
  it("single-store fridge is surfaced honestly (comparison unavailable)", () => {
    const recs = decideRefrigerator({ category: "refrigerator" } as ShoppingTask, [
      fridge({ type: "top_mount", liters: 350, inverter: false, price: 1800, stores: 1 }),
    ]);
    expect(recs[0].comparison_available).toBe(false);
    expect(recs[0].reasons_ar.join(" ")).toMatch(/متجر واحد/);
  });
});

describe("Washing machine decision — efficiency + dryer combo (deterministic)", () => {
  it("front-load + inverter is preferred for low_electricity/quiet", () => {
    const task = { category: "washing_machine", priorities: ["low_electricity", "quiet"] } as ShoppingTask;
    const recs = decideWashingMachine(task, [
      washer({ type: "top_load", kg: 10, inverter: false, dryer: false, price: 1400, stores: 1, id: "top" }),
      washer({ type: "front_load", kg: 10, inverter: true, dryer: false, price: 1600, stores: 1, id: "front" }),
    ]);
    expect(recs[0].canonical_id).toBe("front");
  });
  it("washer/dryer combo wins when the task text asks for drying", () => {
    const task = { category: "washing_machine", parsed_from_text: "غسالة مع نشافة" } as ShoppingTask & { parsed_from_text: string };
    const recs = decideWashingMachine(task, [
      washer({ type: "front_load", kg: 8, inverter: true, dryer: false, price: 1600, stores: 1, id: "wash" }),
      washer({ type: "front_load", kg: 8, inverter: true, dryer: true, price: 1900, stores: 1, id: "combo" }),
    ]);
    expect(recs[0].canonical_id).toBe("combo");
    expect(recs[0].reasons_ar.join(" ")).toMatch(/نشافة/);
  });
});

describe("Dispatcher supports appliance categories", () => {
  it("refrigerator + washing_machine are supported", () => {
    expect(decide({ category: "refrigerator" }, []).supported).toBe(true);
    expect(decide({ category: "washing_machine" }, []).supported).toBe(true);
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

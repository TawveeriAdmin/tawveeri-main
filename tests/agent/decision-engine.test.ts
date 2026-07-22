/**
 * Saudi Agent Benchmark v1 — Stage-1 Decision Agent (deterministic core).
 * Encodes the flagship AC shopping-task rubrics: KSA-hot BTU sizing, inverter-for-
 * electricity, TOTAL COST (unit+install+electricity), trust via corroboration,
 * neutrality (ranking not price-alone), and NO FABRICATION (undersize flagged).
 * Every rubric is an assertion — regressions fail loud in CI.
 */
import { requiredBtuForRoom, deriveAcDna, decideAc, type CanonicalRow, type ShoppingTask } from "../../src/lib/agent/decision-engine";

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

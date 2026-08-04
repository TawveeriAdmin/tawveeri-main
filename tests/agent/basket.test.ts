// Multi-unit (basket) honesty — deterministic acknowledgement of quantity + aggregate
// budget (Founder directive 2026-08-04). The engine prices ONE unit; the summary must
// state the per-unit ceiling and the UNKNOWNS, and never fabricate a basket.
import { buildBasketSummary } from "@/lib/agent/basket";

describe("buildBasketSummary", () => {
  it("null for single-unit or absent quantity", () => {
    expect(buildBasketSummary(undefined, 5000, "air_conditioner")).toBeNull();
    expect(buildBasketSummary(1, 5000, "air_conditioner")).toBeNull();
  });
  it("computes the per-unit ceiling from the total budget", () => {
    const b = buildBasketSummary(3, 5000, "air_conditioner")!;
    expect(b.quantity).toBe(3);
    expect(b.total_budget).toBe(5000);
    expect(b.per_unit_ceiling).toBe(1666);
    expect(b.note_ar).toContain("3");
    expect(b.note_ar).toContain("5,000");
    expect(b.note_ar).toContain("1,666");
    // The unknowns are stated, never guessed (unknown beats incorrect).
    expect(b.note_ar).toContain("التركيب");
    expect(b.note_ar).toContain("غير مؤكّد");
    // Individual options, never a verified basket.
    expect(b.note_ar).toContain("لجهاز واحد");
    expect(b.note_en).toContain("not a verified 3-unit basket");
  });
  it("acknowledges quantity even without a budget", () => {
    const b = buildBasketSummary(2, null, "refrigerator")!;
    expect(b.per_unit_ceiling).toBeNull();
    expect(b.total_budget).toBeNull();
    expect(b.note_ar).toContain("2");
  });
});

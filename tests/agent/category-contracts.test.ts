/**
 * CATEGORY DECISION CONTRACTS (Unified Intelligence mission, Section 9 — 2026-08-09).
 *
 * Pins the mission's own worked example — laptop weight is 'unknown', laptop portability is
 * 'inferred' (proxied by screen size) and MUST carry a proxyNote — and the general rule every
 * 'inferred'/'unknown' dimension must obey: it is never allowed to be treated as a plain,
 * verified fact.
 */
import { CATEGORY_CONTRACTS, getCategoryContract, isVerifiedDimension } from "@/lib/agent/category-contracts";

describe("category contracts — AC, phones, laptops (mission's Phase 3 priority order)", () => {
  it("all three priority categories have a contract", () => {
    expect(getCategoryContract("air_conditioner")).not.toBeNull();
    expect(getCategoryContract("mobile")).not.toBeNull();
    expect(getCategoryContract("laptop")).not.toBeNull();
  });

  it("an unknown category returns null, not a fabricated contract", () => {
    expect(getCategoryContract("space_heater")).toBeNull();
  });

  it("THE NAMED EXAMPLE: laptop weight is unknown, portability is inferred with a proxy note", () => {
    const laptop = getCategoryContract("laptop")!;
    const weight = laptop.decisionDimensions.find((d) => d.key === "weight");
    expect(weight?.status).toBe("unknown");
    const portability = laptop.decisionDimensions.find((d) => d.key === "portability");
    expect(portability?.status).toBe("inferred");
    expect(portability?.proxyNote).toBeTruthy();
    expect(portability?.proxyNote).toMatch(/screen size/);
  });

  it("every 'inferred' dimension across every contract carries a proxyNote — no silent gap", () => {
    for (const contract of Object.values(CATEGORY_CONTRACTS)) {
      for (const dim of contract.decisionDimensions) {
        if (dim.status === "inferred") expect(dim.proxyNote).toBeTruthy();
      }
    }
  });

  it("isVerifiedDimension is false for inferred/unknown, true only for verified", () => {
    expect(isVerifiedDimension("laptop", "ram")).toBe(true);
    expect(isVerifiedDimension("laptop", "portability")).toBe(false);
    expect(isVerifiedDimension("laptop", "weight")).toBe(false);
    expect(isVerifiedDimension("laptop", "nonexistent_field")).toBe(false);
  });

  it("AC's decision dimensions are backed by real extracted attributes (capacity_btu, inverter, cooling_mode)", () => {
    const ac = getCategoryContract("air_conditioner")!;
    for (const key of ["capacity_btu", "inverter", "cooling_mode"]) {
      expect(ac.decisionDimensions.find((d) => d.key === key)?.status).toBe("verified");
    }
  });

  it("mobile's camera/battery claims are honestly marked inferred (from variant tier, not measured specs)", () => {
    const mobile = getCategoryContract("mobile")!;
    expect(mobile.decisionDimensions.find((d) => d.key === "camera_quality")?.status).toBe("inferred");
    expect(mobile.decisionDimensions.find((d) => d.key === "battery_capacity")?.status).toBe("inferred");
  });
});

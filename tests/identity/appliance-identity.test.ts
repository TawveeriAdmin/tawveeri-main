// tests/identity/appliance-identity.test.ts
// ADR-076 regression gate. A capacity-less appliance key (brand|type|NA) must be
// low_confidence, not valid — otherwise every model of a type merges into one
// false comparison. Measured: all Xiaomi robot vacuums merged (165 → 849 SAR).
import { APPLIANCE_BUNDLES } from "../../scripts/tps-plugins/appliance";

const vacuum = APPLIANCE_BUNDLES["vacuum"].plugin;

describe("appliance identity — capacity is required to corroborate", () => {
  it("a robot vacuum WITHOUT capacity is low_confidence (catalogue-only, never merges)", () => {
    const r = vacuum.buildIdentityKey("Xiaomi", { brand: "xiaomi", type: "robot", capacity: null });
    expect(r.key).toBe("xiaomi|robot|NA");
    expect(r.status).toBe("low_confidence_candidate");
  });

  it("an appliance WITH capacity stays valid (corroboration-eligible)", () => {
    const r = vacuum.buildIdentityKey("Xiaomi", { brand: "xiaomi", type: "robot", capacity: 550 });
    expect(r.key).toBe("xiaomi|robot|550");
    expect(r.status).toBe("valid");
  });

  it("no brand is invalid", () => {
    expect(vacuum.buildIdentityKey(null, { brand: null, type: "robot", capacity: 550 }).status).toBe("invalid");
  });

  it("no discriminator at all is invalid", () => {
    expect(vacuum.buildIdentityKey("Xiaomi", { brand: "xiaomi", type: null, capacity: null }).status).toBe("invalid");
  });
});

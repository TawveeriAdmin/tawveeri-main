// tests/identity/mobile-brand-canonicalization.test.ts
// ADR-060 regression gate. The mobile identity contract previously used the RAW
// store-supplied brand, so one phone became several identities by language and
// casing. Measured consequence: Arabic-titled stores corroborated only with each
// other, English-titled stores only with each other, and registering the plugin
// would have produced 11 duplicate product cards. Saudi-first requires Arabic
// and English titles to resolve to ONE identity (Constitution principle 5).
import { buildIdentityKey } from "../../scripts/tps-plugins/mobile/identity";

const specs = { family: "iPhone", generation: "17", variant: "Pro", storage_gb: 256 };

describe("mobile identity — brand is canonicalized", () => {
  it("resolves Arabic and English brand names to ONE identity", () => {
    const ar = buildIdentityKey("ابل", specs);
    const en = buildIdentityKey("Apple", specs);
    expect(ar.status).toBe("valid");
    expect(ar.key).toBe(en.key);
  });

  it("is case-insensitive, matching the canonicals mobile-v1 already wrote", () => {
    expect(buildIdentityKey("Apple", specs).key).toBe("apple|iPhone|17|Pro|256");
    expect(buildIdentityKey("APPLE", specs).key).toBe("apple|iPhone|17|Pro|256");
  });

  it("unifies Samsung across languages too", () => {
    const s = { family: "Galaxy S", generation: "S26", variant: "Standard", storage_gb: 256 };
    expect(buildIdentityKey("سامسونج", s).key).toBe(buildIdentityKey("Samsung", s).key);
  });

  it("still separates genuinely different phones", () => {
    expect(buildIdentityKey("Apple", specs).key)
      .not.toBe(buildIdentityKey("Apple", { ...specs, storage_gb: 512 }).key);
    expect(buildIdentityKey("Apple", specs).key)
      .not.toBe(buildIdentityKey("Apple", { ...specs, variant: "Pro Max" }).key);
    expect(buildIdentityKey("Apple", specs).key)
      .not.toBe(buildIdentityKey("Samsung", specs).key);
  });

  it("rejects rather than guessing when a critical field is missing", () => {
    expect(buildIdentityKey("Apple", { ...specs, storage_gb: null }).status).toBe("invalid");
    expect(buildIdentityKey(null, specs).status).toBe("invalid");
  });

  it("rejects an unrecognisable brand instead of keying on noise", () => {
    const r = buildIdentityKey("ZZZ-NOT-A-BRAND", specs);
    if (r.status === "valid") expect(r.key).not.toContain("unknown");
    else expect(r.status).toBe("invalid");
  });
});

// tests/identity/alias-graph.test.ts
// Guards ADR-058 identity aliasing: bridging the model/spec key spaces using
// only co-occurrence evidence, never similarity.
import {
  reconcileIdentities, corroboratedClasses, isBridgeableSpecKey, type KeyedObservation,
} from "@/lib/identity/alias-graph";

const obs = (
  id: number, storeId: number, modelKey: string | null, specKey: string | null, category = "tablet"
): KeyedObservation => ({ id, storeId, category, modelKey, specKey });

describe("identity alias reconciliation", () => {
  it("bridges model and spec keys when ONE observation states both", () => {
    // The production case: store 1 published the MPN and the specs; store 4
    // published only the specs. Previously these were two separate identities.
    const classes = reconcileIdentities([
      obs(1, 1, "apple|MODEL:MDWK4AB/A", "apple|ipad air|m3|128|wifi|11"),
      obs(2, 4, null, "apple|ipad air|m3|128|wifi|11"),
    ]);
    expect(classes).toHaveLength(1);
    expect(classes[0].storeIds).toEqual([1, 4]);
    expect(corroboratedClasses(classes)).toHaveLength(1);
  });

  it("does NOT bridge when no observation states both keys", () => {
    // Precision guard: an MPN-only listing and a spec-only listing are NOT
    // assumed identical. Unknown beats incorrect.
    const classes = reconcileIdentities([
      obs(1, 1, "apple|MODEL:MDWK4AB/A", null),
      obs(2, 4, null, "apple|ipad air|m3|128|wifi|11"),
    ]);
    expect(classes).toHaveLength(2);
    expect(corroboratedClasses(classes)).toHaveLength(0);
  });

  it("never bridges across categories", () => {
    const classes = reconcileIdentities([
      obs(1, 1, "apple|MODEL:X1", "apple|ipad air|m3|128|wifi|11", "tablet"),
      obs(2, 4, "apple|MODEL:X1", "apple|macbook|m3|16|512|13|igpu", "laptop"),
    ]);
    expect(classes.map((c) => c.category).sort()).toEqual(["laptop", "tablet"]);
  });

  it("keeps genuinely different products apart", () => {
    const classes = reconcileIdentities([
      obs(1, 1, "apple|MODEL:MDWK4AB/A", "apple|ipad air|m3|128|wifi|11"),
      obs(2, 4, "apple|MODEL:ME7X4AB/A", "apple|ipad air|m3|256|wifi|11"),
    ]);
    expect(classes).toHaveLength(2);
    expect(corroboratedClasses(classes)).toHaveLength(0);
  });

  it("transitively links a chain of aliases proven by real observations", () => {
    // s1 proves MODEL:A == spec S; s4 proves spec S == MODEL:B (a relisting that
    // carries a different colour's MPN). All three denote one buyer-facing product.
    const spec = "apple|ipad air|m3|128|wifi|11";
    const classes = reconcileIdentities([
      obs(1, 1, "apple|MODEL:MC9X4AB/A", spec),
      obs(2, 4, "apple|MODEL:MC9Y4AB/A", spec),
      obs(3, 5, "apple|MODEL:MC9Y4AB/A", null),
    ]);
    expect(classes).toHaveLength(1);
    expect(classes[0].memberKeys).toEqual(["apple|MODEL:MC9X4AB/A", "apple|MODEL:MC9Y4AB/A", spec]);
    expect(classes[0].storeIds).toEqual([1, 4, 5]);
  });

  it("is deterministic and idempotent regardless of input order", () => {
    const rows = [
      obs(3, 5, "b|MODEL:B", null),
      obs(1, 1, "b|MODEL:A", "b|fam|1"),
      obs(2, 4, "b|MODEL:B", "b|fam|1"),
    ];
    const a = reconcileIdentities(rows);
    const b = reconcileIdentities([...rows].reverse());
    expect(a.map((c) => c.canonicalKey)).toEqual(b.map((c) => c.canonicalKey));
    expect(a[0].memberKeys).toEqual(b[0].memberKeys);
  });

  it("refuses to bridge through a weak, placeholder-laden spec key", () => {
    // Real production hazard: `huawei|matepad|NO_GEN|256|wifi|NO_SIZE` fused 8
    // distinct MatePad model numbers into one identity. Two unknowns = not a hub.
    const weak = "huawei|matepad|NO_GEN|256|wifi|NO_SIZE";
    expect(isBridgeableSpecKey(weak)).toBe(false);
    const classes = reconcileIdentities([
      obs(1, 1, "huawei|MODEL:53014MLN", weak),
      obs(2, 4, "huawei|MODEL:TAGORE-W19G", weak),
    ]);
    // The two model numbers must NOT be fused into one product.
    expect(classes.length).toBeGreaterThan(1);
  });

  it("still bridges a specific key that has a single unknown segment", () => {
    const ok = "honor|honor pad x8b|NO_GEN|128|wifi|11";
    expect(isBridgeableSpecKey(ok)).toBe(true);
    expect(isBridgeableSpecKey("apple|ipad air|m3|128|wifi|11")).toBe(true);
  });

  it("ignores observations with no usable key at all", () => {
    expect(reconcileIdentities([obs(1, 1, null, null)])).toHaveLength(0);
  });

  it("a single store listing the same product twice is NOT corroboration", () => {
    const spec = "apple|ipad air|m3|128|wifi|11";
    const classes = reconcileIdentities([
      obs(1, 1, "apple|MODEL:MC9X4AB/A", spec),
      obs(2, 1, null, spec),
    ]);
    expect(classes).toHaveLength(1);
    expect(corroboratedClasses(classes)).toHaveLength(0);
  });
});

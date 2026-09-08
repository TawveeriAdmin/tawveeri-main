// ADR-325 — AC Rescue Lab pilot ledger guard logic. Pins every safety property the
// mechanism must have BEFORE any real write is authorized: unauthorized-product
// rejection, pre-existing-link protection, double-write prevention, drift detection on
// both apply() and rollback(), and wrong-canonical rejection. Pure functions, no database.
import {
  PRODUCTION_ALLOWLIST,
  TEST_ALLOWLIST,
  findAllowlistEntry,
  evaluateProposal,
  evaluateApply,
  evaluateRollback,
} from "../../scripts/experiments/ac-rescue-lab/pilot/ledger-logic";

const TCL = PRODUCTION_ALLOWLIST[0];
const HAIER = PRODUCTION_ALLOWLIST[1];
const RANDOM_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_RANDOM_ID = "22222222-2222-2222-2222-222222222222";

describe("findAllowlistEntry", () => {
  it("finds the exact TCL and Haier entries", () => {
    expect(findAllowlistEntry(PRODUCTION_ALLOWLIST, TCL.amazonProductId, TCL.targetCanonicalId)).toEqual(TCL);
    expect(findAllowlistEntry(PRODUCTION_ALLOWLIST, HAIER.amazonProductId, HAIER.targetCanonicalId)).toEqual(HAIER);
  });
  it("returns null for any product not in the allowlist", () => {
    expect(findAllowlistEntry(PRODUCTION_ALLOWLIST, RANDOM_ID, TCL.targetCanonicalId)).toBeNull();
  });
  it("returns null when the product is allowlisted but paired with the wrong canonical", () => {
    expect(findAllowlistEntry(PRODUCTION_ALLOWLIST, TCL.amazonProductId, HAIER.targetCanonicalId)).toBeNull();
  });
});

describe("evaluateProposal — unauthorized-product rejection", () => {
  it("rejects a product/canonical pair not on the allowlist, before any state is even relevant", () => {
    const r = evaluateProposal(PRODUCTION_ALLOWLIST, RANDOM_ID, OTHER_RANDOM_ID, { id: RANDOM_ID, canonicalProductId: null }, false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/UNAUTHORIZED_PRODUCT/);
  });
  it("rejects an allowlisted product paired with the wrong (non-allowlisted) canonical", () => {
    const r = evaluateProposal(PRODUCTION_ALLOWLIST, TCL.amazonProductId, OTHER_RANDOM_ID, { id: TCL.amazonProductId, canonicalProductId: null }, false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/UNAUTHORIZED_PRODUCT/);
  });
});

describe("evaluateProposal — pre-existing-link protection", () => {
  it("refuses to propose when the product already has a canonical_product_id set", () => {
    const r = evaluateProposal(PRODUCTION_ALLOWLIST, TCL.amazonProductId, TCL.targetCanonicalId, { id: TCL.amazonProductId, canonicalProductId: "some-other-canonical" }, false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/PRE_EXISTING_LINK/);
  });
  it("allows proposal when the product is genuinely unlinked (NULL)", () => {
    const r = evaluateProposal(PRODUCTION_ALLOWLIST, TCL.amazonProductId, TCL.targetCanonicalId, { id: TCL.amazonProductId, canonicalProductId: null }, false);
    expect(r.allowed).toBe(true);
  });
});

describe("evaluateProposal — double-write prevention", () => {
  it("refuses to propose a second open ledger row for a product that already has one", () => {
    const r = evaluateProposal(PRODUCTION_ALLOWLIST, TCL.amazonProductId, TCL.targetCanonicalId, { id: TCL.amazonProductId, canonicalProductId: null }, true);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/DOUBLE_WRITE/);
  });
});

describe("evaluateProposal — product-not-found", () => {
  it("refuses when the storefront product row does not exist", () => {
    const r = evaluateProposal(PRODUCTION_ALLOWLIST, TCL.amazonProductId, TCL.targetCanonicalId, null, false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/PRODUCT_NOT_FOUND/);
  });
});

describe("evaluateApply", () => {
  const proposedRow = {
    status: "proposed",
    amazonProductId: TCL.amazonProductId,
    targetCanonicalId: TCL.targetCanonicalId,
    beforeState: { canonicalProductId: null },
  };
  const activeCanonical = { id: TCL.targetCanonicalId, tpsIdentityKey: "tcl|split|NO_SERIES|28200|Inverter|cool_only", isActive: true };

  it("allows apply when everything matches: proposed status, drift-free, canonical active", () => {
    const r = evaluateApply(PRODUCTION_ALLOWLIST, proposedRow, { id: TCL.amazonProductId, canonicalProductId: null }, activeCanonical);
    expect(r.allowed).toBe(true);
  });

  it("rejects unauthorized product/canonical pairs, independent of ledger row content", () => {
    const badRow = { ...proposedRow, amazonProductId: RANDOM_ID };
    const r = evaluateApply(PRODUCTION_ALLOWLIST, badRow, { id: RANDOM_ID, canonicalProductId: null }, activeCanonical);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/UNAUTHORIZED_PRODUCT/);
  });

  it("rejects when the ledger row is not in 'proposed' status (e.g. already active)", () => {
    const r = evaluateApply(PRODUCTION_ALLOWLIST, { ...proposedRow, status: "active" }, { id: TCL.amazonProductId, canonicalProductId: null }, activeCanonical);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/WRONG_STATUS/);
  });

  it("DRIFT: rejects when products.canonical_product_id changed since proposal (now non-null)", () => {
    const r = evaluateApply(PRODUCTION_ALLOWLIST, proposedRow, { id: TCL.amazonProductId, canonicalProductId: "someone-elses-link" }, activeCanonical);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/DRIFT/);
  });

  it("pre-existing-link protection also holds at apply time even if proposal-time state was clean", () => {
    // A row that was somehow proposed with a non-null before_state (shouldn't happen via
    // the CLI, but the guard must not trust that) is still refused.
    const rowWithBadBeforeState = { ...proposedRow, beforeState: { canonicalProductId: "already-linked" } };
    const r = evaluateApply(PRODUCTION_ALLOWLIST, rowWithBadBeforeState, { id: TCL.amazonProductId, canonicalProductId: "already-linked" }, activeCanonical);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/PRE_EXISTING_LINK/);
  });

  it("WRONG_CANONICAL: rejects when the target canonical no longer exists", () => {
    const r = evaluateApply(PRODUCTION_ALLOWLIST, proposedRow, { id: TCL.amazonProductId, canonicalProductId: null }, null);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/WRONG_CANONICAL/);
  });

  it("WRONG_CANONICAL: rejects when the target canonical is no longer active", () => {
    const r = evaluateApply(PRODUCTION_ALLOWLIST, proposedRow, { id: TCL.amazonProductId, canonicalProductId: null }, { ...activeCanonical, isActive: false });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/WRONG_CANONICAL/);
  });
});

describe("evaluateRollback", () => {
  const activeRow = { status: "active", amazonProductId: TCL.amazonProductId, targetCanonicalId: TCL.targetCanonicalId };

  it("allows rollback when the ledger row is active and the current state exactly matches what this pilot wrote", () => {
    const r = evaluateRollback(activeRow, { id: TCL.amazonProductId, canonicalProductId: TCL.targetCanonicalId });
    expect(r.allowed).toBe(true);
  });

  it("refuses rollback when the ledger row is not active (e.g. still just proposed)", () => {
    const r = evaluateRollback({ ...activeRow, status: "proposed" }, { id: TCL.amazonProductId, canonicalProductId: TCL.targetCanonicalId });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/WRONG_STATUS/);
  });

  it("refuses rollback when already rolled_back (idempotency / no double-rollback)", () => {
    const r = evaluateRollback({ ...activeRow, status: "rolled_back" }, { id: TCL.amazonProductId, canonicalProductId: null });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/WRONG_STATUS/);
  });

  it("DRIFT: refuses rollback when the current canonical_product_id no longer equals what this pilot wrote — protects a newer legitimate link from being wiped", () => {
    const r = evaluateRollback(activeRow, { id: TCL.amazonProductId, canonicalProductId: "a-different-newer-legitimate-link" });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/DRIFT/);
  });

  it("refuses rollback when the product no longer exists", () => {
    const r = evaluateRollback(activeRow, null);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/PRODUCT_NOT_FOUND/);
  });
});

describe("TEST_ALLOWLIST is disjoint from PRODUCTION_ALLOWLIST", () => {
  it("no product id or canonical id appears in both lists", () => {
    const prodIds = new Set(PRODUCTION_ALLOWLIST.flatMap((e) => [e.amazonProductId, e.targetCanonicalId]));
    for (const e of TEST_ALLOWLIST) {
      expect(prodIds.has(e.amazonProductId)).toBe(false);
      expect(prodIds.has(e.targetCanonicalId)).toBe(false);
    }
  });
  it("a real TCL/Haier product is rejected under the TEST_ALLOWLIST (fixtures never accidentally authorize a real product)", () => {
    const r = evaluateProposal(TEST_ALLOWLIST, TCL.amazonProductId, TCL.targetCanonicalId, { id: TCL.amazonProductId, canonicalProductId: null }, false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/UNAUTHORIZED_PRODUCT/);
  });
});

describe("PRODUCTION_ALLOWLIST is frozen to exactly the 2 ADR-324-approved links", () => {
  it("has exactly 2 entries", () => {
    expect(PRODUCTION_ALLOWLIST).toHaveLength(2);
  });
  it("both entries cite ADR-324 as their evidence reference", () => {
    for (const e of PRODUCTION_ALLOWLIST) expect(e.evidenceReference).toBe("ADR-324");
  });
});

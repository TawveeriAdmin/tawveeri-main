// AC Rescue Lab pilot ledger — pure guard logic. No I/O, no database access, fully
// unit-testable. The CLI (09-pilot-ledger-cli.ts) is a thin wrapper that reads real state,
// calls these functions, and only then decides whether to write. Keeping all decision
// logic here (not inline in the CLI) is what makes every guard independently testable
// without a database — see tests/tps-plugins/ac-rescue-pilot-ledger.test.ts.

export interface AllowlistEntry {
  amazonProductId: string;
  targetCanonicalId: string;
  evidenceReference: string;
  label: string;
}

// The ONLY two links this mechanism will ever propose or apply, per ADR-324's explicit
// founder approval. Any (product, canonical) pair not listed here is rejected before any
// database read or write is attempted — this is the "only explicitly founder-approved
// rescue links" requirement, enforced as code, not as convention.
export const PRODUCTION_ALLOWLIST: AllowlistEntry[] = [
  {
    amazonProductId: "49c34be2-6e13-4600-964f-140f9f4ea891",
    targetCanonicalId: "d47800b5-341c-43dc-88df-64d0df71dd9c",
    evidenceReference: "ADR-324",
    label: "TCL SaveIN NEO T4 Split AC 28200 BTU (TAC-30CSU/ZIM)",
  },
  {
    amazonProductId: "62e8e0b9-40b1-4879-b704-f877b25533de",
    targetCanonicalId: "ff8b35e4-afcd-43ba-95a6-a06f54c97f52",
    evidenceReference: "ADR-324",
    label: "Haier Ultra Inverter 24000 BTU (HSU-24LQ13/R32(T3DB-B))",
  },
];

// A single, obviously-synthetic fixture pair, used ONLY by integration tests to exercise
// the full DB-backed propose/apply/rollback cycle without ever touching a real product.
// Wired in only when the CLI is explicitly run with --fixtures test — never the default.
export const TEST_ALLOWLIST: AllowlistEntry[] = [
  {
    amazonProductId: "00000000-0000-0000-0000-0000000000aa",
    targetCanonicalId: "00000000-0000-0000-0000-0000000000bb",
    evidenceReference: "TEST-FIXTURE",
    label: "synthetic test fixture — no real product or canonical",
  },
];

export function findAllowlistEntry(
  allowlist: AllowlistEntry[],
  amazonProductId: string,
  targetCanonicalId: string
): AllowlistEntry | null {
  return (
    allowlist.find(
      (e) => e.amazonProductId === amazonProductId && e.targetCanonicalId === targetCanonicalId
    ) ?? null
  );
}

export interface ProductState {
  id: string;
  canonicalProductId: string | null;
}

export interface CanonicalState {
  id: string;
  tpsIdentityKey: string | null;
  isActive: boolean;
}

export interface GuardResult {
  allowed: boolean;
  reason: string;
}

/** Guard for propose(): may we create a new 'proposed' ledger row? */
export function evaluateProposal(
  allowlist: AllowlistEntry[],
  amazonProductId: string,
  targetCanonicalId: string,
  currentProduct: ProductState | null,
  hasExistingOpenLedgerRow: boolean
): GuardResult {
  const entry = findAllowlistEntry(allowlist, amazonProductId, targetCanonicalId);
  if (!entry) {
    return { allowed: false, reason: "UNAUTHORIZED_PRODUCT: (amazon_product_id, target_canonical_id) is not in the founder-approved allowlist" };
  }
  if (!currentProduct) {
    return { allowed: false, reason: "PRODUCT_NOT_FOUND: no storefront product row for this id" };
  }
  if (currentProduct.canonicalProductId !== null) {
    return { allowed: false, reason: "PRE_EXISTING_LINK: products.canonical_product_id is already set — refusing to propose over an existing link" };
  }
  if (hasExistingOpenLedgerRow) {
    return { allowed: false, reason: "DOUBLE_WRITE: an open (proposed or active) pilot ledger row already exists for this product" };
  }
  return { allowed: true, reason: "ok" };
}

export interface LedgerRowForApply {
  status: string;
  amazonProductId: string;
  targetCanonicalId: string;
  beforeState: { canonicalProductId: string | null };
}

/** Guard for apply(): may we write products.canonical_product_id for this ledger row? */
export function evaluateApply(
  allowlist: AllowlistEntry[],
  ledgerRow: LedgerRowForApply,
  currentProduct: ProductState | null,
  currentCanonical: CanonicalState | null
): GuardResult {
  const entry = findAllowlistEntry(allowlist, ledgerRow.amazonProductId, ledgerRow.targetCanonicalId);
  if (!entry) {
    return { allowed: false, reason: "UNAUTHORIZED_PRODUCT: not in the founder-approved allowlist" };
  }
  if (ledgerRow.status !== "proposed") {
    return { allowed: false, reason: `WRONG_STATUS: ledger row status is '${ledgerRow.status}', expected 'proposed'` };
  }
  if (!currentProduct) {
    return { allowed: false, reason: "PRODUCT_NOT_FOUND: no storefront product row for this id" };
  }
  if (currentProduct.canonicalProductId !== ledgerRow.beforeState.canonicalProductId) {
    return { allowed: false, reason: "DRIFT: products.canonical_product_id no longer matches the state captured at proposal time" };
  }
  if (currentProduct.canonicalProductId !== null) {
    return { allowed: false, reason: "PRE_EXISTING_LINK: refusing to overwrite a non-null canonical_product_id" };
  }
  if (!currentCanonical) {
    return { allowed: false, reason: "WRONG_CANONICAL: target canonical no longer exists" };
  }
  if (currentCanonical.id !== ledgerRow.targetCanonicalId) {
    return { allowed: false, reason: "WRONG_CANONICAL: resolved canonical id does not match the ledger row's target" };
  }
  if (!currentCanonical.isActive) {
    return { allowed: false, reason: "WRONG_CANONICAL: target canonical is not active" };
  }
  return { allowed: true, reason: "ok" };
}

export interface LedgerRowForRollback {
  status: string;
  amazonProductId: string;
  targetCanonicalId: string;
}

/** Guard for rollback(): may we reset products.canonical_product_id back to NULL? */
export function evaluateRollback(
  ledgerRow: LedgerRowForRollback,
  currentProduct: ProductState | null
): GuardResult {
  if (ledgerRow.status !== "active") {
    return { allowed: false, reason: `WRONG_STATUS: ledger row status is '${ledgerRow.status}', expected 'active'` };
  }
  if (!currentProduct) {
    return { allowed: false, reason: "PRODUCT_NOT_FOUND: no storefront product row for this id" };
  }
  if (currentProduct.canonicalProductId !== ledgerRow.targetCanonicalId) {
    return {
      allowed: false,
      reason: "DRIFT: products.canonical_product_id no longer equals what this pilot wrote — refusing to roll back a value this pilot did not write (unrelated drift, or a newer legitimate link)",
    };
  }
  return { allowed: true, reason: "ok" };
}

// scripts/tps-core/identity-flags.ts — Phase 3B (2026-10-03).
// Feature flag for the v2 identity rules (suffix-preserving generation capture, plus-sign
// variant, expansion-phrase storage guard, token-bounded category detectors, HD TV cues,
// brand ladder, verifier at corroboration). DEFAULT OFF: with the variable unset every
// plugin behaves byte-for-byte as before (proven by tests/tps-plugins/identity-v1-parity.test.ts).
//
//   TPS_IDENTITY_V2=1                 → all categories
//   TPS_IDENTITY_V2=mobile,tv         → listed categories only (category-by-category cutover)
//   TPS_IDENTITY_V2=shadow            → compute v2 beside v1 and record, never select (shadow job)
//
// Read at call time (not module load) so a worker process picks up a Railway variable change
// on its next job without a rebuild, and so tests can toggle it.
export function identityV2Enabled(category?: string): boolean {
  const raw = (process.env.TPS_IDENTITY_V2 || "").trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "off" || raw === "shadow") return false;
  if (raw === "1" || raw === "true" || raw === "all" || raw === "on") return true;
  if (!category) return false;
  return raw.split(",").map(s => s.trim()).includes(category.toLowerCase());
}

/**
 * READ-PATH gate flag (compare page verifier), separable from the key-writing plugins so the
 * reversible stage can ship first:
 *   TPS_IDENTITY_GATE=mobile,tv   → the compare page verifies offers of these categories
 *   TPS_IDENTITY_GATE=1           → all categories
 * The gate is also on wherever TPS_IDENTITY_V2 enables the category (a cut-over category is
 * always gated). Default OFF; read at call time.
 */
export function identityGateEnabled(category?: string): boolean {
  if (identityV2Enabled(category)) return true;
  const raw = (process.env.TPS_IDENTITY_GATE || "").trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "all" || raw === "on") return true;
  if (!category) return false;
  return raw.split(",").map(s => s.trim()).includes(category.toLowerCase());
}

export function identityV2Mode(): "off" | "shadow" | "on" | "partial" {
  const raw = (process.env.TPS_IDENTITY_V2 || "").trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "off") return "off";
  if (raw === "shadow") return "shadow";
  if (raw === "1" || raw === "true" || raw === "all" || raw === "on") return "on";
  return "partial";
}

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

/**
 * Isolated identity-gate runner scope (ADR-405). The runner is a narrow worker job that refreshes ONLY the
 * identity signals (and, when switched on, the projection rows) of the categories listed here — it exists so a
 * category wave does not depend on the hourly refresh chain, which stays fenced (WORKER_JOB_REFRESH_ENABLED=0).
 *
 *   TPS_IDENTITY_RUNNER_CATEGORIES=tv,vacuum
 *
 * This variable only decides which categories the SIGNALS job computes. It never turns a read path on: every
 * reader (projection builder, compare page) still consults `identityGateEnabled` / TPS_IDENTITY_GATE, so a
 * category can have fresh signals with nobody reading them (shadow). Unparseable names are dropped.
 */
export function identityRunnerScope(raw: string | undefined = process.env.TPS_IDENTITY_RUNNER_CATEGORIES): string[] {
  return (raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9_]+$/.test(s));
}

/** Signals job gate: a category whose read gate is on, or that the isolated runner covers. */
export function identitySignalsEnabled(category: string): boolean {
  return identityGateEnabled(category) || identityRunnerScope().includes(category.toLowerCase());
}

/** True when ANY read gate is configured (TPS_IDENTITY_GATE and/or TPS_IDENTITY_V2 names a category or "all"). Cheap pre-check so a reader with the flags unset does zero extra queries. */
export function identityAnyGateEnabled(): boolean {
  const off = (raw: string) => !raw || raw === "0" || raw === "false" || raw === "off" || raw === "shadow";
  const gate = (process.env.TPS_IDENTITY_GATE || "").trim().toLowerCase();
  const v2 = (process.env.TPS_IDENTITY_V2 || "").trim().toLowerCase();
  return !off(gate) || !off(v2);
}

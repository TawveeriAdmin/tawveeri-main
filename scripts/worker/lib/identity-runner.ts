// scripts/worker/lib/identity-runner.ts — ADR-405 isolated identity-gate runner (plan only).
//
// The runner is one worker job that spawns the EXISTING refresh orchestrator restricted to two of its own
// steps — `identity-gate` (verifier verdicts → tps_offer_identity_signals) and `projection` (scoped to the same
// categories) — so a category wave does not need the fenced hourly chain (WORKER_JOB_REFRESH_ENABLED stays 0).
// No logic lives here: this file only turns environment variables into the orchestrator's argument list, and
// refuses anything outside the approved scope.
//
//   WORKER_JOB_IDENTITY_GATE_ENABLED=1     kill switch for the job — default OFF, independent of WORKER_JOB_REFRESH_ENABLED
//   TPS_IDENTITY_RUNNER_CATEGORIES=tv,vacuum  scope (also read by the signals job)
//   TPS_IDENTITY_RUNNER_PROJECTION=1       also rebuild the scope's projection rows (otherwise signals only = shadow)
//   TPS_IDENTITY_GATE=tv,vacuum            the READ gate — separate; the runner never turns it on
//
// A category outside APPROVED_CATEGORIES is refused (not dropped silently): widening a wave is a reviewed code
// change, never a variable typo.

export const IDENTITY_RUNNER_APPROVED_CATEGORIES: readonly string[] = ["tv", "vacuum"];

export interface IdentityRunnerPlan {
  enabled: boolean;
  reason: string;
  categories: string[];
  projection: boolean;
  /** Arguments for scripts/tps-core/refresh-intelligence.ts. */
  args: string[];
}

export function planIdentityRunner(env: NodeJS.ProcessEnv): IdentityRunnerPlan {
  const off = (reason: string): IdentityRunnerPlan => ({ enabled: false, reason, categories: [], projection: false, args: [] });
  if (env.WORKER_JOB_IDENTITY_GATE_ENABLED !== "1") return off("WORKER_JOB_IDENTITY_GATE_ENABLED is not 1 (default off)");
  const requested = (env.TPS_IDENTITY_RUNNER_CATEGORIES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!requested.length) return off("TPS_IDENTITY_RUNNER_CATEGORIES is empty");
  const outside = requested.filter((c) => !IDENTITY_RUNNER_APPROVED_CATEGORIES.includes(c));
  if (outside.length) return off(`categories outside the approved scope [${IDENTITY_RUNNER_APPROVED_CATEGORIES.join(",")}]: ${outside.join(",")}`);
  const categories = [...new Set(requested)].sort();
  const projection = env.TPS_IDENTITY_RUNNER_PROJECTION === "1";
  return {
    enabled: true,
    reason: projection ? "signals + scoped projection" : "signals only (shadow — no projection write)",
    categories,
    projection,
    args: ["--only", projection ? "identity-gate,projection" : "identity-gate", `--scope=${categories.join(",")}`],
  };
}

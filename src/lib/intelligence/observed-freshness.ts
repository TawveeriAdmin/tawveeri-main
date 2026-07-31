// src/lib/intelligence/observed-freshness.ts
//
// THE FRESHNESS RULE — one definition, used by every trust surface.
// Constitution Principle 7 (Every Price Has Provenance).
//
// ── THE PROBLEM THIS EXISTS TO FIX ────────────────────────────────────────────────────
// `price_history.observed_at` was written with the PROCESSING time, not the observation
// time. Measured on production 2026-07-31 across 6,649 rows whose provenance resolves:
// the stamp runs on average 177 hours (7.4 days) LATER than the observation, max 48.1 days.
// So the number the customer reads — «رصدناه قبل X يومًا» — has been claiming offers are
// FRESHER than they are. Per retailer the median age moved 6.6 → 30.1 days (Almanea) and
// 7.1 → 24.5 days (Jarir) once measured honestly.
//
// `scripts/tps-core/progressive-engine.ts` now records the true time for rows written from
// 2026-07-31 onward. This module corrects the DISPLAY for rows written before that, without
// touching history.
//
// ── THE RULE ──────────────────────────────────────────────────────────────────────────
//   displayed_observed_at = the OLDEST (earliest) timestamp among the verified provenance
//                           signals available for that offer.
//
// Expressed as `least(provenance_time, stamped_time)`, which is exactly right because a
// scrape always precedes its own processing (`scraped_at <= observed_at` by construction):
//
//   • provenance resolves  → `scraped_at` wins, because it IS the observation.
//   • provenance missing   → the stamped value stands. We do NOT estimate, extrapolate, or
//                            subtract an average lag. An unknown stays unknown.
//   • either value absent  → the other is used; both absent → null, and the caller renders
//                            NO line at all (see REDESIGN_BRIEF §5.1: no data, no line).
//
// Taking the EARLIEST is the conservative direction: it can only ever claim LESS freshness
// than we previously did, never more. This function cannot make an offer look newer.
//
// ── WHAT THIS IS NOT ──────────────────────────────────────────────────────────────────
// Presentation only. It never writes. `price_history` stays append-only and untouched, the
// stored `observed_at` is unchanged, and provenance is not mutated. The projection is
// deliberately NOT routed through this — its `last_observed_at` continues to derive from the
// stored column, so projection output is unaffected by this change.

/** A verified provenance signal for one offer. All fields optional; absent ≠ zero. */
export interface FreshnessInputs {
  /** `price_history.observed_at` — historically the PROCESSING time, corrected at source 2026-07-31. */
  stampedAt?: string | null;
  /** `raw_observations.scraped_at` reached via the normalized observation — the true observation time. */
  provenanceAt?: string | null;
}

/**
 * The single freshness authority. Returns the ISO timestamp a customer should be shown, or
 * null when nothing verifiable exists — in which case the caller must render no freshness
 * line rather than guessing.
 */
export function displayedObservedAt({ stampedAt, provenanceAt }: FreshnessInputs): string | null {
  const candidates = [stampedAt, provenanceAt]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((v) => ({ iso: v, t: Date.parse(v) }))
    .filter((v) => Number.isFinite(v.t));
  if (!candidates.length) return null;
  // Earliest = most conservative = the least freshness we can defend.
  return candidates.reduce((a, b) => (b.t < a.t ? b : a)).iso;
}

/** Whole days since the displayed observation, or null when there is nothing to show. */
export function observedAgeDays(inputs: FreshnessInputs, now = Date.now()): number | null {
  const iso = displayedObservedAt(inputs);
  if (!iso) return null;
  return Math.floor((now - Date.parse(iso)) / 86_400_000);
}

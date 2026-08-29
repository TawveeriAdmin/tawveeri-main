// Formal KPI definitions (Radar 2.0 Phase 1, founder decision 2026-08-29,
// architecture doc §F). Pure functions over demand_radar_outcomes rows —
// deliberately deterministic and DB-free so they're testable with a fixture
// and reusable by whatever dashboard/query later reads the real table.
//
// PRINCIPLE (founder-set): expiry is never an implicit rejection. Founder
// Acceptance Precision is computed ONLY over opportunities a founder actually
// judged (accepted or rejected) — 'expired_no_review' is excluded from both
// the numerator and the denominator, and reported separately.

import type { FounderOutcome, Tier } from './types';

export interface PrecisionInput {
  tier: Tier;
  founderOutcome: FounderOutcome | null;
}

export interface PrecisionResult {
  /** null = insufficient data (zero reviewed rows) — never a fabricated 0%/100%. */
  precision: number | null;
  accepted: number;
  rejected: number;
  expiredNoReview: number;
  reviewed: number; // accepted + rejected
  total: number;
}

function scope(rows: PrecisionInput[], tier?: Tier): PrecisionInput[] {
  return tier ? rows.filter((r) => r.tier === tier) : rows;
}

/** Founder Acceptance Precision = accepted / (accepted ∪ rejected).
 *  expired_no_review and null (no verdict yet) are excluded entirely. */
export function founderAcceptancePrecision(rows: PrecisionInput[], tier?: Tier): PrecisionResult {
  const s = scope(rows, tier);
  const accepted = s.filter((r) => r.founderOutcome === 'accepted').length;
  const rejected = s.filter((r) => r.founderOutcome === 'rejected').length;
  const expiredNoReview = s.filter((r) => r.founderOutcome === 'expired_no_review').length;
  const reviewed = accepted + rejected;
  return {
    precision: reviewed > 0 ? accepted / reviewed : null,
    accepted, rejected, expiredNoReview, reviewed, total: s.length,
  };
}

/** What fraction of opportunities ever got a founder verdict at all
 *  (accepted or rejected) — a separate diagnostic, never folded into precision. */
export function reviewCoverageRate(rows: PrecisionInput[], tier?: Tier): number | null {
  const s = scope(rows, tier);
  if (s.length === 0) return null;
  const reviewed = s.filter((r) => r.founderOutcome === 'accepted' || r.founderOutcome === 'rejected').length;
  return reviewed / s.length;
}

/** What fraction expired unreviewed — a separate diagnostic (review-speed
 *  signal), never a precision penalty. */
export function expiryRate(rows: PrecisionInput[], tier?: Tier): number | null {
  const s = scope(rows, tier);
  if (s.length === 0) return null;
  const expired = s.filter((r) => r.founderOutcome === 'expired_no_review').length;
  return expired / s.length;
}

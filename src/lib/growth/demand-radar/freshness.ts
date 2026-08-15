// Real-time freshness gate (ADR-248 addendum, founder correction 2026-08-15).
// A founder HIGH email reached the inbox saying "ظهر قبل 2408 دقيقة" — a
// 40-hour-old backfill post is historical data, never an urgent alert.
//
// POLICY (founder-set):
//   age ≤ 30 min          → alert-eligible
//   30 < age ≤ 60 min     → alert-eligible ONLY with strong corroboration
//   age > 60 min          → dashboard/historical only, NEVER a real-time email
//   age unknown           → NEVER a real-time email (conservative)
// Age is computed from source_posted_at (when the consumer actually spoke),
// never from when Tawveeri happened to discover the post.

export type Freshness = 'fresh' | 'window' | 'stale' | 'unknown';

export const ALERT_FRESH_MINUTES = 30;
export const ALERT_WINDOW_MINUTES = 60;

export function assessFreshness(sourcePostedAt: string | null, now = Date.now()): Freshness {
  if (!sourcePostedAt) return 'unknown';
  const ageMs = now - new Date(sourcePostedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'unknown';
  const ageMin = ageMs / 60000;
  if (ageMin <= ALERT_FRESH_MINUTES) return 'fresh';
  if (ageMin <= ALERT_WINDOW_MINUTES) return 'window';
  return 'stale';
}

/** Purchase-opportunity alert gate: fresh always passes; the 30-60m window
 *  needs strong corroboration (confirmed KSA or an explicit budget). */
export function opportunityAlertEligible(args: {
  sourcePostedAt: string | null;
  ksaRelevance: string;
  budgetSar: number | null;
  now?: number;
}): { eligible: boolean; freshness: Freshness } {
  const freshness = assessFreshness(args.sourcePostedAt, args.now);
  if (freshness === 'fresh') return { eligible: true, freshness };
  if (freshness === 'window') {
    return {
      eligible: args.ksaRelevance === 'confirmed' || args.budgetSar !== null,
      freshness,
    };
  }
  return { eligible: false, freshness }; // stale + unknown: dashboard only
}

/** Brand-mention alert gate: complaints/needs_reply alert only while the
 *  conversation is still live (≤60 min); anything older is dashboard/digest. */
export function mentionAlertEligible(sourcePostedAt: string | null, now = Date.now()): boolean {
  const f = assessFreshness(sourcePostedAt, now);
  return f === 'fresh' || f === 'window';
}

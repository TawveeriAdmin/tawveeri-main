// src/lib/compare/offer-eligibility.ts — ADR-388.
// ONE definition of "may this offer take part in a current price comparison", shared by
// every surface that shows a count, a lowest/highest price or a spread:
//   • /compare/[key] (get-comparison.ts → partitionOffersByEligibility / deriveComparisonSummary)
//   • /compare (the multi-product tool, compare/page.tsx)
// Live defect this closes (2026-09-26, founder + independent verification): ArtCool showed
// «5 متاجر متاحة» and a spread of 720 on /compare while /compare/[key] showed 3 eligible
// stores and a spread of 400 — the multi-product page counted every offer row and computed
// its spread over stale offers (a 12-day-old Amazon 2,949 and a 36-day-old Noon 3,369).
//
// Rule (unchanged from ADR-386/387, now in one place): an offer is ELIGIBLE when it has a
// positive price, is not out of stock at its last observation, and that observation is
// within PICK_FRESHNESS_MAX_HOURS. Everything else is excluded WITH A REASON — never
// silently dropped, never counted as a current competitor.
import { isFreshObservation } from '@/lib/intelligence/evidence-engine';

export type ExclusionReason = 'no_price' | 'out_of_stock' | 'stale' | 'unknown_age';

export interface EligibilityFacts {
  price: number | null | undefined;
  availability: string | null | undefined;
  observed_at: string | null | undefined;
}

export interface EligibilityOptions {
  /**
   * Legacy storefront rows can carry no observation timestamp at all. The multi-product
   * page keeps its long-standing backward-compatible behaviour ONLY when a product has no
   * freshness data anywhere (then availability alone decides); the moment any offer of that
   * product carries a timestamp, an offer without one is excluded as `unknown_age` — unknown
   * beats incorrect, and a dated offer must never be out-competed by an undated one.
   */
  unknownAgeIsEligible?: boolean;
}

/** Classifies one offer: `null` = eligible, otherwise the single reason it is excluded. */
export function exclusionReasonFor(
  f: EligibilityFacts,
  nowMs: number = Date.now(),
  opts: EligibilityOptions = {},
): ExclusionReason | null {
  if (typeof f.price !== 'number' || !(f.price > 0)) return 'no_price';
  if (f.availability === 'out_of_stock') return 'out_of_stock';
  if (!f.observed_at) return opts.unknownAgeIsEligible ? null : 'unknown_age';
  return isFreshObservation(f.observed_at, nowMs) ? null : 'stale';
}

export interface Partition<T> {
  eligible: T[];
  excluded: Array<{ item: T; reason: ExclusionReason }>;
}

/** Order-preserving split of any offer shape into eligible / excluded-with-reason. Pure. */
export function partitionEligible<T>(
  items: readonly T[],
  read: (item: T) => EligibilityFacts,
  nowMs: number = Date.now(),
  opts: EligibilityOptions = {},
): Partition<T> {
  const out: Partition<T> = { eligible: [], excluded: [] };
  for (const item of items) {
    const reason = exclusionReasonFor(read(item), nowMs, opts);
    if (reason) out.excluded.push({ item, reason });
    else out.eligible.push(item);
  }
  return out;
}

/**
 * lowest / highest / spread over the ELIGIBLE prices only. `spread` is
 * highest − lowest, null when fewer than two eligible prices exist (a single offer has no
 * spread — never 0 dressed up as "same price").
 */
export function summarizeEligiblePrices(prices: readonly number[]): {
  lowest: number | null;
  highest: number | null;
  spread: number | null;
} {
  const valid = prices.filter((p) => typeof p === 'number' && p > 0);
  if (!valid.length) return { lowest: null, highest: null, spread: null };
  const lowest = Math.min(...valid);
  const highest = Math.max(...valid);
  return {
    lowest,
    highest,
    spread: valid.length >= 2 ? Math.round((highest - lowest) * 100) / 100 : null,
  };
}

/** Distinct retailers among the given offers — a store must never be counted twice (ADR-132). */
export function distinctStoreCount<T>(items: readonly T[], storeKey: (item: T) => string | null | undefined): number {
  const keys = new Set<string>();
  for (const item of items) {
    const k = storeKey(item);
    if (k) keys.add(k.trim().toLowerCase());
  }
  return keys.size;
}

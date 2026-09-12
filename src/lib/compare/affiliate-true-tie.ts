// src/lib/compare/affiliate-true-tie.ts
//
// AFFILIATE_TRUE_TIE_POLICY (Founder decision, 2026-09-07 — see ADR-304).
//
// PRODUCT TRUTH -> SHOPPER VALUE -> DATA QUALITY -> TRUE TIE -> COMMERCIAL/AFFILIATE TIEBREAK.
//
// Governs ONLY the display ORDER of offers for a single, already-identity-resolved
// canonical product (get-comparison.ts's compare-page offer list) — never which product
// surfaces in search/recommendations, never the price shown as "cheapest" for any
// non-tied offer, never store_count, never anything the revenue-neutrality-protected
// ranking files (tps/search, tps/recommendations, agent/decide, decision-engine.ts —
// see tests/agent/revenue-neutrality.test.ts) decide. This module is never imported by
// any of those four files.
//
// An affiliate merchant (Amazon/Noon today — read from the provider registry, NEVER
// hardcoded, so a future affiliate merchant needs no code change here) may lead a
// TRUE_TIE group. It can never outrank a materially better offer: the price-ascending
// order this module receives is untouched outside the leading tied group, and no offer's
// price/availability/condition/freshness is ever altered by this module — only positions
// within a proven-equivalent group are exchanged.
//
// UNKNOWN != EQUAL (the founder's own explicit principle): any dimension Tawveeri cannot
// prove equal blocks the tie rather than assuming it. This intentionally makes TRUE_TIE
// fire less often than the founder's own literal 5-store example might suggest — most
// live listings carry no explicit condition marker at all, which classifyCondition()
// (condition.ts, 2026-09-06 safety-proof retraction) correctly reads as UNKNOWN, not NEW.
// That is a deliberate, disclosed cost of safety, not an oversight.
//
// VARIANT SAFETY (mission Case D — wrong capacity/model/storage): NOT re-checked here,
// deliberately. Every candidate this module ever receives (from get-comparison.ts) already
// shares ONE canonical_product_id — i.e. Tawveeri's own TPS identity engine has already
// proven them the same commercial variant before this module runs at all. Re-deriving
// that decision here would violate CLAUDE.md's own rule ("deterministic engines decide...
// never re-derive them") and this module has no variant signal to check even if it tried
// (TrueTieCandidate carries no storage/model field). Case D's real protection is upstream,
// structural, and unconditional — not a redundant in-module re-check.
import { classifyCondition } from '@/lib/campaigns/condition';
import { getProvider } from '@/lib/providers/registry';

export interface TrueTieCandidate {
  store_slug: string;
  price: number;
  availability: string | null;
  /** Already computed by the caller against the single shared STALE_CAVEAT_HOURS
   *  authority (evidence-engine.ts) — never a second freshness threshold here. */
  stale: boolean;
  product_url: string | null;
  raw_name: string | null;
}

export type TrueTieBlockReason =
  | 'PRICE_NOT_EQUAL'
  | 'AVAILABILITY_NOT_CONFIRMED'
  | 'FRESHNESS_NOT_EQUIVALENT'
  | 'CONDITION_UNKNOWN'
  | 'CONDITION_MISMATCH'
  | 'INVALID_DESTINATION_LINK'
  | 'TRUE_TIE';

export interface TrueTieResult {
  trueTie: boolean;
  reason: TrueTieBlockReason;
}

// Same "in stock or limited stock counts as available" convention already established by
// shadow-commerce.ts's getMerchantOfferEvidenceForCanonical() — one authority, not a second
// independently-drifting definition of "available."
function isAvailable(availability: string | null): boolean {
  return availability === 'in_stock' || availability === 'limited_stock';
}

/** The ONE authority for "is this merchant affiliate-monetized" — the provider registry's
 *  own `affiliate` field (src/lib/providers/registry.ts), never a hardcoded 'amazon'/'noon'
 *  string list. A merchant with a null `affiliate` config (every non-affiliate retailer
 *  today) is never eligible to lead a true-tie group. */
export function isAffiliateMerchant(storeSlug: string): boolean {
  return getProvider(storeSlug)?.affiliate != null;
}

/** Deterministic secondary order among affiliate merchants who are ALSO true-tied with
 *  each other (mission §3: "use the existing commercial economics/policy if safe and
 *  deterministic, or design the smallest explicit rule"). Real per-conversion commission
 *  is not on file for any product today (ADR-294: NETWORK_REPORTED is UNKNOWN platform-
 *  wide) — reusing commercial-tiebreak.ts's commission-amount comparison here would always
 *  be a no-op, so the smallest safe, explicit, already-established rule is used instead.
 *
 *  EXTENDED 2026-09-12 (Founder-approved, Samsung split-brain mission §16): Amazon > Samsung
 *  Saudi > Noon, explicitly — not the provider registry's raw storeId order, which would put
 *  Samsung (storeId 6) AFTER Noon (storeId 3) and not match the approved sequence. An
 *  explicit priority list, not a storeId sort, because the desired order and storeId
 *  assignment order are two independent things that happened to coincide for Amazon/Noon
 *  only. Any OTHER affiliate merchant (none exist today) falls back to the original
 *  storeId-ascending rule, so this never needs touching again just to onboard one. */
const EXPLICIT_TIE_ORDER: Record<string, number> = { amazon: 0, samsung_ksa: 1, noon: 2 };
function affiliateOrderKey(storeSlug: string): number {
  const explicit = EXPLICIT_TIE_ORDER[storeSlug];
  if (explicit !== undefined) return explicit;
  // Fallback keeps ranking after every explicitly-ordered merchant, then by storeId —
  // preserves prior behavior for any future affiliate merchant not listed above.
  return 1000 + (getProvider(storeSlug)?.storeId ?? Number.MAX_SAFE_INTEGER);
}

/**
 * Strict, deterministic TRUE_TIE test between the current price-leading offer and a
 * same-priced candidate. Every shopper-relevant dimension the mission asked to check is
 * inspected; the first dimension Tawveeri cannot prove equal blocks the tie.
 */
export function isTrueTie(leader: TrueTieCandidate, candidate: TrueTieCandidate): TrueTieResult {
  if (leader.price !== candidate.price) return { trueTie: false, reason: 'PRICE_NOT_EQUAL' };

  if (!isAvailable(leader.availability) || !isAvailable(candidate.availability)) {
    return { trueTie: false, reason: 'AVAILABILITY_NOT_CONFIRMED' };
  }

  // Freshness: a stale offer tied on price with a fresh one is NOT a true tie — freshness
  // is a real shopper-relevant advantage (mission Case F), not a cosmetic difference.
  if (leader.stale !== candidate.stale) return { trueTie: false, reason: 'FRESHNESS_NOT_EQUIVALENT' };

  // Condition: UNKNOWN != EQUAL — but this means SILENCE-VS-DISCLOSURE is never treated as
  // equal, not that SILENCE-VS-SILENCE is automatically disqualified too. Reused unchanged
  // from condition.ts (never re-derived): the vast majority of ordinary new-in-box listings
  // carry no explicit marker at all (classifyCondition() deliberately never detects the word
  // "new" — "too many false positives", condition.ts's own header) and, absent ANY signal on
  // either side, this is exactly the SAME "same model, comparable" baseline the rest of the
  // compare page already relies on (get-comparison.ts's own canonical-identity grouping, and
  // the FAQ's own "we've verified it's the same model" claim) — being stricter here than the
  // page's own existing comparison baseline would make TRUE_TIE effectively unreachable for
  // the founder's own real-world example. The real risk this gate exists to catch is
  // ASYMMETRIC silence: one side discloses something (renewed/refurbished/used) the other is
  // silent about — that is never assumed equal.
  const leaderCondition = classifyCondition(leader.raw_name);
  const candidateCondition = classifyCondition(candidate.raw_name);
  const bothUndisclosed = leaderCondition === 'UNKNOWN' && candidateCondition === 'UNKNOWN';
  if (!bothUndisclosed) {
    if (leaderCondition === 'UNKNOWN' || candidateCondition === 'UNKNOWN') {
      return { trueTie: false, reason: 'CONDITION_UNKNOWN' };
    }
    if (leaderCondition !== candidateCondition) return { trueTie: false, reason: 'CONDITION_MISMATCH' };
  }

  if (!leader.product_url || !candidate.product_url) {
    return { trueTie: false, reason: 'INVALID_DESTINATION_LINK' };
  }

  // No known-quality-incident signal and no shipping/payment differential are tracked
  // anywhere in this data model (get-comparison.ts carries neither field) — there is
  // nothing to check, so nothing is silently assumed equal here that Tawveeri could not
  // see. A disclosed absence of data, not a suppressed unknown. See ADR-304.

  return { trueTie: true, reason: 'TRUE_TIE' };
}

/**
 * Reorders an ALREADY price-ascending-sorted offer list so that, ONLY within the group of
 * offers genuinely tied (isTrueTie) with the price leader, an affiliate merchant moves to
 * the front. Never touches order outside that leading group, never changes any offer's
 * price/fields, never drops or adds an offer. A same-priced offer that fails the true-tie
 * test with the leader keeps its original price-sorted position — it is not penalized,
 * only left exactly where price alone already put it.
 */
export function applyAffiliateTrueTieOrder<T extends TrueTieCandidate>(priceSorted: readonly T[]): T[] {
  if (priceSorted.length < 2) return [...priceSorted];
  const leader = priceSorted[0];

  const tieIndices: number[] = [0]; // the leader is trivially its own group member
  for (let i = 1; i < priceSorted.length; i++) {
    if (priceSorted[i].price !== leader.price) break; // price-sorted input: once price diverges, no later offer can tie
    if (isTrueTie(leader, priceSorted[i]).trueTie) tieIndices.push(i);
  }
  if (tieIndices.length < 2) return [...priceSorted]; // no PROVEN tie beyond the leader itself — nothing to reorder

  const group = tieIndices.map((i) => priceSorted[i]);
  const affiliateMembers = group
    .filter((o) => isAffiliateMerchant(o.store_slug))
    .sort((a, b) => affiliateOrderKey(a.store_slug) - affiliateOrderKey(b.store_slug));
  if (affiliateMembers.length === 0) return [...priceSorted]; // nothing commercial to prefer — leave the tie exactly as price-sort produced it
  const nonAffiliateMembers = group.filter((o) => !isAffiliateMerchant(o.store_slug));

  const reordered = [...affiliateMembers, ...nonAffiliateMembers];
  const result = [...priceSorted];
  tieIndices.forEach((origIdx, k) => { result[origIdx] = reordered[k]; });
  return result;
}

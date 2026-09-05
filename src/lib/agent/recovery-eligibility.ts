// src/lib/agent/recovery-eligibility.ts — Truth Hardening Final Closure mission (2026-09-05),
// ADR-292. Pure, deterministic gate for whether a CATALOG_MISSING zero-result should create a
// durable async recovery request (never a live/synchronous provider call from the customer
// path — see product-recovery cron route for the actual worker). Part 4's eligibility contract:
// real (non-test) shopper intent, a recognized category, and an explicit brand+model — the
// highest-confidence, lowest-false-positive-risk initial shape. A bare category browse or a
// vague preference-only query never creates a job (Part 4: "fuzzy category-only searches
// should not necessarily trigger expensive recovery").
import { normalizeArabic } from '@/lib/search/arabic-normalize';
import { namesASpecificModel } from './route-query';
import { classifyZeroResult } from './catalog-gap';

export interface RecoveryEligibilityInput {
  rawQuery: string;
  resolvedCategory: string | null;
  categoryEnforcedZero: boolean;
  count: number;
  isTest: boolean;
}

export interface RecoveryEligibilityResult {
  eligible: boolean;
  reason: string;
  dedupKey: string | null;
}

/**
 * Deterministic identity for idempotency (Part 8) — category + the normalized query text
 * (normalizeArabic already folds hamza/ة/ى/digit variants, the SAME normalization the search
 * route itself applies before matching titles). "Galaxy S27 Ultra 512GB" and "galaxy s27
 * ultra 512gb" collapse to the same key; two genuinely different phrasings of the same real
 * product do NOT — a documented v1 limitation (ADR-292), not silently pretended away.
 */
export function buildRecoveryDedupKey(category: string, rawQuery: string): string {
  // normalizeArabic folds hamza/ة/ى/digit variants but does not touch Latin case — lowercase
  // explicitly so "Galaxy S27" and "galaxy s27" collapse to the same key too.
  const normalized = normalizeArabic(rawQuery).toLowerCase().trim().replace(/\s+/g, ' ');
  return `${category}::${normalized}`;
}

export function assessRecoveryEligibility(input: RecoveryEligibilityInput): RecoveryEligibilityResult {
  if (input.isTest) return { eligible: false, reason: 'test_provenance_excluded', dedupKey: null };
  if (input.count > 0) return { eligible: false, reason: 'not_a_zero_result', dedupKey: null };
  const zeroReason = classifyZeroResult({
    rawQuery: input.rawQuery,
    resolvedCategory: input.resolvedCategory,
    categoryEnforcedZero: input.categoryEnforcedZero,
  });
  if (zeroReason !== 'CATALOG_MISSING') return { eligible: false, reason: `zero_reason_${zeroReason.toLowerCase()}`, dedupKey: null };
  // classifyZeroResult's CATALOG_MISSING already requires resolvedCategory AND
  // namesASpecificModel(rawQuery) — re-asserted here defensively rather than trusted blindly,
  // since eligibility is the one gate standing between a shopper query and a real provider
  // request/API cost (Part 19).
  if (!input.resolvedCategory || !namesASpecificModel(input.rawQuery)) {
    return { eligible: false, reason: 'no_strong_identity', dedupKey: null };
  }
  return { eligible: true, reason: 'exact_model_catalog_missing', dedupKey: buildRecoveryDedupKey(input.resolvedCategory, input.rawQuery) };
}

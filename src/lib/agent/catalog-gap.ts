// src/lib/agent/catalog-gap.ts — Truth Hardening mission (2026-09-05), Product Gap connection
// (ADR-290 §14/§45, ADR-291). A zero-result must never collapse into one undifferentiated
// "coverage problem" (Founder Intelligence's own `high_demand_low_coverage`/`recoverable_unmet`
// cards already make exactly this mistake for CATEGORY-level demand — see ADR-291). This is the
// per-QUERY equivalent: classify WHY a specific search returned nothing, using only signals
// already computed by the search route — no new provider call, no new parsing, no live
// discovery. SIGNAL ONLY: this never inserts a product, never calls a merchant, never triggers
// ingestion. It exists so a genuinely CATALOG_MISSING query (strong identity, known category,
// zero results) is distinguishable — for a human or the existing scheduled ingestion pipeline —
// from a parser/relevance defect that looks identical to a shopper but has a completely
// different fix. See ADR-291's own research on why synchronous/automatic merchant discovery is
// NOT implemented this pass (admin-gated scraper infra, fabrication-risk-prone insert path).
import { namesASpecificModel } from './route-query';

export type ZeroResultReason =
  | 'PARSER_FAILURE' // category could not be resolved at all — Tawveeri did not understand the category
  | 'SEARCH_RELEVANCE_FAILURE' // category resolved, but Tawveeri's own retrieval/relevance gate zeroed it
  | 'CATALOG_MISSING' // category resolved AND a specific brand+model was named — strong identity, genuinely absent
  | 'INSUFFICIENT_EVIDENCE'; // category resolved, no strong identity signal — too ambiguous to classify further

/**
 * Pure, deterministic. Only meaningful when the search genuinely returned zero results — the
 * caller decides when to invoke this (see search-client.tsx's `no_answer` event).
 */
export function classifyZeroResult(params: {
  rawQuery: string;
  resolvedCategory: string | null;
  categoryEnforcedZero: boolean;
}): ZeroResultReason {
  if (!params.resolvedCategory) return 'PARSER_FAILURE';
  // Section 35 priority: exact brand+model identity is the highest-value recovery case — flag it
  // distinctly from an ordinary ambiguous zero, regardless of which internal gate produced the
  // zero (categoryEnforcedZero or an otherwise-empty result set both count).
  if (namesASpecificModel(params.rawQuery)) return 'CATALOG_MISSING';
  if (params.categoryEnforcedZero) return 'SEARCH_RELEVANCE_FAILURE';
  return 'INSUFFICIENT_EVIDENCE';
}

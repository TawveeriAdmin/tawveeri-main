// src/lib/enrichment/gtin-identity.ts
// ─────────────────────────────────────────────────────────────────────────────
// GTIN-based corroboration — the parser-INDEPENDENT comparison path.
//
// The progressive engine corroborates by a parser-derived identity_key. This module
// adds a second, orthogonal authority: the GTIN. Two offers from different stores that
// carry the SAME valid GTIN are the same commercial variant with certainty — even when
// their titles are worded so differently that the name parser never fused them. That is
// exactly the population stuck at "single-store": a real second offer exists, only the
// text-matcher missed it. Grouping by GTIN recovers those as genuine comparisons.
//
// This is a PURE grouping function (no I/O, no DB) so it is trivially testable and can be
// driven by either the resolver (Icecat-confirmed GTINs) or raw merchant-declared GTINs.
// It DECIDES nothing about price/trust — it only asserts co-identity, which the existing
// evidence engine then scores. Precision by construction: only GS1-checksum-valid GTINs
// participate (isValidGtin), and only ≥2 DISTINCT stores make a comparison (corroboration
// dominates — a single store repeating a GTIN is not a comparison).
// ─────────────────────────────────────────────────────────────────────────────
import { gtinKey } from "./icecat";

/** Minimal shape an observation must expose to participate in GTIN corroboration. */
export interface GtinObservation {
  store_id: number | string | null;
  gtin: string | number | null | undefined;
  /** Opaque passthrough so callers can carry their own row (raw_obs_id, url, price…). */
  [k: string]: unknown;
}

export interface GtinGroup<T extends GtinObservation> {
  gtinKey: string;              // canonical GTIN-14 key
  stores: (number | string)[]; // DISTINCT stores carrying this GTIN
  observations: T[];            // all contributing observations (provenance preserved)
  isComparison: boolean;        // ≥2 distinct stores
}

/**
 * Group observations by canonical GTIN. Observations without a checksum-valid GTIN are
 * dropped (never guessed). Groups are keyed by GTIN-14 so UPC-A/EAN-13 leading-zero
 * variants of one trade item collapse together. `isComparison` marks the ≥2-store groups —
 * the ones that convert previously single-store products into real cross-store comparisons.
 */
export function groupByGtin<T extends GtinObservation>(observations: T[]): GtinGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const o of observations) {
    const key = gtinKey(o.gtin);
    if (!key) continue; // no valid GTIN → cannot corroborate on GTIN; leave to the parser path
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(o);
  }

  const groups: GtinGroup<T>[] = [];
  for (const [key, obs] of byKey) {
    const stores = [...new Set(obs.map((o) => o.store_id).filter((s): s is number | string => s !== null && s !== undefined))];
    groups.push({ gtinKey: key, stores, observations: obs, isComparison: stores.length >= 2 });
  }
  // Deepest comparisons first — most cross-store corroboration is the most valuable.
  return groups.sort((a, b) => b.stores.length - a.stores.length);
}

/** Just the ≥2-store groups — the ones that add real comparisons. Convenience over groupByGtin. */
export function gtinComparisons<T extends GtinObservation>(observations: T[]): GtinGroup<T>[] {
  return groupByGtin(observations).filter((g) => g.isComparison);
}

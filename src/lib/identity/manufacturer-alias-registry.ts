// src/lib/identity/manufacturer-alias-registry.ts — evidence-backed manufacturer model aliases (code A ≡ code B).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// STATUS: DATA ONLY, SHADOW, EMPTY BY DESIGN. An alias is the ONLY thing that may soften "two different trusted manufacturer codes
// are two different products" (Rule B). An entry needs a DOCUMENTED source: a manufacturer page / spec sheet / regional price-list
// that says the two codes are the same hardware, or trusted distributor documentation. It never comes from price proximity, title
// similarity, a single merchant's listing, a human label, or "they look alike".
//
// Add an entry only with every field filled; a missing field makes `aliasStatus` ignore it.

export interface ManufacturerAlias {
  brand: string;            // lower-case, e.g. 'hisense'
  code_a: string;           // normalized (see normCode)
  code_b: string;
  evidence_url: string;     // manufacturer or documented distributor source
  evidence_date: string;    // ISO date the source was read
  market: string;           // market / region the equivalence holds for, e.g. 'KSA↔GCC'
  identical_hardware: boolean;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export const MANUFACTURER_ALIASES: readonly ManufacturerAlias[] = [];

export const normCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export type AliasStatus = 'none' | 'documented_identical' | 'documented_not_identical';

/** Alias relation of two codes of one brand per the registry; entries without evidence fields are ignored. */
export function aliasStatus(brand: string | null, a: string, b: string, registry: readonly ManufacturerAlias[] = MANUFACTURER_ALIASES): AliasStatus {
  if (!brand) return 'none';
  const x = normCode(a), y = normCode(b);
  const hit = registry.find((e) =>
    e.evidence_url && e.evidence_date && e.market && e.brand === brand.toLowerCase() &&
    ((normCode(e.code_a) === x && normCode(e.code_b) === y) || (normCode(e.code_a) === y && normCode(e.code_b) === x)));
  if (!hit) return 'none';
  return hit.identical_hardware && hit.confidence !== 'low' ? 'documented_identical' : 'documented_not_identical';
}

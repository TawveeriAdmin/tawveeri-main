// src/lib/catalog/getAcFacetOverview.ts
// ─────────────────────────────────────────────────────────────────────────────
// Facet tier for air_conditioner, ONE LEVEL BELOW the existing /categories/[slug] page
// (ADR-226). Reads docs/CATEGORY-PAGES-PLAN.md §1-§5 for the full derivation — summary:
//
// - `/categories/[slug]` already exists and is live for air_conditioner (ADR-226) and does
//   NOT need rebuilding. What's genuinely new is a facet slice below it, because AC's
//   identity_key is the one category-registry key that is already a clean, structured
//   spec key (`brand|ac_type|series_or_platform|capacity_btu|technology|cooling_mode` —
//   scripts/tps-core/category-registry.ts), not an opaque model string like TV's.
// - Facets are gated by MIN_COMPARABLE_FOR_FACET (20), derived by the SAME
//   largest-relative-gap method `navigable-categories.ts` used to justify its own 30 —
//   applied to the live facet-count distribution, not copied from that file's constant.
// - BTU bands are centered on the nominal Gulf-market AC capacity classes (12,000 / 18,000 /
//   24,000 / 30,000 BTU) with boundaries picked from the live gaps in the observed BTU
//   distribution (there is a real gap between clusters at every boundary below — this is
//   not an arbitrary equal-width split). Anything ≥36,500 BTU (commercial-scale units) is
//   too thin today (measured 6-7 products) and deliberately gets no page.
// - Brand facets are NOT hardcoded: computed live from the same `brands` aggregation
//   `getCategoryOverview` already produces, case-folded so `Samsung`/`samsung` don't split
//   a brand's count across two facet slugs, filtered to whatever currently clears the gate.
// - Single-dimension facets only (BTU band OR brand, never combined) — see plan §5 point 3:
//   combinatorial facets (e.g. "LG 18,000 BTU Inverter") are low-count, high-overlap, and
//   the textbook near-duplicate/doorway risk pattern. Not built, not planned for v1.
// - `technology` (Inverter/Standard) and `ac_type` (split/window) are NOT exposed as their
//   own facet URLs even though both numerically clear the gate — see plan §5 point 4: a
//   2-value split doesn't carry enough distinct search intent to justify a separate
//   indexable URL. They stay as on-page badges only (already rendered by the parent page).
// ─────────────────────────────────────────────────────────────────────────────

import { cache } from 'react';
import {
  fetchProjectionRows,
  summarizeProjectionRows,
  type ProjectionRow,
  type CategoryOverview,
} from './getCategoryOverview';

/** THE RULE (constant, mirrors MIN_COMPARABLE_FOR_NAVIGATION's pattern in navigable-categories.ts). */
export const MIN_COMPARABLE_FOR_FACET = 20;

export type AcFacetType = 'btu' | 'brand';

export interface AcFacetDef {
  slug: string;
  type: AcFacetType;
  labelAr: string;
  labelEn: string;
  /** Only for type 'btu' — inclusive-low/exclusive-high band on the parsed BTU number. */
  btuMin?: number;
  btuMax?: number;
  /** Only for type 'brand' — the case-folded brand token to match against. */
  brandKey?: string;
}

export interface ParsedAcKey {
  brand: string | null;
  acType: string | null;
  series: string | null;
  btu: number | null;
  technology: string | null;
  coolingMode: string | null;
}

/**
 * Parses `brand|ac_type|series_or_platform|capacity_btu|technology|cooling_mode` — the exact
 * shape `category-registry.ts`'s `air_conditioner.attrs` already reads. A key that doesn't
 * split into 6 parts (a small number of legacy/malformed rows, per the live probe — 3 of 172)
 * parses to all-null rather than throwing; callers treat null fields as "doesn't match any
 * facet", never as a fabricated value.
 */
export function parseAcIdentityKey(key: string | null): ParsedAcKey {
  const parts = (key || '').split('|');
  if (parts.length < 6) {
    return { brand: null, acType: null, series: null, btu: null, technology: null, coolingMode: null };
  }
  const btuNum = Number(parts[3]);
  return {
    brand: parts[0] || null,
    acType: parts[1] || null,
    series: parts[2] === 'NO_SERIES' ? null : parts[2] || null,
    btu: Number.isFinite(btuNum) ? btuNum : null,
    technology: parts[4] || null,
    coolingMode: parts[5] || null,
  };
}

/**
 * BTU band boundaries — derived from the live distribution (2026-08-25 probe), not an
 * equal-width guess. Each boundary sits in a genuine gap between value clusters:
 *   12,000-class: 11,800–12,600 (next real value is 16,000 — a 3,400 gap)
 *   18,000-class: 16,000–19,300 (next real value is 20,000 — a 700 gap, smallest of the four,
 *     but still a real cluster edge, not a mid-cluster cut)
 *   24,000-class: 20,000–25,000
 *   30,000-class: 27,000–36,000 (25,000–27,000 has zero live observations — the true gap)
 * Recompute this table if a fresh probe shows the live distribution has shifted; these are
 * not meant to be permanent, just honest about today's data (see plan §1).
 */
export const BTU_BANDS: Array<{ slug: string; labelAr: string; labelEn: string; min: number; max: number }> = [
  { slug: '12000-btu', labelAr: '12,000 وحدة حرارية (BTU)', labelEn: '12,000 BTU', min: 10000, max: 15000 },
  { slug: '18000-btu', labelAr: '18,000 وحدة حرارية (BTU)', labelEn: '18,000 BTU', min: 15000, max: 20000 },
  { slug: '24000-btu', labelAr: '24,000 وحدة حرارية (BTU)', labelEn: '24,000 BTU', min: 20000, max: 25500 },
  { slug: '30000-btu', labelAr: '30,000 وحدة حرارية (BTU)', labelEn: '30,000 BTU', min: 25500, max: 36500 },
];

const BRAND_LABELS: Record<string, string> = {
  lg: 'LG',
  gree: 'Gree',
  midea: 'Midea',
  samsung: 'Samsung',
  hisense: 'Hisense',
  haam: 'HAAM',
  aux: 'AUX',
};

function brandLabel(key: string): string {
  return BRAND_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1));
}

type ParsedAcRow = { row: ProjectionRow; parsed: ParsedAcKey };

/** Pure predicate: does this parsed row belong to this facet? Shared by gating and filtering. */
export function matchesAcFacet(parsed: ParsedAcKey, facet: AcFacetDef): boolean {
  if (facet.type === 'btu') {
    return parsed.btu != null && parsed.btu >= (facet.btuMin as number) && parsed.btu < (facet.btuMax as number);
  }
  return parsed.brand != null && parsed.brand.toLowerCase() === facet.brandKey;
}

/**
 * Pure core: given already-parsed rows, which facets clear MIN_COMPARABLE_FOR_FACET today?
 * No DB access — this is what `tests/catalog/ac-facet-overview.test.ts` exercises directly
 * with synthetic rows, the same "pure core, tested directly" pattern
 * `scripts/build-tps-projection.ts`'s `deriveProjection` already established in this repo
 * (see `tests/catalog/projection-derive.test.ts`).
 */
export function deriveQualifyingFacets(parsedRows: ParsedAcRow[]): Array<AcFacetDef & { count: number }> {
  const out: Array<AcFacetDef & { count: number }> = [];

  for (const band of BTU_BANDS) {
    const count = parsedRows.filter(({ parsed }) => parsed.btu != null && parsed.btu >= band.min && parsed.btu < band.max).length;
    if (count >= MIN_COMPARABLE_FOR_FACET) {
      out.push({ slug: band.slug, type: 'btu', labelAr: band.labelAr, labelEn: band.labelEn, btuMin: band.min, btuMax: band.max, count });
    }
  }

  const brandCounts = new Map<string, number>();
  for (const { parsed } of parsedRows) {
    if (!parsed.brand) continue;
    const key = parsed.brand.toLowerCase();
    brandCounts.set(key, (brandCounts.get(key) ?? 0) + 1);
  }
  for (const [brandKey, count] of brandCounts.entries()) {
    if (brandKey === 'unknown') continue; // not a real brand — never gets a page
    if (count >= MIN_COMPARABLE_FOR_FACET) {
      const label = brandLabel(brandKey);
      out.push({ slug: brandKey, type: 'brand', labelAr: label, labelEn: label, brandKey, count });
    }
  }

  return out.sort((a, b) => b.count - a.count);
}

export interface AcFacetOverview {
  facet: AcFacetDef & { count: number };
  overview: CategoryOverview;
}

/**
 * Pure core for a single facet's overview: resolves the slug against the SAME live-gated
 * list `deriveQualifyingFacets` produces (so an unknown or thin-today slug returns null,
 * never a stale/fabricated result), then aggregates the matching rows with the SAME
 * `summarizeProjectionRows` the parent category page uses. No DB access.
 */
export function deriveFacetOverview(parsedRows: ParsedAcRow[], facetSlug: string): AcFacetOverview | null {
  const qualifying = deriveQualifyingFacets(parsedRows);
  const facet = qualifying.find((f) => f.slug === facetSlug);
  if (!facet) return null;

  const matched = parsedRows.filter(({ parsed }) => matchesAcFacet(parsed, facet));
  const overview = summarizeProjectionRows(matched.map((m) => m.row));
  return { facet, overview };
}

/**
 * Every row carrying a parseable AC identity key. Memoized per request (React `cache()`,
 * same pattern as `getCategoryOverview`) — a facet page's `generateMetadata` and page body
 * both resolve the same facet, and `resolveAcFacet`/`getAcFacetOverview` both call this;
 * without memoization that's up to 4 identical queries against `tps_product_projection`
 * per request.
 */
const fetchAcRows = cache(async (): Promise<ParsedAcRow[]> => {
  const rows = await fetchProjectionRows('air_conditioner');
  return rows.map((row) => ({ row, parsed: parseAcIdentityKey(row.tps_identity_key) }));
});

/**
 * Live, gate-checked list of facets qualifying TODAY (≥ MIN_COMPARABLE_FOR_FACET). Used by
 * the parent category page (internal links) and the sitemap — the same "one shared
 * measurement drives both nav and sitemap" discipline `navigable-categories.ts` already
 * established at the category level.
 */
export async function getQualifyingAcFacets(): Promise<Array<AcFacetDef & { count: number }>> {
  return deriveQualifyingFacets(await fetchAcRows());
}

/** Resolves a URL segment to a facet definition, or null if it isn't a recognized facet slug. */
export async function resolveAcFacet(facetSlug: string): Promise<AcFacetDef | null> {
  const qualifying = await getQualifyingAcFacets();
  return qualifying.find((f) => f.slug === facetSlug) ?? null;
}

/**
 * The facet-scoped equivalent of `getCategoryOverview`. Returns null if the slug doesn't
 * resolve or has fallen below the gate since the last request (handled identically to the
 * parent page's own "gate said yes, render says no" honesty check — see `[slug]/page.tsx`'s
 * comment on the same class of race).
 */
export async function getAcFacetOverview(facetSlug: string): Promise<AcFacetOverview | null> {
  return deriveFacetOverview(await fetchAcRows(), facetSlug);
}

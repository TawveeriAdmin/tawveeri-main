// tests/catalog/ac-facet-overview.test.ts
// Category-facet-pages mission (2026-08-25, docs/CATEGORY-PAGES-PLAN.md). Exercises the
// PURE core of the AC facet tier directly — same "pure core, tested without a DB" pattern
// `tests/catalog/projection-derive.test.ts` already established for `deriveProjection`.
import {
  parseAcIdentityKey,
  matchesAcFacet,
  deriveQualifyingFacets,
  deriveFacetOverview,
  MIN_COMPARABLE_FOR_FACET,
  BTU_BANDS,
  type AcFacetDef,
} from '@/lib/catalog/getAcFacetOverview';
import type { ProjectionRow } from '@/lib/catalog/getCategoryOverview';

function row(over: Partial<ProjectionRow> = {}): ProjectionRow {
  return {
    tps_identity_key: 'lg|split|NO_SERIES|18000|Inverter|cool_only',
    display_name_ar: 'مكيف',
    display_name_en: 'AC',
    brand: 'lg',
    image_url: null,
    lowest_price: 2000,
    highest_price: 2500,
    store_count: 2,
    compare_url: '/compare/lg|split|NO_SERIES|18000|Inverter|cool_only',
    last_observed_at: '2026-08-25T00:00:00.000Z',
    ...over,
  };
}

function parsedRow(key: string, brand: string, priceLow = 2000, priceHigh = 2500) {
  return { row: row({ tps_identity_key: key, brand, lowest_price: priceLow, highest_price: priceHigh }), parsed: parseAcIdentityKey(key) };
}

describe('parseAcIdentityKey', () => {
  it('splits the 6-field AC key exactly as category-registry.ts writes it', () => {
    const p = parseAcIdentityKey('lg|split|FreshDV|18000|Inverter|hot_cold');
    expect(p).toEqual({ brand: 'lg', acType: 'split', series: 'FreshDV', btu: 18000, technology: 'Inverter', coolingMode: 'hot_cold' });
  });

  it('treats the NO_SERIES sentinel as null, never as a real series value', () => {
    expect(parseAcIdentityKey('lg|split|NO_SERIES|18000|Inverter|cool_only').series).toBeNull();
  });

  it('parses to all-null (never throws, never fabricates) on a malformed key', () => {
    expect(parseAcIdentityKey('lg|split|MODEL:WWA25K22R')).toEqual({
      brand: null, acType: null, series: null, btu: null, technology: null, coolingMode: null,
    });
    expect(parseAcIdentityKey(null)).toEqual({
      brand: null, acType: null, series: null, btu: null, technology: null, coolingMode: null,
    });
  });

  it('parses a non-numeric BTU field to null rather than NaN', () => {
    expect(parseAcIdentityKey('lg|split|NO_SERIES|xyz|Inverter|cool_only').btu).toBeNull();
  });
});

describe('BTU band boundaries — matchesAcFacet', () => {
  const btuFacet = (min: number, max: number): AcFacetDef => ({ slug: 'x', type: 'btu', labelAr: 'x', labelEn: 'x', btuMin: min, btuMax: max });

  it('the 18,000 band is inclusive at its low edge and exclusive at its high edge', () => {
    const band = BTU_BANDS.find((b) => b.slug === '18000-btu')!;
    expect(matchesAcFacet(parseAcIdentityKey('lg|split|NO_SERIES|15000|Inverter|cool_only'), btuFacet(band.min, band.max))).toBe(true);
    expect(matchesAcFacet(parseAcIdentityKey('lg|split|NO_SERIES|19999|Inverter|cool_only'), btuFacet(band.min, band.max))).toBe(true);
    expect(matchesAcFacet(parseAcIdentityKey('lg|split|NO_SERIES|20000|Inverter|cool_only'), btuFacet(band.min, band.max))).toBe(false);
    expect(matchesAcFacet(parseAcIdentityKey('lg|split|NO_SERIES|14999|Inverter|cool_only'), btuFacet(band.min, band.max))).toBe(false);
  });

  it('a row with no parseable BTU matches no BTU band', () => {
    const parsed = parseAcIdentityKey('lg|split|MODEL:WWA25K22R');
    for (const band of BTU_BANDS) {
      expect(matchesAcFacet(parsed, btuFacet(band.min, band.max))).toBe(false);
    }
  });

  it('brand matching is case-insensitive (Samsung and samsung are the same facet)', () => {
    const facet: AcFacetDef = { slug: 'samsung', type: 'brand', labelAr: 'Samsung', labelEn: 'Samsung', brandKey: 'samsung' };
    expect(matchesAcFacet(parseAcIdentityKey('Samsung|split|NO_SERIES|18000|Inverter|cool_only'), facet)).toBe(true);
    expect(matchesAcFacet(parseAcIdentityKey('samsung|split|NO_SERIES|18000|Inverter|cool_only'), facet)).toBe(true);
    expect(matchesAcFacet(parseAcIdentityKey('lg|split|NO_SERIES|18000|Inverter|cool_only'), facet)).toBe(false);
  });
});

describe('deriveQualifyingFacets — the gate (MIN_COMPARABLE_FOR_FACET = 20)', () => {
  it('excludes a facet with fewer than 20 matching rows (thin — no page)', () => {
    const rows = Array.from({ length: 19 }, () => parsedRow('lg|split|NO_SERIES|18000|Inverter|cool_only', 'lg'));
    const out = deriveQualifyingFacets(rows);
    expect(out.find((f) => f.slug === '18000-btu')).toBeUndefined();
  });

  it('includes a facet at exactly 20 matching rows (the gate is >=, not >)', () => {
    const rows = Array.from({ length: MIN_COMPARABLE_FOR_FACET }, () => parsedRow('lg|split|NO_SERIES|18000|Inverter|cool_only', 'lg'));
    const out = deriveQualifyingFacets(rows);
    const btuFacet = out.find((f) => f.slug === '18000-btu');
    expect(btuFacet).toBeDefined();
    expect(btuFacet!.count).toBe(MIN_COMPARABLE_FOR_FACET);
  });

  it('never emits a facet for the "unknown" brand sentinel, however many rows it has', () => {
    const rows = Array.from({ length: 50 }, () => parsedRow('unknown|split|NO_SERIES|18000|Inverter|cool_only', 'unknown'));
    const out = deriveQualifyingFacets(rows);
    expect(out.find((f) => f.type === 'brand' && f.slug === 'unknown')).toBeUndefined();
  });

  it('merges brand counts case-insensitively rather than splitting "Samsung"/"samsung" into two facets', () => {
    const rows = [
      ...Array.from({ length: 12 }, () => parsedRow('Samsung|split|NO_SERIES|18000|Inverter|cool_only', 'Samsung')),
      ...Array.from({ length: 10 }, () => parsedRow('samsung|split|NO_SERIES|18000|Inverter|cool_only', 'samsung')),
    ];
    const out = deriveQualifyingFacets(rows);
    const samsungFacets = out.filter((f) => f.type === 'brand' && f.slug === 'samsung');
    expect(samsungFacets).toHaveLength(1);
    expect(samsungFacets[0].count).toBe(22);
  });

  it('reproduces the live-measured qualifying set from the 2026-08-25 production probe (7 facets)', () => {
    // Counts taken from docs/CATEGORY-PAGES-PLAN.md §1/§3 — not a coincidence, this is the
    // exact scenario the plan's "7 real facet pages today" claim rests on.
    const rows = [
      ...Array.from({ length: 21 }, () => parsedRow('lg|split|NO_SERIES|12000|Inverter|cool_only', 'lg')),
      ...Array.from({ length: 70 }, () => parsedRow('lg|split|NO_SERIES|18000|Inverter|cool_only', 'lg')),
      ...Array.from({ length: 44 }, () => parsedRow('gree|split|NO_SERIES|24000|Inverter|cool_only', 'gree')),
      ...Array.from({ length: 28 }, () => parsedRow('midea|split|NO_SERIES|30000|Inverter|cool_only', 'midea')),
    ];
    const out = deriveQualifyingFacets(rows);
    const btuSlugs = out.filter((f) => f.type === 'btu').map((f) => f.slug).sort();
    expect(btuSlugs).toEqual(['12000-btu', '18000-btu', '24000-btu', '30000-btu']);
    const brandSlugs = out.filter((f) => f.type === 'brand').map((f) => f.slug).sort();
    expect(brandSlugs).toEqual(['gree', 'lg', 'midea']);
    expect(out).toHaveLength(7);
  });
});

describe('deriveFacetOverview — facet-scoped aggregation', () => {
  it('returns null for an unrecognized facet slug', () => {
    const rows = Array.from({ length: 30 }, () => parsedRow('lg|split|NO_SERIES|18000|Inverter|cool_only', 'lg'));
    expect(deriveFacetOverview(rows, 'not-a-real-facet')).toBeNull();
  });

  it('returns null (not an empty overview) for a facet that is thin today, even if it was linked once', () => {
    const rows = Array.from({ length: 5 }, () => parsedRow('midea|split|NO_SERIES|30000|Inverter|cool_only', 'midea'));
    expect(deriveFacetOverview(rows, '30000-btu')).toBeNull();
  });

  it('a facet page price range reflects ONLY that facet\'s rows, not the whole category', () => {
    const rows = [
      ...Array.from({ length: 25 }, (_, i) => parsedRow('lg|split|NO_SERIES|18000|Inverter|cool_only', 'lg', 1500 + i, 1600 + i)),
      ...Array.from({ length: 25 }, (_, i) => parsedRow('lg|split|NO_SERIES|30000|Inverter|cool_only', 'lg', 5000 + i, 5100 + i)),
    ];
    const result = deriveFacetOverview(rows, '18000-btu')!;
    expect(result.overview.comparableCount).toBe(25);
    expect(result.overview.priceRange!.min).toBe(1500);
    expect(result.overview.priceRange!.max).toBe(1624);
    // The 30,000-BTU rows' much higher prices must never leak into the 18,000-BTU page.
    expect(result.overview.priceRange!.max).toBeLessThan(5000);
  });

  it('the returned facet.count matches the actual number of products rendered', () => {
    const rows = Array.from({ length: 34 }, () => parsedRow('lg|split|NO_SERIES|18000|Inverter|cool_only', 'lg'));
    const result = deriveFacetOverview(rows, '18000-btu')!;
    expect(result.facet.count).toBe(34);
    expect(result.overview.products).toHaveLength(34);
  });
});
